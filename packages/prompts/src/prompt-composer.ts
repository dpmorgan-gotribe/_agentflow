/**
 * Prompt Composer
 *
 * Assembles prompts from layers, resolves variables, and manages token budgets.
 * Includes security validation for variable injection.
 */

import { CompositionError, VariableValidationError } from './errors.js';
import { PROMPT_LAYERS, getRequiredLayers } from './prompt-layer.js';
import { PromptRegistry } from './prompt-registry.js';
import { TokenAllocator } from './token-allocator.js';
import type {
  AgentType,
  ComposedPrompt,
  CompositionOptions,
  CustomVariables,
  PromptAuditEntry,
  PromptLayer,
  PromptVariables,
  TokenAllocation,
  VariableValidation,
} from './types.js';
import {
  compositionOptionsSchema,
  customVariablesSchema,
  DEFAULT_TOKEN_ALLOCATION,
  promptVariablesSchema,
} from './types.js';

/**
 * Variable placeholder pattern
 */
const VARIABLE_PATTERN = /\{\{([a-z_][a-z0-9_]*)\}\}/gi;

/**
 * Prompt Composer class for building agent prompts
 */
export class PromptComposer {
  private registry: PromptRegistry;
  private allocator: TokenAllocator;
  private defaultAllocation: TokenAllocation;
  private auditLog: PromptAuditEntry[] = [];
  private maxAuditEntries = 1000;

  constructor(
    registry: PromptRegistry,
    allocation: TokenAllocation = DEFAULT_TOKEN_ALLOCATION
  ) {
    this.registry = registry;
    this.allocator = new TokenAllocator(allocation);
    this.defaultAllocation = allocation;
  }

