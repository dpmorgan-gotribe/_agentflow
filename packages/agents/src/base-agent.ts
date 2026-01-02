/**
 * BaseAgent - Abstract base class for all agents
 *
 * All specialized agents inherit from this class and implement
 * the abstract methods for their specific behavior.
 *
 * Security Features:
 * - Tenant isolation via context validation
 * - Input/output guardrail validation
 * - Audit logging for all operations
 * - Token budget enforcement
 * - Forbidden pattern detection
 * - Error sanitization
 *
 * Uses AIProvider abstraction for CLI-first development:
 * - CLAUDE_CLI=true (default): Uses Claude CLI (cost-effective for development)
 * - CLAUDE_CLI=false: Uses Anthropic API (for production)
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  AIProvider,
  AIProviderResponse,
} from '@aigentflow/ai-provider';
import { getAIProvider } from '@aigentflow/ai-provider';
import { extractJSON, STRUCTURED_OUTPUT_INSTRUCTION } from './utils/structured-output.js';
import { sanitizeLLMJson } from './utils/json-sanitizer.js';
import type {
  AgentMetadata,
  AgentContext,
  AgentOutput,
  AgentRequest,
  AgentError,
  ExecutionMetrics,
  RoutingHints,
  Artifact,
  AgentType,
  AgentConstraints,
} from './types.js';
import {
  AgentRequestSchema,
  AgentContextSchema,
  DEFAULT_CONSTRAINTS,
  SecurityViolationError,
  AgentValidationError,
  AgentExecutionError,
} from './types.js';

/**
 * Logger interface for agent logging
 */
interface AgentLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Simple console logger (can be replaced with proper logger)
 */
