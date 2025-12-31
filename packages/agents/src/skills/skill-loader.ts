/**
 * Skill Loader
 *
 * Pure functions for loading and validating skill packs.
 * No filesystem access - CLI layer provides skill pack data.
 *
 * Features:
 * - Load skill packs from JSON/YAML data
 * - Validate skill definitions
 * - Convert to LoadedSkill format
 * - Register with SkillRegistry
 *
 * SECURITY:
 * - Zod validation on all loaded data
 * - Path validation for skill references
 * - String length limits enforced
 */

import type {
  SkillPack,
  SkillDefinition,
  LoadedSkill,
  SkillSource,
} from './types.js';
import {
  SkillPackSchema,
  SkillDefinitionSchema,
  toLoadedSkill,
  safeParseSkillPack,
} from './types.js';
import { SkillRegistry, getSkillRegistry } from './skill-registry.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of loading a skill pack
 */
export interface LoadResult {
  success: boolean;
  packId: string;
  loadedCount: number;
  errors: LoadError[];
}

/**
 * Loading error details
 */
export interface LoadError {
  skillId?: string;
  packId?: string;
  message: string;
  path?: string;
}

/**
 * Options for loading skills
 */
export interface LoadOptions {
  /** Source type for loaded skills */
  source: SkillSource;
  /** Whether to replace existing skills with same ID */
  overwrite?: boolean;
  /** Custom registry to load into (defaults to global) */
  registry?: SkillRegistry;
  /** Validate skills before loading */
  validate?: boolean;
}

/**
 * Validation result for a skill pack
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a skill pack structure
 */
