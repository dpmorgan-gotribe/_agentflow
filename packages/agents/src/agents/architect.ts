/**
 * Architect Agent
 *
 * Makes technical decisions and designs system architecture.
 * Creates ADRs, defines tech stack, and establishes coding conventions.
 *
 * SECURITY:
 * - Validates all output structures
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
  ArchitectOutput,
  ADR,
  Component,
  DirectoryStructure,
  CodingConventions,
} from '../schemas/architect-output.js';
import { ArchitectOutputSchema } from '../schemas/architect-output.js';
import {
  ADRManager,
  renderDirectoryStructure,
  renderCodingConventions,
} from '../architecture/adr-manager.js';

/**
 * Architect Agent implementation
 *
 * Capabilities:
 * - tech-stack-selection: Select appropriate technologies
 * - architecture-design: Design system architecture
 * - adr-creation: Create architecture decision records
 */
export class ArchitectAgent extends BaseAgent {
  constructor() {
    const metadata: AgentMetadata = {
      id: AgentTypeEnum.ARCHITECT,
      name: 'Architect',
      description: 'Makes technical decisions and designs system architecture',
      version: '1.0.0',
      capabilities: [
        {
          name: 'tech-stack-selection',
          description: 'Select appropriate technologies for the project',
          inputTypes: ['requirements', 'constraints'],
          outputTypes: ['tech-stack', 'json'],
        },
        {
          name: 'architecture-design',
          description: 'Design system architecture and components',
          inputTypes: ['requirements', 'tech-stack'],
          outputTypes: ['architecture', 'json'],
        },
        {
          name: 'adr-creation',
          description: 'Create architecture decision records',
          inputTypes: ['decision', 'context'],
          outputTypes: ['adr', 'markdown'],
        },
      ],
      requiredContext: [{ type: ContextTypeEnum.CURRENT_TASK, required: true }],
      outputSchema: 'architect-output',
    };

    super(metadata);
  }

