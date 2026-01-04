/**
 * Analyst Agent
 *
 * Provides research and best practices recommendations.
 * Investigates questions, compares options, and cites sources.
 *
 * Extended for design workflow:
 * - Style research: Extract style hints, generate 5 style packages
 * - Component inventory: Identify all UI components needed
 * - User flows: Map user journeys through the application
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
  TaskAnalysis,
} from '../types.js';
import { AgentTypeEnum, ContextTypeEnum, ArtifactTypeEnum } from '../types.js';
import type {
  AnalystOutput,
  ReportType,
  Source,
  ComparisonOption,
  BestPractice,
  Finding,
} from '../schemas/analyst-output.js';
import { AnalystOutputSchema, calculateAverageConfidence } from '../schemas/analyst-output.js';
import type {
  StyleResearchOutput,
  PromptStyleAnalysis,
} from '../schemas/analyst-style-output.js';
import {
  StyleResearchOutputSchema,
  extractStyleHintsFromPrompt,
  createEmptyPromptAnalysis,
  createEmptyStyleConstraints,
} from '../schemas/analyst-style-output.js';
import {
  writeArtifactFile,
  hasOutputDir,
  type FileWriteResult,
} from '../utils/file-writer.js';

/**
 * File paths returned by style research for state extraction
 *
 * These paths are used by the execute node to populate state channels
 * for the file-based context pattern.
 */
export interface StyleResearchPaths {
  /** Paths to individual style package JSON files */
  stylePackagePaths: string[];
  /** Path to component inventory JSON file */
  componentInventoryPath: string;
  /** Path to screens JSON file */
  screensPath: string;
  /** Path to user flows JSON file */
  userFlowsPath: string;
}

/**
 * Analyst Agent implementation
 *
 * Capabilities:
 * - technology-comparison: Compare and evaluate technologies
 * - best-practices-research: Research best practices
 * - feasibility-analysis: Analyze feasibility of approaches
 */
export class AnalystAgent extends BaseAgent {
  constructor() {
    const metadata: AgentMetadata = {
      id: AgentTypeEnum.ANALYZER,
      name: 'Analyst',
      description: 'Provides research and best practices recommendations',
      version: '1.0.0',
      capabilities: [
        {
          name: 'technology-comparison',
          description: 'Compare and evaluate technologies, libraries, and frameworks',
          inputTypes: ['question', 'requirements'],
          outputTypes: ['comparison-report', 'json'],
        },
        {
          name: 'best-practices-research',
          description: 'Research best practices for technologies and patterns',
          inputTypes: ['topic', 'question'],
          outputTypes: ['best-practices-report', 'json'],
        },
        {
          name: 'feasibility-analysis',
          description: 'Analyze feasibility of proposed approaches',
          inputTypes: ['proposal', 'constraints'],
          outputTypes: ['feasibility-report', 'json'],
        },
        {
          name: 'style-research',
          description: 'Research styles, generate 5 style packages, and create component inventory for design workflow',
          inputTypes: ['prompt', 'design-requirements'],
          outputTypes: ['style-packages', 'component-inventory', 'user-flows', 'screens'],
        },
      ],
      requiredContext: [{ type: ContextTypeEnum.CURRENT_TASK, required: true }],
      outputSchema: 'analyst-output',
    };

    super(metadata);
  }

  /**
   * Build system prompt for research
   */
  protected buildSystemPrompt(context: AgentContext): string {
    // Check if this is a style research task by looking at the prompt in context
    const currentTask = context.items.find((i) => i.type === ContextTypeEnum.CURRENT_TASK);
    if (currentTask) {
      const taskDescription = this.extractTaskDescription(currentTask.content);
      const reportType = this.determineReportTypeFromPrompt(taskDescription);
      if (reportType === 'style_research') {
        return this.buildStyleResearchSystemPrompt();
      }
    }

    return `You are the Analyst agent responsible for research and recommendations.

Your responsibilities:
1. Research best practices for technologies and patterns
2. Compare and evaluate libraries, frameworks, and approaches
3. Investigate specific technical questions
4. Provide well-reasoned recommendations with confidence levels
5. Cite sources and documentation

Guidelines:
- Always cite sources for claims (documentation, articles, GitHub, etc.)
- Present multiple options when applicable
- Be explicit about confidence levels (0.0 to 1.0)
- Don't make implementation decisions - only recommend
- Acknowledge limitations and gaps in knowledge
- Distinguish between official documentation and community sources

Report Types:
- comparison: When comparing multiple options (detect: "compare", "vs", "versus")
- best_practices: When researching how to do something (detect: "best practice", "how to")
- investigation: When answering specific questions
- recommendation: When advising on a decision (detect: "should we", "which")
- feasibility: When assessing if something is possible (detect: "feasible", "can we")

Source Credibility:
- official: Official documentation, vendor sources
- community: Blog posts, tutorials, community guides
- expert: Expert opinions, conference talks, books
- unknown: Source credibility cannot be determined

Confidence Levels:
- 0.9-1.0: High confidence, well-documented, widely agreed upon
- 0.7-0.9: Good confidence, some variation in opinions
- 0.5-0.7: Moderate confidence, limited sources or mixed opinions
- 0.0-0.5: Low confidence, speculative or unverified

Output must be valid JSON matching this structure:
{
  "reportType": "comparison|best_practices|investigation|recommendation|feasibility",
  "question": "The research question",
  "executiveSummary": "2-3 sentence summary",
  "comparison": { ... } // if reportType is comparison
  "bestPractices": [...] // if reportType is best_practices
  "findings": [...] // if reportType is investigation
  "recommendation": {
    "recommendation": "Primary recommendation",
    "reasoning": "Detailed reasoning",
    "confidence": 0.85,
    "alternatives": [{ "option": "...", "whenToUse": "..." }],
    "implementation": { "steps": [...], "estimatedEffort": "...", "risks": [...] }
  },
  "sources": [{ "title": "...", "url": "...", "type": "...", "credibility": "..." }],
  "limitations": ["Limitation 1", "Limitation 2"],
  "furtherResearch": ["Question 1", "Question 2"],
  "routingHints": { ... }
}`;
  }

