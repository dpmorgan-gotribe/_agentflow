/**
 * Agent Registry Adapter
 *
 * Adapts the @aigentflow/agents to the interface
 * expected by @aigentflow/langgraph execute node.
 *
 * Creates agents directly with a simple ContextManager rather than
 * going through the registry, since the registry expects parameterless
 * constructors but agents need a ContextManager.
 */

import type {
  Agent as LangGraphAgent,
  AgentContext as LangGraphAgentContext,
  AgentResult as LangGraphAgentResult,
  AgentRegistry as LangGraphAgentRegistry,
  AgentActivity,
} from '@aigentflow/langgraph';
import {
  OrchestratorAgent,
  ProjectManagerAgent,
  ArchitectAgent,
  AnalystAgent,
  ProjectAnalyzerAgent,
  ComplianceAgent,
  UIDesignerAgent,
  ContextManager,
  ContextTypeEnum,
  AgentTypeEnum,
  DEFAULT_CONSTRAINTS,
  type AgentType,
  type AgentRequest,
  type AgentContext as AgentsAgentContext,
  type ContextItem,
  type BaseAgent,
} from '@aigentflow/agents';

/**
 * Extract activity data from agent output
 *
 * Parses the agent output to extract:
 * - thinking: Any reasoning/thinking from the agent
 * - response: Summary or main output text
 * - tools: Tools used during execution
 * - hooks: Pre/post execution hooks
 * - tokenUsage: Token consumption metrics
 */
function extractActivity(
  output: unknown,
  agentType: AgentType,
  startTime: number
): AgentActivity {
  const activity: AgentActivity = {};
  const duration = Date.now() - startTime;

  // Handle full AgentOutput structure from @aigentflow/agents
  if (output && typeof output === 'object') {
    const outputObj = output as Record<string, unknown>;

    // Extract from result field (nested agent output)
    const result = outputObj.result;
    if (result && typeof result === 'object') {
      const resultObj = result as Record<string, unknown>;

      // Check for thinking/reasoning field
      if (typeof resultObj.thinking === 'string') {
        activity.thinking = resultObj.thinking;
      } else if (typeof resultObj.reasoning === 'string') {
        activity.thinking = resultObj.reasoning;
      }

      // Check for response/summary field
      if (typeof resultObj.response === 'string') {
        activity.response = resultObj.response.slice(0, 2000);
      } else if (typeof resultObj.summary === 'string') {
        activity.response = resultObj.summary.slice(0, 2000);
      } else if (typeof resultObj.output === 'string') {
        activity.response = resultObj.output.slice(0, 2000);
      } else if (typeof resultObj.description === 'string') {
        activity.response = resultObj.description.slice(0, 2000);
      }

      // Check for tools used
      if (Array.isArray(resultObj.toolsUsed)) {
        activity.tools = extractTools(resultObj.toolsUsed);
      }
    }

    // Direct fields on output object
    if (!activity.thinking && typeof outputObj.thinking === 'string') {
      activity.thinking = outputObj.thinking;
    }
    if (!activity.response && typeof outputObj.summary === 'string') {
      activity.response = outputObj.summary.slice(0, 2000);
    }

    // Extract token usage from metrics (primary source from BaseAgent)
    if (outputObj.metrics && typeof outputObj.metrics === 'object') {
      const metrics = outputObj.metrics as Record<string, unknown>;
      const inputTokens = typeof metrics.inputTokens === 'number' ? metrics.inputTokens : 0;
      const outputTokens = typeof metrics.outputTokens === 'number' ? metrics.outputTokens : 0;
      if (inputTokens > 0 || outputTokens > 0) {
        activity.tokenUsage = {
          input: inputTokens,
          output: outputTokens,
        };
      }
    }

    // Fallback: check for tokenUsage directly on result
    if (!activity.tokenUsage && result && typeof result === 'object') {
      const resultObj = result as Record<string, unknown>;
      if (resultObj.tokenUsage && typeof resultObj.tokenUsage === 'object') {
        const usage = resultObj.tokenUsage as Record<string, unknown>;
        if (typeof usage.input === 'number' && typeof usage.output === 'number') {
          activity.tokenUsage = {
            input: usage.input,
            output: usage.output,
          };
        }
      }
    }

    // Extract artifacts as tools if no other tools found
    if (!activity.tools && Array.isArray(outputObj.artifacts)) {
      activity.tools = outputObj.artifacts.map((a: unknown) => {
        if (a && typeof a === 'object') {
          const artifact = a as Record<string, unknown>;
          return {
            name: `Create ${String(artifact.type || 'artifact')}`,
            output: String(artifact.path || artifact.id || 'unknown'),
          };
        }
        return { name: 'artifact' };
      });
    }
  }

  // If output is a string, treat it as the response
  if (typeof output === 'string') {
    activity.response = output.slice(0, 2000);
  }

  // Add execution hooks
  activity.hooks = [
    {
      name: 'validate-input',
      type: 'pre',
      status: 'success',
      message: 'Input validation passed',
    },
    {
      name: 'validate-output',
      type: 'post',
      status: 'success',
      message: `Completed in ${duration}ms`,
    },
  ];

  return activity;
}

