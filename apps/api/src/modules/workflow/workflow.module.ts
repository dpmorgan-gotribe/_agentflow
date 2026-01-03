/**
 * Workflow Module
 *
 * Provides LangGraph workflow execution services.
 */

import { Module } from '@nestjs/common';

import { WorkflowService } from './workflow.service';
import { ProjectsModule } from '../projects';
import { SettingsModule } from '../settings';

@Module({
  imports: [ProjectsModule, SettingsModule],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