  /**
   * Build user prompt with request details
   */
  protected buildUserPrompt(request: AgentRequest): string {
    const contextItems = request.context.items;

    // Get the original user prompt from context (not the TaskAnalysis)
    const userPrompt = this.getPromptFromContext(request);

    // Determine report type from the user prompt
    const reportType = this.determineReportTypeFromPrompt(userPrompt);

    // Use style research prompt if appropriate
    if (reportType === 'style_research') {
      return this.buildStyleResearchUserPrompt(request);
    }

    let prompt = `Research Question: ${userPrompt}\n\n`;
    prompt += `Report Type: ${reportType}\n\n`;

    // Include project context if available
    const projectConfig = contextItems.find(
      (i) => i.type === ContextTypeEnum.PROJECT_CONFIG
    );
    if (projectConfig?.content) {
      prompt += `Project Context:\n${JSON.stringify(projectConfig.content, null, 2)}\n\n`;
    }

    // Include any previous agent outputs as context
    const previousOutputs = request.context.previousOutputs;
    if (previousOutputs.length > 0) {
      prompt += `Previous Agent Outputs:\n`;
      for (const output of previousOutputs) {
        if (typeof output === 'object' && output !== null) {
          const typedOutput = output as { agentId?: string; success?: boolean };
          prompt += `- ${typedOutput.agentId || 'unknown'}: ${typedOutput.success ? 'success' : 'failed'}\n`;
        }
      }
      prompt += '\n';
    }

    prompt += `Provide a comprehensive analysis with:\n`;
    prompt += `- Executive summary (2-3 sentences)\n`;
    prompt += `- Detailed findings with evidence\n`;
    prompt += `- Clear recommendation with confidence level (0.0-1.0)\n`;
    prompt += `- Cited sources with credibility ratings\n`;
    prompt += `- Limitations of this analysis\n`;
    prompt += `- Suggestions for further research\n`;

    return prompt;
  }

  /**
   * Parse LLM response into AnalystOutput
   *
   * Note: For style_research, we parse as StyleResearchOutput and wrap it
   */
  protected parseResponse(response: AIProviderResponse): AnalystOutput {
    const text = this.extractTextContent(response);

    // Try to parse as JSON
    const parsed = this.parseJSON<Record<string, unknown>>(text);

    // Check if this is a style research response by looking for stylePackages
    if (parsed && 'stylePackages' in parsed) {
      // Parse as StyleResearchOutput
      const styleOutput = StyleResearchOutputSchema.parse(parsed);

      // Wrap in AnalystOutput format for compatibility
      return {
        reportType: 'style_research',
        question: `Design research for ${styleOutput.domainResearch.appCategory}`,
        executiveSummary: styleOutput.summary,
        styleResearch: styleOutput,
        recommendation: {
          recommendation: `Proceed with style competition using the 5 generated style packages`,
          reasoning: `Style research complete with ${styleOutput.stylePackages.length} packages, ${styleOutput.screens.length} screens, and ${styleOutput.componentInventory.totalCount} components identified.`,
          confidence: styleOutput.confidence,
          alternatives: [],
        },
        sources: styleOutput.domainResearch.competitors.map((c) => ({
          title: c.name,
          url: c.url,
          type: 'other' as const,
          credibility: 'community' as const,
        })),
        limitations: [],
        furtherResearch: [],
        routingHints: {
          suggestNext: [AgentTypeEnum.ARCHITECT],
          skipAgents: [],
          needsApproval: false,
          hasFailures: false,
          isComplete: false,
          needsUserDecision: false,
        },
      };
    }

    // Standard analyst output
    return AnalystOutputSchema.parse(parsed);
  }

  /**
   * Process parsed result: create research report artifact
   */
  protected async processResult(
    parsed: AnalystOutput,
    request: AgentRequest
  ): Promise<{ result: AnalystOutput; artifacts: Artifact[] }> {
    // Handle style research separately
    if (parsed.reportType === 'style_research' && parsed.styleResearch) {
      const styleResult = await this.processStyleResearchResult(parsed.styleResearch, request);
      return {
        result: parsed,
        artifacts: styleResult.artifacts,
      };
    }

    const artifacts: Artifact[] = [];

    // Create research report artifact
    const filename = this.slugify(parsed.question);
    artifacts.push({
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.REPORT,
      path: `research/${filename}.md`,
      content: this.renderReport(parsed),
      metadata: {
        reportType: parsed.reportType,
        confidence: parsed.recommendation?.confidence ?? 0,
        sourcesCount: parsed.sources.length,
        officialSources: parsed.sources.filter((s) => s.credibility === 'official').length,
      },
    });

    // Create JSON data artifact for programmatic access
    artifacts.push({
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.REPORT,
      path: `research/${filename}.json`,
      content: JSON.stringify(parsed, null, 2),
      metadata: {
        reportType: parsed.reportType,
        format: 'json',
      },
    });

    this.log('info', 'Research complete', {
      reportType: parsed.reportType,
      confidence: parsed.recommendation?.confidence ?? 0,
      sources: parsed.sources.length,
      tenantId: request.context.tenantId,
    });

    return {
      result: parsed,
      artifacts,
    };
  }

