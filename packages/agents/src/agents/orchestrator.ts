/**
 * Orchestrator Agent
 *
 * Central coordinator for the multi-agent system.
 * Analyzes user prompts, routes tasks to agents, synthesizes outputs.
 *
 * SECURITY:
 * - Validates all user inputs before processing
 * - Enforces tenant isolation throughout orchestration
 * - Tracks token budget to prevent runaway costs
 * - Uses AIProvider abstraction (not direct SDK)
 */

import type { AIProviderResponse } from '@aigentflow/ai-provider';
import { BaseAgent } from '../base-agent.js';
import type {
  AgentMetadata,
  AgentContext,
  AgentRequest,
  AgentOutput,
  RoutingHints,
  Artifact,
  AuthContext,
} from '../types.js';
import { AgentTypeEnum, SecurityViolationError } from '../types.js';
import type {
  OrchestratorOutput,
  TaskClassification,
  OrchestratorState,
  SynthesisResult,
  OrchestrationConfig,
  OrchestratorPhase,
} from '../schemas/orchestrator-output.js';
import {
  TaskClassificationSchema,
  OrchestratorOutputSchema,
  UserInputSchema,
  DEFAULT_ORCHESTRATION_CONFIG,
} from '../schemas/orchestrator-output.js';
import { DecisionEngine, type DecisionResult } from '../orchestration/decision-engine.js';
import { Router, type RoutingResult } from '../orchestration/router.js';
import { Synthesizer } from '../orchestration/synthesizer.js';
import type { ContextManager } from '../context-manager.js';

/**
 * Orchestration session tracking
 */
interface OrchestrationSession {
  projectId: string;
  auth: AuthContext;
  state: OrchestratorState;
  outputs: AgentOutput[];
  totalTokensUsed: number;
  startTime: Date;
  config: OrchestrationConfig;
}

/**
 * Orchestrator Agent - Central coordinator
 */
export class OrchestratorAgent extends BaseAgent {
  private decisionEngine: DecisionEngine;
  private router: Router;
  private synthesizer: Synthesizer;
  private currentSession: OrchestrationSession | null = null;

  constructor(contextManager: ContextManager) {
    const metadata: AgentMetadata = {
      id: AgentTypeEnum.ORCHESTRATOR,
      name: 'Orchestrator',
      description: 'Central coordinator for multi-agent orchestration',
      version: '1.0.0',
      capabilities: [
        {
          name: 'task-analysis',
          description: 'Analyze user requests to determine intent and requirements',
          inputTypes: ['text'],
          outputTypes: ['json'],
        },
        {
          name: 'routing',
          description: 'Route tasks to appropriate agents',
          inputTypes: ['task'],
          outputTypes: ['routing-decision'],
        },
        {
          name: 'synthesis',
          description: 'Synthesize outputs from multiple agents',
          inputTypes: ['agent-outputs'],
          outputTypes: ['synthesis'],
        },
      ],
      requiredContext: [{ type: 'current_task', required: true }],
      outputSchema: 'orchestrator-output',
    };

    super(metadata);

    this.decisionEngine = new DecisionEngine();
    this.router = new Router(contextManager);
    this.synthesizer = new Synthesizer();
  }

  /**
   * Initialize orchestrator state
   */
  private initializeState(): OrchestratorState {
    return {
      phase: 'analyzing',
      completedAgents: [],
      pendingAgents: [],
      approvalsPending: [],
      failureCount: 0,
      lastDecision: '',
      totalTokensUsed: 0,
      iterationCount: 0,
    };
  }

  /**
   * Build system prompt
   */
  protected buildSystemPrompt(context: AgentContext): string {
    const state = this.currentSession?.state || this.initializeState();

    return `You are the Orchestrator, the central coordinator of the Aigentflow multi-agent system.

Your responsibilities:
1. Analyze user requests to understand intent and requirements
2. Classify tasks by type and complexity
3. Determine which agents are needed
4. Make routing decisions
5. Handle failures intelligently
6. Synthesize results from multiple agents

Current state:
- Phase: ${state.phase}
- Completed agents: ${state.completedAgents.join(', ') || 'none'}
- Pending agents: ${state.pendingAgents.join(', ') || 'none'}
- Failure count: ${state.failureCount}
- Tokens used: ${state.totalTokensUsed || 0}

Output must be valid JSON matching the OrchestratorOutput schema.`;
  }

