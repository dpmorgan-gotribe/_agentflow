# Component Structure

Maintain consistent, predictable file organization for both frontend components and backend services. This makes code easy to find, understand, and maintain.

## Frontend Component Structure

### Directory Layout

```
src/components/AgentCard/
├── index.ts                 # Re-export (entry point)
├── AgentCard.tsx            # Main component
├── AgentCard.test.tsx       # Unit tests
├── AgentCard.types.ts       # TypeScript interfaces
├── AgentCard.constants.ts   # Component-specific constants
├── AgentCard.hooks.ts       # Custom hooks (if needed)
└── AgentCard.utils.ts       # Helper functions (if needed)
```

### File Templates

#### index.ts (Re-export)
```typescript
// src/components/AgentCard/index.ts
export { AgentCard } from './AgentCard';
export type { AgentCardProps } from './AgentCard.types';
```

#### Component File
```typescript
// src/components/AgentCard/AgentCard.tsx
import { AgentCardProps } from './AgentCard.types';
import { AGENT_CARD_DEFAULTS } from './AgentCard.constants';

export function AgentCard({ agent, onSelect, variant = 'default' }: AgentCardProps) {
  return (
    <div className="rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${getStatusColor(agent.status)}`} />
        <h3 className="font-semibold text-lg">{agent.name}</h3>
      </div>
      <p className="mt-2 text-sm text-gray-600">{agent.description}</p>
      <button
        onClick={() => onSelect(agent.id)}
        className="mt-4 w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
      >
        Select Agent
      </button>
    </div>
  );
}
```

#### Types File
```typescript
// src/components/AgentCard/AgentCard.types.ts
import { Agent } from '@aigentflow/shared/types';

export interface AgentCardProps {
  agent: Agent;
  onSelect: (agentId: string) => void;
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
}
```

#### Constants File
```typescript
// src/components/AgentCard/AgentCard.constants.ts
export const AGENT_CARD_DEFAULTS = {
  VARIANT: 'default',
  SHOW_ACTIONS: true,
} as const;

export const STATUS_COLORS = {
  active: 'bg-green-500',
  idle: 'bg-gray-400',
  error: 'bg-red-500',
  running: 'bg-blue-500',
} as const;
```

#### Test File
```typescript
// src/components/AgentCard/AgentCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AgentCard } from './AgentCard';
import { mockAgent } from '@/test/fixtures';

describe('AgentCard', () => {
  it('renders agent name and description', () => {
    render(<AgentCard agent={mockAgent} onSelect={vi.fn()} />);

    expect(screen.getByText(mockAgent.name)).toBeInTheDocument();
    expect(screen.getByText(mockAgent.description)).toBeInTheDocument();
  });

  it('calls onSelect when button is clicked', () => {
    const onSelect = vi.fn();
    render(<AgentCard agent={mockAgent} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /select/i }));

    expect(onSelect).toHaveBeenCalledWith(mockAgent.id);
  });
});
```

---

## Backend Service Structure

### Directory Layout

```
src/services/agent/
├── index.ts                 # Re-export (entry point)
├── agent.service.ts         # Service class
├── agent.service.test.ts    # Unit tests
├── agent.repository.ts      # Data access layer
├── agent.types.ts           # TypeScript interfaces
├── agent.constants.ts       # Service constants
├── agent.validators.ts      # Zod schemas
└── agent.errors.ts          # Domain errors
```

### File Templates

#### index.ts (Re-export)
```typescript
// src/services/agent/index.ts
export { AgentService } from './agent.service';
export { AgentRepository } from './agent.repository';
export * from './agent.types';
export * from './agent.errors';
```

#### Service File
```typescript
// src/services/agent/agent.service.ts
import { Injectable } from '@nestjs/common';
import { AgentRepository } from './agent.repository';
import { CreateAgentDto, UpdateAgentDto, Agent } from './agent.types';
import { AgentNotFoundError, AgentExecutionError } from './agent.errors';
import { createAgentSchema } from './agent.validators';

@Injectable()
export class AgentService {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly eventBus: EventBus,
  ) {}

  async create(dto: CreateAgentDto, tenantId: string): Promise<Agent> {
    const validated = createAgentSchema.parse(dto);

    const agent = await this.agentRepository.create({
      ...validated,
      tenantId,
    });

    await this.eventBus.emit('agent.created', { agent });

    return agent;
  }

  async findById(id: string, tenantId: string): Promise<Agent> {
    const agent = await this.agentRepository.findById(id, tenantId);

    if (!agent) {
      throw new AgentNotFoundError(id);
    }

    return agent;
  }

  async execute(id: string, tenantId: string, input: unknown): Promise<AgentOutput> {
    const agent = await this.findById(id, tenantId);

    try {
      return await agent.execute(input);
    } catch (error) {
      throw new AgentExecutionError(id, error);
    }
  }
}
```

#### Repository File
```typescript
// src/services/agent/agent.repository.ts
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/database';
import { agents } from '@/database/schema';
import { eq, and } from 'drizzle-orm';
import { Agent, CreateAgentInput } from './agent.types';

@Injectable()
export class AgentRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(input: CreateAgentInput): Promise<Agent> {
    const [agent] = await this.db
      .insert(agents)
      .values(input)
      .returning();

