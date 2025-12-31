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

// Orchestrator schemas
export {
  TaskClassificationSchema,
  RoutingDecisionSchema,
  ReasoningResultSchema,
  OrchestratorPhaseSchema,
  OrchestratorStateSchema,
  ConflictSchema,
  KeyOutputSchema,
  SynthesisResultSchema,
  FailureAnalysisSchema,
  DecisionContextSchema,
  OrchestratorOutputSchema,
  UserInputSchema,
  OrchestrationConfigSchema,
  DEFAULT_ORCHESTRATION_CONFIG,
  type TaskClassification,
  type RoutingDecision,
  type ReasoningResult,
  type OrchestratorPhase,
  type OrchestratorState,
  type Conflict,
  type KeyOutput,
  type SynthesisResult,
  type FailureAnalysis,
  type DecisionContext,
  type OrchestratorOutput,
  type OrchestrationConfig,
} from './schemas/orchestrator-output.js';

// Orchestration components
export {
  DecisionEngine,
  type DecisionResult,
} from './orchestration/decision-engine.js';

export {
  Router,
  type RoutingResult,
} from './orchestration/router.js';

export {
  Synthesizer,
  type MergedArtifact,
} from './orchestration/synthesizer.js';

// Orchestrator agent
export { OrchestratorAgent } from './agents/orchestrator.js';

// Project Manager schemas
export {
  TaskTypeSchema,
  ComplexitySchema,
  PrioritySchema,
  RiskSeveritySchema,
  RiskSchema,
  TaskSchema,
  FeatureSchema,
  EpicSchema,
  BlockerSchema,
  WorkBreakdownSummarySchema,
  PMRoutingHintsSchema,
  ProjectManagerOutputSchema,
  WorkBreakdownValidationSchema,
  DEFAULT_COMPLEXITY_DISTRIBUTION,
  DEFAULT_TASK_TYPE_DISTRIBUTION,
  COMPLEXITY_EFFORT_HOURS,
  type TaskType,
  type Complexity,
  type Priority,
  type RiskSeverity,
  type Risk,
  type Task,
  type Feature,
  type Epic,
  type Blocker,
  type WorkBreakdownSummary,
  type PMRoutingHints,
  type ProjectManagerOutput,
  type WorkBreakdownValidation,
} from './schemas/project-manager-output.js';

// Planning utilities
export {
  generateId,
  createEpic,
  createFeature,
  createTask,
  flattenTasks,
  flattenFeatures,
  getTaskById,
  getFeatureById,
  getEpicById,
  calculateSummary,
  validateWorkBreakdown,
  getTasksByType,
  getTasksByComplexity,
  getComplianceTasks,
  getRootTasks,
  countTasksByAgent,
  mergeWorkBreakdowns,
  DependencyGraph,
  type CycleInfo,
} from './planning/index.js';

// Project Manager agent
export { ProjectManagerAgent } from './agents/project-manager.js';
