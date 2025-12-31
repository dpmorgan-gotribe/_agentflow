/**
 * Skills Framework Types
 *
 * Defines schemas for skill definitions, packs, and selection.
 * Skills are modular capability packs that extend agent functionality.
 *
 * SECURITY:
 * - Skill ID validation (alphanumeric, hyphens only)
 * - Token budget limits
 * - String length limits
 */

import { z } from 'zod';
import { AgentTypeSchema } from '../types.js';

// ============================================================================
// Skill Categories
// ============================================================================

/**
 * Skill categories
 */
export const SkillCategorySchema = z.enum([
  'coding', // Code generation and manipulation
  'testing', // Test writing and execution
  'security', // Security analysis and hardening
  'compliance', // Compliance checking and remediation
  'documentation', // Documentation generation
  'analysis', // Code analysis and metrics
  'devops', // CI/CD and deployment
  'database', // Database operations
  'api', // API design and implementation
  'ui', // UI/UX implementation
]);

export type SkillCategory = z.infer<typeof SkillCategorySchema>;

/**
 * All skill categories
 */
export const SKILL_CATEGORIES = SkillCategorySchema.options;

// ============================================================================
// Skill Priority
// ============================================================================

/**
 * Skill priority levels
 */
export const SkillPrioritySchema = z.enum([
  'critical', // Must be included
  'high', // Should be included if space allows
  'medium', // Include if relevant
  'low', // Include only if specifically requested
]);

export type SkillPriority = z.infer<typeof SkillPrioritySchema>;

/**
 * Priority weights for sorting
 */
export const PRIORITY_WEIGHTS: Record<SkillPriority, number> = {
  critical: 1000,
  high: 100,
  medium: 10,
  low: 1,
};

// ============================================================================
// Skill Example
// ============================================================================

/**
 * Skill example for few-shot learning
 */
export const SkillExampleSchema = z.object({
  scenario: z.string().min(1).max(200),
  input: z.string().max(2000),
  output: z.string().max(5000),
});

export type SkillExample = z.infer<typeof SkillExampleSchema>;

// ============================================================================
// Skill Conditions
// ============================================================================

/**
 * Conditions for skill applicability
 */
export const SkillConditionsSchema = z.object({
  languages: z.array(z.string().max(50)).optional(),
  frameworks: z.array(z.string().max(50)).optional(),
  projectTypes: z.array(z.string().max(50)).optional(),
  customCondition: z.string().max(500).optional(),
});

export type SkillConditions = z.infer<typeof SkillConditionsSchema>;

// ============================================================================
// Skill Definition
// ============================================================================

/**
 * Safe skill ID regex - alphanumeric with hyphens
 */
const SAFE_SKILL_ID_REGEX = /^[a-z][a-z0-9-]*$/;

/**
 * Skill definition schema
 */
export const SkillDefinitionSchema = z.object({
  // Identity
  id: z
    .string()
    .min(1)
    .max(100)
    .refine((id) => SAFE_SKILL_ID_REGEX.test(id), {
      message: 'Skill ID must start with letter and contain only lowercase alphanumeric and hyphens',
    }),
  name: z.string().min(1).max(100),
  version: z
    .string()
    .max(20)
    .refine((v) => /^\d+\.\d+\.\d+$/.test(v), {
      message: 'Version must be in semver format (e.g., 1.0.0)',
    }),
  description: z.string().max(500),

  // Classification
  category: SkillCategorySchema,
  tags: z.array(z.string().max(50)),

  // Content
  instructions: z.string().min(1).max(10000),
  examples: z.array(SkillExampleSchema).optional(),

  // Constraints
  tokenBudget: z.number().int().min(1).max(50000),
  priority: SkillPrioritySchema,

  // Applicability
  applicableAgents: z.array(AgentTypeSchema),
  requiredSkills: z.array(z.string().max(100)).default([]),
  conflictingSkills: z.array(z.string().max(100)).default([]),

  // Conditions
  conditions: SkillConditionsSchema.optional(),
});

export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

// ============================================================================
// Skill Pack
// ============================================================================

/**
 * Skill pack - collection of related skills
 */
export const SkillPackSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(100)
    .refine((id) => SAFE_SKILL_ID_REGEX.test(id), {
      message: 'Pack ID must start with letter and contain only lowercase alphanumeric and hyphens',
    }),
  name: z.string().min(1).max(100),
  version: z.string().max(20),
  description: z.string().max(1000),
  skills: z.array(SkillDefinitionSchema),
  metadata: z.record(z.string().max(100), z.unknown()).optional(),
});

export type SkillPack = z.infer<typeof SkillPackSchema>;

