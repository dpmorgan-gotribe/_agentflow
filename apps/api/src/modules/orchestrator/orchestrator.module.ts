/**
 * Orchestrator Module
 *
 * Provides API endpoints and services for interacting with
 * the orchestrator during workflow execution.
 */

import { Module, forwardRef } from '@nestjs/common';
import { OrchestratorController } from './orchestrator.controller';
import { OrchestratorService } from './orchestrator.service';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [forwardRef(() => WorkflowModule)],
  controllers: [OrchestratorController],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
