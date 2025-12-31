#!/usr/bin/env node
/**
 * @aigentflow/cli
 *
 * CLI interface for Aigentflow development orchestrator.
 *
 * @example
 * ```bash
 * # Initialize a new project
 * aigentflow init
 *
 * # Run the orchestrator with a prompt
 * aigentflow run "Create a REST API for user management"
 *
 * # Check task status
 * aigentflow status <taskId>
 *
 * # Approve a pending task
 * aigentflow approve <taskId>
 *
 * # Configure the CLI
 * aigentflow config set api.port 3001
 * ```
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from './config/loader.js';
import {
  initCommand,
  runCommand,
  statusCommand,
  approveCommand,
  configCommand,
} from './commands/index.js';
import { MESSAGES } from './constants.js';
import { isCLIError } from './errors.js';

// Package version (injected at build time or read from package.json)
const VERSION = '0.0.0';

/**
 * Main CLI program
 */
const program = new Command();

program
  .name('aigentflow')
  .description(MESSAGES.WELCOME)
  .version(VERSION, '-v, --version', 'Output the version number');

// Load configuration
let config;
try {
  config = loadConfig();
} catch (error) {
  if (isCLIError(error)) {
    console.error(chalk.red(`Configuration error: ${error.message}`));
    process.exit(1);
  }
  throw error;
}

// Register commands
program.addCommand(initCommand);
program.addCommand(runCommand(config));
program.addCommand(statusCommand(config));
program.addCommand(approveCommand(config));
program.addCommand(configCommand);

// Handle unknown commands
program.on('command:*', () => {
  console.error(
    chalk.red(`Unknown command: ${program.args.join(' ')}`)
  );
  console.log(chalk.dim('Run `aigentflow --help` for available commands.'));
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

// Export for programmatic use
export { loadConfig } from './config/index.js';
export { ApiClient } from './client/index.js';
export type { Config } from './config/types.js';
export type { TaskStatus, CreateTaskInput, ApprovalDecision } from './types.js';
export * from './errors.js';
