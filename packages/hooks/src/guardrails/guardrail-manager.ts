/**
 * Guardrail Manager
 *
 * Central management for input/output validation guardrails.
 * Provides registration, validation, and lifecycle management.
 */

import {
  type InputGuardrail,
  type OutputGuardrail,
  type GuardrailResult,
  type GuardrailConfig,
  type OutputType,
  guardrailConfigSchema,
} from './types.js';

/**
 * Default guardrail configuration - secure by default
 */
const DEFAULT_CONFIG: GuardrailConfig = {
  enabled: true,
  strictMode: true, // Block on violations
  logViolations: true,
};

/**
 * Guardrail validation event
 */
interface GuardrailEvent {
  type: 'input' | 'output';
  guardrailId: string;
  valid: boolean;
  message?: string;
  timestamp: Date;
}

/**
 * Guardrail Manager class
 *
 * Manages input and output guardrails for content validation.
 */
export class GuardrailManager {
  private inputGuardrails: Map<string, InputGuardrail> = new Map();
  private outputGuardrails: Map<string, OutputGuardrail> = new Map();
  private config: GuardrailConfig;
  private listeners: Map<string, Array<(event: GuardrailEvent) => void>> =
    new Map();

  constructor(config: Partial<GuardrailConfig> = {}) {
    const parsedConfig = guardrailConfigSchema.safeParse({
      ...DEFAULT_CONFIG,
      ...config,
    });
    this.config = parsedConfig.success ? parsedConfig.data : DEFAULT_CONFIG;
  }

  /**
   * Register an input guardrail
   */
  registerInput(guardrail: InputGuardrail): void {
    if (!guardrail.id || guardrail.id.trim() === '') {
      throw new Error('Guardrail ID is required');
    }
    this.inputGuardrails.set(guardrail.id, guardrail);
    this.emit('guardrail:registered', {
      type: 'input',
      guardrailId: guardrail.id,
      valid: true,
      timestamp: new Date(),
    });
  }

  /**
   * Register an output guardrail
   */
  registerOutput(guardrail: OutputGuardrail): void {
    if (!guardrail.id || guardrail.id.trim() === '') {
      throw new Error('Guardrail ID is required');
    }
    this.outputGuardrails.set(guardrail.id, guardrail);
    this.emit('guardrail:registered', {
      type: 'output',
      guardrailId: guardrail.id,
      valid: true,
      timestamp: new Date(),
    });
  }

  /**
   * Unregister a guardrail by ID
   */
  unregister(guardrailId: string): boolean {
    // Prevent unregistering critical guardrails
    const criticalGuardrails = [
      'builtin:secret-detection',
      'builtin:owasp-detection',
    ];
    if (criticalGuardrails.includes(guardrailId)) {
      this.emit('guardrail:unregister-blocked', {
        type: 'input',
        guardrailId,
        valid: false,
        message: 'Cannot unregister critical security guardrail',
        timestamp: new Date(),
      });
      return false;
    }

    const inputRemoved = this.inputGuardrails.delete(guardrailId);
    const outputRemoved = this.outputGuardrails.delete(guardrailId);
    return inputRemoved || outputRemoved;
  }

