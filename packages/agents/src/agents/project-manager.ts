/**
 * Project Manager Agent
 *
 * Breaks down user requests into epics, features, and tasks.
 * Creates structured work breakdown with dependencies and estimates.
 *
 * SECURITY:
 * - Validates all parsed work items
 * - Detects circular dependencies
 * - Tenant isolation via context
 */

import type { AIProviderResponse } from '@aigentflow/ai-provider';
import { BaseAgent } from '../base-agent.js';
import type {
  AgentMetadata,
  AgentContext,
  AgentRequest,
  RoutingHints,
  Artifact,
} from '../types.js';
import { AgentTypeEnum, ContextTypeEnum, ArtifactTypeEnum } from '../types.js';
import type {
  ProjectManagerOutput,
  Epic,
  WorkBreakdownSummary,
  Blocker,
  PMRoutingHints,
} from '../schemas/project-manager-output.js';
import { ProjectManagerOutputSchema } from '../schemas/project-manager-output.js';
import { calculateSummary, validateWorkBreakdown } from '../planning/work-breakdown.js';
import { DependencyGraph } from '../planning/dependency-graph.js';

/**
 * Project Manager Agent implementation
 *
 * Capabilities:
 * - work-breakdown: Create epic/feature/task hierarchy
 * - dependency-analysis: Identify task dependencies
 * - estimation: Estimate complexity and effort
 */
export class ProjectManagerAgent extends BaseAgent {
  constructor() {
    const metadata: AgentMetadata = {
      id: AgentTypeEnum.PROJECT_MANAGER,
      name: 'Project Manager',
      description: 'Breaks down user requests into executable work units',
      version: '1.0.0',
      capabilities: [
        {
          name: 'work-breakdown',
          description: 'Create epic/feature/task hierarchy from requirements',
          inputTypes: ['requirements', 'text'],
          outputTypes: ['work-breakdown', 'json'],
        },
        {
          name: 'dependency-analysis',
          description: 'Identify task dependencies and execution order',
          inputTypes: ['tasks'],
          outputTypes: ['dependency-graph', 'json'],
        },
        {
          name: 'estimation',
          description: 'Estimate complexity and effort for work items',
          inputTypes: ['tasks'],
          outputTypes: ['estimates', 'json'],
        },
      ],
      requiredContext: [{ type: ContextTypeEnum.CURRENT_TASK, required: true }],
      outputSchema: 'project-manager-output',
    };

    super(metadata);
  }

  /**
   * Build system prompt for work breakdown
   */
  protected buildSystemPrompt(context: AgentContext): string {
    return `You are the Project Manager agent responsible for breaking down user requests into executable work units.

Your responsibilities:
1. Analyze the user's request to understand all required functionality
2. Create a hierarchy of Epics (large initiatives), Features (deliverable units), and Tasks (atomic work items)
3. For each task, specify:
   - Clear title and description
   - Task type (design, frontend, backend, database, testing, integration, documentation, devops, review)
   - Complexity (trivial, simple, moderate, complex, epic)
   - Dependencies on other tasks (by ID)
   - Acceptance criteria
   - Which agents should handle it
   - Whether it's compliance-relevant

4. Identify dependencies between tasks - what must complete before what
5. Consider compliance requirements if specified
6. Create user stories for features in the format: "As a [user], I want [goal], so that [benefit]"

IMPORTANT RULES:
- Task IDs must be lowercase alphanumeric with hyphens only (e.g., "task-setup-db", "task-create-api")
- Feature IDs must follow same pattern (e.g., "feat-user-auth", "feat-dashboard")
- Epic IDs must follow same pattern (e.g., "epic-mvp", "epic-security")
- Tasks should be atomic - one task, one agent, one deliverable
- "Epic" complexity tasks should be broken down further
- Every task needs at least one clear acceptance criterion
- Design tasks should come before implementation tasks
- Testing tasks should follow implementation tasks
- Review tasks should be last
- Self-references in dependencies are not allowed (task cannot depend on itself)

Available agent types for assignedAgents:
- ui_designer: UI/UX design work
- frontend_dev: Frontend implementation
- backend_dev: Backend implementation
- architect: Architecture decisions
- tester: Testing
- reviewer: Code review
- compliance_agent: Security and compliance checks
${this.getStructuredOutputInstruction()}

REQUIRED OUTPUT SCHEMA (ProjectManagerOutput):
{
  "epics": [
    {
      "id": "epic-id",
      "title": "Epic Title",
      "description": "Description",
      "objective": "Main objective",
      "features": [
        {
          "id": "feat-id",
          "title": "Feature Title",
          "description": "Description",
          "userStory": "As a user, I want X, so that Y",
          "tasks": [
            {
              "id": "task-id",
              "title": "Task Title",
              "description": "Description",
              "type": "backend",
              "complexity": "moderate",
              "dependencies": ["task-other-id"],
              "acceptanceCriteria": ["Criterion 1"],
              "assignedAgents": ["backend_dev"],
              "complianceRelevant": false,
              "tags": ["api"]
            }
          ],
          "acceptanceCriteria": ["Feature criterion"],
          "priority": "high",
          "dependencies": [],
          "complianceRelevant": false
        }
      ],
      "successMetrics": ["Metric 1"],
      "risks": [
        {
          "description": "Risk description",
          "mitigation": "Mitigation strategy",
          "severity": "medium"
        }
      ]
    }
  ],
  "summary": { ... },
  "suggestedOrder": ["task-1", "task-2"],
  "parallelizable": [["task-1", "task-2"], ["task-3"]],
  "blockers": [],
  "routingHints": {
    "suggestNext": ["architect"],
    "skipAgents": [],
    "needsApproval": true,
    "hasFailures": false,
    "isComplete": false,
    "notes": "Ready for architecture review"
  }
}`;
  }

