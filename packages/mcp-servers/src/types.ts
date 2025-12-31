/**
 * MCP Server Types
 *
 * Core types and Zod schemas for MCP server configuration.
 * Provides security-focused validation for server configs, tools, and resources.
 *
 * SECURITY:
 * - Command whitelist validation
 * - Path traversal prevention
 * - Environment variable sanitization
 * - URL scheme validation
 * - String length limits
 */

import { z } from 'zod';

// ============================================================================
// Transport Types
// ============================================================================

/**
 * MCP transport type
 */
export const TransportTypeSchema = z.enum([
  'stdio', // Standard input/output
  'http', // HTTP/REST
  'websocket', // WebSocket
  'sse', // Server-Sent Events
]);

export type TransportType = z.infer<typeof TransportTypeSchema>;

// ============================================================================
// Server Status
// ============================================================================

/**
 * Server connection status
 */
export const ServerStatusSchema = z.enum([
  'disconnected',
  'connecting',
  'connected',
  'error',
  'disabled',
]);

export type ServerStatus = z.infer<typeof ServerStatusSchema>;

// ============================================================================
// Authentication
// ============================================================================

/**
 * Authentication method
 */
export const AuthMethodSchema = z.enum([
  'none',
  'api_key',
  'bearer_token',
  'oauth',
  'certificate',
]);

export type AuthMethod = z.infer<typeof AuthMethodSchema>;

/**
 * Authentication configuration
 * SECURITY: Keys stored in env vars, never in config
 */
export const AuthConfigSchema = z.object({
  method: AuthMethodSchema,
  // Environment variable name containing the key (not the key itself!)
  keyEnvVar: z.string().max(100).optional(),
  // Header name for token (default: Authorization)
  headerName: z.string().max(100).optional(),
  // Token prefix (default: Bearer)
  tokenPrefix: z.string().max(50).optional(),
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

// ============================================================================
// Permission Model
// ============================================================================

/**
 * Server permissions
 * SECURITY: Explicit capability allowlist
 */
export const ServerPermissionsSchema = z.object({
  readFiles: z.boolean().default(false),
  writeFiles: z.boolean().default(false),
  executeCommands: z.boolean().default(false),
  networkAccess: z.boolean().default(false),
  databaseAccess: z.boolean().default(false),
  // File system scope (if readFiles/writeFiles enabled)
  allowedPaths: z.array(z.string().max(500)).optional(),
  // Network access scope
  allowedHosts: z.array(z.string().max(200)).optional(),
  // Command execution scope
  allowedCommands: z.array(z.string().max(200)).optional(),
});

export type ServerPermissions = z.infer<typeof ServerPermissionsSchema>;

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * JSON Schema for tool input validation
 */
export const JsonSchemaSchema: z.ZodType<Record<string, unknown>> = z.record(
  z.string(),
  z.unknown()
);

/**
 * MCP tool definition
 */
export const McpToolSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be lowercase with underscores'),
  description: z.string().max(1000),
  inputSchema: JsonSchemaSchema,
  required: z.array(z.string().max(100)).optional(),
});

export type McpTool = z.infer<typeof McpToolSchema>;

// ============================================================================
// Resource Definitions
// ============================================================================

/**
 * MCP resource definition
 */
export const McpResourceSchema = z.object({
  name: z.string().min(1).max(200),
  uri: z.string().max(2000),
  mimeType: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
});

export type McpResource = z.infer<typeof McpResourceSchema>;

// ============================================================================
// Server Configuration
// ============================================================================

/**
 * Safe server ID pattern - alphanumeric with hyphens
 */
const SAFE_SERVER_ID_REGEX = /^[a-z][a-z0-9-]*$/;

/**
 * SECURITY: Blocked environment variable patterns
 * These should never be passed to child processes
 */
export const BLOCKED_ENV_PATTERNS = [
  /^AWS_/i,
  /^AZURE_/i,
  /^GCP_/i,
  /^GOOGLE_/i,
  /SECRET/i,
  /PASSWORD/i,
  /TOKEN/i,
  /KEY/i,
  /CREDENTIAL/i,
  /PRIVATE/i,
  /^DATABASE_/i,
  /^DB_/i,
  /^POSTGRES/i,
  /^MYSQL/i,
  /^MONGO/i,
  /^REDIS/i,
  /^NATS/i,
  /^ANTHROPIC/i,
  /^OPENAI/i,
  /^STRIPE/i,
  /^GITHUB_TOKEN/i,
  /^NPM_TOKEN/i,
  /^CI_/i,
];

