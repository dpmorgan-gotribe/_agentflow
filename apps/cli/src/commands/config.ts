/**
 * Config Command
 *
 * Manage CLI configuration.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  loadConfig,
  saveGlobalConfig,
  getGlobalConfigPath,
} from '../config/loader.js';
import { maskToken } from '../security/sanitizer.js';
import { isCLIError, ConfigValidationError } from '../errors.js';

/**
 * Create the config command
 */
export const configCommand = new Command('config')
  .description('Manage CLI configuration');

/**
 * Config get subcommand
 */
configCommand
  .command('get')
  .description('Show current configuration')
  .option('--json', 'Output as JSON')
  .option('--show-secrets', 'Show secrets (use with caution)')
  .action((options) => {
    try {
      const config = loadConfig();

      // Mask sensitive values unless --show-secrets
      const displayConfig = {
        ...config,
        api: {
          ...config.api,
          token: options.showSecrets
            ? config.api.token
            : config.api.token
              ? maskToken(config.api.token)
              : '(not set)',
        },
      };

      if (options.json) {
        console.log(JSON.stringify(displayConfig, null, 2));
      } else {
        console.log(chalk.bold('\nCurrent Configuration'));
        console.log('─'.repeat(40));

        console.log(chalk.bold('\nAPI:'));
        console.log(`  Port:       ${displayConfig.api.port}`);
        console.log(`  Remote URL: ${displayConfig.api.remoteUrl}`);
        console.log(`  Token:      ${displayConfig.api.token}`);
        console.log(`  Timeout:    ${displayConfig.api.timeout}ms`);

        console.log(chalk.bold('\nCLI:'));
        console.log(`  Mode:       ${displayConfig.cli.defaultMode}`);
        console.log(`  Format:     ${displayConfig.cli.outputFormat}`);
        console.log(`  Streaming:  ${displayConfig.cli.streamEnabled}`);

        console.log(chalk.bold('\nProject:'));
        console.log(`  Path:       ${displayConfig.project.path}`);

        console.log(chalk.dim(`\nConfig file: ${getGlobalConfigPath()}`));
      }
    } catch (error) {
      if (isCLIError(error)) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
      throw error;
    }
  });

/**
 * Config set subcommand
 */
configCommand
  .command('set')
  .description('Set a configuration value')
  .argument('<key>', 'Configuration key (e.g., api.port, cli.mode)')
  .argument('<value>', 'Value to set')
  .action((key: string, value: string) => {
    try {
      // Parse the key path
      const parts = key.split('.');
      if (parts.length !== 2) {
        throw new ConfigValidationError(
          'Key must be in format section.key (e.g., api.port)',
          key
        );
      }

      const [section, prop] = parts;

      // Validate section
      if (!['api', 'cli'].includes(section!)) {
        throw new ConfigValidationError(
          `Invalid section: ${section}. Valid sections: api, cli`,
          key
        );
      }

      // Validate and convert value based on key
      let convertedValue: string | number | boolean = value;

      // Handle known numeric fields
      if (
        (section === 'api' && prop === 'port') ||
        (section === 'api' && prop === 'timeout')
      ) {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue)) {
          throw new ConfigValidationError(
            `${key} must be a number`,
            key,
            { value }
          );
        }
        convertedValue = numValue;
      }

      // Handle known boolean fields
      if (section === 'cli' && prop === 'streamEnabled') {
        convertedValue = value === 'true' || value === '1';
      }

      // Handle enum fields
      if (section === 'cli' && prop === 'defaultMode') {
        if (!['local', 'remote'].includes(value)) {
          throw new ConfigValidationError(
            `${key} must be 'local' or 'remote'`,
            key,
            { value }
          );
        }
      }

      if (section === 'cli' && prop === 'outputFormat') {
        if (!['pretty', 'json'].includes(value)) {
          throw new ConfigValidationError(
            `${key} must be 'pretty' or 'json'`,
            key,
            { value }
          );
        }
      }

      // Build update object
      const update: Record<string, Record<string, unknown>> = {
        [section!]: {
          [prop!]: convertedValue,
        },
      };

      // Save to global config
      saveGlobalConfig(update);

      console.log(chalk.green(`✓ Set ${key} = ${convertedValue}`));
    } catch (error) {
      if (isCLIError(error)) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
      throw error;
    }
  });

/**
 * Config path subcommand
 */
configCommand
  .command('path')
  .description('Show configuration file path')
  .action(() => {
    console.log(getGlobalConfigPath());
  });
