/**
 * Builtin Module
 *
 * Exports all built-in hooks and registration utilities.
 */

export {
  createDangerousFileProtectionHook,
  createSensitiveFileReadHook,
  createSecretDetectionHook,
  createOWASPDetectionHook,
  createSecurityScanHook,
  createErrorLoggingHook,
  getBuiltinHooks,
  registerBuiltinHooks,
} from './builtin-hooks.js';
