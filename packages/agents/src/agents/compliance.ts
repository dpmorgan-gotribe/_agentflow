/**
 * Compliance Agent
 *
 * Ensures platform and project compliance at all times.
 * Implements a two-tier compliance model:
 * - Platform compliance: MANDATORY, cannot be disabled
 * - Project compliance: User-configured (GDPR, SOC2, HIPAA, PCI-DSS)
 *
 * SECURITY:
 * - Validates all output structures with Zod
 * - Tenant isolation via context
 * - Pure analysis functions (no filesystem access)
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
  ComplianceOutput,
  ComplianceFramework,
  Violation,
  CheckResult,
  ComplianceScore,
  ComplianceRecommendation,
} from '../schemas/compliance-output.js';
import {
  ComplianceOutputSchema,
  createComplianceScore,
  calculateComplianceSummary,
  countViolationsBySeverity,
} from '../schemas/compliance-output.js';
import type { FileContent, ComplianceConfig, RuleContext } from '../compliance/compliance-rules.js';
import { evaluateCompliance, getRulesForFrameworks } from '../compliance/compliance-rules.js';

/**
 * Extended request with pre-scanned data
 */
interface ComplianceAgentRequest extends AgentRequest {
  complianceData?: {
    files: FileContent[];
    packageDeps?: Record<string, string>;
    configFiles?: string[];
  };
}

/**
 * Compliance Agent implementation
 *
 * Capabilities:
 * - compliance-scan: Scan codebase for compliance violations
 * - compliance-advisory: Provide compliance guidance to other agents
 * - compliance-report: Generate comprehensive compliance reports
 */
export class ComplianceAgent extends BaseAgent {
  constructor() {
    const metadata: AgentMetadata = {
      id: AgentTypeEnum.COMPLIANCE_AGENT,
      name: 'Compliance Agent',
      description: 'Ensures platform and project compliance with security standards',
      version: '1.0.0',
      capabilities: [
        {
          name: 'compliance-scan',
          description: 'Scan codebase for compliance violations',
          inputTypes: ['source-code', 'pre-scanned-data'],
          outputTypes: ['compliance-report', 'json'],
        },
        {
          name: 'compliance-advisory',
          description: 'Provide compliance guidance to other agents',
          inputTypes: ['question', 'context'],
          outputTypes: ['guidance', 'json'],
        },
        {
          name: 'compliance-report',
          description: 'Generate comprehensive compliance reports',
          inputTypes: ['scan-results'],
          outputTypes: ['report', 'markdown'],
        },
      ],
      requiredContext: [
        { type: ContextTypeEnum.CURRENT_TASK, required: true },
        { type: ContextTypeEnum.PROJECT_CONFIG, required: false },
      ],
      outputSchema: 'compliance-output',
    };

    super(metadata);
  }

  /**
   * Build system prompt for compliance analysis
   */
  protected buildSystemPrompt(context: AgentContext): string {
    const projectConfig = context.items.find(
      (i) => i.type === ContextTypeEnum.PROJECT_CONFIG
    )?.content as Record<string, unknown> | undefined;

    const complianceConfig = projectConfig?.['compliance'] as Record<string, unknown> | undefined;
    const frameworks = (complianceConfig?.['frameworks'] as string[]) || ['platform'];

    return `You are the Compliance Agent responsible for security and compliance verification.

Your responsibilities:
1. ALWAYS enforce platform compliance (audit logging, encryption, secrets, access control)
2. Enforce project-specific compliance frameworks: ${frameworks.join(', ')}
3. Scan code for security vulnerabilities and compliance violations
4. Provide actionable remediation guidance
5. Generate comprehensive compliance reports

Two-Tier Compliance Model:
- TIER 1 (Platform): MANDATORY, cannot be disabled
  - No hardcoded secrets
  - Audit logging
  - Input validation
  - HTTPS enforcement
  - SQL injection prevention

- TIER 2 (Project): Based on configuration
  - GDPR: Data minimization, consent, right to deletion
  - SOC2: Access control, change management
  - PCI-DSS: Card data protection, encryption
  - HIPAA: PHI protection, access logging
  - ISO27001: Information security management

Severity Levels:
- CRITICAL: Block deployment until fixed
- HIGH: Should fix before release
- MEDIUM: Should address soon
- LOW: Nice to fix
- INFO: Informational only

When analyzing scan results:
1. Prioritize critical and high severity violations
2. Group violations by framework and type
3. Provide specific, actionable remediation steps
4. Calculate compliance scores per framework
5. Determine overall compliance status

Output must be valid JSON matching the ComplianceOutput schema.`;
  }

