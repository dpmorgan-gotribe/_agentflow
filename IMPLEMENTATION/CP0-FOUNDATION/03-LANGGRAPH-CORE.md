# Step 03: LangGraph Core

> **Checkpoint:** CP0 - Foundation
> **Previous Step:** 02-POSTGRESQL-SETUP.md
> **Next Step:** 03a-PROMPT-ARCHITECTURE.md

---

## Overview

This step implements the **LangGraph.js** workflow engine that replaces the custom StateGraph from v2.x. LangGraph.js provides:

- **Graph-based workflows** with nodes and edges
- **Conditional routing** between agents
- **Persistent checkpoints** for recovery
- **Human-in-the-loop** approval patterns
- **Streaming** for real-time updates
- **LangSmith integration** for tracing

---

## Deliverables

1. `packages/langgraph/` - LangGraph workflow package
2. State channel definitions
3. Main orchestrator workflow graph
4. PostgreSQL checkpointer integration
5. Human-in-the-loop patterns
6. Streaming configuration

---

## 1. Package Structure

```
packages/langgraph/
├── src/
│   ├── index.ts              # Public exports
│   ├── state.ts              # State channel definitions
│   ├── graphs/
│   │   ├── index.ts          # Graph exports
│   │   ├── orchestrator.ts   # Main orchestrator graph
│   │   └── agent-runner.ts   # Agent execution subgraph
│   ├── nodes/
│   │   ├── index.ts          # Node exports
│   │   ├── analyze.ts        # Task analysis node
│   │   ├── route.ts          # Routing decision node
│   │   ├── execute.ts        # Agent execution node
│   │   └── approve.ts        # Approval node
│   ├── checkpointer/
│   │   ├── index.ts          # Checkpointer exports
│   │   └── postgres.ts       # PostgreSQL checkpointer
│   └── utils/
│       ├── streaming.ts      # Streaming utilities
│       └── interrupt.ts      # Human-in-the-loop utilities
├── package.json
└── tsconfig.json
```

---

## 2. Package Configuration

### 2.1 packages/langgraph/package.json

```json
{
  "name": "@aigentflow/langgraph",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./graphs": {
      "types": "./dist/graphs/index.d.ts",
      "import": "./dist/graphs/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts src/graphs/index.ts --format esm --dts",
    "dev": "tsup src/index.ts src/graphs/index.ts --format esm --dts --watch",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "@langchain/anthropic": "^0.2.0",
    "@langchain/core": "^0.2.0",
    "@langchain/langgraph": "^0.2.0",
    "@aigentflow/core": "workspace:*",
    "@aigentflow/database": "workspace:*",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@aigentflow/tsconfig": "workspace:*",
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.0.0"
  }
}
```

---

## 3. State Channel Definitions

### 3.1 packages/langgraph/src/state.ts

```typescript
/**
 * LangGraph State Channels
 *
 * Defines the state shape for the orchestrator workflow.
 */

import { Annotation, messagesStateReducer } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

/**
 * Task analysis result
 */
export interface TaskAnalysis {
  taskType: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'config' | 'test';
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  requiresUI: boolean;
  requiresBackend: boolean;
  requiresArchitecture: boolean;
  requiresApproval: boolean;
  suggestedAgents: string[];
}

/**
 * Agent output from execution
 */
export interface AgentOutput {
  agentId: string;
  success: boolean;
  result: unknown;
  artifacts: Artifact[];
  routingHints: RoutingHints;
  error?: string;
  timestamp: string;
}

export interface Artifact {
  id: string;
  type: 'mockup' | 'source_file' | 'test_file' | 'config_file' | 'documentation';
  path: string;
  content?: string;
}

export interface RoutingHints {
  suggestNext?: string[];
  skipAgents?: string[];
  needsApproval?: boolean;
  hasFailures?: boolean;
  isComplete?: boolean;
}

/**
 * Main orchestrator state annotation
 */
export const OrchestratorState = Annotation.Root({
  // Message history for LLM context
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // Project context
  tenantId: Annotation<string>(),
  projectId: Annotation<string>(),
  taskId: Annotation<string>(),

  // Original prompt
  prompt: Annotation<string>(),

  // Task analysis result
  analysis: Annotation<TaskAnalysis | null>({
    default: () => null,
  }),

  // Agent routing
  currentAgent: Annotation<string | null>({
    default: () => null,
  }),
  agentQueue: Annotation<string[]>({
    reducer: (current, update) => update ?? current,
    default: () => [],
  }),
  completedAgents: Annotation<string[]>({
    reducer: (current, update) => [...current, ...(update ?? [])],
    default: () => [],
  }),

  // Agent outputs (accumulated)
  agentOutputs: Annotation<AgentOutput[]>({
    reducer: (current, update) => [...current, ...(update ?? [])],
    default: () => [],
  }),

  // Retry tracking
  retryCount: Annotation<number>({
    default: () => 0,
  }),
  maxRetries: Annotation<number>({
    default: () => 3,
  }),

  // Workflow status
  status: Annotation<
    | 'pending'
    | 'analyzing'
    | 'orchestrating'
    | 'agent_working'
    | 'awaiting_approval'
    | 'completing'
    | 'completed'
    | 'failed'
    | 'aborted'
  >({
    default: () => 'pending',
  }),

  // Error tracking
  error: Annotation<string | null>({
    default: () => null,
  }),

  // Approval state
  approvalRequest: Annotation<ApprovalRequest | null>({
    default: () => null,
  }),
  approvalResponse: Annotation<ApprovalResponse | null>({
    default: () => null,
  }),
});

export interface ApprovalRequest {
  type: 'design' | 'architecture' | 'implementation' | 'final';
  description: string;
  artifacts: Artifact[];
  options?: string[];
}

export interface ApprovalResponse {
  approved: boolean;
  selectedOption?: string;
  feedback?: string;
  timestamp: string;
}

export type OrchestratorStateType = typeof OrchestratorState.State;
```

