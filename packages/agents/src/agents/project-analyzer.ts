/**
 * Project Analyzer Agent
 *
 * Analyzes existing codebases to understand their structure,
 * patterns, tech stack, and architecture.
 *
 * SECURITY:
 * - Validates all output structures with Zod
 * - Tenant isolation via context
 * - Path validation for all file paths
 * - No direct filesystem access (uses pre-analyzed data)
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
  ProjectAnalyzerOutput,
  DetectedLanguage,
  DetectedFramework,
  DirectoryAnalysis,
  DetectedPattern,
  CodeQuality,
  AnalysisRecommendation,
} from '../schemas/project-analyzer-output.js';
import { ProjectAnalyzerOutputSchema } from '../schemas/project-analyzer-output.js';
import type { PreAnalyzedData } from '../analysis/code-analyzer.js';
import {
  analyzeLanguages,
  detectFrameworks,
  analyzeDirectories,
  analyzeCodeQuality,
  detectEntryPoints,
  analyzeDependencies,
  inferProjectType,
  detectPatterns,
} from '../analysis/code-analyzer.js';

/**
 * Extended request with pre-analyzed data
 */
interface ProjectAnalyzerRequest extends AgentRequest {
  analysisData?: PreAnalyzedData;
}

/**
 * Project Analyzer Agent implementation
 *
 * Capabilities:
 * - codebase-analysis: Analyze project structure and tech stack
 * - pattern-detection: Detect coding patterns and architecture
 * - context-generation: Generate CLAUDE.md and architecture docs
 */
export class ProjectAnalyzerAgent extends BaseAgent {
  constructor() {
    const metadata: AgentMetadata = {
      id: AgentTypeEnum.PROJECT_ANALYZER,
      name: 'Project Analyzer',
      description: 'Analyzes existing codebases to understand structure and patterns',
      version: '1.0.0',
      capabilities: [
        {
          name: 'codebase-analysis',
          description: 'Analyze project structure and tech stack',
          inputTypes: ['project-path', 'pre-analyzed-data'],
          outputTypes: ['analysis-report', 'json'],
        },
        {
          name: 'pattern-detection',
          description: 'Detect coding patterns and architecture',
          inputTypes: ['source-code', 'directory-structure'],
          outputTypes: ['patterns', 'json'],
        },
        {
          name: 'context-generation',
          description: 'Generate CLAUDE.md and architecture documentation',
          inputTypes: ['analysis'],
          outputTypes: ['documentation', 'markdown'],
        },
      ],
      requiredContext: [{ type: ContextTypeEnum.CURRENT_TASK, required: true }],
      outputSchema: 'project-analyzer-output',
    };

    super(metadata);
  }

  /**
   * Build system prompt for project analysis
   */
  protected buildSystemPrompt(context: AgentContext): string {
    return `You are the Project Analyzer agent responsible for understanding existing codebases.

Your responsibilities:
1. Analyze directory structure and identify key directories
2. Detect technology stack from package files and code patterns
3. Identify architectural patterns and coding conventions
4. Detect compliance-relevant code (authentication, data handling)
5. Generate recommendations for improvements
6. Create CLAUDE.md context file for future AI interactions

Analysis approach:
- Review the pre-analyzed data provided
- Interpret language statistics and framework detections
- Assess code quality indicators
- Identify architectural patterns from directory structure
- Check for security and compliance concerns
- Generate actionable recommendations

For CLAUDE.md generation:
- Include project overview and tech stack
- Document key directories and their purposes
- List important patterns and conventions
- Note any security or compliance requirements
- Add helpful context for future AI assistance

Output must be valid JSON matching the ProjectAnalyzerOutput schema with:
- projectName, projectType
- techStack (languages, frameworks, databases, infrastructure)
- structure (directories, entry points, config files, stats)
- architecture (pattern, apiStyle, stateManagement, dataFlow)
- patterns, codeQuality, complianceIndicators
- dependencies, recommendations
- generatedContext (claudeMd, architectureYaml)
- routingHints`;
  }