  /**
   * Build user prompt with scan results
   */
  protected buildUserPrompt(request: AgentRequest): string {
    const complianceRequest = request as ComplianceAgentRequest;
    const complianceData = complianceRequest.complianceData;

    // Get project config
    const projectConfig = request.context.items.find(
      (i) => i.type === ContextTypeEnum.PROJECT_CONFIG
    )?.content as Record<string, unknown> | undefined;

    const complianceConfig = projectConfig?.['compliance'] as Record<string, unknown> | undefined;
    const frameworks: ComplianceFramework[] =
      (complianceConfig?.['frameworks'] as ComplianceFramework[]) || ['platform'];

    let prompt = `Perform a compliance scan and generate a comprehensive report.\n\n`;

    prompt += `ACTIVE FRAMEWORKS:\n`;
    for (const fw of frameworks) {
      prompt += `- ${fw.toUpperCase()}\n`;
    }
    prompt += `\n`;

    if (complianceData) {
      // Run automated compliance checks
      const config: ComplianceConfig = {
        frameworks,
        exclusions: complianceConfig?.['exclusions'] as {
          files?: string[];
          rules?: string[];
        },
      };

      const ctx: RuleContext = {
        files: complianceData.files,
        config,
        packageDeps: complianceData.packageDeps,
        configFiles: complianceData.configFiles,
      };

      const { results, violations } = evaluateCompliance(ctx);

      prompt += `AUTOMATED SCAN RESULTS:\n\n`;

      prompt += `Check Results (${results.length} checks):\n`;
      const passed = results.filter((r) => r.passed);
      const failed = results.filter((r) => !r.passed);

      prompt += `- Passed: ${passed.length}\n`;
      prompt += `- Failed: ${failed.length}\n\n`;

      if (failed.length > 0) {
        prompt += `Failed Checks:\n`;
        for (const r of failed) {
          prompt += `- [${r.framework}] ${r.rule}: ${r.message}\n`;
        }
        prompt += `\n`;
      }

      prompt += `Violations Found (${violations.length}):\n`;
      if (violations.length > 0) {
        const bySeverity = countViolationsBySeverity(violations);
        prompt += `- Critical: ${bySeverity.critical}\n`;
        prompt += `- High: ${bySeverity.high}\n`;
        prompt += `- Medium: ${bySeverity.medium}\n`;
        prompt += `- Low: ${bySeverity.low}\n`;
        prompt += `- Info: ${bySeverity.info}\n\n`;

        prompt += `Violation Details:\n`;
        for (const v of violations) {
          prompt += `\n[${v.severity.toUpperCase()}] ${v.title}\n`;
          prompt += `  Rule: ${v.rule}\n`;
          prompt += `  Framework: ${v.framework}\n`;
          if (v.location) {
            prompt += `  Location: ${v.location.file}:${v.location.line || '?'}\n`;
            if (v.location.code) {
              prompt += `  Code: ${v.location.code.substring(0, 80)}\n`;
            }
          }
          prompt += `  Description: ${v.description}\n`;
          prompt += `  Remediation: ${v.remediation}\n`;
        }
      } else {
        prompt += `No violations detected.\n`;
      }
      prompt += `\n`;

      prompt += `Files Scanned: ${complianceData.files.length}\n`;
      prompt += `Package Dependencies: ${Object.keys(complianceData.packageDeps || {}).length}\n\n`;
    } else {
      prompt += `No pre-scanned data provided. Please analyze based on available context.\n\n`;
    }

    prompt += `Based on this analysis, provide:
1. Complete violation list with severity and remediation
2. Compliance scores for each framework (0-100)
3. Security assessment (authentication, authorization, encryption, secrets)
4. Data handling assessment if applicable
5. Prioritized recommendations for improvement
6. Overall compliance status (compliant, non-compliant, needs-attention)
7. Routing hints (should this block deployment?)

Be thorough and specific. Include all violations found in the scan.`;

    return prompt;
  }

  /**
   * Parse LLM response into ComplianceOutput
   */
  protected parseResponse(response: AIProviderResponse): ComplianceOutput {
    const text = this.extractTextContent(response);
    const parsed = this.parseJSON<ComplianceOutput>(text);
    return ComplianceOutputSchema.parse(parsed);
  }

