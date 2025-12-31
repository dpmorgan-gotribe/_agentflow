# Environment Configuration

ALL configurable values MUST come from environment variables with Zod validation. This ensures type safety, early failure on misconfiguration, and clear documentation of required settings.

## Directory Structure

```
apps/api/src/config/
├── index.ts              # Unified config export
├── env.ts                # Zod schema + validation
├── database.config.ts    # Database configuration
├── auth.config.ts        # Authentication configuration
├── ai.config.ts          # AI provider configuration
└── features.config.ts    # Feature flags from env
```

## Core Pattern

### Environment Schema with Zod

```typescript
// apps/api/src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  // ===========================================
  // Required - App will fail to start without these
  // ===========================================
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DATABASE_URL: z.string().url(),

  // ===========================================
  // AI Provider (CLI-first approach)
  // ===========================================
  CLAUDE_CLI: z.coerce.boolean().default(true),
  CLAUDE_CLI_PATH: z.string().default('claude'),
  CLAUDE_CLI_TIMEOUT_MS: z.coerce.number().default(300000),

  // Only required when CLAUDE_CLI=false
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),

  // ===========================================
  // Optional with sensible defaults
  // ===========================================
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Limits
  MAX_CONCURRENT_AGENTS: z.coerce.number().default(15),
  MAX_TASK_RETRIES: z.coerce.number().default(3),
  DEFAULT_TIMEOUT_MS: z.coerce.number().default(60000),

  // ===========================================
  // Feature flags (default off in production)
  // ===========================================
  ENABLE_SELF_EVOLUTION: z.coerce.boolean().default(false),
  ENABLE_EXPERIMENTAL_AGENTS: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

// Validate on import - fail fast if misconfigured
export const env = envSchema.parse(process.env);
```

### Conditional Validation

```typescript
// apps/api/src/config/env.ts

const envSchema = z.object({
  CLAUDE_CLI: z.coerce.boolean().default(true),
  ANTHROPIC_API_KEY: z.string().optional(),
  // ... other fields
}).refine(
  (data) => {
    // If not using CLI, API key is required
    if (!data.CLAUDE_CLI && !data.ANTHROPIC_API_KEY) {
      return false;
    }
    return true;
  },
  {
    message: 'ANTHROPIC_API_KEY is required when CLAUDE_CLI=false',
    path: ['ANTHROPIC_API_KEY'],
  }
);
```

### Domain-Specific Configs

```typescript
// apps/api/src/config/database.config.ts
import { env } from './env';

export const databaseConfig = {
  url: env.DATABASE_URL,
  pool: {
    min: env.NODE_ENV === 'production' ? 5 : 1,
    max: env.NODE_ENV === 'production' ? 20 : 5,
  },
  ssl: env.NODE_ENV === 'production',
} as const;
```

```typescript
// apps/api/src/config/ai.config.ts
import { env } from './env';

export const aiConfig = {
  useCli: env.CLAUDE_CLI,
  cli: {
    path: env.CLAUDE_CLI_PATH,
    timeoutMs: env.CLAUDE_CLI_TIMEOUT_MS,
  },
  api: {
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.ANTHROPIC_MODEL,
  },
} as const;
```

### Unified Export

```typescript
// apps/api/src/config/index.ts
export { env } from './env';
export { databaseConfig } from './database.config';
export { aiConfig } from './ai.config';
export { authConfig } from './auth.config';
export { featuresConfig } from './features.config';
```

## Usage

```typescript
// ✅ Good - import validated config
import { env, databaseConfig, aiConfig } from '@/config';

const port = env.PORT;
const isProduction = env.NODE_ENV === 'production';
const dbPool = databaseConfig.pool.max;
```

## .env.example Template

