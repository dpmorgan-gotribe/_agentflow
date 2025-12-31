# Step 13: Orchestrator Graph

> **Checkpoint:** CP1 - Agent System
> **Previous Step:** 12a-SELF-REVIEW-FRAMEWORK.md
> **Next Step:** 14-CONTEXT-MANAGER.md
> **Architecture Reference:** `ARCHITECTURE.md` - LangGraph Orchestration

---

## Overview

The **Orchestrator Graph** is the central workflow engine built on LangGraph.js. It defines the main execution graph that coordinates all agent activities, manages state transitions, handles approvals, and ensures proper routing between agents based on task requirements.

---

## Key Principles

1. **Graph-Based Execution**: LangGraph.js for stateful, checkpointed workflows
2. **Conditional Routing**: Dynamic agent selection based on task analysis
3. **Human-in-the-Loop**: Interrupt points for approvals and decisions
4. **Checkpointing**: PostgreSQL-backed state persistence
5. **Observability**: LangSmith integration for tracing

---

## Deliverables

1. `packages/langgraph/src/graphs/orchestrator.graph.ts` - Main orchestrator graph
2. `packages/langgraph/src/state/workflow.state.ts` - Workflow state definition
3. `packages/langgraph/src/nodes/` - Graph node implementations
4. `packages/langgraph/src/routing/` - Conditional routing logic
5. `packages/langgraph/src/checkpointer/postgres.checkpointer.ts` - PostgreSQL checkpointer

---

## 1. Workflow State Definition

### 1.1 State Channels

```typescript
// packages/langgraph/src/state/workflow.state.ts

import { Annotation, MessagesAnnotation } from '@langchain/langgraph';

/**
 * Task information
 */
export interface TaskInfo {
  id: string;
  prompt: string;
  projectId?: string;
  tenantId: string;
  userId?: string;
  config: Record<string, unknown>;
}

/**
 * Agent execution result
 */
export interface AgentResult {
  agentId: string;
  status: 'success' | 'error' | 'needs_approval';
  output: unknown;
  artifacts: Array<{
    type: string;
    path: string;
    content: string;
  }>;
  reasoning?: string;
  tokensUsed?: number;
  durationMs?: number;
}

/**
 * Approval request
 */
export interface ApprovalRequest {
  id: string;
  agentId: string;
  reason: string;
  artifacts: Array<{
    type: string;
    path: string;
    content: string;
  }>;
  options?: string[];
}

/**
 * Main workflow state
 */
export const WorkflowState = Annotation.Root({
  // Message history for context
  ...MessagesAnnotation.spec,

  // Task information
  task: Annotation<TaskInfo>,

  // Current phase of execution
  phase: Annotation<'analyzing' | 'planning' | 'designing' | 'developing' | 'testing' | 'reviewing' | 'complete'>,

  // Agent queue (agents to execute)
  agentQueue: Annotation<string[]>({
    reducer: (current, update) => update,
    default: () => [],
  }),

  // Current agent being executed
  currentAgent: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // Results from agent executions
  agentResults: Annotation<AgentResult[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  // Pending approval (if any)
  pendingApproval: Annotation<ApprovalRequest | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // Approval decision (after human input)
  approvalDecision: Annotation<{
    approved: boolean;
    message?: string;
    selectedOption?: string;
  } | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // Error state
  error: Annotation<{
    message: string;
    agent?: string;
    recoverable: boolean;
  } | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // Retrieved context
  context: Annotation<{
    lessons: Array<{ content: string; relevance: number }>;
    codeContext: Array<{ content: string; filePath: string }>;
  }>({
    reducer: (_, update) => update,
    default: () => ({ lessons: [], codeContext: [] }),
  }),

  // Iteration tracking
  iterationCount: Annotation<number>({
    reducer: (current, update) => current + update,
    default: () => 0,
  }),

  // Final output
  finalOutput: Annotation<unknown>({
    reducer: (_, update) => update,
    default: () => null,
  }),
});

export type WorkflowStateType = typeof WorkflowState.State;
```

---

## 2. Orchestrator Graph Definition

### 2.1 Main Graph

