/**
 * Architect Output Adapter
 *
 * Converts ArchitectOutput from the architect agent into ClaudeMdContext
 * for generating CLAUDE.md files that other agents can use.
 */

import type {
  ClaudeMdContext,
  TechStackInfo,
  ProjectStructure,
  CodeConventions,
  DevCommands,
  ArchitectureSummary,
  LanguageInfo,
  FrameworkInfo,
  DirectoryInfo,
} from '../types.js';

/**
 * Simplified ArchitectOutput interface
 * Matches the structure from @aigentflow/agents
 */
export interface ArchitectOutputInput {
  techStack: {
    frontend?: {
      framework: { name: string; version?: string; purpose: string };
      language: { name: string; version?: string };
      styling: { name: string; version?: string };
      stateManagement?: { name: string };
      routing?: { name: string };
    };
    backend?: {
      framework: { name: string; version?: string; purpose: string };
      language: { name: string; version?: string };
      runtime?: { name: string; version?: string };
    };
    database?: {
      primary: { name: string; version?: string };
      cache?: { name: string };
      search?: { name: string };
    };
    infrastructure?: {
      hosting?: { name: string };
      ci?: { name: string };
      containerization?: { name: string };
    };
    testing: {
      unit: { name: string };
      integration?: { name: string };
      e2e?: { name: string };
    };
  };
  adrs: Array<{
    id: string;
    title: string;
    status: string;
    context: string;
    decision: string;
  }>;
  components: Array<{
    name: string;
    type: string;
    description: string;
    location: string;
    responsibilities: string[];
  }>;
  directoryStructure: {
    path: string;
    description: string;
    children?: Array<{
      path: string;
      description: string;
      children?: unknown[];
    }>;
  };
  apiEndpoints?: Array<{
    path: string;
    method: string;
    description: string;
  }>;
  dataModels?: Array<{
    name: string;
    description: string;
    fields: Array<{ name: string; type: string }>;
  }>;
  codingConventions: {
    naming: {
      files: string;
      directories: string;
      components: string;
      functions: string;
      variables: string;
      constants: string;
      types: string;
    };
    formatting: {
      indentation: string;
      lineLength: number;
      quotes: 'single' | 'double';
      semicolons: boolean;
    };
    patterns: Array<{ name: string; description: string; example: string }>;
    antiPatterns: Array<{ name: string; description: string; alternative: string }>;
  };
  securityConsiderations: string[];
  scalabilityNotes: string[];
}

/**
 * Options for the adapter
 */
export interface AdapterOptions {
  projectName: string;
  description: string;
  version?: string;
  includePatternExamples?: boolean;
}

/**
 * Convert ArchitectOutput to ClaudeMdContext
 */
export function adaptArchitectOutput(
  architectOutput: ArchitectOutputInput,
  options: AdapterOptions
): ClaudeMdContext {
  return {
    projectName: options.projectName,
    description: options.description,
    version: options.version ?? '1.0.0',
    generatedAt: new Date(),
    techStack: extractTechStack(architectOutput.techStack),
    structure: extractProjectStructure(architectOutput),
    conventions: extractCodeConventions(architectOutput.codingConventions),
    commands: inferDevCommands(architectOutput.techStack),
    architecture: extractArchitectureSummary(architectOutput),
  };
}

/**
 * Extract tech stack info from architect output
 */
