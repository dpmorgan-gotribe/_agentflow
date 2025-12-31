/**
 * Analyst Agent
 *
 * Provides research and best practices recommendations.
 * Investigates questions, compares options, and cites sources.
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
    const task = request.task;
    const contextItems = request.context.items;

    // Determine report type from task
    const reportType = this.determineReportType(task);

    // Get task description
    const description = this.getTaskDescription(task);

    let prompt = `Research Question: ${description}\n\n`;
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
   */
  protected parseResponse(response: AIProviderResponse): AnalystOutput {
    const text = this.extractTextContent(response);

    // Try to parse as JSON
    const parsed = this.parseJSON<AnalystOutput>(text);

    // Validate with Zod schema
    return AnalystOutputSchema.parse(parsed);
  }

  /**
   * Process parsed result: create research report artifact
   */
  protected async processResult(
    parsed: AnalystOutput,
    request: AgentRequest
  ): Promise<{ result: AnalystOutput; artifacts: Artifact[] }> {
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
        confidence: parsed.recommendation.confidence,
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
      confidence: parsed.recommendation.confidence,
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
      notes: `Research complete with ${Math.round(output.recommendation.confidence * 100)}% confidence. ${output.sources.length} sources cited.`,
    };
  }

  /**
   * Determine report type from task
   */
  private determineReportType(task: TaskAnalysis): ReportType {
    const description = this.getTaskDescription(task).toLowerCase();

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
   * Get task description string
   */
  private getTaskDescription(task: TaskAnalysis): string {
    if (typeof task === 'object' && 'description' in task) {
      return (task as { description?: string }).description || JSON.stringify(task);
    }
    return JSON.stringify(task);
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
      `**Confidence:** ${Math.round(output.recommendation.confidence * 100)}%`
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
}