/**
 * Extract tools from various formats
 */
function extractTools(
  tools: unknown[]
): Array<{ name: string; input?: string; output?: string; duration?: number }> {
  return tools.map((tool: unknown) => {
    if (typeof tool === 'string') {
      return { name: tool };
    }
    if (tool && typeof tool === 'object') {
      const t = tool as Record<string, unknown>;
      return {
        name: String(t.name || 'unknown'),
        input: typeof t.input === 'string' ? t.input.slice(0, 500) : undefined,
        output: typeof t.output === 'string' ? t.output.slice(0, 500) : undefined,
        duration: typeof t.duration === 'number' ? t.duration : undefined,
      };
    }
    return { name: 'unknown' };
  });
}

/**
 * Maps LangGraph artifact type to @aigentflow/agents artifact type
 */
function mapArtifactType(
  type: string
): 'mockup' | 'source_file' | 'test_file' | 'config_file' | 'documentation' {
  switch (type) {
    case 'mockup':
    case 'stylesheet':
    case 'flow_diagram':
      return 'mockup';
    case 'source_file':
      return 'source_file';
    case 'test_file':
      return 'test_file';
    case 'config_file':
      return 'config_file';
    case 'documentation':
    case 'report':
      return 'documentation';
    default:
      return 'documentation';
  }
}

/**
 * Creates agent instances
 *
 * Most agents have parameterless constructors.
 * OrchestratorAgent requires a ContextManager.
 */
function createAgent(
  type: AgentType,
  contextManager: ContextManager
): BaseAgent | null {
  switch (type) {
    case AgentTypeEnum.ORCHESTRATOR:
      return new OrchestratorAgent(contextManager);
    case AgentTypeEnum.PROJECT_MANAGER:
      return new ProjectManagerAgent();
    case AgentTypeEnum.ARCHITECT:
      return new ArchitectAgent();
    case AgentTypeEnum.ANALYZER:
      return new AnalystAgent();
    case AgentTypeEnum.PROJECT_ANALYZER:
      return new ProjectAnalyzerAgent();
    case AgentTypeEnum.COMPLIANCE:
    case AgentTypeEnum.COMPLIANCE_AGENT:
      return new ComplianceAgent();
    case AgentTypeEnum.UI_DESIGNER:
      return new UIDesignerAgent();
    default:
      return null;
  }
}

/**
 * Wraps a BaseAgent to conform to LangGraph's Agent interface
 */
class AgentWrapper implements LangGraphAgent {
  private contextManager: ContextManager;

  constructor(
    private agentType: AgentType,
    private logger: { debug: (msg: string) => void }
  ) {
    // Create a simple context manager
    // In production, this would be injected with proper context sources
    this.contextManager = new ContextManager();
  }

