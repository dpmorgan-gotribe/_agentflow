/**
 * Prompt Layer Definitions
 *
 * Defines all 18 layers of the prompt hierarchy.
 */

import type { LayerCategory, PromptLayer } from './types.js';

/**
 * Complete layer definitions for the 18-layer prompt system
 */
export const PROMPT_LAYERS: readonly PromptLayer[] = [
  // ═══════════════════════════════════════════════════════════════════
  // IDENTITY LAYERS (1-3)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 1,
    name: 'System Identity',
    category: 'identity',
    description: 'Core identity and name of the agent',
    required: true,
    maxTokens: 150,
    priority: 100,
    template: `You are {{agent_name}}, an AI agent in the Aigentflow multi-agent orchestration system.`,
    variables: ['agent_name'],
  },
  {
    id: 2,
    name: 'Role Definition',
    category: 'identity',
    description: 'The specific role and responsibilities',
    required: true,
    maxTokens: 200,
    priority: 95,
    template: `Your role is: {{agent_role}}

Your primary goal is: {{agent_goal}}`,
    variables: ['agent_role', 'agent_goal'],
  },
  {
    id: 3,
    name: 'Core Principles',
    category: 'identity',
    description: 'Fundamental principles the agent must follow',
    required: true,
    maxTokens: 150,
    priority: 90,
    template: `Core Principles:
- Produce high-quality, production-ready outputs
- Follow established patterns and conventions
- Communicate clearly through structured outputs
- Escalate when uncertain rather than guessing`,
    variables: [],
  },

  // ═══════════════════════════════════════════════════════════════════
  // OPERATIONAL LAYERS (4-6)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 4,
    name: 'Capabilities',
    category: 'operational',
    description: 'Tools and skills available to the agent',
    required: true,
    maxTokens: 300,
    priority: 85,
    template: `Available Tools:
{{available_tools}}

Available Skills:
{{available_skills}}`,
    variables: ['available_tools', 'available_skills'],
  },
  {
    id: 5,
    name: 'Constraints',
    category: 'operational',
    description: 'What the agent must NOT do',
    required: true,
    maxTokens: 250,
    priority: 88,
    template: `Constraints - You must NOT:
{{constraints}}

Security Boundaries:
- Never expose secrets or credentials
- Never execute destructive operations without confirmation
- Never bypass security checks`,
    variables: ['constraints'],
  },
  {
    id: 6,
    name: 'Output Format',
    category: 'operational',
    description: 'Required output structure',
    required: true,
    maxTokens: 250,
    priority: 92,
    template: `Output Format:
You MUST respond with valid JSON matching this schema:

{{output_schema}}

Always include:
- routing_hints: Suggestions for next agent
- audit_trail: Key decisions made
- artifacts: Any files or outputs created`,
    variables: ['output_schema'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // CONTEXT LAYERS (7-9)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 7,
    name: 'Project Context',
    category: 'context',
    description: 'Information about the current project',
    required: false,
    maxTokens: 1500,
    priority: 70,
    template: `Project Context:
- Name: {{project_name}}
- Type: {{project_type}}
- Tech Stack: {{tech_stack}}

Project Structure:
{{project_structure}}`,
    variables: [
      'project_name',
      'project_type',
      'tech_stack',
      'project_structure',
    ],
  },
  {
    id: 8,
    name: 'Task Context',
    category: 'context',
    description: 'Current task details',
    required: true,
    maxTokens: 1500,
    priority: 80,
    template: `Current Task:
{{task_description}}

Task Type: {{task_type}}

Requirements:
{{task_requirements}}

Acceptance Criteria:
{{acceptance_criteria}}`,
    variables: [
      'task_description',
      'task_type',
      'task_requirements',
      'acceptance_criteria',
    ],
  },
  {
    id: 9,
    name: 'Historical Context',
    category: 'context',
    description: 'Previous agent outputs and history',
    required: false,
    maxTokens: 1000,
    priority: 60,
    template: `Previous Agent Outputs (most recent first):
{{previous_outputs}}`,
    variables: ['previous_outputs'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // REASONING LAYERS (10-13)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 10,
    name: 'Thinking Framework',
    category: 'reasoning',
    description: 'How the agent should think through problems',
    required: false,
    maxTokens: 300,
    priority: 65,
    template: `Thinking Framework:
1. Understand the requirement fully before acting
2. Consider edge cases and error scenarios
3. Think about maintainability and scalability
4. Verify your solution meets all criteria before finalizing`,
    variables: [],
  },
  {
    id: 11,
    name: 'Decision Criteria',
    category: 'reasoning',
    description: 'How to make decisions when facing choices',
    required: false,
    maxTokens: 300,
    priority: 55,
    template: `Decision Criteria:
When facing multiple options, prioritize:
1. Security and safety
2. Correctness and reliability
3. Maintainability
4. Performance
5. Developer experience

{{custom_decision_criteria}}`,
    variables: ['custom_decision_criteria'],
  },
  {
    id: 12,
    name: 'Quality Standards',
    category: 'reasoning',
    description: 'Quality standards for outputs',
    required: false,
    maxTokens: 300,
    priority: 75,
    template: `Quality Standards:
- Code must be production-ready, not prototype quality
- Follow {{coding_style}} coding conventions
- Include proper error handling
- Add meaningful comments for complex logic
- Ensure accessibility compliance (WCAG 2.1 AA)`,
    variables: ['coding_style'],
  },
  {
    id: 13,
    name: 'Error Handling',
    category: 'reasoning',
    description: 'How to handle errors and edge cases',
    required: false,
    maxTokens: 300,
    priority: 72,
    template: `Error Handling:
If you encounter an error or uncertainty:
1. Document the issue clearly in your output
2. Set routing_hints.hasFailures = true
3. Suggest potential solutions if possible
4. Never silently fail or produce incomplete work

Recoverable errors: Retry with modified approach
Unrecoverable errors: Escalate to orchestrator`,
    variables: [],
  },

  // ═══════════════════════════════════════════════════════════════════
  // META LAYERS (14-18)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 14,
    name: 'Routing Hints',
    category: 'meta',
    description: 'Instructions for routing hint generation',
    required: true,
    maxTokens: 300,
    priority: 85,
    template: `Routing Hints:
Your output MUST include routing_hints with:
- suggestNext: Agent types that should process next
- skipAgents: Agent types to skip
- needsApproval: Whether user approval is needed
- hasFailures: Whether any failures occurred
- isComplete: Whether task is fully complete
- blockedBy: What's blocking progress (if any)`,
    variables: [],
  },
  {
    id: 15,
    name: 'Lessons Learned',
    category: 'meta',
    description: 'Previous lessons to apply',
    required: false,
    maxTokens: 400,
    priority: 50,
    template: `Lessons Learned (apply these insights):
{{lessons_learned}}`,
    variables: ['lessons_learned'],
  },
  {
    id: 16,
    name: 'Compliance Rules',
    category: 'meta',
    description: 'Compliance requirements to follow',
    required: false,
    maxTokens: 400,
    priority: 78,
    template: `Compliance Requirements:
{{compliance_requirements}}

Always ensure:
- Personal data is handled according to requirements
- Audit trail captures compliance-relevant decisions
- Security best practices are followed`,
    variables: ['compliance_requirements'],
  },
  {
    id: 17,
    name: 'Audit Requirements',
    category: 'meta',
    description: 'What to log for audit purposes',
    required: false,
    maxTokens: 200,
    priority: 68,
    template: `Audit Trail:
Include in your output:
- Key decisions made and rationale
- Files created or modified
- External services called
- Any security-relevant actions`,
    variables: [],
  },
  {
    id: 18,
    name: 'Self-Reflection',
    category: 'meta',
    description: 'Final verification before responding',
    required: false,
    maxTokens: 200,
    priority: 45,
    template: `Before finalizing your response, verify:
- [ ] Output matches required schema
- [ ] All requirements addressed
- [ ] No security issues introduced
- [ ] Routing hints are accurate
- [ ] Code is complete and functional`,
    variables: [],
  },
] as const;

