/**
 * Workflow Settings Schema
 *
 * Configurable parameters for the orchestrator workflow.
 */

import { z } from 'zod';

/**
 * Workflow settings schema
 */
export const WorkflowSettingsSchema = z.object({
  /**
   * Number of style packages the analyst should research/generate
   * Default: 1 (was 5 for style competition)
   */
  stylePackageCount: z.number().int().min(1).max(10).default(1),

  /**
   * Number of UI designers to run in parallel for style competition
   * Default: 1 (was 5 for full competition)
   */
  parallelDesignerCount: z.number().int().min(1).max(15).default(1),

  /**
   * Whether to enable style competition (multiple designers, user picks)
   * When false, uses stylePackageCount=1 and parallelDesignerCount=1
   */
  enableStyleCompetition: z.boolean().default(false),

  /**
   * Maximum number of style rejection iterations before requiring specific guidance
   */
  maxStyleRejections: z.number().int().min(1).max(10).default(5),

  /**
   * Claude CLI timeout in milliseconds
   */
  claudeCliTimeoutMs: z.number().int().min(60000).max(1800000).default(900000),
});

export type WorkflowSettings = z.infer<typeof WorkflowSettingsSchema>;

/**
 * Default workflow settings
 */
export const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
  stylePackageCount: 1,
  parallelDesignerCount: 1,
  enableStyleCompetition: false,
  maxStyleRejections: 5,
  claudeCliTimeoutMs: 900000, // 15 minutes
};

/**
 * Update settings schema (partial)
 */
export const UpdateWorkflowSettingsSchema = WorkflowSettingsSchema.partial();

export type UpdateWorkflowSettings = z.infer<typeof UpdateWorkflowSettingsSchema>;