---

## 4. Main Orchestrator Graph

### 4.1 packages/langgraph/src/graphs/orchestrator.ts

```typescript
/**
 * Main Orchestrator Workflow Graph
 *
 * The central LangGraph workflow that coordinates all agents.
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { OrchestratorState, type OrchestratorStateType } from '../state';
import { analyzeTaskNode } from '../nodes/analyze';
import { routeToAgentNode } from '../nodes/route';
import { executeAgentNode } from '../nodes/execute';
import { handleApprovalNode } from '../nodes/approve';
import { PostgresCheckpointer } from '../checkpointer/postgres';

/**
 * Routing function: determines next node after analysis
 */
function routeAfterAnalysis(
  state: OrchestratorStateType
): 'route_to_agent' | 'error' {
  if (!state.analysis) {
    return 'error';
  }
  return 'route_to_agent';
}

/**
 * Routing function: determines next node after routing decision
 */
function routeAfterRouting(
  state: OrchestratorStateType
): 'execute_agent' | 'complete' | 'awaiting_approval' {
  // If no agents left and no approval needed, complete
  if (!state.currentAgent && state.agentQueue.length === 0) {
    return 'complete';
  }

  // Check if current agent output needs approval
  const lastOutput = state.agentOutputs[state.agentOutputs.length - 1];
  if (lastOutput?.routingHints?.needsApproval) {
    return 'awaiting_approval';
  }

  // Execute next agent
  if (state.currentAgent) {
    return 'execute_agent';
  }

  return 'complete';
}

/**
 * Routing function: determines next node after agent execution
 */
function routeAfterExecution(
  state: OrchestratorStateType
): 'route_to_agent' | 'awaiting_approval' | 'error' {
  const lastOutput = state.agentOutputs[state.agentOutputs.length - 1];

  // Check for errors
  if (!lastOutput?.success) {
    if (state.retryCount >= state.maxRetries) {
      return 'error';
    }
    // Will retry in route_to_agent
  }

  // Check if needs approval
  if (lastOutput?.routingHints?.needsApproval) {
    return 'awaiting_approval';
  }

  // Continue routing
  return 'route_to_agent';
}

/**
 * Routing function: determines next node after approval
 */
function routeAfterApproval(
  state: OrchestratorStateType
): 'route_to_agent' | 'error' {
  if (!state.approvalResponse?.approved) {
    // Rejection - may need to redo work
    return 'route_to_agent';
  }
  return 'route_to_agent';
}

/**
 * Create the main orchestrator graph
 */
export function createOrchestratorGraph(checkpointer?: PostgresCheckpointer) {
  const workflow = new StateGraph(OrchestratorState)
    // Add nodes
    .addNode('analyze', analyzeTaskNode)
    .addNode('route_to_agent', routeToAgentNode)
    .addNode('execute_agent', executeAgentNode)
    .addNode('awaiting_approval', handleApprovalNode)
    .addNode('complete', async (state) => ({
      ...state,
      status: 'completed' as const,
    }))
    .addNode('error', async (state) => ({
      ...state,
      status: 'failed' as const,
    }))

    // Add edges
    .addEdge(START, 'analyze')
    .addConditionalEdges('analyze', routeAfterAnalysis, {
      route_to_agent: 'route_to_agent',
      error: 'error',
    })
    .addConditionalEdges('route_to_agent', routeAfterRouting, {
      execute_agent: 'execute_agent',
      complete: 'complete',
      awaiting_approval: 'awaiting_approval',
    })
    .addConditionalEdges('execute_agent', routeAfterExecution, {
      route_to_agent: 'route_to_agent',
      awaiting_approval: 'awaiting_approval',
      error: 'error',
    })
    .addConditionalEdges('awaiting_approval', routeAfterApproval, {
      route_to_agent: 'route_to_agent',
      error: 'error',
    })
    .addEdge('complete', END)
    .addEdge('error', END);

  // Compile with checkpointer for persistence
  const compiled = workflow.compile({
    checkpointer,
    interruptBefore: ['awaiting_approval'], // Pause before approval
  });

  return compiled;
}

export type OrchestratorGraph = ReturnType<typeof createOrchestratorGraph>;
```

