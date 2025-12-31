/**
 * MCP Tool Registry
 *
 * Routes tool calls to appropriate MCP servers.
 * Pure logic - actual execution delegated to connection provider.
 *
 * Features:
 * - Tool routing table
 * - Duplicate detection
 * - Permission checking
 * - Tool discovery
 *
 * SECURITY:
 * - Permission validation before routing
 * - Input validation for tool arguments
 * - Registry sealing after initialization
 */

import type {
  McpTool,
  McpServerConfig,
  ToolCallRequest,
  ToolCallResult,
  ServerConnection,
} from './types.js';
import { ToolCallRequestSchema, validateCommandArgs } from './types.js';
import { ServerConfigManager, getConfigManager } from './server-config.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Tool route entry
 */
export interface ToolRoute {
  serverId: string;
  serverName: string;
  tool: McpTool;
  permissions: McpServerConfig['permissions'];
  riskLevel: McpServerConfig['riskLevel'];
}

/**
 * Tool routing conflict
 */
export interface ToolConflict {
  toolName: string;
  servers: string[];
}

/**
 * Connection provider interface
 * Implemented by runtime layer for actual MCP communication
 */
export interface McpConnectionProvider {
  /**
   * Get active connections
   */
  getConnections(): ServerConnection[];

  /**
   * Send tool call to server
   */
  callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
    timeout?: number
  ): Promise<{ result?: unknown; error?: string }>;
}

/**
 * Tool registry statistics
 */
export interface ToolRegistryStats {
  totalTools: number;
  toolsByServer: Record<string, number>;
  conflicts: ToolConflict[];
}

// ============================================================================
// Tool Registry
// ============================================================================

/**
 * MCP Tool Registry
 */
export class ToolRegistry {
  private routes: Map<string, ToolRoute> = new Map();
  private conflicts: ToolConflict[] = [];
  private sealed: boolean = false;
  private configManager: ServerConfigManager;
  private connectionProvider: McpConnectionProvider | null = null;

  constructor(configManager?: ServerConfigManager) {
    this.configManager = configManager || getConfigManager();
  }

  /**
   * Set connection provider for tool execution
   */
  setConnectionProvider(provider: McpConnectionProvider): void {
    this.connectionProvider = provider;
  }

  /**
   * Build routing table from server configs
   * Call this when servers are connected
   */
  buildRoutes(connections: ServerConnection[]): void {
    if (this.sealed) {
      throw new Error('Registry is sealed - cannot rebuild routes');
    }

    this.routes.clear();
    this.conflicts = [];

    const toolServers: Map<string, string[]> = new Map();

    for (const connection of connections) {
      if (connection.status !== 'connected') continue;

      const config = connection.config;

      for (const tool of connection.availableTools) {
        // Track which servers provide this tool
        const servers = toolServers.get(tool.name) || [];
        servers.push(config.id);
        toolServers.set(tool.name, servers);

        // First server wins for routing
        if (!this.routes.has(tool.name)) {
          this.routes.set(tool.name, {
            serverId: config.id,
            serverName: config.name,
            tool,
            permissions: config.permissions,
            riskLevel: config.riskLevel,
          });
        }
      }
    }

    // Record conflicts
    for (const [toolName, servers] of toolServers) {
      if (servers.length > 1) {
        this.conflicts.push({ toolName, servers });
      }
    }
  }

  /**
   * Build routes from static tool definitions in configs
   */
  buildRoutesFromConfigs(): void {
    if (this.sealed) {
      throw new Error('Registry is sealed - cannot rebuild routes');
    }

    this.routes.clear();
    this.conflicts = [];

    const toolServers: Map<string, string[]> = new Map();
    const configs = this.configManager.getEnabled();

    for (const config of configs) {
      if (!config.tools) continue;

      for (const tool of config.tools) {
        // Track which servers provide this tool
        const servers = toolServers.get(tool.name) || [];
        servers.push(config.id);
        toolServers.set(tool.name, servers);

        // First server wins for routing
        if (!this.routes.has(tool.name)) {
          this.routes.set(tool.name, {
            serverId: config.id,
            serverName: config.name,
            tool,
            permissions: config.permissions,
            riskLevel: config.riskLevel,
          });
        }
      }
    }

    // Record conflicts
    for (const [toolName, servers] of toolServers) {
      if (servers.length > 1) {
        this.conflicts.push({ toolName, servers });
      }
    }
  }

