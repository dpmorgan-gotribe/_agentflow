/**
 * Main Orchestrator Workflow Graph
 *
 * The central LangGraph workflow that coordinates all agents.
 */

import { StateGraph, END, START, MemorySaver } from '@langchain/langgraph';

import type { PostgresCheckpointer } from '../checkpointer/postgres.js';
import { analyzeTaskNode } from '../nodes/analyze.js';
import { handleApprovalNode } from '../nodes/approve.js';
import { executeAgentNode } from '../nodes/execute.js';
import { routeToAgentNode } from '../nodes/route.js';
import { OrchestratorState, type OrchestratorStateType } from '../state.js';

/**
 * Routing function: determines next node after analysis
 */
function routeAfterAnalysis(
  state: OrchestratorStateType
): 'route_to_agent' | 'fail' {
  if (!state.analysis) {
    return 'fail';
  }
  return 'route_to_agent';
}

/**
 * Routing function: determines next node after routing decision
 */
function routeAfterRouting(
  state: OrchestratorStateType
): 'execute_agent' | 'complete' | 'awaiting_approval' {
  // If no agents left and no approval needed, complete
  if (!state.currentAgent && state.agentQueue.length === 0) {
    return 'complete';
  }

  // Check if current agent output needs approval
  const lastOutput = state.agentOutputs[state.agentOutputs.length - 1];
  if (lastOutput?.routingHints?.needsApproval) {
    return 'awaiting_approval';
  }

  // Execute next agent
  if (state.currentAgent) {
    return 'execute_agent';
  }

  return 'complete';
}

/**
 * Routing function: determines next node after agent execution
 */
function routeAfterExecution(
  state: OrchestratorStateType
): 'route_to_agent' | 'awaiting_approval' | 'fail' {
  const lastOutput = state.agentOutputs[state.agentOutputs.length - 1];

  // Check for errors
  if (!lastOutput?.success) {
    if (state.retryCount >= state.maxRetries) {
      return 'fail';
    }
    // Will retry in route_to_agent
  }

  // Check if needs approval
  if (lastOutput?.routingHints?.needsApproval) {
    return 'awaiting_approval';
  }

  // Continue routing
  return 'route_to_agent';
}

/**
 * Routing function: determines next node after approval
 */
function routeAfterApproval(
  state: OrchestratorStateType
): 'route_to_agent' | 'fail' {
  if (!state.approvalResponse?.approved) {
    // Rejection - may need to redo work
    return 'route_to_agent';
  }
  return 'route_to_agent';
}

/**
 * Complete node - marks workflow as completed
 */
function completeNode(
  _state: OrchestratorStateType
): Partial<OrchestratorStateType> {
  return {
    status: 'completed' as const,
    currentAgent: null,
  };
}

/**
 * Fail node - marks workflow as failed
 */
function failNode(
  _state: OrchestratorStateType
): Partial<OrchestratorStateType> {
  return {
    status: 'failed' as const,
    currentAgent: null,
  };
}

/**
 * Orchestrator graph configuration options
 */
export interface OrchestratorGraphConfig {
  /**
   * PostgreSQL checkpointer for state persistence
   * Can be either a PostgresCheckpointer (uses getSaver()) or a MemorySaver
   */
  checkpointer?: PostgresCheckpointer | MemorySaver;

  /**
   * Nodes to interrupt before (for human-in-the-loop)
   */
  interruptBefore?: string[];
}

/**
 * Create the main orchestrator graph
 *
 * @param config - Graph configuration options
 * @returns Compiled workflow graph
 */
export function createOrchestratorGraph(config?: OrchestratorGraphConfig) {
  const workflow = new StateGraph(OrchestratorState)
    // Add nodes
    .addNode('analyze', analyzeTaskNode)
    .addNode('route_to_agent', routeToAgentNode)
    .addNode('execute_agent', executeAgentNode)
    .addNode('awaiting_approval', handleApprovalNode)
    .addNode('complete', completeNode)
    .addNode('fail', failNode)

    // Add edges
    .addEdge(START, 'analyze')
    .addConditionalEdges('analyze', routeAfterAnalysis, {
      route_to_agent: 'route_to_agent',
      fail: 'fail',
    })
    .addConditionalEdges('route_to_agent', routeAfterRouting, {
      execute_agent: 'execute_agent',
      complete: 'complete',
      awaiting_approval: 'awaiting_approval',
    })
    .addConditionalEdges('execute_agent', routeAfterExecution, {
      route_to_agent: 'route_to_agent',
      awaiting_approval: 'awaiting_approval',
      fail: 'fail',
    })
    .addConditionalEdges('awaiting_approval', routeAfterApproval, {
      route_to_agent: 'route_to_agent',
      fail: 'fail',
    })
    .addEdge('complete', END)
    .addEdge('fail', END);

  // Node names type for interrupt configuration
  type NodeName =
    | 'analyze'
    | 'route_to_agent'
    | 'execute_agent'
    | 'awaiting_approval'
    | 'complete'
    | 'fail';

  // Get the actual checkpointer - PostgresCheckpointer wraps MemorySaver
  let checkpointer: MemorySaver | undefined;
  if (config?.checkpointer) {
    checkpointer =
      config.checkpointer instanceof MemorySaver
        ? config.checkpointer
        : config.checkpointer.getSaver();
  }

  // Compile with checkpointer for persistence
  const compiled = workflow.compile({
    checkpointer,
    interruptBefore: (config?.interruptBefore ?? [
      'awaiting_approval',
    ]) as NodeName[],
  });

  return compiled;
}

/**
 * Type for the compiled orchestrator graph
 */
export type OrchestratorGraph = ReturnType<typeof createOrchestratorGraph>;

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  /**
   * Thread ID for checkpoint persistence
   */
  threadId: string;

  /**
   * Optional checkpoint ID to resume from
   */
  checkpointId?: string;

  /**
   * Maximum execution time in milliseconds
   */
  timeout?: number;
}

/**
 * Execute a workflow with configuration
 *
 * @param graph - Compiled orchestrator graph
 * @param input - Initial state input
 * @param options - Execution options
 * @returns Final workflow state
 */
export async function executeWorkflow(
  graph: OrchestratorGraph,
  input: {
    tenantId: string;
    projectId: string;
    taskId: string;
    prompt: string;
  },
  options: WorkflowExecutionOptions
): Promise<OrchestratorStateType> {
  const config = {
    configurable: {
      thread_id: options.threadId,
      checkpoint_id: options.checkpointId,
    },
  };

  const result = await graph.invoke(input, config);
  return result;
}

/**
 * Resume a paused workflow with approval response
 *
 * @param graph - Compiled orchestrator graph
 * @param threadId - Thread ID of paused workflow
 * @param approvalResponse - User's approval response
 * @returns Resumed workflow state
 */
export async function resumeWorkflow(
  graph: OrchestratorGraph,
  threadId: string,
  approvalResponse: NonNullable<OrchestratorStateType['approvalResponse']>
): Promise<OrchestratorStateType> {
  const config = {
    configurable: {
      thread_id: threadId,
    },
  };

  // Resume with the approval response as update
  // We use 'as unknown' to work around LangGraph's strict type checking
  // for nullable state properties
  const result = await graph.invoke(
    { approvalResponse } as unknown as Parameters<
      OrchestratorGraph['invoke']
    >[0],
    config
  );

  return result;
}