```typescript
// packages/langgraph/src/graphs/orchestrator.graph.ts

import { StateGraph, END, START } from '@langchain/langgraph';
import { WorkflowState, WorkflowStateType } from '../state/workflow.state';
import { analyzeTaskNode } from '../nodes/analyze-task.node';
import { planWorkNode } from '../nodes/plan-work.node';
import { executeAgentNode } from '../nodes/execute-agent.node';
import { reviewOutputNode } from '../nodes/review-output.node';
import { handleApprovalNode } from '../nodes/handle-approval.node';
import { finalizeNode } from '../nodes/finalize.node';
import { retrieveContextNode } from '../nodes/retrieve-context.node';
import { routeAfterAnalysis, routeAfterAgent, routeAfterApproval } from '../routing/routes';
import { PostgresCheckpointer } from '../checkpointer/postgres.checkpointer';

export function createOrchestratorGraph(checkpointer: PostgresCheckpointer) {
  const graph = new StateGraph(WorkflowState)
    // Initial nodes
    .addNode('retrieve_context', retrieveContextNode)
    .addNode('analyze_task', analyzeTaskNode)
    .addNode('plan_work', planWorkNode)

    // Execution nodes
    .addNode('execute_agent', executeAgentNode)
    .addNode('review_output', reviewOutputNode)

    // Approval handling
    .addNode('request_approval', handleApprovalNode)

    // Finalization
    .addNode('finalize', finalizeNode)

    // Edges from START
    .addEdge(START, 'retrieve_context')
    .addEdge('retrieve_context', 'analyze_task')

    // Conditional routing after analysis
    .addConditionalEdges('analyze_task', routeAfterAnalysis, {
      plan: 'plan_work',
      execute: 'execute_agent',
      error: END,
    })

    // After planning, start execution
    .addEdge('plan_work', 'execute_agent')

    // Conditional routing after agent execution
    .addConditionalEdges('execute_agent', routeAfterAgent, {
      next_agent: 'execute_agent',
      review: 'review_output',
      approval: 'request_approval',
      error: END,
    })

    // After review
    .addConditionalEdges('review_output', (state) => {
      if (state.agentQueue.length > 0) {
        return 'next_agent';
      }
      return 'finalize';
    }, {
      next_agent: 'execute_agent',
      finalize: 'finalize',
    })

    // Approval handling - this is an interrupt point
    .addConditionalEdges('request_approval', routeAfterApproval, {
      continue: 'execute_agent',
      reject: 'finalize',
      retry: 'execute_agent',
    })

    // End
    .addEdge('finalize', END);

  // Compile with checkpointer
  return graph.compile({
    checkpointer,
    interruptBefore: ['request_approval'],
  });
}

export type OrchestratorGraph = ReturnType<typeof createOrchestratorGraph>;
```

---

## 3. Graph Nodes

### 3.1 Analyze Task Node

```typescript
// packages/langgraph/src/nodes/analyze-task.node.ts

import { WorkflowStateType } from '../state/workflow.state';
import { AIProvider } from '@aigentflow/core';

export async function analyzeTaskNode(
  state: WorkflowStateType
): Promise<Partial<WorkflowStateType>> {
  const { task, context } = state;

  // Use AI to analyze the task and determine execution strategy
  const aiProvider = AIProvider.getInstance();

  const analysis = await aiProvider.complete({
    systemPrompt: `You are a task analyzer for the Aigentflow orchestrator.
Analyze the user's request and determine:
1. The type of task (design, development, research, etc.)
2. The required agents and their order
3. The appropriate execution phase

Return a JSON object with:
- taskType: string
- requiredAgents: string[] (ordered)
- initialPhase: string
- complexity: "simple" | "moderate" | "complex"
- needsPlanning: boolean`,

    userPrompt: `Task: ${task.prompt}

Context from lessons:
${context.lessons.map(l => `- ${l.content}`).join('\n')}

Analyze this task and determine the execution strategy.`,

    responseFormat: 'json',
  });

  const parsed = JSON.parse(analysis.content);

  return {
    phase: parsed.initialPhase as WorkflowStateType['phase'],
    agentQueue: parsed.requiredAgents,
    currentAgent: null,
  };
}
```

