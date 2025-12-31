/**
 * Route to Agent Node
 *
 * Determines which agent to execute next based on queue and previous outputs.
 */

import type { OrchestratorStateType } from '../state.js';

/**
 * Route to agent node implementation
 *
 * Handles agent selection based on:
 * - Agent queue order
 * - Routing hints from previous agents
 * - Skip/suggest recommendations
 */
export function routeToAgentNode(
  state: OrchestratorStateType
): Partial<OrchestratorStateType> {
  const { agentQueue, agentOutputs, completedAgents } = state;

  // Check if last agent's routing hints suggest a different path
  const lastOutput = agentOutputs[agentOutputs.length - 1];
  if (lastOutput?.routingHints?.suggestNext?.length) {
    const suggested = lastOutput.routingHints.suggestNext[0];
    if (suggested && !completedAgents.includes(suggested)) {
      return {
        currentAgent: suggested,
        status: 'agent_working',
      };
    }
  }

  // Check if there are agents to skip
  if (lastOutput?.routingHints?.skipAgents?.length) {
    const filteredQueue = agentQueue.filter(
      (agent) => !lastOutput.routingHints.skipAgents?.includes(agent)
    );

    if (filteredQueue.length > 0 && filteredQueue[0]) {
      const nextAgent = filteredQueue[0];
      return {
        currentAgent: nextAgent,
        agentQueue: filteredQueue.slice(1),
        status: 'agent_working',
      };
    }
  }

  // Take next agent from queue
  if (agentQueue.length > 0 && agentQueue[0]) {
    const nextAgent = agentQueue[0];
    return {
      currentAgent: nextAgent,
      agentQueue: agentQueue.slice(1),
      status: 'agent_working',
    };
  }

  // No more agents
  return {
    currentAgent: null,
    status: 'completing',
  };
}
