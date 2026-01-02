/**
 * Decision Engine
 *
 * Combines deterministic rules (85%) with AI reasoning (15%) for routing decisions.
 * Deterministic rules are preferred for predictability and debuggability.
 *
 * SECURITY:
 * - All LLM outputs validated with Zod schemas
 * - Uses AIProvider abstraction (not direct SDK)
 * - Token usage tracked for budget enforcement
 */

import { z } from 'zod';
import type { AIProvider } from '@aigentflow/ai-provider';
import { getAIProvider } from '@aigentflow/ai-provider';
import type { AgentType, AgentOutput, AuthContext } from '../types.js';
import { AgentTypeEnum } from '../types.js';
import type {
  TaskClassification,
  RoutingDecision,
  FailureAnalysis,
  DecisionContext,
} from '../schemas/orchestrator-output.js';
import { RoutingDecisionSchema, FailureAnalysisSchema } from '../schemas/orchestrator-output.js';

/**
 * Logger interface
 */
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const defaultLogger: Logger = {
  debug: (msg, meta) => console.debug(`[DecisionEngine] ${msg}`, meta || ''),
  info: (msg, meta) => console.info(`[DecisionEngine] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[DecisionEngine] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[DecisionEngine] ${msg}`, meta || ''),
};

/**
 * Routing rule definition
 */
interface RoutingRule {
  id: string;
  condition: (context: DecisionContext) => boolean;
  action: AgentType | 'pause' | 'complete' | 'escalate' | 'abort';
  priority: number;
  description: string;
}

/**
 * Token tracking for decisions
 */
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Decision result with token usage
 */
export interface DecisionResult {
  decision: RoutingDecision;
  usedAIReasoning: boolean;
  tokenUsage: TokenUsage;
  matchedRuleId?: string;
}

/**
 * Decision Engine - Deterministic rules with AI reasoning fallback
 */
export class DecisionEngine {
  private aiProvider: AIProvider;
  private rules: RoutingRule[] = [];
  private logger: Logger;
  private aiReasoningThreshold: number;

  constructor(options?: { logger?: Logger; aiReasoningThreshold?: number }) {
    this.aiProvider = getAIProvider();
    this.logger = options?.logger || defaultLogger;
    this.aiReasoningThreshold = options?.aiReasoningThreshold ?? 0.7;
    this.initializeRules();
  }

