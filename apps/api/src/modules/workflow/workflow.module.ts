/**
 * Workflow Module
 *
 * Provides LangGraph workflow execution services.
 */

import { Module } from '@nestjs/common';

import { WorkflowService } from './workflow.service';

@Module({
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
