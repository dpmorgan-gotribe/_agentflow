/**
 * @aigentflow/hooks
 *
 * Hooks and guardrails system for Aigentflow.
 *
 * This package provides:
 * - Hook lifecycle management for agent operations
 * - Input/output validation guardrails
 * - Secret detection and OWASP vulnerability scanning
 * - Built-in security hooks
 *
 * @example
 * ```typescript
 * import {
 *   getHookManager,
 *   getGuardrailManager,
 *   registerBuiltinHooks,
 *   getBuiltinInputGuardrails,
 *   getBuiltinOutputGuardrails,
 *   getBuiltinCodeGuardrails,
 * } from '@aigentflow/hooks';
 *
 * // Initialize hook manager
 * const hookManager = getHookManager();
 * registerBuiltinHooks((hook) => hookManager.register(hook));
 *
 * // Initialize guardrail manager
 * const guardrailManager = getGuardrailManager();
 * for (const guardrail of getBuiltinInputGuardrails()) {
 *   guardrailManager.registerInput(guardrail);
 * }
 * for (const guardrail of [...getBuiltinOutputGuardrails(), ...getBuiltinCodeGuardrails()]) {
 *   guardrailManager.registerOutput(guardrail);
 * }
 *
 * // Validate input
 * const inputResult = await guardrailManager.validateInput(userInput);
 * if (!inputResult.valid) {
 *   console.error('Input validation failed:', inputResult.violations);
 * }
 *
 * // Execute hook
 * const hookResult = await hookManager.execute('pre_file_write', {
 *   timestamp: new Date(),
 *   executionId: 'exec-123',
 *   projectId: 'proj-456',
 *   filePath: '/app/src/file.ts',
 *   content: fileContent,
 *   agentType: 'coder',
 *   operation: 'create',
 * });
 *
 * if (hookResult.action === 'block') {
 *   console.error('Hook blocked operation:', hookResult.reason);
 * }
 * ```
 */

// Hooks
export * from './hooks/index.js';

// Guardrails
export * from './guardrails/index.js';

// Built-in hooks
export * from './builtin/index.js';

// Re-export types for convenience
export type { HookManager } from './hooks/hook-manager.js';
export type { GuardrailManager } from './guardrails/guardrail-manager.js';
export type { HookRegistration } from './hooks/hook-types.js';

import { getHookManager, type HookRegistration } from './hooks/index.js';
import {
  getGuardrailManager,
  getBuiltinInputGuardrails,
  getBuiltinOutputGuardrails,
  getBuiltinCodeGuardrails,
} from './guardrails/index.js';
import { registerBuiltinHooks } from './builtin/index.js';

/**
 * Initialize hooks system with default configuration
 */
export function initializeHooksSystem(options?: {
  enableBuiltinHooks?: boolean;
  enableBuiltinGuardrails?: boolean;
}): {
  hookManager: ReturnType<typeof getHookManager>;
  guardrailManager: ReturnType<typeof getGuardrailManager>;
} {
  const { enableBuiltinHooks = true, enableBuiltinGuardrails = true } = options ?? {};

  const hookManager = getHookManager();
  const guardrailManager = getGuardrailManager();

  if (enableBuiltinHooks) {
    registerBuiltinHooks((hook: HookRegistration) =>
      hookManager.register(hook)
    );
  }

  if (enableBuiltinGuardrails) {
    for (const guardrail of getBuiltinInputGuardrails()) {
      guardrailManager.registerInput(guardrail);
    }

    for (const guardrail of [
      ...getBuiltinOutputGuardrails(),
      ...getBuiltinCodeGuardrails(),
    ]) {
      guardrailManager.registerOutput(guardrail);
    }
  }

  return { hookManager, guardrailManager };
}