---

## 5. Workflow Nodes

### 5.1 packages/langgraph/src/nodes/analyze.ts

```typescript
/**
 * Analyze Task Node
 *
 * Analyzes the user prompt to determine task type and required agents.
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { OrchestratorStateType, TaskAnalysis } from '../state';

const ANALYSIS_SYSTEM_PROMPT = `You are a task analyzer for a multi-agent development orchestrator.

Analyze the given development task and determine:
1. Task type (feature, bugfix, refactor, docs, config, test)
2. Complexity (trivial, simple, moderate, complex)
3. Whether it requires UI work
4. Whether it requires backend work
5. Whether it requires architecture decisions
6. Whether it requires human approval at any stage
7. Which agents should be involved

Respond with valid JSON only.`;

export async function analyzeTaskNode(
  state: OrchestratorStateType
): Promise<Partial<OrchestratorStateType>> {
  const model = new ChatAnthropic({
    modelName: 'claude-sonnet-4-20250514',
    temperature: 0,
  });

  const response = await model.invoke([
    new SystemMessage(ANALYSIS_SYSTEM_PROMPT),
    new HumanMessage(`Analyze this task: "${state.prompt}"

Project context:
- Project ID: ${state.projectId}

Respond in JSON format:
{
  "taskType": "feature" | "bugfix" | "refactor" | "docs" | "config" | "test",
  "complexity": "trivial" | "simple" | "moderate" | "complex",
  "requiresUI": boolean,
  "requiresBackend": boolean,
  "requiresArchitecture": boolean,
  "requiresApproval": boolean,
  "suggestedAgents": ["agent_type", ...]
}`),
  ]);

  // Parse the response
  const content = response.content.toString();
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse task analysis');
  }

  const analysis: TaskAnalysis = JSON.parse(jsonMatch[0]);

  // Build initial agent queue based on analysis
  const agentQueue = buildAgentQueue(analysis);

  return {
    analysis,
    agentQueue,
    status: 'orchestrating',
    messages: [
      new HumanMessage(state.prompt),
      response,
    ],
  };
}

function buildAgentQueue(analysis: TaskAnalysis): string[] {
  const queue: string[] = [];

  // Planning (for complex features)
  if (analysis.complexity === 'complex' || analysis.complexity === 'moderate') {
    queue.push('project_manager');
  }

  // Architecture (for new features or significant changes)
  if (analysis.requiresArchitecture) {
    queue.push('architect');
  }

  // UI Design (only if UI work needed and not a bugfix)
  if (analysis.requiresUI && analysis.taskType !== 'bugfix') {
    queue.push('ui_designer');
  }

  // Development
  if (analysis.requiresUI) {
    queue.push('frontend_developer');
  }
  if (analysis.requiresBackend) {
    queue.push('backend_developer');
  }

  // For bugfixes, use bug fixer directly
  if (analysis.taskType === 'bugfix') {
    return ['bug_fixer', 'tester', 'reviewer'];
  }

  // Always test and review
  queue.push('tester');
  queue.push('reviewer');

  return queue;
}
```

