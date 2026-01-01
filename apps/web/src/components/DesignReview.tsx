import { useState } from 'react';
import type { ScreenMockup, UserFlow, FullDesignState } from '../types';

interface DesignReviewProps {
  /** Full design state from UIDesigner */
  design: FullDesignState;
  /** Handler when user clicks a screen to preview */
  onPreviewScreen?: (screen: ScreenMockup) => void;
  /** Handler when user clicks a flow to view diagram */
  onViewFlow?: (flow: UserFlow) => void;
}

/**
 * Category badge for screens
 */
function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    auth: 'bg-purple-500/20 text-purple-400',
    dashboard: 'bg-blue-500/20 text-blue-400',
    settings: 'bg-gray-500/20 text-gray-400',
    onboarding: 'bg-green-500/20 text-green-400',
    profile: 'bg-orange-500/20 text-orange-400',
    default: 'bg-text-muted/20 text-text-muted',
  };

  const color = colors[category] || colors.default;

  return (
    <span className={`text-2xs px-2 py-0.5 rounded-full ${color}`}>
      {category}
    </span>
  );
}

/**
 * Screen card for design review
 */
function ScreenCard({
  screen,
  onClick,
}: {
  screen: ScreenMockup;
  onClick?: () => void;
}) {
  return (
    <div
      className={`bg-bg-tertiary rounded-lg border border-border-primary overflow-hidden transition-all hover:border-accent-primary ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      {/* Screen preview placeholder */}
      <div className="aspect-video bg-bg-card relative overflow-hidden">
        <div className="w-full h-full flex items-center justify-center text-text-muted">
          <span className="text-4xl">📱</span>
        </div>

        {/* Category badge */}
        {screen.category && (
          <div className="absolute top-2 left-2">
            <CategoryBadge category={screen.category} />
          </div>
        )}

        {/* State indicators */}
        {screen.states.length > 0 && (
          <div className="absolute bottom-2 left-2 flex gap-1">
            {screen.states.slice(0, 4).map(state => (
              <span
                key={state}
                className="text-2xs px-1.5 py-0.5 bg-black/50 text-white rounded"
                title={state}
              >
                {state.charAt(0).toUpperCase()}
              </span>
            ))}
            {screen.states.length > 4 && (
              <span className="text-2xs px-1.5 py-0.5 bg-black/50 text-white rounded">
                +{screen.states.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Responsive indicators */}
        {screen.responsiveBreakpoints.length > 0 && (
          <div className="absolute bottom-2 right-2 flex gap-1">
            {screen.responsiveBreakpoints.includes('mobile') && (
              <span className="text-xs">📱</span>
            )}
            {screen.responsiveBreakpoints.includes('tablet') && (
              <span className="text-xs">📱</span>
            )}
            {screen.responsiveBreakpoints.includes('desktop') && (
              <span className="text-xs">🖥️</span>
            )}
          </div>
        )}
      </div>

      {/* Card content */}
      <div className="p-3">
        <h4 className="font-medium text-text-primary text-sm truncate">
          {screen.name}
        </h4>
        <p className="text-2xs text-text-muted mt-0.5 truncate">
          {screen.path}
        </p>
      </div>
    </div>
  );
}

/**
 * User flow card
 */
function FlowCard({
  flow,
  onClick,
}: {
  flow: UserFlow;
  onClick?: () => void;
}) {
  return (
    <div
      className={`bg-bg-tertiary rounded-lg border border-border-primary p-3 transition-all hover:border-accent-primary ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg">🔀</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-text-primary text-sm truncate">
            {flow.name}
          </h4>
          <p className="text-2xs text-text-muted mt-0.5 line-clamp-2">
            {flow.userGoal}
          </p>
          <div className="flex items-center gap-2 mt-2 text-2xs text-text-muted">
            <span>{flow.stepCount} steps</span>
            {flow.mermaidPath && (
              <span className="text-accent-primary">View diagram →</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Group screens by category
 */
function groupScreensByCategory(screens: ScreenMockup[]): Record<string, ScreenMockup[]> {
  return screens.reduce((acc, screen) => {
    const category = screen.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(screen);
    return acc;
  }, {} as Record<string, ScreenMockup[]>);
}

/**
 * Design Review component
 *
 * Shows all screens from the full design phase, organized by category.
 * Also shows user flows with links to Mermaid diagrams.
 */
export function DesignReview({
  design,
  onPreviewScreen,
  onViewFlow,
}: DesignReviewProps) {
  const [activeTab, setActiveTab] = useState<'screens' | 'flows'>('screens');
  const screensByCategory = groupScreensByCategory(design.screens);
  const categories = Object.keys(screensByCategory);

  return (
    <div className="p-4 bg-bg-card rounded-lg border border-border-primary">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <span className="text-lg">📐</span>
            Design Review
          </h3>
          <p className="text-2xs text-text-muted mt-0.5">
            {design.stylePackageName} • {design.screens.length} screens • {design.userFlows.length} flows
          </p>
        </div>

        {/* Quick links */}
        <div className="flex gap-2">
          {design.globalCssPath && (
            <button className="text-2xs text-accent-primary hover:underline">
              View CSS
            </button>
          )}
          {design.handoffNotesPath && (
            <button className="text-2xs text-accent-primary hover:underline">
              Handoff Notes
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-bg-tertiary rounded-lg">
        <button
          className={`flex-1 py-1.5 text-xs rounded transition-colors ${
            activeTab === 'screens'
              ? 'bg-bg-card text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          onClick={() => setActiveTab('screens')}
        >
          Screens ({design.screens.length})
        </button>
        <button
          className={`flex-1 py-1.5 text-xs rounded transition-colors ${
            activeTab === 'flows'
              ? 'bg-bg-card text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          onClick={() => setActiveTab('flows')}
        >
          User Flows ({design.userFlows.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'screens' ? (
        <div className="space-y-4">
          {categories.map(category => (
            <div key={category}>
              <h4 className="text-xs font-medium text-text-secondary mb-2 capitalize">
                {category}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {screensByCategory[category].map(screen => (
                  <ScreenCard
                    key={screen.id}
                    screen={screen}
                    onClick={onPreviewScreen ? () => onPreviewScreen(screen) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {design.userFlows.map(flow => (
            <FlowCard
              key={flow.id}
              flow={flow}
              onClick={onViewFlow ? () => onViewFlow(flow) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Screen preview modal
 */
export function ScreenPreviewModal({
  screen,
  design,
  onClose,
  onSelectState,
  onSelectBreakpoint,
}: {
  screen: ScreenMockup;
  design: FullDesignState;
  onClose: () => void;
  onSelectState?: (state: string) => void;
  onSelectBreakpoint?: (breakpoint: string) => void;
}) {
  const [activeState, setActiveState] = useState<string>('default');
  const [activeBreakpoint, setActiveBreakpoint] = useState<string>('desktop');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card rounded-lg w-full max-w-6xl h-[90vh] flex flex-col border border-border-primary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-primary">
          <div>
            <h3 className="font-semibold text-text-primary">{screen.name}</h3>
            <p className="text-xs text-text-muted">{screen.path}</p>
          </div>

          {/* State and breakpoint selectors */}
          <div className="flex items-center gap-4">
            {screen.states.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-2xs text-text-muted">State:</span>
                <select
                  value={activeState}
                  onChange={(e) => {
                    setActiveState(e.target.value);
                    onSelectState?.(e.target.value);
                  }}
                  className="text-xs bg-bg-tertiary border border-border-primary rounded px-2 py-1"
                >
                  <option value="default">Default</option>
                  {screen.states.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            )}

            {screen.responsiveBreakpoints.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-2xs text-text-muted">Breakpoint:</span>
                <select
                  value={activeBreakpoint}
                  onChange={(e) => {
                    setActiveBreakpoint(e.target.value);
                    onSelectBreakpoint?.(e.target.value);
                  }}
                  className="text-xs bg-bg-tertiary border border-border-primary rounded px-2 py-1"
                >
                  {screen.responsiveBreakpoints.map(bp => (
                    <option key={bp} value={bp}>{bp}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 hover:bg-bg-tertiary rounded text-text-muted hover:text-text-primary"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Preview iframe */}
        <div className="flex-1 bg-white overflow-auto">
          <iframe
            src={screen.path}
            className="w-full h-full border-0"
            title={screen.name}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>

        {/* Footer with metadata */}
        <div className="p-3 border-t border-border-primary bg-bg-tertiary">
          <div className="flex items-center gap-4 text-2xs text-text-muted">
            <span>Style: {design.stylePackageName}</span>
            {screen.category && <span>Category: {screen.category}</span>}
            <span>States: {screen.states.length}</span>
            <span>Breakpoints: {screen.responsiveBreakpoints.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Flow diagram modal with Mermaid preview
 */
export function FlowDiagramModal({
  flow,
  onClose,
}: {
  flow: UserFlow;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col border border-border-primary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-primary">
          <div>
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <span>🔀</span>
              {flow.name}
            </h3>
            <p className="text-xs text-text-muted">{flow.userGoal}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-tertiary rounded text-text-muted hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        {/* Diagram */}
        <div className="flex-1 overflow-auto p-4">
          {flow.mermaidPath ? (
            <iframe
              src={flow.mermaidPath}
              className="w-full h-full min-h-[400px] border-0"
              title={flow.name}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-text-muted">
              No diagram available
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border-primary bg-bg-tertiary">
          <div className="flex items-center gap-4 text-2xs text-text-muted">
            <span>Steps: {flow.stepCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