### 3.2 Execute Agent Node

```typescript
// packages/langgraph/src/nodes/execute-agent.node.ts

import { WorkflowStateType, AgentResult } from '../state/workflow.state';
import { AgentRegistry } from '@aigentflow/agents';

export async function executeAgentNode(
  state: WorkflowStateType
): Promise<Partial<WorkflowStateType>> {
  const { agentQueue, task, context, agentResults, approvalDecision } = state;

  // Get next agent from queue
  const [nextAgent, ...remainingQueue] = agentQueue;

  if (!nextAgent) {
    return {
      currentAgent: null,
      phase: 'complete',
    };
  }

  // Get agent instance
  const agent = AgentRegistry.get(nextAgent);

  // Build agent request
  const request = {
    task: {
      id: task.id,
      prompt: task.prompt,
      description: task.prompt,
    },
    context: {
      items: [
        ...context.lessons.map(l => ({ type: 'lesson', content: l.content })),
        ...context.codeContext.map(c => ({ type: 'code', content: c.content, path: c.filePath })),
      ],
      previousOutputs: agentResults.map(r => r.output),
    },
    previousDecision: approvalDecision,
  };

  try {
    // Execute agent
    const startTime = Date.now();
    const output = await agent.execute(request);
    const durationMs = Date.now() - startTime;

    const result: AgentResult = {
      agentId: nextAgent,
      status: output.routingHints?.needsApproval ? 'needs_approval' : 'success',
      output: output.result,
      artifacts: output.artifacts || [],
      reasoning: output.reasoning,
      tokensUsed: output.tokensUsed,
      durationMs,
    };

    // Check if approval needed
    if (output.routingHints?.needsApproval) {
      return {
        currentAgent: nextAgent,
        agentQueue: remainingQueue,
        agentResults: [result],
        pendingApproval: {
          id: `approval-${task.id}-${nextAgent}`,
          agentId: nextAgent,
          reason: output.routingHints.notes || 'Agent output requires approval',
          artifacts: output.artifacts || [],
        },
      };
    }

    return {
      currentAgent: nextAgent,
      agentQueue: remainingQueue,
      agentResults: [result],
      pendingApproval: null,
      approvalDecision: null,
    };
  } catch (error) {
    return {
      currentAgent: nextAgent,
      error: {
        message: error.message,
        agent: nextAgent,
        recoverable: true,
      },
      agentResults: [{
        agentId: nextAgent,
        status: 'error',
        output: null,
        artifacts: [],
        reasoning: error.message,
      }],
    };
  }
}
```

### 3.3 Handle Approval Node

```typescript
// packages/langgraph/src/nodes/handle-approval.node.ts

import { WorkflowStateType } from '../state/workflow.state';

/**
 * This node handles the approval checkpoint.
 * The graph will interrupt before this node, allowing external systems
 * to inject the approval decision into the state.
 */
export async function handleApprovalNode(
  state: WorkflowStateType
): Promise<Partial<WorkflowStateType>> {
  const { approvalDecision, pendingApproval, currentAgent } = state;

  if (!approvalDecision) {
    // This shouldn't happen if interrupt works correctly
    throw new Error('Approval decision not provided');
  }

  if (approvalDecision.approved) {
    // Clear approval state and continue
    return {
      pendingApproval: null,
      approvalDecision: null,
    };
  } else {
    // Rejected - add to results and potentially retry or skip
    return {
      pendingApproval: null,
      approvalDecision: null,
      agentResults: [{
        agentId: currentAgent!,
        status: 'error',
        output: null,
        artifacts: [],
        reasoning: `Rejected: ${approvalDecision.message || 'No reason provided'}`,
      }],
    };
  }
}
```

### 3.4 Finalize Node