### 5.2 packages/langgraph/src/nodes/route.ts

```typescript
/**
 * Route to Agent Node
 *
 * Determines which agent to execute next based on queue and previous outputs.
 */

import type { OrchestratorStateType } from '../state';

export async function routeToAgentNode(
  state: OrchestratorStateType
): Promise<Partial<OrchestratorStateType>> {
  const { agentQueue, agentOutputs, completedAgents } = state;

  // Check if last agent's routing hints suggest a different path
  const lastOutput = agentOutputs[agentOutputs.length - 1];
  if (lastOutput?.routingHints?.suggestNext?.length) {
    const suggested = lastOutput.routingHints.suggestNext[0];
    if (!completedAgents.includes(suggested)) {
      return {
        currentAgent: suggested,
        status: 'agent_working',
      };
    }
  }

  // Check if there are agents to skip
  if (lastOutput?.routingHints?.skipAgents?.length) {
    const filteredQueue = agentQueue.filter(
      (agent) => !lastOutput.routingHints.skipAgents?.includes(agent)
    );

    if (filteredQueue.length > 0) {
      const nextAgent = filteredQueue[0];
      return {
        currentAgent: nextAgent,
        agentQueue: filteredQueue.slice(1),
        status: 'agent_working',
      };
    }
  }

  // Take next agent from queue
  if (agentQueue.length > 0) {
    const nextAgent = agentQueue[0];
    return {
      currentAgent: nextAgent,
      agentQueue: agentQueue.slice(1),
      status: 'agent_working',
    };
  }

  // No more agents
  return {
    currentAgent: null,
    status: 'completing',
  };
}
```

### 5.3 packages/langgraph/src/nodes/execute.ts

```typescript
/**
 * Execute Agent Node
 *
 * Executes the current agent and captures its output.
 */

import type { OrchestratorStateType, AgentOutput } from '../state';

// Agent registry will be injected
interface AgentRegistry {
  getAgent(type: string): Agent | undefined;
}

interface Agent {
  execute(context: AgentContext): Promise<AgentResult>;
}

interface AgentContext {
  tenantId: string;
  projectId: string;
  taskId: string;
  prompt: string;
  analysis: OrchestratorStateType['analysis'];
  previousOutputs: AgentOutput[];
}

interface AgentResult {
  success: boolean;
  result: unknown;
  artifacts: AgentOutput['artifacts'];
  routingHints: AgentOutput['routingHints'];
  error?: string;
}

// Global agent registry (set during initialization)
let agentRegistry: AgentRegistry | null = null;

export function setAgentRegistry(registry: AgentRegistry) {
  agentRegistry = registry;
}

export async function executeAgentNode(
  state: OrchestratorStateType
): Promise<Partial<OrchestratorStateType>> {
  const { currentAgent, tenantId, projectId, taskId, prompt, analysis, agentOutputs } = state;

  if (!currentAgent) {
    return {
      error: 'No agent selected for execution',
      status: 'failed',
    };
  }

  if (!agentRegistry) {
    return {
      error: 'Agent registry not initialized',
      status: 'failed',
    };
  }

  const agent = agentRegistry.getAgent(currentAgent);
  if (!agent) {
    return {
      error: `Agent not found: ${currentAgent}`,
      status: 'failed',
    };
  }

  try {
    const result = await agent.execute({
      tenantId,
      projectId,
      taskId,
      prompt,
      analysis,
      previousOutputs: agentOutputs,
    });

    const output: AgentOutput = {
      agentId: currentAgent,
      success: result.success,
      result: result.result,
      artifacts: result.artifacts,
      routingHints: result.routingHints,
      error: result.error,
      timestamp: new Date().toISOString(),
    };

    return {
      agentOutputs: [output],
      completedAgents: result.success ? [currentAgent] : [],
      retryCount: result.success ? 0 : state.retryCount + 1,
      currentAgent: null,
    };
  } catch (error) {
    const output: AgentOutput = {
      agentId: currentAgent,
      success: false,
      result: null,
      artifacts: [],
      routingHints: { hasFailures: true },
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };

    return {
      agentOutputs: [output],
      retryCount: state.retryCount + 1,
      currentAgent: null,
    };
  }
}
```

### 5.4 packages/langgraph/src/nodes/approve.ts

