/**
 * @aigentflow/agents - Agent Framework
 *
 * Core agent infrastructure for Aigentflow orchestration.
 * Provides base classes, registry, and context management for agents.
 *
 * @packageDocumentation
 */

// Types and schemas
export {
  // Enums
  AgentTypeEnum,
  ContextTypeEnum,
  ArtifactTypeEnum,
  // Schemas
  AgentTypeSchema,
  ContextTypeSchema,
  ArtifactTypeSchema,
  TaskAnalysisSchema,
  AuthContextSchema,
  AgentCapabilitySchema,
  ContextRequirementSchema,
  AgentMetadataSchema,
  ContextItemSchema,
  AgentConstraintsSchema,
  AgentContextSchema,
  RoutingHintsSchema,
  ArtifactSchema,
  ExecutionMetricsSchema,
  AgentErrorSchema,
  AgentOutputSchema,
  AgentExecutionOptionsSchema,
  AgentRequestSchema,
  AgentStatusSchema,
  // Types
  type AgentType,
  type ContextType,
  type ArtifactType,
  type TaskAnalysis,
  type AuthContext,
  type AgentCapability,
  type ContextRequirement,
  type AgentMetadata,
  type ContextItem,
  type AgentConstraints,
  type AgentContext,
  type RoutingHints,
  type Artifact,
  type ExecutionMetrics,
  type AgentError,
  type AgentOutput,
  type AgentExecutionOptions,
  type AgentRequest,
  type AgentStatus,
  // Constants
  DEFAULT_CONSTRAINTS,
  // Errors
  SecurityViolationError,
  AgentValidationError,
  AgentExecutionError,
} from './types.js';

// Base agent
export { BaseAgent } from './base-agent.js';

// Registry
export {
  AgentRegistry,
  getRegistry,
  RegisterAgent,
  type RegistryStats,
} from './registry.js';

// Context manager
export {
  ContextManager,
  createMemoryContextSource,
  DEFAULT_CONTEXT_BUDGET,
  ContextFetchParamsSchema,
  type ContextSource,
  type ContextFetchParams,
  type ContextBudget,
  type CuratedContext,
} from './context-manager.js';
