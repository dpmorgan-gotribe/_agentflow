import { useState } from 'react';
import type { AgentEvent, AgentType, SelfReviewSummary, SubAgentActivity, ToolUsage } from '../types';

interface AgentMessageProps {
  event: AgentEvent;
}

const AGENT_ICONS: Record<AgentType, string> = {
  system: '⚡',
  orchestrator: '🤖',
  project_manager: '📋',
  architect: '🏗️',
  analyst: '🔍',
  project_analyzer: '📊',
  compliance: '🔒',
  ui_designer: '🎨',
  frontend_developer: '💻',
  backend_developer: '⚙️',
  tester: '🧪',
  bug_fixer: '🔧',
  reviewer: '👁️',
  git_agent: '📦',
};

const AGENT_NAMES: Record<AgentType, string> = {
  system: 'System',
  orchestrator: 'Orchestrator',
  project_manager: 'Project Manager',
  architect: 'Architect',
  analyst: 'Analyst',
  project_analyzer: 'Project Analyzer',
  compliance: 'Compliance',
  ui_designer: 'UI Designer',
  frontend_developer: 'Frontend Developer',
  backend_developer: 'Backend Developer',
  tester: 'Tester',
  bug_fixer: 'Bug Fixer',
  reviewer: 'Reviewer',
  git_agent: 'Git Agent',
};

