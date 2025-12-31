# Step 01: Monorepo Setup

> **Checkpoint:** CP0 - Foundation
> **Previous Step:** None (First Step)
> **Next Step:** 02-POSTGRESQL-SETUP.md

---

## Overview

This step establishes the Turborepo + pnpm workspaces monorepo structure that will house all Aigentflow applications and packages. This is the architectural foundation that enables:

- Independent builds and deployments per app
- Shared packages across applications
- Efficient caching and parallel builds
- Clear separation of concerns

---

## Deliverables

1. Root `package.json` with workspaces configuration
2. `pnpm-workspace.yaml` defining workspace packages
3. `turbo.json` for build orchestration
4. Directory structure for apps/ and packages/
5. Shared TypeScript configuration
6. ESLint + Prettier shared configuration
7. Husky + lint-staged for git hooks

---

## Directory Structure

```
aigentflow/
├── apps/
│   ├── api/                    # NestJS backend (Step 04)
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                    # Commander.js CLI (Step 05)
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                    # React frontend (CP10)
│   │   └── .gitkeep
│   │
│   ├── mobile/                 # Expo app (CP12)
│   │   └── .gitkeep
│   │
│   └── desktop/                # Tauri wrapper (CP12)
│       └── .gitkeep
│
├── packages/
│   ├── core/                   # Shared business logic
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── agents/                 # Agent definitions
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── langgraph/              # Workflow graphs
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── database/               # PostgreSQL/Qdrant clients
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── mcp-servers/            # MCP server implementations
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui/                     # Shared UI components
│   │   └── .gitkeep
│   │
│   ├── config/                 # Shared configuration
│   │   ├── eslint/
│   │   ├── typescript/
│   │   └── package.json
│   │
│   └── tsconfig/               # Shared TypeScript configs
│       ├── base.json
│       ├── node.json
│       ├── react.json
│       └── package.json
│
├── infrastructure/             # OpenTofu configs (CP11)
│   └── .gitkeep
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── .husky/
│   ├── pre-commit
│   └── commit-msg
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .eslintrc.js
├── .prettierrc
├── .gitignore
└── tsconfig.json
```

---

## 1. Root Package Configuration

### 1.1 package.json

```json
{
  "name": "aigentflow",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "test": "turbo test",
    "test:coverage": "turbo test:coverage",
    "typecheck": "turbo typecheck",
    "clean": "turbo clean && rm -rf node_modules",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "prepare": "husky install",
    "db:generate": "turbo db:generate",
    "db:migrate": "turbo db:migrate",
    "db:push": "turbo db:push"
  },
  "devDependencies": {
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "prettier": "^3.2.0",
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

### 1.2 pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 1.3 turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    ".env",
    ".env.local"
  ],
  "globalEnv": [
    "NODE_ENV",
    "DATABASE_URL",
    "QDRANT_URL",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "test:coverage": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    }
  }
}
```

---

## 2. Shared TypeScript Configuration

### 2.1 packages/tsconfig/base.json

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Base",
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noEmitOnError": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ES2022",
    "lib": ["ES2022"],
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "incremental": true
  },
  "exclude": ["node_modules", "dist"]
}
```

### 2.2 packages/tsconfig/node.json

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Node.js",
  "extends": "./base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": ["node"]
  }
}
```

### 2.3 packages/tsconfig/package.json

```json
{
  "name": "@aigentflow/tsconfig",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "publishConfig": {
    "access": "public"
  },
  "files": [
    "base.json",
    "node.json",
    "react.json"
  ]
}
```

---

## 3. Shared ESLint Configuration

### 3.1 packages/config/eslint/base.js

```javascript
/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  parserOptions: {
    project: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
    ],
    '@typescript-eslint/no-misused-promises': [
      'error',
      { checksVoidReturn: { attributes: false } },
    ],
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling'],
          'index',
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      },
    ],
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    '.turbo',
    'coverage',
    '*.config.js',
    '*.config.mjs',
  ],
};
```

### 3.2 packages/config/package.json

```json
{
  "name": "@aigentflow/config",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "files": [
    "eslint"
  ],
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-import": "^2.29.0"
  }
}
```

