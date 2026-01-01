/**
 * Main Orchestrator Workflow Graph
 *
 * The central LangGraph workflow that coordinates all agents.
 *
 * This implements the "thinking orchestrator" pattern where the orchestrator
 * uses AI to reason about what should happen next after each step, rather
 * than following a predetermined queue.
 *
 * Flow:
 *   START → analyze → think → (dispatch|parallel|approval|complete|fail)
 *   After agent: → think → (next decision)
 *   After approval: → think → (next decision)
 */

import { StateGraph, END, START, MemorySaver } from '@langchain/langgraph';

import type { PostgresCheckpointer } from '../checkpointer/postgres.js';
import { analyzeTaskNode } from '../nodes/analyze.js';
import { handleApprovalNode } from '../nodes/approve.js';
import { executeAgentNode } from '../nodes/execute.js';
import { routeToAgentNode } from '../nodes/route.js';
import { orchestratorThinkNode, getOrchestratorRoute } from '../nodes/think.js';
import { parallelDispatchNode } from '../nodes/parallel-dispatch.js';
import { OrchestratorState, type OrchestratorStateType } from '../state.js';

/**
 * Routing function: determines next node after analysis
 *
 * In the thinking orchestrator, analysis feeds into the think node.
 */
function routeAfterAnalysis(
  state: OrchestratorStateType
): 'think' | 'fail' {
  if (!state.analysis) {
    return 'fail';
  }
  return 'think';
}

/**
 * Routing function: determines next node based on orchestrator's decision
 *
 * The think node sets orchestratorDecision which determines the next action.
 */
function routeAfterThinking(
  state: OrchestratorStateType
): 'dispatch' | 'parallel_dispatch' | 'awaiting_approval' | 'complete' | 'fail' {
  const route = getOrchestratorRoute(state);
  // Map 'approval' from the decision to 'awaiting_approval' node name
  if (route === 'approval') {
    return 'awaiting_approval';
  }
  return route;
}

/**
 * Routing function: determines next node after single agent dispatch
 *
 * Dispatch routes to execute a single agent, then back to think.
 */
function routeAfterDispatch(
  state: OrchestratorStateType
): 'execute_agent' | 'think' {
  if (state.currentAgent) {
    return 'execute_agent';
  }
  return 'think';
}

/**
 * Routing function: determines next node after agent execution
 *
 * After agent execution, return to think for next decision.
 */
function routeAfterExecution(
  state: OrchestratorStateType
): 'think' | 'fail' {
  const lastOutput = state.agentOutputs?.[state.agentOutputs.length - 1];

  // Check for errors with retry exhaustion
  if (!lastOutput?.success) {
    if (state.retryCount >= state.maxRetries) {
      return 'fail';
    }
  }

  // Return to thinking for next decision
  return 'think';
}

/**
 * Routing function: determines next node after parallel execution
 *
 * After parallel agents complete, return to think for next decision.
 */
function routeAfterParallelExecution(
  _state: OrchestratorStateType
): 'think' {
  // Always return to think after parallel execution
  return 'think';
}

/**
 * Routing function: determines next node after approval
 *
 * After approval (accept or reject), return to think for next decision.
 */
function routeAfterApproval(
  _state: OrchestratorStateType
): 'think' {
  // Always return to think after approval
  // The think node will handle rejection loops, style reselection, etc.
  return 'think';
}

// ============================================================
// LEGACY ROUTING (kept for backward compatibility)
// ============================================================

/**
 * Legacy routing function: determines next node after routing decision
 * @deprecated Use thinking orchestrator pattern instead
 */
