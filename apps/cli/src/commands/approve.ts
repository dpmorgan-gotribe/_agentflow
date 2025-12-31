/**
 * Approve Command
 *
 * Approve or reject a pending task.
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import type { Config } from '../config/types.js';
import { ApiClient } from '../client/api-client.js';
import { validateTaskId } from '../security/validator.js';
import { MESSAGES, CLI_LIMITS } from '../constants.js';
import { isCLIError, InvalidTaskStateError } from '../errors.js';
import type { ExecutionMode } from '../types.js';

/**
 * Create the approve command
 */
export function approveCommand(config: Config): Command {
  return new Command('approve')
    .description('Approve or reject a pending task')
    .argument('<taskId>', 'Task ID')
    .option('-m, --mode <mode>', 'Execution mode (local|remote)', config.cli.defaultMode)
    .option('--yes', 'Auto-approve without prompting')
    .option('--reject', 'Reject the task')
    .option('-M, --message <message>', 'Approval/rejection message')
    .option('--json', 'Output as JSON')
    .action(async (taskIdArg: string, options) => {
      try {
        // Validate task ID
        const taskId = validateTaskId(taskIdArg);
        const mode = options.mode as ExecutionMode;
        const jsonOutput = options.json === true;

        // Create API client
        const client = new ApiClient(config, mode);

        // Get current task state
        const task = await client.getTaskStatus(taskId);

        // Verify task is awaiting approval
        if (task.state !== 'awaiting_approval') {
          throw new InvalidTaskStateError(
            taskId,
            task.state,
            'awaiting_approval'
          );
        }

        if (!jsonOutput) {
          // Show what needs approval
          console.log(chalk.bold('\nPending Approval'));
          console.log('─'.repeat(40));
          console.log(`Task:  ${task.prompt}`);

          if (task.currentAgent) {
            console.log(`Agent: ${task.currentAgent}`);
          }

          if (task.pendingApproval?.reason) {
            console.log(`\nReason: ${task.pendingApproval.reason}`);
          }

          if (task.pendingApproval?.artifacts) {
            console.log(chalk.bold('\nArtifacts to approve:'));
            for (const artifact of task.pendingApproval.artifacts) {
              console.log(`  - ${artifact.type}: ${artifact.path}`);
            }
          }
        }

        // Determine approval decision
        let approved = options.yes === true;
        let rejected = options.reject === true;
        let message = options.message;

        if (!approved && !rejected && !jsonOutput) {
          const answer = await inquirer.prompt([
            {
              type: 'list',
              name: 'decision',
              message: 'What would you like to do?',
              choices: [
                { name: 'Approve', value: 'approve' },
                { name: 'Reject', value: 'reject' },
                { name: 'View Details', value: 'details' },
                { name: 'Cancel', value: 'cancel' },
              ],
            },
          ]);

          if (answer.decision === 'cancel') {
            console.log(chalk.yellow('Cancelled'));
            return;
          }

          if (answer.decision === 'details') {
            // Show full artifact content (limited for security)
            for (const artifact of task.pendingApproval?.artifacts || []) {
              console.log(chalk.bold(`\n${artifact.path}:`));

              // Truncate very large content for display
              const content = artifact.content || '';
              if (content.length > CLI_LIMITS.MAX_ARTIFACT_DISPLAY_SIZE) {
                console.log(
                  content.slice(0, CLI_LIMITS.MAX_ARTIFACT_DISPLAY_SIZE)
                );
                console.log(
                  chalk.dim(
                    `\n... (${content.length - CLI_LIMITS.MAX_ARTIFACT_DISPLAY_SIZE} more characters)`
                  )
                );
              } else {
                console.log(content);
              }
            }

            // Ask again after viewing details
            const confirmAnswer = await inquirer.prompt([
              {
                type: 'list',
                name: 'decision',
                message: 'What would you like to do?',
                choices: [
                  { name: 'Approve', value: 'approve' },
                  { name: 'Reject', value: 'reject' },
                  { name: 'Cancel', value: 'cancel' },
                ],
              },
            ]);

            if (confirmAnswer.decision === 'cancel') {
              console.log(chalk.yellow('Cancelled'));
              return;
            }

            approved = confirmAnswer.decision === 'approve';
            rejected = confirmAnswer.decision === 'reject';
          } else {
            approved = answer.decision === 'approve';
            rejected = answer.decision === 'reject';
          }
        }

        // Default to approve if --yes flag
        if (!approved && !rejected) {
          approved = options.yes === true;
        }

        // Submit decision
        await client.submitApproval(taskId, {
          approved: approved && !rejected,
          message,
        });

        if (jsonOutput) {
          console.log(
            JSON.stringify({
              taskId,
              approved: approved && !rejected,
              message,
            })
          );
        } else if (approved && !rejected) {
          console.log(chalk.green(`\n✓ ${MESSAGES.APPROVAL_SUCCESS}`));
        } else {
          console.log(chalk.yellow(`\n✗ ${MESSAGES.APPROVAL_REJECTED}`));
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