const defaultLogger: AgentLogger = {
  debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta || ''),
  info: (msg, meta) => console.info(`[INFO] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || ''),
};

/**
 * Abstract base class for all agents
 */
export abstract class BaseAgent {
  protected aiProvider: AIProvider;
  protected metadata: AgentMetadata;
  protected logger: AgentLogger;
  private status: 'idle' | 'running' | 'completed' | 'failed' = 'idle';
  private consecutiveFailures = 0;

  constructor(metadata: AgentMetadata, logger?: AgentLogger) {
    this.metadata = metadata;
    this.logger = logger || defaultLogger;
    // Use AIProvider abstraction - automatically selects CLI or API based on config
    this.aiProvider = getAIProvider();
  }

  /**
   * Get agent metadata
   */
  getMetadata(): AgentMetadata {
    return this.metadata;
  }

  /**
   * Get agent ID
   */
  getId(): AgentType {
    return this.metadata.id;
  }

  /**
   * Get current status
   */
  getStatus(): 'idle' | 'running' | 'completed' | 'failed' {
    return this.status;
  }

  /**
   * Get consecutive failure count
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Execute the agent with given request
   *
   * SECURITY: Validates input, enforces constraints, logs operations
   */
  async execute(request: AgentRequest): Promise<AgentOutput> {
    const metrics: Partial<ExecutionMetrics> = {
      startTime: new Date(),
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0,
      llmCalls: 0,
      retryCount: 0,
      cacheHits: 0,
    };

    this.status = 'running';
    const errors: AgentError[] = [];

    try {
      // SECURITY: Validate request with Zod schema
      if (!request.options?.skipInputValidation) {
        this.validateRequest(request);
      }

      // SECURITY: Validate context requirements
      this.validateContext(request.context);

      // SECURITY: Log execution start
      await this.logExecutionStart(request);

      // Build prompts
      const systemPrompt = this.buildSystemPrompt(request.context);
      const userPrompt = this.buildUserPrompt(request);

      // SECURITY: Validate input against guardrails
      await this.validateInput(userPrompt, request.context);

      // Execute with retry logic
      const constraints = this.mergeConstraints(
        request.context.constraints,
        request.options?.overrideConstraints
      );
      const maxRetries = constraints.maxRetries;
      let result: unknown = null;
      let artifacts: Artifact[] = [];

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          metrics.llmCalls = (metrics.llmCalls || 0) + 1;

          const response = await this.callLLM(
            systemPrompt,
            userPrompt,
            request,
            constraints.timeoutMs
          );

          // Track token usage
          const inputTokens = response.usage?.inputTokens || 0;
          const outputTokens = response.usage?.outputTokens || 0;
          metrics.inputTokens = (metrics.inputTokens || 0) + inputTokens;
          metrics.outputTokens = (metrics.outputTokens || 0) + outputTokens;
          metrics.tokensUsed = (metrics.tokensUsed || 0) + inputTokens + outputTokens;

          // SECURITY: Enforce token budget
          this.enforceTokenBudget(metrics.tokensUsed, constraints.maxTokens);

          // SECURITY: Validate output against forbidden patterns
          this.validateForbiddenPatterns(response.content, constraints.forbiddenPatterns);

          // SECURITY: Validate output against guardrails
          if (!request.options?.skipOutputValidation) {
            await this.validateOutput(response.content, request.context);
          }

          // Parse and validate response
          const parsed = this.parseResponse(response);

          // Process the parsed response
          const processed = await this.processResult(parsed, request);
          result = processed.result;
          artifacts = processed.artifacts;

          break; // Success, exit retry loop
        } catch (error) {
          metrics.retryCount = (metrics.retryCount || 0) + 1;

          const agentError = this.wrapError(error);
          errors.push(agentError);

          if (!agentError.recoverable || attempt === maxRetries) {
            throw error;
          }

          this.log('warn', `Retry attempt ${attempt + 1}/${maxRetries}`, {
            error: agentError.message,
          });

          // Wait before retry with exponential backoff
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }

      // Generate routing hints
      const routingHints = this.generateRoutingHints(result, artifacts, request);

      // Complete metrics
      metrics.endTime = new Date();
      metrics.durationMs = metrics.endTime.getTime() - metrics.startTime!.getTime();

      this.status = 'completed';
      this.consecutiveFailures = 0;

      const output: AgentOutput = {
        agentId: this.metadata.id,
        executionId: request.executionId,
        timestamp: new Date(),
        success: true,
        result,
        artifacts,
        routingHints,
        metrics: metrics as ExecutionMetrics,
        errors: errors.length > 0 ? errors : undefined,
      };

      // SECURITY: Log execution success
      await this.logExecutionComplete(request, output);

      return output;
    } catch (error) {
      this.status = 'failed';
      this.consecutiveFailures++;

      metrics.endTime = new Date();
      metrics.durationMs = metrics.endTime!.getTime() - metrics.startTime!.getTime();

      const finalError = this.wrapError(error);
      errors.push(finalError);

      const output: AgentOutput = {
        agentId: this.metadata.id,
        executionId: request.executionId,
        timestamp: new Date(),
        success: false,
        result: null,
        artifacts: [],
        routingHints: {
          suggestNext: [],
          skipAgents: [],
          needsApproval: false,
          hasFailures: true,
          isComplete: false,
          blockedBy: this.sanitizeErrorMessage(finalError.message),
        },
        metrics: metrics as ExecutionMetrics,
        errors,
      };

      // SECURITY: Log execution failure
      await this.logExecutionFailure(request, output, error);

      return output;
    }
  }

  /**
   * Validate request with Zod schema
   */
  protected validateRequest(request: AgentRequest): void {
    try {
      AgentRequestSchema.parse(request);
    } catch (error) {
      throw new AgentValidationError(
        'Invalid agent request',
        'request',
        error
      );
    }
  }

  /**
   * Validate that required context is present
   */
  protected validateContext(context: AgentContext): void {
    // Validate context schema
    try {
      AgentContextSchema.parse(context);
    } catch (error) {
      throw new AgentValidationError(
        'Invalid agent context',
        'context',
        error
      );
    }

    // Check required context types
    for (const req of this.metadata.requiredContext) {
      if (req.required) {
        const hasContext = context.items.some((item) => item.type === req.type);
        if (!hasContext) {
          throw new AgentValidationError(
            `Missing required context: ${req.type}`,
            'context.items',
            { required: req.type }
          );
        }
      }
    }
  }

  /**
   * Validate input against guardrails (placeholder for integration)
   */
  protected async validateInput(
    input: string,
    context: AgentContext
  ): Promise<void> {
    // TODO: Integrate with GuardrailManager from @aigentflow/hooks
    // For now, perform basic validation
    if (!input || input.length === 0) {
      throw new AgentValidationError('Empty input prompt', 'input');
    }

    // Check for obvious prompt injection patterns
    const injectionPatterns = [
      /ignore.*instructions/i,
      /disregard.*above/i,
      /forget.*previous/i,
      /new.*instructions/i,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(input)) {
        throw new SecurityViolationError(
          'Potential prompt injection detected',
          ['prompt_injection'],
          { pattern: pattern.source }
        );
      }
    }
  }

  /**
   * Validate output against guardrails (placeholder for integration)
   */
  protected async validateOutput(
    output: string,
    context: AgentContext
  ): Promise<void> {
    // TODO: Integrate with GuardrailManager from @aigentflow/hooks
    // For now, perform basic validation
    if (!output || output.length === 0) {
      throw new AgentValidationError('Empty output from LLM', 'output');
    }
  }

  /**
   * Enforce token budget
   */
  protected enforceTokenBudget(tokensUsed: number, maxTokens: number): void {
    if (tokensUsed > maxTokens) {
      throw new SecurityViolationError(
        `Token budget exceeded: ${tokensUsed}/${maxTokens}`,
        ['token_budget_exceeded'],
        { used: tokensUsed, limit: maxTokens }
      );
    }
  }

  /**
   * Validate output against forbidden patterns
   */
  protected validateForbiddenPatterns(
    output: string,
    forbiddenPatterns: string[]
  ): void {
    const violations: string[] = [];

    for (const pattern of forbiddenPatterns) {
      try {
        const regex = new RegExp(pattern, 'gi');
        if (regex.test(output)) {
          violations.push(pattern);
        }
      } catch {
        // If pattern is not a valid regex, do literal match
        if (output.toLowerCase().includes(pattern.toLowerCase())) {
          violations.push(pattern);
        }
      }
    }

    if (violations.length > 0) {
      throw new SecurityViolationError(
        'Output contains forbidden patterns',
        violations,
        { patternsFound: violations.length }
      );
    }
  }

  /**
   * Merge constraints with overrides
   */
  protected mergeConstraints(
    base: AgentConstraints,
    overrides?: Partial<AgentConstraints>
  ): AgentConstraints {
    return {
      ...DEFAULT_CONSTRAINTS,
      ...base,
      ...overrides,
    };
  }

  /**
   * Build the system prompt for the LLM
   * Override in subclasses for specialized prompts
   */
  protected abstract buildSystemPrompt(context: AgentContext): string;

  /**
   * Build the user prompt for the LLM
   * Override in subclasses for specialized prompts
   */
  protected abstract buildUserPrompt(request: AgentRequest): string;

  /**
   * Parse the LLM response into structured data
   * Override in subclasses for specialized parsing
   */
  protected abstract parseResponse(response: AIProviderResponse): unknown;

  /**
   * Process the parsed result and generate artifacts
   * Override in subclasses for specialized processing
   */
  protected abstract processResult(
    parsed: unknown,
    request: AgentRequest
  ): Promise<{ result: unknown; artifacts: Artifact[] }>;

  /**
   * Generate routing hints based on result
   * Override in subclasses for specialized routing logic
   */
  protected abstract generateRoutingHints(
    result: unknown,
    artifacts: Artifact[],
    request: AgentRequest
  ): RoutingHints;

  /**
   * Call the LLM with the given prompts
   *
   * Uses AIProvider abstraction - works with both CLI and API modes
   */
  protected async callLLM(
    systemPrompt: string,
    userPrompt: string,
    request: AgentRequest,
    timeoutMs?: number
  ): Promise<AIProviderResponse> {
    const response = await this.aiProvider.complete({
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      metadata: {
        agent: this.metadata.id,
        operation: 'execute',
        correlationId: request.executionId,
      },
    });

    return response;
  }

  /**
   * Spawn a subagent for parallel task execution
   *
   * Uses role-specific CLAUDE.md for context isolation
   */
  protected async spawnSubagent(
    role: string,
    task: string,
    context: AgentContext
  ): Promise<string> {
    // Log subagent spawn
    this.log('info', `Spawning subagent: ${role}`, {
      task: task.substring(0, 100),
      tenantId: context.tenantId,
    });

    const response = await this.aiProvider.spawnSubagent(role, task);
    return response.content;
  }

  /**
   * Extract text content from LLM response
   */
  protected extractTextContent(response: AIProviderResponse): string {
    if (!response.content) {
      throw new AgentExecutionError(
        'No text content in LLM response',
        'EMPTY_RESPONSE',
        true
      );
    }
    return response.content;
  }

  /**
   * Parse JSON from LLM response, handling various formats
   *
   * Uses extractJSON to handle:
   * - Clean JSON
   * - Markdown code blocks
   * - Prose mixed with JSON
   */
  protected parseJSON<T>(text: string): T {
    // Use robust extraction
    const jsonStr = extractJSON(text);

    try {
      const parsed = JSON.parse(jsonStr);
      // Sanitize to fix common LLM output issues:
      // - String booleans ("true" -> true)
      // - Nested objects where strings expected
      // - Objects where arrays expected
      const sanitized = sanitizeLLMJson(parsed);
      return sanitized as T;
    } catch (error) {
      // Log the extraction attempt for debugging
      this.log('debug', 'JSON parse failed', {
        rawLength: text.length,
        extractedLength: jsonStr.length,
        rawPreview: text.substring(0, 200),
        extractedPreview: jsonStr.substring(0, 200),
      });

      throw new AgentExecutionError(
        `Failed to parse JSON response: ${error}`,
        'JSON_PARSE_ERROR',
        true // Make recoverable so retry can attempt with clearer prompting
      );
    }
  }

  /**
   * Get structured output instruction to append to system prompts
   */
  protected getStructuredOutputInstruction(): string {
    return STRUCTURED_OUTPUT_INSTRUCTION;
  }

  /**
   * Wrap an error into AgentError format
   */
  protected wrapError(error: unknown): AgentError {
    if (error instanceof Error) {
      return {
        code: error.name,
        message: this.sanitizeErrorMessage(error.message),
        recoverable: this.isRecoverableError(error),
        stack: this.sanitizeStack(error.stack),
        context:
          error instanceof SecurityViolationError
            ? { violations: error.violations }
            : undefined,
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: this.sanitizeErrorMessage(String(error)),
      recoverable: false,
    };
  }

  /**
   * Sanitize error message to prevent info leakage
   */
  protected sanitizeErrorMessage(message: string): string {
    // Remove potential secrets/API keys
    let sanitized = message
      .replace(/sk-ant-[a-zA-Z0-9-]+/g, '[REDACTED_API_KEY]')
      .replace(/Bearer\s+[a-zA-Z0-9._-]+/g, 'Bearer [REDACTED]')
      .replace(/password[=:]\s*\S+/gi, 'password=[REDACTED]')
      .replace(/secret[=:]\s*\S+/gi, 'secret=[REDACTED]');

    // Limit message length
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 500) + '...';
    }

    return sanitized;
  }

  /**
   * Sanitize stack trace for production
   */
  protected sanitizeStack(stack?: string): string | undefined {
    if (!stack) return undefined;

    // In production, don't expose stack traces
    if (process.env['NODE_ENV'] === 'production') {
      return undefined;
    }

    return stack;
  }

  /**
   * Determine if an error is recoverable (can retry)
   */
  protected isRecoverableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Rate limit errors are recoverable
    if (message.includes('rate_limit') || message.includes('rate limit')) {
      return true;
    }
    // Timeout errors are recoverable
    if (message.includes('timeout') || message.includes('timed out')) {
      return true;
    }
    // Server errors might be recoverable
    if (message.includes('500') || message.includes('503') || message.includes('502')) {
      return true;
    }
    // Connection errors are recoverable
    if (message.includes('econnreset') || message.includes('enotfound')) {
      return true;
    }

    // Security violations are not recoverable
    if (error instanceof SecurityViolationError) {
      return false;
    }
    // Validation errors are not recoverable
    if (error instanceof AgentValidationError) {
      return false;
    }

    return false;
  }

  /**
   * Delay helper for retry logic
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate a unique artifact ID
   */
  protected generateArtifactId(): string {
    return uuidv4();
  }

  /**
   * Log agent activity
   */
  protected log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>
  ): void {
    this.logger[level](`[${this.metadata.id}] ${message}`, meta);
  }

  /**
   * Log execution start (placeholder for audit integration)
   */
  protected async logExecutionStart(request: AgentRequest): Promise<void> {
    // TODO: Integrate with AuditLogger from @aigentflow/audit
    this.log('info', 'Agent execution started', {
      executionId: request.executionId,
      taskType: request.task.taskType,
      tenantId: request.context.tenantId,
    });
  }

  /**
   * Log execution complete (placeholder for audit integration)
   */
  protected async logExecutionComplete(
    request: AgentRequest,
    output: AgentOutput
  ): Promise<void> {
    // TODO: Integrate with AuditLogger from @aigentflow/audit
    this.log('info', 'Agent execution completed', {
      executionId: request.executionId,
      success: output.success,
      tokensUsed: output.metrics.tokensUsed,
      durationMs: output.metrics.durationMs,
      tenantId: request.context.tenantId,
    });
  }

  /**
   * Log execution failure (placeholder for audit integration)
   */
  protected async logExecutionFailure(
    request: AgentRequest,
    output: AgentOutput,
    error: unknown
  ): Promise<void> {
    // TODO: Integrate with AuditLogger from @aigentflow/audit
    this.log('error', 'Agent execution failed', {
      executionId: request.executionId,
      error: error instanceof Error ? error.message : String(error),
      consecutiveFailures: this.consecutiveFailures,
      tenantId: request.context.tenantId,
    });
  }
}
