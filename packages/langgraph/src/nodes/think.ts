/**
 * Orchestrator Think Node
 *
 * This node uses AI to reason about what should happen next in the workflow.
 * It analyzes the current state, completed work, and decides the next action.
 */

import { getAIProvider } from '@aigentflow/ai-provider';
import type { OrchestratorStateType } from '../state.js';
import {
  buildOrchestratorThinkingPrompt,
  buildThinkingContext,
  parseOrchestratorDecision as parseDecision,
} from '../prompts/orchestrator-thinking.js';
import {
  createThinkingStep,
  createInitialThinkingState,
  type OrchestratorDecision,
  type ThinkingStep,
  type OrchestratorThinking,
  type AgentDispatch,
} from '../schemas/orchestrator-thinking.js';

// Re-export for use by other modules
export { parseDecision as parseOrchestratorDecision };

/**
 * Phase gate violation error - used for logging and debugging
 */
interface PhaseGateViolation {
  violation: string;
  currentPhase: string;
  requiredCondition: string;
  correction: string;
}

/**
 * Validate and enforce design phase gates
 *
 * Returns a corrected decision if the original violates phase gates,
 * or null if the decision is valid.
 */
function enforcePhaseGates(
  state: OrchestratorStateType,
  decision: OrchestratorDecision
): { correctedDecision: OrchestratorDecision; violation: PhaseGateViolation } | null {
  const { designPhase, stylesheetApproved, screensApproved, stylePackages } = state;

  // Check for UI Designer dispatch that violates phase gates
  if (decision.action === 'dispatch' || decision.action === 'parallel_dispatch') {
    const targets = decision.targets ?? [];
    const hasUIDesigner = targets.some((t) => t.agentId === 'ui_designer');

    if (hasUIDesigner) {
      // Gate 1: Cannot generate screens without stylesheet approval
      if (!stylesheetApproved && (designPhase === 'research' || designPhase === 'stylesheet')) {
        // Check if style packages exist - if not, need to run Analyst first
        if (!stylePackages || stylePackages.length === 0) {
          return {
            correctedDecision: {
              reasoning: 'Phase gate enforcement: Need style research before UI Designer can run.',
              action: 'dispatch',
              targets: [{ agentId: 'analyst', priority: 'high' }],
            },
            violation: {
              violation: 'UI Designer dispatched without style packages',
              currentPhase: designPhase ?? 'research',
              requiredCondition: 'stylePackages.length > 0',
              correction: 'Routing to Analyst for style research',
            },
          };
        }

        // Style packages exist but not approved - need approval first
        if (!stylesheetApproved) {
          return {
            correctedDecision: {
              reasoning: 'Phase gate enforcement: Stylesheet approval required before screen generation.',
              action: 'approval',
              approvalConfig: {
                type: 'style_selection',
                description: 'Select a style from the available options',
                options: stylePackages.map((s) => ({
                  id: (s as { id: string }).id,
                  name: (s as { name: string }).name,
                  description: (s as { moodDescription?: string }).moodDescription ?? '',
                  previewPath: '',
                })),
                allowRejectAll: true,
                iterationCount: state.styleIteration ?? 1,
                maxIterations: 5,
              },
            },
            violation: {
              violation: 'UI Designer dispatched for screens without stylesheet approval',
              currentPhase: designPhase ?? 'stylesheet',
              requiredCondition: 'stylesheetApproved === true',
              correction: 'Requesting stylesheet approval first',
            },
          };
        }
      }

      // Gate 2: Cannot proceed to PM without screen approval
      // (This is informational - PM dispatch would be caught, not UI Designer)
    }

    // Check for Project Manager dispatch that violates phase gates
    const hasPM = targets.some((t) =>
      t.agentId === 'project_manager' || t.agentId === 'pm'
    );

    if (hasPM && !screensApproved && designPhase !== 'complete') {
      return {
        correctedDecision: {
          reasoning: 'Phase gate enforcement: Screen approval required before Project Manager.',
          action: 'approval',
          approvalConfig: {
            type: 'design_review',
            description: 'Review and approve the generated screens',
            options: [],
            allowRejectAll: true,
            iterationCount: 1,
            maxIterations: 3,
          },
        },
        violation: {
          violation: 'Project Manager dispatched without screen approval',
          currentPhase: designPhase ?? 'screens',
          requiredCondition: 'screensApproved === true',
          correction: 'Requesting screen approval first',
        },
      };
    }
  }

  return null;
}

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

  // Build context for the AI - includes design phase status
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
    userMessages: state.userMessages,
    lastProcessedMessageIndex: state.lastProcessedMessageIndex,
    // Design phase parameters (for phase gate enforcement)
    designPhase: state.designPhase,
    stylesheetApproved: state.stylesheetApproved,
    screensApproved: state.screensApproved,
    screenMockups: state.screenMockups,
  });

  try {
    // Build prompt with workflow settings
    const systemPrompt = buildOrchestratorThinkingPrompt(state.workflowSettings);

    // Call AI to reason about next steps
    const response = await provider.complete({
      system: systemPrompt,
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
    let decision = parseDecision(response.content);

    if (!decision) {
      console.error('Failed to parse orchestrator decision, using fallback');
      return createFallbackDecision(state);
    }

    // CRITICAL: Enforce phase gates to prevent workflow violations
    // Even if the AI makes a wrong decision, we correct it here
    const gateViolation = enforcePhaseGates(state, decision);
    if (gateViolation) {
      console.warn(`[PHASE GATE] Violation detected: ${gateViolation.violation.violation}`);
      console.warn(`[PHASE GATE] Current phase: ${gateViolation.violation.currentPhase}`);
      console.warn(`[PHASE GATE] Required: ${gateViolation.violation.requiredCondition}`);
      console.warn(`[PHASE GATE] Correction: ${gateViolation.violation.correction}`);
      decision = gateViolation.correctedDecision;
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
 *
 * Respects design phase gates:
 * 1. research → stylesheet: Need Analyst + style packages
 * 2. stylesheet → screens: Need stylesheetApproved === true
 * 3. screens → complete: Need screensApproved === true
 */
function createFallbackDecision(
  state: OrchestratorStateType
): Partial<OrchestratorStateType> {
  const completedAgents = state.completedAgents ?? [];
  const { designPhase, stylesheetApproved, screensApproved, stylePackages } = state;

  // Determine next agent based on what's completed AND phase gates
  let nextAgent: string | null = null;
  let agentQueue: string[] = [];

  // Phase 1: Research
  if (!completedAgents.includes('analyst')) {
    nextAgent = 'analyst';
    agentQueue = ['analyst'];
  }
  // Phase 2: Architecture
  else if (!completedAgents.includes('architect')) {
    nextAgent = 'architect';
    agentQueue = ['architect'];
  }
  // PHASE GATE: Style selection required before proceeding
  else if (!stylesheetApproved) {
    // Need style selection
    if (stylePackages && stylePackages.length > 0) {
      return {
        status: 'awaiting_approval',
        designPhase: 'stylesheet',
        approvalRequest: {
          type: 'design',
          description: 'Select a style from the options',
          artifacts: [],
          options: stylePackages.map((s) => (s as { id: string }).id),
        },
        orchestratorDecision: {
          reasoning: 'Fallback: Stylesheet approval required before screen generation',
          action: 'approval',
          approvalConfig: {
            type: 'style_selection',
            description: 'Select a style from the options',
            options: stylePackages.map((s) => ({
              id: (s as { id: string }).id,
              name: (s as { name: string }).name,
              description: (s as { moodDescription?: string }).moodDescription ?? '',
              previewPath: '',
            })),
            allowRejectAll: true,
            iterationCount: state.styleIteration ?? 1,
            maxIterations: 5,
          },
        },
      };
    } else {
      // No style packages yet - need analyst
      nextAgent = 'analyst';
      agentQueue = ['analyst'];
    }
  }
  // Phase 5: Full Design (screens) - stylesheet approved, can proceed
  else if (stylesheetApproved && !completedAgents.includes('ui_designer_full')) {
    nextAgent = 'ui_designer';
    agentQueue = ['ui_designer'];
  }
  // PHASE GATE: Screen approval required before PM
  else if (!screensApproved && designPhase !== 'complete') {
    return {
      status: 'awaiting_approval',
      designPhase: 'screens',
      approvalRequest: {
        type: 'design',
        description: 'Review and approve the generated screens',
        artifacts: [],
      },
      orchestratorDecision: {
        reasoning: 'Fallback: Screen approval required before Project Manager',
        action: 'approval',
        approvalConfig: {
          type: 'design_review',
          description: 'Review and approve the generated screens',
          options: [],
          allowRejectAll: true,
          iterationCount: 1,
          maxIterations: 3,
        },
      },
    };
  }
  // Phase 7: Project Planning
  else if (!completedAgents.includes('project_manager')) {
    nextAgent = 'project_manager';
    agentQueue = ['project_manager'];
  }
  // Complete
  else {
    return {
      status: 'completed',
      designPhase: 'complete',
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