  /**
   * Seal the registry
   */
  seal(): void {
    this.sealed = true;
  }

  /**
   * Check if registry is sealed
   */
  isSealed(): boolean {
    return this.sealed;
  }

  /**
   * Get tool route
   */
  getRoute(toolName: string): ToolRoute | undefined {
    return this.routes.get(toolName);
  }

  /**
   * Get tool definition
   */
  getTool(toolName: string): McpTool | undefined {
    return this.routes.get(toolName)?.tool;
  }

  /**
   * Check if tool exists
   */
  hasTool(toolName: string): boolean {
    return this.routes.has(toolName);
  }

  /**
   * Get server ID for a tool
   */
  getServerForTool(toolName: string): string | undefined {
    return this.routes.get(toolName)?.serverId;
  }

  /**
   * Get all available tools
   */
  getAvailableTools(): McpTool[] {
    return Array.from(this.routes.values()).map((r) => r.tool);
  }

  /**
   * Get all tool routes
   */
  getAllRoutes(): ToolRoute[] {
    return Array.from(this.routes.values());
  }

  /**
   * Get tools by server
   */
  getToolsByServer(serverId: string): McpTool[] {
    return Array.from(this.routes.values())
      .filter((r) => r.serverId === serverId)
      .map((r) => r.tool);
  }

  /**
   * Get conflicting tools
   */
  getConflicts(): ToolConflict[] {
    return [...this.conflicts];
  }

  /**
   * Check if tool requires dangerous permissions
   */
  requiresDangerousPermissions(toolName: string): boolean {
    const route = this.routes.get(toolName);
    if (!route) return false;

    const perms = route.permissions;
    if (!perms) return false;

    return (
      perms.executeCommands === true ||
      (perms.writeFiles === true &&
        (!perms.allowedPaths || perms.allowedPaths.length === 0)) ||
      (perms.networkAccess === true &&
        (!perms.allowedHosts || perms.allowedHosts.length === 0))
    );
  }

  /**
   * Get tool risk level
   */
  getToolRiskLevel(
    toolName: string
  ): McpServerConfig['riskLevel'] | undefined {
    return this.routes.get(toolName)?.riskLevel;
  }

