/**
 * @aigentflow/mcp-servers
 *
 * MCP (Model Context Protocol) server configuration and management.
 * Provides types, configuration, and tool routing for MCP servers.
 *
 * @packageDocumentation
 */

// Version
export const MCP_SERVERS_VERSION = '1.0.0';

// Types and schemas
export {
  // Transport
  TransportTypeSchema,
  type TransportType,
  // Status
  ServerStatusSchema,
  type ServerStatus,
  // Authentication
  AuthMethodSchema,
  AuthConfigSchema,
  type AuthMethod,
  type AuthConfig,
  // Permissions
  ServerPermissionsSchema,
  type ServerPermissions,
  // Tools
  McpToolSchema,
  type McpTool,
  // Resources
  McpResourceSchema,
  type McpResource,
  // Server Config
  McpServerConfigSchema,
  type McpServerConfig,
  ServerScopeSchema,
  type ServerScope,
  // Connection
  type ServerConnection,
  // Tool Calls
  ToolCallRequestSchema,
  type ToolCallRequest,
  type ToolCallResult,
  // Protocol
  type JsonRpcMessage,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcNotification,
  // Security Constants
  BLOCKED_ENV_PATTERNS,
  ALLOWED_COMMANDS,
  type AllowedCommand,
  // Validation Helpers
  isBlockedEnvVar,
  filterSafeEnv,
  validateCommandArgs,
  sanitizePath,
  validateUrl,
  // Config Helpers
  createServerConfig,
  validateServerConfig,
  safeParseServerConfig,
  hasDangerousPermissions,
  getConfigRiskSummary,
} from './types.js';

// Server Configuration Manager
export {
  ServerConfigManager,
  getConfigManager,
  resetConfigManager,
  mergeConfigs,
  createProjectOverride,
  CONFIG_SOURCE_PRIORITY,
  type ConfigSource,
  type RegisteredConfig,
  type RegisterResult,
  type ConfigManagerStats,
} from './server-config.js';

// Tool Registry
export {
  ToolRegistry,
  getToolRegistry,
  resetToolRegistry,
  searchTools,
  searchToolsByDescription,
  getToolsGroupedByServer,
  formatToolForDisplay,
  type ToolRoute,
  type ToolConflict,
  type McpConnectionProvider,
  type ToolRegistryStats,
} from './tool-registry.js';

// Built-in Configurations
export {
  BUILT_IN_SERVERS,
  SAFE_SERVERS,
  FILESYSTEM_SERVER,
  GIT_SERVER,
  MEMORY_SERVER,
  WEB_SERVER,
  GITHUB_SERVER,
  TERMINAL_SERVER,
  POSTGRES_SERVER,
  getBuiltInServer,
  getBuiltInServerIds,
  getServersByRiskLevel,
} from './built-in-configs.js';

// ============================================================================
// Initialization Helpers
// ============================================================================

import { ServerConfigManager, getConfigManager } from './server-config.js';
import { ToolRegistry, getToolRegistry } from './tool-registry.js';
import { BUILT_IN_SERVERS } from './built-in-configs.js';
import type { McpConnectionProvider } from './tool-registry.js';
import type { ServerConnection } from './types.js';

/**
 * MCP System components
 */
export interface McpSystem {
  configManager: ServerConfigManager;
  toolRegistry: ToolRegistry;
}

/**
 * Initialize MCP system with built-in configs
 */
export function initializeMcpSystem(): McpSystem {
  const configManager = getConfigManager();
  const toolRegistry = getToolRegistry();

  // Register built-in servers
  for (const server of BUILT_IN_SERVERS) {
    configManager.register(server, 'built-in');
  }

  // Build routes from static config
  toolRegistry.buildRoutesFromConfigs();

  return { configManager, toolRegistry };
}

/**
 * Initialize MCP system with custom configs
 */
export function initializeMcpSystemWithConfigs(
  configs: { config: import('./types.js').McpServerConfig; source: import('./server-config.js').ConfigSource }[]
): McpSystem {
  const system = initializeMcpSystem();

  // Register additional configs
  for (const { config, source } of configs) {
    system.configManager.register(config, source);
  }

  // Rebuild routes
  system.toolRegistry.buildRoutesFromConfigs();

  return system;
}

/**
 * Update tool registry with active connections
 */
export function updateToolRegistryWithConnections(
  connections: ServerConnection[],
  connectionProvider?: McpConnectionProvider
): void {
  const registry = getToolRegistry();

  // Build routes from active connections
  registry.buildRoutes(connections);

  // Set connection provider if provided
  if (connectionProvider) {
    registry.setConnectionProvider(connectionProvider);
  }
}

/**
 * Reset MCP system (for testing)
 */
export function resetMcpSystem(): void {
  const { resetConfigManager } = require('./server-config.js');
  const { resetToolRegistry } = require('./tool-registry.js');
  resetConfigManager();
  resetToolRegistry();
}
