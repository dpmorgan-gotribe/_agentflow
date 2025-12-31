/**
 * CLAUDE.md Generator
 *
 * Generates CLAUDE.md context files from project analysis results.
 * Includes secret redaction and configurable sections.
 */

import type {
  ClaudeMdContext,
  GeneratorOptions,
  TechStackInfo,
  ProjectStructure,
  CodeConventions,
  DevCommands,
  ArchitectureSummary,
  ComplianceInfo,
  AnalysisResult,
} from '../types.js';
import { GenerationError } from '../errors.js';
import { safeWriteFile } from '../utils/safe-fs.js';

/**
 * Default generator options
 */
export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  includeArchitecture: true,
  includeCompliance: false,
  includeApiDocs: false,
  customSections: [],
  outputFormat: 'markdown',
};

/**
 * Secret patterns to redact from generated content
 */
const SECRET_PATTERNS = [
  // API Keys
  /\b(sk|pk)[-_][a-zA-Z0-9]{20,}\b/g,
  /\b[a-zA-Z0-9]{32,}\b/g, // Generic long tokens
  // AWS
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\baws[-_]?secret[-_]?access[-_]?key\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  // GitHub
  /\bgh[ps]_[a-zA-Z0-9]{36,}\b/g,
  /\bgithub[-_]?token\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  // Generic patterns
  /\bpassword\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  /\bapi[-_]?key\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  /\bsecret[-_]?key\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  /\baccess[-_]?token\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  /\bauthorization\s*[=:]\s*["']?Bearer\s+[^"'\s]+["']?/gi,
  // Database URLs with credentials
  /\b(postgres|mysql|mongodb):\/\/[^:]+:[^@]+@/gi,
];

/**
 * Redacts secrets from a string
 */
function redactSecrets(content: string): string {
  let result = content;

  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }

  return result;
}

/**
 * CLAUDE.md Generator Class
 *
 * Generates context documentation for AI assistants.
 */
export class ClaudeMdGenerator {
  private readonly options: GeneratorOptions;

  constructor(options: Partial<GeneratorOptions> = {}) {
    this.options = { ...DEFAULT_GENERATOR_OPTIONS, ...options };
  }

