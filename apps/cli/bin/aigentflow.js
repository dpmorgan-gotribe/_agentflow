#!/usr/bin/env node
/**
 * Aigentflow CLI Executable
 *
 * This is the entry point for the aigentflow command.
 */

import('../dist/index.js').catch((error) => {
  console.error('Failed to start aigentflow CLI:', error.message);
  process.exit(1);
});
