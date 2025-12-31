# Constants Separation

All magic numbers, strings, and configurable values MUST be in dedicated constant files. This creates a single source of truth and makes values easy to find and update.

## Directory Structure

```
packages/shared/src/constants/
├── index.ts              # Re-exports all constants
├── api.constants.ts      # API-related constants
├── agent.constants.ts    # Agent definitions
├── limits.constants.ts   # Rate limits, quotas, thresholds
├── features.constants.ts # Feature flag names
├── errors.constants.ts   # Error codes and messages
└── ui.constants.ts       # UI-related constants
```

## Pattern

### Defining Constants

```typescript
// packages/shared/src/constants/limits.constants.ts

export const LIMITS = {
  MAX_CONCURRENT_AGENTS: 15,
  MAX_TASK_RETRIES: 3,
  MAX_CONTEXT_TOKENS: 100000,
  DEFAULT_TIMEOUT_MS: 60000,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
} as const;

// Type extraction for type safety
export type LimitKey = keyof typeof LIMITS;
export type LimitValue = typeof LIMITS[LimitKey];
```

### Feature Flags

```typescript
// packages/shared/src/constants/features.constants.ts

export const FEATURE_FLAGS = {
  SELF_EVOLUTION: 'enable-self-evolution',
  MULTI_TENANT: 'enable-multi-tenant',
  ADVANCED_ANALYTICS: 'enable-advanced-analytics',
  EXPERIMENTAL_AGENTS: 'enable-experimental-agents',
} as const;

export type FeatureFlag = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS];
```

### Error Codes

```typescript
// packages/shared/src/constants/errors.constants.ts

export const ERROR_CODES = {
  // Agent errors
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  AGENT_EXECUTION_FAILED: 'AGENT_EXECUTION_FAILED',
  AGENT_TIMEOUT: 'AGENT_TIMEOUT',

  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',

  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ERROR_CODES.AGENT_NOT_FOUND]: 'The requested agent was not found',
  [ERROR_CODES.AGENT_EXECUTION_FAILED]: 'Agent execution failed',
  [ERROR_CODES.AGENT_TIMEOUT]: 'Agent execution timed out',
  [ERROR_CODES.VALIDATION_FAILED]: 'Validation failed',
  [ERROR_CODES.INVALID_INPUT]: 'Invalid input provided',
  [ERROR_CODES.UNAUTHORIZED]: 'Authentication required',
  [ERROR_CODES.FORBIDDEN]: 'Access denied',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Authentication token has expired',
  [ERROR_CODES.NOT_FOUND]: 'Resource not found',
  [ERROR_CODES.CONFLICT]: 'Resource conflict',
  [ERROR_CODES.RATE_LIMITED]: 'Rate limit exceeded',
};
```

### Index Re-export

```typescript
// packages/shared/src/constants/index.ts

export * from './limits.constants';
export * from './features.constants';
export * from './errors.constants';
export * from './agent.constants';
export * from './api.constants';
export * from './ui.constants';
```

## Usage

```typescript
// ✅ Good - import from shared constants
import { LIMITS, FEATURE_FLAGS, ERROR_CODES } from '@aigentflow/shared/constants';

if (agents.length > LIMITS.MAX_CONCURRENT_AGENTS) {
  throw new DomainError(ERROR_CODES.RATE_LIMITED);
}

if (featureFlags.isEnabled(FEATURE_FLAGS.SELF_EVOLUTION)) {
  // ...
}
```

## Anti-Patterns

### Magic Numbers

```typescript
// ❌ Bad - magic number in code
if (agents.length > 15) {
  throw new Error('Too many agents');
}

// ✅ Good - use constant
import { LIMITS } from '@aigentflow/shared/constants';

if (agents.length > LIMITS.MAX_CONCURRENT_AGENTS) {
  throw new DomainError(ERROR_CODES.RATE_LIMITED);
}
```

### String Literals for Feature Flags

```typescript
// ❌ Bad - string literal
if (featureFlags.get('enable-self-evolution')) { ... }

// ✅ Good - use constant
import { FEATURE_FLAGS } from '@aigentflow/shared/constants';

if (featureFlags.get(FEATURE_FLAGS.SELF_EVOLUTION)) { ... }
```

### Hardcoded Error Messages

```typescript
// ❌ Bad - hardcoded message
throw new Error('Too many retries');

// ✅ Good - use constant
import { ERROR_CODES, ERROR_MESSAGES } from '@aigentflow/shared/constants';

throw new DomainError(
  ERROR_MESSAGES[ERROR_CODES.AGENT_TIMEOUT],
  ERROR_CODES.AGENT_TIMEOUT
);
```

### Duplicated Constants

```typescript
// ❌ Bad - same value defined in multiple places
// file1.ts
const MAX_RETRIES = 3;

// file2.ts
const RETRY_LIMIT = 3;

// ✅ Good - single source of truth
// Both files import from shared constants
import { LIMITS } from '@aigentflow/shared/constants';
// Use LIMITS.MAX_TASK_RETRIES
```

## When to Create New Constants

1. **Value is used more than once** - If a value appears in multiple places, extract it
2. **Value is configurable** - If it might change, make it a constant
3. **Value has semantic meaning** - If `15` means "max agents", name it `MAX_CONCURRENT_AGENTS`
4. **Value is a boundary** - Limits, thresholds, timeouts should always be constants

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Numeric limits | `MAX_*`, `MIN_*`, `DEFAULT_*` | `MAX_CONCURRENT_AGENTS` |
| Timeouts | `*_TIMEOUT_MS` | `API_TIMEOUT_MS` |
| Sizes | `*_SIZE_BYTES` | `MAX_FILE_SIZE_BYTES` |
| Feature flags | Descriptive kebab-case value | `enable-self-evolution` |
| Error codes | SCREAMING_SNAKE_CASE | `AGENT_NOT_FOUND` |
| API paths | `*_PATH` or `*_ENDPOINT` | `AGENTS_ENDPOINT` |

## Enforcement

- ESLint rule: `no-magic-numbers` (with exceptions for 0, 1, -1)
- Code review checklist: "Are all magic values extracted to constants?"
- Pre-commit hook: Scan for hardcoded strings matching common patterns
