/**
 * Safe File System Utilities
 *
 * Security-hardened file system operations for project analysis.
 * Prevents path traversal, symlink attacks, and resource exhaustion.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PathValidationError, FileSystemError, LimitExceededError } from '../errors.js';
import type { AnalyzerLimits } from '../types.js';

/**
 * Default limits for file system operations
 */
export const DEFAULT_LIMITS: AnalyzerLimits = {
  maxDepth: 10,
  maxFiles: 10000,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxTotalSize: 100 * 1024 * 1024, // 100MB
};

/**
 * Patterns for files and directories to always ignore
 */
const IGNORE_PATTERNS = [
  /^\.git$/,
  /^node_modules$/,
  /^\.next$/,
  /^dist$/,
  /^build$/,
  /^\.turbo$/,
  /^coverage$/,
  /^\.nyc_output$/,
  /^__pycache__$/,
  /^\.pytest_cache$/,
  /^\.venv$/,
  /^venv$/,
  /^\.DS_Store$/,
  /^Thumbs\.db$/,
];

/**
 * Result of a validated path operation
 */
export interface ValidatedPath {
  /** Original path provided */
  original: string;
  /** Normalized absolute path */
  absolute: string;
  /** Path relative to project root */
  relative: string;
  /** Whether path exists */
  exists: boolean;
  /** File/directory stats if exists */
  stats?: fs.Stats;
}

/**
 * Options for directory traversal
 */
export interface TraversalOptions {
  /** Project root directory (all paths must be within) */
  projectRoot: string;
  /** Maximum depth to traverse */
  maxDepth?: number;
  /** Maximum number of files to process */
  maxFiles?: number;
  /** Custom ignore patterns (in addition to defaults) */
  ignorePatterns?: RegExp[];
  /** Whether to follow symlinks (default: false for security) */
  followSymlinks?: boolean;
}

/**
 * State for tracking traversal progress
 */
export interface TraversalState {
  /** Current file count */
  fileCount: number;
  /** Current total size in bytes */
  totalSize: number;
  /** Set of visited inodes for cycle detection */
  visitedInodes: Set<string>;
}

/**
 * Validates that a path is within the project root and is not a symlink
 *
 * @param targetPath - Path to validate
 * @param projectRoot - Root directory that must contain the path
 * @returns Validated path information
 * @throws PathValidationError if validation fails
 */
export function validatePath(
  targetPath: string,
  projectRoot: string
): ValidatedPath {
  // Ensure project root is absolute
  if (!path.isAbsolute(projectRoot)) {
    throw new PathValidationError(
      'Project root must be an absolute path',
      projectRoot,
      'absolute_required'
    );
  }

  // Normalize and resolve the target path
  const normalizedRoot = path.normalize(projectRoot);
  const absoluteTarget = path.isAbsolute(targetPath)
    ? path.normalize(targetPath)
    : path.normalize(path.join(normalizedRoot, targetPath));

  // Check if path is within project root
  const relativePath = path.relative(normalizedRoot, absoluteTarget);

  // If relative path starts with ".." or is absolute, it's outside root
  if (
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    throw new PathValidationError(
      `Path is outside project root: ${targetPath}`,
      targetPath,
      'outside_root'
    );
  }

  // Check if path exists
  let exists = false;
  let stats: fs.Stats | undefined;

  try {
    // Use lstat to not follow symlinks
    stats = fs.lstatSync(absoluteTarget);
    exists = true;

    // Check for symlinks (security risk)
    if (stats.isSymbolicLink()) {
      throw new PathValidationError(
        `Symlinks are not allowed for security: ${targetPath}`,
        targetPath,
        'symlink'
      );
    }
  } catch (error) {
    if (error instanceof PathValidationError) {
      throw error;
    }
    // Path doesn't exist, which is fine for validation
    exists = false;
  }

  return {
    original: targetPath,
    absolute: absoluteTarget,
    relative: relativePath || '.',
    exists,
    stats,
  };
}

/**
 * Safely reads a file with size limits
 *
 * @param filePath - Path to the file
 * @param projectRoot - Project root for validation
 * @param maxSize - Maximum file size in bytes
 * @returns File contents as string
 * @throws FileSystemError or LimitExceededError
 */
