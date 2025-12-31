import { useState } from 'react';
import { useArtifacts } from '../hooks';
import { ArtifactViewer } from './ArtifactViewer';
import type { Artifact, ArtifactType } from '../types';

interface DesignPreviewProps {
  taskId: string | undefined;
  fullWidth?: boolean;
}

type TabType = 'mockups' | 'stylesheets' | 'flows';

const TAB_CONFIG: Record<TabType, { label: string; icon: string; types: ArtifactType[] }> = {
  mockups: { label: 'Mockups', icon: '🎨', types: ['mockup'] },
  stylesheets: { label: 'Styles', icon: '📝', types: ['stylesheet'] },
  flows: { label: 'Flows', icon: '📊', types: ['flow'] },
};

export function DesignPreview({ taskId, fullWidth }: DesignPreviewProps) {
  const { artifacts, loading, error } = useArtifacts(taskId);
  const [activeTab, setActiveTab] = useState<TabType>('mockups');
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  if (!taskId) {
    return (
      <div className="text-text-muted text-center py-8">
        <div className="text-3xl mb-3">🎨</div>
        <p className="text-sm">Designs will appear here</p>
        <p className="text-xs mt-2">Mockups, stylesheets, and flow diagrams</p>
      </div>
    );
  }

  if (loading && artifacts.length === 0) {
    return (
      <div className="text-text-muted text-center py-8">
        <div className="animate-pulse">Loading artifacts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-status-error text-center py-8">
        <p className="text-sm">Failed to load artifacts</p>
        <p className="text-xs mt-2">{error.message}</p>
      </div>
    );
  }

  // Filter artifacts by tab
  const filteredArtifacts: Record<TabType, Artifact[]> = {
    mockups: artifacts.filter((a) => TAB_CONFIG.mockups.types.includes(a.type)),
    stylesheets: artifacts.filter((a) => TAB_CONFIG.stylesheets.types.includes(a.type)),
    flows: artifacts.filter((a) => TAB_CONFIG.flows.types.includes(a.type)),
  };

  const currentArtifacts = filteredArtifacts[activeTab];

  return (
    <div className={`h-full flex flex-col ${fullWidth ? '' : ''}`}>
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(Object.keys(TAB_CONFIG) as TabType[]).map((tab) => (
          <TabButton
            key={tab}
            active={activeTab === tab}
            onClick={() => {
              setActiveTab(tab);
              setSelectedArtifact(null);
            }}
            count={filteredArtifacts[tab].length}
            icon={TAB_CONFIG[tab].icon}
          >
            {TAB_CONFIG[tab].label}
          </TabButton>
        ))}
      </div>

      {/* Content */}
      {currentArtifacts.length === 0 ? (
        <div className="text-text-muted text-center py-8">
          <p className="text-sm">No {activeTab} yet</p>
        </div>
      ) : (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Artifact selector */}
          <div className="w-48 shrink-0 space-y-2 overflow-y-auto">
            {currentArtifacts.map((artifact) => (
              <button
                key={artifact.id}
                onClick={() => setSelectedArtifact(artifact)}
                className={`w-full text-left p-2 rounded text-xs transition-colors ${
                  selectedArtifact?.id === artifact.id
                    ? 'bg-accent-primary text-white'
                    : 'bg-bg-card hover:bg-bg-card-hover text-text-primary'
                }`}
              >
                {artifact.name}
              </button>
            ))}
          </div>

          {/* Artifact viewer */}
          <div className="flex-1 bg-bg-card rounded-lg overflow-hidden min-h-[300px]">
            {selectedArtifact ? (
              <ArtifactViewer artifact={selectedArtifact} />
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted text-sm">
                Select an artifact to preview
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  count: number;
  icon: string;
  children: React.ReactNode;
}

function TabButton({ active, onClick, count, icon, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-accent-primary text-white'
          : 'bg-bg-card text-text-secondary hover:text-text-primary'
      }`}
    >
      <span>{icon}</span>
      {children}
      {count > 0 && (
        <span
          className={`ml-1 px-1.5 py-0.5 rounded text-2xs ${
            active ? 'bg-white/20' : 'bg-bg-tertiary'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
