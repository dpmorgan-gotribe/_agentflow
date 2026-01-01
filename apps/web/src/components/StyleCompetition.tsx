import type { StylePackage, ParallelAgent } from '../types';

interface StyleCompetitionProps {
  /** Style packages being competed */
  stylePackages: StylePackage[];
  /** Agent execution status for each style */
  agentStatus: ParallelAgent[];
  /** Current iteration number */
  iteration: number;
  /** Max iterations allowed */
  maxIterations: number;
  /** Whether competition is in progress */
  isGenerating: boolean;
  /** Handler when user wants to preview a style */
  onPreview?: (styleId: string) => void;
}

/**
 * Status indicator for parallel agent execution
 */
function AgentStatusBadge({ status }: { status: ParallelAgent['status'] }) {
  const colors = {
    pending: 'bg-text-muted/20 text-text-muted',
    running: 'bg-accent-primary/20 text-accent-primary animate-pulse',
    completed: 'bg-status-success/20 text-status-success',
    failed: 'bg-status-error/20 text-status-error',
  };

  const labels = {
    pending: 'Pending',
    running: 'Generating...',
    completed: 'Ready',
    failed: 'Failed',
  };

  return (
    <span className={`text-2xs px-2 py-0.5 rounded-full ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

/**
 * Progress bar showing overall completion
 */
function CompetitionProgress({
  agents,
  isGenerating,
}: {
  agents: ParallelAgent[];
  isGenerating: boolean;
}) {
  const total = agents.length;
  const completed = agents.filter(a => a.status === 'completed').length;
  const failed = agents.filter(a => a.status === 'failed').length;
  const running = agents.filter(a => a.status === 'running').length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-xs text-text-muted mb-1">
        <span>
          {isGenerating ? (
            <>
              <span className="inline-block w-2 h-2 bg-accent-primary rounded-full animate-pulse mr-2" />
              Generating styles...
            </>
          ) : completed === total ? (
            'All styles ready!'
          ) : (
            `${completed}/${total} completed`
          )}
        </span>
        <span>
          {running > 0 && `${running} running`}
          {failed > 0 && `, ${failed} failed`}
        </span>
      </div>
      <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Style package card for competition view
 */
function StyleCard({
  pkg,
  agentStatus,
  onPreview,
}: {
  pkg: StylePackage;
  agentStatus?: ParallelAgent;
  onPreview?: () => void;
}) {
  const status = agentStatus?.status || 'pending';
  const isReady = status === 'completed';

  return (
    <div
      className={`bg-bg-tertiary rounded-lg border border-border-primary overflow-hidden transition-all ${
        isReady ? 'hover:border-accent-primary cursor-pointer' : 'opacity-60'
      }`}
    >
      {/* Thumbnail preview placeholder */}
      <div className="aspect-video bg-bg-card relative overflow-hidden">
        {pkg.thumbnailPath ? (
          <img
            src={pkg.thumbnailPath}
            alt={pkg.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            {status === 'running' ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-2xs">Generating...</span>
              </div>
            ) : status === 'pending' ? (
              <span className="text-2xs">Waiting...</span>
            ) : status === 'failed' ? (
              <span className="text-2xs text-status-error">Failed</span>
            ) : (
              <span className="text-4xl">🎨</span>
            )}
          </div>
        )}

        {/* Status overlay */}
        <div className="absolute top-2 right-2">
          <AgentStatusBadge status={status} />
        </div>
      </div>

      {/* Card content */}
      <div className="p-3">
        <h4 className="font-medium text-text-primary text-sm truncate">
          {pkg.name}
        </h4>
        <p className="text-2xs text-text-muted mt-1 line-clamp-2">
          {pkg.description}
        </p>

        {/* Preview button */}
        {isReady && onPreview && (
          <button
            onClick={onPreview}
            className="mt-2 w-full py-1.5 text-2xs bg-accent-primary/10 text-accent-primary rounded hover:bg-accent-primary/20 transition-colors"
          >
            Preview Style →
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Style Competition component
 *
 * Shows all style packages being generated in parallel during style competition.
 * Provides visual feedback on generation progress and allows previewing completed styles.
 */
export function StyleCompetition({
  stylePackages,
  agentStatus,
  iteration,
  maxIterations,
  isGenerating,
  onPreview,
}: StyleCompetitionProps) {
  // Map style packages to their agent status
  const getAgentForStyle = (styleId: string) =>
    agentStatus.find(a => a.stylePackageId === styleId);

  return (
    <div className="p-4 bg-bg-card rounded-lg border border-border-primary">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <span className="text-lg">🎨</span>
            Style Competition
          </h3>
          <p className="text-2xs text-text-muted mt-0.5">
            {stylePackages.length} designers creating style options
          </p>
        </div>
        <div className="text-2xs text-text-muted bg-bg-tertiary px-2 py-1 rounded">
          Round {iteration}/{maxIterations}
        </div>
      </div>

      {/* Progress bar */}
      <CompetitionProgress agents={agentStatus} isGenerating={isGenerating} />

      {/* Style grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {stylePackages.map(pkg => (
          <StyleCard
            key={pkg.id}
            pkg={pkg}
            agentStatus={getAgentForStyle(pkg.id)}
            onPreview={onPreview ? () => onPreview(pkg.id) : undefined}
          />
        ))}
      </div>

      {/* Help text */}
      {!isGenerating && agentStatus.every(a => a.status === 'completed') && (
        <div className="mt-4 text-center text-xs text-text-muted">
          Click a style to preview, then select your favorite from the approval dialog
        </div>
      )}
    </div>
  );
}

/**
 * Mini version for sidebar or compact views
 */
export function StyleCompetitionMini({
  agentStatus,
  isGenerating,
}: {
  agentStatus: ParallelAgent[];
  isGenerating: boolean;
}) {
  const total = agentStatus.length;
  const completed = agentStatus.filter(a => a.status === 'completed').length;
  const running = agentStatus.filter(a => a.status === 'running').length;

  if (total === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-lg">🎨</span>
      {isGenerating ? (
        <>
          <span className="text-text-muted">Generating styles...</span>
          <span className="text-accent-primary">{running}/{total}</span>
        </>
      ) : (
        <>
          <span className="text-text-muted">Styles ready</span>
          <span className="text-status-success">{completed}/{total}</span>
        </>
      )}
    </div>
  );
}
