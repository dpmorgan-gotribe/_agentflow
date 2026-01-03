/**
 * Projects Module
 *
 * Handles project directory management, CLAUDE.md generation,
 * and artifact persistence to project folders.
 */

import { Module, Global, forwardRef } from '@nestjs/common';
import { ProjectDirectoryService } from './project-directory.service.js';
import { ProjectArtifactWriterService } from './project-artifact-writer.service.js';
import { ProjectsController } from './projects.controller.js';
import { TasksModule } from '../tasks/tasks.module.js';

@Global()
@Module({
  imports: [forwardRef(() => TasksModule)],
  controllers: [ProjectsController],
  providers: [ProjectDirectoryService, ProjectArtifactWriterService],
  exports: [ProjectDirectoryService, ProjectArtifactWriterService],
})
export class ProjectsModule {}
