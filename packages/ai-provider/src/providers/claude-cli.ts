/**
 * Claude CLI Provider
 *
 * AI provider implementation that spawns the Claude CLI process.
 * DEFAULT for development (subscription-based, cost-effective).
 *
 * Security features:
 * - Input sanitization to prevent command injection
 * - Path traversal prevention for CLAUDE_MD_PATH
 * - Output buffer limits to prevent memory exhaustion
 * - Timeout enforcement
 */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  SubagentOptions,
  ProviderName,
} from '../types.js';
import {
  ProviderNames,
  AgentRoleSchema,
  AI_PROVIDER_LIMITS,
  AIProviderRequestSchema,
  SubagentOptionsSchema,
} from '../types.js';
import {
  CLIExecutionError,
  CLITimeoutError,
  AIProviderValidationError,
  InvalidRoleError,
  PathTraversalError,
} from '../errors.js';

/**
 * Claude CLI configuration
 */
export interface ClaudeCliConfig {
  cliPath: string;
  timeoutMs: number;
  maxBuffer: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ClaudeCliConfig = {
  cliPath: 'claude',
  timeoutMs: AI_PROVIDER_LIMITS.DEFAULT_TIMEOUT_MS,
  maxBuffer: AI_PROVIDER_LIMITS.MAX_OUTPUT_BUFFER,
};

/**
 * Base directory for agent CLAUDE.md files
 */
const AGENTS_BASE_DIR = '.claude/agents';

/**
 * Valid agent roles for path validation
 */
const VALID_ROLES = [
  'orchestrator',
  'architect',
  'backend',
  'frontend',
  'ui_designer',
  'reviewer',
  'tester',
  'devops',
  'security',
] as const;

/**
 * Claude CLI Provider
 *
 * Implements AIProvider interface using the Claude CLI.
 */
export class ClaudeCliProvider implements AIProvider {
  private readonly config: ClaudeCliConfig;

  constructor(config: Partial<ClaudeCliConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getName(): ProviderName {
    return ProviderNames.CLAUDE_CLI;
  }

  async complete(request: AIProviderRequest): Promise<AIProviderResponse> {
    // Validate request
    const validationResult = AIProviderRequestSchema.safeParse(request);
    if (!validationResult.success) {
      throw new AIProviderValidationError(
        'Invalid request',
        'request',
        validationResult.error.format()
      );
    }

    const prompt = this.buildPrompt(request);
    // Use a temporary file to pass the prompt to avoid Windows shell issues
    // with special characters like < > | & in the prompt content
    const tempFile = path.join(os.tmpdir(), `claude-prompt-${crypto.randomUUID()}.txt`);
    try {
      await fs.writeFile(tempFile, prompt, 'utf8');
      const result = await this.executeCliCommandWithFile(tempFile);
      return result;
    } finally {
      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {});
    }
  }

  /**
   * Spawn a subagent with role-specific context
   *
   * Uses .claude/agents/{role}/CLAUDE.md for context isolation
   */
  async spawnSubagent(
    role: string,
    task: string,
    options?: SubagentOptions
  ): Promise<AIProviderResponse> {
    // Validate role to prevent path traversal
    const roleValidation = AgentRoleSchema.safeParse(role);
    if (!roleValidation.success) {
      throw new InvalidRoleError(role, [...VALID_ROLES]);
    }

    // Validate options
    if (options) {
      const optionsValidation = SubagentOptionsSchema.safeParse(options);
      if (!optionsValidation.success) {
        throw new AIProviderValidationError(
          'Invalid subagent options',
          'options',
          optionsValidation.error.format()
        );
      }
    }

    // Validate task content (prevent injection)
    const sanitizedTask = this.sanitizeInput(task);

    const args = ['-p', sanitizedTask];

    if (options?.allowedTools?.length) {
      // Validate tool names (alphanumeric, underscores, hyphens only)
      const validatedTools = options.allowedTools.filter((tool) =>
        /^[a-zA-Z0-9_-]+$/.test(tool)
      );
      if (validatedTools.length > 0) {
        args.push('--allowedTools', validatedTools.join(','));
      }
    }

    // Build safe path to role-specific CLAUDE.md
    const claudeMdPath = this.buildSafeAgentPath(role);

    // Verify the path exists
    const pathExists = await this.pathExists(claudeMdPath);

    // Set environment with role-specific context
    const env: NodeJS.ProcessEnv = {
      ...process.env,
    };

    // Only set CLAUDE_MD_PATH if the file exists
    if (pathExists) {
      env['CLAUDE_MD_PATH'] = claudeMdPath;
    }

    return this.executeCliCommand(args, {
      env,
      timeout: options?.timeout ?? this.config.timeoutMs,
    });
  }