  /**
   * Validate input through all enabled input guardrails
   */
  async validateInput(
    input: string,
    context?: Record<string, unknown>
  ): Promise<GuardrailResult> {
    if (!this.config.enabled) {
      return { valid: true, violations: [], warnings: [] };
    }

    const violations: string[] = [];
    const warnings: string[] = [];

    for (const guardrail of this.inputGuardrails.values()) {
      if (!guardrail.enabled) continue;

      try {
        const result = await guardrail.validate(input, context);

        if (!result.valid) {
          const message =
            result.message ?? `Validation failed: ${guardrail.id}`;

          if (guardrail.severity === 'error') {
            violations.push(message);

            if (this.config.logViolations) {
              this.emit('guardrail:violation', {
                type: 'input',
                guardrailId: guardrail.id,
                valid: false,
                message,
                timestamp: new Date(),
              });
            }

            // In strict mode, stop on first violation
            if (this.config.strictMode) {
              return { valid: false, violations, warnings };
            }
          } else {
            warnings.push(message);
          }
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        if (this.config.strictMode) {
          violations.push(
            `Guardrail ${guardrail.id} failed to execute: ${errorMsg}`
          );
          return { valid: false, violations, warnings };
        } else {
          warnings.push(`Guardrail ${guardrail.id} error: ${errorMsg}`);
        }
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Validate output through all enabled output guardrails
   */
  async validateOutput(
    output: string,
    outputType: OutputType,
    context?: Record<string, unknown>
  ): Promise<GuardrailResult> {
    if (!this.config.enabled) {
      return { valid: true, violations: [], warnings: [] };
    }

    const violations: string[] = [];
    const warnings: string[] = [];

    for (const guardrail of this.outputGuardrails.values()) {
      if (!guardrail.enabled) continue;

      // Skip if guardrail doesn't apply to this output type
      if (
        guardrail.outputTypes &&
        !guardrail.outputTypes.includes(outputType)
      ) {
        continue;
      }

      try {
        const result = await guardrail.validate(output, outputType, context);

        if (!result.valid) {
          const message =
            result.message ?? `Validation failed: ${guardrail.id}`;

          if (guardrail.severity === 'error') {
            violations.push(message);

            if (this.config.logViolations) {
              this.emit('guardrail:violation', {
                type: 'output',
                guardrailId: guardrail.id,
                valid: false,
                message,
                timestamp: new Date(),
              });
            }

            // In strict mode, stop on first violation
            if (this.config.strictMode) {
              return { valid: false, violations, warnings };
            }
          } else {
            warnings.push(message);
          }
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        if (this.config.strictMode) {
          violations.push(
            `Guardrail ${guardrail.id} failed to execute: ${errorMsg}`
          );
          return { valid: false, violations, warnings };
        } else {
          warnings.push(`Guardrail ${guardrail.id} error: ${errorMsg}`);
        }
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Enable/disable a guardrail
   */
  setEnabled(guardrailId: string, enabled: boolean): boolean {
    // Prevent disabling critical guardrails
    const criticalGuardrails = [
      'builtin:secret-detection',
      'builtin:owasp-detection',
    ];
    if (criticalGuardrails.includes(guardrailId) && !enabled) {
      this.emit('guardrail:disable-blocked', {
        type: 'input',
        guardrailId,
        valid: false,
        message: 'Cannot disable critical security guardrail',
        timestamp: new Date(),
      });
      return false;
    }

    const inputGuardrail = this.inputGuardrails.get(guardrailId);
    if (inputGuardrail) {
      inputGuardrail.enabled = enabled;
      return true;
    }

    const outputGuardrail = this.outputGuardrails.get(guardrailId);
    if (outputGuardrail) {
      outputGuardrail.enabled = enabled;
      return true;
    }

    return false;
  }

  /**
   * Get all input guardrails
   */
  getInputGuardrails(): InputGuardrail[] {
    return Array.from(this.inputGuardrails.values());
  }

  /**
   * Get all output guardrails
   */
  getOutputGuardrails(): OutputGuardrail[] {
    return Array.from(this.outputGuardrails.values());
  }

  /**
   * Get a guardrail by ID
   */
  getGuardrail(guardrailId: string): InputGuardrail | OutputGuardrail | undefined {
    return (
      this.inputGuardrails.get(guardrailId) ??
      this.outputGuardrails.get(guardrailId)
    );
  }

  /**
   * Clear all guardrails (except builtin if specified)
   */
  clear(includeBuiltin = false): void {
    if (includeBuiltin) {
      this.inputGuardrails.clear();
      this.outputGuardrails.clear();
    } else {
      // Keep builtin guardrails
      for (const [id] of this.inputGuardrails) {
        if (!id.startsWith('builtin:')) {
          this.inputGuardrails.delete(id);
        }
      }
      for (const [id] of this.outputGuardrails) {
        if (!id.startsWith('builtin:')) {
          this.outputGuardrails.delete(id);
        }
      }
    }
    this.emit('guardrails:cleared', {
      type: 'input',
      guardrailId: '',
      valid: true,
      message: `Cleared guardrails (includeBuiltin: ${includeBuiltin})`,
      timestamp: new Date(),
    });
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<GuardrailConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): GuardrailConfig {
    return { ...this.config };
  }

  /**
   * Simple event emitter - on
   */
  on(event: string, listener: (event: GuardrailEvent) => void): void {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  /**
   * Simple event emitter - off
   */
  off(event: string, listener: (event: GuardrailEvent) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Simple event emitter - emit
   */
  private emit(eventName: string, event: GuardrailEvent): void {
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }
}

/**
 * Singleton guardrail manager instance
 */
let guardrailManagerInstance: GuardrailManager | null = null;

/**
 * Get the singleton guardrail manager instance
 */
export function getGuardrailManager(
  config?: Partial<GuardrailConfig>
): GuardrailManager {
  if (!guardrailManagerInstance) {
    guardrailManagerInstance = new GuardrailManager(config);
  }
  return guardrailManagerInstance;
}

/**
 * Reset the guardrail manager (for testing)
 */
export function resetGuardrailManager(): void {
  guardrailManagerInstance = null;
}

/**
 * Create a new guardrail manager instance (for testing or isolation)
 */
export function createGuardrailManager(
  config?: Partial<GuardrailConfig>
): GuardrailManager {
  return new GuardrailManager(config);
}
