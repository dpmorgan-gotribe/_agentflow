/**
 * MCP Server Configuration Manager
 *
 * Pure configuration management with no file I/O.
 * Configuration loading from files is done by CLI layer.
 *
 * Features:
 * - Configuration registry with priority merging
 * - Validation and security checks
 * - Query by scope, permissions, capabilities
 *
 * SECURITY:
 * - All configs validated with Zod on registration
 * - Registry sealing after initialization
 * - Risk level assessment for all servers
 */

import type {
  McpServerConfig,
  ServerPermissions,
  ServerScope,
  TransportType,
} from './types.js';
import {
  McpServerConfigSchema,
  safeParseServerConfig,
  hasDangerousPermissions,
  getConfigRiskSummary,
} from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration source priority
 */
export type ConfigSource = 'built-in' | 'global' | 'project' | 'session';

/**
 * Priority order (higher number = higher priority)
 */
export const CONFIG_SOURCE_PRIORITY: Record<ConfigSource, number> = {
  'built-in': 0,
  global: 1,
  project: 2,
  session: 3,
};

/**
 * Registered config with metadata
 */
export interface RegisteredConfig {
  config: McpServerConfig;
  source: ConfigSource;
  registeredAt: Date;
}

/**
 * Config registration result
 */
export interface RegisterResult {
  success: boolean;
  id: string;
  replaced: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Config manager statistics
 */
export interface ConfigManagerStats {
  totalConfigs: number;
  enabledConfigs: number;
  byTransport: Record<string, number>;
  byScope: Record<string, number>;
  byRiskLevel: Record<string, number>;
  highRiskCount: number;
}

// ============================================================================
// Server Configuration Manager
// ============================================================================

/**
 * MCP Server Configuration Manager
 */
export class ServerConfigManager {
  private configs: Map<string, RegisteredConfig> = new Map();
  private sealed: boolean = false;