// ============================================================================
// Loaded Skill
// ============================================================================

/**
 * Skill source types
 */
export const SkillSourceSchema = z.enum(['built-in', 'project', 'external']);
export type SkillSource = z.infer<typeof SkillSourceSchema>;

/**
 * Loaded skill with runtime info
 */
export interface LoadedSkill extends SkillDefinition {
  packId: string;
  loadedAt: Date;
  source: SkillSource;
}

/**
 * Schema for loaded skill (extends SkillDefinition)
 */
export const LoadedSkillSchema = SkillDefinitionSchema.extend({
  packId: z.string().max(100),
  loadedAt: z.date(),
  source: SkillSourceSchema,
});

// ============================================================================
// Skill Selection
// ============================================================================

/**
 * Skill selection criteria
 */
export const SkillSelectionCriteriaSchema = z.object({
  agentType: AgentTypeSchema,
  category: SkillCategorySchema.optional(),
  tags: z.array(z.string().max(50)).optional(),
  language: z.string().max(50).optional(),
  framework: z.string().max(50).optional(),
  projectType: z.string().max(50).optional(),
  maxTokens: z.number().int().min(0).optional(),
  requiredSkills: z.array(z.string().max(100)).optional(),
  excludeSkills: z.array(z.string().max(100)).optional(),
});

export type SkillSelectionCriteria = z.infer<typeof SkillSelectionCriteriaSchema>;

/**
 * Excluded skill info
 */
export interface ExcludedSkill {
  skill: LoadedSkill;
  reason: string;
}

/**
 * Selected skills result
 */
export interface SelectedSkills {
  skills: LoadedSkill[];
  totalTokens: number;
  excluded: ExcludedSkill[];
}

// ============================================================================
// Skill Injection
// ============================================================================

/**
 * Skill injection result
 */
export interface SkillInjection {
  content: string;
  tokenCount: number;
  skills: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a skill definition
 */
export function createSkillDefinition(
  id: string,
  name: string,
  category: SkillCategory,
  instructions: string,
  applicableAgents: string[],
  options: Partial<Omit<SkillDefinition, 'id' | 'name' | 'category' | 'instructions' | 'applicableAgents'>> = {}
): SkillDefinition {
  return {
    id,
    name,
    version: options.version || '1.0.0',
    description: options.description || name,
    category,
    tags: options.tags || [],
    instructions,
    examples: options.examples,
    tokenBudget: options.tokenBudget || 200,
    priority: options.priority || 'medium',
    applicableAgents: applicableAgents as SkillDefinition['applicableAgents'],
    requiredSkills: options.requiredSkills || [],
    conflictingSkills: options.conflictingSkills || [],
    conditions: options.conditions,
  };
}

/**
 * Create a skill pack
 */
export function createSkillPack(
  id: string,
  name: string,
  description: string,
  skills: SkillDefinition[],
  version: string = '1.0.0'
): SkillPack {
  return {
    id,
    name,
    version,
    description,
    skills,
  };
}

/**
 * Convert skill definition to loaded skill
 */
export function toLoadedSkill(
  definition: SkillDefinition,
  packId: string,
  source: SkillSource
): LoadedSkill {
  return {
    ...definition,
    packId,
    loadedAt: new Date(),
    source,
  };
}

/**
 * Calculate total token budget for skills
 */
export function calculateTotalTokens(skills: LoadedSkill[]): number {
  return skills.reduce((sum, skill) => sum + skill.tokenBudget, 0);
}

/**
 * Filter skills by category
 */
export function filterByCategory(
  skills: LoadedSkill[],
  category: SkillCategory
): LoadedSkill[] {
  return skills.filter((s) => s.category === category);
}

/**
 * Filter skills by tag
 */
export function filterByTag(skills: LoadedSkill[], tag: string): LoadedSkill[] {
  return skills.filter((s) => s.tags.includes(tag));
}

/**
 * Sort skills by priority (descending)
 */
export function sortByPriority(skills: LoadedSkill[]): LoadedSkill[] {
  return [...skills].sort(
    (a, b) => PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
  );
}

/**
 * Get unique tags from skills
 */
export function getUniqueTags(skills: LoadedSkill[]): string[] {
  const tags = new Set<string>();
  for (const skill of skills) {
    for (const tag of skill.tags) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort();
}

/**
 * Validate skill pack structure
 */
export function validateSkillPack(data: unknown): SkillPack {
  return SkillPackSchema.parse(data);
}

/**
 * Safe parse skill pack (returns result object)
 */
export function safeParseSkillPack(
  data: unknown
): { success: true; data: SkillPack } | { success: false; error: z.ZodError } {
  const result = SkillPackSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
