# Step 24a: Early Web Interface

> **Checkpoint:** CP2 - Design System
> **Previous Step:** 08b-DESIGN-WORKFLOW.md
> **Next Step:** 09-GIT-AGENT.md (CP3)

---

## Overview

This step creates a **minimal React web interface** that allows users to:

1. **Prompt the orchestrator** with an app idea
2. **Watch agents work** in real-time via a chat-like feed
3. **View design outputs** (mockups, stylesheets, flows)
4. **Approve or reject** designs when the orchestrator pauses

This interface lives in `apps/web/` and will be **overwritten** by the full dashboard in CP10. It provides immediate visual feedback for testing the orchestrator and design workflow.

---

## Deliverables

1. React application in `apps/web/`
2. Prompt input component
3. Real-time agent activity feed (SSE)
4. Design artifact preview (mockups, styles, flows)
5. Approval/rejection interface
6. Artifacts API endpoint in NestJS

---

## 1. Package Configuration

### 1.1 apps/web/package.json

```json
{
  "name": "@aigentflow/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@aigentflow/tsconfig": "workspace:*",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.0.0"
  }
}
```

### 1.2 apps/web/vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

### 1.3 apps/web/tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1',
        secondary: '#8b5cf6',
      },
    },
  },
  plugins: [],
};
```

---

## 2. Application Structure

```
apps/web/
├── src/
│   ├── main.tsx                 # Entry point
│   ├── App.tsx                  # Main app component
│   ├── components/
│   │   ├── PromptBar.tsx        # Prompt input form
│   │   ├── AgentFeed.tsx        # Activity stream container
│   │   ├── AgentMessage.tsx     # Single agent message + SelfReviewBadge
│   │   ├── DesignPreview.tsx    # Design artifact viewer
│   │   ├── ArtifactViewer.tsx   # Individual artifact display
│   │   └── ApprovalDialog.tsx   # Approval/rejection UI
│   ├── hooks/
│   │   ├── useTaskStream.ts     # SSE connection hook
│   │   └── useArtifacts.ts      # Artifact fetching hook
│   ├── types.ts                 # TypeScript interfaces (incl. SelfReviewSummary)
│   └── api.ts                   # API client functions
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── tsconfig.json
```

---

## 3. Core Components

### 3.1 src/main.tsx

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/main.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 3.2 src/App.tsx

```typescript
import { useState } from 'react';
import { PromptBar } from './components/PromptBar';
import { AgentFeed } from './components/AgentFeed';
import { DesignPreview } from './components/DesignPreview';
import { ApprovalDialog } from './components/ApprovalDialog';
import type { Task, AgentEvent, ApprovalRequest } from './types';

export default function App() {
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);

  const handleTaskCreated = (task: Task) => {
    setCurrentTask(task);
    setEvents([]);
    setApprovalRequest(null);
  };

  const handleEvent = (event: AgentEvent) => {
    setEvents(prev => [...prev, event]);

    // Check for approval request
    if (event.status === 'awaiting_approval' && event.approvalRequest) {
      setApprovalRequest(event.approvalRequest);
    }
  };

  const handleApprovalComplete = () => {
    setApprovalRequest(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 p-4">
        <h1 className="text-xl font-bold text-primary">
          Aigentflow <span className="text-gray-500 text-sm">Early Preview</span>
        </h1>
      </header>

      {/* Prompt Bar */}
      <div className="border-b border-gray-800 p-4">
        <PromptBar
          onTaskCreated={handleTaskCreated}
          disabled={currentTask?.status === 'running'}
        />
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-140px)]">
        {/* Agent Feed */}
        <div className="w-1/2 border-r border-gray-800 overflow-y-auto p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-4">
            Agent Activity
          </h2>
          <AgentFeed
            taskId={currentTask?.id}
            events={events}
            onEvent={handleEvent}
          />
        </div>

        {/* Design Preview */}
        <div className="w-1/2 overflow-y-auto p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-4">
            Design Preview
          </h2>
          <DesignPreview taskId={currentTask?.id} />
        </div>
      </div>

      {/* Approval Dialog */}
      {approvalRequest && currentTask && (
        <ApprovalDialog
          taskId={currentTask.id}
          request={approvalRequest}
          onComplete={handleApprovalComplete}
        />
      )}
    </div>
  );
}
```

### 3.3 src/components/PromptBar.tsx

```typescript
import { useState } from 'react';
import { createTask } from '../api';
import type { Task } from '../types';