    return agent;
  }

  async findById(id: string, tenantId: string): Promise<Agent | null> {
    const agent = await this.db.query.agents.findFirst({
      where: and(
        eq(agents.id, id),
        eq(agents.tenantId, tenantId)
      ),
    });

    return agent ?? null;
  }

  async findAll(tenantId: string): Promise<Agent[]> {
    return this.db.query.agents.findMany({
      where: eq(agents.tenantId, tenantId),
      orderBy: (agents, { desc }) => [desc(agents.createdAt)],
    });
  }
}
```

#### Types File
```typescript
// src/services/agent/agent.types.ts
export interface Agent {
  id: string;
  tenantId: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  configuration: AgentConfiguration;
  createdAt: Date;
  updatedAt: Date;
}

export type AgentType = 'orchestrator' | 'specialist' | 'reviewer';
export type AgentStatus = 'active' | 'idle' | 'running' | 'error';

export interface CreateAgentDto {
  name: string;
  type: AgentType;
  configuration?: Partial<AgentConfiguration>;
}

export interface UpdateAgentDto {
  name?: string;
  configuration?: Partial<AgentConfiguration>;
}
```

#### Validators File
```typescript
// src/services/agent/agent.validators.ts
import { z } from 'zod';

export const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['orchestrator', 'specialist', 'reviewer']),
  configuration: z.object({
    maxRetries: z.number().int().min(0).max(10).optional(),
    timeoutMs: z.number().int().min(1000).max(600000).optional(),
  }).optional(),
});

export const updateAgentSchema = createAgentSchema.partial();

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
```

#### Errors File
```typescript
// src/services/agent/agent.errors.ts
import { DomainError } from '@aigentflow/shared/errors';
import { ERROR_CODES } from '@aigentflow/shared/constants';

export class AgentNotFoundError extends DomainError {
  readonly code = ERROR_CODES.AGENT_NOT_FOUND;
  readonly statusCode = 404;

  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`, { agentId });
  }
}

export class AgentExecutionError extends DomainError {
  readonly code = ERROR_CODES.AGENT_EXECUTION_FAILED;
  readonly statusCode = 500;

  constructor(agentId: string, cause?: Error) {
    super(`Agent execution failed: ${agentId}`, {
      agentId,
      cause: cause?.message,
    });
  }
}
```

---

## Import Patterns

### Always Import from Index

```typescript
// ✅ Good - import from index
import { AgentCard } from '@/components/AgentCard';
import { AgentService } from '@/services/agent';

// ❌ Bad - deep import
import { AgentCard } from '@/components/AgentCard/AgentCard';
import { AgentService } from '@/services/agent/agent.service';
```

### Barrel Exports

```typescript
// src/components/index.ts
export { AgentCard } from './AgentCard';
export { TaskList } from './TaskList';
export { Header } from './Header';
// ...

// Usage
import { AgentCard, TaskList, Header } from '@/components';
```

---

## Naming Conventions

| File Type | Convention | Example |
|-----------|------------|---------|
| Component | PascalCase | `AgentCard.tsx` |
| Service | kebab + .service | `agent.service.ts` |
| Repository | kebab + .repository | `agent.repository.ts` |
| Types | kebab + .types | `agent.types.ts` |
| Constants | kebab + .constants | `agent.constants.ts` |
| Validators | kebab + .validators | `agent.validators.ts` |
| Errors | kebab + .errors | `agent.errors.ts` |
| Tests | match source + .test | `AgentCard.test.tsx` |
| Hooks | kebab + .hooks | `agent.hooks.ts` |
| Utils | kebab + .utils | `agent.utils.ts` |

---

## When to Split Files

### Do Split When:
- File exceeds ~200 lines
- Multiple distinct responsibilities
- Reusable logic emerges
- Types become complex

### Don't Split When:
- Creating single-use helpers
- File is cohesive and readable
- Split would scatter related code

---

## Anti-Patterns

### God Components/Services

```typescript
// ❌ Bad - too many responsibilities
class AgentService {
  createAgent() {}
  executeAgent() {}
  sendEmail() {}
  generateReport() {}
  syncToExternalSystem() {}
  // ... 20 more methods
}

// ✅ Good - focused responsibilities
class AgentService { /* agent CRUD + execution */ }
class NotificationService { /* email, push, etc */ }
class ReportService { /* report generation */ }
class SyncService { /* external system sync */ }
```

### Missing Index Files

```typescript
// ❌ Bad - no index, users must know internals
import { AgentCard } from '@/components/AgentCard/AgentCard';

// ✅ Good - index provides clean API
import { AgentCard } from '@/components/AgentCard';
```

### Inconsistent Structure

```typescript
// ❌ Bad - different structure in each component
components/
├── AgentCard/
│   └── index.tsx          # Component in index
├── TaskList.tsx           # Flat file
└── Header/
    ├── Header.component.tsx  # Different naming
    └── styles.css            # CSS file

// ✅ Good - consistent structure everywhere
components/
├── AgentCard/
│   ├── index.ts
│   └── AgentCard.tsx
├── TaskList/
│   ├── index.ts
│   └── TaskList.tsx
└── Header/
    ├── index.ts
    └── Header.tsx
```
