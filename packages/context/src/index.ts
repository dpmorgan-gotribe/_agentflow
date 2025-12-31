/**
 * @aigentflow/context
 *
 * Project context analysis and CLAUDE.md generation for Aigentflow.
 *
 * This package provides:
 * - ProjectAnalyzer: Analyzes project structure, tech stack, and conventions
 * - ClaudeMdGenerator: Generates CLAUDE.md context files for AI assistants
 * - Security-hardened file operations (path traversal prevention, secret redaction)
 *
 * @example
 * ```typescript
 * import { ProjectAnalyzer, ClaudeMdGenerator } from '@aigentflow/context';
 *
 * const analyzer = new ProjectAnalyzer({ projectRoot: '/path/to/project' });
 * const analysis = analyzer.analyze();
 *
 * const generator = new ClaudeMdGenerator();
 * const context = ClaudeMdGenerator.createContext(
 *   'MyProject',
 *   'A great project',
 *   analysis
 * );
 *
 * generator.generateAndWrite(context, 'CLAUDE.md', '/path/to/project');
 * ```
 */

// Types
export type {
  LanguageInfo,
  FrameworkInfo,
  FrameworkType,
  TechStackInfo,
  DirectoryInfo,
  ProjectStructure,
  NamingStyle,
  NamingConventions,
  FormattingConventions,
  CodeConventions,
  DevCommands,
  ArchitectureSummary,
  ComplianceInfo,
  ClaudeMdContext,
  GeneratorOptions,
  AnalyzerLimits,
  AnalysisResult,
} from './types.js';

// Schemas
export {
  languageInfoSchema,
  frameworkInfoSchema,
  techStackInfoSchema,
  directoryInfoSchema,
  projectStructureSchema,
  namingConventionsSchema,
  formattingConventionsSchema,
  codeConventionsSchema,
  devCommandsSchema,
  architectureSummarySchema,
  complianceInfoSchema,
  generatorOptionsSchema,
  analyzerLimitsSchema,
} from './types.js';

// Errors
export {
  ContextError,
  FileSystemError,
  PathValidationError,
  LimitExceededError,
  ConfigParseError,
  AnalysisError,
  GenerationError,
  isContextError,
  hasErrorCode,
} from './errors.js';

// Analyzer
export { ProjectAnalyzer, type AnalyzerOptions } from './analyzers/index.js';

// Generator
export {
  ClaudeMdGenerator,
  DEFAULT_GENERATOR_OPTIONS,
} from './generators/index.js';

// Utilities
export {
  validatePath,
  safeReadFile,
  safeReadDir,
  safeTraverse,
  safeExists,
  safeWriteFile,
  shouldIgnore,
  DEFAULT_LIMITS,
  type ValidatedPath,
  type TraversalOptions,
  type TraversalState,
} from './utils/index.js';
