/**
 * Approval Node
 *
 * Handles human-in-the-loop approval requests.
 * Uses LangGraph's interrupt mechanism.
 */

import { interrupt } from '@langchain/langgraph';

import type {
  OrchestratorStateType,
  ApprovalRequest,
  ApprovalResponse,
} from '../state.js';

/**
 * Determine approval type based on agent ID
 */
function determineApprovalType(agentId: string): ApprovalRequest['type'] {
  switch (agentId) {
    case 'ui_designer':
      return 'design';
    case 'architect':
      return 'architecture';
    case 'frontend_developer':
    case 'backend_developer':
      return 'implementation';
    default:
      return 'final';
  }
}

/**
 * Handle approval node implementation
 *
 * Creates an approval request based on the last agent output
 * and uses LangGraph's interrupt mechanism to pause for human input.
 */
export function handleApprovalNode(
  state: OrchestratorStateType
): Partial<OrchestratorStateType> {
  const lastOutput = state.agentOutputs[state.agentOutputs.length - 1];

  if (!lastOutput) {
    return { status: 'orchestrating' };
  }

  // Create approval request
  const approvalRequest: ApprovalRequest = {
    type: determineApprovalType(lastOutput.agentId),
    description: `Review output from ${lastOutput.agentId}`,
    artifacts: lastOutput.artifacts,
  };

  // Interrupt and wait for human approval
  // This will pause the workflow until resume is called
  // The interrupt function pauses execution - when resumed, it returns the approval response
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- interrupt returns 'any', assertion needed for type safety
  const response = interrupt({
    type: 'approval',
    request: approvalRequest,
  }) as ApprovalResponse;

  return {
    approvalRequest,
    approvalResponse: response,
    status: 'orchestrating',
  };
}

/**
 * Create an approval response helper
 *
 * Utility function for resuming workflows with approval.
 */
export function createApprovalResponse(
  approved: boolean,
  options?: {
    selectedOption?: string;
    feedback?: string;
  }
): ApprovalResponse {
  return {
    approved,
    selectedOption: options?.selectedOption,
    feedback: options?.feedback,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Approval error class
 */
export class ApprovalError extends Error {
  public readonly requestType: ApprovalRequest['type'];
  public readonly context: Record<string, unknown>;

  constructor(
    message: string,
    requestType: ApprovalRequest['type'],
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ApprovalError';
    this.requestType = requestType;
    this.context = context;
  }
}
