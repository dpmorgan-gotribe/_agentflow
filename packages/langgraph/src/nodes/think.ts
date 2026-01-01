/**
 * Orchestrator Think Node
 *
 * This node uses AI to reason about what should happen next in the workflow.
 * It analyzes the current state, completed work, and decides the next action.
 */

import { getAIProvider } from '@aigentflow/ai-provider';
import type { OrchestratorStateType } from '../state.js';
import {
  ORCHESTRATOR_THINKING_PROMPT,
  buildThinkingContext,
  parseOrchestratorDecision,
} from '../prompts/orchestrator-thinking.js';
import {
  createThinkingStep,
  createInitialThinkingState,
  type OrchestratorDecision,
  type ThinkingStep,
  type OrchestratorThinking,
  type AgentDispatch,
} from '../schemas/orchestrator-thinking.js';

/**
 * Determine what triggered this thinking step
 */
function determineTrigger(state: OrchestratorStateType): ThinkingStep['trigger'] {
  // Check if we just received approval response
  if (state.approvalResponse) {
    return 'approval_received';
  }

  // Check if we just completed parallel execution
  if (state.parallelResults && state.parallelResults.length > 0) {
    return 'parallel_completed';
  }

  // Check if an agent just completed
  if (state.agentOutputs && state.agentOutputs.length > 0) {
    return 'agent_completed';
  }

  // Check if there's an error
  if (state.error) {
    return 'error_occurred';
  }

  // Initial prompt
  return 'initial';
}

/**
 * Get the ID of the agent that triggered this thinking step
 */
function getTriggerAgentId(state: OrchestratorStateType): string | undefined {
  const outputs = state.agentOutputs;
  if (outputs && outputs.length > 0) {
    const lastOutput = outputs[outputs.length - 1];
    return lastOutput?.agentId;
  }
  return undefined;
}

/**
 * Build state summary for thinking step
 */
function buildStateSummary(state: OrchestratorStateType): ThinkingStep['stateSummary'] {
  const artifactCount = state.agentOutputs?.reduce(
    (sum, output) => sum + (output.artifacts?.length ?? 0),
    0
  ) ?? 0;

  return {
    completedAgents: state.completedAgents ?? [],
    pendingAgents: state.agentQueue ?? [],
    hasErrors: !!state.error,
    artifactCount,
    currentPhase: state.orchestratorThinking?.currentPhase,
  };
}

/**
 * Determine the current workflow phase based on state
 */
function determineCurrentPhase(
  state: OrchestratorStateType,
  decision: OrchestratorDecision
): OrchestratorThinking['currentPhase'] {
  const completedAgents = state.completedAgents ?? [];

  // If we're waiting for approval
  if (decision.action === 'approval') {
    if (decision.approvalConfig?.type === 'style_selection') {
      return 'awaiting_style_selection';
    }
    if (decision.approvalConfig?.type === 'design_review') {
      return 'awaiting_design_approval';
    }
  }

  // If we're doing parallel dispatch for style competition
  if (decision.action === 'parallel_dispatch') {
    const hasUIDesigners = decision.targets?.some((t) => t.agentId.includes('ui_designer'));
    if (hasUIDesigners && !state.selectedStyleId) {
      return 'style_competition';
    }
  }

  // Check completed agents to determine phase
  if (!completedAgents.includes('analyst')) {
    return 'researching';
  }

  if (!completedAgents.includes('architect')) {
    return 'architecting';
  }

  if (!state.selectedStyleId) {
    // Need style selection
    if (state.stylePackages && state.stylePackages.length > 0) {
      return 'style_competition';
    }
    return 'researching';
  }

  // Style is selected, check if full design is done
  const fullDesignComplete = completedAgents.filter((a) =>
    a.includes('ui_designer') && !a.includes('mega')
  ).length > 0;

  if (!fullDesignComplete) {
    return 'full_design';
  }

  // Check if PM has run
  if (!completedAgents.includes('project_manager')) {
    return 'project_planning';
  }

  // Check for failures
  if (decision.action === 'fail') {
    return 'failed';
  }

  // Check for completion
  if (decision.action === 'complete') {
    return 'complete';
  }

  // Default to review
  return 'review';
}

