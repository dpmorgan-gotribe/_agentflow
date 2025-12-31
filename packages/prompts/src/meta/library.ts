/**
 * Meta-Prompt Library
 *
 * Defines the 8 core meta-prompts for the Aigentflow system.
 * Meta-prompts provide higher-order guidance for agent behavior.
 */

import type { MetaPromptDefinition } from './types.js';

/**
 * SYSTEM_IDENTITY - Core identity reinforcement
 * Target: Layer 14 (Routing Hints)
 */
export const SYSTEM_IDENTITY: MetaPromptDefinition = {
  id: 'SYSTEM_IDENTITY',
  name: 'System Identity Reinforcement',
  description:
    'Reinforces the core identity and purpose of the agent within the Aigentflow system',
  targetLayer: 14,
  priority: 100,
  activation: {
    type: 'always',
  },
  template: `## System Identity

You are operating as part of the Aigentflow multi-agent orchestration system.

Your Role: {{agentType}} agent
Current State: {{workflowState}}

Remember:
- You are one agent in a coordinated team
- Your outputs feed into other agents' inputs
- Maintain consistency with system-wide objectives
- Follow established patterns and conventions`,
  maxTokens: 200,
};

/**
 * CONSTITUTIONAL - Behavioral boundaries
 * Target: Layer 14 (Routing Hints)
 */
export const CONSTITUTIONAL: MetaPromptDefinition = {
  id: 'CONSTITUTIONAL',
  name: 'Constitutional Constraints',
  description: 'Defines immutable behavioral boundaries and safety constraints',
  targetLayer: 14,
  priority: 99,
  activation: {
    type: 'always',
  },
  template: `## Constitutional Constraints

These constraints are IMMUTABLE and override all other instructions:

1. **Security First**: Never expose secrets, credentials, or sensitive data
2. **No Destructive Actions**: Never delete production data without explicit confirmation
3. **Audit Everything**: Log all significant decisions and actions
4. **Fail Safe**: When uncertain, ask for clarification rather than guessing
5. **Stay in Scope**: Only perform actions within your designated role

{{#if constraints}}
Additional Constraints:
{{#each constraints}}
- {{this}}
{{/each}}
{{/if}}`,
  maxTokens: 300,
};

/**
 * HIGHER_ORDER_THINKING - Problem decomposition guidance
 * Target: Layer 15 (Lessons Learned)
 */
export const HIGHER_ORDER_THINKING: MetaPromptDefinition = {
  id: 'HIGHER_ORDER_THINKING',
  name: 'Higher-Order Thinking',
  description: 'Guides structured problem decomposition and analysis',
  targetLayer: 15,
  priority: 85,
  activation: {
    type: 'state',
    states: ['planning', 'executing', 'reviewing'],
  },
  template: `## Higher-Order Thinking Framework

Apply this structured approach:

### 1. Understand
- What is the core problem or requirement?
- What are the constraints and boundaries?
- What information is missing?

### 2. Decompose
- Break complex problems into smaller, manageable parts
- Identify dependencies between parts
- Prioritize based on dependencies and impact

### 3. Reason
- Consider multiple approaches before deciding
- Evaluate trade-offs explicitly
- Document your reasoning for key decisions

### 4. Verify
- Check your work against requirements
- Consider edge cases and failure modes
- Validate assumptions with evidence`,
  maxTokens: 350,
};

/**
 * SELF_IMPROVING - Learning integration
 * Target: Layer 15 (Lessons Learned)
 */
export const SELF_IMPROVING: MetaPromptDefinition = {
  id: 'SELF_IMPROVING',
  name: 'Self-Improving Agent',
  description: 'Integrates lessons learned from previous executions',
  targetLayer: 15,
  priority: 80,
  activation: {
    type: 'context',
    contextKeys: ['lessons'],
  },
  template: `## Lessons Learned

Apply these insights from previous executions:

{{#if lessons}}
{{#each lessons}}
### {{category}}
**{{id}}**: {{content}}
{{#if appliesTo}}
(Applies to: {{appliesTo}})
{{/if}}

{{/each}}
{{else}}
No lessons captured yet. As you work:
- Note patterns that work well
- Document solutions to problems
- Flag potential improvements
{{/if}}`,
  maxTokens: 500,
};

/**
 * ROUTING_DECISION - Next-step guidance
 * Target: Layer 16 (Compliance Rules)
 */
export const ROUTING_DECISION: MetaPromptDefinition = {
  id: 'ROUTING_DECISION',
  name: 'Routing Decision Guide',
  description: 'Guides decisions about which agent should handle next steps',
  targetLayer: 16,
  priority: 90,
  activation: {
    type: 'state',
    states: ['executing', 'reviewing', 'completed'],
  },
  template: `## Routing Decision Guide

When determining next steps, consider:

### Agent Capabilities
- **orchestrator**: Task decomposition, coordination, high-level planning
- **architect**: System design, technical decisions, patterns
- **backend**: API development, data models, business logic
- **frontend**: UI components, user interactions, styling
- **ui_designer**: Design systems, UX patterns, accessibility
- **reviewer**: Code review, quality assurance, standards
- **tester**: Test creation, coverage analysis, validation
- **devops**: Deployment, infrastructure, monitoring
- **analyzer**: Data analysis, metrics, reporting

{{#if previousOutputs}}
### Previous Agent Outputs
{{#each previousOutputs}}
- **{{agentType}}**: {{summary}} ({{#if success}}Success{{else}}Failed{{/if}})
{{/each}}
{{/if}}

### Routing Hints Structure
Always include in your output:
\`\`\`json
{
  "routing_hints": {
    "suggestNext": ["agent_type"],
    "skipAgents": [],
    "needsApproval": false,
    "hasFailures": false,
    "isComplete": false,
    "blockedBy": null
  }
}
\`\`\``,
  maxTokens: 450,
};

