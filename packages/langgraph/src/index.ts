/**
 * @aigentflow/langgraph
 *
 * LangGraph.js workflow engine for Aigentflow.
 *
 * Provides:
 * - Orchestrator workflow graph
 * - State channel definitions
 * - PostgreSQL checkpointer
 * - Human-in-the-loop approval patterns
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
} from './state.js';

// Graphs
export {
  createOrchestratorGraph,
  executeWorkflow,
  resumeWorkflow,
  type OrchestratorGraph,
  type OrchestratorGraphConfig,
  type WorkflowExecutionOptions,
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
} from './nodes/index.js';

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
} from './utils/index.js';

// Re-exports from LangGraph for convenience
export { END, START } from '@langchain/langgraph';