  /**
   * Initialize deterministic routing rules
   *
   * Rules are sorted by priority (lower = higher priority).
   * First matching rule wins.
   */
  private initializeRules(): void {
    this.rules = [
      // Priority 0-10: Security and critical issues
      {
        id: 'security-concern',
        condition: (ctx) => ctx.securityConcern,
        action: AgentTypeEnum.COMPLIANCE,
        priority: 0,
        description: 'Route to compliance agent on security concerns',
      },
      {
        id: 'max-failures-abort',
        condition: (ctx) => ctx.failureCount >= 5,
        action: 'abort',
        priority: 5,
        description: 'Abort after 5 consecutive failures',
      },
      {
        id: 'max-failures-escalate',
        condition: (ctx) => ctx.failureCount >= 3,
        action: 'escalate',
        priority: 10,
        description: 'Escalate to user after 3 consecutive failures',
      },

      // Priority 11-20: Failure handling
      {
        id: 'test-failure',
        condition: (ctx) => ctx.hasFailures && ctx.failureCount < 3,
        action: AgentTypeEnum.BUG_FIXER,
        priority: 15,
        description: 'Route to bug fixer on test failures',
      },

      // Priority 21-30: Approval gates
      {
        id: 'needs-approval',
        condition: (ctx) => ctx.needsApproval,
        action: 'pause',
        priority: 25,
        description: 'Pause for user approval',
      },

      // Priority 31-40: Design phase routing
      {
        id: 'needs-architecture',
        condition: (ctx) =>
          ctx.taskClassification.requiresArchitecture &&
          !ctx.completedAgents.includes(AgentTypeEnum.ARCHITECT),
        action: AgentTypeEnum.ARCHITECT,
        priority: 35,
        description: 'Route to architect for architecture decisions',
      },
      {
        id: 'needs-design',
        condition: (ctx) =>
          ctx.taskClassification.requiresDesign &&
          !ctx.completedAgents.includes(AgentTypeEnum.UI_DESIGNER),
        action: AgentTypeEnum.UI_DESIGNER,
        priority: 36,
        description: 'Route to UI designer for design work',
      },
      {
        id: 'needs-compliance-review',
        condition: (ctx) =>
          ctx.taskClassification.requiresCompliance &&
          !ctx.completedAgents.includes(AgentTypeEnum.COMPLIANCE),
        action: AgentTypeEnum.COMPLIANCE,
        priority: 37,
        description: 'Route to compliance for security review',
      },

      // Priority 41-50: Build phase routing
      {
        id: 'ready-for-frontend',
        condition: (ctx) =>
          ctx.currentPhase === 'building' &&
          ctx.completedAgents.includes(AgentTypeEnum.UI_DESIGNER) &&
          !ctx.completedAgents.includes(AgentTypeEnum.FRONTEND_DEV),
        action: AgentTypeEnum.FRONTEND_DEV,
        priority: 45,
        description: 'Route to frontend developer after design',
      },
      {
        id: 'ready-for-backend',
        condition: (ctx) =>
          ctx.currentPhase === 'building' &&
          !ctx.completedAgents.includes(AgentTypeEnum.BACKEND_DEV),
        action: AgentTypeEnum.BACKEND_DEV,
        priority: 46,
        description: 'Route to backend developer',
      },

      // Priority 51-60: Test phase routing
      {
        id: 'ready-for-testing',
        condition: (ctx) =>
          ctx.currentPhase === 'testing' &&
          (ctx.completedAgents.includes(AgentTypeEnum.FRONTEND_DEV) ||
            ctx.completedAgents.includes(AgentTypeEnum.BACKEND_DEV)) &&
          !ctx.completedAgents.includes(AgentTypeEnum.TESTER),
        action: AgentTypeEnum.TESTER,
        priority: 55,
        description: 'Route to tester after implementation',
      },

      // Priority 61-70: Review phase routing
      {
        id: 'ready-for-review',
        condition: (ctx) =>
          ctx.currentPhase === 'reviewing' &&
          ctx.completedAgents.includes(AgentTypeEnum.TESTER) &&
          !ctx.completedAgents.includes(AgentTypeEnum.REVIEWER),
        action: AgentTypeEnum.REVIEWER,
        priority: 65,
        description: 'Route to reviewer after testing',
      },

      // Priority 90+: Completion
      {
        id: 'all-complete',
        condition: (ctx) =>
          ctx.completedAgents.includes(AgentTypeEnum.REVIEWER) && !ctx.hasFailures,
        action: 'complete',
        priority: 90,
        description: 'Mark complete after successful review',
      },
    ];

    // Sort by priority (lower = higher priority)
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Make a routing decision
   *
   * SECURITY: Validates auth context before processing
   */
  async decide(
    context: DecisionContext,
    auth: AuthContext
  ): Promise<DecisionResult> {
    // SECURITY: Verify auth context is present
    if (!auth.tenantId || !auth.userId) {
      throw new Error('Missing required auth context for routing decision');
    }

    // First, try deterministic rules
    const ruleResult = this.applyRules(context);

    if (ruleResult) {
      this.logger.debug(`Deterministic rule matched: ${ruleResult.matchedRuleId}`, {
        tenantId: auth.tenantId,
      });
      return ruleResult;
    }

    // Fall back to AI reasoning for complex decisions
    this.logger.info('No deterministic rule matched, using AI reasoning', {
      tenantId: auth.tenantId,
      phase: context.currentPhase,
    });

    return this.aiReason(context, auth);
  }

  /**
   * Apply deterministic rules
   */
  private applyRules(context: DecisionContext): DecisionResult | null {
    for (const rule of this.rules) {
      try {
        if (rule.condition(context)) {
          const decision = this.createDecisionFromRule(rule, context);
          return {
            decision,
            usedAIReasoning: false,
            tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            matchedRuleId: rule.id,
          };
        }
      } catch (error) {
        this.logger.warn(`Rule evaluation failed: ${rule.id}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return null;
  }

  /**
   * Create routing decision from matched rule
   */
  private createDecisionFromRule(
    rule: RoutingRule,
    context: DecisionContext
  ): RoutingDecision {
    // Handle special actions
    if (
      rule.action === 'pause' ||
      rule.action === 'complete' ||
      rule.action === 'escalate' ||
      rule.action === 'abort'
    ) {
      return {
        nextAgent: AgentTypeEnum.ORCHESTRATOR, // Self-reference for special actions
        reason: `${rule.action.toUpperCase()}: ${rule.description}`,
        priority: rule.priority,
        contextRequirements: [],
        alternativeAgents: [],
      };
    }

    return {
      nextAgent: rule.action,
      reason: rule.description,
      priority: rule.priority,
      contextRequirements: this.getContextRequirements(rule.action),
      alternativeAgents: [],
    };
  }

  /**
   * Use AI for complex routing decisions
   *
   * SECURITY:
   * - Uses AIProvider abstraction
   * - Validates output with Zod schema
   * - Tracks token usage
   */
  private async aiReason(
    context: DecisionContext,
    auth: AuthContext
  ): Promise<DecisionResult> {
    const systemPrompt = this.buildAIReasoningPrompt();
    const userPrompt = this.buildAIUserPrompt(context);

    try {
      const response = await this.aiProvider.complete({
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        metadata: {
          agent: 'orchestrator',
          operation: 'ai_reasoning',
          correlationId: auth.sessionId,
        },
      });

      // SECURITY: Validate output with Zod schema
      const parsed = this.parseAndValidateResponse(response.content);

      return {
        decision: parsed,
        usedAIReasoning: true,
        tokenUsage: {
          inputTokens: response.usage?.inputTokens || 0,
          outputTokens: response.usage?.outputTokens || 0,
          totalTokens:
            (response.usage?.inputTokens || 0) + (response.usage?.outputTokens || 0),
        },
      };
    } catch (error) {
      this.logger.error('AI reasoning failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Default fallback decision
      return {
        decision: {
          nextAgent: AgentTypeEnum.PLANNER,
          reason: 'Default fallback after AI reasoning failure',
          priority: 50,
          contextRequirements: [],
          alternativeAgents: [],
        },
        usedAIReasoning: true,
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
    }
  }

  /**
   * Build system prompt for AI reasoning
   */
  private buildAIReasoningPrompt(): string {
    return `You are the decision engine for a multi-agent orchestration system.
Your task is to decide which agent should handle the next step of a task.

Available agents:
- planner: Breaks down tasks into steps
- architect: Makes technical decisions
- analyzer: Researches best practices
- ui_designer: Creates UI mockups
- frontend_dev: Implements frontend code
- backend_dev: Implements backend code
- tester: Runs tests
- bug_fixer: Fixes failing tests
- reviewer: Reviews code quality
- compliance: Handles security/compliance
- git_agent: Manages git operations

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "nextAgent": "agent_type",
  "reason": "brief explanation",
  "priority": 50,
  "contextRequirements": ["what context the agent needs"]
}`;
  }

  /**
   * Build user prompt with context
   */
  private buildAIUserPrompt(context: DecisionContext): string {
    // SECURITY: Sanitize context before including in prompt
    const sanitizedContext = {
      taskType: context.taskClassification.type,
      complexity: context.taskClassification.complexity,
      phase: context.currentPhase,
      completedAgents: context.completedAgents,
      hasFailures: context.hasFailures,
      failureCount: context.failureCount,
    };

    return `Decide the next agent for this task:
${JSON.stringify(sanitizedContext, null, 2)}

What should be the next step?`;
  }

  /**
   * Parse and validate AI response
   *
   * SECURITY: Validates against Zod schema
   */
  private parseAndValidateResponse(content: string): RoutingDecision {
    // Try to extract JSON from potential markdown code blocks
    let jsonStr = content.trim();
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return RoutingDecisionSchema.parse(parsed);
    } catch (error) {
      this.logger.warn('Failed to parse AI response, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return safe fallback
      return {
        nextAgent: AgentTypeEnum.PLANNER,
        reason: 'Fallback due to parse error',
        priority: 50,
        contextRequirements: [],
        alternativeAgents: [],
      };
    }
  }

  /**
   * Get context requirements for an agent type
   */
  private getContextRequirements(agent: AgentType): string[] {
    const requirements: Partial<Record<AgentType, string[]>> = {
      [AgentTypeEnum.ORCHESTRATOR]: [],
      [AgentTypeEnum.PLANNER]: ['user_requirements'],
      [AgentTypeEnum.ARCHITECT]: ['user_requirements', 'existing_architecture'],
      [AgentTypeEnum.ANALYZER]: ['research_question'],
      [AgentTypeEnum.UI_DESIGNER]: ['feature_requirements', 'design_tokens'],
      [AgentTypeEnum.GIT_AGENT]: ['branch_info'],
      [AgentTypeEnum.FRONTEND_DEV]: ['mockups', 'design_tokens', 'tech_stack'],
      [AgentTypeEnum.BACKEND_DEV]: ['api_spec', 'tech_stack'],
      [AgentTypeEnum.TESTER]: ['source_code', 'test_requirements'],
      [AgentTypeEnum.BUG_FIXER]: ['failing_tests', 'source_code'],
      [AgentTypeEnum.REVIEWER]: ['source_code', 'test_results'],
      [AgentTypeEnum.COMPLIANCE]: ['code_changes', 'compliance_requirements'],
      [AgentTypeEnum.PATTERN_MINER]: ['execution_traces'],
      [AgentTypeEnum.AGENT_GENERATOR]: ['patterns'],
      [AgentTypeEnum.TOURNAMENT_MANAGER]: ['agent_pool'],
    };

    return requirements[agent] || [];
  }

  /**
   * Analyze a failure and determine recovery strategy
   */
  async analyzeFailure(
    failure: AgentOutput,
    context: DecisionContext,
    auth: AuthContext
  ): Promise<FailureAnalysis> {
    // Simple heuristics first
    if (!failure.errors || failure.errors.length === 0) {
      return { strategy: 'retry', reason: 'No specific error, retrying' };
    }

    const error = failure.errors[0]!;

    // Check for non-recoverable errors
    if (error.code === 'SECURITY_VIOLATION') {
      return {
        strategy: 'abort',
        reason: 'Security violation detected - cannot continue',
        requiresUserInput: true,
      };
    }

    // Check if test failure
    if (error.code === 'TEST_FAILURE') {
      return {
        strategy: 'fix',
        reason: 'Test failure, routing to bug fixer',
        suggestedAgent: AgentTypeEnum.BUG_FIXER,
      };
    }

    // Check if recoverable error
    if (error.recoverable && context.failureCount < 3) {
      return { strategy: 'retry', reason: 'Recoverable error, retrying' };
    }

    // Escalate on repeated failures
    if (context.failureCount >= 3) {
      return {
        strategy: 'escalate',
        reason: 'Too many failures, escalating to user',
        requiresUserInput: true,
      };
    }

    // Default to retry
    return { strategy: 'retry', reason: 'Attempting retry' };
  }

  /**
   * Add a custom routing rule
   */
  addRule(rule: RoutingRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove a routing rule by ID
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all rules (for debugging/testing)
   */
  getRules(): readonly RoutingRule[] {
    return this.rules;
  }
}
