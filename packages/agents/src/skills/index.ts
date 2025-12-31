/**
 * Skills Framework Module
 *
 * Modular capability packs that extend agent functionality.
 * Skills are loaded, selected, and injected into agent prompts.
 *
 * @module skills
 */

// Types and schemas
export {
  // Schemas
  SkillCategorySchema,
  SkillPrioritySchema,
  SkillExampleSchema,
  SkillConditionsSchema,
  SkillDefinitionSchema,
  SkillPackSchema,
  SkillSourceSchema,
  LoadedSkillSchema,
  SkillSelectionCriteriaSchema,
  // Types
  type SkillCategory,
  type SkillPriority,
  type SkillExample,
  type SkillConditions,
  type SkillDefinition,
  type SkillPack,
  type SkillSource,
  type LoadedSkill,
  type SkillSelectionCriteria,
  type ExcludedSkill,
  type SelectedSkills,
  type SkillInjection,
  // Constants
  SKILL_CATEGORIES,
  PRIORITY_WEIGHTS,
  // Helper functions
  createSkillDefinition,
  createSkillPack,
  toLoadedSkill,
  calculateTotalTokens,
  filterByCategory,
  filterByTag,
  sortByPriority,
  getUniqueTags,
  validateSkillPack,
  safeParseSkillPack,
} from './types.js';

// Registry
export {
  SkillRegistry,
  getSkillRegistry,
  resetSkillRegistry,
  type RegistryStats,
} from './skill-registry.js';

// Loader
export {
  loadSkillPack,
  loadSkillPacks,
  loadSkill,
  loadBuiltInSkills,
  getBuiltInSkillPack,
  validateSkillPack as validatePack,
  validateSkillDefinition,
  mergeSkillPacks,
  filterSkillPack,
  getPackSummary,
  BUILT_IN_SKILLS,
  type LoadResult,
  type LoadError,
  type LoadOptions,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
} from './skill-loader.js';

// Injector
export {
  injectSkills,
  injectSkillsMinimal,
  injectSkillsCompact,
  injectSkillsXml,
  formatSkillList,
  getSkillsSummary,
  type InjectionFormat,
  type InjectionOptions,
} from './skill-injector.js';
