import { useState, useCallback } from 'react';
import { submitApproval } from '../api';
import type { ApprovalRequest, StyleSelectionRequest, ApprovalOption } from '../types';
import { isStyleSelectionRequest } from '../types';

interface ApprovalDialogProps {
  taskId: string;
  request: ApprovalRequest;
  onComplete: () => void;
}

const TYPE_ICONS: Record<ApprovalRequest['type'], string> = {
  design: '🎨',
  architecture: '🏗️',
  implementation: '💻',
  final: '✅',
};

const TYPE_TITLES: Record<ApprovalRequest['type'], string> = {
  design: 'Design Review',
  architecture: 'Architecture Review',
  implementation: 'Implementation Review',
  final: 'Final Review',
};

/**
 * Style option card for selection
 */
function StyleOptionCard({
  option,
  selected,
  onSelect,
  onPreview,
}: {
  option: ApprovalOption;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  return (
    <div
      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
        selected
          ? 'border-accent-primary bg-accent-primary/10'
          : 'border-border-primary hover:border-accent-primary/50 bg-bg-tertiary'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        {/* Radio indicator */}
        <div
          className={`w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
            selected ? 'border-accent-primary' : 'border-text-muted'
          }`}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-accent-primary" />}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-text-primary text-sm">{option.name}</h4>
          <p className="text-xs text-text-muted mt-1 line-clamp-2">{option.description}</p>

          {/* Preview button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="mt-2 text-2xs text-accent-primary hover:text-accent-primary/80 underline"
          >
            Preview →
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Preview modal for style options
 */
function PreviewModal({
  option,
  onClose,
}: {
  option: ApprovalOption;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
      <div className="bg-bg-card rounded-lg w-full max-w-5xl h-[80vh] flex flex-col border border-border-primary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-primary">
          <div>
            <h3 className="font-semibold text-text-primary">{option.name}</h3>
            <p className="text-xs text-text-muted">{option.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-tertiary rounded text-text-muted hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        {/* Preview iframe */}
        <div className="flex-1 bg-white">
          {option.previewPath ? (
            <iframe
              src={option.previewPath}
              className="w-full h-full border-0"
              title={`Preview: ${option.name}`}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted">
              No preview available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Style selection dialog for choosing from multiple design options
 */
function StyleSelectionDialog({
  taskId,
  request,
  onComplete,
}: {
  taskId: string;
  request: StyleSelectionRequest;
  onComplete: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [previewOption, setPreviewOption] = useState<ApprovalOption | null>(null);
  const [showRejectFeedback, setShowRejectFeedback] = useState(false);

  const handleApprove = useCallback(async () => {
    if (!selectedId) {
      setError('Please select a style option');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await submitApproval(taskId, true, {
        selectedOption: selectedId,
        feedback: feedback || undefined,
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit selection');
    } finally {
      setLoading(false);
    }
  }, [taskId, selectedId, feedback, onComplete]);

  const handleRejectAll = useCallback(async () => {
    if (!showRejectFeedback) {
      setShowRejectFeedback(true);
      return;
    }

    if (!feedback.trim()) {
      setError('Please provide feedback explaining what styles you prefer');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await submitApproval(taskId, false, {
        rejectAll: true,
        feedback,
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rejection');
    } finally {
      setLoading(false);
    }
  }, [taskId, showRejectFeedback, feedback, onComplete]);

  const handleCancel = useCallback(() => {
    setShowRejectFeedback(false);
    setFeedback('');
    setError(null);
  }, []);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-bg-card rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border-primary shadow-lg">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🎨</span>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-text-primary">
                Select a Design Style
              </h2>
              <p className="text-xs text-text-muted">
                Choose one of the following styles for your project
              </p>
            </div>
            <div className="text-xs text-text-muted">
              Round {request.iteration} of {request.maxIterations}
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-text-secondary mb-4">{request.description}</p>

          {/* Style Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {request.styleOptions.map((option) => (
              <StyleOptionCard
                key={option.id}
                option={option}
                selected={selectedId === option.id}
                onSelect={() => setSelectedId(option.id)}
                onPreview={() => setPreviewOption(option)}
              />
            ))}
          </div>

          {/* Feedback textarea (always visible for style selection) */}
          <div className="mb-4">
            <label className="block text-xs text-text-secondary mb-2">
              {showRejectFeedback
                ? 'What styles are you looking for? (required)'
                : 'Additional feedback (optional)'}
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={
                showRejectFeedback
                  ? 'Describe the style you want: colors, mood, inspiration...'
                  : 'Any specific adjustments you want after selection...'
              }
              className="w-full bg-bg-input border border-border-primary rounded p-3 text-sm text-text-primary placeholder-text-muted resize-none h-20 outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/30"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-2 bg-status-error/10 border border-status-error/30 rounded text-xs text-status-error">
              {error}
            </div>
          )}

          {/* Iteration warning */}
          {request.iteration >= request.maxIterations - 1 && (
            <div className="mb-4 p-2 bg-status-warning/10 border border-status-warning/30 rounded text-xs text-status-warning">
              {request.iteration >= request.maxIterations
                ? 'Maximum iterations reached. Please select a style or provide specific guidance.'
                : 'One rejection remaining before specific style guidance is required.'}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {showRejectFeedback ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 py-2 bg-bg-tertiary border border-border-primary rounded text-sm font-medium text-text-secondary hover:bg-bg-card-hover disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectAll}
                  disabled={loading || request.iteration >= request.maxIterations}
                  className="flex-1 py-2 bg-status-error hover:bg-status-error/90 rounded text-sm font-medium text-white disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Submitting...' : 'Reject All & Re-research'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleRejectAll}
                  disabled={loading || request.iteration >= request.maxIterations}
                  className="py-2 px-4 bg-bg-tertiary border border-border-primary rounded text-sm font-medium text-status-error hover:bg-bg-card-hover disabled:opacity-50 transition-colors"
                >
                  ✗ None of these
                </button>
                <button
                  onClick={handleApprove}
                  disabled={loading || !selectedId}
                  className="flex-1 py-2 bg-status-success hover:bg-status-success/90 rounded text-sm font-medium text-white disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Confirming...' : '✓ Use Selected Style'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewOption && (
        <PreviewModal option={previewOption} onClose={() => setPreviewOption(null)} />
      )}
    </>
  );
}

/**
 * Standard approval dialog for non-style approvals
 */
function StandardApprovalDialog({
  taskId,
  request,
  onComplete,
}: {
  taskId: string;
  request: ApprovalRequest;
  onComplete: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      await submitApproval(taskId, true);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit approval');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!showFeedback) {
      setShowFeedback(true);
      return;
    }

    if (!feedback.trim()) {
      setError('Please provide feedback explaining what needs to change');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await submitApproval(taskId, false, feedback);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rejection');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowFeedback(false);
    setFeedback('');
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card rounded-lg p-6 max-w-md w-full border border-border-primary shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{TYPE_ICONS[request.type]}</span>
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              {TYPE_TITLES[request.type]}
            </h2>
            <p className="text-xs text-text-muted">Your approval is required to continue</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-text-secondary mb-4">{request.description}</p>

        {/* Artifacts List */}
        {request.artifacts && request.artifacts.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-text-muted mb-2">Artifacts to review:</p>
            <div className="flex flex-wrap gap-2">
              {request.artifacts.map((artifact) => (
                <span
                  key={artifact.id}
                  className="text-2xs bg-bg-tertiary px-2 py-1 rounded text-text-secondary"
                >
                  {artifact.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feedback Input */}
        {showFeedback && (
          <div className="mb-4">
            <label className="block text-xs text-text-secondary mb-2">
              What needs to change?
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Explain what needs to change..."
              className="w-full bg-bg-input border border-border-primary rounded p-3 text-sm text-text-primary placeholder-text-muted resize-none h-24 outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/30"
              autoFocus
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-2 bg-status-error/10 border border-status-error/30 rounded text-xs text-status-error">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {showFeedback ? (
            <>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 py-2 bg-bg-tertiary border border-border-primary rounded text-sm font-medium text-text-secondary hover:bg-bg-card-hover disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={loading}
                className="flex-1 py-2 bg-status-error hover:bg-status-error/90 rounded text-sm font-medium text-white disabled:opacity-50 transition-colors"
              >
                {loading ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleReject}
                disabled={loading}
                className="flex-1 py-2 bg-bg-tertiary border border-border-primary rounded text-sm font-medium text-status-error hover:bg-bg-card-hover disabled:opacity-50 transition-colors"
              >
                ✗ Reject
              </button>
              <button
                onClick={handleApprove}
                disabled={loading}
                className="flex-1 py-2 bg-status-success hover:bg-status-success/90 rounded text-sm font-medium text-white disabled:opacity-50 transition-colors"
              >
                {loading ? 'Approving...' : '✓ Approve'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Main approval dialog component
 *
 * Renders either StyleSelectionDialog or StandardApprovalDialog
 * based on the request type.
 */
export function ApprovalDialog({ taskId, request, onComplete }: ApprovalDialogProps) {
  if (isStyleSelectionRequest(request)) {
    return (
      <StyleSelectionDialog
        taskId={taskId}
        request={request}
        onComplete={onComplete}
      />
    );
  }

  return (
    <StandardApprovalDialog
      taskId={taskId}
      request={request}
      onComplete={onComplete}
    />
  );
}
