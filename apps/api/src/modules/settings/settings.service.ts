/**
 * Settings Service
 *
 * Manages workflow settings with in-memory storage and file persistence.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  WorkflowSettings,
  WorkflowSettingsSchema,
  DEFAULT_WORKFLOW_SETTINGS,
  UpdateWorkflowSettings,
} from './settings.schema';

const SETTINGS_DIR = '.aigentflow';
const SETTINGS_FILE = 'settings.json';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private settings: WorkflowSettings = { ...DEFAULT_WORKFLOW_SETTINGS };

  async onModuleInit(): Promise<void> {
    await this.loadSettings();
  }

  /**
   * Get current workflow settings
   */
  getSettings(): WorkflowSettings {
    return { ...this.settings };
  }

  /**
   * Update workflow settings
   */
  async updateSettings(updates: UpdateWorkflowSettings): Promise<WorkflowSettings> {
    // Merge updates with current settings
    const merged = { ...this.settings, ...updates };

    // Validate the merged settings
    const validated = WorkflowSettingsSchema.parse(merged);

    // Apply style competition logic
    if (!validated.enableStyleCompetition) {
      // When style competition is disabled, force counts to 1
      validated.stylePackageCount = 1;
      validated.parallelDesignerCount = 1;
    }

    this.settings = validated;

    // Persist to disk
    await this.saveSettings();

    this.logger.log(`Settings updated: ${JSON.stringify(validated)}`);

    return { ...this.settings };
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings(): Promise<WorkflowSettings> {
    this.settings = { ...DEFAULT_WORKFLOW_SETTINGS };
    await this.saveSettings();
    this.logger.log('Settings reset to defaults');
    return { ...this.settings };
  }

  /**
   * Load settings from disk
   */
  private async loadSettings(): Promise<void> {
    try {
      const settingsPath = path.join(process.cwd(), SETTINGS_DIR, SETTINGS_FILE);
      const content = await fs.readFile(settingsPath, 'utf-8');
      const parsed = JSON.parse(content);

      // Validate and merge with defaults (in case new settings were added)
      const validated = WorkflowSettingsSchema.parse({
        ...DEFAULT_WORKFLOW_SETTINGS,
        ...parsed,
      });

      this.settings = validated;
      this.logger.log(`Loaded settings from ${settingsPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.log('No settings file found, using defaults');
      } else {
        this.logger.warn(`Failed to load settings: ${error}`);
      }
      this.settings = { ...DEFAULT_WORKFLOW_SETTINGS };
    }
  }

  /**
   * Save settings to disk
   */
  private async saveSettings(): Promise<void> {
    try {
      const settingsDir = path.join(process.cwd(), SETTINGS_DIR);
      await fs.mkdir(settingsDir, { recursive: true });

      const settingsPath = path.join(settingsDir, SETTINGS_FILE);
      await fs.writeFile(settingsPath, JSON.stringify(this.settings, null, 2));

      this.logger.debug(`Settings saved to ${settingsPath}`);
    } catch (error) {
      this.logger.error(`Failed to save settings: ${error}`);
    }
  }
}
