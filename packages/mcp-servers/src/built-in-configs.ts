/**
 * Built-in MCP Server Configurations
 *
 * Pre-defined configurations for common MCP servers.
 * These serve as templates that can be overridden at project level.
 *
 * SECURITY:
 * - All dangerous servers have autoConnect: false
 * - Risk levels accurately reflect capabilities
 * - Permissions explicitly defined
 */

import type { McpServerConfig, McpTool } from './types.js';

// ============================================================================
// Filesystem Server
// ============================================================================

/**
 * Filesystem MCP server - provides file operations
 */
export const FILESYSTEM_SERVER: McpServerConfig = {
  id: 'filesystem',
  name: 'Filesystem Server',
  description: 'Provides file system read/write operations',
  version: '1.0.0',
  transport: 'stdio',
  command: 'npx',
  args: ['@modelcontextprotocol/server-filesystem'],
  enabled: true,
  autoConnect: false, // Requires explicit connection
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  scope: 'project',
  riskLevel: 'high', // File access is high risk
  permissions: {
    readFiles: true,
    writeFiles: true,
    executeCommands: false,
    networkAccess: false,
    databaseAccess: false,
    allowedPaths: [], // Must be configured per project
  },
  tools: [
    {
      name: 'read_file',
      description: 'Read contents of a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' },
        },
      },
      required: ['path'],
    },
    {
      name: 'write_file',
      description: 'Write contents to a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' },
          content: { type: 'string', description: 'Content to write' },
        },
      },
      required: ['path', 'content'],
    },
    {
      name: 'list_directory',
      description: 'List contents of a directory',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the directory' },
        },
      },
      required: ['path'],
    },
    {
      name: 'create_directory',
      description: 'Create a new directory',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path for the new directory' },
        },
      },
      required: ['path'],
    },
    {
      name: 'delete_file',
      description: 'Delete a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to delete' },
        },
      },
      required: ['path'],
    },
    {
      name: 'move_file',
      description: 'Move or rename a file',
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Current path' },
          destination: { type: 'string', description: 'New path' },
        },
      },
      required: ['source', 'destination'],
    },
  ],
};

// ============================================================================
// Git Server
// ============================================================================

/**
 * Git MCP server - provides git operations
 */
export const GIT_SERVER: McpServerConfig = {
  id: 'git',
  name: 'Git Server',
  description: 'Provides git version control operations',
  version: '1.0.0',
  transport: 'stdio',
  command: 'npx',
  args: ['@modelcontextprotocol/server-git'],
  enabled: true,
  autoConnect: false, // Requires explicit connection
  timeout: 60000, // Git operations can be slow
  retries: 3,
  retryDelay: 1000,
  scope: 'project',
  riskLevel: 'high', // Can modify repository
  permissions: {
    readFiles: true,
    writeFiles: true,
    executeCommands: true, // Git is a command
    networkAccess: true, // For push/pull
    databaseAccess: false,
  },
  tools: [
    {
      name: 'git_status',
      description: 'Get git repository status',
      inputSchema: {
        type: 'object',
        properties: {
          repo_path: { type: 'string', description: 'Path to the repository' },
        },
      },
      required: ['repo_path'],
    },
    {
      name: 'git_diff',
      description: 'Get git diff of changes',
      inputSchema: {
        type: 'object',
        properties: {
          repo_path: { type: 'string', description: 'Path to the repository' },
          target: { type: 'string', description: 'Diff target (commit, branch, or file)' },
        },
      },
      required: ['repo_path'],
    },
    {
      name: 'git_log',
      description: 'Get git commit log',
      inputSchema: {
        type: 'object',
        properties: {
          repo_path: { type: 'string', description: 'Path to the repository' },
          count: { type: 'number', description: 'Number of commits to show' },
        },
      },
      required: ['repo_path'],
    },
    {
      name: 'git_add',
      description: 'Stage files for commit',
      inputSchema: {
        type: 'object',
        properties: {
          repo_path: { type: 'string', description: 'Path to the repository' },
          files: { type: 'array', items: { type: 'string' }, description: 'Files to stage' },
        },
      },
      required: ['repo_path', 'files'],
    },
    {
      name: 'git_commit',
      description: 'Create a git commit',
      inputSchema: {
        type: 'object',
        properties: {
          repo_path: { type: 'string', description: 'Path to the repository' },
          message: { type: 'string', description: 'Commit message' },
        },
      },
      required: ['repo_path', 'message'],
    },
    {
      name: 'git_branch',
      description: 'List or create branches',
      inputSchema: {
        type: 'object',
        properties: {
          repo_path: { type: 'string', description: 'Path to the repository' },
          create: { type: 'string', description: 'Name of new branch to create' },
        },
      },
      required: ['repo_path'],
    },
  ],
};