  /**
   * Build user prompt with request details
   */
  protected buildUserPrompt(request: AgentRequest): string {
    const task = request.task;
    const contextItems = request.context.items;

    // Find project config if available
    const projectConfig = contextItems.find(
      (i) => i.type === ContextTypeEnum.PROJECT_CONFIG
    );

    let prompt = `Break down this request into epics, features, and tasks:\n\n`;
    prompt += `REQUEST:\n`;

    // Include task description or full task details
    if (typeof task === 'object' && 'description' in task) {
      prompt += `${(task as { description?: string }).description || JSON.stringify(task)}\n\n`;
    } else {
      prompt += `${JSON.stringify(task, null, 2)}\n\n`;
    }

    // Include project context if available
    if (projectConfig?.content) {
      prompt += `PROJECT CONTEXT:\n${JSON.stringify(projectConfig.content, null, 2)}\n\n`;
    }

    // Include any previous outputs as context
    if (request.context.previousOutputs.length > 0) {
      prompt += `PREVIOUS AGENT OUTPUTS:\n`;
      for (const output of request.context.previousOutputs) {
        if (typeof output === 'object' && output !== null) {
          const typedOutput = output as { agentId?: string; success?: boolean };
          prompt += `- ${typedOutput.agentId || 'unknown'}: ${typedOutput.success ? 'success' : 'failed'}\n`;
        }
      }
      prompt += '\n';
    }

    prompt += `Create a complete work breakdown structure with proper dependencies and acceptance criteria. `;
    prompt += `Ensure all IDs are lowercase alphanumeric with hyphens.`;

    return prompt;
  }

  /**
   * Parse LLM response into ProjectManagerOutput
   */
  protected parseResponse(response: AIProviderResponse): ProjectManagerOutput {
    const text = this.extractTextContent(response);

    // Try to parse as JSON
    const parsed = this.parseJSON<ProjectManagerOutput>(text);

    // Validate with Zod schema
    return ProjectManagerOutputSchema.parse(parsed);
  }

