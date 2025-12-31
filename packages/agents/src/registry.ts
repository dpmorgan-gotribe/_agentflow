/**
 * AgentRegistry - Singleton registry for all agents
 *
 * Manages agent registration, lookup, and lifecycle.
 * Agents are loaded dynamically and cached for reuse.
 *
 * Features:
 * - Lazy instantiation of agent instances
 * - Capability-based agent discovery
 * - Agent statistics and monitoring
 * - Thread-safe singleton pattern
 */

import type { BaseAgent } from './base-agent.js';
import type { AgentMetadata, AgentStatus, AgentType } from './types.js';

/**
 * Agent constructor type
 */
type AgentConstructor = new () => BaseAgent;

/**
 * Registry entry for an agent
 */
interface RegistryEntry {
  metadata: AgentMetadata;
  constructor: AgentConstructor;
  instance?: BaseAgent;
  loadedAt?: Date;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalRegistered: number;
  totalInstantiated: number;
  agentsByCapability: Record<string, number>;
  agentsByType: AgentType[];
}

/**
 * Simple logger interface
 */
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

const defaultLogger: Logger = {
  debug: (msg, meta) => console.debug(`[AgentRegistry] ${msg}`, meta || ''),
  info: (msg, meta) => console.info(`[AgentRegistry] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[AgentRegistry] ${msg}`, meta || ''),
};

/**
 * Singleton registry for all agents
 */
export class AgentRegistry {
  private static instance: AgentRegistry | null = null;
  private agents: Map<AgentType, RegistryEntry> = new Map();
  private initialized = false;
  private sealed = false;
  private logger: Logger;

  private constructor(logger?: Logger) {
    this.logger = logger || defaultLogger;
  }

