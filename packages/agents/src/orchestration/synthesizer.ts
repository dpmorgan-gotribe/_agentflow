/**
 * Synthesizer
 *
 * Aggregates and synthesizes outputs from multiple agents.
 * Detects conflicts, determines next steps, and calculates completion.
 *
 * SECURITY:
 * - Validates all agent outputs before processing
 * - Sanitizes artifact paths to prevent path traversal
 */

import type { AgentOutput, AgentType } from '../types.js';
import type { SynthesisResult, Conflict, KeyOutput } from '../schemas/orchestrator-output.js';

/**
 * Logger interface
 */
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

const defaultLogger: Logger = {
  debug: (msg, meta) => console.debug(`[Synthesizer] ${msg}`, meta || ''),
  info: (msg, meta) => console.info(`[Synthesizer] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[Synthesizer] ${msg}`, meta || ''),
};

/**
 * Merged artifact with source tracking
 */
export interface MergedArtifact {
  path: string;
  content: string;
  source: AgentType;
  overwritten: boolean;
}

/**
 * Synthesizer class - Aggregates agent outputs
 */
export class Synthesizer {
  private logger: Logger;

  constructor(options?: { logger?: Logger }) {
    this.logger = options?.logger || defaultLogger;
  }

  /**
   * Synthesize outputs from multiple agents
   */
  synthesize(outputs: AgentOutput[]): SynthesisResult {
    if (outputs.length === 0) {
      return {
        summary: 'No agent outputs to synthesize',
        keyOutputs: [],
        conflicts: [],
        nextSteps: [],
        completionStatus: 0,
      };
    }

    const keyOutputs = this.extractKeyOutputs(outputs);
    const conflicts = this.detectConflicts(outputs);
    const nextSteps = this.determineNextSteps(outputs);
    const completionStatus = this.calculateCompletion(outputs);
    const summary = this.generateSummary(outputs, completionStatus);

    this.logger.info('Synthesis complete', {
      outputCount: outputs.length,
      conflicts: conflicts.length,
      completionStatus,
    });

    return {
      summary,
      keyOutputs,
      conflicts,
      nextSteps,
      completionStatus,
    };
  }

  /**
   * Extract key outputs from all agents
   */
  private extractKeyOutputs(outputs: AgentOutput[]): KeyOutput[] {
    return outputs.map((output) => ({
      agent: output.agentId,
      output: this.summarizeOutput(output),
      artifacts: output.artifacts.map((a) => this.sanitizePath(a.path)),
      success: output.success,
    }));
  }