  /**
   * Build user prompt with pre-analyzed data
   */
  protected buildUserPrompt(request: AgentRequest): string {
    const analyzerRequest = request as ProjectAnalyzerRequest;
    const analysisData = analyzerRequest.analysisData;

    let prompt = `Analyze this project and provide comprehensive documentation:\n\n`;

    if (analysisData) {
      prompt += `PROJECT NAME: ${analysisData.projectName}\n\n`;

      prompt += `DETECTED LANGUAGES:\n`;
      const languages = analyzeLanguages(analysisData.files);
      for (const lang of languages.slice(0, 5)) {
        const primary = lang.primary ? ' (PRIMARY)' : '';
        prompt += `- ${lang.name}${primary}: ${lang.percentage}% (${lang.files} files, ${lang.lines} lines)\n`;
      }
      prompt += `\n`;

      // Get file extensions for framework detection
      const fileExtensions = new Set(analysisData.files.map((f) => f.extension));

      prompt += `DETECTED FRAMEWORKS:\n`;
      const frameworks = detectFrameworks(
        analysisData.packageDeps,
        analysisData.configFiles,
        fileExtensions
      );
      for (const fw of frameworks.slice(0, 10)) {
        prompt += `- ${fw.name} (${fw.type}): ${Math.round(fw.confidence * 100)}% confidence\n`;
        for (const evidence of fw.evidence.slice(0, 2)) {
          prompt += `  - ${evidence}\n`;
        }
      }
      prompt += `\n`;

      prompt += `DIRECTORY STRUCTURE:\n`;
      const directories = analyzeDirectories(analysisData.directories);
      for (const dir of directories.slice(0, 15)) {
        prompt += `- ${dir.path}/ [${dir.importance}]: ${dir.purpose} (${dir.fileCount} files)\n`;
        if (dir.patterns.length > 0) {
          prompt += `  Patterns: ${dir.patterns.join(', ')}\n`;
        }
      }
      prompt += `\n`;

      prompt += `CODE QUALITY INDICATORS:\n`;
      const quality = analyzeCodeQuality(analysisData);
      prompt += `- Has Tests: ${quality.hasTests ? 'Yes' : 'No'}\n`;
      prompt += `- Has Linting: ${quality.hasLinting ? 'Yes' : 'No'}\n`;
      prompt += `- Has Type Checking: ${quality.hasTypeChecking ? 'Yes' : 'No'}\n`;
      prompt += `- Has Documentation: ${quality.hasDocumentation ? 'Yes' : 'No'}\n`;
      prompt += `- Has CI/CD: ${quality.hasCI ? 'Yes' : 'No'}\n`;
      if (quality.issues.length > 0) {
        prompt += `Issues:\n`;
        for (const issue of quality.issues) {
          prompt += `  - [${issue.type.toUpperCase()}] ${issue.message}\n`;
        }
      }
      prompt += `\n`;

      prompt += `ENTRY POINTS:\n`;
      const entryPoints = detectEntryPoints(analysisData.files);
      for (const entry of entryPoints) {
        prompt += `- ${entry.path} (${entry.type}): ${entry.description}\n`;
      }
      prompt += `\n`;

      prompt += `DETECTED PATTERNS:\n`;
      const patterns = detectPatterns(analysisData.directories, analysisData.files);
      for (const pattern of patterns) {
        prompt += `- ${pattern.name} [${pattern.category}]: ${pattern.description}\n`;
      }
      prompt += `\n`;

      const projectType = inferProjectType(frameworks, analysisData.files, analysisData.configFiles);
      prompt += `INFERRED PROJECT TYPE: ${projectType}\n\n`;

      prompt += `CONFIG FILES:\n`;
      for (const config of analysisData.configFiles.slice(0, 20)) {
        prompt += `- ${config}\n`;
      }
      prompt += `\n`;

      if (analysisData.packageDeps) {
        const deps = analyzeDependencies(analysisData.packageDeps);
        prompt += `DEPENDENCIES:\n`;
        prompt += `- Total: ${deps.total}\n`;
        prompt += `- Production: ${deps.production}\n`;
        prompt += `- Development: ${deps.development}\n`;
        prompt += `\n`;
      }
    } else {
      prompt += `No pre-analyzed data provided. Please analyze based on context.\n`;
    }

    prompt += `Based on this analysis, provide:
1. Complete tech stack assessment with all detected technologies
2. Comprehensive architecture pattern identification
3. Code quality assessment with specific issues
4. Compliance indicators (authentication, data handling, etc.)
5. Prioritized recommendations for improvement
6. Generated CLAUDE.md content that will help future AI assistants understand this project
7. Architecture YAML summary

Be thorough and specific. The CLAUDE.md should be comprehensive but focused.`;

    return prompt;
  }

