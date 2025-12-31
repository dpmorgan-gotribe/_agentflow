/**
 * Skill Registry
 *
 * Central registry for skill lookup and selection.
 * Provides indexed access by category, agent type, and tags.
 *
 * Features:
 * - Skill registration and retrieval
 * - Selection by criteria (agent, category, tags)
 * - Dependency resolution
 * - Conflict detection
 * - Token budget enforcement
 *
 * SECURITY:
 * - Critical skills always included (cannot be excluded by budget)
 * - Conflict resolution by priority
 */

import type { AgentType } from '../types.js';
import type {
  LoadedSkill,
  SkillCategory,
  SkillSelectionCriteria,
  SelectedSkills,
  ExcludedSkill,
  SkillPriority,
} from './types.js';
import { PRIORITY_WEIGHTS } from './types.js';

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalSkills: number;
  skillsByCategory: Record<string, number>;
  skillsByAgent: Record<string, number>;
  totalTags: number;
}

/**
 * Skill Registry implementation
 */
export class SkillRegistry {
  private skills: Map<string, LoadedSkill> = new Map();
  private byCategory: Map<SkillCategory, Set<string>> = new Map();
  private byAgent: Map<AgentType, Set<string>> = new Map();
  private byTag: Map<string, Set<string>> = new Map();
  private sealed: boolean = false;

  /**
   * Register a skill
   */
  register(skill: LoadedSkill): void {
    if (this.sealed) {
      throw new Error('Registry is sealed - cannot register new skills');
    }

    // Store skill
    this.skills.set(skill.id, skill);

    // Index by category
    if (!this.byCategory.has(skill.category)) {
      this.byCategory.set(skill.category, new Set());
    }
    this.byCategory.get(skill.category)!.add(skill.id);

    // Index by applicable agents
    for (const agent of skill.applicableAgents) {
      if (!this.byAgent.has(agent)) {
        this.byAgent.set(agent, new Set());
      }
      this.byAgent.get(agent)!.add(skill.id);
    }

    // Index by tags
    for (const tag of skill.tags) {
      if (!this.byTag.has(tag)) {
        this.byTag.set(tag, new Set());
      }
      this.byTag.get(tag)!.add(skill.id);
    }
  }