  /**
   * Build user prompt
   */
  protected buildUserPrompt(request: AgentRequest): string {
    const task = request.task;
    const previousOutputs = request.context.previousOutputs;

    let prompt = `Analyze this task and determine next steps:\n\n`;
    prompt += `Task: ${JSON.stringify(task, null, 2)}\n\n`;

    if (previousOutputs.length > 0) {
      prompt += `Previous agent outputs:\n`;
      for (const output of previousOutputs as AgentOutput[]) {
        const status = output.success ? 'succeeded' : 'failed';
        prompt += `- ${output.agentId}: ${status}`;
        if (!output.success && output.errors?.[0]) {
          prompt += ` (${output.errors[0].message})`;
        }
        prompt += '\n';
      }
    }

    prompt += `\nProvide your analysis and routing decision as JSON.`;

    return prompt;
  }

  /**
   * Parse LLM response
   */
  protected parseResponse(response: AIProviderResponse): OrchestratorOutput {
    const text = this.extractTextContent(response);
    const parsed = this.parseJSON<OrchestratorOutput>(text);

    // Validate with Zod schema
    return OrchestratorOutputSchema.parse(parsed);
  }

  /**
   * Process result
   */
  protected async processResult(
    parsed: OrchestratorOutput,
    request: AgentRequest
  ): Promise<{ result: OrchestratorOutput; artifacts: Artifact[] }> {
    // Update session state if active
    if (this.currentSession) {
      this.currentSession.state.phase = parsed.state.phase;
      this.currentSession.state.lastDecision = parsed.routingDecision?.reason || '';

      if (parsed.routingDecision) {
        this.currentSession.state.pendingAgents.push(parsed.routingDecision.nextAgent);
      }
    }

    return {
      result: parsed,
      artifacts: [],
    };
  }

  /**
   * Generate routing hints
   */
  protected generateRoutingHints(
    result: OrchestratorOutput,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    return result.routingHints;
  }

  /**
   * Classify a task from user input
   *
   * SECURITY: Validates user input before processing
   */
  async classifyTask(userInput: string, auth: AuthContext): Promise<TaskClassification> {
    // SECURITY: Validate user input
    UserInputSchema.parse(userInput);

    const response = await this.aiProvider.complete({
      system: `Classify this task. Output ONLY valid JSON with:
{
  "type": "feature"|"bugfix"|"refactor"|"research"|"deployment"|"config",
  "complexity": "trivial"|"simple"|"moderate"|"complex"|"epic",
  "requiresDesign": boolean,
  "requiresArchitecture": boolean,
  "requiresCompliance": boolean,
  "estimatedAgents": number (1-20),
  "confidence": number (0-1)
}`,
      messages: [{ role: 'user', content: userInput }],
      metadata: {
        agent: 'orchestrator',
        operation: 'classify_task',
        correlationId: auth.sessionId,
      },
    });

    const text = this.extractTextContent(response);
    const parsed = this.parseJSON<TaskClassification>(text);

    // SECURITY: Validate classification output
    return TaskClassificationSchema.parse(parsed);
  }