  /**
   * Parse LLM response into ProjectAnalyzerOutput
   */
  protected parseResponse(response: AIProviderResponse): ProjectAnalyzerOutput {
    const text = this.extractTextContent(response);
    const parsed = this.parseJSON<ProjectAnalyzerOutput>(text);
    return ProjectAnalyzerOutputSchema.parse(parsed);
  }

  /**
   * Process parsed result and create artifacts
   */
  protected async processResult(
    parsed: ProjectAnalyzerOutput,
    request: AgentRequest
  ): Promise<{ result: ProjectAnalyzerOutput; artifacts: Artifact[] }> {
    const artifacts: Artifact[] = [];

    // Create CLAUDE.md artifact
    artifacts.push({
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.DOCUMENTATION,
      path: 'CLAUDE.md',
      content: parsed.generatedContext.claudeMd,
      metadata: {
        type: 'claude-md',
        projectName: parsed.projectName,
        projectType: parsed.projectType,
      },
    });

    // Create architecture.yaml artifact
    artifacts.push({
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.CONFIG_FILE,
      path: 'architecture.yaml',
      content: parsed.generatedContext.architectureYaml,
      metadata: {
        type: 'architecture',
        pattern: parsed.architecture.pattern,
      },
    });

    // Create analysis report
    artifacts.push({
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.REPORT,
      path: 'docs/analysis-report.md',
      content: this.renderAnalysisReport(parsed),
      metadata: {
        type: 'analysis-report',
        totalFiles: parsed.structure.totalFiles,
        totalLines: parsed.structure.totalLines,
      },
    });

    // Create tech stack summary
    artifacts.push({
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.CONFIG_FILE,
      path: 'docs/tech-stack.json',
      content: JSON.stringify(parsed.techStack, null, 2),
      metadata: {
        type: 'tech-stack',
        languageCount: parsed.techStack.languages.length,
        frameworkCount: parsed.techStack.frameworks.length,
      },
    });

    this.log('info', 'Project analysis complete', {
      projectName: parsed.projectName,
      projectType: parsed.projectType,
      languages: parsed.techStack.languages.length,
      frameworks: parsed.techStack.frameworks.length,
      patterns: parsed.patterns.length,
      recommendations: parsed.recommendations.length,
      tenantId: request.context.tenantId,
    });

    return {
      result: parsed,
      artifacts,
    };
  }

  /**
   * Generate routing hints based on analysis
   */
  protected generateRoutingHints(
    result: unknown,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    const output = result as ProjectAnalyzerOutput;
    const suggestNext: (typeof AgentTypeEnum)[keyof typeof AgentTypeEnum][] = [];

    // If compliance concerns found, suggest compliance agent
    if (
      output.complianceIndicators.handlesPersonalData ||
      output.complianceIndicators.hasSensitiveData
    ) {
      suggestNext.push(AgentTypeEnum.COMPLIANCE_AGENT);
    }

    // If architecture issues found, suggest architect
    if (output.recommendations.some((r) => r.category === 'architecture')) {
      suggestNext.push(AgentTypeEnum.ARCHITECT);
    }

    // If security issues found, suggest compliance
    if (
      output.recommendations.some((r) => r.category === 'security' && r.priority === 'critical')
    ) {
      suggestNext.push(AgentTypeEnum.COMPLIANCE_AGENT);
    }

    // If no specific needs, analysis is complete
    if (suggestNext.length === 0) {
      suggestNext.push(AgentTypeEnum.PROJECT_MANAGER);
    }

    const criticalCount = output.recommendations.filter(
      (r) => r.priority === 'critical'
    ).length;

    return {
      suggestNext,
      skipAgents: [],
      needsApproval: criticalCount > 0,
      hasFailures: false,
      isComplete: true,
      notes: `Analyzed ${output.structure.totalFiles} files, found ${output.patterns.length} patterns, ${output.recommendations.length} recommendations (${criticalCount} critical)`,
    };
  }