export function safeReadFile(
  filePath: string,
  projectRoot: string,
  maxSize: number = DEFAULT_LIMITS.maxFileSize
): string {
  const validated = validatePath(filePath, projectRoot);

  if (!validated.exists || !validated.stats) {
    throw new FileSystemError(
      `File does not exist: ${filePath}`,
      filePath,
      'read'
    );
  }

  if (!validated.stats.isFile()) {
    throw new FileSystemError(
      `Path is not a file: ${filePath}`,
      filePath,
      'read'
    );
  }

  if (validated.stats.size > maxSize) {
    throw new LimitExceededError(
      `File size exceeds limit: ${validated.stats.size} > ${maxSize}`,
      'file_size',
      maxSize,
      validated.stats.size
    );
  }

  try {
    return fs.readFileSync(validated.absolute, 'utf-8');
  } catch (error) {
    throw new FileSystemError(
      `Failed to read file: ${filePath}`,
      filePath,
      'read',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Safely reads directory contents
 *
 * @param dirPath - Path to the directory
 * @param projectRoot - Project root for validation
 * @returns Array of directory entries
 * @throws FileSystemError or PathValidationError
 */
export function safeReadDir(
  dirPath: string,
  projectRoot: string
): fs.Dirent[] {
  const validated = validatePath(dirPath, projectRoot);

  if (!validated.exists || !validated.stats) {
    throw new FileSystemError(
      `Directory does not exist: ${dirPath}`,
      dirPath,
      'readdir'
    );
  }

  if (!validated.stats.isDirectory()) {
    throw new PathValidationError(
      `Path is not a directory: ${dirPath}`,
      dirPath,
      'not_directory'
    );
  }

  try {
    return fs.readdirSync(validated.absolute, { withFileTypes: true });
  } catch (error) {
    throw new FileSystemError(
      `Failed to read directory: ${dirPath}`,
      dirPath,
      'readdir',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Checks if a file/directory name should be ignored
 *
 * @param name - File or directory name
 * @param customPatterns - Additional patterns to check
 * @returns True if should be ignored
 */
export function shouldIgnore(
  name: string,
  customPatterns: RegExp[] = []
): boolean {
  const allPatterns = [...IGNORE_PATTERNS, ...customPatterns];
  return allPatterns.some((pattern) => pattern.test(name));
}

/**
 * Creates a unique inode identifier for cycle detection
 */
function getInodeKey(stats: fs.Stats): string {
  return `${stats.dev}:${stats.ino}`;
}

/**
 * Recursively traverses a directory with safety limits
 *
 * @param options - Traversal options
 * @param callback - Function called for each file/directory
 * @returns Final traversal state
 */
export function safeTraverse(
  options: TraversalOptions,
  callback: (
    entryPath: string,
    stats: fs.Stats,
    depth: number,
    isFile: boolean
  ) => void | 'skip' | 'stop'
): TraversalState {
  const limits = {
    maxDepth: options.maxDepth ?? DEFAULT_LIMITS.maxDepth,
    maxFiles: options.maxFiles ?? DEFAULT_LIMITS.maxFiles,
  };

  const state: TraversalState = {
    fileCount: 0,
    totalSize: 0,
    visitedInodes: new Set(),
  };

  function traverse(currentPath: string, depth: number): boolean {
    if (depth > limits.maxDepth) {
      return true; // Continue but don't go deeper
    }

    let entries: fs.Dirent[];
    try {
      entries = safeReadDir(currentPath, options.projectRoot);
    } catch {
      return true; // Skip unreadable directories
    }

    for (const entry of entries) {
      if (shouldIgnore(entry.name, options.ignorePatterns)) {
        continue;
      }

      const entryPath = path.join(currentPath, entry.name);

      // Validate path is still within root
      let validated: ValidatedPath;
      try {
        validated = validatePath(entryPath, options.projectRoot);
      } catch {
        continue; // Skip invalid paths
      }

      if (!validated.exists || !validated.stats) {
        continue;
      }

      const stats = validated.stats;

      // Cycle detection using inodes
      const inodeKey = getInodeKey(stats);
      if (state.visitedInodes.has(inodeKey)) {
        continue; // Skip already visited
      }
      state.visitedInodes.add(inodeKey);

      // Check file limit
      if (state.fileCount >= limits.maxFiles) {
        throw new LimitExceededError(
          `Maximum file count exceeded: ${limits.maxFiles}`,
          'files',
          limits.maxFiles,
          state.fileCount
        );
      }

      state.fileCount++;

      const isFile = stats.isFile();
      if (isFile) {
        state.totalSize += stats.size;
      }

      // Call the callback
      const result = callback(entryPath, stats, depth, isFile);

      if (result === 'stop') {
        return false; // Stop entire traversal
      }

      if (result === 'skip') {
        continue; // Skip this subtree
      }

      // Recurse into directories
      if (stats.isDirectory()) {
        const shouldContinue = traverse(entryPath, depth + 1);
        if (!shouldContinue) {
          return false;
        }
      }
    }

    return true;
  }

  traverse(options.projectRoot, 0);
  return state;
}

/**
 * Safely checks if a file exists
 *
 * @param filePath - Path to check
 * @param projectRoot - Project root for validation
 * @returns True if file exists and is within project root
 */
export function safeExists(
  filePath: string,
  projectRoot: string
): boolean {
  try {
    const validated = validatePath(filePath, projectRoot);
    return validated.exists;
  } catch {
    return false;
  }
}

/**
 * Safely writes a file with path validation
 *
 * @param filePath - Path to write to
 * @param content - Content to write
 * @param projectRoot - Project root for validation
 * @throws FileSystemError or PathValidationError
 */
export function safeWriteFile(
  filePath: string,
  content: string,
  projectRoot: string
): void {
  const validated = validatePath(filePath, projectRoot);

  // Ensure parent directory exists
  const parentDir = path.dirname(validated.absolute);
  try {
    fs.mkdirSync(parentDir, { recursive: true });
  } catch (error) {
    throw new FileSystemError(
      `Failed to create directory: ${parentDir}`,
      parentDir,
      'write',
      error instanceof Error ? error : undefined
    );
  }

  try {
    fs.writeFileSync(validated.absolute, content, 'utf-8');
  } catch (error) {
    throw new FileSystemError(
      `Failed to write file: ${filePath}`,
      filePath,
      'write',
      error instanceof Error ? error : undefined
    );
  }
}