```typescript
// packages/langgraph/src/nodes/finalize.node.ts

import { WorkflowStateType } from '../state/workflow.state';

export async function finalizeNode(
  state: WorkflowStateType
): Promise<Partial<WorkflowStateType>> {
  const { agentResults, task, error } = state;

  // Aggregate all artifacts
  const allArtifacts = agentResults.flatMap(r => r.artifacts);

  // Determine final status
  const hasErrors = agentResults.some(r => r.status === 'error');
  const status = error ? 'failed' : hasErrors ? 'partial' : 'success';

  // Build summary
  const summary = {
    taskId: task.id,
    status,
    agentsExecuted: agentResults.map(r => r.agentId),
    artifactsGenerated: allArtifacts.length,
    totalDurationMs: agentResults.reduce((sum, r) => sum + (r.durationMs || 0), 0),
    totalTokens: agentResults.reduce((sum, r) => sum + (r.tokensUsed || 0), 0),
  };

  return {
    phase: 'complete',
    finalOutput: {
      summary,
      artifacts: allArtifacts,
      results: agentResults,
    },
  };
}
```

---

## 4. Routing Logic

### 4.1 Conditional Routes

```typescript
// packages/langgraph/src/routing/routes.ts

import { WorkflowStateType } from '../state/workflow.state';

export function routeAfterAnalysis(
  state: WorkflowStateType
): 'plan' | 'execute' | 'error' {
  if (state.error) {
    return 'error';
  }

  // Complex tasks need planning first
  const agentCount = state.agentQueue.length;
  if (agentCount > 3) {
    return 'plan';
  }

  return 'execute';
}

export function routeAfterAgent(
  state: WorkflowStateType
): 'next_agent' | 'review' | 'approval' | 'error' {
  if (state.error) {
    return 'error';
  }

  if (state.pendingApproval) {
    return 'approval';
  }

  // Check if current agent's output needs review
  const currentResult = state.agentResults[state.agentResults.length - 1];
  if (currentResult?.status === 'success' && shouldReview(currentResult.agentId)) {
    return 'review';
  }

  if (state.agentQueue.length > 0) {
    return 'next_agent';
  }

  return 'review';
}

export function routeAfterApproval(
  state: WorkflowStateType
): 'continue' | 'reject' | 'retry' {
  const { approvalDecision } = state;

  if (!approvalDecision) {
    // Waiting for decision
    return 'continue';
  }

  if (approvalDecision.approved) {
    return 'continue';
  }

  // Check if retry requested
  if (approvalDecision.selectedOption === 'retry') {
    return 'retry';
  }

  return 'reject';
}

function shouldReview(agentId: string): boolean {
  const reviewableAgents = [
    'ui_designer',
    'frontend_dev',
    'backend_dev',
    'architect',
  ];
  return reviewableAgents.includes(agentId);
}
```

---

## 5. PostgreSQL Checkpointer

### 5.1 Checkpointer Implementation

```typescript
// packages/langgraph/src/checkpointer/postgres.checkpointer.ts

import { BaseCheckpointSaver, Checkpoint, CheckpointMetadata } from '@langchain/langgraph';
import { Database } from '@aigentflow/database';
import { sql } from 'drizzle-orm';

export class PostgresCheckpointer extends BaseCheckpointSaver {
  constructor(private db: Database) {
    super();
  }

  async getTuple(config: { configurable: { thread_id: string } }): Promise<{
    checkpoint: Checkpoint;
    metadata: CheckpointMetadata;
  } | undefined> {
    const threadId = config.configurable.thread_id;

    const result = await this.db.execute(sql`
      SELECT checkpoint, metadata, created_at
      FROM langgraph_checkpoints
      WHERE thread_id = ${threadId}
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return undefined;
    }

    const row = result.rows[0];
    return {
      checkpoint: JSON.parse(row.checkpoint as string),
      metadata: JSON.parse(row.metadata as string),
    };
  }

  async put(
    config: { configurable: { thread_id: string } },
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<void> {
    const threadId = config.configurable.thread_id;

    await this.db.execute(sql`
      INSERT INTO langgraph_checkpoints (thread_id, checkpoint, metadata, created_at)
      VALUES (
        ${threadId},
        ${JSON.stringify(checkpoint)},
        ${JSON.stringify(metadata)},
        NOW()
      )
      ON CONFLICT (thread_id)
      DO UPDATE SET
        checkpoint = ${JSON.stringify(checkpoint)},
        metadata = ${JSON.stringify(metadata)},
        created_at = NOW()
    `);
  }

  async list(config: { configurable: { thread_id: string } }): Promise<
    Array<{ checkpoint: Checkpoint; metadata: CheckpointMetadata }>
  > {
    const threadId = config.configurable.thread_id;

    const result = await this.db.execute(sql`
      SELECT checkpoint, metadata
      FROM langgraph_checkpoints
      WHERE thread_id = ${threadId}
      ORDER BY created_at DESC
    `);

    return result.rows.map(row => ({
      checkpoint: JSON.parse(row.checkpoint as string),
      metadata: JSON.parse(row.metadata as string),
    }));
  }

  async delete(config: { configurable: { thread_id: string } }): Promise<void> {
    const threadId = config.configurable.thread_id;

    await this.db.execute(sql`
      DELETE FROM langgraph_checkpoints
      WHERE thread_id = ${threadId}
    `);
  }
}
```

---

## 6. Graph Runner Service

### 6.1 Workflow Service

```typescript
// packages/langgraph/src/services/workflow.service.ts

