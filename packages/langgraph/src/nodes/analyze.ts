/**
 * Analyze Task Node
 *
 * Analyzes the user prompt to determine task type and required agents.
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import {
  type OrchestratorStateType,
  type TaskAnalysis,
  taskAnalysisSchema,
} from '../state.js';

const ANALYSIS_SYSTEM_PROMPT = `You are a task analyzer for a multi-agent development orchestrator.

Analyze the given development task and determine:
1. Task type (feature, bugfix, refactor, docs, config, test)
2. Complexity (trivial, simple, moderate, complex)
3. Whether it requires UI work
4. Whether it requires backend work
5. Whether it requires architecture decisions
6. Whether it requires human approval at any stage
7. Which agents should be involved

Available agents:
- project_manager: For planning complex features
- architect: For system design and architecture decisions
- ui_designer: For UI/UX mockups and design
- frontend_developer: For frontend implementation
- backend_developer: For backend implementation
- bug_fixer: For debugging and fixing issues
- tester: For writing and running tests
- reviewer: For code review and quality checks

Respond with valid JSON only.`;

/**
 * Analyze task node implementation
 *
 * Uses Claude to analyze the task prompt and determine the
 * appropriate workflow configuration.
 */
export async function analyzeTaskNode(
  state: OrchestratorStateType
): Promise<Partial<OrchestratorStateType>> {
  // Get model name from environment or use default
  const modelName =
    process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-20250514';

  const model = new ChatAnthropic({
    modelName,
    temperature: 0,
  });

  const response = await model.invoke([
    new SystemMessage(ANALYSIS_SYSTEM_PROMPT),
    new HumanMessage(`Analyze this task: "${state.prompt}"

Project context:
- Project ID: ${state.projectId}
- Tenant ID: ${state.tenantId}

Respond in JSON format:
{
  "taskType": "feature" | "bugfix" | "refactor" | "docs" | "config" | "test",
  "complexity": "trivial" | "simple" | "moderate" | "complex",
  "requiresUI": boolean,
  "requiresBackend": boolean,
  "requiresArchitecture": boolean,
  "requiresApproval": boolean,
  "suggestedAgents": ["agent_type", ...]
}`),
  ]);

  // Parse the response
  const content = response.content.toString();
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AnalysisError('Failed to parse task analysis response', {
      content,
    });
  }

  // Validate with Zod
  let analysis: TaskAnalysis;
  try {
    analysis = taskAnalysisSchema.parse(JSON.parse(jsonMatch[0]));
  } catch (error) {
    throw new AnalysisError('Invalid task analysis structure', {
      rawResponse: jsonMatch[0],
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Build initial agent queue based on analysis
  const agentQueue = buildAgentQueue(analysis);

  return {
    analysis,
    agentQueue,
    status: 'orchestrating',
    messages: [new HumanMessage(state.prompt), response],
  };
}

/**
 * Build the agent execution queue based on task analysis
 */
function buildAgentQueue(analysis: TaskAnalysis): string[] {
  const queue: string[] = [];

  // Planning (for complex features)
  if (analysis.complexity === 'complex' || analysis.complexity === 'moderate') {
    queue.push('project_manager');
  }

  // Architecture (for new features or significant changes)
  if (analysis.requiresArchitecture) {
    queue.push('architect');
  }

  // UI Design (only if UI work needed and not a bugfix)
  if (analysis.requiresUI && analysis.taskType !== 'bugfix') {
    queue.push('ui_designer');
  }

  // Development
  if (analysis.requiresUI) {
    queue.push('frontend_developer');
  }
  if (analysis.requiresBackend) {
    queue.push('backend_developer');
  }

  // For bugfixes, use bug fixer directly
  if (analysis.taskType === 'bugfix') {
    return ['bug_fixer', 'tester', 'reviewer'];
  }

  // Always test and review
  queue.push('tester');
  queue.push('reviewer');

  return queue;
}

/**
 * Analysis error class
 */
export class AnalysisError extends Error {
  public readonly context: Record<string, unknown>;

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AnalysisError';
    this.context = context;
  }
}
