/**
 * Projects Module Exports
 */

export { ProjectsModule } from './projects.module.js';
export { ProjectDirectoryService, type ProjectMetadata, type ProjectInfo } from './project-directory.service.js';
export { ProjectArtifactWriterService, type UIDesignerOutput, type AgentArtifact } from './project-artifact-writer.service.js';
export { extractProjectName, generateUniqueSlug, type ProjectNameResult } from './project-name-extractor.js';