  /**
   * Register a server configuration
   */
  register(config: McpServerConfig, source: ConfigSource): RegisterResult {
    if (this.sealed) {
      return {
        success: false,
        id: config.id,
        replaced: false,
        errors: ['Registry is sealed - cannot register new configs'],
      };
    }

    // Validate config
    const parseResult = safeParseServerConfig(config);
    if (!parseResult.success) {
      return {
        success: false,
        id: config.id,
        replaced: false,
        errors: parseResult.error.issues.map(
          (i) => `${i.path.join('.')}: ${i.message}`
        ),
      };
    }

    const validatedConfig = parseResult.data;
    const warnings: string[] = [];

    // Check for dangerous permissions
    if (hasDangerousPermissions(validatedConfig)) {
      warnings.push('Config has potentially dangerous permissions');
    }

    // Check if replacing existing
    const existing = this.configs.get(validatedConfig.id);
    let replaced = false;

    if (existing) {
      // Only replace if new source has higher or equal priority
      if (CONFIG_SOURCE_PRIORITY[source] >= CONFIG_SOURCE_PRIORITY[existing.source]) {
        replaced = true;
      } else {
        return {
          success: false,
          id: validatedConfig.id,
          replaced: false,
          errors: [
            `Cannot override ${existing.source} config with ${source} source (lower priority)`,
          ],
        };
      }
    }

    this.configs.set(validatedConfig.id, {
      config: validatedConfig,
      source,
      registeredAt: new Date(),
    });

    return {
      success: true,
      id: validatedConfig.id,
      replaced,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Register multiple configurations
   */
  registerAll(
    configs: McpServerConfig[],
    source: ConfigSource
  ): RegisterResult[] {
    return configs.map((config) => this.register(config, source));
  }

  /**
   * Seal the registry (prevent further registrations)
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
   * Get config by ID
   */
  get(id: string): McpServerConfig | undefined {
    return this.configs.get(id)?.config;
  }

  /**
   * Get registered config with metadata
   */
  getRegistered(id: string): RegisteredConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Check if config exists
   */
  has(id: string): boolean {
    return this.configs.has(id);
  }

  /**
   * Get all configs
   */
  getAll(): McpServerConfig[] {
    return Array.from(this.configs.values()).map((r) => r.config);
  }

  /**
   * Get all registered configs with metadata
   */
  getAllRegistered(): RegisteredConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get enabled configs
   */
  getEnabled(): McpServerConfig[] {
    return this.getAll().filter((c) => c.enabled);
  }

  /**
   * Get auto-connect configs
   */
  getAutoConnect(): McpServerConfig[] {
    return this.getEnabled().filter((c) => c.autoConnect);
  }

  /**
   * Get configs by transport type
   */
  getByTransport(transport: TransportType): McpServerConfig[] {
    return this.getEnabled().filter((c) => c.transport === transport);
  }

  /**
   * Get configs by scope
   */
  getByScope(scope: ServerScope): McpServerConfig[] {
    return this.getEnabled().filter((c) => c.scope === scope);
  }

  /**
   * Get configs by source
   */
  getBySource(source: ConfigSource): McpServerConfig[] {
    return Array.from(this.configs.values())
      .filter((r) => r.source === source)
      .map((r) => r.config);
  }

  /**
   * Get configs by permission
   */
  getByPermission(
    permission: keyof ServerPermissions
  ): McpServerConfig[] {
    return this.getEnabled().filter(
      (c) => c.permissions?.[permission] === true
    );
  }

  /**
   * Get configs with specific tool
   */
  getByTool(toolName: string): McpServerConfig[] {
    return this.getEnabled().filter((c) =>
      c.tools?.some((t) => t.name === toolName)
    );
  }

  /**
   * Get high-risk configs (require user confirmation)
   */
  getHighRisk(): McpServerConfig[] {
    return this.getEnabled().filter(
      (c) => c.riskLevel === 'high' || c.riskLevel === 'critical'
    );
  }

  /**
   * Get config risk summary
   */
  getRiskSummary(id: string): string[] {
    const config = this.get(id);
    if (!config) return [];
    return getConfigRiskSummary(config);
  }

  /**
   * Enable a server
   */
  enable(id: string): boolean {
    const registered = this.configs.get(id);
    if (!registered) return false;
    registered.config.enabled = true;
    return true;
  }

  /**
   * Disable a server
   */
  disable(id: string): boolean {
    const registered = this.configs.get(id);
    if (!registered) return false;
    registered.config.enabled = false;
    return true;
  }

  /**
   * Remove a config (only if not sealed)
   */
  remove(id: string): boolean {
    if (this.sealed) return false;
    return this.configs.delete(id);
  }

  /**
   * Get statistics
   */
  getStats(): ConfigManagerStats {
    const all = this.getAll();
    const enabled = this.getEnabled();

    const byTransport: Record<string, number> = {};
    const byScope: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = {};
    let highRiskCount = 0;

    for (const config of all) {
      byTransport[config.transport] = (byTransport[config.transport] || 0) + 1;
      byScope[config.scope] = (byScope[config.scope] || 0) + 1;
      byRiskLevel[config.riskLevel] = (byRiskLevel[config.riskLevel] || 0) + 1;

      if (config.riskLevel === 'high' || config.riskLevel === 'critical') {
        highRiskCount++;
      }
    }

    return {
      totalConfigs: all.length,
      enabledConfigs: enabled.length,
      byTransport,
      byScope,
      byRiskLevel,
      highRiskCount,
    };
  }

  /**
   * Clear registry (for testing)
   */
  clear(): void {
    this.configs.clear();
    this.sealed = false;
  }

  /**
   * Get config count
   */
  get size(): number {
    return this.configs.size;
  }
}

// ============================================================================
// Global Instance
// ============================================================================

/**
 * Global config manager instance
 */
let globalConfigManager: ServerConfigManager | null = null;

/**
 * Get global config manager
 */
export function getConfigManager(): ServerConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ServerConfigManager();
  }
  return globalConfigManager;
}

/**
 * Reset global config manager (for testing)
 */
export function resetConfigManager(): void {
  if (globalConfigManager) {
    globalConfigManager.clear();
  }
  globalConfigManager = null;
}

// ============================================================================
// Merge Utilities
// ============================================================================

/**
 * Merge two configs (second takes priority for non-undefined fields)
 */
export function mergeConfigs(
  base: McpServerConfig,
  override: Partial<McpServerConfig>
): McpServerConfig {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(override).filter(([_, v]) => v !== undefined)
    ),
    // Deep merge permissions
    permissions: override.permissions
      ? { ...base.permissions, ...override.permissions }
      : base.permissions,
    // Deep merge auth
    auth: override.auth ? { ...base.auth, ...override.auth } : base.auth,
    // Replace arrays entirely if provided
    tools: override.tools ?? base.tools,
    resources: override.resources ?? base.resources,
    args: override.args ?? base.args,
    env: override.env ? { ...base.env, ...override.env } : base.env,
  } as McpServerConfig;
}

/**
 * Create project-specific override for a server
 */
export function createProjectOverride(
  baseId: string,
  overrides: Partial<McpServerConfig>
): Partial<McpServerConfig> & { id: string } {
  return {
    id: baseId,
    ...overrides,
  };
}