// ============================================================================
// Memory Server
// ============================================================================

/**
 * Memory MCP server - provides persistent memory/knowledge storage
 */
export const MEMORY_SERVER: McpServerConfig = {
  id: 'memory',
  name: 'Memory Server',
  description: 'Provides persistent memory and knowledge storage',
  version: '1.0.0',
  transport: 'stdio',
  command: 'npx',
  args: ['@modelcontextprotocol/server-memory'],
  enabled: true,
  autoConnect: true, // Safe to auto-connect
  timeout: 10000,
  retries: 3,
  retryDelay: 1000,
  scope: 'project',
  riskLevel: 'low', // Only reads/writes to its own storage
  permissions: {
    readFiles: true, // For its own storage
    writeFiles: true, // For its own storage
    executeCommands: false,
    networkAccess: false,
    databaseAccess: false,
  },
  tools: [
    {
      name: 'store_memory',
      description: 'Store information in memory',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Memory key' },
          value: { type: 'string', description: 'Value to store' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
        },
      },
      required: ['key', 'value'],
    },
    {
      name: 'retrieve_memory',
      description: 'Retrieve information from memory',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Memory key' },
        },
      },
      required: ['key'],
    },
    {
      name: 'search_memory',
      description: 'Search memory by query or tags',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
        },
      },
    },
    {
      name: 'delete_memory',
      description: 'Delete a memory entry',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Memory key to delete' },
        },
      },
      required: ['key'],
    },
  ],
};

// ============================================================================
// Web Fetch Server
// ============================================================================

/**
 * Web Fetch MCP server - provides web content fetching
 */
export const WEB_SERVER: McpServerConfig = {
  id: 'web',
  name: 'Web Fetch Server',
  description: 'Provides web content fetching and browsing capabilities',
  version: '1.0.0',
  transport: 'stdio',
  command: 'npx',
  args: ['@modelcontextprotocol/server-fetch'],
  enabled: true,
  autoConnect: false, // Network access should be explicit
  timeout: 60000,
  retries: 2,
  retryDelay: 1000,
  scope: 'session',
  riskLevel: 'medium', // Network access
  permissions: {
    readFiles: false,
    writeFiles: false,
    executeCommands: false,
    networkAccess: true,
    databaseAccess: false,
    allowedHosts: [], // Must be configured per project
  },
  tools: [
    {
      name: 'fetch_url',
      description: 'Fetch content from a URL',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch' },
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], description: 'HTTP method' },
          headers: { type: 'object', description: 'Request headers' },
          body: { type: 'string', description: 'Request body' },
        },
      },
      required: ['url'],
    },
  ],
};

// ============================================================================
// GitHub Server
// ============================================================================

/**
 * GitHub MCP server - provides GitHub API operations
 */
export const GITHUB_SERVER: McpServerConfig = {
  id: 'github',
  name: 'GitHub Server',
  description: 'Provides GitHub API operations (issues, PRs, repos)',
  version: '1.0.0',
  transport: 'stdio',
  command: 'npx',
  args: ['@modelcontextprotocol/server-github'],
  enabled: true,
  autoConnect: false, // Requires auth
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  scope: 'global',
  riskLevel: 'medium', // API access with auth
  auth: {
    method: 'api_key',
    keyEnvVar: 'GITHUB_TOKEN', // Token from env var
  },
  permissions: {
    readFiles: false,
    writeFiles: false,
    executeCommands: false,
    networkAccess: true,
    databaseAccess: false,
    allowedHosts: ['api.github.com', 'github.com'],
  },
  tools: [
    {
      name: 'list_issues',
      description: 'List GitHub issues',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Issue state' },
        },
      },
      required: ['owner', 'repo'],
    },
    {
      name: 'create_issue',
      description: 'Create a GitHub issue',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          title: { type: 'string', description: 'Issue title' },
          body: { type: 'string', description: 'Issue body' },
          labels: { type: 'array', items: { type: 'string' }, description: 'Labels' },
        },
      },
      required: ['owner', 'repo', 'title'],
    },
    {
      name: 'create_pull_request',
      description: 'Create a GitHub pull request',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          title: { type: 'string', description: 'PR title' },
          body: { type: 'string', description: 'PR body' },
          head: { type: 'string', description: 'Head branch' },
          base: { type: 'string', description: 'Base branch' },
        },
      },
      required: ['owner', 'repo', 'title', 'head', 'base'],
    },
    {
      name: 'list_pull_requests',
      description: 'List GitHub pull requests',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'PR state' },
        },
      },
      required: ['owner', 'repo'],
    },
  ],
};