  /**
   * Run the main orchestration loop
   *
   * SECURITY:
   * - Validates auth context
   * - Enforces token budget
   * - Limits iterations
   */
  async orchestrate(
    projectId: string,
    userInput: string,
    auth: AuthContext,
    config?: Partial<OrchestrationConfig>
  ): Promise<SynthesisResult> {
    // SECURITY: Validate auth context
    if (!auth.tenantId || !auth.userId || !auth.sessionId) {
      throw new SecurityViolationError(
        'Missing required auth context for orchestration',
        ['auth_required'],
        { operation: 'orchestrate' }
      );
    }

    // SECURITY: Validate user input
    UserInputSchema.parse(userInput);

    // Initialize configuration
    const fullConfig: OrchestrationConfig = {
      ...DEFAULT_ORCHESTRATION_CONFIG,
      ...config,
    };

    this.log('info', 'Starting orchestration', {
      projectId,
      tenantId: auth.tenantId,
      maxIterations: fullConfig.maxIterations,
      maxTokenBudget: fullConfig.maxTokenBudget,
    });

    // Classify the task
    const classification = await this.classifyTask(userInput, auth);
    this.log('info', `Task classified: ${classification.type} (${classification.complexity})`, {
      tenantId: auth.tenantId,
    });

    // Initialize session
    this.currentSession = {
      projectId,
      auth,
      state: this.initializeState(),
      outputs: [],
      totalTokensUsed: 0,
      startTime: new Date(),
      config: fullConfig,
    };

    // Main orchestration loop
    let iterations = 0;
    const startTime = Date.now();

    while (iterations < fullConfig.maxIterations) {
      iterations++;
      this.currentSession.state.iterationCount = iterations;

      // SECURITY: Check timeout
      if (Date.now() - startTime > fullConfig.timeoutMs) {
        this.log('warn', 'Orchestration timeout reached', {
          tenantId: auth.tenantId,
          iterations,
        });
        break;
      }

      // SECURITY: Check token budget
      if (this.currentSession.totalTokensUsed >= fullConfig.maxTokenBudget) {
        this.log('warn', 'Token budget exhausted', {
          tenantId: auth.tenantId,
          tokensUsed: this.currentSession.totalTokensUsed,
          budget: fullConfig.maxTokenBudget,
        });
        break;
      }

      // Build decision context
      const decisionContext = {
        taskClassification: classification,
        currentPhase: this.currentSession.state.phase,
        hasFailures: this.currentSession.outputs.some((o) => !o.success),
        failureCount: this.currentSession.state.failureCount,
        needsApproval: this.currentSession.state.approvalsPending.length > 0,
        securityConcern: this.detectSecurityConcern(this.currentSession.outputs),
        completedAgents: this.currentSession.state.completedAgents,
        totalTokensUsed: this.currentSession.totalTokensUsed,
      };

      // Make routing decision
      const decisionResult = await this.decisionEngine.decide(decisionContext, auth);
      this.currentSession.totalTokensUsed += decisionResult.tokenUsage.totalTokens;
      this.currentSession.state.lastDecision = decisionResult.decision.reason;

      // Log decision
      this.log('debug', `Routing decision: ${decisionResult.decision.nextAgent}`, {
        reason: decisionResult.decision.reason,
        usedAI: decisionResult.usedAIReasoning,
        tenantId: auth.tenantId,
      });

      // Handle special actions
      if (decisionResult.decision.nextAgent === AgentTypeEnum.ORCHESTRATOR) {
        const action = this.parseSpecialAction(decisionResult.decision.reason);

        if (action === 'complete') {
          this.log('info', 'Orchestration complete', { tenantId: auth.tenantId });
          break;
        }
        if (action === 'pause') {
          this.log('info', 'Orchestration paused for approval', { tenantId: auth.tenantId });
          this.currentSession.state.phase = 'paused';
          break;
        }
        if (action === 'escalate' || action === 'abort') {
          this.log('warn', `Orchestration ${action}`, { tenantId: auth.tenantId });
          this.currentSession.state.phase = 'failed';
          break;
        }
      }

      // Execute the agent
      try {
        const routingResult = await this.router.execute(
          decisionResult.decision,
          projectId,
          { ...classification, userInput } as any,
          auth,
          this.currentSession.outputs
        );

        this.currentSession.outputs.push(routingResult.output);
        this.currentSession.totalTokensUsed += routingResult.tokensUsed;

        if (routingResult.output.success) {
          this.currentSession.state.completedAgents.push(decisionResult.decision.nextAgent);
          this.currentSession.state.failureCount = 0;
        } else {
          this.currentSession.state.failureCount++;
        }

        // Update phase based on progress
        this.updatePhase();
      } catch (error) {
        this.log('error', `Agent execution failed: ${error}`, {
          agent: decisionResult.decision.nextAgent,
          tenantId: auth.tenantId,
        });
        this.currentSession.state.failureCount++;

        // Analyze failure
        if (this.currentSession.state.failureCount >= 3) {
          this.log('warn', 'Max failures reached, escalating', { tenantId: auth.tenantId });
          break;
        }
      }
    }

    // Synthesize results
    const synthesis = this.synthesizer.synthesize(this.currentSession.outputs);

    this.log('info', 'Orchestration finished', {
      tenantId: auth.tenantId,
      iterations,
      tokensUsed: this.currentSession.totalTokensUsed,
      durationMs: Date.now() - startTime,
      completion: synthesis.completionStatus,
    });

    // Clean up session
    this.currentSession = null;

    return synthesis;
  }

