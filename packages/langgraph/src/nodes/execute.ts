/**
 * Execute Agent Node
 *
 * Executes the current agent and captures its output.
 *
 * Special handling for Analyst agent:
 * When the Analyst completes successfully with style research data,
 * this node extracts stylePackages, componentInventory, screens, and userFlows
 * into the proper state channels for downstream use by the orchestrator
 * and parallel UI designer dispatch.
 */

import type {
  OrchestratorStateType,
  AgentOutput,
  AgentActivity,
  WorkflowSettings,
  DesignPhase,
} from '../state.js';
import type { StylePackage } from '../schemas/style-package.js';
import type { ComponentInventory } from '../schemas/component-inventory.js';

/**
 * Agent execution context passed to each agent
 */
export interface AgentContext {
  tenantId: string;
  projectId: string;
  /** Absolute path to project output directory for artifacts */
  projectPath: string;
  taskId: string;
  prompt: string;
  analysis: OrchestratorStateType['analysis'];
  previousOutputs: AgentOutput[];
  workflowSettings: WorkflowSettings;
  /** File paths for design research (file-based context) */
  designResearchPaths?: {
    stylePackagePaths?: string[];
    componentInventoryPath?: string;
    screensPath?: string;
    userFlowsPath?: string;
  };
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
    projectPath,
    taskId,
    prompt,
    analysis,
    agentOutputs,
    workflowSettings,
    // Design research file paths
    stylePackagePaths,
    componentInventoryPath,
    screensPath,
    userFlowsPath,
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
    // Build design research paths if available
    // Convert null to undefined for type compatibility
    const hasDesignPaths =
      (stylePackagePaths && stylePackagePaths.length > 0) ||
      componentInventoryPath ||
      screensPath ||
      userFlowsPath;

    const designResearchPaths = hasDesignPaths
      ? {
          stylePackagePaths: stylePackagePaths ?? undefined,
          componentInventoryPath: componentInventoryPath ?? undefined,
          screensPath: screensPath ?? undefined,
          userFlowsPath: userFlowsPath ?? undefined,
        }
      : undefined;

    const result = await agent.execute({
      tenantId,
      projectId,
      projectPath,
      taskId,
      prompt,
      analysis,
      previousOutputs: agentOutputs,
      workflowSettings,
      designResearchPaths,
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

    // Base state update
    const stateUpdate: Partial<OrchestratorStateType> = {
      agentOutputs: [output],
      completedAgents: result.success ? [currentAgent] : [],
      retryCount: result.success ? 0 : state.retryCount + 1,
      currentAgent: null,
    };

    // Extract analyst style research output to state channels
    // This is critical for the style competition workflow to function
    if (
      result.success &&
      (currentAgent === 'analyzer' || currentAgent === 'analyst')
    ) {
      const styleResearchUpdate = extractAnalystStyleResearch(result.result);
      if (styleResearchUpdate) {
        console.log(
          `[execute] Extracted analyst style research: ${styleResearchUpdate.stylePackages?.length ?? 0} style packages`
        );
        Object.assign(stateUpdate, styleResearchUpdate);
      }
    }

    return stateUpdate;
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
 * Extract style research data from Analyst result
 *
 * Handles both legacy inline data and new file-based paths.
 * Returns state channel updates for the style competition workflow.
 */
function extractAnalystStyleResearch(
  result: unknown
): Partial<OrchestratorStateType> | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const data = result as Record<string, unknown>;

  // Check if this is style research output
  // Use bracket notation for Record index access
  const hasStyleData =
    data['stylePackages'] ||
    data['stylePackagePaths'] ||
    data['componentInventory'] ||
    data['componentInventoryPath'];

  if (!hasStyleData) {
    return null;
  }

  const update: Partial<OrchestratorStateType> = {};

  // Extract file paths (new file-based approach)
  // Use bracket notation for index signature properties
  if (Array.isArray(data['stylePackagePaths'])) {
    update['stylePackagePaths'] = data['stylePackagePaths'] as string[];
  }

  if (typeof data['componentInventoryPath'] === 'string') {
    update['componentInventoryPath'] = data['componentInventoryPath'];
  }

  if (typeof data['screensPath'] === 'string') {
    update['screensPath'] = data['screensPath'];
  }

  if (typeof data['userFlowsPath'] === 'string') {
    update['userFlowsPath'] = data['userFlowsPath'];
  }

  // Also extract inline data for backwards compatibility
  if (Array.isArray(data['stylePackages'])) {
    update['stylePackages'] = data['stylePackages'] as StylePackage[];
  }

  if (data['componentInventory'] && typeof data['componentInventory'] === 'object') {
    update['componentInventory'] = data['componentInventory'] as ComponentInventory;
  }

  return update;
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