  /**
   * Render analysis report as markdown
   */
  private renderAnalysisReport(output: ProjectAnalyzerOutput): string {
    const lines: string[] = [];

    lines.push(`# Project Analysis Report: ${output.projectName}`);
    lines.push('');
    lines.push(`**Project Type:** ${output.projectType}`);
    lines.push(`**Total Files:** ${output.structure.totalFiles.toLocaleString()}`);
    lines.push(`**Total Lines:** ${output.structure.totalLines.toLocaleString()}`);
    lines.push('');

    // Tech Stack
    lines.push('## Tech Stack');
    lines.push('');
    lines.push('### Languages');
    for (const lang of output.techStack.languages) {
      const primary = lang.primary ? ' **(primary)**' : '';
      lines.push(
        `- **${lang.name}**${primary}: ${lang.percentage}% (${lang.files} files, ${lang.lines.toLocaleString()} lines)`
      );
    }
    lines.push('');

    lines.push('### Frameworks');
    for (const fw of output.techStack.frameworks) {
      const version = fw.version ? ` v${fw.version}` : '';
      lines.push(
        `- **${fw.name}**${version} (${fw.type}): ${Math.round(fw.confidence * 100)}% confidence`
      );
    }
    lines.push('');

    if (output.techStack.databases.length > 0) {
      lines.push('### Databases');
      for (const db of output.techStack.databases) {
        lines.push(`- ${db}`);
      }
      lines.push('');
    }

    if (output.techStack.infrastructure.length > 0) {
      lines.push('### Infrastructure');
      for (const infra of output.techStack.infrastructure) {
        lines.push(`- ${infra}`);
      }
      lines.push('');
    }

    // Architecture
    lines.push('## Architecture');
    lines.push('');
    lines.push(`- **Pattern:** ${output.architecture.pattern}`);
    if (output.architecture.apiStyle) {
      lines.push(`- **API Style:** ${output.architecture.apiStyle}`);
    }
    if (output.architecture.stateManagement) {
      lines.push(`- **State Management:** ${output.architecture.stateManagement}`);
    }
    lines.push(`- **Data Flow:** ${output.architecture.dataFlow}`);
    lines.push('');

    // Patterns
    if (output.patterns.length > 0) {
      lines.push('## Detected Patterns');
      lines.push('');
      for (const pattern of output.patterns) {
        lines.push(`### ${pattern.name}`);
        lines.push(`**Category:** ${pattern.category} | **Confidence:** ${Math.round(pattern.confidence * 100)}%`);
        lines.push('');
        lines.push(pattern.description);
        lines.push('');
        lines.push('**Locations:**');
        for (const loc of pattern.locations) {
          lines.push(`- \`${loc}\``);
        }
        lines.push('');
      }
    }

    // Code Quality
    lines.push('## Code Quality');
    lines.push('');
    lines.push('| Aspect | Status |');
    lines.push('|--------|--------|');
    lines.push(`| Tests | ${output.codeQuality.hasTests ? '✅' : '❌'} |`);
    lines.push(`| Linting | ${output.codeQuality.hasLinting ? '✅' : '❌'} |`);
    lines.push(`| Type Checking | ${output.codeQuality.hasTypeChecking ? '✅' : '❌'} |`);
    lines.push(`| Documentation | ${output.codeQuality.hasDocumentation ? '✅' : '❌'} |`);
    lines.push(`| CI/CD | ${output.codeQuality.hasCI ? '✅' : '❌'} |`);
    lines.push(`| Security Tools | ${output.codeQuality.hasSecurity ? '✅' : '❌'} |`);
    lines.push('');

    if (output.codeQuality.issues.length > 0) {
      lines.push('### Issues');
      for (const issue of output.codeQuality.issues) {
        const icon = issue.type === 'error' ? '🔴' : issue.type === 'warning' ? '🟡' : '💡';
        lines.push(`- ${icon} ${issue.message}`);
      }
      lines.push('');
    }

    // Compliance
    lines.push('## Compliance Indicators');
    lines.push('');
    lines.push('| Indicator | Detected |');
    lines.push('|-----------|----------|');
    lines.push(`| Personal Data Handling | ${output.complianceIndicators.handlesPersonalData ? '⚠️ Yes' : 'No'} |`);
    lines.push(`| Authentication | ${output.complianceIndicators.hasAuthentication ? '✅' : '❌'} |`);
    lines.push(`| Authorization | ${output.complianceIndicators.hasAuthorization ? '✅' : '❌'} |`);
    lines.push(`| Audit Logging | ${output.complianceIndicators.hasAuditLogging ? '✅' : '❌'} |`);
    lines.push(`| Encryption | ${output.complianceIndicators.hasEncryption ? '✅' : '❌'} |`);
    lines.push(`| Sensitive Data | ${output.complianceIndicators.hasSensitiveData ? '⚠️ Yes' : 'No'} |`);
    lines.push('');

    // Dependencies
    lines.push('## Dependencies');
    lines.push('');
    lines.push(`- **Total:** ${output.dependencies.total}`);
    lines.push(`- **Production:** ${output.dependencies.production}`);
    lines.push(`- **Development:** ${output.dependencies.development}`);

    if (output.dependencies.vulnerabilities.length > 0) {
      lines.push('');
      lines.push('### Vulnerabilities');
      for (const vuln of output.dependencies.vulnerabilities) {
        const icon =
          vuln.severity === 'critical'
            ? '🔴'
            : vuln.severity === 'high'
              ? '🟠'
              : vuln.severity === 'medium'
                ? '🟡'
                : '🔵';
        lines.push(`- ${icon} **${vuln.name}** (${vuln.severity}): ${vuln.description}`);
      }
    }
    lines.push('');

    // Recommendations
    if (output.recommendations.length > 0) {
      lines.push('## Recommendations');
      lines.push('');

      // Group by priority
      const byPriority = {
        critical: output.recommendations.filter((r) => r.priority === 'critical'),
        high: output.recommendations.filter((r) => r.priority === 'high'),
        medium: output.recommendations.filter((r) => r.priority === 'medium'),
        low: output.recommendations.filter((r) => r.priority === 'low'),
      };

      for (const [priority, recs] of Object.entries(byPriority)) {
        if (recs.length === 0) continue;

        const icon =
          priority === 'critical'
            ? '🔴'
            : priority === 'high'
              ? '🟠'
              : priority === 'medium'
                ? '🟡'
                : '🔵';

        lines.push(`### ${icon} ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`);
        lines.push('');

        for (const rec of recs) {
          lines.push(`#### ${rec.title}`);
          lines.push(`**Category:** ${rec.category} | **Effort:** ${rec.effort}`);
          lines.push('');
          lines.push(rec.description);
          lines.push('');
        }
      }
    }

    // Structure
    lines.push('## Directory Structure');
    lines.push('');
    lines.push('| Directory | Purpose | Files | Importance |');
    lines.push('|-----------|---------|-------|------------|');
    for (const dir of output.structure.rootDirectories) {
      const icon =
        dir.importance === 'critical'
          ? '🔴'
          : dir.importance === 'high'
            ? '🟠'
            : dir.importance === 'medium'
              ? '🟡'
              : '🔵';
      lines.push(`| \`${dir.path}/\` | ${dir.purpose} | ${dir.fileCount} | ${icon} ${dir.importance} |`);
    }
    lines.push('');

    lines.push('---');
    lines.push('*Generated by Project Analyzer Agent*');

    return lines.join('\n');
  }
}
