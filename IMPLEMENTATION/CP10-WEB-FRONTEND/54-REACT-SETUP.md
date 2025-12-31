# Step 54: React Setup

> **Checkpoint:** CP10 - Web Frontend
> **Previous Step:** 32-GENUI-OUTPUT.md (CP9)
> **Next Step:** 55-DASHBOARD-UI.md
> **Architecture Reference:** `ARCHITECTURE.md` - Web Frontend

---

## Overview

The **React Setup** establishes the web frontend application using React with TanStack Router, Zustand for state management, and TanStack Query for server state. This provides the foundation for the Aigentflow dashboard.

---

## Key Principles

1. **Type Safety**: Full TypeScript with strict mode
2. **Modern Routing**: TanStack Router for type-safe routing
3. **State Management**: Zustand for client state, TanStack Query for server state
4. **Component Library**: shadcn/ui with Tailwind CSS
5. **API Integration**: tRPC client for type-safe API calls

---

## Deliverables

1. `apps/web/` - React application structure
2. `apps/web/src/routes/` - TanStack Router configuration
3. `apps/web/src/stores/` - Zustand stores
4. `apps/web/src/hooks/` - Custom hooks including TanStack Query
5. `apps/web/src/components/ui/` - shadcn/ui components

---

## 1. Package Configuration

```json
// apps/web/package.json
{
  "name": "@aigentflow/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-router": "^1.0.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0",
    "tailwindcss": "^3.4.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

---

## 2. Application Structure

```
apps/web/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx              # Entry point
│   ├── App.tsx               # Root component
│   ├── routes/
│   │   ├── __root.tsx        # Root layout
│   │   ├── index.tsx         # Home page
│   │   ├── projects/
│   │   │   ├── index.tsx     # Projects list
│   │   │   └── $projectId.tsx # Project detail
│   │   ├── tasks/
│   │   │   ├── index.tsx     # Tasks list
│   │   │   └── $taskId.tsx   # Task detail
│   │   └── settings.tsx      # Settings page
│   ├── stores/
│   │   ├── auth.store.ts
│   │   ├── ui.store.ts
│   │   └── workflow.store.ts
│   ├── hooks/
│   │   ├── useApi.ts
│   │   ├── useAuth.ts
│   │   └── useWorkflow.ts
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── layout/
│   │   └── features/
│   ├── lib/
│   │   ├── api.ts
│   │   ├── trpc.ts
│   │   └── utils.ts
│   └── styles/
│       └── globals.css
```

---

## 3. Router Configuration

```typescript
// apps/web/src/routes/__root.tsx

import { Outlet, createRootRoute } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, trpcClient } from '../lib/trpc';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 2,
    },
  },
});

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-auto p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

---

## 4. State Management

### 4.1 Auth Store

```typescript
// apps/web/src/stores/auth.store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) => set({
        user,
        token,
        isAuthenticated: true,
      }),

      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false,
      }),

      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),
    }),
    {
      name: 'aigentflow-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    }
  )
);
```

### 4.2 Workflow Store

```typescript
// apps/web/src/stores/workflow.store.ts

import { create } from 'zustand';

interface AgentEvent {
  id: string;
  agentId: string;
  type: 'start' | 'message' | 'artifact' | 'complete' | 'error';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface WorkflowState {
  currentTaskId: string | null;
  events: AgentEvent[];
  isStreaming: boolean;
  pendingApproval: {
    taskId: string;
    agentId: string;
    artifacts: Array<{ type: string; path: string; content: string }>;
  } | null;

  setCurrentTask: (taskId: string | null) => void;
  addEvent: (event: AgentEvent) => void;
  clearEvents: () => void;
  setStreaming: (streaming: boolean) => void;
  setPendingApproval: (approval: WorkflowState['pendingApproval']) => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  currentTaskId: null,
  events: [],
  isStreaming: false,
  pendingApproval: null,

  setCurrentTask: (taskId) => set({ currentTaskId: taskId, events: [] }),

  addEvent: (event) => set((state) => ({
    events: [...state.events, event],
  })),

  clearEvents: () => set({ events: [] }),

  setStreaming: (isStreaming) => set({ isStreaming }),

  setPendingApproval: (pendingApproval) => set({ pendingApproval }),
}));
```

---

## 5. API Integration

### 5.1 tRPC Client

```typescript
// apps/web/src/lib/trpc.ts

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@aigentflow/api';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      headers() {
        const token = localStorage.getItem('aigentflow-auth');
        if (token) {
          const parsed = JSON.parse(token);
          return {
            Authorization: `Bearer ${parsed.state?.token}`,
          };
        }
        return {};
      },
    }),
  ],
});
```

### 5.2 API Hooks

```typescript
// apps/web/src/hooks/useApi.ts

import { trpc } from '../lib/trpc';

export function useProjects() {
  return trpc.projects.list.useQuery();
}

export function useProject(id: string) {
  return trpc.projects.get.useQuery({ id });
}

export function useTasks(projectId?: string) {
  return trpc.tasks.list.useQuery({ projectId });
}

export function useTask(id: string) {
  return trpc.tasks.get.useQuery({ id });
}

export function useCreateTask() {
  const utils = trpc.useUtils();

  return trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
    },
  });
}

export function useApproveTask() {
  const utils = trpc.useUtils();

  return trpc.tasks.approve.useMutation({
    onSuccess: (_, variables) => {
      utils.tasks.get.invalidate({ id: variables.taskId });
    },
  });
}
```

---

## 6. Component Library Setup

### 6.1 Tailwind Configuration

```typescript
// apps/web/tailwind.config.ts

import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

### 6.2 Button Component

```typescript
// apps/web/src/components/ui/button.tsx

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
```

---

## Validation Checklist

```
□ React Setup (Step 54)
  □ Vite builds successfully
  □ TanStack Router configured
  □ Routes type-safe and working
  □ Zustand stores functioning
  □ TanStack Query connected
  □ tRPC client working
  □ Tailwind CSS configured
  □ shadcn/ui components available
  □ Dark mode toggle works
  □ Tests pass
```

---

## Next Step

Proceed to **55-DASHBOARD-UI.md** to implement the main dashboard interface.
