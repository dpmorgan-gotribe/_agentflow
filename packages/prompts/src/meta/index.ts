/**
 * Meta-Prompt Module
 *
 * Exports the meta-prompt generation and injection system.
 */

// Types
export type {
  ActivationCondition,
  Decision,
  Lesson,
  MetaPromptAuditEntry,
  MetaPromptContext,
  MetaPromptDefinition,
  MetaPromptInjectionResult,
  PreviousOutput,
  ProjectContext,
  RenderedMetaPrompt,
} from './types.js';

// Schemas and constants
export {
  ActivationConditionType,
  WorkflowState,
  activationConditionSchema,
  activationConditionTypeSchema,
  decisionSchema,
  lessonSchema,
  metaPromptContextSchema,
  metaPromptDefinitionSchema,
  previousOutputSchema,
  projectContextSchema,
  workflowStateSchema,
} from './types.js';

// Library
export {
  CONSTITUTIONAL,
  EXPERTISE_INJECTION,
  HIGHER_ORDER_THINKING,
  META_PROMPT_LIBRARY,
  REFLECTION,
  ROUTING_DECISION,
  SELF_IMPROVING,
  SYNTHESIS,
  SYSTEM_IDENTITY,
  getAlwaysActiveMetaPrompts,
  getMetaPromptById,
  getMetaPromptsByLayer,
  getMetaPromptsByPriority,
  getTotalMaxTokens,
} from './library.js';

// Injector
export { MetaPromptInjector, createMetaPromptInjector } from './injector.js';
