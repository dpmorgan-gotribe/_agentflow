/**
 * Approval Node
 *
 * Handles human-in-the-loop approval requests.
 * Uses LangGraph's interrupt mechanism.
 *
 * Enhanced for style competition:
 * - Supports multiple style options for selection
 * - Includes preview paths for mega pages
 * - Handles 'reject_all' to trigger re-research
 */

import { interrupt } from '@langchain/langgraph';

import type {
  OrchestratorStateType,
  ApprovalRequest,
  ApprovalResponse,
  Artifact,
} from '../state.js';

/**
 * Approval option for style competition
 */
export interface ApprovalOption {
  /** Style package ID */
  id: string;
  /** Display name (e.g., "Modern Minimalist") */
  name: string;
  /** Short description */
  description: string;
  /** Path to mega page preview HTML */
  previewPath: string;
  /** Optional thumbnail for quick preview */
  thumbnailPath?: string;
  /** Associated artifacts */
  artifacts: Artifact[];
}

/**
 * Extended approval request for style selection
 */
export interface StyleSelectionRequest extends ApprovalRequest {
  /** Style options for user to choose from */
  styleOptions: ApprovalOption[];
  /** Current iteration (1-5) */
  iteration: number;
  /** Max iterations before requiring specific guidance */
  maxIterations: number;
  /** Previously rejected style IDs */
  rejectedStyleIds: string[];
}

/**
 * Extended approval response for style selection
 */
export interface StyleSelectionResponse extends ApprovalResponse {
  /** Whether user rejected all options */
  rejectAll?: boolean;
  /** Selected style ID (when approving) */
  selectedStyleId?: string;
}

/**
 * Determine approval type based on agent ID or orchestrator decision
 */
function determineApprovalType(
  agentId: string,
  approvalConfigType?: string
): ApprovalRequest['type'] {
  // If orchestrator specified a type, use it
  if (approvalConfigType === 'style_selection' || approvalConfigType === 'design_review') {
    return 'design';
  }

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
 * Build style options from mega page previews and style packages
 */
function buildStyleOptions(state: OrchestratorStateType): ApprovalOption[] {
  const { stylePackages, megaPagePreviews, parallelResults } = state;

  if (!stylePackages || stylePackages.length === 0) {
    return [];
  }

  return stylePackages.map((pkg) => {
    // Find corresponding mega page preview
    const preview = megaPagePreviews?.find((p) => p.styleId === pkg.id);

    // Find artifacts from parallel results (output has artifacts property)
    const parallelResult = parallelResults?.find((r) => r.stylePackageId === pkg.id);
    const resultOutput = parallelResult?.output as { artifacts?: Artifact[] } | undefined;
    const artifacts = resultOutput?.artifacts ?? [];

    return {
      id: pkg.id,
      name: pkg.name,
      description: pkg.moodDescription,
      previewPath: preview?.previewPath ?? '',
      thumbnailPath: preview?.thumbnailPath,
      artifacts,
    };
  });
}

/**
 * Handle approval node implementation
 *
 * Creates an approval request based on the orchestrator decision
 * and uses LangGraph's interrupt mechanism to pause for human input.
 *
 * For style competition:
 * - Builds options from style packages and mega page previews
 * - Tracks iteration count for rejection loop
 * - Supports reject_all to trigger re-research
 */
export function handleApprovalNode(
  state: OrchestratorStateType
): Partial<OrchestratorStateType> {
  const { orchestratorDecision, stylePackages, styleIteration } = state;
  const lastOutput = state.agentOutputs?.[state.agentOutputs.length - 1];

  // Check if this is a style selection approval
  const isStyleSelection = orchestratorDecision?.approvalConfig?.type === 'style_selection';

  let approvalRequest: ApprovalRequest | StyleSelectionRequest;

  if (isStyleSelection && stylePackages && stylePackages.length > 0) {
    // Build style selection request with all options
    const styleOptions = buildStyleOptions(state);
    const rejectedStyleIds = (state.rejectedStyles ?? []).map((r) => r.styleId);

    approvalRequest = {
      type: 'design',
      description: orchestratorDecision?.approvalConfig?.description ??
        'Select a design style for your project',
      artifacts: styleOptions.flatMap((opt) => opt.artifacts),
      options: styleOptions.map((opt) => opt.id),
      styleOptions,
      iteration: styleIteration ?? 1,
      maxIterations: 5,
      rejectedStyleIds,
    } satisfies StyleSelectionRequest;
  } else if (lastOutput) {
    // Standard approval request
    approvalRequest = {
      type: determineApprovalType(
        lastOutput.agentId,
        orchestratorDecision?.approvalConfig?.type
      ),
      description: orchestratorDecision?.approvalConfig?.description ??
        `Review output from ${lastOutput.agentId}`,
      artifacts: lastOutput.artifacts,
      options: orchestratorDecision?.approvalConfig?.options?.map((o) => o.id),
    };
  } else {
    // No output to approve, continue orchestrating
    return { status: 'orchestrating' };
  }

  // Interrupt and wait for human approval
  // This will pause the workflow until resume is called
  // The interrupt function pauses execution - when resumed, it returns the approval response
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- interrupt returns 'any', assertion needed for type safety
  const response = interrupt({
    type: 'approval',
    request: approvalRequest,
  }) as StyleSelectionResponse;

  // Process the response
  const updates: Partial<OrchestratorStateType> = {
    approvalRequest,
    approvalResponse: response,
    status: 'orchestrating',
  };

  // Handle style selection response
  if (isStyleSelection && response) {
    if (response.rejectAll) {
      // User rejected all options - increment iteration and record rejections
      const allRejections = stylePackages?.map((pkg) => ({
        styleId: pkg.id,
        styleName: pkg.name,
        iteration: styleIteration ?? 1,
        rejectedAt: new Date().toISOString(),
        rawFeedback: response.feedback ?? 'Rejected all options',
        avoidCharacteristics: pkg.characteristics ?? [],
      })) ?? [];

      updates.rejectedStyles = allRejections;
      updates.styleIteration = (styleIteration ?? 1) + 1;
      updates.selectedStyleId = null;
      // Design phase stays at 'stylesheet' - need to generate new options
    } else if (response.selectedStyleId && response.approved) {
      // User approved a specific style
      const selectedPkg = stylePackages?.find((p) => p.id === response.selectedStyleId);
      updates.selectedStyleId = response.selectedStyleId;

      if (selectedPkg) {
        updates.styleSelection = {
          selectedStyleId: response.selectedStyleId,
          selectedStyle: selectedPkg,
          iteration: styleIteration ?? 1,
          selectedAt: new Date().toISOString(),
          modifications: response.feedback ? [response.feedback] : undefined,
        };
      }

      // CRITICAL: Set phase gate flags when style is approved
      // This gates the transition from stylesheet → screens phase
      updates.stylesheetApproved = true;
      updates.designPhase = 'screens';
    }
  }

  // Handle screen approval (design_review type)
  const isScreenReview = orchestratorDecision?.approvalConfig?.type === 'design_review';
  if (isScreenReview && response?.approved) {
    // User approved all screens
    updates.screensApproved = true;
    updates.designPhase = 'complete';
  }

  return updates;
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
