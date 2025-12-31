/**
 * Init Command
 *
 * Initialize a new Aigentflow project.
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { saveProjectConfig } from '../config/loader.js';
import { PROJECT_FILES, AVAILABLE_AGENTS, MESSAGES } from '../constants.js';
import { validateProjectPath } from '../security/validator.js';
import { FileOperationError } from '../errors.js';

/**
 * Create the init command
 */
export const initCommand = new Command('init')
  .description('Initialize a new Aigentflow project')
  .option('-y, --yes', 'Accept defaults without prompting')
  .option('-p, --path <path>', 'Project directory', process.cwd())
  .action(async (options) => {
    try {
      // Validate project path
      const projectPath = validateProjectPath(options.path);
      const configPath = join(projectPath, PROJECT_FILES.CONFIG);
      const stateDir = join(projectPath, PROJECT_FILES.STATE_DIR);

      // Check if already initialized
      if (existsSync(configPath) && !options.yes) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: `${MESSAGES.INIT_EXISTS}. Overwrite?`,
            default: false,
          },
        ]);

        if (!overwrite) {
          console.log(chalk.yellow(MESSAGES.INIT_CANCELLED));
          return;
        }
      }

      // Get project name from package.json if available
      let defaultName = 'my-project';
      const packageJsonPath = join(projectPath, 'package.json');
      if (existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(
            readFileSync(packageJsonPath, 'utf-8')
          );
          if (packageJson.name) {
            defaultName = packageJson.name;
          }
        } catch {
          // Ignore package.json parse errors
        }
      }

      // Build configuration
      let config: Record<string, unknown> = {
        name: defaultName,
        version: '1.0.0',
      };

      if (!options.yes) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Project name:',
            default: defaultName,
            validate: (input: string) =>
              input.length > 0 || 'Project name is required',
          },
          {
            type: 'list',
            name: 'type',
            message: 'Project type:',
            choices: ['web', 'api', 'fullstack', 'library'],
          },
          {
            type: 'checkbox',
            name: 'agents',
            message: 'Enable agents:',
            choices: AVAILABLE_AGENTS.map((agent) => ({
              name: agent.name,
              value: agent.value,
              checked: true,
            })),
          },
        ]);

        config = { ...config, ...answers };
      } else {
        // Use defaults for --yes flag
        config = {
          ...config,
          type: 'fullstack',
          agents: AVAILABLE_AGENTS.map((a) => a.value),
        };
      }

      // Create .aigentflow.json
      saveProjectConfig(config, projectPath);
      console.log(chalk.green(`✓ Created ${PROJECT_FILES.CONFIG}`));

      // Create .aigentflow directory
      if (!existsSync(stateDir)) {
        mkdirSync(stateDir, { recursive: true });
        console.log(chalk.green(`✓ Created ${PROJECT_FILES.STATE_DIR}/ directory`));
      }

      // Update .gitignore
      const gitignorePath = join(projectPath, PROJECT_FILES.GITIGNORE);
      const gitignoreEntry = `\n# Aigentflow\n${PROJECT_FILES.STATE_DIR}/\n`;

      if (existsSync(gitignorePath)) {
        const content = readFileSync(gitignorePath, 'utf-8');
        if (!content.includes(PROJECT_FILES.STATE_DIR)) {
          appendFileSync(gitignorePath, gitignoreEntry);
          console.log(chalk.green(`✓ Updated ${PROJECT_FILES.GITIGNORE}`));
        }
      } else {
        // Create .gitignore if it doesn't exist
        try {
          appendFileSync(gitignorePath, gitignoreEntry.trim() + '\n');
          console.log(chalk.green(`✓ Created ${PROJECT_FILES.GITIGNORE}`));
        } catch {
          // Non-fatal: .gitignore creation is optional
        }
      }

      console.log(chalk.bold(`\n${MESSAGES.INIT_SUCCESS}`));
      console.log(chalk.dim('Run `aigentflow run "your prompt"` to start'));
    } catch (error) {
      if (error instanceof FileOperationError) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
      throw error;
    }
  });
