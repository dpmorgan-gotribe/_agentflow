/**
 * Meta-Prompt Injector
 *
 * Renders and injects meta-prompts into the prompt hierarchy.
 * Includes security validation and token budget management.
 */

import Handlebars from 'handlebars';

import {
  MetaPromptActivationError,
  MetaPromptContextError,
  MetaPromptRenderError,
} from '../errors.js';
import { META_PROMPT_LIBRARY, getMetaPromptsByPriority } from './library.js';
import type {
  MetaPromptAuditEntry,
  MetaPromptContext,
  MetaPromptDefinition,
  MetaPromptInjectionResult,
  RenderedMetaPrompt,
} from './types.js';
import { metaPromptContextSchema } from './types.js';

/**
 * Characters per token estimate (conservative for English text)
 */
const CHARS_PER_TOKEN = 4;

/**
 * Default token budget for meta-prompts
 */
const DEFAULT_META_TOKEN_BUDGET = 1500;

/**
 * Meta-Prompt Injector class
 */
export class MetaPromptInjector {
  private handlebars: typeof Handlebars;
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate> =
    new Map();
  private auditLog: MetaPromptAuditEntry[] = [];
  private maxAuditEntries = 1000;
  private tokenBudget: number;

  constructor(tokenBudget = DEFAULT_META_TOKEN_BUDGET) {
    this.tokenBudget = tokenBudget;
    this.handlebars = Handlebars.create();
    this.registerHelpers();
    this.precompileTemplates();
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // Safe equality check helper
    this.handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

    // Safe not-equal helper
    this.handlebars.registerHelper('neq', (a: unknown, b: unknown) => a !== b);

    // Safe array contains helper
    this.handlebars.registerHelper(
      'contains',
      (arr: unknown[], item: unknown) =>
        Array.isArray(arr) && arr.includes(item)
    );

    // Safe array length helper
    this.handlebars.registerHelper('length', (arr: unknown[]) =>
      Array.isArray(arr) ? arr.length : 0
    );

    // Safe greater-than helper
    this.handlebars.registerHelper(
      'gt',
      (a: number, b: number) =>
        typeof a === 'number' && typeof b === 'number' && a > b
    );

    // Safe less-than helper
    this.handlebars.registerHelper(
      'lt',
      (a: number, b: number) =>
        typeof a === 'number' && typeof b === 'number' && a < b
    );
  }

  /**
   * Precompile all meta-prompt templates
   */
  private precompileTemplates(): void {
    for (const metaPrompt of META_PROMPT_LIBRARY) {
      try {
        const compiled = this.handlebars.compile(metaPrompt.template, {
          strict: true,
          noEscape: false,
        });
        this.compiledTemplates.set(metaPrompt.id, compiled);
      } catch (error) {
        throw new MetaPromptRenderError(
          `Failed to compile meta-prompt template: ${error instanceof Error ? error.message : String(error)}`,
          metaPrompt.id,
          { template: metaPrompt.template.substring(0, 200) }
        );
      }
    }
  }

  /**
   * Validate and sanitize context
   */
  private validateContext(context: MetaPromptContext): MetaPromptContext {
    const result = metaPromptContextSchema.safeParse(context);
    if (!result.success) {
      const invalidFields = result.error.errors.map((e) => e.path.join('.'));
      throw new MetaPromptContextError(
        `Context validation failed: ${result.error.message}`,
        invalidFields,
        { errors: result.error.errors }
      );
    }
    return result.data;
  }

