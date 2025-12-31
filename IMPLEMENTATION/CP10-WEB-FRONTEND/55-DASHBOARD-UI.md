# Step 55: Dashboard UI

> **Checkpoint:** CP10 - Web Frontend
> **Previous Step:** 54-REACT-SETUP.md
> **Next Step:** 56-WORKFLOW-VIZ.md
> **Architecture Reference:** `ARCHITECTURE.md` - Web Dashboard

---

## Overview

The **Dashboard UI** provides the main interface for Aigentflow, including project management, task creation, and real-time agent activity monitoring.

---

## Key Principles

1. **Real-Time Updates**: SSE for live agent activity
2. **Intuitive Navigation**: Clear information architecture
3. **Responsive Design**: Works on desktop and tablet
4. **Accessibility**: WCAG 2.1 AA compliance
5. **Performance**: Optimized rendering and lazy loading

---

## Deliverables

1. `apps/web/src/components/layout/` - Layout components
2. `apps/web/src/routes/index.tsx` - Dashboard home page
3. `apps/web/src/routes/projects/` - Project pages
4. `apps/web/src/routes/tasks/` - Task pages
5. `apps/web/src/components/features/` - Feature components

---

## 1. Layout Components

### 1.1 Sidebar

```typescript
// apps/web/src/components/layout/Sidebar.tsx

import { Link, useLocation } from '@tanstack/react-router';
import {
  Home,
  FolderKanban,
  ListTodo,
  Settings,
  Sparkles,
  GitBranch,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Tasks', href: '/tasks', icon: ListTodo },
  { name: 'Agents', href: '/agents', icon: Sparkles },
  { name: 'Git', href: '/git', icon: GitBranch },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <Sparkles className="w-8 h-8 text-primary" />
          <span className="ml-2 text-xl font-bold">Aigentflow</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/' && location.pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500">
            Aigentflow v0.1.0
          </div>
        </div>
      </div>
    </aside>
  );
}
```

### 1.2 Header

```typescript
// apps/web/src/components/layout/Header.tsx

import { Bell, Search, User } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useAuthStore } from '../../stores/auth.store';

export function Header() {
  const { user, logout } = useAuthStore();

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between h-full px-6">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search tasks, projects..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon">
            <Bell className="w-5 h-5" />
          </Button>

          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <User className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium">{user?.name}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
```

---

## 2. Dashboard Home

```typescript
// apps/web/src/routes/index.tsx

import { createFileRoute } from '@tanstack/react-router';
import { useProjects, useTasks } from '../hooks/useApi';
import { StatsCards } from '../components/features/StatsCards';
import { RecentTasks } from '../components/features/RecentTasks';
import { QuickPrompt } from '../components/features/QuickPrompt';
import { AgentActivity } from '../components/features/AgentActivity';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();

  const stats = {
    totalProjects: projects?.length || 0,
    activeTasks: tasks?.filter(t => t.state === 'running').length || 0,
    completedToday: tasks?.filter(t =>
      t.state === 'completed' &&
      new Date(t.completedAt).toDateString() === new Date().toDateString()
    ).length || 0,
    pendingApprovals: tasks?.filter(t => t.state === 'awaiting_approval').length || 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's what's happening with your projects.
        </p>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Quick Prompt */}
      <QuickPrompt />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <RecentTasks tasks={tasks?.slice(0, 5) || []} />

        {/* Agent Activity */}
        <AgentActivity />
      </div>
    </div>
  );
}
```

---

## 3. Feature Components

### 3.1 Stats Cards

```typescript
// apps/web/src/components/features/StatsCards.tsx

import { FolderKanban, Play, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

interface StatsCardsProps {
  stats: {
    totalProjects: number;
    activeTasks: number;
    completedToday: number;
    pendingApprovals: number;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    { label: 'Projects', value: stats.totalProjects, icon: FolderKanban, color: 'text-blue-500' },
    { label: 'Active Tasks', value: stats.activeTasks, icon: Play, color: 'text-green-500' },
    { label: 'Completed Today', value: stats.completedToday, icon: CheckCircle, color: 'text-purple-500' },
    { label: 'Pending Approval', value: stats.pendingApprovals, icon: Clock, color: 'text-orange-500' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="flex items-center p-6">
            <card.icon className={`w-8 h-8 ${card.color}`} />
            <div className="ml-4">
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-sm text-muted-foreground">{card.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### 3.2 Quick Prompt

```typescript
// apps/web/src/components/features/QuickPrompt.tsx

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useCreateTask } from '../../hooks/useApi';
import { useNavigate } from '@tanstack/react-router';