export function validateSkillPack(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Basic schema validation
  const parseResult = safeParseSkillPack(data);

  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      });
    }
    return { valid: false, errors, warnings };
  }

  const pack = parseResult.data;

  // Additional semantic validation
  const skillIds = new Set<string>();
  for (const skill of pack.skills) {
    // Check for duplicate IDs within pack
    if (skillIds.has(skill.id)) {
      errors.push({
        path: `skills.${skill.id}`,
        message: `Duplicate skill ID: ${skill.id}`,
        code: 'DUPLICATE_ID',
      });
    }
    skillIds.add(skill.id);

    // Warn about large token budgets
    if (skill.tokenBudget > 10000) {
      warnings.push({
        path: `skills.${skill.id}.tokenBudget`,
        message: `Large token budget (${skill.tokenBudget}) may impact performance`,
        suggestion: 'Consider splitting into smaller skills',
      });
    }

    // Check for circular dependencies
    if (skill.requiredSkills.includes(skill.id)) {
      errors.push({
        path: `skills.${skill.id}.requiredSkills`,
        message: `Skill cannot require itself: ${skill.id}`,
        code: 'SELF_DEPENDENCY',
      });
    }

    // Check for conflicting with required
    for (const required of skill.requiredSkills) {
      if (skill.conflictingSkills.includes(required)) {
        errors.push({
          path: `skills.${skill.id}`,
          message: `Skill ${skill.id} both requires and conflicts with ${required}`,
          code: 'CONFLICT_REQUIRED',
        });
      }
    }

    // Warn about missing examples for complex skills
    if (skill.tokenBudget > 500 && (!skill.examples || skill.examples.length === 0)) {
      warnings.push({
        path: `skills.${skill.id}.examples`,
        message: 'Complex skill lacks examples for few-shot learning',
        suggestion: 'Add 1-3 examples to improve agent performance',
      });
    }

    // Check required skill references exist in pack
    for (const requiredId of skill.requiredSkills) {
      if (!pack.skills.find((s) => s.id === requiredId) && !requiredId.includes(':')) {
        warnings.push({
          path: `skills.${skill.id}.requiredSkills`,
          message: `Required skill "${requiredId}" not found in this pack`,
          suggestion: 'Ensure the required skill exists in another loaded pack',
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate a single skill definition
 */
export function validateSkillDefinition(data: unknown): {
  valid: boolean;
  skill?: SkillDefinition;
  errors: string[];
} {
  const result = SkillDefinitionSchema.safeParse(data);
  if (result.success) {
    return { valid: true, skill: result.data, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  };
}

// ============================================================================
// Loading
// ============================================================================

/**
 * Load a skill pack into a registry
 */
export function loadSkillPack(
  data: unknown,
  options: LoadOptions
): LoadResult {
  const registry = options.registry || getSkillRegistry();
  const errors: LoadError[] = [];
  let loadedCount = 0;

  // Validate if requested
  if (options.validate !== false) {
    const validation = validateSkillPack(data);
    if (!validation.valid) {
      return {
        success: false,
        packId: '',
        loadedCount: 0,
        errors: validation.errors.map((e) => ({
          message: e.message,
          path: e.path,
        })),
      };
    }
  }

  // Parse the pack
  const parseResult = safeParseSkillPack(data);
  if (!parseResult.success) {
    return {
      success: false,
      packId: '',
      loadedCount: 0,
      errors: [{ message: 'Invalid skill pack format' }],
    };
  }

  const pack = parseResult.data;

  // Check if registry is sealed
  if (registry.isSealed()) {
    return {
      success: false,
      packId: pack.id,
      loadedCount: 0,
      errors: [{ message: 'Registry is sealed - cannot load new skills', packId: pack.id }],
    };
  }

  // Load each skill
  for (const skill of pack.skills) {
    // Check for existing skill
    if (registry.has(skill.id) && !options.overwrite) {
      errors.push({
        skillId: skill.id,
        packId: pack.id,
        message: `Skill "${skill.id}" already exists (use overwrite: true to replace)`,
      });
      continue;
    }

    try {
      const loaded = toLoadedSkill(skill, pack.id, options.source);
      registry.register(loaded);
      loadedCount++;
    } catch (err) {
      errors.push({
        skillId: skill.id,
        packId: pack.id,
        message: err instanceof Error ? err.message : 'Unknown error loading skill',
      });
    }
  }

  return {
    success: errors.length === 0,
    packId: pack.id,
    loadedCount,
    errors,
  };
}

/**
 * Load multiple skill packs
 */
export function loadSkillPacks(
  packs: unknown[],
  options: LoadOptions
): LoadResult[] {
  return packs.map((pack) => loadSkillPack(pack, options));
}

/**
 * Load a single skill definition (not a pack)
 */
export function loadSkill(
  data: unknown,
  packId: string,
  options: LoadOptions
): { success: boolean; error?: string } {
  const registry = options.registry || getSkillRegistry();

  if (registry.isSealed()) {
    return { success: false, error: 'Registry is sealed' };
  }

  const validation = validateSkillDefinition(data);
  if (!validation.valid || !validation.skill) {
    return { success: false, error: validation.errors.join('; ') };
  }

  if (registry.has(validation.skill.id) && !options.overwrite) {
    return {
      success: false,
      error: `Skill "${validation.skill.id}" already exists`,
    };
  }

  const loaded = toLoadedSkill(validation.skill, packId, options.source);
  registry.register(loaded);
  return { success: true };
}

// ============================================================================
// Built-in Skills
// ============================================================================

/**
 * Platform built-in skills that are always available
 */
export const BUILT_IN_SKILLS: SkillDefinition[] = [
  {
    id: 'security-awareness',
    name: 'Security Awareness',
    version: '1.0.0',
    description: 'Core security guidelines for all agents',
    category: 'security',
    tags: ['security', 'core', 'mandatory'],
    instructions: `## Security Guidelines

ALWAYS follow these security practices:

1. **Input Validation**: Validate all inputs using Zod schemas
2. **Output Sanitization**: Sanitize all outputs to prevent XSS
3. **SQL Safety**: Use parameterized queries, never string concatenation
4. **Secrets**: Never hardcode secrets, use environment variables
5. **Authentication**: Require auth on all endpoints
6. **Authorization**: Check permissions before operations
7. **Audit Logging**: Log sensitive operations

Report any potential security vulnerabilities immediately.`,
    tokenBudget: 300,
    priority: 'critical',
    applicableAgents: [
      'orchestrator',
      'planner',
      'architect',
      'analyzer',
      'project_manager',
      'project_analyzer',
      'compliance',
      'compliance_agent',
      'ui_designer',
      'frontend_dev',
      'backend_dev',
      'tester',
      'reviewer',
    ],
    requiredSkills: [],
    conflictingSkills: [],
  },
  {
    id: 'output-format',
    name: 'Output Format',
    version: '1.0.0',
    description: 'Standard output formatting requirements',
    category: 'coding',
    tags: ['output', 'core', 'format'],
    instructions: `## Output Format Requirements

All structured outputs MUST:

1. Be valid JSON matching the agent's output schema
2. Include all required fields
3. Use proper data types (strings, numbers, booleans, arrays, objects)
4. Not exceed token limits
5. Be parseable without errors

For code outputs:
- Use consistent indentation (2 spaces)
- Include proper imports
- Add JSDoc comments for public APIs
- Follow TypeScript strict mode`,
    tokenBudget: 200,
    priority: 'high',
    applicableAgents: [
      'orchestrator',
      'planner',
      'architect',
      'analyzer',
      'project_manager',
      'project_analyzer',
      'compliance',
      'compliance_agent',
      'ui_designer',
      'frontend_dev',
      'backend_dev',
      'tester',
    ],
    requiredSkills: [],
    conflictingSkills: [],
  },
  {
    id: 'error-handling',
    name: 'Error Handling',
    version: '1.0.0',
    description: 'Standard error handling patterns',
    category: 'coding',
    tags: ['errors', 'core', 'patterns'],
    instructions: `## Error Handling Patterns

When writing code:

1. **Use Typed Errors**:
   \`\`\`typescript
   class DomainError extends Error {
     constructor(
       message: string,
       public code: string,
       public context?: Record<string, unknown>
     ) {
       super(message);
     }
   }
   \`\`\`

2. **Catch Specifically**: Don't catch generic Error, catch specific types
3. **Log with Context**: Include relevant context in error logs
4. **Fail Fast**: Validate early, fail with clear messages
5. **Recovery**: Implement retry logic where appropriate`,
    tokenBudget: 250,
    priority: 'high',
    applicableAgents: [
      'frontend_dev',
      'backend_dev',
      'architect',
      'tester',
    ],
    requiredSkills: [],
    conflictingSkills: [],
  },
];

/**
 * Create built-in skill pack
 */
export function getBuiltInSkillPack(): SkillPack {
  return {
    id: 'aigentflow-core',
    name: 'Aigentflow Core Skills',
    version: '1.0.0',
    description: 'Core skills that are always available to all agents',
    skills: BUILT_IN_SKILLS,
  };
}

/**
 * Load built-in skills into registry
 */
export function loadBuiltInSkills(registry?: SkillRegistry): LoadResult {
  return loadSkillPack(getBuiltInSkillPack(), {
    source: 'built-in',
    registry,
    validate: true,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Merge multiple skill packs into one
 */
export function mergeSkillPacks(
  packs: SkillPack[],
  newId: string,
  newName: string
): SkillPack {
  const allSkills: SkillDefinition[] = [];
  const seenIds = new Set<string>();

  for (const pack of packs) {
    for (const skill of pack.skills) {
      if (!seenIds.has(skill.id)) {
        allSkills.push(skill);
        seenIds.add(skill.id);
      }
    }
  }

  return {
    id: newId,
    name: newName,
    version: '1.0.0',
    description: `Merged from: ${packs.map((p) => p.name).join(', ')}`,
    skills: allSkills,
  };
}

/**
 * Filter skills from a pack by criteria
 */
export function filterSkillPack(
  pack: SkillPack,
  predicate: (skill: SkillDefinition) => boolean
): SkillPack {
  return {
    ...pack,
    skills: pack.skills.filter(predicate),
  };
}

/**
 * Get skill pack summary
 */
export function getPackSummary(pack: SkillPack): {
  id: string;
  name: string;
  skillCount: number;
  totalTokens: number;
  categories: string[];
  tags: string[];
} {
  const categories = new Set<string>();
  const tags = new Set<string>();
  let totalTokens = 0;

  for (const skill of pack.skills) {
    categories.add(skill.category);
    for (const tag of skill.tags) {
      tags.add(tag);
    }
    totalTokens += skill.tokenBudget;
  }

  return {
    id: pack.id,
    name: pack.name,
    skillCount: pack.skills.length,
    totalTokens,
    categories: Array.from(categories).sort(),
    tags: Array.from(tags).sort(),
  };
}