function extractTechStack(
  techStack: ArchitectOutputInput['techStack']
): TechStackInfo {
  const languages: LanguageInfo[] = [];
  const frameworks: FrameworkInfo[] = [];
  const buildTools: string[] = [];
  const testingTools: string[] = [];
  const databases: string[] = [];
  const services: string[] = [];

  // Frontend
  if (techStack.frontend) {
    languages.push({
      name: techStack.frontend.language.name,
      version: techStack.frontend.language.version,
      primary: true,
    });
    frameworks.push({
      name: techStack.frontend.framework.name,
      version: techStack.frontend.framework.version,
      type: 'frontend',
    });
    if (techStack.frontend.styling) {
      services.push(techStack.frontend.styling.name);
    }
    if (techStack.frontend.stateManagement) {
      services.push(techStack.frontend.stateManagement.name);
    }
  }

  // Backend
  if (techStack.backend) {
    const backendLang = techStack.backend.language.name;
    if (!languages.some((l) => l.name === backendLang)) {
      languages.push({
        name: backendLang,
        version: techStack.backend.language.version,
        primary: !techStack.frontend,
      });
    }
    frameworks.push({
      name: techStack.backend.framework.name,
      version: techStack.backend.framework.version,
      type: 'backend',
    });
    if (techStack.backend.runtime) {
      buildTools.push(techStack.backend.runtime.name);
    }
  }

  // Database
  if (techStack.database) {
    databases.push(techStack.database.primary.name);
    if (techStack.database.cache) {
      databases.push(techStack.database.cache.name);
    }
    if (techStack.database.search) {
      databases.push(techStack.database.search.name);
    }
  }

  // Infrastructure
  if (techStack.infrastructure) {
    if (techStack.infrastructure.hosting) {
      services.push(techStack.infrastructure.hosting.name);
    }
    if (techStack.infrastructure.ci) {
      buildTools.push(techStack.infrastructure.ci.name);
    }
    if (techStack.infrastructure.containerization) {
      buildTools.push(techStack.infrastructure.containerization.name);
    }
  }

  // Testing
  testingTools.push(techStack.testing.unit.name);
  if (techStack.testing.integration) {
    testingTools.push(techStack.testing.integration.name);
  }
  if (techStack.testing.e2e) {
    testingTools.push(techStack.testing.e2e.name);
  }

  return {
    languages,
    frameworks,
    buildTools,
    testingTools,
    databases,
    services,
  };
}

/**
 * Extract project structure from architect output
 */
function extractProjectStructure(
  output: ArchitectOutputInput
): ProjectStructure {
  const srcDirs: string[] = [];
  const testDirs: string[] = [];
  const configFiles: string[] = [];
  const keyDirectories: DirectoryInfo[] = [];

  // Process directory structure
  function processDir(
    node: { path: string; description: string; children?: unknown[] },
    prefix = ''
  ): void {
    const fullPath = prefix ? `${prefix}/${node.path}` : node.path;

    // Identify source directories
    if (['src', 'lib', 'app', 'packages'].includes(node.path)) {
      srcDirs.push(fullPath);
    }

    // Identify test directories
    if (['test', 'tests', '__tests__', 'spec'].includes(node.path)) {
      testDirs.push(fullPath);
    }

    // Add to key directories
    keyDirectories.push({
      path: fullPath,
      purpose: node.description,
      fileCount: 0,
      patterns: [],
    });

    // Recurse
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        if (typeof child === 'object' && child !== null && 'path' in child) {
          processDir(
            child as { path: string; description: string; children?: unknown[] },
            fullPath
          );
        }
      }
    }
  }

  processDir(output.directoryStructure);

  // Add common config files based on tech stack
  configFiles.push('package.json');
  if (output.techStack.frontend?.language.name === 'TypeScript' ||
      output.techStack.backend?.language.name === 'TypeScript') {
    configFiles.push('tsconfig.json');
  }
  configFiles.push('.gitignore');
  configFiles.push('CLAUDE.md');

  return {
    rootDir: '.',
    srcDirs: srcDirs.length > 0 ? srcDirs : ['src'],
    testDirs: testDirs.length > 0 ? testDirs : ['tests'],
    configFiles,
    entryPoints: ['src/index.ts', 'src/main.ts'].filter(Boolean),
    keyDirectories: keyDirectories.slice(0, 20),
  };
}

/**
 * Extract code conventions
 */
function extractCodeConventions(
  conventions: ArchitectOutputInput['codingConventions']
): CodeConventions {
  // Map indentation
  const indentation = conventions.formatting.indentation.includes('space')
    ? 'spaces'
    : 'tabs';
  const indentSize = parseInt(
    conventions.formatting.indentation.match(/\d+/)?.[0] ?? '2',
    10
  );

  // Map naming styles
  const mapNamingStyle = (style: string) => {
    const lower = style.toLowerCase();
    if (lower.includes('kebab')) return 'kebab-case' as const;
    if (lower.includes('pascal')) return 'PascalCase' as const;
    if (lower.includes('snake') && lower.includes('upper')) return 'UPPER_SNAKE_CASE' as const;
    if (lower.includes('snake')) return 'snake_case' as const;
    return 'camelCase' as const;
  };

  return {
    namingConventions: {
      files: mapNamingStyle(conventions.naming.files),
      components: conventions.naming.components.includes('Pascal')
        ? 'PascalCase'
        : 'camelCase',
      functions: conventions.naming.functions.includes('snake')
        ? 'snake_case'
        : 'camelCase',
      constants: conventions.naming.constants.includes('UPPER')
        ? 'UPPER_SNAKE_CASE'
        : 'camelCase',
    },
    formatting: {
      indentation,
      indentSize,
      maxLineLength: conventions.formatting.lineLength,
      semicolons: conventions.formatting.semicolons,
      quotes: conventions.formatting.quotes,
    },
    patterns: conventions.patterns.map((p) => p.name),
  };
}

