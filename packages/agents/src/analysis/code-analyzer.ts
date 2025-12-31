/**
 * Code Analyzer Utilities
 *
 * Pure functions for analyzing code and project structure.
 * These utilities work with data passed to them - no filesystem access.
 * The CLI layer handles filesystem reading and passes data here.
 *
 * SECURITY:
 * - Path validation for all file paths
 * - No filesystem access (pure functions)
 * - Content size limits
 */

import type {
  DetectedLanguage,
  DetectedFramework,
  FrameworkType,
  DirectoryAnalysis,
  Importance,
  DetectedPattern,
  PatternCategory,
  CodeQuality,
  CodeQualityIssue,
  ComplianceIndicators,
  EntryPoint,
  EntryPointType,
  DependencyAnalysis,
  ProjectType,
} from '../schemas/project-analyzer-output.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Language detection by file extension
 */
export const LANGUAGE_EXTENSIONS: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.c': 'C',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.scala': 'Scala',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
};

/**
 * Framework detection rules
 */
export interface FrameworkRule {
  name: string;
  type: FrameworkType;
  packageIndicators: string[];
  fileIndicators: string[];
  codeIndicators: string[];
}

export const FRAMEWORK_RULES: FrameworkRule[] = [
  {
    name: 'React',
    type: 'frontend',
    packageIndicators: ['react', 'react-dom'],
    fileIndicators: [],
    codeIndicators: ['jsx', 'tsx', 'useState', 'useEffect'],
  },
  {
    name: 'Vue',
    type: 'frontend',
    packageIndicators: ['vue'],
    fileIndicators: ['.vue'],
    codeIndicators: ['defineComponent', 'createApp'],
  },
  {
    name: 'Angular',
    type: 'frontend',
    packageIndicators: ['@angular/core'],
    fileIndicators: ['angular.json'],
    codeIndicators: ['@Component', '@NgModule'],
  },
  {
    name: 'Svelte',
    type: 'frontend',
    packageIndicators: ['svelte'],
    fileIndicators: ['.svelte', 'svelte.config.js'],
    codeIndicators: [],
  },
  {
    name: 'Next.js',
    type: 'fullstack',
    packageIndicators: ['next'],
    fileIndicators: ['next.config.js', 'next.config.mjs'],
    codeIndicators: ['getServerSideProps', 'getStaticProps'],
  },
  {
    name: 'Nuxt',
    type: 'fullstack',
    packageIndicators: ['nuxt'],
    fileIndicators: ['nuxt.config.js', 'nuxt.config.ts'],
    codeIndicators: [],
  },
  {
    name: 'Express',
    type: 'backend',
    packageIndicators: ['express'],
    fileIndicators: [],
    codeIndicators: ['express()', 'app.get', 'app.post', 'app.use'],
  },
  {
    name: 'Fastify',
    type: 'backend',
    packageIndicators: ['fastify'],
    fileIndicators: [],
    codeIndicators: ['fastify()', 'fastify.get'],
  },
  {
    name: 'NestJS',
    type: 'backend',
    packageIndicators: ['@nestjs/core', '@nestjs/common'],
    fileIndicators: ['nest-cli.json'],
    codeIndicators: ['@Controller', '@Injectable', '@Module'],
  },
  {
    name: 'Hono',
    type: 'backend',
    packageIndicators: ['hono'],
    fileIndicators: [],
    codeIndicators: ['new Hono()', 'Hono()'],
  },
  {
    name: 'FastAPI',
    type: 'backend',
    packageIndicators: ['fastapi'],
    fileIndicators: [],
    codeIndicators: ['FastAPI()', '@app.get', '@app.post'],
  },
  {
    name: 'Django',
    type: 'backend',
    packageIndicators: ['django'],
    fileIndicators: ['manage.py', 'settings.py'],
    codeIndicators: ['from django'],
  },
  {
    name: 'Flask',
    type: 'backend',
    packageIndicators: ['flask'],
    fileIndicators: [],
    codeIndicators: ['Flask(__name__)', '@app.route'],
  },
  {
    name: 'Jest',
    type: 'testing',
    packageIndicators: ['jest'],
    fileIndicators: ['jest.config.js', 'jest.config.ts'],
    codeIndicators: ['describe(', 'it(', 'expect('],
  },
  {
    name: 'Vitest',
    type: 'testing',
    packageIndicators: ['vitest'],
    fileIndicators: ['vitest.config.ts', 'vitest.config.js'],
    codeIndicators: [],
  },
  {
    name: 'Pytest',
    type: 'testing',
    packageIndicators: ['pytest'],
    fileIndicators: ['pytest.ini', 'conftest.py'],
    codeIndicators: ['def test_', '@pytest'],
  },
  {
    name: 'Vite',
    type: 'build',
    packageIndicators: ['vite'],
    fileIndicators: ['vite.config.ts', 'vite.config.js'],
    codeIndicators: [],
  },
  {
    name: 'Webpack',
    type: 'build',
    packageIndicators: ['webpack'],
    fileIndicators: ['webpack.config.js'],
    codeIndicators: [],
  },
  {
    name: 'Tailwind CSS',
    type: 'utility',
    packageIndicators: ['tailwindcss'],
    fileIndicators: ['tailwind.config.js', 'tailwind.config.ts'],
    codeIndicators: [],
  },
];