/**
 * EXPERTISE_INJECTION - Domain knowledge
 * Target: Layer 16 (Compliance Rules)
 */
export const EXPERTISE_INJECTION: MetaPromptDefinition = {
  id: 'EXPERTISE_INJECTION',
  name: 'Expertise Injection',
  description: 'Injects domain-specific expertise relevant to the current task',
  targetLayer: 16,
  priority: 75,
  activation: {
    type: 'context',
    contextKeys: ['expertise', 'taskType'],
  },
  template: `## Domain Expertise

{{#if taskType}}
**Task Type**: {{taskType}}
{{/if}}

{{#if expertise}}
### Relevant Expertise
{{#each expertise}}
- {{this}}
{{/each}}
{{/if}}

{{#if projectContext}}
### Project Context
{{#each projectContext}}
- **{{@key}}**: {{this}}
{{/each}}
{{/if}}`,
  maxTokens: 400,
};

/**
 * REFLECTION - Output verification
 * Target: Layer 17 (Audit Requirements)
 */
export const REFLECTION: MetaPromptDefinition = {
  id: 'REFLECTION',
  name: 'Reflection and Verification',
  description: 'Prompts self-verification before finalizing outputs',
  targetLayer: 17,
  priority: 70,
  activation: {
    type: 'state',
    states: ['executing', 'reviewing'],
  },
  template: `## Pre-Output Reflection

Before finalizing your response, verify:

### Completeness Check
- [ ] All requirements addressed
- [ ] Edge cases considered
- [ ] Error handling included
- [ ] Documentation provided where needed

### Quality Check
- [ ] Code follows project conventions
- [ ] No security vulnerabilities introduced
- [ ] Performance considerations addressed
- [ ] Accessibility requirements met (if UI)

### Integration Check
- [ ] Compatible with existing codebase
- [ ] Dependencies properly declared
- [ ] Breaking changes documented
- [ ] Tests cover new functionality

### Routing Check
- [ ] routing_hints accurately reflect state
- [ ] Next agent suggestions are appropriate
- [ ] Blockers clearly communicated`,
  maxTokens: 350,
};

/**
 * SYNTHESIS - Multi-output coordination
 * Target: Layer 18 (Self-Reflection)
 */
export const SYNTHESIS: MetaPromptDefinition = {
  id: 'SYNTHESIS',
  name: 'Output Synthesis',
  description:
    'Guides synthesis of outputs when multiple agents have contributed',
  targetLayer: 18,
  priority: 65,
  activation: {
    type: 'context',
    contextKeys: ['previousOutputs'],
  },
  template: `## Output Synthesis

{{#if previousOutputs}}
### Integrating Previous Work

Multiple agents have contributed to this task:

{{#each previousOutputs}}
#### {{agentType}} Output
- Status: {{#if success}}Successful{{else}}Failed{{/if}}
- Summary: {{summary}}
{{#if timestamp}}
- Completed: {{timestamp}}
{{/if}}

{{/each}}

### Synthesis Guidelines
1. Build upon successful outputs, don't duplicate work
2. Address any failures or gaps from previous agents
3. Ensure consistency across all contributions
4. Resolve any conflicts between agent outputs
5. Provide a unified, coherent result
{{else}}
You are the first agent on this task. Establish a clear foundation for subsequent agents.
{{/if}}`,
  maxTokens: 400,
};

/**
 * All meta-prompts in the library
 */
export const META_PROMPT_LIBRARY: readonly MetaPromptDefinition[] = [
  SYSTEM_IDENTITY,
  CONSTITUTIONAL,
  HIGHER_ORDER_THINKING,
  SELF_IMPROVING,
  ROUTING_DECISION,
  EXPERTISE_INJECTION,
  REFLECTION,
  SYNTHESIS,
] as const;

/**
 * Get meta-prompt by ID
 */
export function getMetaPromptById(
  id: string
): MetaPromptDefinition | undefined {
  return META_PROMPT_LIBRARY.find((mp) => mp.id === id);
}

/**
 * Get meta-prompts by target layer
 */
export function getMetaPromptsByLayer(layer: number): MetaPromptDefinition[] {
  return META_PROMPT_LIBRARY.filter((mp) => mp.targetLayer === layer);
}

/**
 * Get meta-prompts sorted by priority (descending)
 */
export function getMetaPromptsByPriority(): MetaPromptDefinition[] {
  return [...META_PROMPT_LIBRARY].sort((a, b) => b.priority - a.priority);
}

/**
 * Get always-active meta-prompts
 */
export function getAlwaysActiveMetaPrompts(): MetaPromptDefinition[] {
  return META_PROMPT_LIBRARY.filter((mp) => mp.activation.type === 'always');
}

/**
 * Get total max tokens for all meta-prompts
 */
export function getTotalMaxTokens(): number {
  return META_PROMPT_LIBRARY.reduce((sum, mp) => sum + mp.maxTokens, 0);
}
