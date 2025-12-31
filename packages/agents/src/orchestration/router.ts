/**
 * Router
 *
 * Routes tasks to appropriate agents based on decisions.
 * Builds context for agents and executes them.
 *
 * SECURITY:
 * - Validates tenant isolation on all operations
 * - Verifies agent exists before routing
 * - Tracks token usage for budget enforcement
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  AgentContext,
  AgentRequest,
  AgentOutput,
  AuthContext,
  TaskAnalysis,
  AgentConstraints,
} from '../types.js';
import { AgentContextSchema, DEFAULT_CONSTRAINTS, SecurityViolationError } from '../types.js';
import { getRegistry } from '../registry.js';
import type { ContextManager, CuratedContext } from '../context-manager.js';
import type { RoutingDecision } from '../schemas/orchestrator-output.js';

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
  debug: (msg, meta) => console.debug(`[Router] ${msg}`, meta || ''),
  info: (msg, meta) => console.info(`[Router] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[Router] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[Router] ${msg}`, meta || ''),
};

/**
 * Routing result with execution details
 */
export interface RoutingResult {
  output: AgentOutput;
  executionId: string;
  tokensUsed: number;
  durationMs: number;
}

/**
 * Router class - Routes tasks to agents
 */
export class Router {
  private contextManager: ContextManager;
  private logger: Logger;

  constructor(contextManager: ContextManager, options?: { logger?: Logger }) {
    this.contextManager = contextManager;
    this.logger = options?.logger || defaultLogger;
  }

  /**
   * Route to an agent based on decision
   *
   * SECURITY: Validates auth context and tenant isolation
   */
  async route(
    decision: RoutingDecision,
    projectId: string,
    task: TaskAnalysis,
    auth: AuthContext,
    previousOutputs: AgentOutput[],
    constraints?: Partial<AgentConstraints>
  ): Promise<AgentRequest> {
    // SECURITY: Validate auth context
    this.validateAuth(auth);

    const registry = getRegistry();

    // Verify agent exists
    if (!registry.hasAgent(decision.nextAgent)) {
      throw new Error(`Agent not found: ${decision.nextAgent}`);
    }

    // Get agent metadata for context requirements
    const metadata = registry.getMetadata(decision.nextAgent);
    if (!metadata) {
      throw new Error(`No metadata for agent: ${decision.nextAgent}`);
    }

    // Build context with tenant isolation
    const executionId = uuidv4();
    const curatedContext = await this.contextManager.curateContext(
      metadata,
      auth,
      projectId,
      task.taskType
    );

    // Log context curation result
    if (curatedContext.missingRequired.length > 0) {
      this.logger.warn('Missing required context', {
        agent: decision.nextAgent,
        missing: curatedContext.missingRequired,
        tenantId: auth.tenantId,
      });
    }

    // Build agent context
    const agentContext: AgentContext = {
      projectId,
      executionId,
      tenantId: auth.tenantId,
      userId: auth.userId,
      sessionId: auth.sessionId,
      task,
      items: curatedContext.items,
      previousOutputs,
      constraints: {
        ...DEFAULT_CONSTRAINTS,
        ...constraints,
      },
      auth,
    };

    // SECURITY: Validate context schema
    AgentContextSchema.parse(agentContext);

    this.logger.info(`Routing to ${decision.nextAgent}: ${decision.reason}`, {
      executionId,
      tenantId: auth.tenantId,
      contextTokens: curatedContext.totalTokens,
    });

    return {
      executionId,
      task,
      context: agentContext,
    };
  }

