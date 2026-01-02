/**
 * Execute Agent Node
 *
 * Executes the current agent and captures its output.
 */

import type { OrchestratorStateType, AgentOutput, AgentActivity, WorkflowSettings } from '../state.js';

/**
 * Agent execution context passed to each agent
 */
export interface AgentContext {
  tenantId: string;
  projectId: string;
  taskId: string;
  prompt: string;
  analysis: OrchestratorStateType['analysis'];
  previousOutputs: AgentOutput[];
  workflowSettings: WorkflowSettings;
}

/**
 * Agent execution result
 */
export interface AgentResult {
  success: boolean;
  result: unknown;
  artifacts: AgentOutput['artifacts'];
  routingHints: AgentOutput['routingHints'];
  error?: string;
  activity?: AgentActivity;
}

/**
 * Agent interface for registry
 */
export interface Agent {
  execute(context: AgentContext): Promise<AgentResult>;
}

/**
 * Agent registry interface
 */
export interface AgentRegistry {
  getAgent(type: string): Agent | undefined;
}

// Global agent registry (set during initialization)
let agentRegistry: AgentRegistry | null = null;

/**
 * Set the global agent registry
 *
 * Must be called before executing workflows.
 *
 * @param registry - Agent registry implementation
 */
export function setAgentRegistry(registry: AgentRegistry): void {
  agentRegistry = registry;
}

/**
 * Get the current agent registry
 *
 * @returns Current registry or null if not set
 */
export function getAgentRegistry(): AgentRegistry | null {
  return agentRegistry;
}

/**
 * Execute agent node implementation
 *
 * Retrieves the current agent from the registry and executes it
 * with the workflow context.
 */
export async function executeAgentNode(
  state: OrchestratorStateType
): Promise<Partial<OrchestratorStateType>> {
  const {
    currentAgent,
    tenantId,
    projectId,
    taskId,
    prompt,
    analysis,
    agentOutputs,
    workflowSettings,
  } = state;

  if (!currentAgent) {
    return {
      error: 'No agent selected for execution',
      status: 'failed',
    };
  }

  if (!agentRegistry) {
    return {
      error: 'Agent registry not initialized. Call setAgentRegistry() first.',
      status: 'failed',
    };
  }

  const agent = agentRegistry.getAgent(currentAgent);
  if (!agent) {
    return {
      error: `Agent not found: ${currentAgent}`,
      status: 'failed',
    };
  }

  try {
    const result = await agent.execute({
      tenantId,
      projectId,
      taskId,
      prompt,
      analysis,
      previousOutputs: agentOutputs,
      workflowSettings,
    });

    const output: AgentOutput = {
      agentId: currentAgent,
      success: result.success,
      result: result.result,
      artifacts: result.artifacts,
      routingHints: result.routingHints,
      error: result.error,
      timestamp: new Date().toISOString(),
      activity: result.activity,
    };

    return {
      agentOutputs: [output],
      completedAgents: result.success ? [currentAgent] : [],
      retryCount: result.success ? 0 : state.retryCount + 1,
      currentAgent: null,
    };
  } catch (error) {
    const output: AgentOutput = {
      agentId: currentAgent,
      success: false,
      result: null,
      artifacts: [],
      routingHints: { hasFailures: true },
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };

    return {
      agentOutputs: [output],
      retryCount: state.retryCount + 1,
      currentAgent: null,
    };
  }
}

/**
 * Execution error class
 */
export class ExecutionError extends Error {
  public readonly agentId: string;
  public readonly context: Record<string, unknown>;

  constructor(
    message: string,
    agentId: string,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ExecutionError';
    this.agentId = agentId;
    this.context = context;
  }
}
