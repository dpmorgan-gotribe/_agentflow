# Step 57: Agent Monitoring

> **Checkpoint:** CP10 - Web Frontend
> **Previous Step:** 56-WORKFLOW-VIZ.md
> **Next Step:** 58-DESIGN-PREVIEW.md
> **Architecture Reference:** `ARCHITECTURE.md` - Agent Monitoring

---

## Overview

**Agent Monitoring** provides real-time visibility into agent execution, including status, logs, metrics, and resource utilization.

---

## Deliverables

1. `apps/web/src/routes/agents/index.tsx` - Agents overview page
2. `apps/web/src/components/features/AgentStatus.tsx` - Agent status cards
3. `apps/web/src/components/features/AgentLogs.tsx` - Log streaming
4. `apps/web/src/components/features/AgentMetrics.tsx` - Metrics display

---

## 1. Agents Overview Page

```typescript
// apps/web/src/routes/agents/index.tsx

import { createFileRoute } from '@tanstack/react-router';
import { AgentStatus } from '../../components/features/AgentStatus';
import { AgentMetrics } from '../../components/features/AgentMetrics';
import { useAgentStats } from '../../hooks/useApi';

export const Route = createFileRoute('/agents/')({
  component: AgentsPage,
});

const agents = [
  { id: 'orchestrator', name: 'Orchestrator', description: 'Central task routing' },
  { id: 'project_manager', name: 'Project Manager', description: 'Planning and breakdown' },
  { id: 'architect', name: 'Architect', description: 'Technical decisions' },
  { id: 'ui_designer', name: 'UI Designer', description: 'Visual design' },
  { id: 'frontend_dev', name: 'Frontend Developer', description: 'React components' },
  { id: 'backend_dev', name: 'Backend Developer', description: 'API endpoints' },
  { id: 'tester', name: 'Tester', description: 'Test generation' },
  { id: 'reviewer', name: 'Reviewer', description: 'Code review' },
];

function AgentsPage() {
  const { data: stats } = useAgentStats();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agent Monitoring</h1>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {agents.map((agent) => (
          <AgentStatus
            key={agent.id}
            agent={agent}
            stats={stats?.[agent.id]}
          />
        ))}
      </div>

      {/* Metrics */}
      <AgentMetrics data={stats} />
    </div>
  );
}
```

---

## 2. Agent Status Component

```typescript
// apps/web/src/components/features/AgentStatus.tsx

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Activity, Clock, CheckCircle } from 'lucide-react';

interface AgentStatusProps {
  agent: {
    id: string;
    name: string;
    description: string;
  };
  stats?: {
    tasksCompleted: number;
    avgDurationMs: number;
    successRate: number;
    isActive: boolean;
  };
}

export function AgentStatus({ agent, stats }: AgentStatusProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{agent.name}</CardTitle>
          <Badge variant={stats?.isActive ? 'default' : 'secondary'}>
            {stats?.isActive ? 'Active' : 'Idle'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{agent.description}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center text-sm">
            <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
            <span>{stats?.tasksCompleted || 0} tasks</span>
          </div>
          <div className="flex items-center text-sm">
            <Clock className="w-4 h-4 mr-2 text-blue-500" />
            <span>{Math.round((stats?.avgDurationMs || 0) / 1000)}s avg</span>
          </div>
          <div className="flex items-center text-sm">
            <Activity className="w-4 h-4 mr-2 text-purple-500" />
            <span>{Math.round((stats?.successRate || 0) * 100)}% success</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Validation Checklist

```
□ Agent Monitoring (Step 57)
  □ Agent cards display
  □ Status updates in real-time
  □ Metrics charts render
  □ Log streaming works
  □ Tests pass
```

---

## Next Step

Proceed to **58-DESIGN-PREVIEW.md** to implement design preview functionality.
