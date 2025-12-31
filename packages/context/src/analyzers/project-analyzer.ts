/**
 * Project Analyzer
 *
 * Analyzes project structure, tech stack, conventions, and commands
 * for CLAUDE.md generation. Includes security hardening against
 * path traversal, symlink attacks, and resource exhaustion.
 */

import * as path from 'node:path';
import type {
  TechStackInfo,
  LanguageInfo,
  FrameworkInfo,
  ProjectStructure,
  DirectoryInfo,
  CodeConventions,
  NamingConventions,
  NamingStyle,
  FormattingConventions,
  DevCommands,
  AnalyzerLimits,
  AnalysisResult,
} from '../types.js';
import { AnalysisError, ConfigParseError } from '../errors.js';
import {
  validatePath,
  safeReadFile,
  safeTraverse,
  safeExists,
  DEFAULT_LIMITS,
} from '../utils/safe-fs.js';

/**
 * Options for project analysis
 */
export interface AnalyzerOptions {
  /** Root directory of the project */
  projectRoot: string;
  /** Resource limits for security */
  limits?: Partial<AnalyzerLimits>;
  /** Custom ignore patterns */
  ignorePatterns?: RegExp[];
}

/**
 * Language detection patterns
 */
const LANGUAGE_PATTERNS: Record<string, { extensions: string[]; configFiles: string[] }> = {
  TypeScript: {
    extensions: ['.ts', '.tsx', '.mts', '.cts'],
    configFiles: ['tsconfig.json'],
  },
  JavaScript: {
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    configFiles: ['jsconfig.json'],
  },
  Python: {
    extensions: ['.py', '.pyw'],
    configFiles: ['pyproject.toml', 'setup.py', 'requirements.txt'],
  },
  Rust: {
    extensions: ['.rs'],
    configFiles: ['Cargo.toml'],
  },
  Go: {
    extensions: ['.go'],
    configFiles: ['go.mod'],
  },
  Java: {
    extensions: ['.java'],
    configFiles: ['pom.xml', 'build.gradle'],
  },
  'C#': {
    extensions: ['.cs'],
    configFiles: ['*.csproj', '*.sln'],
  },
  PHP: {
    extensions: ['.php'],
    configFiles: ['composer.json'],
  },
  Ruby: {
    extensions: ['.rb'],
    configFiles: ['Gemfile'],
  },
};

/**
 * Framework detection patterns
 */
const FRAMEWORK_PATTERNS: Record<string, { packages: string[]; type: 'frontend' | 'backend' | 'fullstack' | 'testing' | 'utility' }> = {
  React: { packages: ['react', 'react-dom'], type: 'frontend' },
  'Next.js': { packages: ['next'], type: 'fullstack' },
  Vue: { packages: ['vue'], type: 'frontend' },
  Angular: { packages: ['@angular/core'], type: 'frontend' },
  Svelte: { packages: ['svelte'], type: 'frontend' },
  Express: { packages: ['express'], type: 'backend' },
  Fastify: { packages: ['fastify'], type: 'backend' },
  NestJS: { packages: ['@nestjs/core'], type: 'backend' },
  Hono: { packages: ['hono'], type: 'backend' },
  Koa: { packages: ['koa'], type: 'backend' },
  Django: { packages: ['django'], type: 'backend' },
  Flask: { packages: ['flask'], type: 'backend' },
  FastAPI: { packages: ['fastapi'], type: 'backend' },
  Jest: { packages: ['jest'], type: 'testing' },
  Vitest: { packages: ['vitest'], type: 'testing' },
  Mocha: { packages: ['mocha'], type: 'testing' },
  Pytest: { packages: ['pytest'], type: 'testing' },
  Cypress: { packages: ['cypress'], type: 'testing' },
  Playwright: { packages: ['playwright', '@playwright/test'], type: 'testing' },
  Expo: { packages: ['expo'], type: 'fullstack' },
  Tauri: { packages: ['@tauri-apps/api'], type: 'fullstack' },
  Electron: { packages: ['electron'], type: 'fullstack' },
};

/**
 * Build tool detection patterns
 */
