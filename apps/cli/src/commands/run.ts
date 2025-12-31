/**
 * Run Command
 *
 * Run the orchestrator with a prompt.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import type { Config } from '../config/types.js';
import { ApiClient } from '../client/api-client.js';
import { createSpinner } from '../output/spinner.js';
import { createStreamHandler } from '../output/stream-handler.js';
import { validatePrompt, validateProjectPath } from '../security/validator.js';
import { MESSAGES, CONFIG_DEFAULTS, CLI_LIMITS } from '../constants.js';
import {
  isCLIError,
  TaskTimeoutError,
} from '../errors.js';
import type { ExecutionMode } from '../types.js';

/**
 * Create the run command
 */
export function runCommand(config: Config): Command {
  return new Command('run')
    .description('Run the orchestrator with a prompt')
    .argument('<prompt>', 'The task prompt')
    .option('-p, --project <path>', 'Project directory', process.cwd())
    .option('-m, --mode <mode>', 'Execution mode (local|remote)', config.cli.defaultMode)
    .option('--no-stream', 'Disable streaming output')
    .option('--json', 'Output as JSON')
    .option(
      '--timeout <ms>',
      'Task timeout in milliseconds',
      String(CONFIG_DEFAULTS.MAX_POLL_RETRIES * CONFIG_DEFAULTS.POLL_INTERVAL_MS)
    )
    .action(async (promptArg: string, options) => {
      const spinner = createSpinner('Starting orchestrator...');

      try {
        // Validate inputs
        const prompt = validatePrompt(promptArg);
        const projectPath = validateProjectPath(options.project);
        const mode = options.mode as ExecutionMode;
        const jsonOutput = options.json === true;
        const streamEnabled = options.stream !== false && !jsonOutput;
        const timeout = parseInt(options.timeout, 10);

        // Create API client
        const client = new ApiClient(config, mode);

        spinner.start();

        // Create task
        const task = await client.createTask({
          prompt,
          projectPath,
        });

        spinner.succeed(MESSAGES.TASK_CREATED(task.id));

        if (streamEnabled) {
          // Stream agent activity
          const streamUrl = client.getStreamUrl(task.id);
          const handler = createStreamHandler({ jsonMode: jsonOutput });

          try {
            await handler.connect(streamUrl);
            await handler.waitForCompletion();
          } catch (error) {
            // Stream errors are logged but don't fail the command
            // Fall back to polling
            console.log(chalk.yellow('Streaming unavailable, polling for status...'));
            await pollForCompletion(client, task.id, timeout);
          }
        } else {
          // Poll for completion
          await pollForCompletion(client, task.id, timeout, jsonOutput);
        }

        if (!jsonOutput) {
          console.log(chalk.green(`\n✓ ${MESSAGES.TASK_COMPLETED}`));
        }
      } catch (error) {
        spinner.fail('Task failed');

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

/**
 * Poll for task completion
 */
async function pollForCompletion(
  client: ApiClient,
  taskId: string,
  timeoutMs: number,
  jsonOutput: boolean = false
): Promise<void> {
  const spinner = createSpinner(MESSAGES.TASK_RUNNING);
  const startTime = Date.now();
  let pollInterval: number = CONFIG_DEFAULTS.POLL_INTERVAL_MS;

  if (!jsonOutput) {
    spinner.start();
  }

  while (true) {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      spinner.fail('Task timed out');
      throw new TaskTimeoutError(taskId, timeoutMs);
    }

    const status = await client.getTaskStatus(taskId);

    if (status.state === 'completed') {
      if (!jsonOutput) {
        spinner.succeed('Processing complete');
      } else {
        console.log(JSON.stringify(status));
      }
      return;
    }

    if (status.state === 'failed') {
      if (!jsonOutput) {
        spinner.fail('Processing failed');
      }
      throw new Error(status.error || 'Task failed');
    }

    if (status.state === 'awaiting_approval') {
      if (!jsonOutput) {
        spinner.info(MESSAGES.TASK_AWAITING_APPROVAL);
        console.log(chalk.yellow(MESSAGES.APPROVAL_HINT(taskId)));
      } else {
        console.log(JSON.stringify(status));
      }
      return;
    }

    // Update spinner text
    if (!jsonOutput) {
      const agentInfo = status.currentAgent
        ? ` (${status.currentAgent})`
        : '';
      spinner.text(`${MESSAGES.TASK_RUNNING}${agentInfo}`);
    }

    // Wait with exponential backoff (capped)
    await new Promise((r) => setTimeout(r, pollInterval));
    pollInterval = Math.min(
      pollInterval * 1.2,
      CLI_LIMITS.MAX_POLL_INTERVAL_MS
    );
  }
}