  /**
   * Build system prompt for architecture design
   */
  protected buildSystemPrompt(context: AgentContext): string {
    return `You are the Architect agent responsible for technical decisions and system design.

Your responsibilities:
1. Select appropriate technologies based on requirements
2. Design system architecture and component structure
3. Create Architecture Decision Records (ADRs) for significant decisions
4. Define API contracts and data models
5. Establish coding conventions and patterns
6. Consider security, scalability, and maintainability

When making technology choices:
- Consider the team's expertise (prefer mainstream technologies)
- Evaluate maintenance burden
- Consider community support and documentation
- Balance innovation with stability
- Prefer TypeScript, Node.js ecosystem unless requirements specify otherwise

For each significant decision, create an ADR with:
- Context: Why is this decision needed?
- Decision: What is being decided?
- Consequences: What are the positive, negative, and risks?
- Alternatives: What other options were considered?

ADR IDs must be in format ADR-0001, ADR-0002, etc.
Component paths must be valid directory paths.
API paths must start with /.
${this.getStructuredOutputInstruction()}

REQUIRED OUTPUT SCHEMA:
{
  "techStack": {
    "frontend": { "framework": {...}, "language": {...}, "styling": {...} },
    "backend": { "framework": {...}, "language": {...} },
    "database": { "primary": {...} },
    "testing": { "unit": {...} }
  },
  "adrs": [
    {
      "id": "ADR-0001",
      "title": "Title",
      "status": "proposed",
      "date": "YYYY-MM-DD",
      "context": "...",
      "decision": "...",
      "consequences": { "positive": [], "negative": [], "risks": [] },
      "alternatives": [{ "option": "...", "pros": [], "cons": [] }],
      "relatedADRs": []
    }
  ],
  "components": [...],
  "directoryStructure": { "path": "src", "description": "...", "children": [...] },
  "codingConventions": {...},
  "securityConsiderations": [...],
  "scalabilityNotes": [...],
  "routingHints": {...}
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

    let prompt = `Design the architecture for this project:\n\n`;
    prompt += `REQUIREMENTS:\n`;

    // Include task description or full task details
    if (typeof task === 'object' && 'description' in task) {
      prompt += `${(task as { description?: string }).description || JSON.stringify(task)}\n\n`;
    } else {
      prompt += `${JSON.stringify(task, null, 2)}\n\n`;
    }

    // Include project context if available
    if (projectConfig?.content) {
      prompt += `EXISTING PROJECT CONTEXT:\n${JSON.stringify(projectConfig.content, null, 2)}\n\n`;
    }

    // Include work breakdown from PM if available
    const previousOutputs = request.context.previousOutputs;
    for (const output of previousOutputs) {
      if (typeof output === 'object' && output !== null) {
        const typedOutput = output as { agentId?: string; result?: unknown };
        if (typedOutput.agentId === AgentTypeEnum.PROJECT_MANAGER && typedOutput.result) {
          prompt += `WORK BREAKDOWN FROM PROJECT MANAGER:\n`;
          prompt += `${JSON.stringify(typedOutput.result, null, 2)}\n\n`;
          break;
        }
      }
    }

    prompt += `Provide a complete architecture design including:
1. Tech stack with reasoning for each choice
2. ADRs for significant decisions (minimum 1-2)
3. Component structure with responsibilities
4. Directory structure
5. Coding conventions
6. Security considerations
7. Scalability notes

Include API endpoints and data models if the project requires them.`;

    return prompt;
  }

  /**
   * Parse LLM response into ArchitectOutput
   */
  protected parseResponse(response: AIProviderResponse): ArchitectOutput {
    const text = this.extractTextContent(response);

    // Try to parse as JSON
    const parsed = this.parseJSON<ArchitectOutput>(text);

    // Validate with Zod schema
    return ArchitectOutputSchema.parse(parsed);
  }

  /**
   * Process parsed result: create artifacts from architecture
   */
  protected async processResult(
    parsed: ArchitectOutput,
    request: AgentRequest
  ): Promise<{ result: ArchitectOutput; artifacts: Artifact[] }> {
    const artifacts: Artifact[] = [];

    // Create tech stack artifact
    artifacts.push({
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.CONFIG_FILE,
      path: 'architecture/tech-stack.json',
      content: JSON.stringify(parsed.techStack, null, 2),
      metadata: {
        type: 'tech-stack',
        hasFrontend: !!parsed.techStack.frontend,
        hasBackend: !!parsed.techStack.backend,
        hasDatabase: !!parsed.techStack.database,
      },
    });

    // Create ADR artifacts using ADRManager
    const adrManager = new ADRManager(parsed.adrs);
    for (const adr of parsed.adrs) {
      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.DOCUMENTATION,
        path: adrManager.generatePath(adr),
        content: adrManager.renderMarkdown(adr),
        metadata: {
          type: 'adr',
          adrId: adr.id,
          adrStatus: adr.status,
        },
      });
    }

    // Create directory structure artifact
    artifacts.push({
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.DOCUMENTATION,
      path: 'architecture/directory-structure.md',
      content: this.renderDirectoryStructureDoc(parsed.directoryStructure),
      metadata: { type: 'directory-structure' },
    });

    // Create coding conventions artifact
    artifacts.push({
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.DOCUMENTATION,
      path: 'docs/CONVENTIONS.md',
      content: renderCodingConventions(parsed.codingConventions),
      metadata: { type: 'conventions' },
    });

    // Create components artifact
    if (parsed.components.length > 0) {
      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.DOCUMENTATION,
        path: 'architecture/components.json',
        content: JSON.stringify(parsed.components, null, 2),
        metadata: {
          type: 'components',
          count: parsed.components.length,
        },
      });
    }

    // Create API spec if present
    if (parsed.apiEndpoints && parsed.apiEndpoints.length > 0) {
      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.DOCUMENTATION,
        path: 'docs/api/endpoints.json',
        content: JSON.stringify(parsed.apiEndpoints, null, 2),
        metadata: {
          type: 'api-spec',
          endpointCount: parsed.apiEndpoints.length,
        },
      });
    }

    // Create data models if present
    if (parsed.dataModels && parsed.dataModels.length > 0) {
      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.DOCUMENTATION,
        path: 'docs/database/models.json',
        content: JSON.stringify(parsed.dataModels, null, 2),
        metadata: {
          type: 'data-models',
          modelCount: parsed.dataModels.length,
        },
      });
    }

    // Create security considerations artifact
    if (parsed.securityConsiderations.length > 0) {
      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.DOCUMENTATION,
        path: 'docs/SECURITY.md',
        content: this.renderSecurityDoc(parsed.securityConsiderations),
        metadata: { type: 'security' },
      });
    }

    this.log('info', 'Architecture design complete', {
      adrs: parsed.adrs.length,
      components: parsed.components.length,
      apiEndpoints: parsed.apiEndpoints?.length || 0,
      dataModels: parsed.dataModels?.length || 0,
      tenantId: request.context.tenantId,
    });

    return {
      result: parsed,
      artifacts,
    };
  }

  /**
   * Generate routing hints based on architecture
   */
  protected generateRoutingHints(
    result: unknown,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    const output = result as ArchitectOutput;
    const suggestNext: (typeof AgentTypeEnum)[keyof typeof AgentTypeEnum][] = [];

    // If there are frontend components, suggest UI designer
    const hasFrontend =
      output.techStack.frontend ||
      output.components.some(
        (c) => c.type === 'component' || c.location.includes('frontend')
      );
    if (hasFrontend) {
      suggestNext.push(AgentTypeEnum.UI_DESIGNER);
    }

    // If there are security considerations, suggest compliance
    if (output.securityConsiderations.length > 0) {
      suggestNext.push(AgentTypeEnum.COMPLIANCE_AGENT);
    }

    // If there are backend components, suggest backend dev
    const hasBackend =
      output.techStack.backend ||
      output.components.some(
        (c) => c.type === 'service' || c.location.includes('backend')
      );
    if (hasBackend && !suggestNext.includes(AgentTypeEnum.BACKEND_DEV)) {
      suggestNext.push(AgentTypeEnum.BACKEND_DEV);
    }

    // If no specific needs identified, suggest analyzer for research
    if (suggestNext.length === 0) {
      suggestNext.push(AgentTypeEnum.ANALYZER);
    }

    return {
      suggestNext,
      skipAgents: [],
      needsApproval: true, // Architecture should be approved before implementation
      hasFailures: false,
      isComplete: false,
      notes: `Created ${output.adrs.length} ADRs, defined ${output.components.length} components`,
    };
  }

  /**
   * Render directory structure as markdown document
   */
  private renderDirectoryStructureDoc(structure: DirectoryStructure): string {
    const lines: string[] = [];

    lines.push('# Directory Structure');
    lines.push('');
    lines.push('```');
    lines.push(renderDirectoryStructure(structure));
    lines.push('```');

    return lines.join('\n');
  }

  /**
   * Render security considerations as markdown
   */
  private renderSecurityDoc(considerations: string[]): string {
    const lines: string[] = [];

    lines.push('# Security Considerations');
    lines.push('');
    lines.push('This document outlines security considerations for the project.');
    lines.push('');

    for (let i = 0; i < considerations.length; i++) {
      lines.push(`## ${i + 1}. ${this.extractSecurityTitle(considerations[i]!)}`);
      lines.push('');
      lines.push(considerations[i]!);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Extract a title from a security consideration
   */
  private extractSecurityTitle(consideration: string): string {
    // Try to get first sentence or first 50 chars
    const firstSentence = consideration.split('.')[0];
    if (firstSentence && firstSentence.length <= 60) {
      return firstSentence;
    }
    return consideration.substring(0, 50) + '...';
  }
}
