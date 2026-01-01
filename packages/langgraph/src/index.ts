/**
 * @aigentflow/langgraph
 *
 * LangGraph.js workflow engine for Aigentflow.
 *
 * Provides:
 * - Orchestrator workflow graph with "thinking" pattern
 * - State channel definitions
 * - PostgreSQL checkpointer
 * - Human-in-the-loop approval patterns
 * - Parallel agent execution
 * - Style competition workflow
 * - Streaming utilities
 */

export const LANGGRAPH_VERSION = '0.0.0';

// State definitions and schemas
export {
  OrchestratorState,
  createInitialState,
  taskAnalysisSchema,
  artifactSchema,
  routingHintsSchema,
  agentOutputSchema,
  approvalRequestSchema,
  approvalResponseSchema,
  workflowStatusSchema,
  type OrchestratorStateType,
  type TaskAnalysis,
  type Artifact,
  type RoutingHints,
  type AgentOutput,
  type ApprovalRequest,
  type ApprovalResponse,
  type WorkflowStatus,
  type AgentActivity,
  type ToolUsage,
  type HookExecution,
} from './state.js';

// Graphs
export {
  createOrchestratorGraph,
  createLegacyOrchestratorGraph,
  executeWorkflow,
  executeWorkflowStreaming,
  resumeWorkflow,
  type OrchestratorGraph,
  type OrchestratorGraphConfig,
  type WorkflowExecutionOptions,
  type WorkflowStreamCallback,
} from './graphs/orchestrator.js';

// Nodes
export {
  analyzeTaskNode,
  routeToAgentNode,
  executeAgentNode,
  handleApprovalNode,
  setAgentRegistry,
  getAgentRegistry,
  createApprovalResponse,
  AnalysisError,
  ExecutionError,
  ApprovalError,
  type Agent,
  type AgentContext,
  type AgentResult,
  type AgentRegistry,
  type ApprovalOption,
  type StyleSelectionRequest,
  type StyleSelectionResponse,
} from './nodes/index.js';

// Thinking orchestrator node
export {
  orchestratorThinkNode,
  getOrchestratorRoute,
} from './nodes/think.js';

// Parallel dispatch node
export {
  parallelDispatchNode,
  allParallelResultsSuccessful,
  getFailedParallelResults,
  getParallelResultByStyleId,
} from './nodes/parallel-dispatch.js';

// Orchestrator thinking schemas
export {
  OrchestratorActionSchema,
  AgentDispatchSchema,
  ApprovalConfigSchema,
  ContextMappingSchema,
  OrchestratorDecisionSchema,
  ThinkingStepSchema,
  ParallelResultSchema,
  OrchestratorThinkingSchema,
  createInitialThinkingState,
  createThinkingStep,
  type OrchestratorAction,
  type AgentDispatch,
  type ApprovalConfig,
  type ContextMapping,
  type OrchestratorDecision,
  type ThinkingStep,
  type ParallelResult,
  type OrchestratorThinking,
} from './schemas/orchestrator-thinking.js';

// Style package schemas
export {
  TypographySchema,
  IconConfigSchema,
  ColorPaletteSchema,
  VisualStyleSchema,
  CssConfigSchema,
  DesignReferenceSchema,
  StylePackageSchema,
  StyleFeedbackSchema,
  RejectedStyleSchema,
  StyleSelectionSchema,
  UserStyleHintsSchema,
  StyleCompetitionStateSchema,
  createEmptyUserHints,
  createInitialCompetitionState,
  createRejectedStyle,
  isStyleIterationExhausted,
  type Typography,
  type IconConfig,
  type ColorPalette,
  type VisualStyle,
  type CssConfig,
  type DesignReference,
  type StylePackage,
  type StyleFeedback,
  type RejectedStyle,
  type StyleSelection,
  type UserStyleHints,
  type StyleCompetitionState,
} from './schemas/style-package.js';

// Component inventory schemas
export {
  ComponentComplexitySchema,
  ComponentCategorySchema,
  ComponentStateSchema,
  BaseComponentSchema,
  NavigationComponentSchema,
  DataDisplayComponentSchema,
  FormComponentSchema,
  FeedbackComponentSchema,
  OverlayComponentSchema,
  SpecializedComponentSchema,
  MediaComponentSchema,
  LayoutComponentSchema,
  ComponentDefinitionSchema,
  UserFlowSchema,
  ScreenDefinitionSchema,
  ComponentInventorySchema,
  MegaPageSectionSchema,
  createEmptyInventory,
  calculateInventorySummary,
  getAllComponentNames,
  createMegaPageSections,
  type ComponentComplexity,
  type ComponentCategory,
  type ComponentState,
  type BaseComponent,
  type NavigationComponent,
  type DataDisplayComponent,
  type FormComponent,
  type FeedbackComponent,
  type OverlayComponent,
  type SpecializedComponent,
  type MediaComponent,
  type LayoutComponent,
  type ComponentDefinition,
  type UserFlow,
  type ScreenDefinition,
  type ComponentInventory,
  type MegaPageSection,
} from './schemas/component-inventory.js';

// Orchestrator thinking prompts
export {
  ORCHESTRATOR_THINKING_PROMPT,
  buildThinkingContext,
  parseOrchestratorDecision,
  STYLE_REJECTION_PROMPT,
  buildStyleRejectionPrompt,
} from './prompts/orchestrator-thinking.js';

// Checkpointer
export {
  PostgresCheckpointer,
  CHECKPOINTS_TABLE_SQL,
  CheckpointerError,
  type PostgresCheckpointerConfig,
} from './checkpointer/index.js';

// Streaming utilities
export {
  createStreamEvent,
  createStreamingCallback,
  type StreamEvent,
  type StreamEventType,
  type StreamEventData,
  type StreamEventHandler,
  type ExtraEventData,
} from './utils/index.js';

// Re-exports from LangGraph for convenience
export { END, START } from '@langchain/langgraph';
