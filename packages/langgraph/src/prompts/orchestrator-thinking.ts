/**
 * Orchestrator Thinking Prompt
 *
 * System prompt that guides the orchestrator's decision-making between
 * workflow steps. The orchestrator reasons about what should happen next
 * based on completed work, available agents, and workflow phase.
 */

import type { OrchestratorDecision } from '../schemas/orchestrator-thinking.js';
import type { WorkflowSettings } from '../state.js';
import { DEFAULT_WORKFLOW_SETTINGS } from '../state.js';

/**
 * Build orchestrator thinking prompt with configurable settings
 *
 * @param settings - Workflow settings (stylePackageCount, parallelDesignerCount, etc.)
 * @returns Prompt string with settings applied
 */
export function buildOrchestratorThinkingPrompt(settings?: Partial<WorkflowSettings>): string {
  const styleCount = settings?.stylePackageCount ?? DEFAULT_WORKFLOW_SETTINGS.stylePackageCount;
  const maxParallel = settings?.parallelDesignerCount ?? DEFAULT_WORKFLOW_SETTINGS.parallelDesignerCount;
  const maxRejections = settings?.maxStyleRejections ?? DEFAULT_WORKFLOW_SETTINGS.maxStyleRejections;
  const enableCompetition = settings?.enableStyleCompetition ?? DEFAULT_WORKFLOW_SETTINGS.enableStyleCompetition;

  // If competition is disabled and count is 1, adjust the prompt accordingly
  const competitionText = styleCount === 1
    ? 'a single UI designer creating ONE mega page with the style package'
    : `${styleCount} UI designers each creating a mega page with different style packages`;

  const parallelPhaseText = styleCount === 1
    ? `- 1 UI designer receives the style package
- Creates a "mega page" showcasing ALL components from inventory`
    : `- ${styleCount} UI designers each receive ONE style package
- Each creates a "mega page" showcasing ALL components from inventory
- All run in parallel for efficiency`;

  const styleSelectionText = styleCount === 1
    ? `- Present the mega page to user
- User approves the style or requests changes
- If user rejects the style:
  - Capture feedback
  - Return to Analyst with rejection reasons
  - Analyst generates a NEW style package (avoiding rejected characteristics)
  - Maximum ${maxRejections} rejection iterations`
    : `- Present all ${styleCount} mega pages to user
- User selects ONE preferred style
- If user rejects ALL styles:
  - Capture feedback
  - Return to Analyst with rejection reasons
  - Analyst generates ${styleCount} NEW style packages (avoiding rejected characteristics)
  - Maximum ${maxRejections} rejection iterations`;

  const parallelRulesText = styleCount === 1
    ? `- Style generation: 1 UI designer (single style)
   - Screen generation: Up to ${maxParallel} parallel UI designers (one per screen, max ${maxParallel} at a time)`
    : `- Style competition: EXACTLY ${styleCount} UI designers (one per style package)
   - Screen generation: Up to ${maxParallel} parallel UI designers (one per screen, max ${maxParallel} at a time)`;

  return `You are the orchestrator for an AI development workflow. Your job is to analyze the current state after each step and decide what should happen next.

## Your Role

You coordinate multiple specialized agents to complete software development tasks:
- **Analyst**: Researches requirements, user flows, components needed, and generates ${styleCount} distinct style package${styleCount > 1 ? 's' : ''}
- **Architect**: Creates technical architecture, ADRs, directory structure
- **UI Designer**: Creates visual mockups using a specific style package
- **Project Manager**: Breaks down work into tasks with design references
- **Compliance**: Verifies security and compliance requirements

## Decision Framework

After each step, you must decide ONE of these actions:

### dispatch
Send work to a single agent. Use when:
- Sequential work is needed (e.g., Analyst before Architect)
- Only one agent is appropriate for the next step

### parallel_dispatch
Send work to multiple agents simultaneously. Use when:
- Multiple independent tasks can run concurrently
- Style competition: ${competitionText}
- Testing: Multiple reviewers examining different aspects

### approval
Request human approval. Use when:
- Style selection: User must ${styleCount === 1 ? 'approve the style' : `choose 1 of ${styleCount} style options`}
- Design review: User must approve all screen mockups before PM
- Critical decisions that need human judgment

### complete
Workflow is finished successfully. Use when:
- All required work is done
- User has approved final deliverables
- No more agents are needed

### fail
Workflow cannot continue. Use when:
- Unrecoverable error occurred
- Maximum retries exceeded
- Required resource unavailable

## Workflow Phases

### Phase 1: Research (Analyst)
- Analyze the user prompt for style hints (colors, fonts, inspiration URLs)
- Research the domain and competitors
- Identify all screens and user flows needed
- Create component inventory (all UI components the app needs)
- Generate ${styleCount} distinct style package${styleCount > 1 ? 's' : ''} that honor user hints

### Phase 2: Architecture (Architect)
- Create technical architecture based on requirements
- Design directory structure
- Document architectural decisions (ADRs)

### Phase 3: Style ${styleCount === 1 ? 'Generation' : 'Competition'} (${styleCount === 1 ? 'UI Designer' : 'Parallel UI Designers'})
${parallelPhaseText}

### Phase 4: Stylesheet Approval (REQUIRED GATE)
${styleSelectionText}

**CRITICAL**: You MUST wait for stylesheet approval before proceeding to screen generation.
- Set \`stylesheetApproved: true\` in state after approval
- If rejected, return to Phase 3 with rejection feedback
- NEVER skip this approval gate

### Phase 5: Full Design (Parallel UI Designers)
- **PARALLELIZE screen generation** with up to ${maxParallel} UI designers
- Assign each screen (or group of related screens) to a different designer
- Each designer uses the SAME approved style package for consistency
- Each designer references user flows for navigation context
- Example: 10 screens = ${Math.min(10, maxParallel)} parallel UI designers (one per screen, max ${maxParallel} at a time)

### Phase 6: Design Approval (Approval)
- Present all screen mockups to user
- User approves or requests changes
- Changes go back to UI Designer

### Phase 7: Project Planning (Project Manager)
- Create implementation tasks
- Each task references specific design mockups
- Tasks are organized by feature/user flow

## Style Package Structure

Each style package contains:
- Typography (heading font, body font, weights)
- Icons (library, style)
- Colors (primary, secondary, accent, backgrounds, states)
- Visual style (border radius, shadows, gradients, animations)
- CSS framework preference
- Design references and inspiration
- Mood description

## Context Mapping

When dispatching to agents, you can specify which context each agent should receive:
- Use contextRefs to point to specific outputs: "analyst.stylePackages[0]"
- This enables selective context passing for focused agent work

## Rejection Handling

When styles are rejected:
1. Record which style IDs were rejected
2. Note the user feedback
3. Send feedback to Analyst
4. Analyst must generate NEW styles avoiding rejected characteristics
5. Track iteration count (max ${maxRejections})
6. If max iterations reached, ask user for more specific guidance

## Output Format

Respond with a JSON object:

\`\`\`json
{
  "reasoning": "Your step-by-step analysis of the current state and decision",
  "action": "dispatch | parallel_dispatch | approval | complete | fail",
  "targets": [
    {
      "agentId": "analyst | architect | ui_designer | project_manager | compliance",
      "styleHint": "optional: mood keyword for this designer",
      "stylePackageId": "optional: ID of style package to use",
      "contextRefs": ["optional: specific context to pass"],
      "priority": "high | normal | low"
    }
  ],
  "approvalConfig": {
    "type": "style_selection | design_review | confirmation",
    "description": "What the user needs to approve",
    "options": [
      {
        "id": "style-1",
        "name": "Style name",
        "description": "Style description",
        "previewPath": "/path/to/preview.html"
      }
    ],
    "allowRejectAll": true,
    "iterationCount": 1,
    "maxIterations": ${maxRejections}
  },
  "error": "optional: error message if action is fail",
  "summary": "optional: completion summary if action is complete",
  "confidence": 0.95
}
\`\`\`

## User Messages

Users can send messages during workflow execution to provide guidance, ask questions, or request changes.

When you receive user messages:
1. **Read carefully** - Understand what the user is asking
2. **Acknowledge** - Reference the user's message in your reasoning
3. **Adapt** - Adjust your next action based on the user's input
4. **Respond** - Include relevant response in your reasoning for the user to see

Common user message patterns:
- **Questions**: "What's happening?" → Explain current state and next steps
- **Guidance**: "Focus on mobile first" → Incorporate into agent instructions
- **Priority changes**: "Skip the architecture step" → Adjust workflow phases
- **Feedback during approval**: "Make it more colorful" → Pass to relevant agent

If user message requires immediate action:
- Acknowledge in reasoning
- Dispatch to appropriate agent with user's feedback in context
- Or return to previous agent with modifications

## Important Rules

1. **Always think step by step** - Explain your reasoning before deciding
2. **Honor user style hints** - If user mentions colors, fonts, or URLs, ensure they influence the style packages
3. **Don't skip phases** - Research before architecture, design before planning
4. **Parallel when possible** - Maximize parallelism:
   ${parallelRulesText}
5. **Never repeat rejected styles** - Track rejections and avoid their characteristics
6. **Approval at key gates** - Style selection and design review need human input
7. **Context efficiency** - Only pass relevant context to each agent
8. **Maximum ${maxParallel} parallel agents** - Never dispatch more than ${maxParallel} agents at once
9. **Respond to user messages** - When users send messages, acknowledge and adapt accordingly`;
}