  /**
   * Compose a complete prompt for an agent
   */
  compose(
    agentType: AgentType,
    variables: Partial<PromptVariables>,
    options: CompositionOptions = {}
  ): ComposedPrompt {
    const executionId = crypto.randomUUID();
    const warnings: string[] = [];
    const layersIncluded: number[] = [];
    const layersOmitted: number[] = [];

    try {
      // Validate options
      const optionsResult = compositionOptionsSchema.safeParse(options);
      if (!optionsResult.success) {
        throw new CompositionError(
          `Invalid composition options: ${optionsResult.error.message}`,
          { errors: optionsResult.error.errors }
        );
      }

      // Validate and sanitize variables
      const sanitizedVariables = this.validateAndSanitizeVariables(
        variables,
        options.customVariables
      );

      // Get agent-specific template overrides
      const template = this.registry.getTemplate(agentType);

      // Start with base layers
      let layers = [...PROMPT_LAYERS];

      // Apply template overrides if available
      if (template) {
        layers = this.applyTemplateOverrides(layers, template.layers);
      }

      // Filter excluded layers
      if (options.excludeLayers?.length) {
        layers = layers.filter((l) => !options.excludeLayers!.includes(l.id));
      }

      // Sort by priority for budget allocation
      layers.sort((a, b) => b.priority - a.priority);

      // Reset allocator for this composition
      this.allocator.reset();

      // Resolve variables and compose
      const maxTokens = options.maxTotalTokens ?? this.defaultAllocation.total;
      let currentTokens = 0;
      const composedSections: string[] = [];

      for (const layer of layers) {
        const layerContent = this.resolveLayer(layer, sanitizedVariables);
        const layerTokens = this.allocator.estimateTokens(layerContent);

        if (currentTokens + layerTokens > maxTokens) {
          if (layer.required) {
            // Must include required layers, but warn
            warnings.push(
              `Required layer ${layer.id} (${layer.name}) exceeds budget by ${currentTokens + layerTokens - maxTokens} tokens`
            );
            composedSections.push(layerContent);
            layersIncluded.push(layer.id);
            currentTokens += layerTokens;
          } else {
            // Skip optional layer
            layersOmitted.push(layer.id);
          }
        } else {
          composedSections.push(layerContent);
          layersIncluded.push(layer.id);
          currentTokens += layerTokens;
        }
      }

      // Compose final system prompt
      const systemPrompt = composedSections.join('\n\n');

      // Build user prompt from task context
      const userPrompt = this.buildUserPrompt(sanitizedVariables);
      const userTokens = this.allocator.estimateTokens(userPrompt);

      const result: ComposedPrompt = {
        systemPrompt,
        userPrompt,
        tokenCount: {
          system: currentTokens,
          user: userTokens,
          total: currentTokens + userTokens,
        },
        layersIncluded: layersIncluded.sort((a, b) => a - b),
        layersOmitted: layersOmitted.sort((a, b) => a - b),
        warnings,
      };

      // Log audit entry
      this.addAuditEntry({
        timestamp: new Date().toISOString(),
        executionId,
        agentType,
        variableKeys: Object.keys(sanitizedVariables),
        tokenCount: result.tokenCount,
        layersIncluded: result.layersIncluded,
        layersOmitted: result.layersOmitted,
        warnings: warnings.length > 0 ? warnings : undefined,
      });

      return result;
    } catch (error) {
      // Log error in audit
      this.addAuditEntry({
        timestamp: new Date().toISOString(),
        executionId,
        agentType,
        variableKeys: Object.keys(variables),
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Validate and sanitize variables for security
   */
  private validateAndSanitizeVariables(
    variables: Partial<PromptVariables>,
    customVariables?: CustomVariables
  ): Partial<PromptVariables> & CustomVariables {
    // Validate standard variables
    const stdResult = promptVariablesSchema.partial().safeParse(variables);
    if (!stdResult.success) {
      const invalidVars = stdResult.error.errors.map((e) => e.path.join('.'));
      throw new VariableValidationError(
        `Variable validation failed: ${stdResult.error.message}`,
        invalidVars,
        { errors: stdResult.error.errors }
      );
    }

    // Validate custom variables if provided
    if (customVariables) {
      const customResult = customVariablesSchema.safeParse(customVariables);
      if (!customResult.success) {
        const invalidVars = customResult.error.errors.map((e) =>
          e.path.join('.')
        );
        throw new VariableValidationError(
          `Custom variable validation failed: ${customResult.error.message}`,
          invalidVars,
          { errors: customResult.error.errors }
        );
      }
      return { ...stdResult.data, ...customResult.data };
    }

    return stdResult.data as Partial<PromptVariables> & CustomVariables;
  }

  /**
   * Resolve a layer's template with variables
   */
  private resolveLayer(
    layer: PromptLayer,
    variables: Partial<PromptVariables> & CustomVariables
  ): string {
    let content = layer.template;

    // Replace all variables
    content = content.replace(VARIABLE_PATTERN, (_match, varName: string) => {
      // Use index signature access for combined type
      const allVars = variables as Record<string, string | undefined>;
      const value = allVars[varName];
      if (value !== undefined && value !== null) {
        return value;
      }
      // Return placeholder for unresolved variables
      return '[Not provided]';
    });

    return `## ${layer.name}\n\n${content}`;
  }

  /**
   * Apply template overrides to base layers
   */
  private applyTemplateOverrides(
    layers: PromptLayer[],
    overrides: Partial<Record<string, string>>
  ): PromptLayer[] {
    return layers.map((layer) => {
      const override = overrides[String(layer.id)];
      if (override) {
        return {
          ...layer,
          template: override,
        };
      }
      return layer;
    });
  }

  /**
   * Build user prompt from task variables
   */
  private buildUserPrompt(variables: Partial<PromptVariables>): string {
    const parts: string[] = [];

    if (variables.task_description) {
      parts.push(`Task: ${variables.task_description}`);
    }

    if (variables.task_requirements) {
      parts.push(`\nRequirements:\n${variables.task_requirements}`);
    }

    return parts.join('\n') || 'Please proceed with the assigned task.';
  }

  /**
   * Get a minimal prompt (required layers only)
   */
  composeMinimal(
    agentType: AgentType,
    variables: Partial<PromptVariables>
  ): ComposedPrompt {
    const requiredLayerIds = getRequiredLayers().map((l) => l.id);

    return this.compose(agentType, variables, {
      prioritizeLayers: requiredLayerIds,
      excludeLayers: PROMPT_LAYERS.filter(
        (l) => !requiredLayerIds.includes(l.id)
      ).map((l) => l.id),
    });
  }

  /**
   * Validate that a prompt can be composed with given variables
   */
  validateVariables(variables: Partial<PromptVariables>): VariableValidation {
    const requiredLayers = getRequiredLayers();
    const missing: string[] = [];
    const warnings: string[] = [];

    // Collect all required variables
    for (const layer of requiredLayers) {
      for (const varName of layer.variables) {
        const value = variables[varName as keyof PromptVariables];
        if (value === undefined || value === null || value === '') {
          missing.push(varName);
        }
      }
    }

    // Check for security issues in provided values
    const stdResult = promptVariablesSchema.partial().safeParse(variables);
    if (!stdResult.success) {
      for (const error of stdResult.error.errors) {
        warnings.push(`${error.path.join('.')}: ${error.message}`);
      }
    }

    return {
      valid: missing.length === 0 && warnings.length === 0,
      missing: [...new Set(missing)],
      warnings,
    };
  }

  /**
   * Get all variables that would be used in a prompt
   */
  getUsedVariables(agentType: AgentType): string[] {
    const template = this.registry.getTemplate(agentType);
    const layers = template
      ? this.applyTemplateOverrides([...PROMPT_LAYERS], template.layers)
      : [...PROMPT_LAYERS];

    const variables = new Set<string>();
    for (const layer of layers) {
      const matches = layer.template.matchAll(VARIABLE_PATTERN);
      for (const match of matches) {
        const varName = match[1];
        if (varName) {
          variables.add(varName);
        }
      }
    }

    return Array.from(variables);
  }

  /**
   * Add audit log entry
   */
  private addAuditEntry(entry: PromptAuditEntry): void {
    this.auditLog.push(entry);

    // Trim old entries if exceeding max
    while (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog.shift();
    }
  }

  /**
   * Get audit log entries
   */
  getAuditLog(limit?: number): PromptAuditEntry[] {
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
   * Get the prompt registry
   */
  getRegistry(): PromptRegistry {
    return this.registry;
  }

  /**
   * Get the token allocator
   */
  getAllocator(): TokenAllocator {
    return this.allocator;
  }
}

/**
 * Create a default prompt composer
 */
export function createPromptComposer(
  allocation: TokenAllocation = DEFAULT_TOKEN_ALLOCATION
): PromptComposer {
  const registry = new PromptRegistry();
  return new PromptComposer(registry, allocation);
}