---

## 4. Core Package Template

### 4.1 packages/core/package.json

```json
{
  "name": "@aigentflow/core",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --dts --watch",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@aigentflow/tsconfig": "workspace:*",
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.0.0"
  }
}
```

### 4.2 packages/core/tsconfig.json

```json
{
  "extends": "@aigentflow/tsconfig/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### 4.3 packages/core/src/index.ts

```typescript
/**
 * @aigentflow/core
 *
 * Core business logic and shared types for Aigentflow.
 */

// Types
export * from './types';

// Utils
export * from './utils';

// Constants
export * from './constants';
```

---

## 5. Git Hooks Setup

### 5.1 .husky/pre-commit

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint-staged
```

### 5.2 .husky/commit-msg

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm commitlint --edit $1
```

### 5.3 commitlint.config.js

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'api',
        'cli',
        'web',
        'mobile',
        'desktop',
        'core',
        'agents',
        'langgraph',
        'database',
        'mcp',
        'config',
        'infra',
        'deps',
      ],
    ],
  },
};
```

---

## 6. GitHub Actions CI

### 6.1 .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm typecheck

      - name: Test
        run: pnpm test
```

---

## 7. Environment Configuration

### 7.1 .env.example

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/aigentflow

# Vector Database
QDRANT_URL=http://localhost:6333

# AI Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Application
NODE_ENV=development
LOG_LEVEL=debug
```

### 7.2 .gitignore

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
.next/
.turbo/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# Testing
coverage/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
pnpm-debug.log*
```

---

## Test Scenarios

```typescript
// tests/monorepo.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Monorepo Setup', () => {
  const root = process.cwd();

  describe('Directory Structure', () => {
    it('should have apps directory', () => {
      expect(existsSync(join(root, 'apps'))).toBe(true);
    });

    it('should have packages directory', () => {
      expect(existsSync(join(root, 'packages'))).toBe(true);
    });

    it('should have required app directories', () => {
      expect(existsSync(join(root, 'apps', 'api'))).toBe(true);
      expect(existsSync(join(root, 'apps', 'cli'))).toBe(true);
    });

    it('should have required package directories', () => {
      expect(existsSync(join(root, 'packages', 'core'))).toBe(true);
      expect(existsSync(join(root, 'packages', 'database'))).toBe(true);
      expect(existsSync(join(root, 'packages', 'langgraph'))).toBe(true);
    });
  });

  describe('Configuration Files', () => {
    it('should have turbo.json', () => {
      expect(existsSync(join(root, 'turbo.json'))).toBe(true);
    });

    it('should have pnpm-workspace.yaml', () => {
      expect(existsSync(join(root, 'pnpm-workspace.yaml'))).toBe(true);
    });

    it('should have root package.json', () => {
      expect(existsSync(join(root, 'package.json'))).toBe(true);
    });
  });

  describe('Build System', () => {
    it('should install dependencies', () => {
      const result = execSync('pnpm install', { encoding: 'utf-8' });
      expect(result).not.toContain('ERR');
    });

    it('should build all packages', () => {
      const result = execSync('pnpm build', { encoding: 'utf-8' });
      expect(result).not.toContain('error');
    });

    it('should run typecheck', () => {
      const result = execSync('pnpm typecheck', { encoding: 'utf-8' });
      expect(result).not.toContain('error');
    });
  });
});
```

---

## Validation Checklist

```
□ Root package.json created with workspaces
□ pnpm-workspace.yaml defines all packages
□ turbo.json configures build pipeline
□ apps/ directory with api, cli, web, mobile, desktop
□ packages/ directory with core, agents, langgraph, database, mcp-servers
□ Shared TypeScript configs in packages/tsconfig
□ Shared ESLint config in packages/config
□ Husky hooks configured
□ Commitlint configured
□ GitHub Actions CI workflow
□ pnpm install succeeds
□ pnpm build succeeds
□ pnpm lint succeeds
□ pnpm typecheck succeeds
```

---

## Next Step

Proceed to **02-POSTGRESQL-SETUP.md** to configure the database layer.