/**
 * Directory purpose mapping
 */
export const DIRECTORY_PURPOSE_MAP: Record<string, string> = {
  src: 'Source code',
  lib: 'Library code',
  app: 'Application code',
  pages: 'Page components',
  components: 'UI components',
  hooks: 'Custom hooks',
  utils: 'Utility functions',
  helpers: 'Helper functions',
  services: 'Service layer',
  api: 'API routes',
  routes: 'Route handlers',
  models: 'Data models',
  entities: 'Database entities',
  types: 'Type definitions',
  interfaces: 'Interface definitions',
  styles: 'Stylesheets',
  css: 'CSS files',
  public: 'Static assets',
  static: 'Static files',
  assets: 'Asset files',
  images: 'Image files',
  config: 'Configuration',
  scripts: 'Build/utility scripts',
  docs: 'Documentation',
  tests: 'Test files',
  test: 'Test files',
  __tests__: 'Test files',
  spec: 'Test specifications',
  fixtures: 'Test fixtures',
  mocks: 'Mock data',
  middleware: 'Middleware handlers',
  controllers: 'Controller layer',
  repositories: 'Data access layer',
  domain: 'Domain logic',
  core: 'Core functionality',
  shared: 'Shared code',
  common: 'Common utilities',
};

/**
 * Directory importance by name
 */
export const DIRECTORY_IMPORTANCE: Record<string, Importance> = {
  src: 'critical',
  app: 'critical',
  lib: 'critical',
  core: 'critical',
  api: 'high',
  pages: 'high',
  components: 'high',
  services: 'high',
  controllers: 'high',
  domain: 'high',
  utils: 'medium',
  helpers: 'medium',
  hooks: 'medium',
  types: 'medium',
  models: 'medium',
  config: 'medium',
  tests: 'medium',
  docs: 'low',
  assets: 'low',
  public: 'low',
  scripts: 'low',
};

// ============================================================================
// Types for Input Data
// ============================================================================

/**
 * File info passed from filesystem layer
 */
export interface FileInfo {
  path: string;
  extension: string;
  lineCount: number;
  size: number;
}

/**
 * Directory info passed from filesystem layer
 */
export interface DirectoryInfo {
  name: string;
  path: string;
  fileCount: number;
  files: FileInfo[];
}

/**
 * Package.json dependencies
 */