```typescript
/**
 * Approval Node
 *
 * Handles human-in-the-loop approval requests.
 * Uses LangGraph's interrupt mechanism.
 */

import { interrupt } from '@langchain/langgraph';
import type { OrchestratorStateType, ApprovalRequest, ApprovalResponse } from '../state';

export async function handleApprovalNode(
  state: OrchestratorStateType
): Promise<Partial<OrchestratorStateType>> {
  const lastOutput = state.agentOutputs[state.agentOutputs.length - 1];

  if (!lastOutput) {
    return { status: 'orchestrating' };
  }

  // Create approval request
  const approvalRequest: ApprovalRequest = {
    type: determineApprovalType(lastOutput.agentId),
    description: `Review output from ${lastOutput.agentId}`,
    artifacts: lastOutput.artifacts,
  };

  // Interrupt and wait for human approval
  // This will pause the workflow until resume is called
  const response = await interrupt<ApprovalResponse>({
    type: 'approval',
    request: approvalRequest,
  });

  return {
    approvalRequest,
    approvalResponse: response,
    status: 'orchestrating',
  };
}

function determineApprovalType(
  agentId: string
): ApprovalRequest['type'] {
  switch (agentId) {
    case 'ui_designer':
      return 'design';
    case 'architect':
      return 'architecture';
    case 'frontend_developer':
    case 'backend_developer':
      return 'implementation';
    default:
      return 'final';
  }
}
```

---

## 6. PostgreSQL Checkpointer

### 6.1 packages/langgraph/src/checkpointer/postgres.ts

```typescript
/**
 * PostgreSQL Checkpointer
 *
 * Persists LangGraph workflow state to PostgreSQL.
 */

import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointMetadata,
  CheckpointTuple,
} from '@langchain/langgraph';
import type { Database } from '@aigentflow/database';

export class PostgresCheckpointer extends BaseCheckpointSaver {
  private db: Database;

  constructor(db: Database) {
    super();
    this.db = db;
  }

  async getTuple(config: {
    configurable: { thread_id: string; checkpoint_id?: string };
  }): Promise<CheckpointTuple | undefined> {
    const { thread_id, checkpoint_id } = config.configurable;

    let query = `
      SELECT checkpoint_id, checkpoint, metadata, parent_id
      FROM langgraph_checkpoints
      WHERE thread_id = $1
    `;
    const params: unknown[] = [thread_id];

    if (checkpoint_id) {
      query += ` AND checkpoint_id = $2`;
      params.push(checkpoint_id);
    } else {
      query += ` ORDER BY created_at DESC LIMIT 1`;
    }

    const result = await this.db.raw<{
      checkpoint_id: string;
      checkpoint: string;
      metadata: string;
      parent_id: string | null;
    }>(query, params);

    if (result.length === 0) {
      return undefined;
    }

    const row = result[0];
    return {
      config: {
        configurable: {
          thread_id,
          checkpoint_id: row.checkpoint_id,
        },
      },
      checkpoint: JSON.parse(row.checkpoint) as Checkpoint,
      metadata: JSON.parse(row.metadata) as CheckpointMetadata,
      parentConfig: row.parent_id
        ? {
            configurable: {
              thread_id,
              checkpoint_id: row.parent_id,
            },
          }
        : undefined,
    };
  }

  async *list(config: {
    configurable: { thread_id: string };
  }): AsyncGenerator<CheckpointTuple> {
    const { thread_id } = config.configurable;

    const result = await this.db.raw<{
      checkpoint_id: string;
      checkpoint: string;
      metadata: string;
      parent_id: string | null;
    }>(
      `SELECT checkpoint_id, checkpoint, metadata, parent_id
       FROM langgraph_checkpoints
       WHERE thread_id = $1
       ORDER BY created_at DESC`,
      [thread_id]
    );

    for (const row of result) {
      yield {
        config: {
          configurable: {
            thread_id,
            checkpoint_id: row.checkpoint_id,
          },
        },
        checkpoint: JSON.parse(row.checkpoint) as Checkpoint,
        metadata: JSON.parse(row.metadata) as CheckpointMetadata,
        parentConfig: row.parent_id
          ? {
              configurable: {
                thread_id,
                checkpoint_id: row.parent_id,
              },
            }
          : undefined,
      };
    }
  }

  async put(
    config: { configurable: { thread_id: string; checkpoint_id?: string } },
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<{ configurable: { thread_id: string; checkpoint_id: string } }> {
    const { thread_id } = config.configurable;
    const checkpoint_id = crypto.randomUUID();
    const parent_id = config.configurable.checkpoint_id;

    await this.db.raw(
      `INSERT INTO langgraph_checkpoints
       (thread_id, checkpoint_id, checkpoint, metadata, parent_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        thread_id,
        checkpoint_id,
        JSON.stringify(checkpoint),
        JSON.stringify(metadata),
        parent_id ?? null,
      ]
    );

    return {
      configurable: {
        thread_id,
        checkpoint_id,
      },
    };
  }

  async delete(config: {
    configurable: { thread_id: string; checkpoint_id?: string };
  }): Promise<void> {
    const { thread_id, checkpoint_id } = config.configurable;

    if (checkpoint_id) {
      await this.db.raw(
        `DELETE FROM langgraph_checkpoints
         WHERE thread_id = $1 AND checkpoint_id = $2`,
        [thread_id, checkpoint_id]
      );
    } else {
      await this.db.raw(
        `DELETE FROM langgraph_checkpoints WHERE thread_id = $1`,
        [thread_id]
      );
    }
  }
}