  /**
   * Parse special action from decision reason
   */
  private parseSpecialAction(
    reason: string
  ): 'complete' | 'pause' | 'escalate' | 'abort' | null {
    const upperReason = reason.toUpperCase();
    if (upperReason.includes('COMPLETE')) return 'complete';
    if (upperReason.includes('PAUSE')) return 'pause';
    if (upperReason.includes('ESCALATE')) return 'escalate';
    if (upperReason.includes('ABORT')) return 'abort';
    return null;
  }

  /**
   * Detect security concerns in outputs
   */
  private detectSecurityConcern(outputs: AgentOutput[]): boolean {
    for (const output of outputs) {
      // Check for security-related errors
      if (output.errors?.some((e) => e.code === 'SECURITY_VIOLATION')) {
        return true;
      }

      // Check for security mentions in blocked reasons
      if (output.routingHints.blockedBy?.toLowerCase().includes('security')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Update orchestration phase based on completed agents
   */
  private updatePhase(): void {
    if (!this.currentSession) return;

    const completed = this.currentSession.state.completedAgents;

    let newPhase: OrchestratorPhase = this.currentSession.state.phase;

    if (completed.includes(AgentTypeEnum.REVIEWER)) {
      newPhase = 'complete';
    } else if (completed.includes(AgentTypeEnum.TESTER)) {
      newPhase = 'reviewing';
    } else if (
      completed.includes(AgentTypeEnum.FRONTEND_DEV) ||
      completed.includes(AgentTypeEnum.BACKEND_DEV)
    ) {
      newPhase = 'testing';
    } else if (completed.includes(AgentTypeEnum.UI_DESIGNER)) {
      newPhase = 'building';
    } else if (completed.includes(AgentTypeEnum.ARCHITECT)) {
      newPhase = 'designing';
    } else if (completed.includes(AgentTypeEnum.PLANNER)) {
      newPhase = 'planning';
    }

    if (newPhase !== this.currentSession.state.phase) {
      this.log('info', `Phase transition: ${this.currentSession.state.phase} -> ${newPhase}`, {
        tenantId: this.currentSession.auth.tenantId,
      });
      this.currentSession.state.phase = newPhase;
    }
  }

  /**
   * Get current orchestration state (for monitoring)
   */
  getCurrentState(): OrchestratorState | null {
    return this.currentSession?.state || null;
  }

  /**
   * Get current token usage (for monitoring)
   */
  getCurrentTokenUsage(): number {
    return this.currentSession?.totalTokensUsed || 0;
  }

  /**
   * Cancel current orchestration
   */
  cancel(): void {
    if (this.currentSession) {
      this.log('warn', 'Orchestration cancelled', {
        tenantId: this.currentSession.auth.tenantId,
        iterations: this.currentSession.state.iterationCount,
      });
      this.currentSession.state.phase = 'failed';
      this.currentSession = null;
    }
  }
}