// ============================================================================
// Terminal Server (Dangerous)
// ============================================================================

/**
 * Terminal MCP server - provides shell command execution
 * SECURITY: This is CRITICAL risk and should rarely be enabled
 */
export const TERMINAL_SERVER: McpServerConfig = {
  id: 'terminal',
  name: 'Terminal Server',
  description: 'Provides terminal/shell command execution (DANGEROUS)',
  version: '1.0.0',
  transport: 'stdio',
  command: 'npx',
  args: ['@anthropic/mcp-server-terminal'],
  enabled: false, // Disabled by default
  autoConnect: false, // NEVER auto-connect
  timeout: 120000, // Commands can be long-running
  retries: 1,
  retryDelay: 1000,
  scope: 'session',
  riskLevel: 'critical', // Arbitrary command execution
  permissions: {
    readFiles: true,
    writeFiles: true,
    executeCommands: true,
    networkAccess: true,
    databaseAccess: true, // Via CLI tools
    allowedCommands: [], // Must be explicitly configured
  },
  tools: [
    {
      name: 'execute_command',
      description: 'Execute a shell command (DANGEROUS)',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute' },
          cwd: { type: 'string', description: 'Working directory' },
          timeout: { type: 'number', description: 'Timeout in milliseconds' },
        },
      },
      required: ['command'],
    },
  ],
};

// ============================================================================
// PostgreSQL Server
// ============================================================================

/**
 * PostgreSQL MCP server - provides database operations
 */
export const POSTGRES_SERVER: McpServerConfig = {
  id: 'postgres',
  name: 'PostgreSQL Server',
  description: 'Provides PostgreSQL database operations',
  version: '1.0.0',
  transport: 'stdio',
  command: 'npx',
  args: ['@modelcontextprotocol/server-postgres'],
  enabled: true,
  autoConnect: false, // Requires connection string
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  scope: 'project',
  riskLevel: 'high', // Database access
  auth: {
    method: 'api_key',
    keyEnvVar: 'DATABASE_URL', // Connection string from env
  },
  permissions: {
    readFiles: false,
    writeFiles: false,
    executeCommands: false,
    networkAccess: true, // For remote DB
    databaseAccess: true,
  },
  tools: [
    {
      name: 'query',
      description: 'Execute a SQL query',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'SQL query to execute' },
          params: { type: 'array', description: 'Query parameters' },
        },
      },
      required: ['query'],
    },
    {
      name: 'list_tables',
      description: 'List all tables in the database',
      inputSchema: {
        type: 'object',
        properties: {
          schema: { type: 'string', description: 'Schema name (default: public)' },
        },
      },
    },
    {
      name: 'describe_table',
      description: 'Get table schema',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string', description: 'Table name' },
          schema: { type: 'string', description: 'Schema name (default: public)' },
        },
      },
      required: ['table'],
    },
  ],
};

// ============================================================================
// All Built-in Configs
// ============================================================================

/**
 * All built-in server configurations
 */
export const BUILT_IN_SERVERS: McpServerConfig[] = [
  FILESYSTEM_SERVER,
  GIT_SERVER,
  MEMORY_SERVER,
  WEB_SERVER,
  GITHUB_SERVER,
  TERMINAL_SERVER,
  POSTGRES_SERVER,
];

/**
 * Safe built-in servers (can be auto-connected)
 */
export const SAFE_SERVERS: McpServerConfig[] = [
  MEMORY_SERVER,
];

/**
 * Get built-in server by ID
 */
export function getBuiltInServer(id: string): McpServerConfig | undefined {
  return BUILT_IN_SERVERS.find((s) => s.id === id);
}

/**
 * Get all server IDs
 */
export function getBuiltInServerIds(): string[] {
  return BUILT_IN_SERVERS.map((s) => s.id);
}

/**
 * Get servers by risk level
 */
export function getServersByRiskLevel(
  level: McpServerConfig['riskLevel']
): McpServerConfig[] {
  return BUILT_IN_SERVERS.filter((s) => s.riskLevel === level);
}
