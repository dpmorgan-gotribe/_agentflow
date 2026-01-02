/**
 * Settings Controller
 *
 * REST endpoints for workflow settings management.
 */

import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { AuthGuard } from '../../common/guards';
import { SettingsService } from './settings.service';
import { WorkflowSettings, UpdateWorkflowSettings } from './settings.schema';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current workflow settings' })
  @ApiResponse({ status: 200, description: 'Returns current settings' })
  getSettings(): WorkflowSettings {
    return this.settingsService.getSettings();
  }

  @Patch()
  @ApiOperation({ summary: 'Update workflow settings' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async updateSettings(
    @Body() updates: UpdateWorkflowSettings
  ): Promise<WorkflowSettings> {
    return this.settingsService.updateSettings(updates);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset settings to defaults' })
  @ApiResponse({ status: 200, description: 'Settings reset to defaults' })
  async resetSettings(): Promise<WorkflowSettings> {
    return this.settingsService.resetSettings();
  }
}