  /**
   * Generate CLAUDE.md content from analysis results
   */
  generate(context: ClaudeMdContext): string {
    try {
      switch (this.options.outputFormat) {
        case 'yaml':
          return this.generateYaml(context);
        case 'json':
          return this.generateJson(context);
        case 'markdown':
        default:
          return this.generateMarkdown(context);
      }
    } catch (error) {
      throw new GenerationError(
        `Failed to generate CLAUDE.md: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'main',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate CLAUDE.md and write to file
   */
  generateAndWrite(context: ClaudeMdContext, outputPath: string, projectRoot: string): void {
    const content = this.generate(context);
    safeWriteFile(outputPath, content, projectRoot);
  }

  /**
   * Create ClaudeMdContext from analysis results
   */
  static createContext(
    projectName: string,
    description: string,
    analysis: AnalysisResult,
    options?: {
      version?: string;
      architecture?: ArchitectureSummary;
      compliance?: ComplianceInfo;
      additionalContext?: Record<string, unknown>;
    }
  ): ClaudeMdContext {
    return {
      projectName,
      description,
      version: options?.version ?? '1.0.0',
      generatedAt: new Date(),
      techStack: analysis.techStack,
      structure: analysis.structure,
      conventions: analysis.conventions,
      commands: analysis.commands,
      architecture: options?.architecture,
      compliance: options?.compliance,
      additionalContext: options?.additionalContext,
    };
  }

  // Private generation methods

  private generateMarkdown(context: ClaudeMdContext): string {
    const sections: string[] = [];

    // Header
    sections.push(this.generateHeader(context));

    // Tech Stack
    sections.push(this.generateTechStackSection(context.techStack));

    // Project Structure
    sections.push(this.generateStructureSection(context.structure));

    // Commands
    sections.push(this.generateCommandsSection(context.commands));

    // Conventions
    sections.push(this.generateConventionsSection(context.conventions));

    // Architecture (optional)
    if (this.options.includeArchitecture && context.architecture) {
      sections.push(this.generateArchitectureSection(context.architecture));
    }

    // Compliance (optional)
    if (this.options.includeCompliance && context.compliance) {
      sections.push(this.generateComplianceSection(context.compliance));
    }

    // Custom sections
    for (const sectionName of this.options.customSections) {
      const customContent = context.additionalContext?.[sectionName];
      if (customContent) {
        sections.push(this.generateCustomSection(sectionName, customContent));
      }
    }

    // Footer
    sections.push(this.generateFooter(context));

    const content = sections.join('\n\n');
    return redactSecrets(content);
  }

  private generateHeader(context: ClaudeMdContext): string {
    return `# CLAUDE.md - ${context.projectName}

> Auto-generated context file for AI assistants
> Version: ${context.version}
> Generated: ${context.generatedAt.toISOString()}

## Overview

${context.description}`;
  }

  private generateTechStackSection(techStack: TechStackInfo): string {
    const lines: string[] = ['## Tech Stack'];

    // Languages
    if (techStack.languages.length > 0) {
      lines.push('');
      lines.push('### Languages');
      for (const lang of techStack.languages) {
        const version = lang.version ? ` (${lang.version})` : '';
        const primary = lang.primary ? ' **[Primary]**' : '';
        lines.push(`- ${lang.name}${version}${primary}`);
      }
    }

    // Frameworks
    if (techStack.frameworks.length > 0) {
      lines.push('');
      lines.push('### Frameworks');
      for (const fw of techStack.frameworks) {
        const version = fw.version ? ` (${fw.version})` : '';
        lines.push(`- ${fw.name}${version} [${fw.type}]`);
      }
    }

    // Build Tools
    if (techStack.buildTools.length > 0) {
      lines.push('');
      lines.push('### Build Tools');
      for (const tool of techStack.buildTools) {
        lines.push(`- ${tool}`);
      }
    }

    // Testing
    if (techStack.testingTools.length > 0) {
      lines.push('');
      lines.push('### Testing');
      for (const tool of techStack.testingTools) {
        lines.push(`- ${tool}`);
      }
    }

    // Databases
    if (techStack.databases.length > 0) {
      lines.push('');
      lines.push('### Databases');
      for (const db of techStack.databases) {
        lines.push(`- ${db}`);
      }
    }

    // Services
    if (techStack.services.length > 0) {
      lines.push('');
      lines.push('### Services');
      for (const service of techStack.services) {
        lines.push(`- ${service}`);
      }
    }

    return lines.join('\n');
  }

  private generateStructureSection(structure: ProjectStructure): string {
    const lines: string[] = ['## Project Structure'];

    lines.push('');
    lines.push('```');
    lines.push(structure.rootDir);

    // Source directories
    if (structure.srcDirs.length > 0) {
      for (const dir of structure.srcDirs) {
        lines.push(`├── ${dir}/          # Source code`);
      }
    }

    // Test directories
    if (structure.testDirs.length > 0) {
      for (const dir of structure.testDirs) {
        lines.push(`├── ${dir}/          # Tests`);
      }
    }

    // Key directories
    for (const dir of structure.keyDirectories.slice(0, 10)) {
      lines.push(`├── ${dir.path}/      # ${dir.purpose}`);
    }

    lines.push('```');

    // Entry points
    if (structure.entryPoints.length > 0) {
      lines.push('');
      lines.push('### Entry Points');
      for (const entry of structure.entryPoints) {
        lines.push(`- \`${entry}\``);
      }
    }

    // Config files
    if (structure.configFiles.length > 0) {
      lines.push('');
      lines.push('### Configuration Files');
      for (const config of structure.configFiles.slice(0, 15)) {
        lines.push(`- \`${config}\``);
      }
    }

    return lines.join('\n');
  }

  private generateCommandsSection(commands: DevCommands): string {
    const lines: string[] = ['## Development Commands'];

    lines.push('');
    lines.push('```bash');
    lines.push(`# Install dependencies`);
    lines.push(commands.install);
    lines.push('');
    lines.push(`# Build`);
    lines.push(commands.build);
    lines.push('');
    lines.push(`# Development`);
    lines.push(commands.dev);
    lines.push('');
    lines.push(`# Test`);
    lines.push(commands.test);
    lines.push('');
    lines.push(`# Lint`);
    lines.push(commands.lint);
    lines.push('');
    lines.push(`# Format`);
    lines.push(commands.format);
    lines.push('```');

    // Custom commands
    const customEntries = Object.entries(commands.custom);
    if (customEntries.length > 0) {
      lines.push('');
      lines.push('### Additional Commands');
      lines.push('');
      lines.push('| Command | Description |');
      lines.push('|---------|-------------|');
      for (const [name, cmd] of customEntries.slice(0, 10)) {
        lines.push(`| \`${cmd}\` | ${name} |`);
      }
    }

    return lines.join('\n');
  }

  private generateConventionsSection(conventions: CodeConventions): string {
    const lines: string[] = ['## Code Conventions'];

    // Naming
    lines.push('');
    lines.push('### Naming Conventions');
    lines.push('');
    lines.push('| Element | Style |');
    lines.push('|---------|-------|');
    lines.push(`| Files | ${conventions.namingConventions.files} |`);
    lines.push(`| Components | ${conventions.namingConventions.components} |`);
    lines.push(`| Functions | ${conventions.namingConventions.functions} |`);
    lines.push(`| Constants | ${conventions.namingConventions.constants} |`);

    // Formatting
    lines.push('');
    lines.push('### Formatting');
    lines.push('');
    lines.push(`- **Indentation**: ${conventions.formatting.indentation} (${conventions.formatting.indentSize})`);
    lines.push(`- **Max line length**: ${conventions.formatting.maxLineLength}`);
    lines.push(`- **Semicolons**: ${conventions.formatting.semicolons ? 'Required' : 'Optional'}`);
    lines.push(`- **Quotes**: ${conventions.formatting.quotes}`);

    // Patterns
    if (conventions.patterns.length > 0) {
      lines.push('');
      lines.push('### Patterns & Tools');
      for (const pattern of conventions.patterns) {
        lines.push(`- ${pattern}`);
      }
    }

    return lines.join('\n');
  }

  private generateArchitectureSection(architecture: ArchitectureSummary): string {
    const lines: string[] = ['## Architecture'];

    lines.push('');
    lines.push(`**Pattern**: ${architecture.pattern}`);
    lines.push(`**API Style**: ${architecture.apiStyle}`);
    if (architecture.stateManagement) {
      lines.push(`**State Management**: ${architecture.stateManagement}`);
    }
    lines.push(`**Data Flow**: ${architecture.dataFlow}`);

    if (architecture.keyComponents.length > 0) {
      lines.push('');
      lines.push('### Key Components');
      for (const component of architecture.keyComponents) {
        lines.push(`- ${component}`);
      }
    }

    return lines.join('\n');
  }

  private generateComplianceSection(compliance: ComplianceInfo): string {
    const lines: string[] = ['## Compliance'];

    if (compliance.frameworks.length > 0) {
      lines.push('');
      lines.push('### Frameworks');
      for (const fw of compliance.frameworks) {
        lines.push(`- ${fw}`);
      }
    }

    if (compliance.requirements.length > 0) {
      lines.push('');
      lines.push('### Requirements');
      for (const req of compliance.requirements) {
        lines.push(`- ${req}`);
      }
    }

    if (compliance.dataHandling.length > 0) {
      lines.push('');
      lines.push('### Data Handling');
      for (const dh of compliance.dataHandling) {
        lines.push(`- ${dh}`);
      }
    }

    return lines.join('\n');
  }

  private generateCustomSection(name: string, content: unknown): string {
    const lines: string[] = [`## ${this.formatSectionName(name)}`];

    lines.push('');

    if (typeof content === 'string') {
      lines.push(content);
    } else if (Array.isArray(content)) {
      for (const item of content) {
        lines.push(`- ${String(item)}`);
      }
    } else if (typeof content === 'object' && content !== null) {
      lines.push('```json');
      lines.push(JSON.stringify(content, null, 2));
      lines.push('```');
    } else {
      lines.push(String(content));
    }

    return lines.join('\n');
  }

  private generateFooter(context: ClaudeMdContext): string {
    return `---

*This file was auto-generated by Aigentflow Context Analyzer.*
*Last updated: ${context.generatedAt.toISOString()}*

## Notes for AI Assistants

- Follow the coding conventions specified above
- Use the development commands as documented
- Respect the project structure when creating new files
- Check for existing patterns before introducing new ones`;
  }

  private formatSectionName(name: string): string {
    return name
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private generateYaml(context: ClaudeMdContext): string {
    // Simple YAML generation (no external dependency)
    const lines: string[] = [];

    lines.push(`# CLAUDE.md - ${context.projectName}`);
    lines.push(`# Auto-generated context file for AI assistants`);
    lines.push('');
    lines.push(`projectName: "${context.projectName}"`);
    lines.push(`description: "${context.description}"`);
    lines.push(`version: "${context.version}"`);
    lines.push(`generatedAt: "${context.generatedAt.toISOString()}"`);
    lines.push('');
    lines.push('techStack:');
    lines.push('  languages:');
    for (const lang of context.techStack.languages) {
      lines.push(`    - name: "${lang.name}"`);
      if (lang.version) lines.push(`      version: "${lang.version}"`);
      lines.push(`      primary: ${lang.primary}`);
    }
    lines.push('  frameworks:');
    for (const fw of context.techStack.frameworks) {
      lines.push(`    - name: "${fw.name}"`);
      if (fw.version) lines.push(`      version: "${fw.version}"`);
      lines.push(`      type: "${fw.type}"`);
    }
    lines.push('  buildTools:');
    for (const tool of context.techStack.buildTools) {
      lines.push(`    - "${tool}"`);
    }
    lines.push('  testingTools:');
    for (const tool of context.techStack.testingTools) {
      lines.push(`    - "${tool}"`);
    }
    lines.push('  databases:');
    for (const db of context.techStack.databases) {
      lines.push(`    - "${db}"`);
    }
    lines.push('  services:');
    for (const service of context.techStack.services) {
      lines.push(`    - "${service}"`);
    }
    lines.push('');
    lines.push('commands:');
    lines.push(`  install: "${context.commands.install}"`);
    lines.push(`  build: "${context.commands.build}"`);
    lines.push(`  dev: "${context.commands.dev}"`);
    lines.push(`  test: "${context.commands.test}"`);
    lines.push(`  lint: "${context.commands.lint}"`);
    lines.push(`  format: "${context.commands.format}"`);

    const content = lines.join('\n');
    return redactSecrets(content);
  }

  private generateJson(context: ClaudeMdContext): string {
    // Create a clean object for JSON
    const output = {
      projectName: context.projectName,
      description: context.description,
      version: context.version,
      generatedAt: context.generatedAt.toISOString(),
      techStack: context.techStack,
      structure: {
        ...context.structure,
        // Truncate large arrays
        keyDirectories: context.structure.keyDirectories.slice(0, 20),
        configFiles: context.structure.configFiles.slice(0, 20),
      },
      conventions: context.conventions,
      commands: context.commands,
      ...(this.options.includeArchitecture && context.architecture
        ? { architecture: context.architecture }
        : {}),
      ...(this.options.includeCompliance && context.compliance
        ? { compliance: context.compliance }
        : {}),
    };

    const content = JSON.stringify(output, null, 2);
    return redactSecrets(content);
  }
}
