/**
 * UserFlowsPage Component
 *
 * Displays user flows and flow diagrams.
 * Features:
 * - Flow list with diagram previews
 * - Mermaid diagram rendering
 * - Screen approval controls
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Artifact } from '../../types';

interface UserFlowsPageProps {
  artifacts: Artifact[];
  screensApproved: boolean;
  onApprove: () => void;
  onReject: (feedback: string) => void;
}

export function UserFlowsPage({
  artifacts,
  screensApproved,
  onApprove,
  onReject,
}: UserFlowsPageProps) {
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');

  // Filter flow artifacts
  const flows = artifacts.filter((a) => a.type === 'user_flow');
  const diagrams = artifacts.filter((a) => a.type === 'diagram');

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
          <div className="text-4xl mb-4">🔀</div>
          <p className="text-sm">No user flows yet</p>
          <p className="text-xs mt-2">
            User flows will appear here after design is complete
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left: Flow List */}
      <div className="w-80 border-r border-border-primary overflow-y-auto p-4">
        {/* User Flows Section */}
        {flows.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              User Flows ({flows.length})
            </h3>
            <div className="grid gap-2">
              {flows.map((artifact) => (
                <FlowCard
                  key={artifact.id}
                  artifact={artifact}
                  isSelected={selectedArtifact?.id === artifact.id}
                  onClick={() => handleSelect(artifact)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Diagrams Section */}
        {diagrams.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Diagrams ({diagrams.length})
            </h3>
            <div className="grid gap-2">
              {diagrams.map((artifact) => (
                <FlowCard
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
        {!screensApproved && artifacts.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border-primary">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Screen Review
            </h3>
            <div className="space-y-2">
              <button
                onClick={onApprove}
                className="w-full px-4 py-2 bg-status-success hover:bg-green-600 rounded text-sm font-medium text-white transition-colors"
              >
                ✓ Approve All Screens
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
            <div className="flex-1 overflow-auto bg-bg-primary p-4">
              {selectedArtifact.content ? (
                <MermaidDiagram content={selectedArtifact.content} />
              ) : (
                <div className="h-full flex items-center justify-center text-text-muted">
                  <p>No preview available</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-text-muted">
            <div className="text-center">
              <div className="text-4xl mb-4">👈</div>
              <p className="text-sm">Select a flow to preview</p>
            </div>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Request Screen Changes
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              Describe what changes you'd like to see in the screens:
            </p>
            <textarea
              value={rejectFeedback}
              onChange={(e) => setRejectFeedback(e.target.value)}
              placeholder="e.g., Add a loading state, improve the navigation..."
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

/** Individual flow card in the list */
function FlowCard({
  artifact,
  isSelected,
  onClick,
}: {
  artifact: Artifact;
  isSelected: boolean;
  onClick: () => void;
}) {
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
        <span className="text-lg">🔀</span>
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

/** Mermaid diagram renderer */
function MermaidDiagram({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function renderDiagram() {
      if (!containerRef.current || !content) return;

      try {
        // Dynamically import mermaid
        const mermaid = await import('mermaid');
        mermaid.default.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#6366f1',
            primaryTextColor: '#f9fafb',
            primaryBorderColor: '#4f46e5',
            lineColor: '#6b7280',
            secondaryColor: '#1f2937',
            tertiaryColor: '#111827',
          },
        });

        // Clear previous content
        containerRef.current.innerHTML = '';

        // Create unique ID for the diagram
        const id = `mermaid-${Date.now()}`;

        // Render the diagram
        const { svg } = await mermaid.default.render(id, content);

        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setRendered(true);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
          setRendered(false);
        }
      }
    }

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [content]);

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-status-error/10 border border-status-error/30 rounded-lg p-4">
          <p className="text-sm text-status-error mb-2">Failed to render diagram:</p>
          <pre className="text-xs text-text-muted font-mono whitespace-pre-wrap">
            {error}
          </pre>
        </div>
        <div className="mt-4">
          <p className="text-xs text-text-muted mb-2">Raw content:</p>
          <pre className="text-xs text-text-secondary font-mono bg-bg-tertiary rounded p-3 whitespace-pre-wrap">
            {content}
          </pre>
        </div>
      </div>
    );
  }

  if (!rendered) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-text-muted">Rendering diagram...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center min-h-[200px] [&>svg]:max-w-full [&>svg]:h-auto"
    />
  );
}
