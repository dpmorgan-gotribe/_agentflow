import type { AgentEvent, AgentType, SelfReviewSummary } from '../types';

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
  const icon = AGENT_ICONS[event.agent] || '🔹';
  const name = AGENT_NAMES[event.agent] || event.agent;
  const isWaiting = event.status === 'awaiting_approval';
  const isComplete = event.status === 'completed';
  const isError = event.status === 'failed';

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
        <span className="text-2xs text-text-muted ml-auto">{formatTime(event.timestamp)}</span>
      </div>

      {/* Message */}
      <div className="text-xs text-text-secondary whitespace-pre-wrap">{event.message}</div>

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
