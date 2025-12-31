/**
 * Project Artifact Writer Service
 *
 * Handles writing agent outputs to the project directory structure.
 * Supports architect, UI designer, and other agent outputs.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ProjectDirectoryService } from './project-directory.service.js';
import {
  ClaudeMdGenerator,
  adaptArchitectOutput,
  generateADRFiles,
  generateConventionsFile,
  type ArchitectOutputInput,
} from '@aigentflow/context';

/**
 * UI Designer output structure (simplified)
 */
export interface UIDesignerOutput {
  projectName: string;
  version: string;
  pages: Array<{
    id: string;
    name: string;
    title: string;
    path: string;
  }>;
  sharedComponents: unknown[];
  colorPalette: Record<string, string>;
  typography: Record<string, unknown>;
  spacing: Record<string, unknown>;
  borderRadius: Record<string, string>;
  shadows: Record<string, string>;
}

/**
 * Generic artifact from agent output
 */
export interface AgentArtifact {
  type: string;
  name: string;
  path: string;
  content: string;
}

@Injectable()
export class ProjectArtifactWriterService {
  private readonly logger = new Logger(ProjectArtifactWriterService.name);
  private readonly claudeMdGenerator: ClaudeMdGenerator;

  constructor(private readonly projectDir: ProjectDirectoryService) {
    this.claudeMdGenerator = new ClaudeMdGenerator({
      includeArchitecture: true,
      includeCompliance: false,
    });
  }

  /**
   * Process architect agent output
   *
   * Writes:
   * - CLAUDE.md (generated from tech stack and conventions)
   * - docs/architecture/decisions/ADR-*.md (ADRs)
   * - docs/CONVENTIONS.md (coding conventions)
   * - Creates directory structure in src/
   */
  async writeArchitectOutput(
    projectId: string,
    prompt: string,
    architectOutput: ArchitectOutputInput
  ): Promise<string[]> {
    const writtenFiles: string[] = [];

    try {
      // Ensure project exists
      const project = await this.projectDir.getOrCreateProject(projectId, prompt);

      // 1. Generate and write CLAUDE.md
      const claudeContext = adaptArchitectOutput(architectOutput, {
        projectName: project.name,
        description: prompt,
      });
      const claudeMdContent = this.claudeMdGenerator.generate(claudeContext);
      const claudeMdPath = await this.projectDir.writeClaudeMd(
        projectId,
        claudeMdContent
      );
      writtenFiles.push(claudeMdPath);
      this.logger.log(`Wrote CLAUDE.md for project ${project.slug}`);

      // 2. Write ADR files
      const adrFiles = generateADRFiles(architectOutput);
      for (const adr of adrFiles) {
        const adrPath = await this.projectDir.writeFile(
          projectId,
          adr.path,
          adr.content
        );
        writtenFiles.push(adrPath);
      }
      if (adrFiles.length > 0) {
        this.logger.log(`Wrote ${adrFiles.length} ADR files`);
      }

      // 3. Write coding conventions
      const conventionsContent = generateConventionsFile(architectOutput);
      const conventionsPath = await this.projectDir.writeFile(
        projectId,
        'docs/CONVENTIONS.md',
        conventionsContent
      );
      writtenFiles.push(conventionsPath);

      // 4. Create directory structure from architect output
      if (architectOutput.directoryStructure) {
        await this.projectDir.createDirectoryStructure(
          projectId,
          architectOutput.directoryStructure
        );
        this.logger.log('Created directory structure from architect output');
      }

      // 5. Write tech stack summary
      const techStackPath = await this.projectDir.writeFile(
        projectId,
        'docs/architecture/tech-stack.json',
        JSON.stringify(architectOutput.techStack, null, 2)
      );
      writtenFiles.push(techStackPath);

      // 6. Update project metadata with tech stack
      await this.projectDir.updateMetadata(projectId, {
        techStack: architectOutput.techStack as unknown as Record<string, unknown>,
        status: 'active',
      });

      // 7. Commit architect changes
      await this.projectDir.commitChanges(
        projectId,
        'feat: initial architecture from architect agent'
      );

      return writtenFiles;
    } catch (error) {
      this.logger.error(`Failed to write architect output: ${error}`);
      throw error;
    }
  }