/**
 * Infer development commands from tech stack
 */
function inferDevCommands(
  techStack: ArchitectOutputInput['techStack']
): DevCommands {
  const isNode =
    techStack.backend?.runtime?.name?.includes('Node') ||
    techStack.frontend?.framework?.name;

  if (isNode) {
    return {
      install: 'pnpm install',
      build: 'pnpm build',
      dev: 'pnpm dev',
      test: 'pnpm test',
      lint: 'pnpm lint',
      format: 'pnpm format',
      custom: {},
    };
  }

  // Default fallback
  return {
    install: 'npm install',
    build: 'npm run build',
    dev: 'npm run dev',
    test: 'npm test',
    lint: 'npm run lint',
    format: 'npm run format',
    custom: {},
  };
}

/**
 * Extract architecture summary for CLAUDE.md
 */
function extractArchitectureSummary(
  output: ArchitectOutputInput
): ArchitectureSummary {
  // Determine pattern from components
  const hasServices = output.components.some((c) => c.type === 'service');
  const hasControllers = output.components.some(
    (c) => c.name.toLowerCase().includes('controller')
  );

  let pattern = 'Modular Architecture';
  if (hasServices && hasControllers) {
    pattern = 'MVC / Layered Architecture';
  } else if (hasServices) {
    pattern = 'Service-Oriented Architecture';
  }

  // Determine API style
  const hasRestEndpoints = output.apiEndpoints?.some(
    (e) => e.method && e.path.startsWith('/')
  );
  const apiStyle = hasRestEndpoints ? 'REST API' : 'Internal APIs';

  // Key components
  const keyComponents = output.components
    .slice(0, 10)
    .map((c) => `${c.name} (${c.type}): ${c.description.slice(0, 50)}`);

  return {
    pattern,
    apiStyle,
    dataFlow: 'Request → Controller → Service → Repository → Database',
    keyComponents,
  };
}

/**
 * Generate ADR markdown files
 */
export function generateADRFiles(
  output: ArchitectOutputInput
): Array<{ path: string; content: string }> {
  return output.adrs.map((adr) => ({
    path: `docs/architecture/decisions/${adr.id}-${slugify(adr.title)}.md`,
    content: `# ${adr.id}: ${adr.title}

## Status

${adr.status}

## Context

${adr.context}

## Decision

${adr.decision}
`,
  }));
}

/**
 * Generate coding conventions markdown
 */
export function generateConventionsFile(
  output: ArchitectOutputInput
): string {
  const conv = output.codingConventions;
  const lines: string[] = [
    '# Coding Conventions',
    '',
    '## Naming Conventions',
    '',
    '| Element | Style |',
    '|---------|-------|',
    `| Files | ${conv.naming.files} |`,
    `| Directories | ${conv.naming.directories} |`,
    `| Components | ${conv.naming.components} |`,
    `| Functions | ${conv.naming.functions} |`,
    `| Variables | ${conv.naming.variables} |`,
    `| Constants | ${conv.naming.constants} |`,
    `| Types | ${conv.naming.types} |`,
    '',
    '## Formatting',
    '',
    `- **Indentation**: ${conv.formatting.indentation}`,
    `- **Line Length**: ${conv.formatting.lineLength}`,
    `- **Quotes**: ${conv.formatting.quotes}`,
    `- **Semicolons**: ${conv.formatting.semicolons ? 'Required' : 'Optional'}`,
    '',
  ];

  if (conv.patterns.length > 0) {
    lines.push('## Patterns to Follow', '');
    for (const pattern of conv.patterns) {
      lines.push(`### ${pattern.name}`, '');
      lines.push(pattern.description, '');
      lines.push('```typescript');
      lines.push(pattern.example);
      lines.push('```', '');
    }
  }

  if (conv.antiPatterns.length > 0) {
    lines.push('## Anti-Patterns to Avoid', '');
    for (const anti of conv.antiPatterns) {
      lines.push(`### ${anti.name}`, '');
      lines.push(`**Problem**: ${anti.description}`, '');
      lines.push(`**Alternative**: ${anti.alternative}`, '');
    }
  }

  return lines.join('\n');
}

/**
 * Convert string to URL-friendly slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}