import { createOrchestratorGraph, OrchestratorGraph } from '../graphs/orchestrator.graph';
import { PostgresCheckpointer } from '../checkpointer/postgres.checkpointer';
import { TaskInfo, WorkflowStateType } from '../state/workflow.state';
import { Database } from '@aigentflow/database';

export class WorkflowService {
  private graph: OrchestratorGraph;
  private checkpointer: PostgresCheckpointer;

  constructor(db: Database) {
    this.checkpointer = new PostgresCheckpointer(db);
    this.graph = createOrchestratorGraph(this.checkpointer);
  }

  async startWorkflow(task: TaskInfo): Promise<string> {
    const threadId = task.id;

    // Initialize workflow
    await this.graph.invoke(
      {
        task,
        phase: 'analyzing',
        agentQueue: [],
        currentAgent: null,
        agentResults: [],
        pendingApproval: null,
        approvalDecision: null,
        error: null,
        context: { lessons: [], codeContext: [] },
        iterationCount: 0,
        finalOutput: null,
        messages: [],
      },
      { configurable: { thread_id: threadId } }
    );

    return threadId;
  }

  async getWorkflowState(threadId: string): Promise<WorkflowStateType | null> {
    const checkpoint = await this.checkpointer.getTuple({
      configurable: { thread_id: threadId },
    });

    if (!checkpoint) {
      return null;
    }

    return checkpoint.checkpoint.channel_values as WorkflowStateType;
  }

  async submitApproval(
    threadId: string,
    decision: { approved: boolean; message?: string; selectedOption?: string }
  ): Promise<void> {
    // Update state with approval decision
    await this.graph.updateState(
      { configurable: { thread_id: threadId } },
      { approvalDecision: decision }
    );

    // Resume execution
    await this.graph.invoke(null, { configurable: { thread_id: threadId } });
  }

  async *streamWorkflow(task: TaskInfo): AsyncGenerator<{
    event: string;
    data: unknown;
  }> {
    const threadId = task.id;

    for await (const event of this.graph.stream(
      {
        task,
        phase: 'analyzing',
        agentQueue: [],
        currentAgent: null,
        agentResults: [],
        pendingApproval: null,
        approvalDecision: null,
        error: null,
        context: { lessons: [], codeContext: [] },
        iterationCount: 0,
        finalOutput: null,
        messages: [],
      },
      { configurable: { thread_id: threadId } }
    )) {
      yield {
        event: 'state_update',
        data: event,
      };
    }
  }
}
```

---

## Validation Checklist

```
□ Orchestrator Graph (Step 13)
  □ LangGraph.js workflow compiles
  □ State channels defined correctly
  □ All nodes implemented
  □ Conditional routing works
  □ PostgreSQL checkpointer persists state
  □ Human-in-the-loop interrupt works
  □ Workflow resumes after approval
  □ Error handling captures failures
  □ Stream events work
  □ LangSmith tracing connected
  □ Tests pass
```

---

## Next Step

Proceed to **14-CONTEXT-MANAGER.md** to implement the Qdrant-powered context retrieval system.