  /**
   * Process UI designer agent output
   *
   * Writes:
   * - designs/mockups/*.html (HTML mockups)
   * - designs/tokens/design-tokens.json
   * - designs/components.md (component library docs)
   * - designs/design-spec.json (full specification)
   */
  async writeUIDesignerOutput(
    projectId: string,
    designerOutput: UIDesignerOutput,
    artifacts: AgentArtifact[]
  ): Promise<string[]> {
    const writtenFiles: string[] = [];

    try {
      // 1. Write HTML mockup files
      for (const artifact of artifacts) {
        if (artifact.type === 'mockup' && artifact.content) {
          const mockupPath = await this.projectDir.writeFile(
            projectId,
            `designs/mockups/${artifact.name}.html`,
            artifact.content
          );
          writtenFiles.push(mockupPath);
        }
      }

      // 2. Write design tokens
      const designTokens = {
        colors: designerOutput.colorPalette,
        typography: designerOutput.typography,
        spacing: designerOutput.spacing,
        borderRadius: designerOutput.borderRadius,
        shadows: designerOutput.shadows,
      };
      const tokensPath = await this.projectDir.writeFile(
        projectId,
        'designs/tokens/design-tokens.json',
        JSON.stringify(designTokens, null, 2)
      );
      writtenFiles.push(tokensPath);

      // 3. Write design specification
      const specPath = await this.projectDir.writeFile(
        projectId,
        'designs/design-spec.json',
        JSON.stringify(designerOutput, null, 2)
      );
      writtenFiles.push(specPath);

      // 4. Write component documentation (if any)
      for (const artifact of artifacts) {
        if (artifact.type === 'documentation' && artifact.content) {
          const docPath = await this.projectDir.writeFile(
            projectId,
            artifact.path || 'designs/components.md',
            artifact.content
          );
          writtenFiles.push(docPath);
        }
      }

      // 5. Commit design changes
      await this.projectDir.commitChanges(
        projectId,
        'feat: UI designs from designer agent'
      );

      this.logger.log(
        `Wrote ${writtenFiles.length} design files for project`
      );

      return writtenFiles;
    } catch (error) {
      this.logger.error(`Failed to write UI designer output: ${error}`);
      throw error;
    }
  }

  /**
   * Write generic artifacts to project directory
   */
  async writeArtifacts(
    projectId: string,
    artifacts: AgentArtifact[],
    commitMessage?: string
  ): Promise<string[]> {
    const writtenFiles: string[] = [];

    for (const artifact of artifacts) {
      if (!artifact.content) continue;

      // Determine path based on artifact type
      let targetPath = artifact.path;
      if (!targetPath) {
        switch (artifact.type) {
          case 'source_file':
            targetPath = `src/${artifact.name}`;
            break;
          case 'test_file':
            targetPath = `tests/${artifact.name}`;
            break;
          case 'config_file':
            targetPath = artifact.name;
            break;
          case 'documentation':
            targetPath = `docs/${artifact.name}`;
            break;
          case 'mockup':
            targetPath = `designs/mockups/${artifact.name}`;
            break;
          case 'stylesheet':
            targetPath = `designs/styles/${artifact.name}`;
            break;
          default:
            targetPath = `artifacts/${artifact.name}`;
        }
      }

      const filePath = await this.projectDir.writeFile(
        projectId,
        targetPath,
        artifact.content
      );
      writtenFiles.push(filePath);
    }

    if (commitMessage && writtenFiles.length > 0) {
      await this.projectDir.commitChanges(projectId, commitMessage);
    }

    return writtenFiles;
  }

  /**
   * Get the project path for an ID
   */
  getProjectPath(projectId: string): string | null {
    return this.projectDir.getProjectPath(projectId);
  }
}