export interface PackageDependencies {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

/**
 * Pre-analyzed data passed to the agent
 */
export interface PreAnalyzedData {
  projectName: string;
  files: FileInfo[];
  directories: DirectoryInfo[];
  packageDeps?: PackageDependencies;
  configFiles: string[];
  hasTests: boolean;
  hasLinting: boolean;
  hasTypeChecking: boolean;
  hasDocumentation: boolean;
  hasCI: boolean;
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Analyze languages from file info
 */
export function analyzeLanguages(files: FileInfo[]): DetectedLanguage[] {
  const languageStats = new Map<string, { files: number; lines: number }>();
  let totalLines = 0;

  for (const file of files) {
    const language = LANGUAGE_EXTENSIONS[file.extension];
    if (!language) continue;

    totalLines += file.lineCount;

    const stats = languageStats.get(language) || { files: 0, lines: 0 };
    stats.files++;
    stats.lines += file.lineCount;
    languageStats.set(language, stats);
  }

  // Convert to array and calculate percentages
  const languages: DetectedLanguage[] = [];
  let maxLines = 0;
  let primaryLanguage = '';

  for (const [name, stats] of languageStats) {
    const percentage = totalLines > 0 ? (stats.lines / totalLines) * 100 : 0;

    if (stats.lines > maxLines) {
      maxLines = stats.lines;
      primaryLanguage = name;
    }

    languages.push({
      name,
      percentage: Math.round(percentage * 10) / 10,
      files: stats.files,
      lines: stats.lines,
      primary: false,
    });
  }

  // Mark primary language
  const primary = languages.find((l) => l.name === primaryLanguage);
  if (primary) primary.primary = true;

  return languages.sort((a, b) => b.percentage - a.percentage);
}

/**
 * Detect frameworks from package dependencies and file presence
 */
export function detectFrameworks(
  packageDeps: PackageDependencies | undefined,
  configFiles: string[],
  fileExtensions: Set<string>
): DetectedFramework[] {
  const frameworks: DetectedFramework[] = [];
  const allDeps = packageDeps
    ? { ...packageDeps.dependencies, ...packageDeps.devDependencies }
    : {};

  for (const rule of FRAMEWORK_RULES) {
    const evidence: string[] = [];
    let confidence = 0;

    // Check package dependencies
    for (const pkg of rule.packageIndicators) {
      if (allDeps[pkg]) {
        evidence.push(`Found in package.json: ${pkg}@${allDeps[pkg]}`);
        confidence += 0.5;
      }
    }

    // Check file indicators
    for (const fileIndicator of rule.fileIndicators) {
      if (fileIndicator.startsWith('.')) {
        // Extension check
        if (fileExtensions.has(fileIndicator)) {
          evidence.push(`Found file extension: ${fileIndicator}`);
          confidence += 0.3;
        }
      } else {
        // Config file check
        if (configFiles.some((f) => f.includes(fileIndicator))) {
          evidence.push(`Found config file: ${fileIndicator}`);
          confidence += 0.4;
        }
      }
    }

    if (evidence.length > 0) {
      const version = rule.packageIndicators
        .map((pkg) => allDeps[pkg])
        .find((v) => v);

      frameworks.push({
        name: rule.name,
        type: rule.type,
        confidence: Math.min(confidence, 1),
        evidence,
        version: version?.replace(/[\^~]/g, ''),
      });
    }
  }

  return frameworks.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Analyze directory structure
 */
export function analyzeDirectories(
  directories: DirectoryInfo[]
): DirectoryAnalysis[] {
  return directories.map((dir) => {
    const name = dir.name.toLowerCase();
    const patterns: Set<string> = new Set();
    const technologies: Set<string> = new Set();

    for (const file of dir.files) {
      const basename = file.path.split('/').pop() || '';
      const ext = file.extension;

      // Detect patterns from file names
      if (basename.includes('.test') || basename.includes('.spec')) {
        patterns.add('tests');
      }
      if (basename.includes('.stories')) {
        patterns.add('storybook');
      }
      if (basename.includes('component')) {
        patterns.add('components');
      }
      if (basename.includes('hook') || basename.startsWith('use')) {
        patterns.add('hooks');
      }
      if (basename.includes('service')) {
        patterns.add('services');
      }
      if (basename.includes('util')) {
        patterns.add('utilities');
      }

      // Detect technologies
      const language = LANGUAGE_EXTENSIONS[ext];
      if (language) {
        technologies.add(language);
      }
    }

    return {
      path: dir.path,
      purpose: DIRECTORY_PURPOSE_MAP[name] || 'Project files',
      fileCount: dir.fileCount,
      patterns: Array.from(patterns),
      technologies: Array.from(technologies),
      importance: DIRECTORY_IMPORTANCE[name] || 'low',
    };
  });
}

/**
 * Analyze code quality from pre-analyzed data
 */
export function analyzeCodeQuality(data: PreAnalyzedData): CodeQuality {
  const issues: CodeQualityIssue[] = [];

  if (!data.hasTests) {
    issues.push({
      type: 'warning',
      message: 'No test directory found. Consider adding tests.',
    });
  }

  if (!data.hasLinting) {
    issues.push({
      type: 'suggestion',
      message: 'No ESLint configuration found. Consider adding linting.',
    });
  }

  if (!data.hasTypeChecking) {
    issues.push({
      type: 'suggestion',
      message: 'No TypeScript configuration found. Consider adding type checking.',
    });
  }

  if (!data.hasCI) {
    issues.push({
      type: 'suggestion',
      message: 'No CI/CD configuration found. Consider adding automated builds.',
    });
  }

  if (!data.hasDocumentation) {
    issues.push({
      type: 'suggestion',
      message: 'No README found. Consider adding documentation.',
    });
  }

  return {
    hasTests: data.hasTests,
    hasLinting: data.hasLinting,
    hasTypeChecking: data.hasTypeChecking,
    hasDocumentation: data.hasDocumentation,
    hasCI: data.hasCI,
    hasSecurity: false, // Would need deeper analysis
    issues,
  };
}

/**
 * Detect entry points from file structure
 */
export function detectEntryPoints(files: FileInfo[]): EntryPoint[] {
  const entryPoints: EntryPoint[] = [];
  const entryPointPatterns: Array<{
    pattern: RegExp;
    type: EntryPointType;
    description: string;
  }> = [
    { pattern: /^src\/index\.(ts|js)$/, type: 'library', description: 'Library entry point' },
    { pattern: /^src\/main\.(ts|js)$/, type: 'application', description: 'Main application entry' },
    { pattern: /^src\/app\.(ts|js)$/, type: 'application', description: 'App entry point' },
    { pattern: /^index\.(ts|js)$/, type: 'library', description: 'Root entry point' },
    { pattern: /^cli\.(ts|js)$/, type: 'cli', description: 'CLI entry point' },
    { pattern: /^src\/cli\.(ts|js)$/, type: 'cli', description: 'CLI entry point' },
    { pattern: /^bin\//, type: 'cli', description: 'CLI binary' },
    { pattern: /^server\.(ts|js)$/, type: 'api', description: 'Server entry point' },
    { pattern: /^src\/server\.(ts|js)$/, type: 'api', description: 'Server entry point' },
    { pattern: /^worker\.(ts|js)$/, type: 'worker', description: 'Worker entry point' },
  ];

  for (const file of files) {
    for (const { pattern, type, description } of entryPointPatterns) {
      if (pattern.test(file.path)) {
        entryPoints.push({
          path: file.path,
          type,
          description,
        });
        break;
      }
    }
  }

  return entryPoints;
}

/**
 * Analyze dependencies
 */
export function analyzeDependencies(
  packageDeps: PackageDependencies | undefined
): DependencyAnalysis {
  if (!packageDeps) {
    return {
      total: 0,
      production: 0,
      development: 0,
      outdated: [],
      vulnerabilities: [],
    };
  }

  const prodCount = Object.keys(packageDeps.dependencies || {}).length;
  const devCount = Object.keys(packageDeps.devDependencies || {}).length;

  return {
    total: prodCount + devCount,
    production: prodCount,
    development: devCount,
    outdated: [], // Would require npm outdated check
    vulnerabilities: [], // Would require npm audit check
  };
}

/**
 * Infer project type from tech stack
 */
export function inferProjectType(
  frameworks: DetectedFramework[],
  files: FileInfo[],
  configFiles: string[]
): ProjectType {
  // Check for monorepo indicators
  if (
    configFiles.some(
      (f) =>
        f.includes('pnpm-workspace') ||
        f.includes('lerna.json') ||
        f.includes('turbo.json')
    )
  ) {
    return 'monorepo';
  }

  // Check frameworks
  const frontendFrameworks = frameworks.filter((f) => f.type === 'frontend');
  const backendFrameworks = frameworks.filter((f) => f.type === 'backend');
  const fullstackFrameworks = frameworks.filter((f) => f.type === 'fullstack');

  if (fullstackFrameworks.length > 0) {
    return 'web-app';
  }

  if (frontendFrameworks.length > 0 && backendFrameworks.length === 0) {
    return 'web-app';
  }

  if (backendFrameworks.length > 0 && frontendFrameworks.length === 0) {
    return 'api';
  }

  if (frontendFrameworks.length > 0 && backendFrameworks.length > 0) {
    return 'web-app';
  }

  // Check for CLI indicators
  if (files.some((f) => f.path.includes('bin/') || f.path.includes('cli'))) {
    return 'cli';
  }

  // Check for library indicators
  if (configFiles.some((f) => f.includes('tsup') || f.includes('rollup'))) {
    return 'library';
  }

  return 'unknown';
}

/**
 * Detect architectural patterns
 */
export function detectPatterns(
  directories: DirectoryInfo[],
  files: FileInfo[]
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const dirNames = new Set(directories.map((d) => d.name.toLowerCase()));

  // MVC pattern
  if (
    dirNames.has('controllers') &&
    (dirNames.has('models') || dirNames.has('entities')) &&
    dirNames.has('views')
  ) {
    patterns.push({
      name: 'MVC',
      category: 'architecture',
      description: 'Model-View-Controller architecture pattern',
      locations: ['controllers/', 'models/', 'views/'],
      confidence: 0.9,
    });
  }

  // Clean/Hexagonal architecture
  if (
    dirNames.has('domain') &&
    (dirNames.has('infrastructure') || dirNames.has('adapters'))
  ) {
    patterns.push({
      name: 'Clean Architecture',
      category: 'architecture',
      description: 'Domain-driven design with separated concerns',
      locations: ['domain/', 'infrastructure/'],
      confidence: 0.85,
    });
  }

  // Repository pattern
  if (dirNames.has('repositories')) {
    patterns.push({
      name: 'Repository Pattern',
      category: 'data',
      description: 'Data access abstraction layer',
      locations: ['repositories/'],
      confidence: 0.9,
    });
  }

  // Service layer
  if (dirNames.has('services')) {
    patterns.push({
      name: 'Service Layer',
      category: 'architecture',
      description: 'Business logic encapsulation in services',
      locations: ['services/'],
      confidence: 0.85,
    });
  }

  // Component-based (React/Vue/Angular)
  if (dirNames.has('components')) {
    patterns.push({
      name: 'Component-Based',
      category: 'design',
      description: 'UI built with reusable components',
      locations: ['components/'],
      confidence: 0.9,
    });
  }

  // Hooks pattern (React)
  if (dirNames.has('hooks')) {
    patterns.push({
      name: 'Custom Hooks',
      category: 'state',
      description: 'Reusable stateful logic with hooks',
      locations: ['hooks/'],
      confidence: 0.9,
    });
  }

  // API routes
  if (dirNames.has('api') || dirNames.has('routes')) {
    patterns.push({
      name: 'API Routes',
      category: 'api',
      description: 'RESTful or file-based API routing',
      locations: ['api/', 'routes/'],
      confidence: 0.85,
    });
  }

  return patterns;
}