  /**
   * Process parsed result and create artifacts
   */
  protected async processResult(
    parsed: ComplianceOutput,
    request: AgentRequest
  ): Promise<{ result: ComplianceOutput; artifacts: Artifact[] }> {
    const artifacts: Artifact[] = [];

    // Create compliance report markdown
    artifacts.push({
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.REPORT,
      path: 'compliance/compliance-report.md',
      content: this.renderComplianceReport(parsed),
      metadata: {
        type: 'compliance-report',
        status: parsed.summary.overallStatus,
        totalViolations: parsed.summary.totalViolations,
        criticalViolations: parsed.summary.criticalViolations,
      },
    });

    // Create violations CSV for tracking
    if (parsed.violations.length > 0) {
      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.REPORT,
        path: 'compliance/violations.csv',
        content: this.renderViolationsCSV(parsed.violations),
        metadata: {
          type: 'violations-csv',
          count: parsed.violations.length,
        },
      });
    }

    // Create compliance scores JSON
    artifacts.push({
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.CONFIG_FILE,
      path: 'compliance/scores.json',
      content: JSON.stringify(
        {
          timestamp: parsed.timestamp,
          scores: parsed.scores,
          summary: parsed.summary,
        },
        null,
        2
      ),
      metadata: {
        type: 'compliance-scores',
        averageScore: parsed.summary.averageScore,
      },
    });

    this.log('info', 'Compliance scan complete', {
      status: parsed.summary.overallStatus,
      totalViolations: parsed.summary.totalViolations,
      criticalViolations: parsed.summary.criticalViolations,
      averageScore: parsed.summary.averageScore,
      tenantId: request.context.tenantId,
    });

    return {
      result: parsed,
      artifacts,
    };
  }

  /**
   * Generate routing hints based on compliance results
   */
  protected generateRoutingHints(
    result: unknown,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints {
    const output = result as ComplianceOutput;
    const hasCritical = output.summary.criticalViolations > 0;
    const hasHigh = output.summary.highViolations > 0;

    const suggestNext: (typeof AgentTypeEnum)[keyof typeof AgentTypeEnum][] = [];

    // If there are security issues, don't suggest proceeding
    if (!hasCritical) {
      // Suggest architect if there are architecture-related recommendations
      if (output.recommendations.some((r) => r.framework === 'soc2')) {
        suggestNext.push(AgentTypeEnum.ARCHITECT);
      }

      // Suggest project manager to plan remediation work
      if (output.summary.totalViolations > 0) {
        suggestNext.push(AgentTypeEnum.PROJECT_MANAGER);
      }
    }

    return {
      suggestNext,
      skipAgents: [],
      needsApproval: hasCritical || hasHigh,
      hasFailures: hasCritical,
      isComplete: true,
      notes: hasCritical
        ? `BLOCKING: ${output.summary.criticalViolations} critical violations must be fixed before proceeding`
        : hasHigh
          ? `${output.summary.highViolations} high-severity violations should be addressed`
          : `${output.summary.totalViolations} violations found, average score: ${output.summary.averageScore}%`,
    };
  }

  /**
   * Render compliance report as markdown
   */
  private renderComplianceReport(output: ComplianceOutput): string {
    const lines: string[] = [];

    // Header
    lines.push('# Compliance Report');
    lines.push('');

    // Status badge
    const statusIcon =
      output.summary.overallStatus === 'compliant'
        ? '✅'
        : output.summary.overallStatus === 'non-compliant'
          ? '🔴'
          : '🟡';
    lines.push(`**Status:** ${statusIcon} ${output.summary.overallStatus.toUpperCase()}`);
    lines.push(`**Scan Type:** ${output.scanType}`);
    lines.push(`**Timestamp:** ${output.timestamp}`);
    lines.push('');

    // Summary table
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Violations | ${output.summary.totalViolations} |`);
    lines.push(`| Critical | ${output.summary.criticalViolations} |`);
    lines.push(`| High | ${output.summary.highViolations} |`);
    lines.push(`| Average Score | ${output.summary.averageScore}% |`);
    lines.push('');

    // Active frameworks
    lines.push('## Active Frameworks');
    lines.push('');
    for (const fw of output.activeFrameworks) {
      lines.push(`- ${fw.toUpperCase()}`);
    }
    lines.push('');

    // Scores
    lines.push('## Compliance Scores');
    lines.push('');
    lines.push('| Framework | Score | Passed | Failed |');
    lines.push('|-----------|-------|--------|--------|');
    for (const score of output.scores) {
      const scoreIcon = score.score >= 80 ? '✅' : score.score >= 50 ? '🟡' : '🔴';
      lines.push(
        `| ${score.framework.toUpperCase()} | ${scoreIcon} ${score.score}% | ${score.passed} | ${score.failed} |`
      );
    }
    lines.push('');

    // Violations
    if (output.violations.length > 0) {
      lines.push('## Violations');
      lines.push('');

      // Group by severity
      const bySeverity = {
        critical: output.violations.filter((v) => v.severity === 'critical'),
        high: output.violations.filter((v) => v.severity === 'high'),
        medium: output.violations.filter((v) => v.severity === 'medium'),
        low: output.violations.filter((v) => v.severity === 'low'),
        info: output.violations.filter((v) => v.severity === 'info'),
      };

      for (const [severity, violations] of Object.entries(bySeverity)) {
        if (violations.length === 0) continue;

        const icon =
          severity === 'critical'
            ? '🔴'
            : severity === 'high'
              ? '🟠'
              : severity === 'medium'
                ? '🟡'
                : severity === 'low'
                  ? '🔵'
                  : 'ℹ️';

        lines.push(
          `### ${icon} ${severity.charAt(0).toUpperCase() + severity.slice(1)} (${violations.length})`
        );
        lines.push('');

        for (const v of violations) {
          lines.push(`#### ${v.title}`);
          lines.push('');
          lines.push(`**Rule:** ${v.rule}`);
          lines.push(`**Framework:** ${v.framework}`);
          if (v.location) {
            lines.push(`**Location:** \`${v.location.file}:${v.location.line || '?'}\``);
            if (v.location.code) {
              lines.push('');
              lines.push('```');
              lines.push(v.location.code);
              lines.push('```');
            }
          }
          lines.push('');
          lines.push(v.description);
          lines.push('');
          lines.push(`**Remediation:** ${v.remediation}`);
          lines.push('');
          if (v.references.length > 0) {
            lines.push('**References:**');
            for (const ref of v.references) {
              lines.push(`- ${ref}`);
            }
            lines.push('');
          }
        }
      }
    }

    // Security Assessment
    if (output.security) {
      lines.push('## Security Assessment');
      lines.push('');

      lines.push('### Authentication');
      lines.push(`- Implemented: ${output.security.authentication.implemented ? '✅' : '❌'}`);
      if (output.security.authentication.methods.length > 0) {
        lines.push(`- Methods: ${output.security.authentication.methods.join(', ')}`);
      }
      lines.push(`- MFA Available: ${output.security.authentication.mfaAvailable ? '✅' : '❌'}`);
      lines.push(
        `- Session Management: ${output.security.authentication.sessionManagement ? '✅' : '❌'}`
      );
      lines.push('');

      lines.push('### Authorization');
      lines.push(`- Implemented: ${output.security.authorization.implemented ? '✅' : '❌'}`);
      lines.push(`- Model: ${output.security.authorization.model}`);
      lines.push(`- Granularity: ${output.security.authorization.granularity}`);
      lines.push('');

      lines.push('### Encryption');
      lines.push(`- At Rest: ${output.security.encryption.atRest ? '✅' : '❌'}`);
      lines.push(`- In Transit: ${output.security.encryption.inTransit ? '✅' : '❌'}`);
      if (output.security.encryption.algorithms.length > 0) {
        lines.push(`- Algorithms: ${output.security.encryption.algorithms.join(', ')}`);
      }
      lines.push('');

      lines.push('### Secret Management');
      lines.push(
        `- No Hardcoded Secrets: ${output.security.secretManagement.noHardcodedSecrets ? '✅' : '❌'}`
      );
      if (output.security.secretManagement.secretsManager) {
        lines.push(`- Secrets Manager: ${output.security.secretManagement.secretsManager}`);
      }
      lines.push(`- Key Rotation: ${output.security.secretManagement.rotation ? '✅' : '❌'}`);
      lines.push('');
    }

    // Recommendations
    if (output.recommendations.length > 0) {
      lines.push('## Recommendations');
      lines.push('');

      for (const rec of output.recommendations) {
        const priorityIcon =
          rec.priority === 'critical'
            ? '🔴'
            : rec.priority === 'high'
              ? '🟠'
              : rec.priority === 'medium'
                ? '🟡'
                : '🔵';

        lines.push(`### ${priorityIcon} ${rec.title}`);
        lines.push('');
        lines.push(`**Framework:** ${rec.framework}`);
        lines.push(`**Effort:** ${rec.effort}`);
        lines.push('');
        lines.push(rec.description);
        lines.push('');

        if (rec.implementation.length > 0) {
          lines.push('**Implementation Steps:**');
          for (const step of rec.implementation) {
            lines.push(`1. ${step}`);
          }
          lines.push('');
        }
      }
    }

    // Footer
    lines.push('---');
    lines.push('*Generated by Compliance Agent*');

    return lines.join('\n');
  }

  /**
   * Render violations as CSV
   */
  private renderViolationsCSV(violations: Violation[]): string {
    const lines: string[] = [];

    // Header
    lines.push('ID,Framework,Rule,Severity,Title,File,Line,Description,Remediation,AutoFixable');

    // Data rows
    for (const v of violations) {
      const file = v.location?.file || '';
      const line = v.location?.line || '';
      // Escape CSV values
      const title = v.title.replace(/"/g, '""');
      const desc = v.description.replace(/"/g, '""');
      const rem = v.remediation.replace(/"/g, '""');

      lines.push(
        `"${v.id}","${v.framework}","${v.rule}","${v.severity}","${title}","${file}","${line}","${desc}","${rem}","${v.autoFixable}"`
      );
    }

    return lines.join('\n');
  }
}
