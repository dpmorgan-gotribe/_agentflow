import { useState } from 'react';
import { submitApproval } from '../api';
import type { ApprovalRequest } from '../types';

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

export function ApprovalDialog({ taskId, request, onComplete }: ApprovalDialogProps) {
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