  /**
   * Process parsed result: validate, compute dependencies, enrich
   */
  protected async processResult(
    parsed: ProjectManagerOutput,
    request: AgentRequest
  ): Promise<{ result: ProjectManagerOutput; artifacts: Artifact[] }> {
    // Validate the work breakdown structure
    const validation = validateWorkBreakdown(parsed.epics);

    if (!validation.valid) {
      this.log('warn', 'Work breakdown validation errors', {
        errors: validation.errors,
        tenantId: request.context.tenantId,
      });
    }

    if (validation.warnings.length > 0) {
      this.log('debug', 'Work breakdown warnings', {
        warnings: validation.warnings,
        tenantId: request.context.tenantId,
      });
    }

    // Build dependency graph
    const graph = DependencyGraph.fromEpics(parsed.epics);

    // Check for cycles - this is a blocking error
    const cycles = graph.detectCycles();
    if (cycles.length > 0) {
      const cycleDescs = cycles.map((c) => c.description).join('; ');
      this.log('error', 'Circular dependencies detected', {
        cycles: cycleDescs,
        tenantId: request.context.tenantId,
      });
      throw new Error(`Circular dependencies detected: ${cycleDescs}`);
    }

    // Compute summary statistics
    const summary: WorkBreakdownSummary = calculateSummary(parsed.epics);

    // Compute dependency ordering
    const suggestedOrder = graph.getTopologicalOrder();
    const parallelizable = graph.getParallelGroups();
    const criticalPath = graph.findCriticalPath();

    // Update summary with critical path
    summary.criticalPath = criticalPath;

    // Build blockers list from validation errors
    const blockers: Blocker[] = validation.errors.map((error) => ({
      taskId: this.extractTaskIdFromError(error),
      reason: error,
      resolution: 'Fix the identified issue and re-run planning',
    }));

    // Build enhanced output
    const enhancedOutput: ProjectManagerOutput = {
      ...parsed,
      summary,
      suggestedOrder,
      parallelizable,
      blockers,
    };

    // Create work breakdown artifact
    const artifact: Artifact = {
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.DOCUMENTATION,
      path: 'planning/work-breakdown.json',
      content: JSON.stringify(enhancedOutput, null, 2),
      metadata: {
        totalTasks: summary.totalTasks,
        totalFeatures: summary.totalFeatures,
        totalEpics: summary.totalEpics,
        estimatedEffort: summary.estimatedTotalEffort,
        hasBlockers: blockers.length > 0,
        complianceRelevant: summary.complianceTaskCount > 0,
      },
    };

    this.log('info', 'Work breakdown created', {
      epics: summary.totalEpics,
      features: summary.totalFeatures,
      tasks: summary.totalTasks,
      effort: summary.estimatedTotalEffort,
      tenantId: request.context.tenantId,
    });

    return {
      result: enhancedOutput,
      artifacts: [artifact],
    };
  }

  /**
   * Generate routing hints based on work breakdown
   */
  protected generateRoutingHints(
    result: unknown,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    const output = result as ProjectManagerOutput;

    // Determine next agents based on first parallelizable group
    const suggestNext: (typeof AgentTypeEnum)[keyof typeof AgentTypeEnum][] = [];

    // Check if architecture decisions needed
    const needsArchitecture = output.epics.some((e) =>
      e.features.some((f) =>
        f.tasks.some((t) => t.type === 'backend' || t.type === 'database')
      )
    );

    if (needsArchitecture) {
      suggestNext.push(AgentTypeEnum.ARCHITECT);
    }

    // Check if design needed
    const needsDesign = output.epics.some((e) =>
      e.features.some((f) =>
        f.tasks.some((t) => t.type === 'design' || t.type === 'frontend')
      )
    );

    if (needsDesign) {
      suggestNext.push(AgentTypeEnum.UI_DESIGNER);
    }

    // Check if compliance review needed
    if (output.summary.complianceTaskCount > 0) {
      suggestNext.push(AgentTypeEnum.COMPLIANCE_AGENT);
    }

    // If no specific needs, suggest analyzer for research
    if (suggestNext.length === 0) {
      suggestNext.push(AgentTypeEnum.ANALYZER);
    }

    const hasBlockers = output.blockers.length > 0;

    return {
      suggestNext,
      skipAgents: [],
      needsApproval: true, // Plan should be approved before execution
      hasFailures: hasBlockers,
      isComplete: false,
      blockedBy: hasBlockers ? 'Work breakdown has blockers to resolve' : undefined,
      notes: `Created ${output.summary.totalTasks} tasks across ${output.summary.totalFeatures} features. Estimated effort: ${output.summary.estimatedTotalEffort}`,
    };
  }

  /**
   * Extract task ID from validation error message
   */
  private extractTaskIdFromError(error: string): string {
    // Try to find task ID in error message
    const taskMatch = error.match(/task[- ]([a-z0-9-]+)/i);
    if (taskMatch?.[1]) {
      return `task-${taskMatch[1]}`;
    }

    const featMatch = error.match(/feature[- ]([a-z0-9-]+)/i);
    if (featMatch?.[1]) {
      return `feat-${featMatch[1]}`;
    }

    const epicMatch = error.match(/epic[- ]([a-z0-9-]+)/i);
    if (epicMatch?.[1]) {
      return `epic-${epicMatch[1]}`;
    }

    return 'unknown';
  }
}