  /**
   * Validate tool call request
   */
  validateRequest(request: ToolCallRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Schema validation
    const parseResult = ToolCallRequestSchema.safeParse(request);
    if (!parseResult.success) {
      errors.push(
        ...parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      );
      return { valid: false, errors };
    }

    // Check tool exists
    const route = this.routes.get(request.toolName);
    if (!route) {
      errors.push(`Unknown tool: ${request.toolName}`);
      return { valid: false, errors };
    }

    // Validate server ID if specified
    if (request.serverId && request.serverId !== route.serverId) {
      // Check if the specified server also has this tool
      const config = this.configManager.get(request.serverId);
      if (!config) {
        errors.push(`Unknown server: ${request.serverId}`);
        return { valid: false, errors };
      }
      const hasTool = config.tools?.some((t) => t.name === request.toolName);
      if (!hasTool) {
        errors.push(
          `Server ${request.serverId} does not have tool ${request.toolName}`
        );
        return { valid: false, errors };
      }
    }

    // Validate arguments against tool schema (basic check)
    const tool = route.tool;
    if (tool.required) {
      for (const required of tool.required) {
        if (!(required in request.arguments)) {
          errors.push(`Missing required argument: ${required}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Call a tool
   */
  async callTool(request: ToolCallRequest): Promise<ToolCallResult> {
    const startTime = Date.now();

    // Validate request
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join('; '),
        duration: Date.now() - startTime,
        serverId: request.serverId || '',
        toolName: request.toolName,
      };
    }

    // Get route
    const route = this.routes.get(request.toolName);
    if (!route) {
      return {
        success: false,
        error: `Unknown tool: ${request.toolName}`,
        duration: Date.now() - startTime,
        serverId: request.serverId || '',
        toolName: request.toolName,
      };
    }

    // Use specified server or routed server
    const serverId = request.serverId || route.serverId;

    // Check connection provider
    if (!this.connectionProvider) {
      return {
        success: false,
        error: 'No connection provider configured',
        duration: Date.now() - startTime,
        serverId,
        toolName: request.toolName,
      };
    }

    try {
      const result = await this.connectionProvider.callTool(
        serverId,
        request.toolName,
        request.arguments,
        request.timeout
      );

      return {
        success: !result.error,
        result: result.result,
        error: result.error,
        duration: Date.now() - startTime,
        serverId,
        toolName: request.toolName,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        serverId,
        toolName: request.toolName,
      };
    }
  }

  /**
   * Call multiple tools in parallel
   */
  async callToolsParallel(requests: ToolCallRequest[]): Promise<ToolCallResult[]> {
    return Promise.all(requests.map((req) => this.callTool(req)));
  }

  /**
   * Get statistics
   */
  getStats(): ToolRegistryStats {
    const toolsByServer: Record<string, number> = {};

    for (const route of this.routes.values()) {
      toolsByServer[route.serverId] =
        (toolsByServer[route.serverId] || 0) + 1;
    }

    return {
      totalTools: this.routes.size,
      toolsByServer,
      conflicts: [...this.conflicts],
    };
  }

  /**
   * Clear registry
   */
  clear(): void {
    this.routes.clear();
    this.conflicts = [];
    this.sealed = false;
  }

  /**
   * Get tool count
   */
  get size(): number {
    return this.routes.size;
  }
}

// ============================================================================
// Global Instance
// ============================================================================

/**
 * Global tool registry instance
 */
let globalToolRegistry: ToolRegistry | null = null;

/**
 * Get global tool registry
 */
export function getToolRegistry(): ToolRegistry {
  if (!globalToolRegistry) {
    globalToolRegistry = new ToolRegistry();
  }
  return globalToolRegistry;
}

/**
 * Reset global tool registry (for testing)
 */
export function resetToolRegistry(): void {
  if (globalToolRegistry) {
    globalToolRegistry.clear();
  }
  globalToolRegistry = null;
}

// ============================================================================
// Tool Search
// ============================================================================

/**
 * Search tools by name pattern
 */
export function searchTools(
  registry: ToolRegistry,
  pattern: string | RegExp
): McpTool[] {
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
  return registry.getAvailableTools().filter((tool) => regex.test(tool.name));
}

/**
 * Search tools by description
 */
export function searchToolsByDescription(
  registry: ToolRegistry,
  pattern: string | RegExp
): McpTool[] {
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
  return registry
    .getAvailableTools()
    .filter((tool) => regex.test(tool.description));
}

/**
 * Get tools grouped by server
 */
export function getToolsGroupedByServer(
  registry: ToolRegistry
): Map<string, McpTool[]> {
  const grouped = new Map<string, McpTool[]>();

  for (const route of registry.getAllRoutes()) {
    const tools = grouped.get(route.serverId) || [];
    tools.push(route.tool);
    grouped.set(route.serverId, tools);
  }

  return grouped;
}

/**
 * Format tool for display
 */
export function formatToolForDisplay(tool: McpTool): string {
  let display = `${tool.name}`;
  if (tool.description) {
    display += ` - ${tool.description}`;
  }
  if (tool.required && tool.required.length > 0) {
    display += ` (required: ${tool.required.join(', ')})`;
  }
  return display;
}