  /**
   * Check if a meta-prompt should be activated
   */
  private shouldActivate(
    metaPrompt: MetaPromptDefinition,
    context: MetaPromptContext
  ): { activate: boolean; reason?: string } {
    const { activation } = metaPrompt;

    switch (activation.type) {
      case 'always':
        return { activate: true };

      case 'agent':
        if (!activation.agents || activation.agents.length === 0) {
          return { activate: true };
        }
        if (activation.agents.includes(context.agentType)) {
          return { activate: true };
        }
        return {
          activate: false,
          reason: `Agent type ${context.agentType} not in activation list`,
        };

      case 'state':
        if (!activation.states || activation.states.length === 0) {
          return { activate: true };
        }
        if (activation.states.includes(context.workflowState)) {
          return { activate: true };
        }
        return {
          activate: false,
          reason: `Workflow state ${context.workflowState} not in activation list`,
        };

      case 'context':
        if (!activation.contextKeys || activation.contextKeys.length === 0) {
          return { activate: true };
        }
        // Check if any of the required context keys have values
        for (const key of activation.contextKeys) {
          const value = this.getContextValue(context, key);
          if (value !== undefined && value !== null) {
            // For arrays, check if non-empty
            if (Array.isArray(value) && value.length > 0) {
              return { activate: true };
            }
            // For other values, just check existence
            if (!Array.isArray(value)) {
              return { activate: true };
            }
          }
        }
        return {
          activate: false,
          reason: `Required context keys not present: ${activation.contextKeys.join(', ')}`,
        };

      case 'custom':
        // Custom predicates are evaluated as simple expressions
        // For security, we only support basic checks
        if (activation.customPredicate) {
          try {
            return this.evaluateCustomPredicate(
              activation.customPredicate,
              context
            );
          } catch (error) {
            throw new MetaPromptActivationError(
              `Custom predicate evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
              metaPrompt.id,
              'custom',
              { predicate: activation.customPredicate }
            );
          }
        }
        return { activate: true };

      default:
        return { activate: false, reason: 'Unknown activation type' };
    }
  }

  /**
   * Get a value from context by key
   */
  private getContextValue(context: MetaPromptContext, key: string): unknown {
    switch (key) {
      case 'lessons':
        return context.lessons;
      case 'decisions':
        return context.decisions;
      case 'previousOutputs':
        return context.previousOutputs;
      case 'expertise':
        return context.expertise;
      case 'constraints':
        return context.constraints;
      case 'taskType':
        return context.taskType;
      case 'projectContext':
        return context.projectContext;
      default:
        return context.projectContext?.[key];
    }
  }

  /**
   * Evaluate custom predicate (limited for security)
   */
  private evaluateCustomPredicate(
    predicate: string,
    context: MetaPromptContext
  ): { activate: boolean; reason?: string } {
    // Support simple predicates like:
    // - "hasLessons" -> lessons array has items
    // - "isPlanning" -> workflowState === 'planning'
    // - "hasExpertise" -> expertise array has items

    const normalizedPredicate = predicate.toLowerCase().trim();

    if (normalizedPredicate === 'haslessons') {
      const has = (context.lessons?.length ?? 0) > 0;
      return { activate: has, reason: has ? undefined : 'No lessons present' };
    }

    if (normalizedPredicate === 'hasdecisions') {
      const has = (context.decisions?.length ?? 0) > 0;
      return {
        activate: has,
        reason: has ? undefined : 'No decisions present',
      };
    }

    if (normalizedPredicate === 'hasexpertise') {
      const has = (context.expertise?.length ?? 0) > 0;
      return {
        activate: has,
        reason: has ? undefined : 'No expertise present',
      };
    }

    if (normalizedPredicate === 'haspreviousoutputs') {
      const has = (context.previousOutputs?.length ?? 0) > 0;
      return {
        activate: has,
        reason: has ? undefined : 'No previous outputs present',
      };
    }

    if (normalizedPredicate.startsWith('is')) {
      const state = normalizedPredicate.substring(2);
      const matches = context.workflowState.toLowerCase() === state;
      return {
        activate: matches,
        reason: matches
          ? undefined
          : `State is ${context.workflowState}, not ${state}`,
      };
    }

    // Unknown predicate - default to not activating for safety
    return {
      activate: false,
      reason: `Unknown custom predicate: ${predicate}`,
    };
  }

  /**
   * Estimate tokens for a string
   */
  private estimateTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Render a meta-prompt with context
   */
  private render(
    metaPrompt: MetaPromptDefinition,
    context: MetaPromptContext
  ): string {
    const compiled = this.compiledTemplates.get(metaPrompt.id);
    if (!compiled) {
      throw new MetaPromptRenderError(
        `No compiled template found for meta-prompt`,
        metaPrompt.id
      );
    }

    try {
      // Build template context
      const templateContext = {
        agentType: context.agentType,
        workflowState: context.workflowState,
        lessons: context.lessons ?? [],
        decisions: context.decisions ?? [],
        previousOutputs: context.previousOutputs ?? [],
        expertise: context.expertise ?? [],
        constraints: context.constraints ?? [],
        taskType: context.taskType,
        projectContext: context.projectContext ?? {},
      };

      return compiled(templateContext);
    } catch (error) {
      throw new MetaPromptRenderError(
        `Failed to render meta-prompt: ${error instanceof Error ? error.message : String(error)}`,
        metaPrompt.id,
        { context: { agentType: context.agentType } }
      );
    }
  }

  /**
   * Apply token budget to content
   */
  private applyTokenBudget(
    content: string,
    maxTokens: number
  ): { content: string; truncated: boolean } {
    const estimatedTokens = this.estimateTokens(content);
    if (estimatedTokens <= maxTokens) {
      return { content, truncated: false };
    }

    // Truncate content to fit budget
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    const truncated = content.substring(0, maxChars - 20) + '\n[Truncated...]';
    return { content: truncated, truncated: true };
  }

  /**
   * Inject meta-prompts based on context
   */
  inject(context: MetaPromptContext): MetaPromptInjectionResult {
    const executionId = crypto.randomUUID();
    const warnings: string[] = [];
    const injected: RenderedMetaPrompt[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    try {
      // Validate context (security check)
      const validatedContext = this.validateContext(context);

      // Get meta-prompts sorted by priority
      const metaPrompts = getMetaPromptsByPriority();

      // Track total tokens used
      let totalTokensUsed = 0;

      for (const metaPrompt of metaPrompts) {
        // Check activation condition
        const activation = this.shouldActivate(metaPrompt, validatedContext);
        if (!activation.activate) {
          skipped.push({
            id: metaPrompt.id,
            reason: activation.reason ?? 'Activation condition not met',
          });
          continue;
        }

        // Check if we have budget
        if (totalTokensUsed + metaPrompt.maxTokens > this.tokenBudget) {
          skipped.push({
            id: metaPrompt.id,
            reason: `Token budget exceeded (${totalTokensUsed}/${this.tokenBudget})`,
          });
          warnings.push(
            `Meta-prompt ${metaPrompt.id} skipped due to token budget`
          );
          continue;
        }

        // Render the meta-prompt
        const rendered = this.render(metaPrompt, validatedContext);

        // Apply token budget to this specific meta-prompt
        const { content, truncated } = this.applyTokenBudget(
          rendered,
          metaPrompt.maxTokens
        );

        if (truncated) {
          warnings.push(
            `Meta-prompt ${metaPrompt.id} was truncated to fit token budget`
          );
        }

        const tokenEstimate = this.estimateTokens(content);
        totalTokensUsed += tokenEstimate;

        injected.push({
          id: metaPrompt.id,
          targetLayer: metaPrompt.targetLayer,
          content,
          tokenEstimate,
        });
      }

      // Log audit entry
      this.addAuditEntry({
        timestamp: new Date().toISOString(),
        executionId,
        agentType: validatedContext.agentType,
        metaPromptsInjected: injected.map((i) => i.id),
        metaPromptsSkipped: skipped.map((s) => s.id),
        totalTokens: totalTokensUsed,
        warnings: warnings.length > 0 ? warnings : undefined,
      });

      return {
        injected,
        skipped,
        totalTokens: totalTokensUsed,
        warnings,
      };
    } catch (error) {
      // Log error in audit
      this.addAuditEntry({
        timestamp: new Date().toISOString(),
        executionId,
        agentType: context.agentType,
        metaPromptsInjected: [],
        metaPromptsSkipped: [],
        totalTokens: 0,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Inject meta-prompts and return content grouped by layer
   */
  injectByLayer(context: MetaPromptContext): Map<number, RenderedMetaPrompt[]> {
    const result = this.inject(context);
    const byLayer = new Map<number, RenderedMetaPrompt[]>();

    for (const rendered of result.injected) {
      const existing = byLayer.get(rendered.targetLayer) ?? [];
      existing.push(rendered);
      byLayer.set(rendered.targetLayer, existing);
    }

    return byLayer;
  }

  /**
   * Get the combined content for a specific layer
   */
  getLayerContent(context: MetaPromptContext, layer: number): string {
    const byLayer = this.injectByLayer(context);
    const forLayer = byLayer.get(layer) ?? [];

    return forLayer.map((r) => r.content).join('\n\n');
  }

  /**
   * Add audit log entry
   */
  private addAuditEntry(entry: MetaPromptAuditEntry): void {
    this.auditLog.push(entry);

    // Trim old entries if exceeding max
    while (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog.shift();
    }
  }

  /**
   * Get audit log entries
   */
  getAuditLog(limit?: number): MetaPromptAuditEntry[] {
    if (limit) {
      return this.auditLog.slice(-limit);
    }
    return [...this.auditLog];
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * Get current token budget
   */
  getTokenBudget(): number {
    return this.tokenBudget;
  }

  /**
   * Set token budget
   */
  setTokenBudget(budget: number): void {
    if (budget <= 0) {
      throw new Error('Token budget must be positive');
    }
    this.tokenBudget = budget;
  }

  /**
   * Get meta-prompt library
   */
  getLibrary(): readonly MetaPromptDefinition[] {
    return META_PROMPT_LIBRARY;
  }
}

/**
 * Create a default meta-prompt injector
 */
export function createMetaPromptInjector(
  tokenBudget = DEFAULT_META_TOKEN_BUDGET
): MetaPromptInjector {
  return new MetaPromptInjector(tokenBudget);
}