function routeAfterRouting(
  state: OrchestratorStateType
): 'execute_agent' | 'complete' | 'awaiting_approval' {
  // If no agents left and no approval needed, complete
  if (!state.currentAgent && state.agentQueue.length === 0) {
    return 'complete';
  }

  // Check if current agent output needs approval
  const lastOutput = state.agentOutputs?.[state.agentOutputs.length - 1];
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
 * Legacy routing function: determines next node after approval
 * @deprecated Use thinking orchestrator pattern instead
 */
function legacyRouteAfterApproval(
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
 * Create the main orchestrator graph with thinking pattern
 *
 * This creates the "thinking orchestrator" that uses AI to decide
 * what should happen next after each step.
 *
 * @param config - Graph configuration options
 * @returns Compiled workflow graph
 */
export function createOrchestratorGraph(config?: OrchestratorGraphConfig) {
  const workflow = new StateGraph(OrchestratorState)
    // Add nodes
    .addNode('analyze', analyzeTaskNode)
    .addNode('think', orchestratorThinkNode)
    .addNode('dispatch', routeToAgentNode) // Single agent dispatch
    .addNode('parallel_dispatch', parallelDispatchNode) // Parallel agent dispatch
    .addNode('execute_agent', executeAgentNode)
    .addNode('awaiting_approval', handleApprovalNode)
    .addNode('complete', completeNode)
    .addNode('fail', failNode)

    // Add edges - Thinking Orchestrator Pattern
    .addEdge(START, 'analyze')

    // After analysis, go to think
    .addConditionalEdges('analyze', routeAfterAnalysis, {
      think: 'think',
      fail: 'fail',
    })

    // After thinking, route based on decision
    .addConditionalEdges('think', routeAfterThinking, {
      dispatch: 'dispatch',
      parallel_dispatch: 'parallel_dispatch',
      awaiting_approval: 'awaiting_approval',
      complete: 'complete',
      fail: 'fail',
    })

    // After dispatch, execute the agent
    .addConditionalEdges('dispatch', routeAfterDispatch, {
      execute_agent: 'execute_agent',
      think: 'think', // If no agent selected, think again
    })

    // After agent execution, return to think
    .addConditionalEdges('execute_agent', routeAfterExecution, {
      think: 'think',
      fail: 'fail',
    })

    // After parallel execution, return to think
    .addConditionalEdges('parallel_dispatch', routeAfterParallelExecution, {
      think: 'think',
    })

    // After approval, return to think
    .addConditionalEdges('awaiting_approval', routeAfterApproval, {
      think: 'think',
    })

    // Terminal nodes
    .addEdge('complete', END)
    .addEdge('fail', END);

  // Node names type for interrupt configuration
  type NodeName =
    | 'analyze'
    | 'think'
    | 'dispatch'
    | 'parallel_dispatch'
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
 * Create the legacy orchestrator graph (queue-based)
 *
 * This is the original orchestrator that uses a predetermined agent queue.
 * Kept for backward compatibility.
 *
 * @deprecated Use createOrchestratorGraph instead
 * @param config - Graph configuration options
 * @returns Compiled workflow graph
 */
export function createLegacyOrchestratorGraph(config?: OrchestratorGraphConfig) {
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
    .addConditionalEdges('analyze', (state) => state.analysis ? 'route_to_agent' : 'fail', {
      route_to_agent: 'route_to_agent',
      fail: 'fail',
    })
    .addConditionalEdges('route_to_agent', routeAfterRouting, {
      execute_agent: 'execute_agent',
      complete: 'complete',
      awaiting_approval: 'awaiting_approval',
    })
    .addConditionalEdges('execute_agent', (state) => {
      const lastOutput = state.agentOutputs?.[state.agentOutputs.length - 1];
      if (!lastOutput?.success && state.retryCount >= state.maxRetries) return 'fail';
      if (lastOutput?.routingHints?.needsApproval) return 'awaiting_approval';
      return 'route_to_agent';
    }, {
      route_to_agent: 'route_to_agent',
      awaiting_approval: 'awaiting_approval',
      fail: 'fail',
    })
    .addConditionalEdges('awaiting_approval', legacyRouteAfterApproval, {
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

  // Get the actual checkpointer
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
 * Workflow execution callback for streaming events
 */
export interface WorkflowStreamCallback {
  onNodeStart?: (nodeName: string, state: Partial<OrchestratorStateType>) => void | Promise<void>;
  onNodeEnd?: (nodeName: string, state: Partial<OrchestratorStateType>) => void | Promise<void>;
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
 * Execute a workflow with streaming - emits events as each node completes
 *
 * @param graph - Compiled orchestrator graph
 * @param input - Initial state input
 * @param options - Execution options
 * @param callback - Optional callback for streaming events
 * @returns Final workflow state
 */
export async function executeWorkflowStreaming(
  graph: OrchestratorGraph,
  input: {
    tenantId: string;
    projectId: string;
    taskId: string;
    prompt: string;
  },
  options: WorkflowExecutionOptions,
  callback?: WorkflowStreamCallback
): Promise<OrchestratorStateType> {
  const config = {
    configurable: {
      thread_id: options.threadId,
      checkpoint_id: options.checkpointId,
    },
    streamMode: 'updates' as const,
  };

  let finalState: OrchestratorStateType | null = null;

  // Stream executes and yields updates after each node
  const stream = await graph.stream(input, config);

  for await (const chunk of stream) {
    // chunk is { nodeName: stateUpdate }
    for (const [nodeName, stateUpdate] of Object.entries(chunk)) {
      // Emit node completion event
      if (callback?.onNodeEnd) {
        await callback.onNodeEnd(nodeName, stateUpdate as Partial<OrchestratorStateType>);
      }

      // Track the latest state update
      finalState = stateUpdate as OrchestratorStateType;
    }
  }

  // Return the final state (or fetch from checkpointer if needed)
  if (!finalState) {
    // Fallback to invoke if streaming didn't produce results
    return await graph.invoke(input, {
      configurable: {
        thread_id: options.threadId,
        checkpoint_id: options.checkpointId,
      },
    });
  }

  return finalState;
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