const BUILD_TOOL_PATTERNS: Record<string, string[]> = {
  Turborepo: ['turbo.json'],
  Vite: ['vite.config.ts', 'vite.config.js'],
  Webpack: ['webpack.config.js', 'webpack.config.ts'],
  esbuild: ['esbuild.config.js'],
  Rollup: ['rollup.config.js', 'rollup.config.ts'],
  Parcel: ['.parcelrc'],
  SWC: ['.swcrc'],
  Babel: ['babel.config.js', '.babelrc'],
  tsc: ['tsconfig.json'],
};

/**
 * Database detection patterns
 */
const DATABASE_PATTERNS: Record<string, string[]> = {
  PostgreSQL: ['pg', 'postgres', '@prisma/client', 'drizzle-orm'],
  MySQL: ['mysql', 'mysql2'],
  MongoDB: ['mongodb', 'mongoose'],
  SQLite: ['sqlite3', 'better-sqlite3'],
  Redis: ['redis', 'ioredis'],
  Qdrant: ['@qdrant/js-client-rest'],
};

/**
 * Service detection patterns
 */
const SERVICE_PATTERNS: Record<string, string[]> = {
  Docker: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'],
  Kubernetes: ['kubernetes/', 'k8s/', 'helm/'],
  NATS: ['nats', '@nats-io/nats'],
  BullMQ: ['bullmq'],
  'AWS SDK': ['@aws-sdk/client-s3', 'aws-sdk'],
  Stripe: ['stripe'],
  Auth0: ['@auth0/auth0-spa-js'],
};

/**
 * Project Analyzer Class
 *
 * Analyzes a project directory to extract context information
 * for CLAUDE.md generation.
 */
export class ProjectAnalyzer {
  private readonly projectRoot: string;
  private readonly limits: AnalyzerLimits;
  private readonly ignorePatterns: RegExp[];

  constructor(options: AnalyzerOptions) {
    // Validate project root
    const validated = validatePath(options.projectRoot, options.projectRoot);
    if (!validated.exists || !validated.stats?.isDirectory()) {
      throw new AnalysisError(
        `Project root is not a valid directory: ${options.projectRoot}`,
        'structure'
      );
    }

    this.projectRoot = validated.absolute;
    this.limits = { ...DEFAULT_LIMITS, ...options.limits };
    this.ignorePatterns = options.ignorePatterns ?? [];
  }