interface PromptBarProps {
  onTaskCreated: (task: Task) => void;
  disabled?: boolean;
}

export function PromptBar({ onTaskCreated, disabled }: PromptBarProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || disabled) return;

    setLoading(true);
    try {
      const task = await createTask(prompt);
      onTaskCreated(task);
      setPrompt('');
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the app you want to build..."
        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3
                   text-white placeholder-gray-500 resize-none h-20
                   focus:outline-none focus:border-primary"
        disabled={disabled || loading}
      />
      <button
        type="submit"
        disabled={disabled || loading || !prompt.trim()}
        className="px-6 py-2 bg-primary hover:bg-primary/90 rounded-lg
                   font-semibold disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors h-20"
      >
        {loading ? 'Starting...' : 'Run'}
      </button>
    </form>
  );
}
```

### 3.4 src/components/AgentFeed.tsx

```typescript
import { useEffect, useRef } from 'react';
import { AgentMessage } from './AgentMessage';
import { useTaskStream } from '../hooks/useTaskStream';
import type { AgentEvent } from '../types';

interface AgentFeedProps {
  taskId: string | undefined;
  events: AgentEvent[];
  onEvent: (event: AgentEvent) => void;
}

export function AgentFeed({ taskId, events, onEvent }: AgentFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Connect to SSE stream
  useTaskStream(taskId, onEvent);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  if (!taskId) {
    return (
      <div className="text-gray-500 text-center py-8">
        Enter a prompt above to start
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        <div className="animate-pulse">Connecting...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, index) => (
        <AgentMessage key={index} event={event} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

### 3.5 src/components/AgentMessage.tsx

```typescript
import type { AgentEvent, SelfReviewSummary } from '../types';

interface AgentMessageProps {
  event: AgentEvent;
}

const AGENT_ICONS: Record<string, string> = {
  orchestrator: '🤖',
  project_manager: '📋',
  architect: '🏗️',
  analyst: '🔍',
  ui_designer: '🎨',
  frontend_developer: '💻',
  backend_developer: '⚙️',
  tester: '🧪',
  bug_fixer: '🔧',
  reviewer: '👁️',
  git_agent: '📦',
};

const AGENT_NAMES: Record<string, string> = {
  orchestrator: 'Orchestrator',
  project_manager: 'Project Manager',
  architect: 'Architect',
  analyst: 'Analyst',
  ui_designer: 'UI Designer',
  frontend_developer: 'Frontend Developer',
  backend_developer: 'Backend Developer',
  tester: 'Tester',
  bug_fixer: 'Bug Fixer',
  reviewer: 'Reviewer',
  git_agent: 'Git Agent',
};

export function AgentMessage({ event }: AgentMessageProps) {
  const icon = AGENT_ICONS[event.agent] || '🔹';
  const name = AGENT_NAMES[event.agent] || event.agent;
  const isWaiting = event.status === 'awaiting_approval';
  const isComplete = event.status === 'completed';
  const isError = event.status === 'failed';

  return (
    <div
      className={`p-3 rounded-lg border ${
        isWaiting
          ? 'border-yellow-500/50 bg-yellow-500/10'
          : isComplete
          ? 'border-green-500/50 bg-green-500/10'
          : isError
          ? 'border-red-500/50 bg-red-500/10'
          : 'border-gray-700 bg-gray-800'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="font-semibold text-sm">{name}</span>
        <span className="text-xs text-gray-500 ml-auto">
          {formatTime(event.timestamp)}
        </span>
      </div>
      <div className="text-sm text-gray-300 whitespace-pre-wrap">
        {event.message}
      </div>

      {/* Self-Review Status Badge */}
      {event.selfReview && (
        <SelfReviewBadge review={event.selfReview} />
      )}

      {event.artifacts && event.artifacts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {event.artifacts.map((artifact, i) => (
            <span
              key={i}
              className="text-xs bg-gray-700 px-2 py-1 rounded"
            >
              {artifact.type}: {artifact.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Displays self-review status with quality scores and iteration info
 */
function SelfReviewBadge({ review }: { review: SelfReviewSummary }) {
  const qualityPercent = Math.round(review.qualityScore * 100);
  const completenessPercent = Math.round(review.completenessScore * 100);

  // Determine badge color based on decision
  const badgeColor = {
    approved: 'bg-green-500/20 border-green-500/50 text-green-400',
    needs_work: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
    escalate: 'bg-red-500/20 border-red-500/50 text-red-400',
  }[review.decision];

  // Quality score bar color
  const qualityBarColor =
    qualityPercent >= 80 ? 'bg-green-500' :
    qualityPercent >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`mt-3 p-2 rounded border ${badgeColor}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium flex items-center gap-1">
          <span>🔍</span>
          Self-Review
          <span className="text-gray-500">
            ({review.iteration}/{review.maxIterations})
          </span>
        </span>
        <span className="text-xs capitalize">
          {review.decision.replace('_', ' ')}
        </span>
      </div>

      {/* Quality Score Bar */}
      <div className="mb-1">
        <div className="flex justify-between text-xs mb-1">
          <span>Quality</span>
          <span>{qualityPercent}%</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${qualityBarColor} transition-all`}
            style={{ width: `${qualityPercent}%` }}
          />
        </div>
      </div>

      {/* Completeness Score Bar */}
      <div className="mb-1">
        <div className="flex justify-between text-xs mb-1">
          <span>Completeness</span>
          <span>{completenessPercent}%</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${completenessPercent}%` }}
          />
        </div>
      </div>

      {/* Gaps Summary */}
      {review.gapsCount > 0 && (
        <div className="text-xs mt-2 flex gap-2">
          <span className="text-gray-400">Gaps: {review.gapsCount}</span>
          {review.criticalGapsCount > 0 && (
            <span className="text-red-400">
              ({review.criticalGapsCount} critical)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}
```

### 3.6 src/components/DesignPreview.tsx

```typescript
import { useState } from 'react';
import { useArtifacts } from '../hooks/useArtifacts';
import { ArtifactViewer } from './ArtifactViewer';
import type { Artifact } from '../types';

interface DesignPreviewProps {
  taskId: string | undefined;
}

type TabType = 'mockups' | 'stylesheets' | 'flows';

export function DesignPreview({ taskId }: DesignPreviewProps) {
  const { artifacts, loading } = useArtifacts(taskId);
  const [activeTab, setActiveTab] = useState<TabType>('mockups');
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  if (!taskId) {
    return (
      <div className="text-gray-500 text-center py-8">
        Designs will appear here
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-gray-500 text-center py-8">
        <div className="animate-pulse">Loading artifacts...</div>
      </div>
    );
  }

  const mockups = artifacts.filter(a => a.type === 'mockup');
  const stylesheets = artifacts.filter(a => a.type === 'stylesheet');
  const flows = artifacts.filter(a => a.type === 'flow');

  const currentArtifacts = {
    mockups,
    stylesheets,
    flows,
  }[activeTab];

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <TabButton
          active={activeTab === 'mockups'}
          onClick={() => setActiveTab('mockups')}
          count={mockups.length}
        >
          🎨 Mockups
        </TabButton>
        <TabButton
          active={activeTab === 'stylesheets'}
          onClick={() => setActiveTab('stylesheets')}
          count={stylesheets.length}
        >
          📝 Styles
        </TabButton>
        <TabButton
          active={activeTab === 'flows'}
          onClick={() => setActiveTab('flows')}
          count={flows.length}
        >
          📊 Flows
        </TabButton>
      </div>

      {/* Artifact List */}
      {currentArtifacts.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          No {activeTab} yet
        </div>
      ) : (
        <div className="flex-1 flex gap-4">
          {/* Artifact selector */}
          <div className="w-48 space-y-2">
            {currentArtifacts.map((artifact) => (
              <button
                key={artifact.id}
                onClick={() => setSelectedArtifact(artifact)}
                className={`w-full text-left p-2 rounded text-sm ${
                  selectedArtifact?.id === artifact.id
                    ? 'bg-primary text-white'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {artifact.name}
              </button>
            ))}
          </div>

          {/* Artifact viewer */}
          <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden">
            {selectedArtifact ? (
              <ArtifactViewer artifact={selectedArtifact} />
            ) : (
              <div className="text-gray-500 text-center py-8">
                Select an artifact to preview
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-white'
          : 'bg-gray-800 text-gray-400 hover:text-white'
      }`}
    >
      {children}
      {count > 0 && (
        <span className="ml-1.5 bg-gray-700 px-1.5 py-0.5 rounded text-xs">
          {count}
        </span>
      )}
    </button>
  );
}
```

### 3.7 src/components/ArtifactViewer.tsx

```typescript
import type { Artifact } from '../types';

interface ArtifactViewerProps {
  artifact: Artifact;
}

export function ArtifactViewer({ artifact }: ArtifactViewerProps) {
  switch (artifact.type) {
    case 'mockup':
      return (
        <iframe
          srcDoc={artifact.content}
          className="w-full h-full border-0 bg-white"
          title={artifact.name}
        />
      );

    case 'stylesheet':
      return (
        <pre className="p-4 text-sm text-gray-300 overflow-auto h-full">
          <code>{artifact.content}</code>
        </pre>
      );

    case 'flow':
      return (
        <div className="p-4 prose prose-invert max-w-none overflow-auto h-full">
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(artifact.content || '') }} />
        </div>
      );

    default:
      return (
        <pre className="p-4 text-sm text-gray-300 overflow-auto h-full">
          {artifact.content}
        </pre>
      );
  }
}

// Simple markdown renderer (can be replaced with a library)
function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}
```

### 3.8 src/components/ApprovalDialog.tsx

```typescript
import { useState } from 'react';
import { submitApproval } from '../api';
import type { ApprovalRequest } from '../types';

interface ApprovalDialogProps {
  taskId: string;
  request: ApprovalRequest;
  onComplete: () => void;
}

export function ApprovalDialog({ taskId, request, onComplete }: ApprovalDialogProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await submitApproval(taskId, true);
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!showFeedback) {
      setShowFeedback(true);
      return;
    }

    setLoading(true);
    try {
      await submitApproval(taskId, false, feedback);
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        <h2 className="text-lg font-semibold mb-2">Review Required</h2>
        <p className="text-gray-400 mb-4">{request.description}</p>

        {request.artifacts && request.artifacts.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">Artifacts to review:</p>
            <div className="flex flex-wrap gap-2">
              {request.artifacts.map((a, i) => (
                <span
                  key={i}
                  className="text-xs bg-gray-700 px-2 py-1 rounded"
                >
                  {a.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {showFeedback && (
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Explain what needs to change..."
            className="w-full bg-gray-900 border border-gray-700 rounded p-2 mb-4
                       text-sm text-white placeholder-gray-500 resize-none h-24"
          />
        )}

        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded font-medium
                       disabled:opacity-50 transition-colors"
          >
            ✓ Approve
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded font-medium
                       disabled:opacity-50 transition-colors"
          >
            ✗ {showFeedback ? 'Submit Rejection' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 4. Hooks

### 4.1 src/hooks/useTaskStream.ts

```typescript
import { useEffect, useRef } from 'react';
import type { AgentEvent } from '../types';

export function useTaskStream(
  taskId: string | undefined,
  onEvent: (event: AgentEvent) => void
) {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!taskId) return;

    // Close existing connection
    eventSourceRef.current?.close();

    // Open new SSE connection
    const eventSource = new EventSource(`/api/v1/tasks/${taskId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const lastOutput = data.agentOutputs?.slice(-1)?.[0];

        onEvent({
          agent: data.currentAgent || 'orchestrator',
          status: data.status,
          message: formatEventMessage(data),
          timestamp: new Date().toISOString(),
          artifacts: lastOutput?.artifacts || [],
          approvalRequest: data.approvalRequest,
          // Extract self-review summary if present
          selfReview: lastOutput?.selfReviewResult ? {
            iteration: lastOutput.selfReviewResult.iteration,
            maxIterations: 3, // Default from config
            qualityScore: lastOutput.selfReviewResult.qualityScore,
            completenessScore: lastOutput.selfReviewResult.completenessScore,
            decision: lastOutput.selfReviewResult.decision,
            gapsCount: lastOutput.selfReviewResult.gaps?.length || 0,
            criticalGapsCount: lastOutput.selfReviewResult.criticalGapCount || 0,
          } : undefined,
        });
      } catch (error) {
        console.error('Failed to parse event:', error);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
    };

    return () => {
      eventSource.close();
    };
  }, [taskId, onEvent]);
}

function formatEventMessage(data: any): string {
  const { status, currentAgent, analysis, agentOutputs } = data;

  if (status === 'analyzing' && analysis) {
    return `Analyzing task...\nType: ${analysis.taskType}\nComplexity: ${analysis.complexity}`;
  }

  if (status === 'orchestrating') {
    return 'Determining next agent...';
  }

  if (status === 'agent_working' && currentAgent) {
    return `Working on task...`;
  }

  if (status === 'awaiting_approval') {
    return 'Awaiting your approval to continue.';
  }

  if (status === 'completed') {
    return 'Task completed successfully!';
  }

  if (status === 'failed') {
    return `Task failed: ${data.error || 'Unknown error'}`;
  }

  // Get last agent output
  const lastOutput = agentOutputs?.[agentOutputs.length - 1];
  if (lastOutput) {
    if (lastOutput.success) {
      return `Completed successfully.${lastOutput.artifacts?.length ? `\nCreated ${lastOutput.artifacts.length} artifact(s).` : ''}`;
    } else {
      return `Failed: ${lastOutput.error}`;
    }
  }

  return status;
}
```

### 4.2 src/hooks/useArtifacts.ts

```typescript
import { useState, useEffect } from 'react';
import { getArtifacts } from '../api';
import type { Artifact } from '../types';

export function useArtifacts(taskId: string | undefined) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setArtifacts([]);
      return;
    }

    let cancelled = false;

    const fetchArtifacts = async () => {
      setLoading(true);
      try {
        const data = await getArtifacts(taskId);
        if (!cancelled) {
          setArtifacts(data);
        }
      } catch (error) {
        console.error('Failed to fetch artifacts:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchArtifacts();

    // Poll for updates every 3 seconds
    const interval = setInterval(fetchArtifacts, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [taskId]);

  return { artifacts, loading };
}
```

---

## 5. API Client

### 5.1 src/api.ts

```typescript
import type { Task, Artifact } from './types';

const API_BASE = '/api/v1';

// Development auth token (will be replaced with real auth)
const DEV_TOKEN = btoa(JSON.stringify({
  tenantId: 'dev-tenant',
  userId: 'dev-user',
}));

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer dev.${DEV_TOKEN}.dev`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function createTask(prompt: string): Promise<Task> {
  return fetchApi<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      projectId: 'dev-project', // Default project for development
      prompt,
    }),
  });
}

export async function getTask(taskId: string): Promise<Task> {
  return fetchApi<Task>(`/tasks/${taskId}`);
}

export async function getArtifacts(taskId: string): Promise<Artifact[]> {
  return fetchApi<Artifact[]>(`/tasks/${taskId}/artifacts`);
}

export async function submitApproval(
  taskId: string,
  approved: boolean,
  feedback?: string
): Promise<void> {
  await fetchApi(`/tasks/${taskId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approved, feedback }),
  });
}
```

---

## 6. Types

### 6.1 src/types.ts

```typescript
export interface Task {
  id: string;
  projectId: string;
  prompt: string;
  status: string;
  analysis?: TaskAnalysis;
  currentAgent?: string;
  completedAgents?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface TaskAnalysis {
  taskType: string;
  complexity: string;
  requiresUI: boolean;
  requiresBackend: boolean;
  requiresArchitecture: boolean;
  requiresApproval: boolean;
  suggestedAgents: string[];
}

export interface AgentEvent {
  agent: string;
  status: string;
  message: string;
  timestamp: string;
  artifacts?: Artifact[];
  approvalRequest?: ApprovalRequest;
  selfReview?: SelfReviewSummary;  // Added for review visibility
}

export interface SelfReviewSummary {
  iteration: number;
  maxIterations: number;
  qualityScore: number;
  completenessScore: number;
  decision: 'approved' | 'needs_work' | 'escalate';
  gapsCount: number;
  criticalGapsCount: number;
}

export interface Artifact {
  id: string;
  type: 'mockup' | 'stylesheet' | 'flow' | 'source_file' | 'test_file';
  name: string;
  path: string;
  content?: string;
}

export interface ApprovalRequest {
  type: 'design' | 'architecture' | 'implementation' | 'final';
  description: string;
  artifacts: Artifact[];
}
```

---

## 7. Styles

### 7.1 src/styles/main.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #1f2937;
}

::-webkit-scrollbar-thumb {
  background: #4b5563;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}

/* Prose overrides for markdown */
.prose {
  color: #d1d5db;
}

.prose h1,
.prose h2,
.prose h3 {
  color: #f3f4f6;
}

.prose code {
  background: #374151;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

.prose pre {
  background: #1f2937;
}
```

---

## 8. NestJS Artifacts Endpoint

Add this endpoint to the tasks controller (from Step 04):

### 8.1 apps/api/src/modules/tasks/tasks.controller.ts (addition)

```typescript
@Get(':id/artifacts')
@ApiOperation({ summary: 'Get task artifacts (designs, files)' })
@ApiResponse({ status: 200, type: [ArtifactDto] })
async getArtifacts(
  @TenantContext() tenant: { tenantId: string },
  @Param('id') id: string,
): Promise<ArtifactDto[]> {
  return this.tasksService.getArtifacts(tenant.tenantId, id);
}
```

### 8.2 apps/api/src/modules/tasks/tasks.service.ts (addition)

```typescript
async getArtifacts(tenantId: string, taskId: string): Promise<ArtifactDto[]> {
  // Get task to verify access
  const task = await this.findOne(tenantId, taskId);

  // Collect artifacts from all agent outputs
  const artifacts: ArtifactDto[] = [];

  // Get from checkpoint state
  const checkpoint = await this.checkpointer.getTuple({
    configurable: { thread_id: taskId },
  });

  if (checkpoint?.checkpoint) {
    const state = checkpoint.checkpoint as OrchestratorStateType;
    for (const output of state.agentOutputs || []) {
      for (const artifact of output.artifacts || []) {
        artifacts.push({
          id: artifact.id,
          type: artifact.type,
          name: artifact.path.split('/').pop() || artifact.id,
          path: artifact.path,
          content: artifact.content,
        });
      }
    }
  }

  return artifacts;
}
```

---

## Test Scenarios

```typescript
// apps/web/tests/app.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App';

describe('Early Web Interface', () => {
  it('should render prompt bar', () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/describe the app/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument();
  });

  it('should show agent activity section', () => {
    render(<App />);
    expect(screen.getByText(/agent activity/i)).toBeInTheDocument();
  });

  it('should show design preview section', () => {
    render(<App />);
    expect(screen.getByText(/design preview/i)).toBeInTheDocument();
  });

  it('should disable submit when prompt is empty', () => {
    render(<App />);
    const button = screen.getByRole('button', { name: /run/i });
    expect(button).toBeDisabled();
  });

  it('should enable submit when prompt has text', async () => {
    render(<App />);
    const textarea = screen.getByPlaceholderText(/describe the app/i);
    fireEvent.change(textarea, { target: { value: 'Build a todo app' } });

    const button = screen.getByRole('button', { name: /run/i });
    expect(button).not.toBeDisabled();
  });
});
```

---

## Validation Checklist

```
□ Early Web Interface (Step 24a)
  □ React app builds with vite build
  □ App runs at localhost:5173
  □ Prompt bar accepts text input
  □ Submit button creates task via API
  □ SSE connection established for task
  □ Agent messages appear in feed
  □ Agent icons and names display correctly
  □ Timestamps show for each message
  □ Mockups render in iframe
  □ Stylesheets display with code formatting
  □ Flows render as formatted markdown
  □ Approval dialog appears when needed
  □ Approve button continues workflow
  □ Reject button with feedback works
  □ Layout is responsive on mobile

□ Self-Review Visibility
  □ SelfReviewBadge displays when selfReview data present
  □ Quality score shows as percentage with progress bar
  □ Completeness score shows as percentage with progress bar
  □ Review iteration counter displays (e.g., 2/3)
  □ Decision badge color matches status (green/yellow/red)
  □ Gap count displays when gaps exist
  □ Critical gap count highlighted in red
  □ Escalate status triggers approval dialog
```

---

## Running the Interface

```bash
# Terminal 1: Start API
pnpm --filter=@aigentflow/api dev

# Terminal 2: Start Web
pnpm --filter=@aigentflow/web dev

# Open browser
open http://localhost:5173
```

---

## Next Step

Proceed to **25-GIT-AGENT.md** in CP3-GIT-WORKTREES.
