/**
 * DesignPage Component
 *
 * Main container for the Design tab with sub-navigation between:
 * - Mockups: Style packages and component showcase
 * - User Flows: Flow diagrams and screen navigation
 */

import { useState, useCallback } from 'react';
import { MockupsPage } from './MockupsPage';
import { UserFlowsPage } from './UserFlowsPage';
import type { Artifact } from '../../types';

type DesignSubTab = 'mockups' | 'flows';

interface DesignPageProps {
  taskId?: string;
  artifacts: Artifact[];
  designPhase: 'research' | 'stylesheet' | 'screens' | 'complete';
  stylesheetApproved: boolean;
  screensApproved: boolean;
  onApproveStylesheet: () => void;
  onRejectStylesheet: (feedback: string) => void;
  onApproveScreens: () => void;
  onRejectScreens: (feedback: string) => void;
}

export function DesignPage({
  taskId,
  artifacts,
  designPhase,
  stylesheetApproved,
  screensApproved,
  onApproveStylesheet,
  onRejectStylesheet,
  onApproveScreens,
  onRejectScreens,
}: DesignPageProps) {
  const [activeSubTab, setActiveSubTab] = useState<DesignSubTab>('mockups');

  // Filter artifacts by type
  const mockupArtifacts = artifacts.filter(
    (a) => a.type === 'mockup' || a.type === 'stylesheet' || a.type === 'design_tokens'
  );
  const flowArtifacts = artifacts.filter(
    (a) => a.type === 'user_flow' || a.type === 'diagram'
  );

  const handleTabChange = useCallback((tab: DesignSubTab) => {
    setActiveSubTab(tab);
  }, []);

  // Get phase status badge
  const getPhaseStatus = () => {
    switch (designPhase) {
      case 'research':
        return { label: 'Research', color: 'bg-blue-500/20 text-blue-400' };
      case 'stylesheet':
        return { label: 'Stylesheet Review', color: 'bg-purple-500/20 text-purple-400' };
      case 'screens':
        return { label: 'Screen Generation', color: 'bg-yellow-500/20 text-yellow-400' };
      case 'complete':
        return { label: 'Complete', color: 'bg-green-500/20 text-green-400' };
      default:
        return { label: 'Unknown', color: 'bg-gray-500/20 text-gray-400' };
    }
  };

  const phaseStatus = getPhaseStatus();

  if (!taskId) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted">
        <div className="text-center">
          <div className="text-4xl mb-4">🎨</div>
          <p className="text-sm">No active task</p>
          <p className="text-xs mt-2">Start a new task to see design assets</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Sub-navigation */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-b border-border-primary">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTabChange('mockups')}
            className={`px-3 py-1.5 rounded text-xs transition-colors ${
              activeSubTab === 'mockups'
                ? 'bg-accent-primary text-white'
                : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
            }`}
          >
            🎨 Mockups
            {mockupArtifacts.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded text-2xs">
                {mockupArtifacts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('flows')}
            className={`px-3 py-1.5 rounded text-xs transition-colors ${
              activeSubTab === 'flows'
                ? 'bg-accent-primary text-white'
                : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
            }`}
          >
            🔀 User Flows
            {flowArtifacts.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded text-2xs">
                {flowArtifacts.length}
              </span>
            )}
          </button>
        </div>

        {/* Phase Status */}
        <div className="flex items-center gap-3">
          <span className={`text-2xs px-2 py-1 rounded ${phaseStatus.color}`}>
            Phase: {phaseStatus.label}
          </span>
          {stylesheetApproved && (
            <span className="text-2xs px-2 py-1 rounded bg-green-500/20 text-green-400">
              ✓ Stylesheet Approved
            </span>
          )}
          {screensApproved && (
            <span className="text-2xs px-2 py-1 rounded bg-green-500/20 text-green-400">
              ✓ Screens Approved
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'mockups' && (
          <MockupsPage
            artifacts={mockupArtifacts}
            designPhase={designPhase}
            stylesheetApproved={stylesheetApproved}
            onApprove={onApproveStylesheet}
            onReject={onRejectStylesheet}
          />
        )}
        {activeSubTab === 'flows' && (
          <UserFlowsPage
            artifacts={flowArtifacts}
            screensApproved={screensApproved}
            onApprove={onApproveScreens}
            onReject={onRejectScreens}
          />
        )}
      </div>
    </div>
  );
}