/**
 * Orchestrator think node
 *
 * Analyzes current state and decides what should happen next.
 */
export async function orchestratorThinkNode(
  state: OrchestratorStateType
): Promise<Partial<OrchestratorStateType>> {
  const provider = getAIProvider();

  // Build context for the AI
  const context = buildThinkingContext({
    prompt: state.prompt,
    analysis: state.analysis,
    completedAgents: state.completedAgents ?? [],
    agentOutputs: (state.agentOutputs ?? []).map((o) => ({
      agentId: o.agentId,
      success: o.success,
      artifacts: o.artifacts,
      error: o.error,
    })),
    stylePackages: state.stylePackages,
    rejectedStyles: state.rejectedStyles,
    selectedStyleId: state.selectedStyleId,
    componentInventory: state.componentInventory,
    styleIteration: state.styleIteration,
    approvalResponse: state.approvalResponse,
    error: state.error,
  });

  try {
    // Call AI to reason about next steps
    const response = await provider.complete({
      system: ORCHESTRATOR_THINKING_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Current workflow state:\n\n${context}\n\nAnalyze this state and decide what should happen next. Respond with a JSON decision.`,
        },
      ],
      metadata: {
        agent: 'orchestrator',
        operation: 'think',
      },
    });

    // Parse the decision
    const decision = parseOrchestratorDecision(response.content);

    if (!decision) {
      console.error('Failed to parse orchestrator decision, using fallback');
      return createFallbackDecision(state);
    }

    // Determine the trigger for this thinking step
    const trigger = determineTrigger(state);
    const triggerAgentId = getTriggerAgentId(state);
    const stateSummary = buildStateSummary(state);

    // Create the thinking step
    const thinkingStepNumber = (state.thinkingHistory?.length ?? 0) + 1;
    const thinkingStep = createThinkingStep(
      thinkingStepNumber,
      trigger,
      stateSummary,
      decision.reasoning,
      decision,
      triggerAgentId
    );

    // Determine current phase
    const currentPhase = determineCurrentPhase(state, decision);

    // Build orchestrator thinking state
    const orchestratorThinking: OrchestratorThinking = {
      currentPhase,
      styleIterationCount: state.styleIteration ?? 0,
      rejectedStyleIds: (state.rejectedStyles ?? []).map((r) => r.styleId),
      userFeedback: state.approvalResponse?.feedback
        ? [...(state.orchestratorThinking?.userFeedback ?? []), state.approvalResponse.feedback]
        : (state.orchestratorThinking?.userFeedback ?? []),
      lastDecision: decision,
      isWaiting: decision.action === 'approval' || decision.action === 'wait',
      waitingFor: decision.action === 'approval'
        ? `User approval: ${decision.approvalConfig?.type}`
        : undefined,
    };

    // Build pending agents for parallel dispatch
    const pendingAgents: AgentDispatch[] = decision.action === 'parallel_dispatch' && decision.targets
      ? decision.targets.map((t) => ({
          agentId: t.agentId,
          executionId: t.executionId ?? crypto.randomUUID(),
          styleHint: t.styleHint,
          stylePackageId: t.stylePackageId,
          contextRefs: t.contextRefs,
          priority: t.priority ?? 'normal',
        }))
      : [];

    // Determine next agent for single dispatch
    const currentAgent = decision.action === 'dispatch' && decision.targets?.[0]
      ? decision.targets[0].agentId
      : null;

    // Build agent queue for single dispatch
    const agentQueue = decision.action === 'dispatch' && decision.targets
      ? decision.targets.map((t) => t.agentId)
      : [];

    // Determine workflow status
    let status: OrchestratorStateType['status'] = state.status;
    switch (decision.action) {
      case 'dispatch':
      case 'parallel_dispatch':
        status = 'orchestrating';
        break;
      case 'approval':
        status = 'awaiting_approval';
        break;
      case 'complete':
        status = 'completed';
        break;
      case 'fail':
        status = 'failed';
        break;
    }

    return {
      orchestratorThinking,
      orchestratorDecision: decision,
      thinkingHistory: [thinkingStep],
      pendingAgents,
      isParallelExecution: decision.action === 'parallel_dispatch',
      currentAgent,
      agentQueue,
      status,
      error: decision.action === 'fail' ? decision.error : null,
      // Build approval request if needed
      approvalRequest: decision.action === 'approval' && decision.approvalConfig
        ? {
            type: mapApprovalType(decision.approvalConfig.type),
            description: decision.approvalConfig.description,
            artifacts: [], // Will be populated by the workflow
            options: decision.approvalConfig.options?.map((o) => o.id),
          }
        : null,
      // Clear approval response after processing
      approvalResponse: null,
    };
  } catch (error) {
    console.error('Orchestrator think node error:', error);
    return createFallbackDecision(state);
  }
}

/**
 * Map approval config type to approval request type
 */
function mapApprovalType(
  type: 'style_selection' | 'design_review' | 'confirmation' | 'feedback'
): 'design' | 'architecture' | 'implementation' | 'final' {
  switch (type) {
    case 'style_selection':
    case 'design_review':
      return 'design';
    case 'confirmation':
      return 'final';
    case 'feedback':
      return 'implementation';
    default:
      return 'final';
  }
}

/**
 * Create a fallback decision when parsing fails
 */
function createFallbackDecision(
  state: OrchestratorStateType
): Partial<OrchestratorStateType> {
  const completedAgents = state.completedAgents ?? [];

  // Determine next agent based on what's completed
  let nextAgent: string | null = null;
  let agentQueue: string[] = [];

  if (!completedAgents.includes('analyst')) {
    nextAgent = 'analyst';
    agentQueue = ['analyst'];
  } else if (!completedAgents.includes('architect')) {
    nextAgent = 'architect';
    agentQueue = ['architect'];
  } else if (!state.selectedStyleId && state.stylePackages?.length) {
    // Need style selection
    return {
      status: 'awaiting_approval',
      approvalRequest: {
        type: 'design',
        description: 'Select a style from the options',
        artifacts: [],
        options: state.stylePackages.map((s) => (s as { id: string }).id),
      },
    };
  } else if (state.selectedStyleId && !completedAgents.includes('ui_designer_full')) {
    nextAgent = 'ui_designer';
    agentQueue = ['ui_designer'];
  } else if (!completedAgents.includes('project_manager')) {
    nextAgent = 'project_manager';
    agentQueue = ['project_manager'];
  } else {
    // Complete
    return {
      status: 'completed',
      orchestratorDecision: {
        reasoning: 'All required agents have completed',
        action: 'complete',
        summary: 'Workflow completed successfully',
      },
    };
  }

  return {
    status: 'orchestrating',
    currentAgent: nextAgent,
    agentQueue,
    orchestratorDecision: {
      reasoning: 'Fallback decision based on incomplete agents',
      action: 'dispatch',
      targets: nextAgent ? [{ agentId: nextAgent, priority: 'normal' }] : undefined,
    },
  };
}

/**
 * Node that determines routing based on orchestrator decision
 */
export function getOrchestratorRoute(
  state: OrchestratorStateType
): 'dispatch' | 'parallel_dispatch' | 'approval' | 'complete' | 'fail' {
  const decision = state.orchestratorDecision;

  if (!decision) {
    // No decision yet, need to analyze first
    return 'dispatch';
  }

  switch (decision.action) {
    case 'dispatch':
      return 'dispatch';
    case 'parallel_dispatch':
      return 'parallel_dispatch';
    case 'approval':
      return 'approval';
    case 'complete':
      return 'complete';
    case 'fail':
      return 'fail';
    case 'wait':
      return 'approval'; // Wait is handled like approval
    default:
      return 'dispatch';
  }
}
