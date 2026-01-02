/**
 * Workflow Service
 *
 * Manages LangGraph workflow execution for tasks.
 * Bridges the API layer to the orchestrator graph.
 */

import { Injectable, Logger, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { MemorySaver } from '@langchain/langgraph';
import { Observable, ReplaySubject } from 'rxjs';

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
  type WorkflowSettings,
} from '@aigentflow/langgraph';

import { getAgentAdapter } from './agent-adapter';
import {
  ProjectDirectoryService,
  ProjectArtifactWriterService,
} from '../projects';
import { SettingsService } from '../settings';

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
export class WorkflowService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(WorkflowService.name);
  private graph: OrchestratorGraph | null = null;
  private checkpointer: MemorySaver | null = null;
  // Use ReplaySubject to buffer events for late subscribers (race condition fix)
  private readonly eventStreams = new Map<string, ReplaySubject<StreamEvent>>();

  constructor(
    private readonly projectDir: ProjectDirectoryService,
    private readonly artifactWriter: ProjectArtifactWriterService,
    private readonly settingsService: SettingsService
  ) {}

  onModuleInit(): void {
    this.initialize();
  }

  /**
   * Cleanup on application shutdown
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`WorkflowService shutting down (signal: ${signal ?? 'unknown'})`);

    // Abort all running workflows
    for (const [taskId, subject] of this.eventStreams) {
      this.logger.debug(`Aborting workflow for task: ${taskId}`);
      subject.next(
        createStreamEvent('workflow.error', {
          taskId,
          error: 'Server shutting down',
        })
      );
      subject.complete();
    }
    this.eventStreams.clear();

    // Clear graph and checkpointer
    this.graph = null;
    this.checkpointer = null;

    this.logger.log('WorkflowService shutdown complete');
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

    // Get current workflow settings
    const settings = this.settingsService.getSettings();
    this.logger.log(`Workflow settings: stylePackageCount=${settings.stylePackageCount}, parallelDesignerCount=${settings.parallelDesignerCount}`);

    // Create event stream for this task with replay buffer for late subscribers
    const eventSubject = new ReplaySubject<StreamEvent>(50);
    this.eventStreams.set(taskId, eventSubject);

    try {
      // Create project directory at workflow start
      const project = await this.projectDir.getOrCreateProject(projectId, prompt);
      this.logger.log(
        `Project directory: ${project.slug} (${project.isNew ? 'created' : 'existing'})`
      );

      // Emit workflow started event using partial state
      eventSubject.next(
        createStreamEvent('workflow.started', {
          taskId,
          tenantId,
          projectId,
          prompt,
        })
      );

      // Log project info separately
      this.logger.log(`Project: ${project.slug} at ${project.path}`);

      // Create streaming callback to emit events as nodes complete
      const streamCallback: WorkflowStreamCallback = {
        onNodeEnd: (nodeName, stateUpdate) => {
          this.logger.debug(`Node completed: ${nodeName}`);

          // Emit appropriate event based on node name
          switch (nodeName) {
            case 'analyze':
              // Include analysis details with reasoning
              const analysis = stateUpdate.analysis;
              eventSubject.next(
                createStreamEvent('workflow.analyzing', {
                  taskId,
                  analysis,
                  agentQueue: stateUpdate.agentQueue,
                  reasoning: analysis
                    ? `Task Analysis Complete:\n` +
                      `• Type: ${analysis.taskType}\n` +
                      `• Complexity: ${analysis.complexity}\n` +
                      `• Requires UI: ${analysis.requiresUI ? 'Yes' : 'No'}\n` +
                      `• Requires Backend: ${analysis.requiresBackend ? 'Yes' : 'No'}\n` +
                      `• Requires Architecture: ${analysis.requiresArchitecture ? 'Yes' : 'No'}\n` +
                      `• Agents: ${(stateUpdate.agentQueue || []).join(' → ')}`
                    : 'Analyzing task requirements...',
                })
              );
              break;

            case 'think':
              // Orchestrator thinking step - check for thinking/reasoning in state
              const thinking = (stateUpdate as Record<string, unknown>).thinking ||
                               (stateUpdate as Record<string, unknown>).reasoning ||
                               'Orchestrator is planning next steps...';
              eventSubject.next(
                createStreamEvent('workflow.orchestrator_thinking', {
                  taskId,
                  thinking: String(thinking),
                  agentQueue: stateUpdate.agentQueue,
                  reasoning: String(thinking),
                })
              );
              break;

            case 'dispatch':
            case 'route_to_agent':
              eventSubject.next(
                createStreamEvent('workflow.routing', {
                  taskId,
                  agentQueue: stateUpdate.agentQueue,
                  currentAgent: stateUpdate.currentAgent,
                  reasoning: `Routing to: ${stateUpdate.currentAgent || 'next agent'}\n` +
                    `Remaining queue: ${(stateUpdate.agentQueue || []).join(' → ') || 'empty'}`,
                })
              );
              // Also emit agent_started event so UI shows agent as working
              if (stateUpdate.currentAgent) {
                eventSubject.next(
                  createStreamEvent('workflow.agent_started', {
                    taskId,
                    agentId: stateUpdate.currentAgent,
                    reasoning: `Starting agent: ${stateUpdate.currentAgent}`,
                  })
                );
              }
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
                    agentId: lastOutput.agentId,
                    success: lastOutput.success,
                    artifactCount: lastOutput.artifacts?.length || 0,
                    reasoning:
                      `Agent ${lastOutput.agentId} ${lastOutput.success ? 'completed successfully' : 'failed'}\n` +
                      `Artifacts generated: ${lastOutput.artifacts?.length || 0}`,
                    completedAgents: stateUpdate.completedAgents,
                    // Include sub-agent activity details (thinking, tools, hooks, response)
                    activity: lastOutput.activity,
                  })
                );

                // Write artifacts to project directory based on agent type
                this.writeAgentArtifacts(
                  projectId,
                  prompt,
                  lastOutput.agentId,
                  lastOutput.result,
                  (lastOutput.artifacts ?? []).map((a) => ({
                    type: a.type,
                    name: a.id, // Use id as name since Artifact doesn't have name
                    path: a.path,
                    content: a.content,
                  }))
                ).catch((err) => {
                  this.logger.warn(
                    `Failed to write artifacts for ${lastOutput.agentId}: ${err}`
                  );
                });
              }
              break;

            case 'parallel_dispatch':
              // Handle parallel agent execution results (style competition, etc.)
              const parallelResults = (stateUpdate as Record<string, unknown>).parallelResults as Array<{
                agentId: string;
                executionId: string;
                success: boolean;
                output: unknown;
                artifacts: Array<{ id: string; type: string; path: string; content?: string }>;
                error?: string;
                stylePackageId?: string;
              }> | undefined;

              if (parallelResults && parallelResults.length > 0) {
                // Emit parallel completion event
                const successfulCount = parallelResults.filter(r => r.success).length;
                eventSubject.next(
                  createStreamEvent('workflow.parallel_completed', {
                    taskId,
                    totalAgents: parallelResults.length,
                    successfulAgents: successfulCount,
                    failedAgents: parallelResults.length - successfulCount,
                    reasoning: `Parallel execution complete: ${successfulCount}/${parallelResults.length} agents succeeded`,
                    completedAgents: stateUpdate.completedAgents,
                  })
                );

                // Write artifacts for each parallel agent
                for (const result of parallelResults) {
                  if (result.success && result.artifacts && result.artifacts.length > 0) {
                    // Emit individual agent completed event
                    eventSubject.next(
                      createStreamEvent('workflow.agent_completed', {
                        taskId,
                        agentId: result.agentId,
                        success: result.success,
                        artifactCount: result.artifacts.length,
                        reasoning: `Agent ${result.agentId} (parallel) completed with ${result.artifacts.length} artifact(s)`,
                        stylePackageId: result.stylePackageId,
                      })
                    );

                    // Write artifacts to project directory
                    this.writeAgentArtifacts(
                      projectId,
                      prompt,
                      result.agentId,
                      result.output,
                      result.artifacts.map((a) => ({
                        type: a.type,
                        name: a.id,
                        path: a.path,
                        content: a.content,
                      }))
                    ).catch((err) => {
                      this.logger.warn(
                        `Failed to write artifacts for parallel agent ${result.agentId}: ${err}`
                      );
                    });
                  } else if (!result.success) {
                    // Emit failure event
                    eventSubject.next(
                      createStreamEvent('workflow.agent_completed', {
                        taskId,
                        agentId: result.agentId,
                        success: false,
                        artifactCount: 0,
                        reasoning: `Agent ${result.agentId} (parallel) failed: ${result.error}`,
                        stylePackageId: result.stylePackageId,
                      })
                    );
                  }
                }
              }
              break;

            case 'awaiting_approval':
              eventSubject.next(
                createStreamEvent('workflow.approval_needed', {
                  taskId,
                  approvalRequest: stateUpdate.approvalRequest,
                  reasoning: 'Human approval required to proceed',
                })
              );
              break;
          }
        },
      };

      // Execute the workflow with streaming (include settings)
      const workflowSettings: WorkflowSettings = {
        stylePackageCount: settings.stylePackageCount,
        parallelDesignerCount: settings.parallelDesignerCount,
        enableStyleCompetition: settings.enableStyleCompetition,
        maxStyleRejections: settings.maxStyleRejections,
        claudeCliTimeoutMs: settings.claudeCliTimeoutMs,
      };
      const result = await executeWorkflowStreaming(
        this.graph,
        { tenantId, projectId, taskId, prompt, workflowSettings },
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
      // Log detailed error info for CLI errors
      const errorDetails = error as { stderr?: string; exitCode?: number };
      this.logger.error(
        `Workflow failed for task ${taskId}:`,
        error instanceof Error ? error.stack : String(error)
      );
      if (errorDetails.stderr) {
        this.logger.error(`CLI stderr: ${errorDetails.stderr}`);
      }
      if (errorDetails.exitCode !== undefined) {
        this.logger.error(`CLI exit code: ${errorDetails.exitCode}`);
      }

      const errorMessage = errorDetails.stderr
        ? `${error instanceof Error ? error.message : String(error)}: ${errorDetails.stderr}`
        : error instanceof Error ? error.message : String(error);

      eventSubject.next(
        createStreamEvent('workflow.error', {
          taskId,
          error: errorMessage,
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
      eventSubject = new ReplaySubject<StreamEvent>(50);
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
    // Collect all artifacts from agent outputs (handle undefined)
    const allArtifacts = (state.agentOutputs ?? []).flatMap(
      (output) => output.artifacts ?? []
    );

    return {
      taskId,
      status: state.status,
      completedAgents: state.completedAgents ?? [],
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

  /**
   * Write agent artifacts to project directory
   */
  private async writeAgentArtifacts(
    projectId: string,
    prompt: string,
    agentId: string,
    output: unknown,
    artifacts: Array<{ type: string; name: string; path: string; content?: string }>
  ): Promise<void> {
    const normalizedAgentId = agentId.toLowerCase();

    try {
      // Handle architect agent output
      if (normalizedAgentId.includes('architect')) {
        if (output && typeof output === 'object') {
          await this.artifactWriter.writeArchitectOutput(
            projectId,
            prompt,
            output as Parameters<typeof this.artifactWriter.writeArchitectOutput>[2]
          );
          this.logger.log('Architect artifacts written to project directory');
        }
        return;
      }

      // Handle UI designer agent output
      if (normalizedAgentId.includes('ui') || normalizedAgentId.includes('designer')) {
        if (output && typeof output === 'object') {
          await this.artifactWriter.writeUIDesignerOutput(
            projectId,
            output as Parameters<typeof this.artifactWriter.writeUIDesignerOutput>[1],
            artifacts.map((a) => ({
              type: a.type,
              name: a.name,
              path: a.path,
              content: a.content ?? '',
            }))
          );
          this.logger.log('UI Designer artifacts written to project directory');
        }
        return;
      }

      // For other agents, write generic artifacts
      if (artifacts.length > 0) {
        const agentArtifacts = artifacts.map((a) => ({
          type: a.type,
          name: a.name,
          path: a.path,
          content: a.content ?? '',
        }));

        await this.artifactWriter.writeArtifacts(
          projectId,
          agentArtifacts,
          `feat: artifacts from ${agentId}`
        );
        this.logger.log(
          `${artifacts.length} artifacts from ${agentId} written to project directory`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to write artifacts for agent ${agentId}: ${error}`
      );
      throw error;
    }
  }
}