// SQL for checkpoints table
export const CHECKPOINTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS langgraph_checkpoints (
  id SERIAL PRIMARY KEY,
  thread_id TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  checkpoint JSONB NOT NULL,
  metadata JSONB NOT NULL,
  parent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(thread_id, checkpoint_id)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_thread
  ON langgraph_checkpoints(thread_id, created_at DESC);
`;
```

---

## 7. Public Exports

### 7.1 packages/langgraph/src/index.ts

```typescript
/**
 * @aigentflow/langgraph
 *
 * LangGraph.js workflow engine for Aigentflow.
 */

// State
export * from './state';

// Graphs
export { createOrchestratorGraph, type OrchestratorGraph } from './graphs/orchestrator';

// Nodes
export { setAgentRegistry } from './nodes/execute';

// Checkpointer
export {
  PostgresCheckpointer,
  CHECKPOINTS_TABLE_SQL,
} from './checkpointer/postgres';

// Re-exports from LangGraph
export { END, START } from '@langchain/langgraph';
```

---

## Test Scenarios

```typescript
// packages/langgraph/tests/orchestrator.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createOrchestratorGraph } from '../src/graphs/orchestrator';
import { setAgentRegistry } from '../src/nodes/execute';
import { HumanMessage } from '@langchain/core/messages';

describe('Orchestrator Graph', () => {
  beforeAll(() => {
    // Mock agent registry
    setAgentRegistry({
      getAgent: (type) => ({
        execute: async () => ({
          success: true,
          result: { mock: true },
          artifacts: [],
          routingHints: { isComplete: type === 'reviewer' },
        }),
      }),
    });
  });

  it('should analyze task and build agent queue', async () => {
    const graph = createOrchestratorGraph();

    const result = await graph.invoke({
      tenantId: 'tenant-1',
      projectId: 'project-1',
      taskId: 'task-1',
      prompt: 'Add a login page with email and password',
    });

    expect(result.analysis).toBeDefined();
    expect(result.analysis?.taskType).toBe('feature');
    expect(result.analysis?.requiresUI).toBe(true);
  });

  it('should execute agents in order', async () => {
    const graph = createOrchestratorGraph();

    const result = await graph.invoke({
      tenantId: 'tenant-1',
      projectId: 'project-1',
      taskId: 'task-1',
      prompt: 'Fix the null pointer bug in auth.ts',
    });

    expect(result.completedAgents).toContain('bug_fixer');
    expect(result.completedAgents).toContain('tester');
    expect(result.completedAgents).toContain('reviewer');
  });

  it('should handle workflow completion', async () => {
    const graph = createOrchestratorGraph();

    const result = await graph.invoke({
      tenantId: 'tenant-1',
      projectId: 'project-1',
      taskId: 'task-1',
      prompt: 'Add a simple utility function',
    });

    expect(result.status).toBe('completed');
  });
});
```

---

## Validation Checklist

```
□ packages/langgraph created with LangGraph.js
□ State channels defined (OrchestratorState)
□ Main orchestrator graph implemented
□ Nodes: analyze, route, execute, approve
□ Conditional routing between nodes
□ PostgreSQL checkpointer implemented
□ Human-in-the-loop with interrupt()
□ Agent registry integration
□ Streaming support configured
□ All tests passing
```

---

## Next Step

Proceed to **04-NESTJS-API.md** to implement the NestJS backend server.
