/**
 * @aigentflow/prompts
 *
 * 18-layer prompt architecture for Aigentflow agents.
 * Provides structured prompt composition with security validation.
 */

// Types (type-only exports)
export type {
  ComposedPrompt,
  CompositionOptions,
  CustomVariables,
  PromptAuditEntry,
  PromptLayer,
  PromptTemplate,
  PromptVariables,
  TokenAllocation,
  TokenCount,
  VariableValidation,
} from './types.js';

// Constants and schemas (AgentType and LayerCategory are both type and const)
export {
  AgentType,
  DEFAULT_TOKEN_ALLOCATION,
  LayerCategory,
  agentTypeSchema,
  composedPromptSchema,
  compositionOptionsSchema,
  customVariablesSchema,
  layerCategorySchema,
  promptLayerSchema,
  promptTemplateSchema,
  promptVariablesSchema,
  tokenAllocationSchema,
  tokenCountSchema,
} from './types.js';

// Layer definitions
export {
  PROMPT_LAYERS,
  getAllRequiredVariables,
  getLayerById,
  getLayersByCategory,
  getLayersByPriority,
  getRequiredLayers,
  validateLayer,
} from './prompt-layer.js';

// Composer
export { PromptComposer, createPromptComposer } from './prompt-composer.js';

// Token allocator
export { TokenAllocator } from './token-allocator.js';
export type { CategoryUsage } from './token-allocator.js';

// Registry
export { PromptRegistry } from './prompt-registry.js';

// Errors
export {
  CompositionError,
  PromptError,
  PromptLayerError,
  PromptRegistryError,
  TokenBudgetError,
  VariableResolutionError,
  VariableValidationError,
} from './errors.js';