  /**
   * Generate routing hints based on research results
   */
  protected generateRoutingHints(
    result: unknown,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    const output = result as AnalystOutput;

    // Handle style research routing hints
    if (output.reportType === 'style_research' && output.styleResearch) {
      return this.generateStyleResearchRoutingHints(output.styleResearch, artifacts);
    }

    // Use routing hints from the output if available
    const suggestNext: (typeof AgentTypeEnum)[keyof typeof AgentTypeEnum][] = [];

    // Map the agent types from output
    for (const agentType of output.routingHints.suggestNext) {
      if (Object.values(AgentTypeEnum).includes(agentType as typeof AgentTypeEnum[keyof typeof AgentTypeEnum])) {
        suggestNext.push(agentType as typeof AgentTypeEnum[keyof typeof AgentTypeEnum]);
      }
    }

    // If no suggestions, default based on report type
    if (suggestNext.length === 0) {
      if (output.reportType === 'comparison' || output.reportType === 'recommendation') {
        suggestNext.push(AgentTypeEnum.ARCHITECT);
      } else {
        suggestNext.push(AgentTypeEnum.PROJECT_MANAGER);
      }
    }

    return {
      suggestNext,
      skipAgents: [],
      needsApproval: output.routingHints.needsUserDecision,
      hasFailures: false,
      isComplete: output.routingHints.isComplete,
      notes: `Research complete with ${Math.round((output.recommendation?.confidence ?? 0) * 100)}% confidence. ${output.sources.length} sources cited.`,
    };
  }

  /**
   * Determine report type from user prompt string
   */
  private determineReportTypeFromPrompt(promptText: string): ReportType {
    const description = promptText.toLowerCase();
    return this.determineReportTypeFromDescription(description);
  }

  /**
   * Determine report type from task (legacy, uses TaskAnalysis)
   */
  private determineReportType(task: TaskAnalysis): ReportType {
    const description = this.getTaskDescription(task).toLowerCase();
    return this.determineReportTypeFromDescription(description);
  }

  /**
   * Determine report type from description text
   */
  private determineReportTypeFromDescription(description: string): ReportType {
    // Style research detection (design workflow)
    if (
      description.includes('design') ||
      description.includes('style') ||
      description.includes('ui') ||
      description.includes('interface') ||
      description.includes('mockup') ||
      description.includes('visual') ||
      description.includes('website') ||
      description.includes('app') ||
      description.includes('application') ||
      description.includes('dashboard') ||
      description.includes('landing page') ||
      this.hasStyleHints(description)
    ) {
      return 'style_research';
    }

    if (
      description.includes('compare') ||
      description.includes(' vs ') ||
      description.includes('versus') ||
      description.includes('difference between')
    ) {
      return 'comparison';
    }

    if (
      description.includes('best practice') ||
      description.includes('how to') ||
      description.includes('how should') ||
      description.includes('recommended way')
    ) {
      return 'best_practices';
    }

    if (
      description.includes('feasible') ||
      description.includes('possible') ||
      description.includes('can we') ||
      description.includes('is it possible')
    ) {
      return 'feasibility';
    }

    if (
      description.includes('recommend') ||
      description.includes('should we') ||
      description.includes('which') ||
      description.includes('what should')
    ) {
      return 'recommendation';
    }

    return 'investigation';
  }

  /**
   * Check if description contains style hints (colors, fonts, inspiration URLs)
   */
  private hasStyleHints(description: string): boolean {
    const hints = extractStyleHintsFromPrompt(description);
    return (
      (hints.colors?.length ?? 0) > 0 ||
      (hints.fonts?.length ?? 0) > 0 ||
      (hints.inspirationUrls?.length ?? 0) > 0 ||
      (hints.moodKeywords?.length ?? 0) > 0
    );
  }

  /**
   * Get task description string from TaskAnalysis (fallback method)
   */
  private getTaskDescription(task: TaskAnalysis): string {
    if (typeof task === 'object' && 'description' in task) {
      return (task as { description?: string }).description || JSON.stringify(task);
    }
    return JSON.stringify(task);
  }

  /**
   * Get the original user prompt from context items
   *
   * This is the correct way to get the user's prompt - from the CURRENT_TASK
   * context item, not from the TaskAnalysis object.
   */
  private getPromptFromContext(request: AgentRequest): string {
    // Look for CURRENT_TASK context item which contains the original prompt
    const currentTask = request.context.items.find(
      (item) => item.type === ContextTypeEnum.CURRENT_TASK
    );

    if (currentTask?.content) {
      const content = currentTask.content as Record<string, unknown>;
      // The prompt is stored in the content['prompt'] field by the agent-adapter
      const promptValue = content['prompt'];
      if (typeof promptValue === 'string' && promptValue.length > 0) {
        return promptValue;
      }
    }

    // Fallback to getTaskDescription if no prompt found (should not happen)
    this.log('warn', 'No prompt found in CURRENT_TASK context, falling back to task description');
    return this.getTaskDescription(request.task);
  }

  /**
   * Get style package count from workflow settings
   *
   * Reads the stylePackageCount from WORKFLOW_SETTINGS context item.
   * Defaults to 1 if not found (single style, no competition).
   */
  private getStylePackageCount(request: AgentRequest): number {
    const settingsItem = request.context.items.find(
      (item) => item.type === ContextTypeEnum.WORKFLOW_SETTINGS
    );

    if (settingsItem?.content) {
      const settings = settingsItem.content as Record<string, unknown>;
      const count = settings['stylePackageCount'];
      if (typeof count === 'number' && count >= 1 && count <= 10) {
        this.log('debug', `Using stylePackageCount from settings: ${count}`);
        return count;
      }
    }

    this.log('debug', 'No stylePackageCount in settings, defaulting to 1');
    return 1;
  }

