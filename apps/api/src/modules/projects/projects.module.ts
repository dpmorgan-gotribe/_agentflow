/**
 * Projects Module
 *
 * Handles project directory management, CLAUDE.md generation,
 * and artifact persistence to project folders.
 */

import { Module, Global } from '@nestjs/common';
import { ProjectDirectoryService } from './project-directory.service.js';
import { ProjectArtifactWriterService } from './project-artifact-writer.service.js';
import { ProjectsController } from './projects.controller.js';

@Global()
@Module({
  controllers: [ProjectsController],
  providers: [ProjectDirectoryService, ProjectArtifactWriterService],
  exports: [ProjectDirectoryService, ProjectArtifactWriterService],
})
export class ProjectsModule {}
