/**
 * File Writer Utility
 *
 * Provides secure file writing for agents that need to output artifacts
 * directly to disk instead of returning them inline.
 *
 * SECURITY:
 * - Path validation prevents directory traversal
 * - Output is constrained to outputDir
 * - File permissions set restrictively
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/**
 * Validates that a path is safe (no traversal attacks)
 */
function isPathSafe(filePath: string, baseDir: string): boolean {
  const resolved = path.resolve(baseDir, filePath);
  const normalizedBase = path.resolve(baseDir);
  return resolved.startsWith(normalizedBase);
}

/**
 * Ensures a directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true, mode: 0o755 });
  } catch (error) {
    // Directory may already exist
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * File write result
 */
export interface FileWriteResult {
  /** Absolute path where file was written */
  absolutePath: string;
  /** Relative path from outputDir */
  relativePath: string;
  /** Size in bytes */
  size: number;
  /** Whether write was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Write a file to the output directory
 *
 * @param outputDir - Base directory for output (from AgentContext.outputDir)
 * @param relativePath - Relative path within outputDir (e.g., "designs/mockups/page.html")
 * @param content - File content to write
 * @returns Result with paths and size
 * @throws Error if path traversal detected or write fails
 */
export async function writeArtifactFile(
  outputDir: string,
  relativePath: string,
  content: string
): Promise<FileWriteResult> {
  // Validate path safety
  if (!isPathSafe(relativePath, outputDir)) {
    return {
      absolutePath: '',
      relativePath,
      size: 0,
      success: false,
      error: `Path traversal detected: ${relativePath}`,
    };
  }

  const absolutePath = path.resolve(outputDir, relativePath);
  const dir = path.dirname(absolutePath);

  try {
    // Ensure directory exists
    await ensureDir(dir);

    // Write file with restrictive permissions
    await fs.writeFile(absolutePath, content, { encoding: 'utf-8', mode: 0o644 });

    const stats = await fs.stat(absolutePath);

    return {
      absolutePath,
      relativePath,
      size: stats.size,
      success: true,
    };
  } catch (error) {
    return {
      absolutePath,
      relativePath,
      size: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Write multiple files to the output directory
 *
 * @param outputDir - Base directory for output
 * @param files - Array of { path, content } objects
 * @returns Array of results
 */
export async function writeArtifactFiles(
  outputDir: string,
  files: Array<{ path: string; content: string }>
): Promise<FileWriteResult[]> {
  const results: FileWriteResult[] = [];

  for (const file of files) {
    const result = await writeArtifactFile(outputDir, file.path, file.content);
    results.push(result);
  }

  return results;
}

/**
 * Check if outputDir is available and valid
 */
export function hasOutputDir(outputDir: string | undefined): outputDir is string {
  return typeof outputDir === 'string' && outputDir.length > 0;
}