  /**
   * Register multiple skills
   */
  registerAll(skills: LoadedSkill[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /**
   * Seal the registry (prevent further registrations)
   */
  seal(): void {
    this.sealed = true;
  }

  /**
   * Check if registry is sealed
   */
  isSealed(): boolean {
    return this.sealed;
  }

  /**
   * Get skill by ID
   */
  get(id: string): LoadedSkill | undefined {
    return this.skills.get(id);
  }

  /**
   * Check if skill exists
   */
  has(id: string): boolean {
    return this.skills.has(id);
  }

  /**
   * Get all skills
   */
  getAll(): LoadedSkill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skill count
   */
  get size(): number {
    return this.skills.size;
  }

  /**
   * Select skills based on criteria
   */
  select(criteria: SkillSelectionCriteria): SelectedSkills {
    const candidates: LoadedSkill[] = [];
    const excluded: ExcludedSkill[] = [];

    // Start with skills applicable to this agent
    const agentSkills = this.byAgent.get(criteria.agentType) || new Set();

    for (const skillId of agentSkills) {
      const skill = this.skills.get(skillId);
      if (!skill) continue;

      // Check category filter
      if (criteria.category && skill.category !== criteria.category) {
        continue;
      }

      // Check tag filter
      if (criteria.tags && criteria.tags.length > 0) {
        const hasTag = criteria.tags.some((tag) => skill.tags.includes(tag));
        if (!hasTag) {
          continue;
        }
      }

      // Check exclusions
      if (criteria.excludeSkills?.includes(skill.id)) {
        excluded.push({ skill, reason: 'explicitly excluded' });
        continue;
      }

      // Check language condition
      if (skill.conditions?.languages && criteria.language) {
        if (!skill.conditions.languages.includes(criteria.language)) {
          excluded.push({
            skill,
            reason: `language mismatch: requires ${skill.conditions.languages.join('|')}, got ${criteria.language}`,
          });
          continue;
        }
      }

      // Check framework condition
      if (skill.conditions?.frameworks && criteria.framework) {
        if (!skill.conditions.frameworks.includes(criteria.framework)) {
          excluded.push({
            skill,
            reason: `framework mismatch: requires ${skill.conditions.frameworks.join('|')}, got ${criteria.framework}`,
          });
          continue;
        }
      }

      // Check project type condition
      if (skill.conditions?.projectTypes && criteria.projectType) {
        if (!skill.conditions.projectTypes.includes(criteria.projectType)) {
          excluded.push({
            skill,
            reason: `project type mismatch: requires ${skill.conditions.projectTypes.join('|')}, got ${criteria.projectType}`,
          });
          continue;
        }
      }

      candidates.push(skill);
    }

    // Add required skills
    if (criteria.requiredSkills) {
      for (const requiredId of criteria.requiredSkills) {
        const skill = this.skills.get(requiredId);
        if (skill && !candidates.find((c) => c.id === requiredId)) {
          candidates.push(skill);
        }
      }
    }

    // Resolve dependencies
    const resolved = this.resolveDependencies(candidates);

    // Check for conflicts
    const conflictFree = this.removeConflicts(resolved, excluded);

    // Sort by priority
    const sorted = this.sortByPriority(conflictFree);

    // Apply token budget
    const selected = this.applyTokenBudget(sorted, criteria.maxTokens, excluded);

    return {
      skills: selected,
      totalTokens: selected.reduce((sum, s) => sum + s.tokenBudget, 0),
      excluded,
    };
  }

  /**
   * Resolve skill dependencies
   */
  private resolveDependencies(skills: LoadedSkill[]): LoadedSkill[] {
    const result = new Map<string, LoadedSkill>();
    const visited = new Set<string>();

    const addWithDeps = (skill: LoadedSkill): void => {
      if (visited.has(skill.id)) return;
      visited.add(skill.id);

      // Add dependencies first
      for (const depId of skill.requiredSkills) {
        const dep = this.skills.get(depId);
        if (dep) {
          addWithDeps(dep);
        }
      }

      result.set(skill.id, skill);
    };

    for (const skill of skills) {
      addWithDeps(skill);
    }

    return Array.from(result.values());
  }

  /**
   * Remove conflicting skills (higher priority wins)
   */
  private removeConflicts(
    skills: LoadedSkill[],
    excluded: ExcludedSkill[]
  ): LoadedSkill[] {
    const result: LoadedSkill[] = [];
    const includedIds = new Set<string>();

    // Sort by priority first so higher priority wins
    const sorted = [...skills].sort(
      (a, b) => PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
    );

    for (const skill of sorted) {
      // Check if any included skill conflicts with this one
      const hasConflict = skill.conflictingSkills.some((id) =>
        includedIds.has(id)
      );

      if (hasConflict) {
        excluded.push({
          skill,
          reason: 'conflicts with higher priority skill',
        });
        continue;
      }

      result.push(skill);
      includedIds.add(skill.id);
    }

    return result;
  }

  /**
   * Sort skills by priority (descending)
   */
  private sortByPriority(skills: LoadedSkill[]): LoadedSkill[] {
    return [...skills].sort(
      (a, b) => PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
    );
  }

  /**
   * Apply token budget constraint
   * Critical skills are always included even if over budget
   */
  private applyTokenBudget(
    skills: LoadedSkill[],
    maxTokens: number | undefined,
    excluded: ExcludedSkill[]
  ): LoadedSkill[] {
    if (!maxTokens) {
      return skills;
    }

    const result: LoadedSkill[] = [];
    let totalTokens = 0;

    for (const skill of skills) {
      if (totalTokens + skill.tokenBudget <= maxTokens) {
        result.push(skill);
        totalTokens += skill.tokenBudget;
      } else if (skill.priority === 'critical') {
        // Critical skills always included even if over budget
        result.push(skill);
        totalTokens += skill.tokenBudget;
      } else {
        excluded.push({
          skill,
          reason: `token budget exceeded (${totalTokens + skill.tokenBudget} > ${maxTokens})`,
        });
      }
    }

    return result;
  }

  /**
   * Get skills by category
   */
  getByCategory(category: SkillCategory): LoadedSkill[] {
    const ids = this.byCategory.get(category) || new Set();
    return Array.from(ids)
      .map((id) => this.skills.get(id))
      .filter((s): s is LoadedSkill => s !== undefined);
  }

  /**
   * Get skills by agent type
   */
  getByAgent(agent: AgentType): LoadedSkill[] {
    const ids = this.byAgent.get(agent) || new Set();
    return Array.from(ids)
      .map((id) => this.skills.get(id))
      .filter((s): s is LoadedSkill => s !== undefined);
  }

  /**
   * Get skills by tag
   */
  getByTag(tag: string): LoadedSkill[] {
    const ids = this.byTag.get(tag) || new Set();
    return Array.from(ids)
      .map((id) => this.skills.get(id))
      .filter((s): s is LoadedSkill => s !== undefined);
  }

  /**
   * Get all unique tags
   */
  getAllTags(): string[] {
    return Array.from(this.byTag.keys()).sort();
  }

  /**
   * Get all categories with skills
   */
  getAllCategories(): SkillCategory[] {
    return Array.from(this.byCategory.keys());
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const skillsByCategory: Record<string, number> = {};
    for (const [category, ids] of this.byCategory) {
      skillsByCategory[category] = ids.size;
    }

    const skillsByAgent: Record<string, number> = {};
    for (const [agent, ids] of this.byAgent) {
      skillsByAgent[agent] = ids.size;
    }

    return {
      totalSkills: this.skills.size,
      skillsByCategory,
      skillsByAgent,
      totalTags: this.byTag.size,
    };
  }

  /**
   * Clear registry
   */
  clear(): void {
    this.skills.clear();
    this.byCategory.clear();
    this.byAgent.clear();
    this.byTag.clear();
    this.sealed = false;
  }
}

/**
 * Singleton registry instance
 */
let globalRegistry: SkillRegistry | null = null;

/**
 * Get global skill registry
 */
export function getSkillRegistry(): SkillRegistry {
  if (!globalRegistry) {
    globalRegistry = new SkillRegistry();
  }
  return globalRegistry;
}

/**
 * Reset global skill registry (for testing)
 */
export function resetSkillRegistry(): void {
  if (globalRegistry) {
    globalRegistry.clear();
  }
  globalRegistry = null;
}