  async execute(context: LangGraphAgentContext): Promise<LangGraphAgentResult> {
    const startTime = Date.now();
    const agent = createAgent(this.agentType, this.contextManager);

    if (!agent) {
      return {
        success: false,
        result: null,
        artifacts: [],
        routingHints: { hasFailures: true },
        error: `Agent not found: ${this.agentType}`,
      };
    }

    try {
      this.logger.debug(`Executing agent: ${this.agentType}`);

      const executionId = crypto.randomUUID();

      // Build context items - start with CURRENT_TASK (required by all agents)
      const contextItems: ContextItem[] = [
        {
          type: ContextTypeEnum.CURRENT_TASK,
          content: {
            prompt: context.prompt,
            analysis: context.analysis,
            taskId: context.taskId,
            projectId: context.projectId,
          },
          metadata: {
            source: 'orchestrator',
            timestamp: new Date(),
            relevance: 1,
          },
        },
        // Add workflow settings as context item
        {
          type: ContextTypeEnum.WORKFLOW_SETTINGS,
          content: context.workflowSettings,
          metadata: {
            source: 'orchestrator',
            timestamp: new Date(),
            relevance: 1,
          },
        },
      ];

      // Add previous agent outputs as context items
      for (const output of context.previousOutputs) {
        for (const a of output.artifacts) {
          contextItems.push({
            type: ContextTypeEnum.AGENT_OUTPUTS,
            content: {
              agentId: output.agentId,
              artifactId: a.id,
              artifactType: a.type,
              path: a.path,
              content: a.content,
            },
            metadata: {
              source: output.agentId,
              timestamp: new Date(output.timestamp),
              relevance: 1,
            },
          });
        }
      }

      // Build the full agent context
      const agentContext: AgentsAgentContext = {
        projectId: context.projectId,
        executionId,
        tenantId: context.tenantId,
        userId: context.tenantId, // Use tenantId as userId for now
        sessionId: context.taskId,
        task: context.analysis ?? {
          taskType: 'feature',
          complexity: 'moderate',
          requiresUI: true,
          requiresBackend: true,
          requiresArchitecture: false,
          requiresApproval: false,
          suggestedAgents: [],
        },
        items: contextItems,
        previousOutputs: context.previousOutputs,
        constraints: DEFAULT_CONSTRAINTS,
      };

      // Build the request for the agent
      const request: AgentRequest = {
        executionId,
        task: context.analysis ?? {
          taskType: 'feature',
          complexity: 'moderate',
          requiresUI: true,
          requiresBackend: true,
          requiresArchitecture: false,
          requiresApproval: false,
          suggestedAgents: [],
        },
        context: agentContext,
        options: {},
      };

      // Execute the agent
      const output = await agent.execute(request);

      // Extract activity data from the agent output
      const activity = extractActivity(output.result, this.agentType, startTime);

      return {
        success: output.success,
        result: output.result,
        artifacts: output.artifacts.map((a) => ({
          id: a.id,
          type: mapArtifactType(a.type),
          path: a.path,
          content: a.content,
        })),
        routingHints: {
          suggestNext: output.routingHints?.suggestNext,
          skipAgents: output.routingHints?.skipAgents,
          needsApproval: output.routingHints?.needsApproval,
          hasFailures: !output.success,
          isComplete: output.routingHints?.isComplete,
        },
        error: output.errors?.[0]?.message,
        activity,
      };
    } catch (error) {
      this.logger.debug(
        `Agent ${this.agentType} failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        success: false,
        result: null,
        artifacts: [],
        routingHints: { hasFailures: true },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * List of supported agent types
 */
const SUPPORTED_AGENTS: AgentType[] = [
  AgentTypeEnum.ORCHESTRATOR,
  AgentTypeEnum.PROJECT_MANAGER,
  AgentTypeEnum.ARCHITECT,
  AgentTypeEnum.ANALYZER,
  AgentTypeEnum.PROJECT_ANALYZER,
  AgentTypeEnum.COMPLIANCE,
  AgentTypeEnum.COMPLIANCE_AGENT,
  AgentTypeEnum.UI_DESIGNER,
];

/**
 * Agent type aliases - map common names to their canonical enum values
 */
const AGENT_ALIASES: Record<string, AgentType> = {
  'analyst': AgentTypeEnum.ANALYZER,
  'project_analyzer': AgentTypeEnum.PROJECT_ANALYZER,
  'compliance_agent': AgentTypeEnum.COMPLIANCE_AGENT,
};

/**
 * Adapter that implements LangGraph's AgentRegistry interface
 * by creating agents directly (bypassing the registry's parameterless
 * constructor requirement)
 */
export class LangGraphAgentAdapter implements LangGraphAgentRegistry {
  private wrappers = new Map<string, AgentWrapper>();
  private logger = {
    debug: (msg: string) => console.debug(`[AgentAdapter] ${msg}`),
  };

  constructor() {
    this.logger.debug(`Agent adapter initialized with ${SUPPORTED_AGENTS.length} supported agents`);
  }

  /**
   * Get an agent by type - implements LangGraphAgentRegistry interface
   */
  getAgent(type: string): LangGraphAgent | undefined {
    // Resolve alias first (e.g., 'analyst' -> 'analyzer')
    const resolvedType = AGENT_ALIASES[type] ?? type;

    // Check cache first (use original type as key for consistency)
    if (this.wrappers.has(type)) {
      return this.wrappers.get(type);
    }

    // Check if the resolved agent type is supported
    const agentType = resolvedType as AgentType;
    if (SUPPORTED_AGENTS.includes(agentType)) {
      const wrapper = new AgentWrapper(agentType, this.logger);
      this.wrappers.set(type, wrapper); // Cache with original type
      this.logger.debug(`Created agent: ${type} (resolved to ${resolvedType})`);
      return wrapper;
    }

    this.logger.debug(`Agent not found: ${type}`);
    return undefined;
  }

  /**
   * Get list of available agents
   */
  getAvailableAgents(): string[] {
    return SUPPORTED_AGENTS;
  }
}

/**
 * Singleton instance of the adapter
 */
let adapterInstance: LangGraphAgentAdapter | null = null;

/**
 * Get the singleton adapter instance
 */
export function getAgentAdapter(): LangGraphAgentAdapter {
  if (!adapterInstance) {
    adapterInstance = new LangGraphAgentAdapter();
  }
  return adapterInstance;
}

/**
 * Reset the adapter (for testing)
 */
export function resetAgentAdapter(): void {
  adapterInstance = null;
}