export function AgentMessage({ event }: AgentMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const icon = AGENT_ICONS[event.agent] || '🔹';
  const name = AGENT_NAMES[event.agent] || event.agent;
  const isWaiting = event.status === 'awaiting_approval';
  const isComplete = event.status === 'completed';
  const isError = event.status === 'failed';
  const hasActivity = event.activity && (
    event.activity.thinking ||
    event.activity.tools?.length ||
    event.activity.hooks?.length ||
    event.activity.response
  );

  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        isWaiting
          ? 'border-status-warning/50 bg-status-warning/10'
          : isComplete
            ? 'border-status-success/50 bg-status-success/10'
            : isError
              ? 'border-status-error/50 bg-status-error/10'
              : 'border-border-primary bg-bg-card'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="font-semibold text-xs text-text-primary">{name}</span>
        {hasActivity && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-2xs px-1.5 py-0.5 rounded bg-bg-tertiary hover:bg-bg-hover text-text-muted transition-colors"
          >
            {isExpanded ? '▼ Hide Details' : '▶ Show Details'}
          </button>
        )}
        {event.activity?.tokenUsage && (
          <span className="text-2xs text-text-muted">
            {event.activity.tokenUsage.input + event.activity.tokenUsage.output} tokens
          </span>
        )}
        <span className="text-2xs text-text-muted ml-auto">{formatTime(event.timestamp)}</span>
      </div>

      {/* Message */}
      <div className="text-xs text-text-secondary whitespace-pre-wrap">{event.message}</div>

      {/* Activity Details (Expandable) */}
      {hasActivity && isExpanded && (
        <ActivityDetails activity={event.activity!} />
      )}

      {/* Self-Review Badge */}
      {event.selfReview && <SelfReviewBadge review={event.selfReview} />}

      {/* Artifacts */}
      {event.artifacts && event.artifacts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {event.artifacts.map((artifact) => (
            <span key={artifact.id} className="text-2xs bg-bg-tertiary px-2 py-1 rounded">
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
    approved: 'bg-status-success/20 border-status-success/50 text-status-success',
    needs_work: 'bg-status-warning/20 border-status-warning/50 text-status-warning',
    escalate: 'bg-status-error/20 border-status-error/50 text-status-error',
  }[review.decision];

  // Quality score bar color
  const qualityBarColor =
    qualityPercent >= 80
      ? 'bg-status-success'
      : qualityPercent >= 60
        ? 'bg-status-warning'
        : 'bg-status-error';

  return (
    <div className={`mt-3 p-2 rounded border ${badgeColor}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xs font-medium flex items-center gap-1">
          <span>🔍</span>
          Self-Review
          <span className="text-text-muted">
            ({review.iteration}/{review.maxIterations})
          </span>
        </span>
        <span className="text-2xs capitalize">{review.decision.replace('_', ' ')}</span>
      </div>

      {/* Quality Score Bar */}
      <div className="mb-1">
        <div className="flex justify-between text-2xs mb-1">
          <span>Quality</span>
          <span>{qualityPercent}%</span>
        </div>
        <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className={`h-full ${qualityBarColor} transition-all`}
            style={{ width: `${qualityPercent}%` }}
          />
        </div>
      </div>

      {/* Completeness Score Bar */}
      <div className="mb-1">
        <div className="flex justify-between text-2xs mb-1">
          <span>Completeness</span>
          <span>{completenessPercent}%</span>
        </div>
        <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-status-info transition-all"
            style={{ width: `${completenessPercent}%` }}
          />
        </div>
      </div>

      {/* Gaps Summary */}
      {review.gapsCount > 0 && (
        <div className="text-2xs mt-2 flex gap-2">
          <span className="text-text-muted">Gaps: {review.gapsCount}</span>
          {review.criticalGapsCount > 0 && (
            <span className="text-status-error">({review.criticalGapsCount} critical)</span>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * Displays detailed sub-agent activity: thinking, tools, hooks, response
 */
function ActivityDetails({ activity }: { activity: SubAgentActivity }) {
  return (
    <div className="mt-3 space-y-3 border-t border-border-primary pt-3">
      {/* Thinking */}
      {activity.thinking && (
        <div className="bg-bg-tertiary rounded p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm">💭</span>
            <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Thinking</span>
          </div>
          <div className="text-2xs text-text-secondary italic whitespace-pre-wrap max-h-32 overflow-y-auto">
            {activity.thinking}
          </div>
        </div>
      )}

      {/* Hooks */}
      {activity.hooks && activity.hooks.length > 0 && (
        <div className="bg-bg-tertiary rounded p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm">🪝</span>
            <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Hooks</span>
          </div>
          <div className="space-y-1">
            {activity.hooks.map((hook, idx) => (
              <div key={idx} className="flex items-center gap-2 text-2xs">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  hook.status === 'success' ? 'bg-status-success' :
                  hook.status === 'failed' ? 'bg-status-error' : 'bg-text-muted'
                }`} />
                <span className="text-text-muted">{hook.type}</span>
                <span className="text-text-primary font-mono">{hook.name}</span>
                {hook.message && (
                  <span className="text-text-muted truncate">{hook.message}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tools */}
      {activity.tools && activity.tools.length > 0 && (
        <div className="bg-bg-tertiary rounded p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm">🔧</span>
            <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
              Tools ({activity.tools.length})
            </span>
          </div>
          <div className="space-y-2">
            {activity.tools.map((tool, idx) => (
              <ToolUsageItem key={idx} tool={tool} />
            ))}
          </div>
        </div>
      )}

      {/* Response */}
      {activity.response && (
        <div className="bg-bg-tertiary rounded p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm">💬</span>
            <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Response</span>
          </div>
          <div className="text-2xs text-text-secondary whitespace-pre-wrap max-h-48 overflow-y-auto">
            {activity.response}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Single tool usage display with collapsible input/output
 */
function ToolUsageItem({ tool }: { tool: ToolUsage }) {
  const [showDetails, setShowDetails] = useState(false);
  const hasDetails = tool.input || tool.output;

  return (
    <div className="border border-border-primary rounded bg-bg-card">
      <button
        onClick={() => hasDetails && setShowDetails(!showDetails)}
        className={`w-full flex items-center gap-2 p-1.5 text-left ${hasDetails ? 'cursor-pointer hover:bg-bg-hover' : ''}`}
        disabled={!hasDetails}
      >
        <span className="text-xs font-mono text-accent-primary">{tool.name}</span>
        {tool.duration && (
          <span className="text-2xs text-text-muted">{tool.duration}ms</span>
        )}
        {hasDetails && (
          <span className="text-2xs text-text-muted ml-auto">
            {showDetails ? '▼' : '▶'}
          </span>
        )}
      </button>

      {showDetails && (
        <div className="border-t border-border-primary p-1.5 space-y-1.5">
          {tool.input && (
            <div>
              <div className="text-3xs text-text-muted uppercase mb-0.5">Input</div>
              <pre className="text-2xs text-text-secondary bg-bg-tertiary p-1 rounded overflow-x-auto max-h-24 overflow-y-auto">
                {tool.input}
              </pre>
            </div>
          )}
          {tool.output && (
            <div>
              <div className="text-3xs text-text-muted uppercase mb-0.5">Output</div>
              <pre className="text-2xs text-text-secondary bg-bg-tertiary p-1 rounded overflow-x-auto max-h-24 overflow-y-auto">
                {tool.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
