/**
 * Analysis Module
 *
 * Pure functions for analyzing code and project structure.
 * No filesystem access - data is passed in from CLI layer.
 */

export {
  // Constants
  LANGUAGE_EXTENSIONS,
  FRAMEWORK_RULES,
  DIRECTORY_PURPOSE_MAP,
  DIRECTORY_IMPORTANCE,
  // Types
  type FrameworkRule,
  type FileInfo,
  type DirectoryInfo,
  type PackageDependencies,
  type PreAnalyzedData,
  // Functions
  analyzeLanguages,
  detectFrameworks,
  analyzeDirectories,
  analyzeCodeQuality,
  detectEntryPoints,
  analyzeDependencies,
  inferProjectType,
  detectPatterns,
} from './code-analyzer.js';
