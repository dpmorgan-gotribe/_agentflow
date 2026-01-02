/**
 * Parallel Dispatch Node
 *
 * Executes multiple agents in parallel. Used for:
 * - Style competition (5 UI designers with different style packages)
 * - Screen generation (up to MAX_PARALLEL_AGENTS UI designers)
 * - Parallel reviews
 * - Any concurrent agent execution
 */

import type { OrchestratorStateType, AgentOutput, WorkflowSettings } from '../state.js';
import { DEFAULT_WORKFLOW_SETTINGS } from '../state.js';
import type { ParallelResult, AgentDispatch } from '../schemas/orchestrator-thinking.js';
import { getAgentRegistry } from './execute.js';

/**
 * Get the maximum number of parallel agents from settings
 *
 * @param settings - Workflow settings (optional)
 * @returns Maximum parallel agent count
 */
export function getMaxParallelAgents(settings?: WorkflowSettings): number {
  return settings?.parallelDesignerCount ?? DEFAULT_WORKFLOW_SETTINGS.parallelDesignerCount;
}

/**
 * Get the style competition designers count from settings
 *
 * @param settings - Workflow settings (optional)
 * @returns Style package count for competition
 */
export function getStyleCompetitionDesigners(settings?: WorkflowSettings): number {
  return settings?.stylePackageCount ?? DEFAULT_WORKFLOW_SETTINGS.stylePackageCount;
}

/**
 * Maximum number of agents that can run in parallel (legacy constant)
 * @deprecated Use getMaxParallelAgents(settings) instead
 */
export const MAX_PARALLEL_AGENTS = DEFAULT_WORKFLOW_SETTINGS.parallelDesignerCount;

/**
 * Style competition designers count (legacy constant)
 * @deprecated Use getStyleCompetitionDesigners(settings) instead
 */
export const STYLE_COMPETITION_DESIGNERS = DEFAULT_WORKFLOW_SETTINGS.stylePackageCount;

/**
 * Execute a single agent as part of parallel dispatch
 */
async function executeSingleAgent(
  dispatch: AgentDispatch,
  state: OrchestratorStateType
): Promise<ParallelResult> {
  const startTime = Date.now();
  const registry = getAgentRegistry();

  if (!registry) {
    return {
      agentId: dispatch.agentId,
      executionId: dispatch.executionId ?? crypto.randomUUID(),
      success: false,
      output: null,
      artifacts: [],
      error: 'Agent registry not initialized',
      durationMs: Date.now() - startTime,
      stylePackageId: dispatch.stylePackageId,
    };
  }

  const agent = registry.getAgent(dispatch.agentId);
  if (!agent) {
    return {
      agentId: dispatch.agentId,
      executionId: dispatch.executionId ?? crypto.randomUUID(),
      success: false,
      output: null,
      artifacts: [],
      error: `Agent not found: ${dispatch.agentId}`,
      durationMs: Date.now() - startTime,
      stylePackageId: dispatch.stylePackageId,
    };
  }

  try {
    // Build context for the agent
    const previousOutputs = (state.agentOutputs ?? []).map((o) => ({
      agentId: o.agentId,
      timestamp: o.timestamp,
      artifacts: o.artifacts,
    }));

    // Filter context based on contextRefs if provided
    let filteredOutputs = previousOutputs;
    if (dispatch.contextRefs && dispatch.contextRefs.length > 0) {
      filteredOutputs = previousOutputs.filter((o) =>
        dispatch.contextRefs!.some((ref) => ref.includes(o.agentId))
      );
    }

    // Find the style package for this dispatch if specified
    const stylePackage = dispatch.stylePackageId && state.stylePackages
      ? state.stylePackages.find((s) => (s as { id: string }).id === dispatch.stylePackageId)
      : undefined;

    // Build previous outputs with all required fields
    const previousOutputsWithDefaults = filteredOutputs.map((o) => ({
      agentId: o.agentId,
      timestamp: o.timestamp,
      artifacts: o.artifacts,
      success: true, // Previous outputs are considered successful
      result: null,
      routingHints: {},
    }));

    // Execute the agent
    // Note: stylePackage and other metadata would need to be passed
    // through the context system when the Agent interface is extended
    const result = await agent.execute({
      tenantId: state.tenantId,
      projectId: state.projectId,
      taskId: state.taskId,
      prompt: state.prompt,
      analysis: state.analysis ?? null,
      previousOutputs: previousOutputsWithDefaults,
      workflowSettings: state.workflowSettings ?? DEFAULT_WORKFLOW_SETTINGS,
    });

    return {
      agentId: dispatch.agentId,
      executionId: dispatch.executionId ?? crypto.randomUUID(),
      success: result.success,
      output: result.result,
      artifacts: result.artifacts.map((a) => ({
        id: a.id,
        type: a.type,
        path: a.path,
        content: a.content,
      })),
      error: result.error,
      durationMs: Date.now() - startTime,
      stylePackageId: dispatch.stylePackageId,
    };
  } catch (error) {
    return {
      agentId: dispatch.agentId,
      executionId: dispatch.executionId ?? crypto.randomUUID(),
      success: false,
      output: null,
      artifacts: [],
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      stylePackageId: dispatch.stylePackageId,
    };
  }
}