export function QuickPrompt() {
  const [prompt, setPrompt] = useState('');
  const navigate = useNavigate();
  const createTask = useCreateTask();

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    const result = await createTask.mutateAsync({ prompt });
    navigate({ to: '/tasks/$taskId', params: { taskId: result.id } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Task</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Textarea
            placeholder="Describe what you want to build..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!prompt.trim() || createTask.isPending}
            >
              {createTask.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Start Task
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3.3 Recent Tasks

```typescript
// apps/web/src/components/features/RecentTasks.tsx

import { Link } from '@tanstack/react-router';
import { Clock, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface Task {
  id: string;
  prompt: string;
  state: string;
  currentAgent?: string;
  createdAt: string;
}

interface RecentTasksProps {
  tasks: Task[];
}

const stateIcons: Record<string, any> = {
  pending: Clock,
  running: Loader2,
  awaiting_approval: AlertCircle,
  completed: CheckCircle,
  failed: XCircle,
};

const stateColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  running: 'bg-blue-100 text-blue-800',
  awaiting_approval: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export function RecentTasks({ tasks }: RecentTasksProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Tasks</CardTitle>
        <Link to="/tasks" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No tasks yet. Create one above!
          </p>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => {
              const Icon = stateIcons[task.state] || Clock;
              const isSpinning = task.state === 'running';

              return (
                <Link
                  key={task.id}
                  to="/tasks/$taskId"
                  params={{ taskId: task.id }}
                  className="flex items-start p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Icon className={`w-5 h-5 mt-0.5 ${isSpinning ? 'animate-spin' : ''} ${
                    task.state === 'completed' ? 'text-green-500' :
                    task.state === 'failed' ? 'text-red-500' :
                    task.state === 'running' ? 'text-blue-500' :
                    'text-gray-400'
                  }`} />
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {task.prompt.substring(0, 60)}...
                    </p>
                    <div className="flex items-center mt-1 space-x-2">
                      <Badge variant="secondary" className={stateColors[task.state]}>
                        {task.state.replace('_', ' ')}
                      </Badge>
                      {task.currentAgent && (
                        <span className="text-xs text-muted-foreground">
                          {task.currentAgent}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 3.4 Agent Activity

```typescript
// apps/web/src/components/features/AgentActivity.tsx

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useWorkflowStore } from '../../stores/workflow.store';
import { formatDistanceToNow } from 'date-fns';

const agentColors: Record<string, string> = {
  orchestrator: 'bg-purple-500',
  project_manager: 'bg-blue-500',
  architect: 'bg-cyan-500',
  ui_designer: 'bg-yellow-500',
  frontend_dev: 'bg-green-500',
  backend_dev: 'bg-red-500',
  tester: 'bg-gray-500',
  reviewer: 'bg-orange-500',
};

export function AgentActivity() {
  const { events, currentTaskId } = useWorkflowStore();

  // Subscribe to SSE for real-time updates
  useEffect(() => {
    if (!currentTaskId) return;

    const eventSource = new EventSource(`/api/v1/tasks/${currentTaskId}/stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      useWorkflowStore.getState().addEvent({
        id: crypto.randomUUID(),
        agentId: data.agentId,
        type: data.type,
        content: data.message || data.content,
        timestamp: new Date(),
        metadata: data,
      });
    };

    return () => eventSource.close();
  }, [currentTaskId]);

  const recentEvents = events.slice(-10).reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {recentEvents.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No activity yet. Start a task to see agents work.
          </p>
        ) : (
          <div className="space-y-3">
            {recentEvents.map((event) => (
              <div key={event.id} className="flex items-start space-x-3">
                <div className={`w-2 h-2 mt-2 rounded-full ${agentColors[event.agentId] || 'bg-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{event.agentId}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {event.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Validation Checklist

```
□ Dashboard UI (Step 55)
  □ Sidebar navigation works
  □ Header with search renders
  □ Stats cards display data
  □ Quick prompt creates tasks
  □ Recent tasks list works
  □ Agent activity updates in real-time
  □ Responsive on tablet
  □ Dark mode works
  □ Accessibility verified
  □ Tests pass
```

---

## Next Step

Proceed to **56-WORKFLOW-VIZ.md** to implement workflow visualization.