```bash
# =============================================================================
# Aigentflow Environment Configuration
# =============================================================================
# Copy this file to .env and fill in your values
# All values have sensible defaults unless marked REQUIRED

# =============================================================================
# Core Settings (REQUIRED)
# =============================================================================
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/aigentflow

# =============================================================================
# AI Provider Configuration
# =============================================================================
# CLI Mode (default) - uses Claude CLI with subscription pricing
# Set CLAUDE_CLI=false to use Anthropic API instead

CLAUDE_CLI=true
CLAUDE_CLI_PATH=claude
CLAUDE_CLI_TIMEOUT_MS=300000

# API Mode - only needed when CLAUDE_CLI=false
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-4-20250514
# ANTHROPIC_MAX_TOKENS=8192

# =============================================================================
# Server Configuration
# =============================================================================
PORT=3000
LOG_LEVEL=debug

# =============================================================================
# Limits and Thresholds
# =============================================================================
MAX_CONCURRENT_AGENTS=15
MAX_TASK_RETRIES=3
DEFAULT_TIMEOUT_MS=60000

# =============================================================================
# Feature Flags
# =============================================================================
ENABLE_SELF_EVOLUTION=false
ENABLE_EXPERIMENTAL_AGENTS=false

# =============================================================================
# Authentication (REQUIRED for production)
# =============================================================================
# JWT_SECRET=your-secret-key-min-32-chars
# JWT_EXPIRES_IN=7d

# =============================================================================
# External Services
# =============================================================================
# QDRANT_URL=http://localhost:6333
# NATS_URL=nats://localhost:4222
# REDIS_URL=redis://localhost:6379
```

## Anti-Patterns

### Hardcoded Configuration

```typescript
// ❌ Bad - hardcoded value
const port = 3000;
const apiUrl = 'https://api.example.com';

// ✅ Good - from environment
import { env } from '@/config';
const port = env.PORT;
```

### process.env Direct Access

```typescript
// ❌ Bad - unvalidated, untyped
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// ✅ Good - validated and typed
import { env } from '@/config';
const port = env.PORT;  // Already has default, typed as number
const isProduction = env.NODE_ENV === 'production';  // Typed as enum
```

### Missing Validation

```typescript
// ❌ Bad - no validation, could be undefined
const dbUrl = process.env.DATABASE_URL;
await connect(dbUrl);  // Might crash later

// ✅ Good - validated at startup
import { env } from '@/config';
await connect(env.DATABASE_URL);  // Guaranteed to exist
```

### Scattered Configuration

```typescript
// ❌ Bad - config scattered across files
// file1.ts
const timeout = parseInt(process.env.TIMEOUT || '5000');

// file2.ts
const timeout = Number(process.env.TIMEOUT) || 5000;

// ✅ Good - centralized config
// Both files import from config
import { env } from '@/config';
const timeout = env.DEFAULT_TIMEOUT_MS;
```

## Environment-Specific Behavior

```typescript
// apps/api/src/config/env.ts

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  // ...
});

export const env = envSchema.parse(process.env);

// Derived values based on environment
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
```

## Secrets Handling

```typescript
// ❌ Bad - secret in code
const API_KEY = 'sk-ant-abc123';

// ❌ Bad - secret in .env committed to git
// .env (committed)
// API_KEY=sk-ant-abc123

// ✅ Good - secret in .env.local (gitignored)
// .env.local
// ANTHROPIC_API_KEY=sk-ant-abc123

// ✅ Good - secret from secure vault in production
// Injected by deployment system
```

## Validation Timing

```typescript
// Validate ONCE at application startup
// apps/api/src/main.ts

import { env } from '@/config';  // Validates here, throws if invalid

async function bootstrap() {
  console.log(`Starting in ${env.NODE_ENV} mode on port ${env.PORT}`);
  // If we get here, all config is valid
}

bootstrap();
```

## Type Safety Benefits

```typescript
import { env } from '@/config';

// TypeScript knows these types:
env.PORT           // number (not string)
env.NODE_ENV       // 'development' | 'test' | 'production'
env.CLAUDE_CLI     // boolean (not string 'true')
env.LOG_LEVEL      // 'debug' | 'info' | 'warn' | 'error'

// TypeScript catches errors:
env.NONEXISTENT    // Error: Property does not exist
env.PORT.split()   // Error: split doesn't exist on number
```

## Enforcement

- Never import directly from `process.env`
- All environment access through `@/config` module
- Zod schema must include all environment variables used
- `.env.example` must be kept in sync with schema
- CI/CD validates `.env.example` matches schema