  /**
   * Get singleton instance
   */
  static getInstance(logger?: Logger): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry(logger);
    }
    return AgentRegistry.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    if (AgentRegistry.instance) {
      AgentRegistry.instance.agents.clear();
      AgentRegistry.instance.initialized = false;
      AgentRegistry.instance.sealed = false;
    }
    AgentRegistry.instance = null;
  }

  /**
   * Register an agent class
   *
   * @throws Error if registry is sealed
   */
  register(constructor: AgentConstructor): void {
    if (this.sealed) {
      throw new Error('Cannot register agents after registry is sealed');
    }

    // Create temporary instance to get metadata
    const tempInstance = new constructor();
    const metadata = tempInstance.getMetadata();

    if (this.agents.has(metadata.id)) {
      this.logger.warn(`Agent ${metadata.id} is already registered, overwriting`);
    }

    this.agents.set(metadata.id, {
      metadata,
      constructor,
    });

    this.logger.debug(`Registered agent: ${metadata.id} (${metadata.name})`);
  }

  /**
   * Get agent instance by type (lazy instantiation)
   *
   * @throws Error if agent not found
   */
  getAgent(type: AgentType): BaseAgent {
    const entry = this.agents.get(type);
    if (!entry) {
      throw new Error(`Agent not found: ${type}`);
    }

    // Lazy instantiate if needed
    if (!entry.instance) {
      entry.instance = new entry.constructor();
      entry.loadedAt = new Date();
      this.logger.debug(`Instantiated agent: ${type}`);
    }

    return entry.instance;
  }

  /**
   * Try to get agent, returns undefined if not found
   */
  tryGetAgent(type: AgentType): BaseAgent | undefined {
    try {
      return this.getAgent(type);
    } catch {
      return undefined;
    }
  }

  /**
   * Check if agent is registered
   */
  hasAgent(type: AgentType): boolean {
    return this.agents.has(type);
  }

  /**
   * Get all registered agent types
   */
  getAgentTypes(): AgentType[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get all agent metadata
   */
  getAllMetadata(): AgentMetadata[] {
    return Array.from(this.agents.values()).map((entry) => entry.metadata);
  }

  /**
   * Get agent metadata by type
   */
  getMetadata(type: AgentType): AgentMetadata | undefined {
    return this.agents.get(type)?.metadata;
  }

  /**
   * Get status of all agents
   */
  getAgentStatuses(): AgentStatus[] {
    return Array.from(this.agents.entries()).map(([type, entry]) => ({
      agentId: type,
      state: entry.instance?.getStatus() || 'idle',
      lastExecution: entry.loadedAt,
      consecutiveFailures: entry.instance?.getConsecutiveFailures() || 0,
    }));
  }

  /**
   * Get status of a specific agent
   */
  getAgentStatus(type: AgentType): AgentStatus | undefined {
    const entry = this.agents.get(type);
    if (!entry) return undefined;

    return {
      agentId: type,
      state: entry.instance?.getStatus() || 'idle',
      lastExecution: entry.loadedAt,
      consecutiveFailures: entry.instance?.getConsecutiveFailures() || 0,
    };
  }

  /**
   * Find agents that match given capabilities
   */
  findAgentsByCapability(capabilityName: string): AgentType[] {
    const matching: AgentType[] = [];

    for (const [type, entry] of this.agents) {
      const hasCapability = entry.metadata.capabilities.some(
        (cap) => cap.name === capabilityName
      );
      if (hasCapability) {
        matching.push(type);
      }
    }

    return matching;
  }

  /**
   * Find agents that can handle given input type
   */
  findAgentsByInputType(inputType: string): AgentType[] {
    const matching: AgentType[] = [];

    for (const [type, entry] of this.agents) {
      const canHandle = entry.metadata.capabilities.some((cap) =>
        cap.inputTypes.includes(inputType)
      );
      if (canHandle) {
        matching.push(type);
      }
    }

    return matching;
  }

  /**
   * Find agents that produce given output type
   */
  findAgentsByOutputType(outputType: string): AgentType[] {
    const matching: AgentType[] = [];

    for (const [type, entry] of this.agents) {
      const produces = entry.metadata.capabilities.some((cap) =>
        cap.outputTypes.includes(outputType)
      );
      if (produces) {
        matching.push(type);
      }
    }

    return matching;
  }

  /**
   * Reset a specific agent instance
   */
  resetAgent(type: AgentType): void {
    const entry = this.agents.get(type);
    if (entry) {
      entry.instance = undefined;
      entry.loadedAt = undefined;
      this.logger.debug(`Reset agent: ${type}`);
    }
  }

  /**
   * Reset all agent instances
   */
  resetAll(): void {
    for (const type of this.agents.keys()) {
      this.resetAgent(type);
    }
    this.logger.info('Reset all agent instances');
  }

  /**
   * Seal the registry (no more registrations)
   */
  seal(): void {
    this.sealed = true;
    this.logger.info('Registry sealed - no more registrations allowed');
  }

  /**
   * Check if registry is sealed
   */
  isSealed(): boolean {
    return this.sealed;
  }

  /**
   * Initialize registry with all built-in agents
   *
   * Call this after all agent modules are loaded.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Import and register all built-in agents
    // These will be added as we implement each agent
    // Example:
    // const { OrchestratorAgent } = await import('./agents/orchestrator.js');
    // this.register(OrchestratorAgent);

    this.initialized = true;
    this.logger.info(`Agent registry initialized with ${this.agents.size} agents`);
  }

  /**
   * Check if registry is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const stats: RegistryStats = {
      totalRegistered: this.agents.size,
      totalInstantiated: 0,
      agentsByCapability: {},
      agentsByType: [],
    };

    for (const [type, entry] of this.agents) {
      stats.agentsByType.push(type);

      if (entry.instance) {
        stats.totalInstantiated++;
      }

      for (const cap of entry.metadata.capabilities) {
        stats.agentsByCapability[cap.name] =
          (stats.agentsByCapability[cap.name] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Get total number of registered agents
   */
  get size(): number {
    return this.agents.size;
  }
}

/**
 * Get the singleton registry instance
 */
export function getRegistry(logger?: Logger): AgentRegistry {
  return AgentRegistry.getInstance(logger);
}

/**
 * Decorator for agent registration
 *
 * Usage:
 * @RegisterAgent
 * class MyAgent extends BaseAgent { ... }
 */
export function RegisterAgent(constructor: AgentConstructor): void {
  getRegistry().register(constructor);
}
