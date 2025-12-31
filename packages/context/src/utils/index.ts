/**
 * Utilities Index
 *
 * Re-exports utility functions for the context package.
 */

export {
  validatePath,
  safeReadFile,
  safeReadDir,
  safeTraverse,
  safeExists,
  safeWriteFile,
  shouldIgnore,
  DEFAULT_LIMITS,
  type ValidatedPath,
  type TraversalOptions,
  type TraversalState,
} from './safe-fs.js';