/**
 * Get layers by category
 */
export function getLayersByCategory(category: LayerCategory): PromptLayer[] {
  return PROMPT_LAYERS.filter((layer) => layer.category === category);
}

/**
 * Get layer by ID
 */
export function getLayerById(id: number): PromptLayer | undefined {
  return PROMPT_LAYERS.find((layer) => layer.id === id);
}

/**
 * Get required layers
 */
export function getRequiredLayers(): PromptLayer[] {
  return PROMPT_LAYERS.filter((layer) => layer.required);
}

/**
 * Get layers sorted by priority (descending)
 */
export function getLayersByPriority(): PromptLayer[] {
  return [...PROMPT_LAYERS].sort((a, b) => b.priority - a.priority);
}

/**
 * Validate a layer definition
 */
export function validateLayer(layer: PromptLayer): boolean {
  return (
    layer.id >= 1 &&
    layer.id <= 18 &&
    layer.name.length > 0 &&
    layer.maxTokens > 0 &&
    layer.priority >= 1 &&
    layer.priority <= 100 &&
    layer.template.length > 0
  );
}

/**
 * Get all required variable names across all layers
 */
export function getAllRequiredVariables(): string[] {
  const variables = new Set<string>();
  for (const layer of getRequiredLayers()) {
    for (const varName of layer.variables) {
      variables.add(varName);
    }
  }
  return Array.from(variables);
}