/**
 * Parallel dispatch node
 *
 * Executes all pending agents in parallel and collects results.
 * Enforces MAX_PARALLEL_AGENTS limit to prevent resource exhaustion.
 */
export async function parallelDispatchNode(
  state: OrchestratorStateType
): Promise<Partial<OrchestratorStateType>> {
  let pendingAgents = state.pendingAgents ?? [];

  if (pendingAgents.length === 0) {
    console.warn('parallelDispatchNode called with no pending agents');
    return {
      status: 'orchestrating' as const,
      isParallelExecution: false,
    };
  }

  // Get max parallel agents from settings
  const maxParallel = getMaxParallelAgents(state.workflowSettings);

  // Enforce maximum parallel agents limit
  if (pendingAgents.length > maxParallel) {
    console.warn(
      `Parallel dispatch: ${pendingAgents.length} agents exceeds max of ${maxParallel}, limiting to first ${maxParallel}`
    );
    pendingAgents = pendingAgents.slice(0, maxParallel);
  }

  console.log(`Parallel dispatch: executing ${pendingAgents.length} agents (max: ${maxParallel})`);

  // Execute all agents in parallel
  const promises = pendingAgents.map((dispatch) =>
    executeSingleAgent(dispatch, state)
  );

  // Use Promise.allSettled to handle partial failures
  const settledResults = await Promise.allSettled(promises);

  // Convert settled results to ParallelResult array
  const parallelResults: ParallelResult[] = settledResults.map(
    (settled, index) => {
      if (settled.status === 'fulfilled') {
        return settled.value;
      } else {
        // Promise rejected - convert to error result
        const dispatch = pendingAgents[index];
        return {
          agentId: dispatch?.agentId ?? 'unknown',
          executionId: dispatch?.executionId ?? crypto.randomUUID(),
          success: false,
          output: null,
          artifacts: [],
          error: settled.reason instanceof Error
            ? settled.reason.message
            : String(settled.reason),
          stylePackageId: dispatch?.stylePackageId,
        };
      }
    }
  );

  // Convert parallel results to agent outputs for compatibility
  const agentOutputs: AgentOutput[] = parallelResults.map((result) => ({
    agentId: result.agentId,
    success: result.success,
    result: result.output,
    artifacts: result.artifacts.map((a) => ({
      id: a.id,
      type: a.type as AgentOutput['artifacts'][0]['type'],
      path: a.path,
      content: a.content,
    })),
    routingHints: {
      hasFailures: !result.success,
    },
    error: result.error,
    timestamp: new Date().toISOString(),
  }));

  // Build mega page previews if this was style competition
  const megaPagePreviews = parallelResults
    .filter((r) => r.stylePackageId && r.success)
    .map((r) => ({
      styleId: r.stylePackageId!,
      designerId: r.executionId,
      previewPath: r.artifacts.find((a) => a.type === 'mockup')?.path ?? '',
      htmlContent: r.artifacts.find((a) => a.type === 'mockup')?.content,
      generatedAt: new Date().toISOString(),
    }));

  // Track completed agents (only successful ones)
  const newCompletedAgents = parallelResults
    .filter((r) => r.success)
    .map((r) => `${r.agentId}_${r.executionId}`);

  return {
    parallelResults,
    agentOutputs,
    megaPagePreviews: megaPagePreviews.length > 0 ? megaPagePreviews : undefined,
    completedAgents: newCompletedAgents,
    pendingAgents: [], // Clear pending agents
    isParallelExecution: false, // Parallel execution complete
    status: 'orchestrating' as const, // Return to orchestration for next decision
  };
}

/**
 * Check if all parallel results are successful
 */
export function allParallelResultsSuccessful(
  results: ParallelResult[]
): boolean {
  return results.every((r) => r.success);
}

/**
 * Get failed parallel results
 */
export function getFailedParallelResults(
  results: ParallelResult[]
): ParallelResult[] {
  return results.filter((r) => !r.success);
}

/**
 * Get parallel result by style package ID
 */
export function getParallelResultByStyleId(
  results: ParallelResult[],
  stylePackageId: string
): ParallelResult | undefined {
  return results.find((r) => r.stylePackageId === stylePackageId);
}
