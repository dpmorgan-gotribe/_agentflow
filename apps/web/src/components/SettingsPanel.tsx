import { useState, useEffect, useCallback } from 'react';
import { getSettings, updateSettings, resetSettings, type WorkflowSettings } from '../api';

interface SettingsPanelProps {
  /** Whether panel is initially expanded */
  defaultExpanded?: boolean;
}

const DEFAULT_SETTINGS: WorkflowSettings = {
  stylePackageCount: 1,
  parallelDesignerCount: 1,
  enableStyleCompetition: false,
  maxStyleRejections: 5,
  claudeCliTimeoutMs: 900000,
};

export function SettingsPanel({ defaultExpanded = false }: SettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [settings, setSettings] = useState<WorkflowSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getSettings();
      setSettings(data);
    } catch (err) {
      setError('Failed to load settings');
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = useCallback(async (updates: Partial<WorkflowSettings>) => {
    try {
      setIsSaving(true);
      setError(null);
      const updated = await updateSettings(updates);
      setSettings(updated);
    } catch (err) {
      setError('Failed to save');
      console.error('Failed to update settings:', err);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleReset = async () => {
    try {
      setIsSaving(true);
      setError(null);
      const reset = await resetSettings();
      setSettings(reset);
    } catch (err) {
      setError('Failed to reset');
      console.error('Failed to reset settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="border-b border-border-primary">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-bg-tertiary transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">⚙️</span>
          <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
            Workflow Settings
          </span>
        </div>
        <span className={`text-xs text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {isLoading ? (
            <div className="text-xs text-text-muted italic">Loading settings...</div>
          ) : (
            <>
              {error && (
                <div className="text-2xs text-status-error bg-status-error/10 px-2 py-1 rounded">
                  {error}
                </div>
              )}

              {/* Style Package Count */}
              <div className="space-y-1">
                <label className="flex items-center justify-between text-xs text-text-secondary">
                  <span>Style Packages</span>
                  <span className="text-text-muted text-2xs">(1-10)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={settings.stylePackageCount}
                  onChange={(e) => handleUpdate({ stylePackageCount: parseInt(e.target.value, 10) || 1 })}
                  disabled={isSaving}
                  className="w-full bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-primary disabled:opacity-50"
                />
                <p className="text-3xs text-text-muted">
                  {settings.stylePackageCount === 1
                    ? 'Single style, no competition'
                    : `${settings.stylePackageCount} styles compete, user picks best`}
                </p>
              </div>

              {/* Parallel Designer Count */}
              <div className="space-y-1">
                <label className="flex items-center justify-between text-xs text-text-secondary">
                  <span>Parallel Designers</span>
                  <span className="text-text-muted text-2xs">(1-15)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={settings.parallelDesignerCount}
                  onChange={(e) => handleUpdate({ parallelDesignerCount: parseInt(e.target.value, 10) || 1 })}
                  disabled={isSaving}
                  className="w-full bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-primary disabled:opacity-50"
                />
                <p className="text-3xs text-text-muted">
                  Max screens generated in parallel
                </p>
              </div>

              {/* Enable Style Competition Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-text-secondary">Style Competition</div>
                  <p className="text-3xs text-text-muted">
                    {settings.enableStyleCompetition ? 'User picks from options' : 'Auto-approve single style'}
                  </p>
                </div>
                <button
                  onClick={() => handleUpdate({ enableStyleCompetition: !settings.enableStyleCompetition })}
                  disabled={isSaving}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    settings.enableStyleCompetition
                      ? 'bg-accent-primary'
                      : 'bg-bg-tertiary border border-border-primary'
                  } ${isSaving ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      settings.enableStyleCompetition ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Max Style Rejections */}
              <div className="space-y-1">
                <label className="flex items-center justify-between text-xs text-text-secondary">
                  <span>Max Rejections</span>
                  <span className="text-text-muted text-2xs">(1-10)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={settings.maxStyleRejections}
                  onChange={(e) => handleUpdate({ maxStyleRejections: parseInt(e.target.value, 10) || 5 })}
                  disabled={isSaving}
                  className="w-full bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-primary disabled:opacity-50"
                />
                <p className="text-3xs text-text-muted">
                  Max times user can reject all styles
                </p>
              </div>

              {/* Claude CLI Timeout */}
              <div className="space-y-1">
                <label className="flex items-center justify-between text-xs text-text-secondary">
                  <span>CLI Timeout</span>
                  <span className="text-text-muted text-2xs">minutes</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={Math.round(settings.claudeCliTimeoutMs / 60000)}
                  onChange={(e) => handleUpdate({ claudeCliTimeoutMs: (parseInt(e.target.value, 10) || 15) * 60000 })}
                  disabled={isSaving}
                  className="w-full bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-primary disabled:opacity-50"
                />
                <p className="text-3xs text-text-muted">
                  Timeout for Claude CLI calls
                </p>
              </div>

              {/* Reset button */}
              <button
                onClick={handleReset}
                disabled={isSaving}
                className="w-full text-2xs py-1.5 px-2 bg-bg-tertiary hover:bg-bg-hover text-text-secondary rounded transition-colors disabled:opacity-50"
              >
                Reset to Defaults
              </button>

              {/* Saving indicator */}
              {isSaving && (
                <div className="text-2xs text-accent-primary text-center">
                  Saving...
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