/**
 * SECURITY: Allowed command whitelist
 * Only these commands can be executed via stdio transport
 */
export const ALLOWED_COMMANDS = [
  'npx',
  'node',
  'python',
  'python3',
  'deno',
  'bun',
] as const;

export type AllowedCommand = (typeof ALLOWED_COMMANDS)[number];

/**
 * Server scope
 */
export const ServerScopeSchema = z.enum(['global', 'project', 'session']);
export type ServerScope = z.infer<typeof ServerScopeSchema>;

/**
 * MCP server configuration
 * SECURITY: Comprehensive validation with security constraints
 */
export const McpServerConfigSchema = z.object({
  // Identity
  id: z
    .string()
    .min(1)
    .max(100)
    .refine((id) => SAFE_SERVER_ID_REGEX.test(id), {
      message: 'Server ID must start with letter and contain only lowercase alphanumeric and hyphens',
    }),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  version: z
    .string()
    .max(20)
    .refine((v) => /^\d+\.\d+\.\d+$/.test(v), {
      message: 'Version must be in semver format',
    }),

  // Transport configuration
  transport: TransportTypeSchema,

  // Stdio transport config
  command: z
    .enum(ALLOWED_COMMANDS)
    .optional()
    .describe('Command must be in allowed whitelist'),
  args: z
    .array(z.string().max(500))
    .max(50)
    .optional()
    .describe('Command arguments'),
  env: z
    .record(z.string().max(100), z.string().max(1000))
    .optional()
    .describe('Additional environment variables'),

  // HTTP/WebSocket transport config
  url: z
    .string()
    .max(2000)
    .optional()
    .refine(
      (url) => {
        if (!url) return true;
        try {
          const parsed = new URL(url);
          // Only allow http/https/ws/wss schemes
          return ['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol);
        } catch {
          return false;
        }
      },
      { message: 'URL must be valid HTTP/HTTPS/WS/WSS' }
    ),

  // Authentication
  auth: AuthConfigSchema.optional(),

  // Capabilities (static definition, discovered at runtime)
  tools: z.array(McpToolSchema).optional(),
  resources: z.array(McpResourceSchema).optional(),

  // Settings
  enabled: z.boolean().default(true),
  autoConnect: z.boolean().default(false), // Default false for security
  timeout: z.number().int().min(1000).max(300000).default(30000),
  retries: z.number().int().min(0).max(5).default(3),
  retryDelay: z.number().int().min(100).max(30000).default(1000),

  // Permissions
  permissions: ServerPermissionsSchema.optional(),

  // Scope
  scope: ServerScopeSchema.default('project'),

  // Risk level (for UI display and confirmation prompts)
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

// ============================================================================
// Connection State
// ============================================================================

/**
 * Server connection state
 */
export interface ServerConnection {
  config: McpServerConfig;
  status: ServerStatus;
  connectedAt?: Date;
  lastError?: string;
  lastErrorAt?: Date;
  availableTools: McpTool[];
  availableResources: McpResource[];
  protocolVersion?: string;
}

// ============================================================================
// Tool Call Types
// ============================================================================

/**
 * Tool call request
 */
export const ToolCallRequestSchema = z.object({
  serverId: z.string().max(100),
  toolName: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be lowercase with underscores'),
  arguments: z.record(z.string(), z.unknown()),
  timeout: z.number().int().min(1000).max(300000).optional(),
});

export type ToolCallRequest = z.infer<typeof ToolCallRequestSchema>;

/**
 * Tool call result
 */
export interface ToolCallResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
  serverId: string;
  toolName: string;
}

// ============================================================================
// MCP Protocol Messages
// ============================================================================

/**
 * JSON-RPC message base
 */
export interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string;
}

/**
 * JSON-RPC request
 */
export interface JsonRpcRequest extends JsonRpcMessage {
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC response
 */
export interface JsonRpcResponse extends JsonRpcMessage {
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * JSON-RPC notification (no id)
 */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if environment variable name is blocked
 */
export function isBlockedEnvVar(name: string): boolean {
  return BLOCKED_ENV_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Filter environment variables to only safe ones
 */
export function filterSafeEnv(
  env: Record<string, string | undefined>
): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && !isBlockedEnvVar(key)) {
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * Validate command arguments for injection
 * SECURITY: Prevents shell metacharacter injection
 */
export function validateCommandArgs(args: string[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const dangerous = /[;&|`$(){}[\]<>\\!#*?~]/;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (dangerous.test(arg)) {
      errors.push(`Argument ${i} contains dangerous characters: ${arg}`);
    }
    if (arg.startsWith('-') && arg.length > 1 && !arg.startsWith('--')) {
      // Allow single-dash short options, but warn about suspicious patterns
      if (arg.includes('=') && arg.includes('..')) {
        errors.push(`Argument ${i} contains suspicious path pattern: ${arg}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitize path to prevent traversal
 * SECURITY: Blocks .. and absolute paths
 */
export function sanitizePath(inputPath: string, allowAbsolute = false): string {
  // Remove any null bytes
  let sanitized = inputPath.replace(/\0/g, '');

  // Normalize separators
  sanitized = sanitized.replace(/\\/g, '/');

  // Block path traversal
  if (sanitized.includes('..')) {
    throw new Error('Path traversal detected');
  }

  // Block absolute paths unless explicitly allowed
  if (!allowAbsolute && (sanitized.startsWith('/') || /^[a-zA-Z]:/.test(sanitized))) {
    throw new Error('Absolute paths not allowed');
  }

  return sanitized;
}

/**
 * Validate URL for SSRF prevention
 * SECURITY: Blocks internal IPs and metadata endpoints
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // Block non-HTTP(S) schemes
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) {
      return { valid: false, error: `Invalid protocol: ${parsed.protocol}` };
    }

    // Block localhost for non-development
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Allow localhost in development - runtime check should verify NODE_ENV
      return { valid: true };
    }

    // Block internal IPs
    const internalPatterns = [
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^169\.254\./, // Link-local
      /^::1$/, // IPv6 localhost
      /^fe80:/, // IPv6 link-local
      /^fc00:/, // IPv6 private
    ];

    for (const pattern of internalPatterns) {
      if (pattern.test(hostname)) {
        return { valid: false, error: 'Internal IP addresses not allowed' };
      }
    }

    // Block AWS/cloud metadata endpoints
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return { valid: false, error: 'Cloud metadata endpoints blocked' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// ============================================================================
// Config Helpers
// ============================================================================

/**
 * Create a minimal server config
 */
export function createServerConfig(
  id: string,
  name: string,
  transport: TransportType,
  options: Partial<Omit<McpServerConfig, 'id' | 'name' | 'transport'>> = {}
): McpServerConfig {
  return {
    id,
    name,
    transport,
    description: options.description || name,
    version: options.version || '1.0.0',
    enabled: options.enabled ?? true,
    autoConnect: options.autoConnect ?? false,
    timeout: options.timeout ?? 30000,
    retries: options.retries ?? 3,
    retryDelay: options.retryDelay ?? 1000,
    scope: options.scope ?? 'project',
    riskLevel: options.riskLevel ?? 'medium',
    ...options,
  };
}

/**
 * Validate a server config
 */
export function validateServerConfig(data: unknown): McpServerConfig {
  return McpServerConfigSchema.parse(data);
}

/**
 * Safe parse server config
 */
export function safeParseServerConfig(
  data: unknown
): { success: true; data: McpServerConfig } | { success: false; error: z.ZodError } {
  const result = McpServerConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Check if config has dangerous permissions
 */
export function hasDangerousPermissions(config: McpServerConfig): boolean {
  const perms = config.permissions;
  if (!perms) return false;

  return (
    perms.executeCommands === true ||
    (perms.writeFiles === true && (!perms.allowedPaths || perms.allowedPaths.length === 0)) ||
    (perms.networkAccess === true && (!perms.allowedHosts || perms.allowedHosts.length === 0))
  );
}

/**
 * Get risk summary for a config
 */
export function getConfigRiskSummary(config: McpServerConfig): string[] {
  const risks: string[] = [];

  if (config.transport === 'stdio') {
    risks.push('Executes external process');
  }

  if (config.permissions?.executeCommands) {
    risks.push('Can execute shell commands');
  }

  if (config.permissions?.writeFiles) {
    if (!config.permissions.allowedPaths || config.permissions.allowedPaths.length === 0) {
      risks.push('Can write to any file path');
    } else {
      risks.push(`Can write to: ${config.permissions.allowedPaths.join(', ')}`);
    }
  }

  if (config.permissions?.networkAccess) {
    if (!config.permissions.allowedHosts || config.permissions.allowedHosts.length === 0) {
      risks.push('Unrestricted network access');
    } else {
      risks.push(`Network access to: ${config.permissions.allowedHosts.join(', ')}`);
    }
  }

  if (config.permissions?.databaseAccess) {
    risks.push('Database access enabled');
  }

  if (config.autoConnect) {
    risks.push('Connects automatically on startup');
  }

  return risks;
}