  /**
   * Generate a summary of all outputs
   */
  private generateSummary(outputs: AgentOutput[], completionStatus: number): string {
    const successful = outputs.filter((o) => o.success).length;
    const failed = outputs.filter((o) => !o.success).length;
    const totalArtifacts = outputs.reduce((sum, o) => sum + o.artifacts.length, 0);
    const totalTokens = outputs.reduce((sum, o) => sum + (o.metrics.tokensUsed || 0), 0);

    const lines: string[] = [
      `Processed ${outputs.length} agent(s): ${successful} succeeded, ${failed} failed`,
      `Generated ${totalArtifacts} artifact(s)`,
      `Used ${totalTokens.toLocaleString()} tokens`,
      `Completion: ${completionStatus}%`,
    ];

    if (failed > 0) {
      lines.push('');
      lines.push('Failed agents:');
      for (const output of outputs.filter((o) => !o.success)) {
        const error = output.errors?.[0]?.message || 'Unknown error';
        lines.push(`  - ${output.agentId}: ${error}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Summarize a single output
   */
  private summarizeOutput(output: AgentOutput): string {
    if (!output.success) {
      const error = output.errors?.[0];
      return `Failed: ${error?.message || 'Unknown error'}`;
    }

    const artifactCount = output.artifacts.length;
    const tokensUsed = output.metrics.tokensUsed || 0;
    const duration = output.metrics.durationMs || 0;

    return `Completed in ${duration}ms, ${artifactCount} artifacts, ${tokensUsed} tokens`;
  }

  /**
   * Detect conflicts between outputs
   */
  private detectConflicts(outputs: AgentOutput[]): Conflict[] {
    const conflicts: Conflict[] = [];

    // Detect file conflicts
    conflicts.push(...this.detectFileConflicts(outputs));

    // Detect routing conflicts
    conflicts.push(...this.detectRoutingConflicts(outputs));

    return conflicts;
  }

  /**
   * Detect file conflicts (multiple agents modifying same file)
   */
  private detectFileConflicts(outputs: AgentOutput[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const filesByAgent: Map<string, AgentType[]> = new Map();

    for (const output of outputs) {
      for (const artifact of output.artifacts) {
        const path = this.sanitizePath(artifact.path);
        const existing = filesByAgent.get(path) || [];
        existing.push(output.agentId);
        filesByAgent.set(path, existing);
      }
    }

    for (const [path, agents] of filesByAgent) {
      if (agents.length > 1) {
        conflicts.push({
          type: 'file_conflict',
          description: `Multiple agents modified ${path}: ${agents.join(', ')}`,
          resolution: 'Manual merge required',
          severity: 'medium',
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect routing conflicts (conflicting agent suggestions)
   */
  private detectRoutingConflicts(outputs: AgentOutput[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const suggestNext = new Set<AgentType>();
    const skipAgents = new Set<AgentType>();

    for (const output of outputs) {
      const hints = output.routingHints;

      // Track suggested and skipped agents
      for (const agent of hints.suggestNext) {
        if (skipAgents.has(agent)) {
          conflicts.push({
            type: 'routing_conflict',
            description: `Agent ${agent} suggested by one output but skipped by another`,
            severity: 'low',
          });
        }
        suggestNext.add(agent);
      }

      for (const agent of hints.skipAgents) {
        if (suggestNext.has(agent)) {
          conflicts.push({
            type: 'routing_conflict',
            description: `Agent ${agent} in conflict: suggested and skipped`,
            severity: 'low',
          });
        }
        skipAgents.add(agent);
      }
    }

    return conflicts;
  }

  /**
   * Determine next steps based on outputs
   */
  private determineNextSteps(outputs: AgentOutput[]): string[] {
    const steps: string[] = [];
    const nextAgents = new Set<AgentType>();

    // Check for failures
    const failedOutputs = outputs.filter((o) => !o.success);
    if (failedOutputs.length > 0) {
      steps.push(`Fix ${failedOutputs.length} failed agent(s)`);
    }

    // Collect suggested next agents
    for (const output of outputs) {
      for (const agent of output.routingHints.suggestNext) {
        nextAgents.add(agent);
      }
    }

    // Check for approvals
    if (outputs.some((o) => o.routingHints.needsApproval)) {
      steps.push('Obtain user approval');
    }

    // Add next agents
    for (const agent of nextAgents) {
      steps.push(`Execute ${agent}`);
    }

    // Check if complete
    if (outputs.length > 0 && outputs.every((o) => o.routingHints.isComplete)) {
      steps.push('Workflow complete - finalize');
    }

    return steps;
  }

  /**
   * Calculate overall completion percentage
   */
  private calculateCompletion(outputs: AgentOutput[]): number {
    if (outputs.length === 0) return 0;

    let totalWeight = 0;
    let completedWeight = 0;

    for (const output of outputs) {
      totalWeight += 1;
      if (output.success) {
        completedWeight += output.routingHints.isComplete ? 1 : 0.5;
      }
    }

    return Math.round((completedWeight / totalWeight) * 100);
  }

  /**
   * Merge artifacts from multiple outputs
   *
   * Later outputs override earlier ones for the same path.
   */
  mergeArtifacts(outputs: AgentOutput[]): Map<string, MergedArtifact> {
    const merged = new Map<string, MergedArtifact>();

    for (const output of outputs) {
      for (const artifact of output.artifacts) {
        if (!artifact.content) continue;

        const path = this.sanitizePath(artifact.path);
        const existing = merged.get(path);

        merged.set(path, {
          path,
          content: artifact.content,
          source: output.agentId,
          overwritten: !!existing,
        });

        if (existing) {
          this.logger.warn('Artifact overwritten', {
            path,
            previousSource: existing.source,
            newSource: output.agentId,
          });
        }
      }
    }

    return merged;
  }

  /**
   * Get total tokens used across all outputs
   */
  getTotalTokensUsed(outputs: AgentOutput[]): number {
    return outputs.reduce((sum, o) => sum + (o.metrics.tokensUsed || 0), 0);
  }

  /**
   * Get total duration across all outputs
   */
  getTotalDuration(outputs: AgentOutput[]): number {
    return outputs.reduce((sum, o) => sum + (o.metrics.durationMs || 0), 0);
  }

  /**
   * Sanitize file path to prevent path traversal
   *
   * SECURITY: Removes dangerous path components
   */
  private sanitizePath(path: string): string {
    // Remove null bytes
    let sanitized = path.replace(/\0/g, '');

    // Normalize path separators
    sanitized = sanitized.replace(/\\/g, '/');

    // Remove path traversal attempts
    sanitized = sanitized.replace(/\.\.\//g, '');
    sanitized = sanitized.replace(/\.\.$/g, '');

    // Remove leading slashes (prevent absolute paths)
    sanitized = sanitized.replace(/^\/+/, '');

    // Remove protocol prefixes
    sanitized = sanitized.replace(/^[a-z]+:\/\//i, '');

    return sanitized;
  }

  /**
   * Check if any outputs have blocking failures
   */
  hasBlockingFailures(outputs: AgentOutput[]): boolean {
    return outputs.some((o) => !o.success && o.routingHints.hasFailures);
  }

  /**
   * Check if all outputs are complete
   */
  isComplete(outputs: AgentOutput[]): boolean {
    return outputs.length > 0 && outputs.every((o) => o.success && o.routingHints.isComplete);
  }
}