  /**
   * Stream completion output (for real-time display)
   */
  async *stream(request: AIProviderRequest): AsyncIterable<string> {
    // Validate request
    const validationResult = AIProviderRequestSchema.safeParse(request);
    if (!validationResult.success) {
      throw new AIProviderValidationError(
        'Invalid request',
        'request',
        validationResult.error.format()
      );
    }

    const prompt = this.buildPrompt(request);

    const claude = spawn(this.config.cliPath, ['-p', prompt], {
      env: process.env,
      shell: true, // Required on Windows to find .cmd files
    });

    // Handle errors
    claude.on('error', (error) => {
      throw new CLIExecutionError(error.message, null);
    });

    // Stream stdout
    if (claude.stdout) {
      for await (const chunk of claude.stdout) {
        yield chunk.toString();
      }
    }
  }

  /**
   * Execute CLI command reading prompt from a file
   *
   * Uses bash to pipe file content to claude -p.
   * The bash environment properly supports subscription mode.
   */
  private executeCliCommandWithFile(
    promptFilePath: string,
    options?: { env?: NodeJS.ProcessEnv; timeout?: number }
  ): Promise<AIProviderResponse> {
    const timeout = options?.timeout ?? this.config.timeoutMs;
    const env = options?.env ?? process.env;

    return new Promise((resolve, reject) => {
      // Spawn bash directly and run cat | claude -p
      // Using bash as shell (not cmd) to preserve subscription mode
      const safePath = promptFilePath.replace(/\\/g, '/');
      // Simple command - matches working test-claude.js pattern
      const bashCommand = `cat '${safePath}' | claude -p`;
      console.log(`[ClaudeCliProvider] Executing via bash: ${bashCommand}`);

      // Remove ANTHROPIC_API_KEY from env to force subscription mode
      // If the env var exists with an invalid placeholder value (like sk-ant-...)
      // Claude CLI will try API mode and fail instead of using subscription mode
      const cleanEnv = { ...env };
      if (cleanEnv['ANTHROPIC_API_KEY'] && cleanEnv['ANTHROPIC_API_KEY'].includes('...')) {
        console.log('[ClaudeCliProvider] Removing invalid placeholder ANTHROPIC_API_KEY to use subscription mode');
        delete cleanEnv['ANTHROPIC_API_KEY'];
      }

      // Set a higher output token limit to allow longer agent responses
      // Default is 64000, but UI designer can generate very long HTML/CSS
      cleanEnv['CLAUDE_CODE_MAX_OUTPUT_TOKENS'] = '200000';

      const claude = spawn('bash', ['-c', bashCommand], {
        env: cleanEnv,
        stdio: ['ignore', 'pipe', 'pipe'], // stdin ignored - prompt comes from file
        shell: false, // Don't wrap in another shell
      });

      let output = '';
      let error = '';
      let outputSize = 0;

      const timer = setTimeout(() => {
        claude.kill('SIGTERM');
        setTimeout(() => {
          claude.kill('SIGKILL');
        }, 1000);
        reject(new CLITimeoutError(timeout));
      }, timeout);

      claude.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        outputSize += data.length;

        if (outputSize > this.config.maxBuffer) {
          claude.kill('SIGTERM');
          clearTimeout(timer);
          reject(
            new CLIExecutionError(
              `Output exceeded maximum buffer size: ${this.config.maxBuffer}`,
              null
            )
          );
          return;
        }

        output += chunk;
      });

      claude.stderr?.on('data', (data: Buffer) => {
        error += data.toString();
      });

      claude.on('error', (err) => {
        clearTimeout(timer);
        reject(new CLIExecutionError(err.message, null));
      });

      claude.on('close', (code) => {
        clearTimeout(timer);
        console.log(`[ClaudeCliProvider] Process exited with code: ${code}`);
        console.log(`[ClaudeCliProvider] stdout length: ${output.length}`);
        if (output.length > 0 && output.length < 500) {
          console.log(`[ClaudeCliProvider] stdout: ${output}`);
        } else if (output.length > 0) {
          console.log(`[ClaudeCliProvider] stdout preview: ${output.slice(0, 500)}`);
        }
        if (error) {
          console.log(`[ClaudeCliProvider] stderr: ${error}`);
        }
        if (code !== 0) {
          reject(new CLIExecutionError(
            `Claude CLI exited with code ${code}`,
            code,
            this.sanitizeStderr(error)
          ));
        } else {
          // Check for known error responses from Claude CLI
          const trimmedOutput = output.trim();
          if (trimmedOutput === 'Execution error' || trimmedOutput.startsWith('Error:')) {
            reject(new CLIExecutionError(
              `Claude CLI returned an error: ${trimmedOutput}. This may indicate the prompt was too long or there was a service issue.`,
              0,
              trimmedOutput
            ));
          } else {
            resolve({ content: trimmedOutput });
          }
        }
      });
    });
  }

  /**
   * Execute CLI command with timeout and buffer limits
   *
   * Uses stdin to pass prompt to avoid:
   * - Windows command line length limits (8191 chars)
   * - Shell metacharacter interpretation issues
   */
  private executeCliCommand(
    args: string[],
    options?: { env?: NodeJS.ProcessEnv; timeout?: number; stdin?: string }
  ): Promise<AIProviderResponse> {
    const timeout = options?.timeout ?? this.config.timeoutMs;
    const env = options?.env ?? process.env;

    return new Promise((resolve, reject) => {
      // Debug logging
      console.log(`[ClaudeCliProvider] Executing: ${this.config.cliPath} ${args.join(' ')}`);
      if (options?.stdin) {
        console.log(`[ClaudeCliProvider] stdin length: ${options.stdin.length} chars`);
      }

      const claude = spawn(this.config.cliPath, args, {
        env,
        // Security: Limit child process resources
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true, // Required on Windows to find .cmd files
      });

      let output = '';
      let error = '';
      let outputSize = 0;

      const timer = setTimeout(() => {
        claude.kill('SIGTERM');
        // Give it a moment to terminate gracefully
        setTimeout(() => {
          claude.kill('SIGKILL');
        }, 1000);
        reject(new CLITimeoutError(timeout));
      }, timeout);

      claude.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        outputSize += data.length;

        // Security: Prevent memory exhaustion
        if (outputSize > this.config.maxBuffer) {
          claude.kill('SIGTERM');
          clearTimeout(timer);
          reject(
            new CLIExecutionError(
              `Output exceeded maximum buffer size: ${this.config.maxBuffer}`,
              null
            )
          );
          return;
        }

        output += chunk;
      });

      claude.stderr?.on('data', (data: Buffer) => {
        error += data.toString();
      });

      claude.on('error', (err) => {
        clearTimeout(timer);
        reject(new CLIExecutionError(err.message, null));
      });

      claude.on('close', (code) => {
        clearTimeout(timer);
        console.log(`[ClaudeCliProvider] Process exited with code: ${code}`);
        console.log(`[ClaudeCliProvider] stdout length: ${output.length}`);
        if (output.length > 0) {
          console.log(`[ClaudeCliProvider] stdout preview: ${output.slice(0, 500)}`);
        }
        if (error) {
          console.log(`[ClaudeCliProvider] stderr: ${error}`);
        }
        if (code !== 0) {
          reject(new CLIExecutionError(
            `Claude CLI exited with code ${code}`,
            code,
            this.sanitizeStderr(error)
          ));
        } else {
          resolve({ content: output.trim() });
        }
      });

      // Write stdin if provided, then close
      if (options?.stdin && claude.stdin) {
        claude.stdin.on('error', (err) => {
          console.log(`[ClaudeCliProvider] stdin error: ${err.message}`);
        });
        claude.stdin.write(options.stdin, 'utf8', (err) => {
          if (err) {
            console.log(`[ClaudeCliProvider] stdin write error: ${err.message}`);
          }
          claude.stdin?.end();
        });
      }
    });
  }

  /**
   * Build prompt from request
   *
   * Enforces MAX_PROMPT_LENGTH to prevent "Execution error" from Claude CLI.
   * If prompt is too long, truncates the user message content with a notice.
   */
  private buildPrompt(request: AIProviderRequest): string {
    let prompt = '';
    if (request.system) {
      prompt += `<system>\n${request.system}\n</system>\n\n`;
    }
    for (const msg of request.messages) {
      prompt += `<${msg.role}>\n${msg.content}\n</${msg.role}>\n\n`;
    }

    // Check if prompt exceeds limit
    const maxLength = AI_PROVIDER_LIMITS.MAX_PROMPT_LENGTH;
    if (prompt.length > maxLength) {
      console.warn(
        `[ClaudeCliProvider] Prompt too long (${prompt.length} chars), truncating to ${maxLength} chars`
      );
      // Truncate and add a notice
      const truncationNotice = '\n\n[NOTE: Content was truncated due to length limits. Focus on the most important aspects.]';
      const truncatedLength = maxLength - truncationNotice.length - 100; // Leave buffer
      prompt = prompt.slice(0, truncatedLength) + truncationNotice;
    }

    return prompt;
  }

  /**
   * Build safe path to agent CLAUDE.md file
   *
   * Prevents path traversal attacks by validating the role
   * and constructing a canonical path.
   */
  private buildSafeAgentPath(role: string): string {
    // Role is already validated by AgentRoleSchema
    // Additional safety: only allow alphanumeric and underscore
    if (!/^[a-z_]+$/.test(role)) {
      throw new PathTraversalError(role, 'Invalid role format');
    }

    const agentPath = path.join(AGENTS_BASE_DIR, role, 'CLAUDE.md');

    // Resolve to absolute path and verify it's within agents dir
    const resolved = path.resolve(agentPath);
    const baseResolved = path.resolve(AGENTS_BASE_DIR);

    if (!resolved.startsWith(baseResolved + path.sep)) {
      throw new PathTraversalError(agentPath, 'Path outside agents directory');
    }

    return agentPath;
  }

  /**
   * Check if path exists
   */
  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize input to prevent injection
   *
   * Removes or escapes potentially dangerous characters.
   */
  private sanitizeInput(input: string): string {
    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');

    // The prompt is passed as a single argument to -p,
    // so shell metacharacters are not interpreted.
    // However, we still sanitize control characters for safety.
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * Sanitize stderr to prevent sensitive info leakage
   */
  private sanitizeStderr(stderr: string): string {
    // Remove potential sensitive patterns
    return stderr
      .replace(/sk-ant-[a-zA-Z0-9]+/g, '[REDACTED_API_KEY]')
      .replace(/api[_-]?key[=:]\s*[^\s]+/gi, '[REDACTED]')
      .replace(/password[=:]\s*[^\s]+/gi, '[REDACTED]')
      .replace(/token[=:]\s*[^\s]+/gi, '[REDACTED]');
  }
}