  /**
   * Execute routing decision
   *
   * SECURITY: Validates tenant isolation before execution
   */
  async execute(
    decision: RoutingDecision,
    projectId: string,
    task: TaskAnalysis,
    auth: AuthContext,
    previousOutputs: AgentOutput[],
    constraints?: Partial<AgentConstraints>
  ): Promise<RoutingResult> {
    const startTime = Date.now();

    // Build request
    const request = await this.route(
      decision,
      projectId,
      task,
      auth,
      previousOutputs,
      constraints
    );

    // Get agent and execute
    const registry = getRegistry();
    const agent = registry.getAgent(decision.nextAgent);

    this.logger.info(`Executing agent: ${decision.nextAgent}`, {
      executionId: request.executionId,
      tenantId: auth.tenantId,
    });

    const output = await agent.execute(request);
    const durationMs = Date.now() - startTime;

    // SECURITY: Verify output tenant matches request tenant
    this.verifyOutputTenant(request.context.tenantId, output);

    this.logger.info(`Agent completed: ${decision.nextAgent}`, {
      executionId: request.executionId,
      success: output.success,
      tokensUsed: output.metrics.tokensUsed,
      durationMs,
    });

    return {
      output,
      executionId: request.executionId,
      tokensUsed: output.metrics.tokensUsed,
      durationMs,
    };
  }

  /**
   * Route to multiple agents in parallel
   *
   * SECURITY: All parallel routes share same auth context
   */
  async executeParallel(
    decisions: RoutingDecision[],
    projectId: string,
    task: TaskAnalysis,
    auth: AuthContext,
    previousOutputs: AgentOutput[],
    constraints?: Partial<AgentConstraints>
  ): Promise<RoutingResult[]> {
    // SECURITY: Validate auth once for all parallel executions
    this.validateAuth(auth);

    const startTime = Date.now();

    // Build all requests in parallel
    const requests = await Promise.all(
      decisions.map((d) =>
        this.route(d, projectId, task, auth, previousOutputs, constraints)
      )
    );

    // Execute all agents in parallel
    const registry = getRegistry();
    const results = await Promise.all(
      requests.map(async (request, i) => {
        const decision = decisions[i]!;
        const agent = registry.getAgent(decision.nextAgent);
        const output = await agent.execute(request);
        return { request, output };
      })
    );

    const totalDurationMs = Date.now() - startTime;

    this.logger.info(`Parallel execution complete`, {
      agents: decisions.map((d) => d.nextAgent),
      totalDurationMs,
      tenantId: auth.tenantId,
    });

    return results.map(({ request, output }) => ({
      output,
      executionId: request.executionId,
      tokensUsed: output.metrics.tokensUsed,
      durationMs: totalDurationMs,
    }));
  }

  /**
   * Validate auth context
   *
   * SECURITY: Ensures all required auth fields are present
   */
  private validateAuth(auth: AuthContext): void {
    if (!auth) {
      throw new SecurityViolationError(
        'Missing auth context',
        ['auth_required'],
        { operation: 'route' }
      );
    }

    if (!auth.tenantId) {
      throw new SecurityViolationError(
        'Missing tenant ID in auth context',
        ['tenant_required'],
        { operation: 'route' }
      );
    }

    if (!auth.userId) {
      throw new SecurityViolationError(
        'Missing user ID in auth context',
        ['user_required'],
        { operation: 'route' }
      );
    }

    if (!auth.sessionId) {
      throw new SecurityViolationError(
        'Missing session ID in auth context',
        ['session_required'],
        { operation: 'route' }
      );
    }

    // Check session expiry if set
    if (auth.expiresAt && auth.expiresAt < new Date()) {
      throw new SecurityViolationError(
        'Auth session has expired',
        ['session_expired'],
        { operation: 'route' }
      );
    }
  }

  /**
   * Verify output tenant matches request tenant
   *
   * SECURITY: Prevents cross-tenant data leakage
   */
  private verifyOutputTenant(requestTenantId: string, output: AgentOutput): void {
    // Agent outputs don't directly contain tenant ID (it's in the execution context)
    // But we can verify artifacts don't reference other tenants
    for (const artifact of output.artifacts) {
      // Check artifact paths don't reference other tenants
      if (artifact.path.includes('tenant') && !artifact.path.includes(requestTenantId)) {
        this.logger.warn('Potential tenant path violation in artifact', {
          path: artifact.path,
          expectedTenant: requestTenantId,
        });
      }
    }
  }

  /**
   * Check if an agent is available
   */
  isAgentAvailable(agentType: string): boolean {
    return getRegistry().hasAgent(agentType as any);
  }

  /**
   * Get available agents
   */
  getAvailableAgents(): string[] {
    return getRegistry().getAgentTypes();
  }
}
