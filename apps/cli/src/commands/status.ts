/**
 * Status Command
 *
 * Check task or project status.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import type { Config } from '../config/types.js';
import { ApiClient } from '../client/api-client.js';
import { formatTable, truncate } from '../output/table.js';
import { validateTaskId } from '../security/validator.js';
import { isCLIError } from '../errors.js';
import type { TaskStatus } from '../types.js';
import type { ExecutionMode } from '../types.js';

/**
 * State color mapping
 */
const STATE_COLORS: Record<string, (text: string) => string> = {
  pending: chalk.gray,
  running: chalk.blue,
  awaiting_approval: chalk.yellow,
  completed: chalk.green,
  failed: chalk.red,
};

/**
 * Format task state with color
 */
function formatState(state: string): string {
  const colorFn = STATE_COLORS[state] || chalk.white;
  return colorFn(state);
}

/**
 * Print detailed task status
 */
function printTaskStatus(task: TaskStatus): void {
  console.log(chalk.bold('\nTask Status'));
  console.log('─'.repeat(40));
  console.log(`ID:      ${task.id}`);
  console.log(`State:   ${formatState(task.state)}`);
  console.log(`Prompt:  ${truncate(task.prompt, 60)}`);

  if (task.currentAgent) {
    console.log(`Agent:   ${task.currentAgent}`);
  }

  console.log(`Created: ${new Date(task.createdAt).toLocaleString()}`);
  console.log(`Updated: ${new Date(task.updatedAt).toLocaleString()}`);

  if (task.error) {
    console.log(chalk.red(`\nError: ${task.error}`));
  }

  if (task.artifacts && task.artifacts.length > 0) {
    console.log(chalk.bold('\nArtifacts:'));
    for (const artifact of task.artifacts) {
      console.log(`  - ${artifact.type}: ${artifact.path}`);
    }
  }

  if (task.pendingApproval) {
    console.log(chalk.bold('\nPending Approval:'));
    console.log(`  Reason: ${task.pendingApproval.reason}`);

    if (task.pendingApproval.artifacts) {
      console.log('  Artifacts:');
      for (const artifact of task.pendingApproval.artifacts) {
        console.log(`    - ${artifact.type}: ${artifact.path}`);
      }
    }
  }
}

/**
 * Print task list
 */
function printTaskList(tasks: TaskStatus[]): void {
  console.log(chalk.bold('\nRecent Tasks'));
  console.log('─'.repeat(60));

  if (tasks.length === 0) {
    console.log(chalk.gray('No tasks found'));
    return;
  }

  const rows = tasks.map((t) => ({
    ID: t.id.length > 8 ? t.id.substring(0, 8) : t.id,
    State: formatState(t.state),
    Prompt: truncate(t.prompt, 30),
    Created: new Date(t.createdAt).toLocaleDateString(),
  }));

  console.log(formatTable(rows));
}

/**
 * Create the status command
 */
export function statusCommand(config: Config): Command {
  return new Command('status')
    .description('Check task or project status')
    .argument('[taskId]', 'Task ID (optional, shows recent tasks if omitted)')
    .option('-m, --mode <mode>', 'Execution mode (local|remote)', config.cli.defaultMode)
    .option('--json', 'Output as JSON')
    .option('-n, --limit <number>', 'Number of tasks to show', '10')
    .action(async (taskIdArg: string | undefined, options) => {
      try {
        const mode = options.mode as ExecutionMode;
        const jsonOutput = options.json === true;
        const client = new ApiClient(config, mode);

        if (taskIdArg) {
          // Show specific task status
          const taskId = validateTaskId(taskIdArg);
          const task = await client.getTaskStatus(taskId);

          if (jsonOutput) {
            console.log(JSON.stringify(task, null, 2));
          } else {
            printTaskStatus(task);
          }
        } else {
          // Show recent tasks
          const limit = parseInt(options.limit, 10) || 10;
          const tasks = await client.listTasks({ limit });

          if (jsonOutput) {
            console.log(JSON.stringify(tasks, null, 2));
          } else {
            printTaskList(tasks);
          }
        }
      } catch (error) {
        if (isCLIError(error)) {
          if (options.json) {
            console.log(
              JSON.stringify({
                error: {
                  code: error.code,
                  message: error.message,
                },
              })
            );
          } else {
            console.error(chalk.red(error.message));
          }
          process.exit(1);
        }
        throw error;
      }
    });
}