  /**
   * Render report as markdown
   */
  private renderReport(output: AnalystOutput): string {
    const lines: string[] = [];

    lines.push(`# Research Report: ${output.question}`);
    lines.push('');
    lines.push(`**Report Type:** ${output.reportType}`);
    lines.push(
      `**Confidence:** ${Math.round((output.recommendation?.confidence ?? 0) * 100)}%`
    );
    lines.push(`**Sources:** ${output.sources.length}`);
    lines.push('');

    lines.push('## Executive Summary');
    lines.push('');
    lines.push(output.executiveSummary);
    lines.push('');

    // Comparison section
    if (output.comparison && output.comparison.options.length > 0) {
      lines.push('## Comparison');
      lines.push('');

      if (output.comparison.criteria.length > 0) {
        lines.push('**Evaluation Criteria:**');
        for (const criterion of output.comparison.criteria) {
          lines.push(`- ${criterion}`);
        }
        lines.push('');
      }

      for (const option of output.comparison.options) {
        lines.push(`### ${option.name}`);
        lines.push('');
        lines.push(option.description);
        lines.push('');

        lines.push('| Attribute | Value |');
        lines.push('|-----------|-------|');
        lines.push(`| Popularity | ${option.popularity} |`);
        lines.push(`| Maintenance | ${option.maintenance} |`);
        lines.push(`| Learning Curve | ${option.learningCurve} |`);
        lines.push(`| Community | ${option.communitySize} |`);
        if (option.score !== undefined) {
          lines.push(`| Score | ${option.score}/100 |`);
        }
        lines.push('');

        if (option.pros.length > 0) {
          lines.push('**Pros:**');
          for (const p of option.pros) {
            lines.push(`- ✅ ${p}`);
          }
          lines.push('');
        }

        if (option.cons.length > 0) {
          lines.push('**Cons:**');
          for (const c of option.cons) {
            lines.push(`- ❌ ${c}`);
          }
          lines.push('');
        }

        if (option.useCases.length > 0) {
          lines.push('**Best For:**');
          for (const uc of option.useCases) {
            lines.push(`- ${uc}`);
          }
          lines.push('');
        }
      }

      if (output.comparison.winner) {
        lines.push(`**Winner:** ${output.comparison.winner}`);
        lines.push('');
      }
    }

    // Best practices section
    if (output.bestPractices && output.bestPractices.length > 0) {
      lines.push('## Best Practices');
      lines.push('');
      for (const practice of output.bestPractices) {
        lines.push(`### ${practice.title}`);
        lines.push('');
        lines.push(practice.description);
        lines.push('');
        lines.push(`**Rationale:** ${practice.rationale}`);
        lines.push('');

        if (practice.example) {
          lines.push('**Example:**');
          lines.push('```typescript');
          lines.push(practice.example);
          lines.push('```');
          lines.push('');
        }

        if (practice.caveats.length > 0) {
          lines.push('**Caveats:**');
          for (const caveat of practice.caveats) {
            lines.push(`- ⚠️ ${caveat}`);
          }
          lines.push('');
        }
      }
    }

    // Findings section
    if (output.findings && output.findings.length > 0) {
      lines.push('## Findings');
      lines.push('');
      for (const finding of output.findings) {
        lines.push(`### ${finding.topic}`);
        lines.push('');
        lines.push(`**Summary:** ${finding.summary}`);
        lines.push('');
        lines.push(finding.details);
        lines.push('');

        if (finding.evidence.length > 0) {
          lines.push('**Evidence:**');
          for (const evidence of finding.evidence) {
            lines.push(`- ${evidence}`);
          }
          lines.push('');
        }

        lines.push(
          `**Confidence:** ${Math.round(finding.confidence * 100)}%`
        );
        lines.push('');
      }
    }

    // Recommendation section
    if (output.recommendation) {
      lines.push('## Recommendation');
      lines.push('');
      lines.push(output.recommendation.recommendation);
      lines.push('');
      lines.push('**Reasoning:**');
      lines.push('');
      lines.push(output.recommendation.reasoning);
      lines.push('');

      if (output.recommendation.alternatives.length > 0) {
        lines.push('**Alternatives:**');
        lines.push('');
        for (const alt of output.recommendation.alternatives) {
          lines.push(`- **${alt.option}:** ${alt.whenToUse}`);
        }
        lines.push('');
      }

      if (output.recommendation.implementation) {
        lines.push('**Implementation:**');
        lines.push('');
        lines.push(
          `Estimated Effort: ${output.recommendation.implementation.estimatedEffort}`
        );
        lines.push('');
        lines.push('Steps:');
        for (let i = 0; i < output.recommendation.implementation.steps.length; i++) {
          lines.push(`${i + 1}. ${output.recommendation.implementation.steps[i]}`);
        }
        lines.push('');

        if (output.recommendation.implementation.risks.length > 0) {
          lines.push('Risks:');
          for (const risk of output.recommendation.implementation.risks) {
            lines.push(`- ⚠️ ${risk}`);
          }
          lines.push('');
        }
      }
    }

    // Sources section
    lines.push('## Sources');
    lines.push('');
    for (const source of output.sources) {
      const credBadge = this.getCredibilityBadge(source.credibility);
      const url = source.url ? ` - [Link](${source.url})` : '';
      const date = source.date ? ` (${source.date})` : '';
      lines.push(`- ${credBadge} **${source.title}**${url}${date}`);
    }
    lines.push('');

    // Limitations section
    if (output.limitations.length > 0) {
      lines.push('## Limitations');
      lines.push('');
      for (const limitation of output.limitations) {
        lines.push(`- ${limitation}`);
      }
      lines.push('');
    }

    // Further research section
    if (output.furtherResearch.length > 0) {
      lines.push('## Further Research');
      lines.push('');
      for (const question of output.furtherResearch) {
        lines.push(`- ${question}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get credibility badge for source
   */
  private getCredibilityBadge(credibility: string): string {
    switch (credibility) {
      case 'official':
        return '📚';
      case 'expert':
        return '🎓';
      case 'community':
        return '👥';
      default:
        return '❓';
    }
  }

  /**
   * Slugify string for filename
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  /**
   * Extract task description from context content
   */
  private extractTaskDescription(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }
    if (typeof content === 'object' && content !== null) {
      const obj = content as Record<string, unknown>;
      if (typeof obj['description'] === 'string') {
        return obj['description'];
      }
      if (typeof obj['prompt'] === 'string') {
        return obj['prompt'];
      }
      return JSON.stringify(content);
    }
    return '';
  }

  // ============================================================
  // STYLE RESEARCH METHODS (Design Workflow)
  // ============================================================

  /**
   * Build system prompt for style research (design workflow)
   */
  private buildStyleResearchSystemPrompt(): string {
    return `You are the Analyst agent conducting style research for a design workflow.

Your responsibilities:
1. Extract and analyze style hints from the user's prompt (colors, fonts, inspiration URLs, mood keywords)
2. Research the domain and identify relevant competitors
3. Identify ALL screens and user flows the application needs
4. Create a comprehensive component inventory (navigation, forms, data display, feedback, etc.)
5. Generate EXACTLY 5 distinct style packages that honor user hints

## Style Hints Extraction

Look for explicit and implicit style signals:
- Colors mentioned (e.g., "blue", "dark theme", "#FF5733", "warm colors")
- Fonts mentioned (e.g., "modern sans-serif", "Inter", "professional look")
- Inspiration URLs (any URLs that might be design references)
- Mood keywords (e.g., "minimal", "bold", "elegant", "playful", "professional")
- Platform hints (e.g., "iOS style", "Material Design", "web app")
- Audience hints (e.g., "enterprise", "consumer", "B2B", "millennials")

## Screen & User Flow Identification

For any application request, identify:
- All screens the application needs (list, detail, form, settings, auth, etc.)
- Critical user flows (signup, core actions, checkout, etc.)
- Screen priorities (critical, high, medium, low)
- Navigation relationships between screens

## Component Inventory

Catalog all UI components needed:
- Navigation: navbar, sidebar, tabs, breadcrumbs, pagination
- Data Display: cards, tables, lists, stats, charts, badges
- Forms: inputs, selects, checkboxes, radio buttons, date pickers
- Feedback: alerts, toasts, modals, confirmations, loading states
- Overlays: modals, drawers, tooltips, popovers, menus
- Layout: containers, grids, dividers, spacers
- Media: images, avatars, icons, video players
- Specialized: anything unique to this application

## 5 Style Packages

Generate EXACTLY 5 distinct style packages. Each must:
- Have a unique mood/personality (e.g., "Minimal & Clean", "Bold & Vibrant")
- Honor any explicit user hints (if user says "blue", all packages use blue somehow)
- Include: typography, icon library, color palette, visual style, CSS framework preference
- Reference real design systems or products for inspiration
- Be distinctly different from the other 4 packages

Package structure:
{
  "id": "style-1",
  "name": "Package Name",
  "moodDescription": "2-3 sentence description of the mood",
  "characteristics": ["characteristic 1", "characteristic 2"],
  "differentiator": "What makes this unique from others",
  "typography": { "headingFont": "Font Name", "bodyFont": "Font Name", "weights": [400, 500, 700], "source": "google|adobe|system" },
  "icons": { "library": "Lucide|Heroicons|etc", "style": "outline|solid|duotone" },
  "colors": { "primary": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex", "surface": "#hex", "text": "#hex", "textMuted": "#hex" },
  "visual": { "borderRadius": "none|sm|md|lg|full", "shadows": true|false, "gradients": true|false },
  "references": [{ "name": "Reference Name", "url": "optional url", "notes": "what to take from it" }],
  "honorsUserHints": true|false,
  "userHintsUsed": ["hint 1", "hint 2"]
}

## Output Format

Respond with valid JSON matching the StyleResearchOutput schema:
{
  "promptAnalysis": {
    "colors": [{ "color": "blue", "context": "mentioned as primary", "required": true }],
    "fonts": [{ "font": "Inter", "usage": "both", "required": false }],
    "inspirationUrls": [{ "url": "...", "aspects": ["color", "layout"], "notes": "..." }],
    "moodKeywords": ["minimal", "clean"],
    "styleKeywords": ["professional", "modern"],
    "avoidKeywords": ["cluttered", "busy"],
    "platformHints": [{ "platform": "web", "explicit": true }],
    "audienceHints": { "type": "professional", "industry": "SaaS", "explicit": ["B2B"] },
    "rawHintsSummary": "Summary of all detected hints"
  },
  "domainResearch": {
    "appCategory": "Category name",
    "domain": "Industry/domain",
    "competitors": [{ "name": "...", "url": "...", "description": "...", "styleNotes": "...", "takeaways": [...], "avoid": [...], "relevance": 0.9 }],
    "domainPatterns": ["pattern 1", "pattern 2"],
    "userExpectations": ["expectation 1"],
    "technicalConsiderations": ["consideration 1"]
  },
  "screens": [{ "id": "screen-1", "name": "...", "description": "...", "purpose": "...", "type": "landing|dashboard|list|detail|form|settings|profile|auth|onboarding|error|empty|search|checkout|confirmation", "components": [...], "flows": [...], "navigatesTo": [...], "priority": "critical|high|medium|low" }],
  "userFlows": [{ "id": "flow-1", "name": "...", "description": "...", "steps": [{ "stepNumber": 1, "screen": "...", "action": "...", "outcome": "...", "componentsUsed": [...] }], "entryPoint": "...", "exitPoints": [...], "isCriticalPath": true|false }],
  "componentInventory": {
    "projectContext": { "appType": "...", "domain": "...", "platforms": ["web"], "audience": "..." },
    "navigation": ["navbar", "sidebar"],
    "dataDisplay": ["card", "table"],
    "forms": ["text-input", "select"],
    "feedback": ["toast", "modal"],
    "overlays": ["dropdown-menu"],
    "layout": ["container", "grid"],
    "media": ["avatar", "icon"],
    "specialized": [{ "component": "...", "reason": "...", "complexity": "simple|moderate|complex|advanced" }],
    "requiredStates": ["loading", "empty", "error"],
    "totalCount": 25
  },
  "techStack": {
    "frontend": { "framework": "React/Vue/etc", "reasoning": "..." },
    "css": { "approach": "tailwind|css-modules|styled-components|emotion|vanilla", "reasoning": "..." },
    "componentLibrary": { "name": "optional", "reasoning": "..." },
    "animation": { "library": "optional", "reasoning": "..." }
  },
  "stylePackages": [... 5 packages ...],
  "styleConstraints": {
    "mustUseColors": ["#hex if user specified"],
    "mustUseFonts": ["font name if user specified"],
    "mustMatchUrls": ["url if user wants to match a reference"],
    "mustAvoid": ["things user wants to avoid"],
    "platformConstraints": ["iOS guidelines if specified"]
  },
  "summary": "2-3 paragraph summary of the research",
  "confidence": 0.85
}`;
  }

  /**
   * Build user prompt for style research
   */
  protected buildStyleResearchUserPrompt(request: AgentRequest): string {
    // Get the original user prompt from context (not the TaskAnalysis)
    const description = this.getPromptFromContext(request);

    // Extract style hints from the prompt
    const hints = extractStyleHintsFromPrompt(description);

    let prompt = `# Style Research Request\n\n`;
    prompt += `## User Prompt\n${description}\n\n`;

    // Include extracted hints
    if (hints.colors && hints.colors.length > 0) {
      prompt += `## Detected Colors\n`;
      for (const color of hints.colors) {
        prompt += `- ${color.color}${color.context ? ` (${color.context})` : ''}\n`;
      }
      prompt += '\n';
    }

    if (hints.fonts && hints.fonts.length > 0) {
      prompt += `## Detected Fonts\n`;
      for (const font of hints.fonts) {
        prompt += `- ${font.font}${font.usage !== 'unknown' ? ` (for ${font.usage})` : ''}\n`;
      }
      prompt += '\n';
    }

    if (hints.inspirationUrls && hints.inspirationUrls.length > 0) {
      prompt += `## Inspiration URLs\n`;
      for (const url of hints.inspirationUrls) {
        prompt += `- ${url.url}\n`;
      }
      prompt += '\n';
    }

    if (hints.moodKeywords && hints.moodKeywords.length > 0) {
      prompt += `## Detected Mood Keywords\n`;
      prompt += hints.moodKeywords.join(', ') + '\n\n';
    }

    if (hints.platformHints && hints.platformHints.length > 0) {
      prompt += `## Platform Hints\n`;
      for (const platform of hints.platformHints) {
        prompt += `- ${platform.platform}${platform.explicit ? ' (explicit)' : ' (inferred)'}\n`;
      }
      prompt += '\n';
    }

    // Get style package count from settings (default to 1)
    const stylePackageCount = this.getStylePackageCount(request);

    prompt += `## Requirements\n\n`;
    prompt += `1. Analyze the prompt for ALL style hints (colors, fonts, URLs, mood, platform, audience)\n`;
    prompt += `2. Research the domain and identify 3-5 relevant competitors\n`;
    prompt += `3. Identify ALL screens and user flows needed for this application\n`;
    prompt += `4. Create a complete component inventory\n`;
    prompt += `5. Generate EXACTLY ${stylePackageCount} distinct style package${stylePackageCount > 1 ? 's' : ''}\n`;
    prompt += `6. Ensure all explicit user hints are honored in the style packages\n\n`;
    prompt += `Respond with valid JSON matching the StyleResearchOutput schema.`;

    return prompt;
  }

  /**
   * Parse style research response from LLM
   */
  private parseStyleResearchResponse(response: AIProviderResponse): StyleResearchOutput {
    const text = this.extractTextContent(response);
    const parsed = this.parseJSON<StyleResearchOutput>(text);
    return StyleResearchOutputSchema.parse(parsed);
  }

  /**
   * Process style research result: create artifacts with file-based paths
   *
   * Creates artifacts in designs/research/ directory structure:
   * - designs/research/style-packages/{id}.json - Individual style packages
   * - designs/research/component-inventory.json - Component inventory
   * - designs/research/screens.json - Screen definitions
   * - designs/research/user-flows.json - User flow definitions
   *
   * The result includes explicit path fields for easy state extraction.
   */
  private async processStyleResearchResult(
    parsed: StyleResearchOutput,
    request: AgentRequest
  ): Promise<{ result: StyleResearchOutput & StyleResearchPaths; artifacts: Artifact[] }> {
    const artifacts: Artifact[] = [];
    const outputDir = request.context.outputDir;
    const canWriteDirectly = hasOutputDir(outputDir);

    // Log whether we're writing directly or deferring to workflow
    this.log('info', `Processing style research (direct write: ${canWriteDirectly})`, {
      outputDir: outputDir ?? 'not available',
    });

    // Helper to write file and create artifact
    const writeAndCreateArtifact = async (
      relativePath: string,
      content: string,
      metadata: Record<string, unknown>
    ): Promise<Artifact> => {
      let writtenToFile = false;

      // Write file directly if outputDir is available
      // This eliminates race conditions - files exist before agent returns
      if (canWriteDirectly) {
        const result = await writeArtifactFile(outputDir, relativePath, content);
        if (result.success) {
          writtenToFile = true;
          this.log('debug', `Wrote file: ${relativePath} (${result.size} bytes)`);
        } else {
          this.log('warn', `Failed to write ${relativePath}: ${result.error}`);
        }
      }

      return {
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.REPORT,
        path: relativePath,
        // If written to file, use placeholder to save memory
        // Workflow will skip writing since file already exists
        content: writtenToFile ? `[File written to ${relativePath}]` : content,
        metadata: {
          ...metadata,
          writtenToFile,
        },
      };
    };

    // Build paths for file-based context pattern
    const stylePackagePaths: string[] = [];

    // 1. Individual style packages (for parallel UI designers)
    // These are the CRITICAL files that UI Designer needs to read
    for (const pkg of parsed.stylePackages) {
      const relativePath = `designs/research/style-packages/${pkg.id}.json`;
      stylePackagePaths.push(relativePath);
      const content = JSON.stringify(pkg, null, 2);
      const artifact = await writeAndCreateArtifact(relativePath, content, {
        stylePackageId: pkg.id,
        stylePackageName: pkg.name,
        forMegaPageGeneration: true,
      });
      artifacts.push(artifact);
    }

    // 2. Component inventory (for mega page generation)
    const componentInventoryPath = 'designs/research/component-inventory.json';
    artifacts.push(
      await writeAndCreateArtifact(
        componentInventoryPath,
        JSON.stringify(parsed.componentInventory, null, 2),
        {
          totalComponents: parsed.componentInventory.totalCount,
          forMegaPageGeneration: true,
        }
      )
    );

    // 3. Screens (for full design phase)
    const screensPath = 'designs/research/screens.json';
    artifacts.push(
      await writeAndCreateArtifact(
        screensPath,
        JSON.stringify(parsed.screens, null, 2),
        {
          screenCount: parsed.screens.length,
          forFullDesign: true,
        }
      )
    );

    // 4. User flows (for full design phase)
    const userFlowsPath = 'designs/research/user-flows.json';
    artifacts.push(
      await writeAndCreateArtifact(
        userFlowsPath,
        JSON.stringify(parsed.userFlows, null, 2),
        {
          flowCount: parsed.userFlows.length,
          forFullDesign: true,
        }
      )
    );

    // 5. Style research report (markdown - for human reference)
    artifacts.push(
      await writeAndCreateArtifact(
        'designs/research/style-research-report.md',
        this.renderStyleResearchReport(parsed),
        {
          reportType: 'style_research',
          stylePackageCount: parsed.stylePackages.length,
          screenCount: parsed.screens.length,
          componentCount: parsed.componentInventory.totalCount,
        }
      )
    );

    // 6. Full style research data (JSON - for debugging/reference)
    artifacts.push(
      await writeAndCreateArtifact(
        'designs/research/style-research-full.json',
        JSON.stringify(parsed, null, 2),
        {
          reportType: 'style_research',
          format: 'json',
        }
      )
    );

    // Count how many files were written directly
    const writtenCount = artifacts.filter(
      (a) => (a.metadata as Record<string, unknown>)?.['writtenToFile'] === true
    ).length;

    this.log('info', 'Style research complete', {
      stylePackages: parsed.stylePackages.length,
      stylePackagePaths,
      screens: parsed.screens.length,
      userFlows: parsed.userFlows.length,
      components: parsed.componentInventory.totalCount,
      filesWrittenDirectly: writtenCount,
      totalArtifacts: artifacts.length,
      tenantId: request.context.tenantId,
    });

    // Return result with explicit path fields for state extraction
    const resultWithPaths: StyleResearchOutput & StyleResearchPaths = {
      ...parsed,
      // File-based context paths (for state extraction)
      stylePackagePaths,
      componentInventoryPath,
      screensPath,
      userFlowsPath,
    };

    return { result: resultWithPaths, artifacts };
  }

  /**
   * Render style research as markdown report
   */
  private renderStyleResearchReport(output: StyleResearchOutput): string {
    const lines: string[] = [];

    lines.push(`# Style Research Report`);
    lines.push('');
    lines.push(`**Domain:** ${output.domainResearch.domain}`);
    lines.push(`**App Category:** ${output.domainResearch.appCategory}`);
    lines.push(`**Confidence:** ${Math.round(output.confidence * 100)}%`);
    lines.push('');

    // Summary
    lines.push('## Executive Summary');
    lines.push('');
    lines.push(output.summary);
    lines.push('');

    // Prompt Analysis
    lines.push('## Prompt Analysis');
    lines.push('');
    if (output.promptAnalysis.colors.length > 0) {
      lines.push('### Colors Detected');
      for (const c of output.promptAnalysis.colors) {
        const required = c.required ? ' ⭐ (required)' : '';
        lines.push(`- ${c.color}${c.context ? `: ${c.context}` : ''}${required}`);
      }
      lines.push('');
    }
    if (output.promptAnalysis.fonts.length > 0) {
      lines.push('### Fonts Detected');
      for (const f of output.promptAnalysis.fonts) {
        lines.push(`- ${f.font} (${f.usage})`);
      }
      lines.push('');
    }
    if (output.promptAnalysis.moodKeywords.length > 0) {
      lines.push('### Mood Keywords');
      lines.push(output.promptAnalysis.moodKeywords.join(', '));
      lines.push('');
    }

    // Competitors
    lines.push('## Competitor Analysis');
    lines.push('');
    for (const comp of output.domainResearch.competitors) {
      lines.push(`### ${comp.name}`);
      lines.push('');
      lines.push(comp.description);
      lines.push('');
      if (comp.styleNotes) {
        lines.push(`**Style Notes:** ${comp.styleNotes}`);
        lines.push('');
      }
      if (comp.takeaways.length > 0) {
        lines.push('**Takeaways:**');
        for (const t of comp.takeaways) {
          lines.push(`- ✅ ${t}`);
        }
        lines.push('');
      }
    }

    // Screens
    lines.push('## Screens');
    lines.push('');
    lines.push('| Screen | Type | Priority | Components |');
    lines.push('|--------|------|----------|------------|');
    for (const screen of output.screens) {
      lines.push(`| ${screen.name} | ${screen.type} | ${screen.priority} | ${screen.components.length} |`);
    }
    lines.push('');

    // User Flows
    lines.push('## User Flows');
    lines.push('');
    for (const flow of output.userFlows) {
      const critical = flow.isCriticalPath ? ' ⭐' : '';
      lines.push(`### ${flow.name}${critical}`);
      lines.push('');
      lines.push(flow.description);
      lines.push('');
      lines.push('**Steps:**');
      for (const step of flow.steps) {
        lines.push(`${step.stepNumber}. ${step.action} → ${step.outcome}`);
      }
      lines.push('');
    }

    // Component Inventory
    lines.push('## Component Inventory');
    lines.push('');
    lines.push(`**Total Components:** ${output.componentInventory.totalCount}`);
    lines.push('');
    const inv = output.componentInventory;
    if (inv.navigation.length > 0) lines.push(`- **Navigation:** ${inv.navigation.join(', ')}`);
    if (inv.dataDisplay.length > 0) lines.push(`- **Data Display:** ${inv.dataDisplay.join(', ')}`);
    if (inv.forms.length > 0) lines.push(`- **Forms:** ${inv.forms.join(', ')}`);
    if (inv.feedback.length > 0) lines.push(`- **Feedback:** ${inv.feedback.join(', ')}`);
    if (inv.overlays.length > 0) lines.push(`- **Overlays:** ${inv.overlays.join(', ')}`);
    if (inv.layout.length > 0) lines.push(`- **Layout:** ${inv.layout.join(', ')}`);
    if (inv.media.length > 0) lines.push(`- **Media:** ${inv.media.join(', ')}`);
    if (inv.specialized.length > 0) {
      lines.push('- **Specialized:**');
      for (const s of inv.specialized) {
        lines.push(`  - ${s.component} (${s.complexity}): ${s.reason}`);
      }
    }
    lines.push('');

    // Style Packages
    lines.push('## Style Packages');
    lines.push('');
    for (const pkg of output.stylePackages) {
      lines.push(`### ${pkg.name}`);
      lines.push('');
      lines.push(`*${pkg.moodDescription}*`);
      lines.push('');
      lines.push(`**Differentiator:** ${pkg.differentiator}`);
      lines.push('');
      lines.push('| Aspect | Value |');
      lines.push('|--------|-------|');
      lines.push(`| Heading Font | ${pkg.typography.headingFont} |`);
      lines.push(`| Body Font | ${pkg.typography.bodyFont} |`);
      lines.push(`| Icons | ${pkg.icons.library} (${pkg.icons.style}) |`);
      lines.push(`| Primary Color | ${pkg.colors.primary} |`);
      lines.push(`| Border Radius | ${pkg.visual.borderRadius} |`);
      lines.push(`| Shadows | ${pkg.visual.shadows ? 'Yes' : 'No'} |`);
      lines.push(`| Gradients | ${pkg.visual.gradients ? 'Yes' : 'No'} |`);
      lines.push('');
      if (pkg.honorsUserHints && pkg.userHintsUsed.length > 0) {
        lines.push(`**User Hints Used:** ${pkg.userHintsUsed.join(', ')}`);
        lines.push('');
      }
    }

    // Constraints
    if (output.styleConstraints.mustUseColors.length > 0 ||
        output.styleConstraints.mustUseFonts.length > 0) {
      lines.push('## Style Constraints');
      lines.push('');
      if (output.styleConstraints.mustUseColors.length > 0) {
        lines.push(`- **Required Colors:** ${output.styleConstraints.mustUseColors.join(', ')}`);
      }
      if (output.styleConstraints.mustUseFonts.length > 0) {
        lines.push(`- **Required Fonts:** ${output.styleConstraints.mustUseFonts.join(', ')}`);
      }
      if (output.styleConstraints.mustAvoid.length > 0) {
        lines.push(`- **Avoid:** ${output.styleConstraints.mustAvoid.join(', ')}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate routing hints for style research
   */
  private generateStyleResearchRoutingHints(
    result: StyleResearchOutput,
    _artifacts: Artifact[]
  ): RoutingHints {
    return {
      suggestNext: [AgentTypeEnum.ARCHITECT], // After style research, architect designs the system
      skipAgents: [],
      needsApproval: false, // Style selection happens after parallel UI designers
      hasFailures: false,
      isComplete: false,
      notes: `Style research complete: ${result.stylePackages.length} style packages, ${result.screens.length} screens, ${result.componentInventory.totalCount} components identified. Ready for architecture design.`,
    };
  }
}