  /**
   * Run full project analysis
   */
  analyze(): AnalysisResult {
    try {
      const techStack = this.detectTechStack();
      const structure = this.analyzeStructure();
      const conventions = this.detectConventions();
      const commands = this.extractCommands();

      return {
        techStack,
        structure,
        conventions,
        commands,
      };
    } catch (error) {
      if (error instanceof AnalysisError) {
        throw error;
      }
      throw new AnalysisError(
        `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'tech_stack',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Detect project tech stack
   */
  detectTechStack(): TechStackInfo {
    const languages = this.detectLanguages();
    const frameworks = this.detectFrameworks();
    const buildTools = this.detectBuildTools();
    const testingTools = this.detectTestingTools();
    const databases = this.detectDatabases();
    const services = this.detectServices();

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
   * Analyze project structure
   */
  analyzeStructure(): ProjectStructure {
    const srcDirs: string[] = [];
    const testDirs: string[] = [];
    const configFiles: string[] = [];
    const entryPoints: string[] = [];
    const keyDirectories: DirectoryInfo[] = [];

    // Known directory purposes
    const dirPurposes: Record<string, string> = {
      src: 'Source code',
      lib: 'Library code',
      app: 'Application code',
      pages: 'Page components (Next.js/Nuxt)',
      components: 'UI components',
      hooks: 'React hooks',
      utils: 'Utility functions',
      helpers: 'Helper functions',
      services: 'Service layer',
      api: 'API routes/handlers',
      routes: 'Route definitions',
      controllers: 'Request controllers',
      models: 'Data models',
      schemas: 'Schema definitions',
      types: 'Type definitions',
      interfaces: 'Interface definitions',
      config: 'Configuration files',
      scripts: 'Build/utility scripts',
      public: 'Static assets',
      assets: 'Assets (images, fonts)',
      styles: 'Stylesheets',
      tests: 'Test files',
      test: 'Test files',
      __tests__: 'Test files',
      spec: 'Spec files',
      docs: 'Documentation',
      packages: 'Monorepo packages',
      apps: 'Monorepo applications',
    };

    safeTraverse(
      {
        projectRoot: this.projectRoot,
        maxDepth: 3, // Only analyze top-level structure
        maxFiles: this.limits.maxFiles,
        ignorePatterns: this.ignorePatterns,
      },
      (entryPath, stats, depth, isFile) => {
        const relativePath = path.relative(this.projectRoot, entryPath);
        const name = path.basename(entryPath);

        if (isFile) {
          // Track config files
          if (this.isConfigFile(name)) {
            configFiles.push(relativePath);
          }

          // Track entry points
          if (this.isEntryPoint(name)) {
            entryPoints.push(relativePath);
          }
        } else if (stats.isDirectory()) {
          const lowerName = name.toLowerCase();

          // Track source directories
          if (['src', 'lib', 'app', 'source'].includes(lowerName)) {
            srcDirs.push(relativePath);
          }

          // Track test directories
          if (['test', 'tests', '__tests__', 'spec', 'specs'].includes(lowerName)) {
            testDirs.push(relativePath);
          }

          // Build key directory info
          const purpose = dirPurposes[lowerName] ?? this.inferDirectoryPurpose(name);
          if (depth <= 2 && purpose) {
            const fileCount = this.countFilesInDir(entryPath);
            const patterns = this.detectFilePatterns(entryPath);

            keyDirectories.push({
              path: relativePath,
              purpose,
              fileCount,
              patterns,
            });
          }
        }
      }
    );

    return {
      rootDir: this.projectRoot,
      srcDirs,
      testDirs,
      configFiles,
      entryPoints,
      keyDirectories,
    };
  }

  /**
   * Detect code conventions
   */
  detectConventions(): CodeConventions {
    const namingConventions = this.detectNamingConventions();
    const formatting = this.detectFormattingConventions();
    const patterns = this.detectCodePatterns();

    return {
      namingConventions,
      formatting,
      patterns,
    };
  }

  /**
   * Extract development commands
   */
  extractCommands(): DevCommands {
    const defaultCommands: DevCommands = {
      install: 'npm install',
      build: 'npm run build',
      dev: 'npm run dev',
      test: 'npm test',
      lint: 'npm run lint',
      format: 'npm run format',
      custom: {},
    };

    // Try to read package.json
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (safeExists(packageJsonPath, this.projectRoot)) {
      try {
        const content = safeReadFile(packageJsonPath, this.projectRoot);
        const packageJson = JSON.parse(content) as {
          scripts?: Record<string, string>;
          packageManager?: string;
        };

        // Detect package manager
        let pm = 'npm';
        if (safeExists(path.join(this.projectRoot, 'pnpm-lock.yaml'), this.projectRoot)) {
          pm = 'pnpm';
        } else if (safeExists(path.join(this.projectRoot, 'yarn.lock'), this.projectRoot)) {
          pm = 'yarn';
        } else if (safeExists(path.join(this.projectRoot, 'bun.lockb'), this.projectRoot)) {
          pm = 'bun';
        } else if (packageJson.packageManager?.startsWith('pnpm')) {
          pm = 'pnpm';
        } else if (packageJson.packageManager?.startsWith('yarn')) {
          pm = 'yarn';
        }

        defaultCommands.install = `${pm} install`;

        const scripts = packageJson.scripts ?? {};

        if (scripts['build']) {
          defaultCommands.build = `${pm} run build`;
        }
        if (scripts['dev']) {
          defaultCommands.dev = `${pm} run dev`;
        } else if (scripts['start']) {
          defaultCommands.dev = `${pm} run start`;
        }
        if (scripts['test']) {
          defaultCommands.test = `${pm} test`;
        }
        if (scripts['lint']) {
          defaultCommands.lint = `${pm} run lint`;
        }
        if (scripts['format']) {
          defaultCommands.format = `${pm} run format`;
        } else if (scripts['prettier']) {
          defaultCommands.format = `${pm} run prettier`;
        }

        // Capture custom scripts
        const standardScripts = ['build', 'dev', 'start', 'test', 'lint', 'format', 'prettier'];
        for (const [name, command] of Object.entries(scripts)) {
          if (!standardScripts.includes(name) && typeof command === 'string') {
            defaultCommands.custom[name] = `${pm} run ${name}`;
          }
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new ConfigParseError(
            'Failed to parse package.json',
            packageJsonPath,
            'json',
            error
          );
        }
        // Continue with defaults for other errors
      }
    }

    // Check for Python projects
    const pyprojectPath = path.join(this.projectRoot, 'pyproject.toml');
    if (safeExists(pyprojectPath, this.projectRoot)) {
      defaultCommands.install = 'pip install -e .';
      defaultCommands.build = 'python -m build';
      defaultCommands.test = 'pytest';
      defaultCommands.lint = 'ruff check .';
      defaultCommands.format = 'ruff format .';
    }

    return defaultCommands;
  }

  // Private helper methods

  private detectLanguages(): LanguageInfo[] {
    const languageCounts: Record<string, number> = {};
    const languageVersions: Record<string, string | undefined> = {};

    // Count files by extension
    safeTraverse(
      {
        projectRoot: this.projectRoot,
        maxDepth: this.limits.maxDepth,
        maxFiles: this.limits.maxFiles,
        ignorePatterns: this.ignorePatterns,
      },
      (entryPath, _stats, _depth, isFile) => {
        if (!isFile) return;

        const ext = path.extname(entryPath).toLowerCase();

        for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
          if (patterns.extensions.includes(ext)) {
            languageCounts[lang] = (languageCounts[lang] ?? 0) + 1;
          }
        }
      }
    );

    // Check for language config files to get versions
    for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
      for (const configFile of patterns.configFiles) {
        if (safeExists(path.join(this.projectRoot, configFile), this.projectRoot)) {
          languageCounts[lang] = (languageCounts[lang] ?? 0) + 1;
        }
      }
    }

    // Try to extract versions from config files
    this.extractLanguageVersions(languageVersions);

    // Build language info array
    const totalFiles = Object.values(languageCounts).reduce((a, b) => a + b, 0);
    const languages: LanguageInfo[] = [];

    for (const [name, count] of Object.entries(languageCounts)) {
      if (count > 0) {
        languages.push({
          name,
          version: languageVersions[name],
          primary: count > totalFiles * 0.3, // Primary if >30% of files
        });
      }
    }

    // Sort by count (primary languages first)
    return languages.sort((a, b) => {
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return 0;
    });
  }

  private extractLanguageVersions(versions: Record<string, string | undefined>): void {
    // TypeScript version from package.json
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (safeExists(packageJsonPath, this.projectRoot)) {
        const content = safeReadFile(packageJsonPath, this.projectRoot);
        const pkg = JSON.parse(content) as {
          devDependencies?: Record<string, string>;
          dependencies?: Record<string, string>;
          engines?: { node?: string };
        };

        if (pkg.devDependencies?.['typescript']) {
          versions['TypeScript'] = pkg.devDependencies['typescript'].replace(/[\^~]/, '');
        }
        if (pkg.engines?.node) {
          versions['JavaScript'] = `Node ${pkg.engines.node}`;
        }
      }
    } catch {
      // Ignore parsing errors
    }

    // Python version from pyproject.toml or .python-version
    const pythonVersionPath = path.join(this.projectRoot, '.python-version');
    if (safeExists(pythonVersionPath, this.projectRoot)) {
      try {
        versions['Python'] = safeReadFile(pythonVersionPath, this.projectRoot).trim();
      } catch {
        // Ignore errors
      }
    }
  }

  private detectFrameworks(): FrameworkInfo[] {
    const frameworks: FrameworkInfo[] = [];
    const detectedPackages: Set<string> = new Set();

    // Read package.json dependencies
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (safeExists(packageJsonPath, this.projectRoot)) {
        const content = safeReadFile(packageJsonPath, this.projectRoot);
        const pkg = JSON.parse(content) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };

        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        };

        for (const dep of Object.keys(allDeps)) {
          detectedPackages.add(dep);
        }
      }
    } catch {
      // Ignore parsing errors
    }

    // Match against framework patterns
    for (const [name, config] of Object.entries(FRAMEWORK_PATTERNS)) {
      const hasFramework = config.packages.some((pkg) => detectedPackages.has(pkg));
      if (hasFramework) {
        frameworks.push({
          name,
          type: config.type,
        });
      }
    }

    return frameworks;
  }

  private detectBuildTools(): string[] {
    const buildTools: string[] = [];

    for (const [tool, files] of Object.entries(BUILD_TOOL_PATTERNS)) {
      for (const file of files) {
        if (file.includes('*')) {
          // Skip glob patterns for now
          continue;
        }
        if (safeExists(path.join(this.projectRoot, file), this.projectRoot)) {
          buildTools.push(tool);
          break;
        }
      }
    }

    return buildTools;
  }

  private detectTestingTools(): string[] {
    const testingTools: string[] = [];
    const frameworks = this.detectFrameworks();

    for (const fw of frameworks) {
      if (fw.type === 'testing') {
        testingTools.push(fw.name);
      }
    }

    return testingTools;
  }

  private detectDatabases(): string[] {
    const databases: string[] = [];
    const detectedPackages: Set<string> = new Set();

    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (safeExists(packageJsonPath, this.projectRoot)) {
        const content = safeReadFile(packageJsonPath, this.projectRoot);
        const pkg = JSON.parse(content) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };

        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        };

        for (const dep of Object.keys(allDeps)) {
          detectedPackages.add(dep);
        }
      }
    } catch {
      // Ignore errors
    }

    for (const [db, packages] of Object.entries(DATABASE_PATTERNS)) {
      const hasDb = packages.some((pkg) => detectedPackages.has(pkg));
      if (hasDb) {
        databases.push(db);
      }
    }

    return databases;
  }

  private detectServices(): string[] {
    const services: string[] = [];

    for (const [service, patterns] of Object.entries(SERVICE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.endsWith('/')) {
          // Directory pattern
          if (safeExists(path.join(this.projectRoot, pattern.slice(0, -1)), this.projectRoot)) {
            services.push(service);
            break;
          }
        } else if (safeExists(path.join(this.projectRoot, pattern), this.projectRoot)) {
          services.push(service);
          break;
        }
      }
    }

    // Also check package.json dependencies for service packages
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (safeExists(packageJsonPath, this.projectRoot)) {
        const content = safeReadFile(packageJsonPath, this.projectRoot);
        const pkg = JSON.parse(content) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };

        const allDeps = new Set([
          ...Object.keys(pkg.dependencies ?? {}),
          ...Object.keys(pkg.devDependencies ?? {}),
        ]);

        for (const [service, patterns] of Object.entries(SERVICE_PATTERNS)) {
          if (services.includes(service)) continue;

          for (const pattern of patterns) {
            if (allDeps.has(pattern)) {
              services.push(service);
              break;
            }
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return services;
  }

  private isConfigFile(name: string): boolean {
    const configPatterns = [
      /^tsconfig.*\.json$/,
      /^\.?eslint.*$/,
      /^\.?prettier.*$/,
      /^package\.json$/,
      /^\.env.*$/,
      /^\.gitignore$/,
      /^\.?babel.*$/,
      /^vite\.config\.[jt]s$/,
      /^next\.config\.[jt]s$/,
      /^turbo\.json$/,
      /^pnpm-workspace\.yaml$/,
      /^docker-compose.*\.ya?ml$/,
      /^Dockerfile$/,
      /^Makefile$/,
    ];

    return configPatterns.some((p) => p.test(name));
  }

  private isEntryPoint(name: string): boolean {
    const entryPatterns = [
      /^index\.[jt]sx?$/,
      /^main\.[jt]sx?$/,
      /^app\.[jt]sx?$/,
      /^server\.[jt]sx?$/,
      /^cli\.[jt]sx?$/,
    ];

    return entryPatterns.some((p) => p.test(name));
  }

  private inferDirectoryPurpose(name: string): string {
    const lower = name.toLowerCase();

    if (lower.includes('component')) return 'Components';
    if (lower.includes('util')) return 'Utilities';
    if (lower.includes('helper')) return 'Helpers';
    if (lower.includes('service')) return 'Services';
    if (lower.includes('model')) return 'Models';
    if (lower.includes('type')) return 'Types';
    if (lower.includes('hook')) return 'Hooks';
    if (lower.includes('store')) return 'State store';
    if (lower.includes('context')) return 'Context providers';
    if (lower.includes('style')) return 'Styles';
    if (lower.includes('asset')) return 'Assets';
    if (lower.includes('public')) return 'Public assets';
    if (lower.includes('static')) return 'Static files';
    if (lower.includes('config')) return 'Configuration';
    if (lower.includes('route')) return 'Routes';
    if (lower.includes('api')) return 'API';
    if (lower.includes('lib')) return 'Library code';
    if (lower.includes('vendor')) return 'Third-party code';
    if (lower.includes('plugin')) return 'Plugins';
    if (lower.includes('middleware')) return 'Middleware';

    return '';
  }

  private countFilesInDir(dirPath: string): number {
    let count = 0;

    try {
      safeTraverse(
        {
          projectRoot: this.projectRoot,
          maxDepth: 3,
          maxFiles: 1000,
          ignorePatterns: this.ignorePatterns,
        },
        (entryPath, _stats, _depth, isFile) => {
          if (!entryPath.startsWith(dirPath)) return 'skip';
          if (isFile) count++;
        }
      );
    } catch {
      // Return current count on error
    }

    return count;
  }

  private detectFilePatterns(dirPath: string): string[] {
    const extensions: Set<string> = new Set();
    const prefixes: Set<string> = new Set();
    const suffixes: Set<string> = new Set();

    try {
      safeTraverse(
        {
          projectRoot: this.projectRoot,
          maxDepth: 2,
          maxFiles: 100,
          ignorePatterns: this.ignorePatterns,
        },
        (entryPath, _stats, _depth, isFile) => {
          if (!entryPath.startsWith(dirPath)) return 'skip';
          if (!isFile) return;

          const name = path.basename(entryPath);
          const ext = path.extname(name);

          if (ext) extensions.add(`*${ext}`);

          // Detect common patterns
          if (name.endsWith('.test.ts') || name.endsWith('.test.js')) {
            suffixes.add('*.test.*');
          }
          if (name.endsWith('.spec.ts') || name.endsWith('.spec.js')) {
            suffixes.add('*.spec.*');
          }
          if (name.startsWith('use') && ext === '.ts') {
            prefixes.add('use*.ts');
          }
          if (name.match(/^[A-Z]/)) {
            prefixes.add('PascalCase files');
          }
        }
      );
    } catch {
      // Return current patterns on error
    }

    return [...extensions, ...prefixes, ...suffixes];
  }

  private detectNamingConventions(): NamingConventions {
    const fileCases: Record<NamingStyle, number> = {
      'kebab-case': 0,
      camelCase: 0,
      PascalCase: 0,
      snake_case: 0,
      UPPER_SNAKE_CASE: 0,
    };

    safeTraverse(
      {
        projectRoot: this.projectRoot,
        maxDepth: 5,
        maxFiles: 500,
        ignorePatterns: this.ignorePatterns,
      },
      (entryPath, _stats, _depth, isFile) => {
        if (!isFile) return;

        const name = path.basename(entryPath, path.extname(entryPath));

        if (name.includes('-') && name === name.toLowerCase()) {
          fileCases['kebab-case']++;
        } else if (name.includes('_') && name === name.toUpperCase()) {
          fileCases['UPPER_SNAKE_CASE']++;
        } else if (name.includes('_')) {
          fileCases['snake_case']++;
        } else if (name.length > 0 && name[0]?.toUpperCase() === name[0] && name.length > 1) {
          fileCases['PascalCase']++;
        } else if (name.length > 0 && name[0]?.toLowerCase() === name[0] && name !== name.toLowerCase()) {
          fileCases['camelCase']++;
        }
      }
    );

    // Find dominant file naming style
    let maxCount = 0;
    let fileStyle: NamingStyle = 'kebab-case';
    for (const [style, count] of Object.entries(fileCases)) {
      if (count > maxCount) {
        maxCount = count;
        fileStyle = style as NamingStyle;
      }
    }

    return {
      files: fileStyle,
      components: 'PascalCase', // Standard convention
      functions: 'camelCase', // Standard convention
      constants: 'UPPER_SNAKE_CASE', // Standard convention
    };
  }

  private detectFormattingConventions(): FormattingConventions {
    // Defaults
    const formatting: FormattingConventions = {
      indentation: 'spaces',
      indentSize: 2,
      maxLineLength: 100,
      semicolons: true,
      quotes: 'single',
    };

    // Try to detect from .editorconfig
    const editorConfigPath = path.join(this.projectRoot, '.editorconfig');
    if (safeExists(editorConfigPath, this.projectRoot)) {
      try {
        const content = safeReadFile(editorConfigPath, this.projectRoot);

        if (content.includes('indent_style = tab')) {
          formatting.indentation = 'tabs';
        }

        const indentSizeMatch = content.match(/indent_size\s*=\s*(\d+)/);
        if (indentSizeMatch?.[1]) {
          formatting.indentSize = parseInt(indentSizeMatch[1], 10);
        }

        const maxLineLengthMatch = content.match(/max_line_length\s*=\s*(\d+)/);
        if (maxLineLengthMatch?.[1]) {
          formatting.maxLineLength = parseInt(maxLineLengthMatch[1], 10);
        }
      } catch {
        // Use defaults
      }
    }

    // Try to detect from prettier config
    const prettierRcPath = path.join(this.projectRoot, '.prettierrc');
    const prettierJsonPath = path.join(this.projectRoot, '.prettierrc.json');
    const prettierConfigPath = safeExists(prettierRcPath, this.projectRoot)
      ? prettierRcPath
      : safeExists(prettierJsonPath, this.projectRoot)
        ? prettierJsonPath
        : null;

    if (prettierConfigPath) {
      try {
        const content = safeReadFile(prettierConfigPath, this.projectRoot);
        const config = JSON.parse(content) as {
          useTabs?: boolean;
          tabWidth?: number;
          printWidth?: number;
          semi?: boolean;
          singleQuote?: boolean;
        };

        if (config.useTabs !== undefined) {
          formatting.indentation = config.useTabs ? 'tabs' : 'spaces';
        }
        if (config.tabWidth !== undefined) {
          formatting.indentSize = config.tabWidth;
        }
        if (config.printWidth !== undefined) {
          formatting.maxLineLength = config.printWidth;
        }
        if (config.semi !== undefined) {
          formatting.semicolons = config.semi;
        }
        if (config.singleQuote !== undefined) {
          formatting.quotes = config.singleQuote ? 'single' : 'double';
        }
      } catch {
        // Use defaults
      }
    }

    return formatting;
  }

  private detectCodePatterns(): string[] {
    const patterns: string[] = [];

    // Detect monorepo
    if (
      safeExists(path.join(this.projectRoot, 'pnpm-workspace.yaml'), this.projectRoot) ||
      safeExists(path.join(this.projectRoot, 'lerna.json'), this.projectRoot) ||
      safeExists(path.join(this.projectRoot, 'turbo.json'), this.projectRoot)
    ) {
      patterns.push('Monorepo');
    }

    // Detect TypeScript strict mode
    const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
    if (safeExists(tsconfigPath, this.projectRoot)) {
      try {
        const content = safeReadFile(tsconfigPath, this.projectRoot);
        const config = JSON.parse(content) as {
          compilerOptions?: { strict?: boolean };
        };

        if (config.compilerOptions?.strict) {
          patterns.push('TypeScript strict mode');
        }
      } catch {
        // Ignore errors
      }
    }

    // Detect ESLint
    if (
      safeExists(path.join(this.projectRoot, '.eslintrc.json'), this.projectRoot) ||
      safeExists(path.join(this.projectRoot, '.eslintrc.js'), this.projectRoot) ||
      safeExists(path.join(this.projectRoot, 'eslint.config.js'), this.projectRoot)
    ) {
      patterns.push('ESLint');
    }

    // Detect Prettier
    if (
      safeExists(path.join(this.projectRoot, '.prettierrc'), this.projectRoot) ||
      safeExists(path.join(this.projectRoot, '.prettierrc.json'), this.projectRoot)
    ) {
      patterns.push('Prettier');
    }

    // Detect Husky/lint-staged
    if (safeExists(path.join(this.projectRoot, '.husky'), this.projectRoot)) {
      patterns.push('Husky git hooks');
    }

    // Detect CI/CD
    if (
      safeExists(path.join(this.projectRoot, '.github', 'workflows'), this.projectRoot)
    ) {
      patterns.push('GitHub Actions');
    }
    if (safeExists(path.join(this.projectRoot, '.gitlab-ci.yml'), this.projectRoot)) {
      patterns.push('GitLab CI');
    }

    return patterns;
  }
}
