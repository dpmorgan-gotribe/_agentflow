/**
 * Context Types
 *
 * Type definitions for project context analysis and CLAUDE.md generation.
 */

import { z } from 'zod';

/**
 * Language info
 */
export interface LanguageInfo {
  name: string;
  version?: string;
  primary: boolean;
}

export const languageInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  primary: z.boolean().default(false),
});

/**
 * Framework info
 */
export type FrameworkType = 'frontend' | 'backend' | 'fullstack' | 'testing' | 'utility';

export interface FrameworkInfo {
  name: string;
  version?: string;
  type: FrameworkType;
}

export const frameworkInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  type: z.enum(['frontend', 'backend', 'fullstack', 'testing', 'utility']),
});

/**
 * Tech stack detection result
 */
export interface TechStackInfo {
  languages: LanguageInfo[];
  frameworks: FrameworkInfo[];
  buildTools: string[];
  testingTools: string[];
  databases: string[];
  services: string[];
}

export const techStackInfoSchema = z.object({
  languages: z.array(languageInfoSchema),
  frameworks: z.array(frameworkInfoSchema),
  buildTools: z.array(z.string()),
  testingTools: z.array(z.string()),
  databases: z.array(z.string()),
  services: z.array(z.string()),
});

/**
 * Directory info
 */
export interface DirectoryInfo {
  path: string;
  purpose: string;
  fileCount: number;
  patterns: string[];
}

export const directoryInfoSchema = z.object({
  path: z.string(),
  purpose: z.string(),
  fileCount: z.number().int().nonnegative(),
  patterns: z.array(z.string()),
});

/**
 * Project structure analysis
 */
export interface ProjectStructure {
  rootDir: string;
  srcDirs: string[];
  testDirs: string[];
  configFiles: string[];
  entryPoints: string[];
  keyDirectories: DirectoryInfo[];
}

export const projectStructureSchema = z.object({
  rootDir: z.string(),
  srcDirs: z.array(z.string()),
  testDirs: z.array(z.string()),
  configFiles: z.array(z.string()),
  entryPoints: z.array(z.string()),
  keyDirectories: z.array(directoryInfoSchema),
});

/**
 * Naming conventions
 */
export type NamingStyle = 'kebab-case' | 'camelCase' | 'PascalCase' | 'snake_case' | 'UPPER_SNAKE_CASE';

export interface NamingConventions {
  files: NamingStyle;
  components: 'PascalCase' | 'camelCase';
  functions: 'camelCase' | 'snake_case';
  constants: 'UPPER_SNAKE_CASE' | 'camelCase';
}

export const namingConventionsSchema = z.object({
  files: z.enum(['kebab-case', 'camelCase', 'PascalCase', 'snake_case']),
  components: z.enum(['PascalCase', 'camelCase']),
  functions: z.enum(['camelCase', 'snake_case']),
  constants: z.enum(['UPPER_SNAKE_CASE', 'camelCase']),
});

/**
 * Formatting conventions
 */
export interface FormattingConventions {
  indentation: 'tabs' | 'spaces';
  indentSize: number;
  maxLineLength: number;
  semicolons: boolean;
  quotes: 'single' | 'double';
}

export const formattingConventionsSchema = z.object({
  indentation: z.enum(['tabs', 'spaces']),
  indentSize: z.number().int().min(1).max(16),
  maxLineLength: z.number().int().min(1).max(1000),
  semicolons: z.boolean(),
  quotes: z.enum(['single', 'double']),
});

/**
 * Code conventions detected
 */
export interface CodeConventions {
  namingConventions: NamingConventions;
  formatting: FormattingConventions;
  patterns: string[];
}

export const codeConventionsSchema = z.object({
  namingConventions: namingConventionsSchema,
  formatting: formattingConventionsSchema,
  patterns: z.array(z.string()),
});

/**
 * Development commands
 */
export interface DevCommands {
  install: string;
  build: string;
  dev: string;
  test: string;
  lint: string;
  format: string;
  custom: Record<string, string>;
}

export const devCommandsSchema = z.object({
  install: z.string(),
  build: z.string(),
  dev: z.string(),
  test: z.string(),
  lint: z.string(),
  format: z.string(),
  custom: z.record(z.string()),
});

/**
 * Architecture summary
 */
export interface ArchitectureSummary {
  pattern: string;
  apiStyle: string;
  stateManagement?: string;
  dataFlow: string;
  keyComponents: string[];
}

export const architectureSummarySchema = z.object({
  pattern: z.string(),
  apiStyle: z.string(),
  stateManagement: z.string().optional(),
  dataFlow: z.string(),
  keyComponents: z.array(z.string()),
});

/**
 * Compliance info
 */
export interface ComplianceInfo {
  frameworks: string[];
  requirements: string[];
  dataHandling: string[];
}

export const complianceInfoSchema = z.object({
  frameworks: z.array(z.string()),
  requirements: z.array(z.string()),
  dataHandling: z.array(z.string()),
});

/**
 * Complete CLAUDE.md context
 */
export interface ClaudeMdContext {
  projectName: string;
  description: string;
  version: string;
  generatedAt: Date;
  techStack: TechStackInfo;
  structure: ProjectStructure;
  conventions: CodeConventions;
  commands: DevCommands;
  architecture?: ArchitectureSummary;
  compliance?: ComplianceInfo;
  additionalContext?: Record<string, unknown>;
}

/**
 * Generator options
 */
export interface GeneratorOptions {
  includeArchitecture: boolean;
  includeCompliance: boolean;
  includeApiDocs: boolean;
  customSections: string[];
  outputFormat: 'markdown' | 'yaml' | 'json';
}

export const generatorOptionsSchema = z.object({
  includeArchitecture: z.boolean().default(true),
  includeCompliance: z.boolean().default(false),
  includeApiDocs: z.boolean().default(false),
  customSections: z.array(z.string()).default([]),
  outputFormat: z.enum(['markdown', 'yaml', 'json']).default('markdown'),
});

/**
 * Analyzer limits for security
 */
export interface AnalyzerLimits {
  maxDepth: number;
  maxFiles: number;
  maxFileSize: number;
  maxTotalSize: number;
}

export const analyzerLimitsSchema = z.object({
  maxDepth: z.number().int().min(1).max(50).default(10),
  maxFiles: z.number().int().min(1).max(100000).default(10000),
  maxFileSize: z.number().int().min(1).default(10 * 1024 * 1024), // 10MB
  maxTotalSize: z.number().int().min(1).default(100 * 1024 * 1024), // 100MB
});

/**
 * Analysis result
 */
export interface AnalysisResult {
  techStack: TechStackInfo;
  structure: ProjectStructure;
  conventions: CodeConventions;
  commands: DevCommands;
}
