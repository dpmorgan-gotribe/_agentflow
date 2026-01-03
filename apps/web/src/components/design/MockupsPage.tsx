/**
 * MockupsPage Component
 *
 * Displays style packages and component showcases (mega pages).
 * Features:
 * - Grid of style options during competition
 * - Full-screen preview of selected style
 * - Approval controls for stylesheet phase
 */

import { useState, useCallback } from 'react';
import type { Artifact } from '../../types';

interface MockupsPageProps {
  artifacts: Artifact[];
  designPhase: 'research' | 'stylesheet' | 'screens' | 'complete';
  stylesheetApproved: boolean;
  onApprove: () => void;
  onReject: (feedback: string) => void;
}

export function MockupsPage({
  artifacts,
  designPhase,
  stylesheetApproved,
  onApprove,
  onReject,
}: MockupsPageProps) {
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');

  // Filter mockup artifacts
  const mockups = artifacts.filter((a) => a.type === 'mockup');
  const stylesheets = artifacts.filter((a) => a.type === 'stylesheet');
  const designTokens = artifacts.filter((a) => a.type === 'design_tokens');

  const handleSelect = useCallback((artifact: Artifact) => {
    setSelectedArtifact(artifact);
  }, []);

  const handleRejectSubmit = useCallback(() => {
    if (rejectFeedback.trim()) {
      onReject(rejectFeedback);
      setShowRejectDialog(false);
      setRejectFeedback('');
    }
  }, [rejectFeedback, onReject]);

  // Show empty state if no artifacts
  if (artifacts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted">
        <div className="text-center">
          <div className="text-4xl mb-4">🎨</div>
          <p className="text-sm">No mockups yet</p>
          <p className="text-xs mt-2">
            {designPhase === 'research'
              ? 'Analyst is researching styles...'
              : 'UI Designer is creating mockups...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left: Artifact Grid */}
      <div className="w-80 border-r border-border-primary overflow-y-auto p-4">
        {/* Mockups Section */}
        {mockups.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Mockups ({mockups.length})
            </h3>
            <div className="grid gap-2">
              {mockups.map((artifact) => (
                <ArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  isSelected={selectedArtifact?.id === artifact.id}
                  onClick={() => handleSelect(artifact)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stylesheets Section */}
        {stylesheets.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Stylesheets ({stylesheets.length})
            </h3>
            <div className="grid gap-2">
              {stylesheets.map((artifact) => (
                <ArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  isSelected={selectedArtifact?.id === artifact.id}
                  onClick={() => handleSelect(artifact)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Design Tokens Section */}
        {designTokens.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Design Tokens ({designTokens.length})
            </h3>
            <div className="grid gap-2">
              {designTokens.map((artifact) => (
                <ArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  isSelected={selectedArtifact?.id === artifact.id}
                  onClick={() => handleSelect(artifact)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Approval Controls */}
        {designPhase === 'stylesheet' && !stylesheetApproved && (
          <div className="mt-6 pt-4 border-t border-border-primary">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Stylesheet Review
            </h3>
            <div className="space-y-2">
              <button
                onClick={onApprove}
                className="w-full px-4 py-2 bg-status-success hover:bg-green-600 rounded text-sm font-medium text-white transition-colors"
              >
                ✓ Approve Stylesheet
              </button>
              <button
                onClick={() => setShowRejectDialog(true)}
                className="w-full px-4 py-2 bg-bg-tertiary border border-border-primary hover:bg-bg-card-hover rounded text-sm text-text-primary transition-colors"
              >
                Request Changes
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedArtifact ? (
          <>
            {/* Preview Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-bg-tertiary border-b border-border-primary">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  {selectedArtifact.name}
                </span>
                <span className="text-2xs px-2 py-0.5 rounded bg-bg-card text-text-muted">
                  {selectedArtifact.type}
                </span>
              </div>
              <button
                onClick={() => setSelectedArtifact(null)}
                className="text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto bg-white">
              {selectedArtifact.type === 'mockup' && selectedArtifact.content ? (
                <iframe
                  srcDoc={selectedArtifact.content}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                  title={selectedArtifact.name}
                />
              ) : selectedArtifact.type === 'stylesheet' && selectedArtifact.content ? (
                <pre className="p-4 text-xs font-mono text-gray-800 whitespace-pre-wrap">
                  {selectedArtifact.content}
                </pre>
              ) : selectedArtifact.type === 'design_tokens' && selectedArtifact.content ? (
                <pre className="p-4 text-xs font-mono text-gray-800 whitespace-pre-wrap">
                  {JSON.stringify(JSON.parse(selectedArtifact.content), null, 2)}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <p>No preview available</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-text-muted">
            <div className="text-center">
              <div className="text-4xl mb-4">👈</div>
              <p className="text-sm">Select a mockup to preview</p>
            </div>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Request Stylesheet Changes
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              Describe what changes you'd like to see in the stylesheet:
            </p>
            <textarea
              value={rejectFeedback}
              onChange={(e) => setRejectFeedback(e.target.value)}
              placeholder="e.g., Make the colors more vibrant, use a different font..."
              className="w-full h-24 px-3 py-2 bg-bg-primary border border-border-primary rounded text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-primary"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectFeedback('');
                }}
                className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary hover:bg-bg-card-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!rejectFeedback.trim()}
                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover rounded text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Individual artifact card in the grid */
function ArtifactCard({
  artifact,
  isSelected,
  onClick,
}: {
  artifact: Artifact;
  isSelected: boolean;
  onClick: () => void;
}) {
  const getIcon = () => {
    switch (artifact.type) {
      case 'mockup':
        return '🎨';
      case 'stylesheet':
        return '📄';
      case 'design_tokens':
        return '🎯';
      default:
        return '📁';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isSelected
          ? 'bg-accent-primary/10 border-accent-primary'
          : 'bg-bg-tertiary border-border-primary hover:bg-bg-card-hover'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{getIcon()}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">
            {artifact.name}
          </p>
          <p className="text-2xs text-text-muted truncate">{artifact.path}</p>
        </div>
      </div>
    </button>
  );
}
