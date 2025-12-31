/**
 * Prompt Architecture Error Types
 *
 * Domain-specific errors for the prompt system.
 */

/**
 * Base error class for prompt-related failures
 */
export class PromptError extends Error {
  readonly code: string;
  readonly context: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'PromptError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Error for invalid layer configuration
 */
export class PromptLayerError extends PromptError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'PROMPT_LAYER_ERROR', context);
    this.name = 'PromptLayerError';
  }
}

/**
 * Error for token budget exceeded
 */
export class TokenBudgetError extends PromptError {
  readonly budgetExceeded: number;
  readonly budgetLimit: number;

  constructor(
    message: string,
    budgetExceeded: number,
    budgetLimit: number,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'TOKEN_BUDGET_ERROR', {
      ...context,
      budgetExceeded,
      budgetLimit,
    });
    this.name = 'TokenBudgetError';
    this.budgetExceeded = budgetExceeded;
    this.budgetLimit = budgetLimit;
  }
}

/**
 * Error for missing required variables
 */
export class VariableResolutionError extends PromptError {
  readonly missingVariables: string[];

  constructor(
    missingVariables: string[],
    context: Record<string, unknown> = {}
  ) {
    super(
      `Missing required variables: ${missingVariables.join(', ')}`,
      'VARIABLE_RESOLUTION_ERROR',
      { ...context, missingVariables }
    );
    this.name = 'VariableResolutionError';
    this.missingVariables = missingVariables;
  }
}

/**
 * Error for variable validation failures (security)
 */
export class VariableValidationError extends PromptError {
  readonly invalidVariables: string[];

  constructor(
    message: string,
    invalidVariables: string[],
    context: Record<string, unknown> = {}
  ) {
    super(message, 'VARIABLE_VALIDATION_ERROR', {
      ...context,
      invalidVariables,
    });
    this.name = 'VariableValidationError';
    this.invalidVariables = invalidVariables;
  }
}

/**
 * Error for template registry operations
 */
export class PromptRegistryError extends PromptError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'PROMPT_REGISTRY_ERROR', context);
    this.name = 'PromptRegistryError';
  }
}

/**
 * Error for composition failures
 */
export class CompositionError extends PromptError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'COMPOSITION_ERROR', context);
    this.name = 'CompositionError';
  }
}