/**
 * Legacy constant for backward compatibility
 * @deprecated Use buildOrchestratorThinkingPrompt(settings) instead
 */
export const ORCHESTRATOR_THINKING_PROMPT = buildOrchestratorThinkingPrompt();

/**
 * Prompt for building thinking context from state
 */
export function buildThinkingContext(state: {
  prompt: string;
  analysis: unknown;
  completedAgents: string[];
  agentOutputs: Array<{
    agentId: string;
    success: boolean;
    artifacts?: Array<{ id: string; type: string; path: string }>;
    error?: string;
  }>;
  stylePackages?: unknown[];
  rejectedStyles?: Array<{ styleId: string; styleName: string; avoidCharacteristics: string[] }>;
  selectedStyleId?: string | null;
  componentInventory?: unknown;
  styleIteration?: number;
  approvalResponse?: { approved: boolean; selectedOption?: string; feedback?: string } | null;
  error?: string | null;
  userMessages?: Array<{ id: string; content: string; timestamp: string }>;
  lastProcessedMessageIndex?: number;
  designPhase?: 'research' | 'stylesheet' | 'screens' | 'complete';
  stylesheetApproved?: boolean;
  screensApproved?: boolean;
  screenMockups?: Array<{ id: string; name: string; path: string }>;
}): string {
  const sections: string[] = [];

  // Current prompt/task
  sections.push(`## Current Task\n${state.prompt}`);

  // Pending user messages (not yet processed)
  if (state.userMessages && state.userMessages.length > 0) {
    const lastProcessed = state.lastProcessedMessageIndex ?? -1;
    const pendingMessages = state.userMessages.slice(lastProcessed + 1);

    if (pendingMessages.length > 0) {
      const messageList = pendingMessages.map((m) => {
        const time = new Date(m.timestamp).toLocaleTimeString('en-US', { hour12: false });
        return `[${time}] ${m.content}`;
      }).join('\n');
      sections.push(`## ⚡ USER MESSAGES (RESPOND TO THESE)\n${messageList}`);
    }

    // Show all messages as context
    if (state.userMessages.length > pendingMessages.length) {
      const allMessages = state.userMessages.map((m) => {
        const time = new Date(m.timestamp).toLocaleTimeString('en-US', { hour12: false });
        return `[${time}] ${m.content}`;
      }).join('\n');
      sections.push(`## All User Messages\n${allMessages}`);
    }
  }

  // Analysis results
  if (state.analysis) {
    sections.push(`## Task Analysis\n\`\`\`json\n${JSON.stringify(state.analysis, null, 2)}\n\`\`\``);
  }

  // Completed agents
  if (state.completedAgents.length > 0) {
    sections.push(`## Completed Agents\n${state.completedAgents.map((a) => `- ${a}`).join('\n')}`);
  }

  // Agent outputs summary
  if (state.agentOutputs.length > 0) {
    const outputSummary = state.agentOutputs.map((o) => {
      const artifactList = o.artifacts?.map((a) => `  - ${a.type}: ${a.path}`).join('\n') || '  (no artifacts)';
      return `### ${o.agentId} (${o.success ? 'success' : 'failed'})\n${o.error ? `Error: ${o.error}\n` : ''}Artifacts:\n${artifactList}`;
    }).join('\n\n');
    sections.push(`## Agent Outputs\n${outputSummary}`);
  }

  // Style packages
  if (state.stylePackages && state.stylePackages.length > 0) {
    sections.push(`## Available Style Packages\n${state.stylePackages.length} style packages generated by Analyst`);
  }

  // Rejected styles
  if (state.rejectedStyles && state.rejectedStyles.length > 0) {
    const rejected = state.rejectedStyles.map((r) =>
      `- ${r.styleName} (${r.styleId}): Avoid: ${r.avoidCharacteristics.join(', ')}`
    ).join('\n');
    sections.push(`## Rejected Styles (DO NOT REPEAT)\n${rejected}`);
  }

  // Selected style
  if (state.selectedStyleId) {
    sections.push(`## Selected Style\nStyle ID: ${state.selectedStyleId} has been approved by user`);
  }

  // Component inventory
  if (state.componentInventory) {
    sections.push(`## Component Inventory\nComponent inventory has been generated`);
  }

  // Style iteration
  if (state.styleIteration && state.styleIteration > 1) {
    sections.push(`## Style Iteration\nThis is iteration ${state.styleIteration}/5 of style generation`);
  }

  // Recent approval response
  if (state.approvalResponse) {
    const response = state.approvalResponse;
    if (response.approved) {
      sections.push(`## Approval Response\nUser APPROVED${response.selectedOption ? ` option: ${response.selectedOption}` : ''}`);
    } else {
      sections.push(`## Approval Response\nUser REJECTED${response.feedback ? `\nFeedback: ${response.feedback}` : ''}`);
    }
  }

  // Current error
  if (state.error) {
    sections.push(`## Current Error\n${state.error}`);
  }

  // Design phase tracking
  if (state.designPhase) {
    const phaseInfo = [
      `Current Phase: ${state.designPhase.toUpperCase()}`,
      `Stylesheet Approved: ${state.stylesheetApproved ? 'YES ✓' : 'NO (required before screens)'}`,
      `Screens Approved: ${state.screensApproved ? 'YES ✓' : 'NO'}`,
    ];
    if (state.screenMockups && state.screenMockups.length > 0) {
      phaseInfo.push(`Screen Mockups Generated: ${state.screenMockups.length}`);
    }
    sections.push(`## Design Phase Status\n${phaseInfo.join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * Parse orchestrator decision from LLM response
 */
export function parseOrchestratorDecision(response: string): OrchestratorDecision | null {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response;

    // Try to extract from code block
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // Try to find JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (!parsed.reasoning || !parsed.action) {
      console.error('Missing required fields in orchestrator decision');
      return null;
    }

    // Validate action
    const validActions = ['dispatch', 'parallel_dispatch', 'approval', 'complete', 'fail', 'wait'];
    if (!validActions.includes(parsed.action)) {
      console.error(`Invalid action: ${parsed.action}`);
      return null;
    }

    // Normalize targets to ensure priority has a default
    // Use bracket notation for index signature access
    const targets = parsed.targets?.map((t: Record<string, unknown>) => ({
      agentId: String(t['agentId']),
      executionId: t['executionId'] ? String(t['executionId']) : undefined,
      styleHint: t['styleHint'] ? String(t['styleHint']) : undefined,
      stylePackageId: t['stylePackageId'] ? String(t['stylePackageId']) : undefined,
      contextRefs: Array.isArray(t['contextRefs'])
        ? (t['contextRefs'] as unknown[]).map((r: unknown) => String(r))
        : undefined,
      priority: (t['priority'] as 'high' | 'normal' | 'low') ?? 'normal',
      metadata: t['metadata'] as Record<string, unknown> | undefined,
    }));

    return {
      reasoning: parsed.reasoning,
      action: parsed.action,
      targets,
      contextMapping: parsed.contextMapping,
      approvalConfig: parsed.approvalConfig,
      error: parsed.error,
      summary: parsed.summary,
      confidence: parsed.confidence,
    };
  } catch (err) {
    console.error('Failed to parse orchestrator decision:', err);
    return null;
  }
}

/**
 * Build style rejection prompt with configurable count
 *
 * @param styleCount - Number of style packages to generate (default 1)
 * @returns Prompt template string with placeholders
 */
export function buildStyleRejectionTemplate(styleCount: number = 1): string {
  const allText = styleCount === 1 ? 'the style option' : `all ${styleCount} style options`;
  const countText = styleCount === 1 ? 'a NEW style package' : `${styleCount} NEW style packages`;
  const diffText = styleCount === 1 ? 'a COMPLETELY DIFFERENT style package' : `${styleCount} COMPLETELY DIFFERENT style packages`;

  return `The user has rejected ${allText}. You must generate ${countText}.

## Rejection Context

Previous styles were rejected because:
{rejection_feedback}

Styles to avoid (DO NOT use similar characteristics):
{rejected_styles}

## Requirements

1. Generate ${diffText}
2. Avoid ALL characteristics from rejected styles
3. Still honor any user hints from the original prompt
4. Be creative - try unexpected combinations
5. If user mentioned specific issues, address them directly

## User Hints to Honor

{user_hints}

Generate the new style package${styleCount > 1 ? 's' : ''} in the standard StylePackage format.`;
}

/**
 * Legacy constant for backward compatibility
 * @deprecated Use buildStyleRejectionTemplate(styleCount) instead
 */
export const STYLE_REJECTION_PROMPT = buildStyleRejectionTemplate(1);

/**
 * Build style rejection prompt with context
 */
export function buildStyleRejectionPrompt(
  rejectionFeedback: string,
  rejectedStyles: Array<{ styleName: string; avoidCharacteristics: string[] }>,
  userHints: { colors: string[]; fonts: string[]; moodKeywords: string[] }
): string {
  const rejectedList = rejectedStyles
    .map((s) => `- ${s.styleName}: Avoid ${s.avoidCharacteristics.join(', ')}`)
    .join('\n');

  const hints = [
    userHints.colors.length > 0 ? `Colors: ${userHints.colors.join(', ')}` : null,
    userHints.fonts.length > 0 ? `Fonts: ${userHints.fonts.join(', ')}` : null,
    userHints.moodKeywords.length > 0 ? `Mood: ${userHints.moodKeywords.join(', ')}` : null,
  ].filter(Boolean).join('\n');

  return STYLE_REJECTION_PROMPT
    .replace('{rejection_feedback}', rejectionFeedback || 'No specific feedback provided')
    .replace('{rejected_styles}', rejectedList || 'None')
    .replace('{user_hints}', hints || 'No specific hints in original prompt');
}
