/**
 * Workflow Service
 *
 * Manages LangGraph workflow execution for tasks.
 * Bridges the API layer to the orchestrator graph.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MemorySaver } from '@langchain/langgraph';
import { Observable, Subject } from 'rxjs';

import {
  createOrchestratorGraph,
  executeWorkflowStreaming,
  resumeWorkflow,
  setAgentRegistry,
  createStreamEvent,
  type OrchestratorGraph,
  type OrchestratorStateType,
  type StreamEvent,
  type ApprovalResponse,
  type WorkflowStreamCallback,
} from '@aigentflow/langgraph';

import { getAgentAdapter } from './agent-adapter';

/**
 * Workflow input for starting a new task
 */
export interface WorkflowInput {
  tenantId: string;
  projectId: string;
  taskId: string;
  prompt: string;
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  taskId: string;
  status: OrchestratorStateType['status'];
  completedAgents: string[];
  artifacts: OrchestratorStateType['agentOutputs'][0]['artifacts'];
  error?: string;
  pendingApproval?: OrchestratorStateType['approvalRequest'];
}

@Injectable()
export class WorkflowService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowService.name);
  private graph: OrchestratorGraph | null = null;
  private checkpointer: MemorySaver | null = null;
  private readonly eventStreams = new Map<string, Subject<StreamEvent>>();

  onModuleInit(): void {
    this.initialize();
  }

  /**
   * Initialize the workflow engine
   */
  private initialize(): void {
    this.logger.log('Initializing workflow engine...');

    // Initialize agent registry adapter
    const agentAdapter = getAgentAdapter();
    setAgentRegistry(agentAdapter);
    this.logger.log(
      `Agent registry initialized with agents: ${agentAdapter.getAvailableAgents().join(', ')}`
    );

    // Create checkpointer (in-memory for now, PostgreSQL in production)
    this.checkpointer = new MemorySaver();

    // Create the orchestrator graph
    this.graph = createOrchestratorGraph({
      checkpointer: this.checkpointer,
      interruptBefore: ['awaiting_approval'],
    });

    this.logger.log('Workflow engine initialized successfully');
  }

  /**
   * Start a new workflow for a task
   */
  async startWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
    if (!this.graph) {
      throw new Error('Workflow engine not initialized');
    }

    const { tenantId, projectId, taskId, prompt } = input;
    this.logger.log(`Starting workflow for task: ${taskId}`);

    // Create event stream for this task
    const eventSubject = new Subject<StreamEvent>();
    this.eventStreams.set(taskId, eventSubject);

    try {
      // Emit workflow started event using partial state
      eventSubject.next(
        createStreamEvent('workflow.started', {
          taskId,
          tenantId,
          projectId,
          prompt,
        })
      );

      // Create streaming callback to emit events as nodes complete
      const streamCallback: WorkflowStreamCallback = {
        onNodeEnd: (nodeName, stateUpdate) => {
          this.logger.debug(`Node completed: ${nodeName}`);

          // Emit appropriate event based on node name
          switch (nodeName) {
            case 'analyze':
              eventSubject.next(
                createStreamEvent('workflow.analyzing', {
                  taskId,
                  ...stateUpdate,
                })
              );
              break;

            case 'route_to_agent':
              eventSubject.next(
                createStreamEvent('workflow.routing', {
                  taskId,
                  agentQueue: stateUpdate.agentQueue,
                  currentAgent: stateUpdate.currentAgent,
                })
              );
              break;

            case 'execute_agent':
              // Emit agent completed event with details
              const lastOutput = stateUpdate.agentOutputs?.[
                (stateUpdate.agentOutputs?.length ?? 1) - 1
              ];
              if (lastOutput) {
                eventSubject.next(
                  createStreamEvent('workflow.agent_completed', {
                    taskId,
                    agentOutputs: [lastOutput],
                    completedAgents: stateUpdate.completedAgents,
                  })
                );
              }
              break;

            case 'awaiting_approval':
              eventSubject.next(
                createStreamEvent('workflow.approval_needed', {
                  taskId,
                  approvalRequest: stateUpdate.approvalRequest,
                })
              );
              break;
          }
        },
      };

      // Execute the workflow with streaming
      const result = await executeWorkflowStreaming(
        this.graph,
        { tenantId, projectId, taskId, prompt },
        { threadId: taskId },
        streamCallback
      );

      // Emit final completion or failure event
      if (result.status === 'awaiting_approval' && result.approvalRequest) {
        // Already emitted in callback
      } else if (result.status === 'completed') {
        eventSubject.next(
          createStreamEvent('workflow.completed', {
            taskId,
            completedAgents: result.completedAgents,
            agentOutputs: result.agentOutputs,
          })
        );
        eventSubject.complete();
        this.eventStreams.delete(taskId);
      } else if (result.status === 'failed') {
        eventSubject.next(
          createStreamEvent('workflow.failed', {
            taskId,
            error: result.error,
            agentOutputs: result.agentOutputs,
          })
        );
        eventSubject.complete();
        this.eventStreams.delete(taskId);
      }

      return this.mapStateToResult(taskId, result);
    } catch (error) {
      this.logger.error(
        `Workflow failed for task ${taskId}:`,
        error instanceof Error ? error.stack : String(error)
      );

      eventSubject.next(
        createStreamEvent('workflow.error', {
          taskId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      eventSubject.complete();
      this.eventStreams.delete(taskId);

      throw error;
    }
  }

  /**
   * Resume a workflow after approval
   */
  async resumeWithApproval(
    taskId: string,
    approved: boolean,
    feedback?: string,
    selectedOption?: string
  ): Promise<WorkflowResult> {
    if (!this.graph) {
      throw new Error('Workflow engine not initialized');
    }

    this.logger.log(
      `Resuming workflow for task: ${taskId}, approved: ${approved}`
    );

    const approvalResponse: ApprovalResponse = {
      approved,
      feedback,
      selectedOption,
      timestamp: new Date().toISOString(),
    };

    // Get or create event stream
    let eventSubject = this.eventStreams.get(taskId);
    if (!eventSubject) {
      eventSubject = new Subject<StreamEvent>();
      this.eventStreams.set(taskId, eventSubject);
    }

    try {
      // Resume the workflow
      const result = await resumeWorkflow(
        this.graph,
        taskId,
        approvalResponse
      );

      // Emit appropriate event
      if (result.status === 'awaiting_approval' && result.approvalRequest) {
        eventSubject.next(
          createStreamEvent('workflow.approval_needed', {
            taskId,
            approvalRequest: result.approvalRequest,
          })
        );
      } else if (result.status === 'completed') {
        eventSubject.next(
          createStreamEvent('workflow.completed', {
            taskId,
            completedAgents: result.completedAgents,
            agentOutputs: result.agentOutputs,
          })
        );
        eventSubject.complete();
        this.eventStreams.delete(taskId);
      } else if (result.status === 'failed') {
        eventSubject.next(
          createStreamEvent('workflow.failed', {
            taskId,
            error: result.error,
            agentOutputs: result.agentOutputs,
          })
        );
        eventSubject.complete();
        this.eventStreams.delete(taskId);
      }

      return this.mapStateToResult(taskId, result);
    } catch (error) {
      this.logger.error(
        `Resume failed for task ${taskId}:`,
        error instanceof Error ? error.stack : String(error)
      );

      eventSubject.next(
        createStreamEvent('workflow.error', {
          taskId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      eventSubject.complete();
      this.eventStreams.delete(taskId);

      throw error;
    }
  }

  /**
   * Get event stream for a task
   */
  getEventStream(taskId: string): Observable<StreamEvent> | null {
    const subject = this.eventStreams.get(taskId);
    return subject?.asObservable() ?? null;
  }

  /**
   * Abort a running workflow
   */
  abortWorkflow(taskId: string): void {
    const eventSubject = this.eventStreams.get(taskId);
    if (eventSubject) {
      // Create an error event for abort
      eventSubject.next(
        createStreamEvent('workflow.error', {
          taskId,
          error: 'Workflow aborted by user',
        })
      );
      eventSubject.complete();
      this.eventStreams.delete(taskId);
    }
    this.logger.log(`Workflow aborted for task: ${taskId}`);
  }

  /**
   * Map orchestrator state to workflow result
   */
  private mapStateToResult(
    taskId: string,
    state: OrchestratorStateType
  ): WorkflowResult {
    // Collect all artifacts from agent outputs
    const allArtifacts = state.agentOutputs.flatMap((output) => output.artifacts);

    return {
      taskId,
      status: state.status,
      completedAgents: state.completedAgents,
      artifacts: allArtifacts,
      error: state.error ?? undefined,
      pendingApproval: state.approvalRequest ?? undefined,
    };
  }

  /**
   * Check if workflow engine is ready
   */
  isReady(): boolean {
    return this.graph !== null;
  }
}
