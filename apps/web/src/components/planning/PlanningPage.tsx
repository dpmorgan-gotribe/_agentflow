import { useState, useMemo } from 'react';
import type {
  Epic,
  Feature,
  PlanningTask,
  ProjectPlan,
  WorkBreakdownSummary,
  Complexity,
  Priority,
  PlanningTaskType,
} from '../../types';

interface PlanningPageProps {
  plan: ProjectPlan | null;
  onNavigateToDesign?: (mockupPath: string) => void;
}

/** Color mapping for complexity badges */
const COMPLEXITY_COLORS: Record<Complexity, string> = {
  trivial: 'bg-gray-500',
  simple: 'bg-green-500',
  moderate: 'bg-yellow-500',
  complex: 'bg-orange-500',
  epic: 'bg-red-500',
};

/** Color mapping for priority badges */
const PRIORITY_COLORS: Record<Priority, string> = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-500',
};

/** Color mapping for task types */
const TASK_TYPE_COLORS: Record<PlanningTaskType, string> = {
  design: 'bg-purple-500',
  frontend: 'bg-blue-500',
  backend: 'bg-green-500',
  database: 'bg-cyan-500',
  testing: 'bg-yellow-500',
  integration: 'bg-orange-500',
  documentation: 'bg-gray-500',
  devops: 'bg-red-500',
  review: 'bg-indigo-500',
};

/** Badge component */
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${color} text-white`}>
      {label}
    </span>
  );
}

/** Summary stats panel */
function SummaryPanel({ summary }: { summary: WorkBreakdownSummary }) {
  return (
    <div className="bg-bg-tertiary border border-border-primary rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Work Breakdown Summary</h3>
      <div className="grid grid-cols-4 gap-4 text-xs">
        <div>
          <div className="text-text-secondary">Epics</div>
          <div className="text-xl font-bold text-text-primary">{summary.totalEpics}</div>
        </div>
        <div>
          <div className="text-text-secondary">Features</div>
          <div className="text-xl font-bold text-text-primary">{summary.totalFeatures}</div>
        </div>
        <div>
          <div className="text-text-secondary">Tasks</div>
          <div className="text-xl font-bold text-text-primary">{summary.totalTasks}</div>
        </div>
        <div>
          <div className="text-text-secondary">Est. Effort</div>
          <div className="text-xl font-bold text-text-primary">{summary.estimatedTotalEffort}</div>
        </div>
      </div>
      {summary.complianceTaskCount > 0 && (
        <div className="mt-3 pt-3 border-t border-border-primary">
          <span className="text-xs text-amber-400">
            {summary.complianceTaskCount} compliance-relevant task{summary.complianceTaskCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

/** Epic list item */
function EpicItem({
  epic,
  isSelected,
  onClick,
}: {
  epic: Epic;
  isSelected: boolean;
  onClick: () => void;
}) {
  const taskCount = epic.features.reduce((sum, f) => sum + f.tasks.length, 0);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isSelected
          ? 'bg-accent-primary/20 border-accent-primary'
          : 'bg-bg-tertiary border-border-primary hover:bg-bg-card-hover'
      }`}
    >
      <div className="font-medium text-sm text-text-primary mb-1">{epic.title}</div>
      <div className="text-xs text-text-secondary line-clamp-2 mb-2">{epic.objective}</div>
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <span>{epic.features.length} features</span>
        <span>•</span>
        <span>{taskCount} tasks</span>
        {epic.risks.length > 0 && (
          <>
            <span>•</span>
            <span className="text-amber-400">{epic.risks.length} risks</span>
          </>
        )}
      </div>
    </button>
  );
}

/** Feature list item */
function FeatureItem({
  feature,
  isSelected,
  onClick,
}: {
  feature: Feature;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isSelected
          ? 'bg-accent-primary/20 border-accent-primary'
          : 'bg-bg-tertiary border-border-primary hover:bg-bg-card-hover'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium text-sm text-text-primary">{feature.title}</span>
        <Badge label={feature.priority} color={PRIORITY_COLORS[feature.priority]} />
      </div>
      <div className="text-xs text-text-secondary italic mb-2 line-clamp-2">{feature.userStory}</div>
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <span>{feature.tasks.length} tasks</span>
        {feature.complianceRelevant && (
          <>
            <span>•</span>
            <span className="text-amber-400">Compliance</span>
          </>
        )}
      </div>
    </button>
  );
}

/** Task list item */
function TaskItem({
  task,
  isSelected,
  onClick,
  onDesignClick,
}: {
  task: PlanningTask;
  isSelected: boolean;
  onClick: () => void;
  onDesignClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isSelected
          ? 'bg-accent-primary/20 border-accent-primary'
          : 'bg-bg-tertiary border-border-primary hover:bg-bg-card-hover'
      }`}
    >
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="font-medium text-sm text-text-primary">{task.title}</span>
        <Badge label={task.type} color={TASK_TYPE_COLORS[task.type]} />
        <Badge label={task.complexity} color={COMPLEXITY_COLORS[task.complexity]} />
      </div>
      <div className="text-xs text-text-secondary line-clamp-2 mb-2">{task.description}</div>
      <div className="flex items-center gap-2 text-xs">
        {task.assignedAgents.length > 0 && (
          <span className="text-text-secondary">
            {task.assignedAgents.join(', ')}
          </span>
        )}
        {task.designReference?.mockupPath && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDesignClick?.();
            }}
            className="text-accent-primary hover:underline"
          >
            View Design
          </button>
        )}
        {task.complianceRelevant && (
          <span className="text-amber-400">Compliance</span>
        )}
      </div>
    </button>
  );
}

/** Detail modal for viewing full item details */
function DetailModal({
  type,
  item,
  onClose,
  onNavigateToDesign,
}: {
  type: 'epic' | 'feature' | 'task';
  item: Epic | Feature | PlanningTask;
  onClose: () => void;
  onNavigateToDesign?: (path: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-secondary border border-border-primary rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-bg-secondary border-b border-border-primary p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-text-secondary uppercase">{type}</span>
            <h2 className="text-lg font-semibold text-text-primary">{item.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-1">Description</h3>
            <p className="text-sm text-text-secondary">{item.description}</p>
          </div>

          {/* Epic-specific fields */}
          {type === 'epic' && (
            <>
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-1">Objective</h3>
                <p className="text-sm text-text-secondary">{(item as Epic).objective}</p>
              </div>
              {(item as Epic).successMetrics.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-text-primary mb-1">Success Metrics</h3>
                  <ul className="list-disc list-inside text-sm text-text-secondary">
                    {(item as Epic).successMetrics.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(item as Epic).risks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-text-primary mb-1">Risks</h3>
                  <div className="space-y-2">
                    {(item as Epic).risks.map((risk, i) => (
                      <div key={i} className="bg-bg-tertiary rounded p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge label={risk.severity} color={
                            risk.severity === 'high' ? 'bg-red-500' :
                            risk.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                          } />
                          <span className="text-sm text-text-primary">{risk.description}</span>
                        </div>
                        <div className="text-xs text-text-secondary">
                          <strong>Mitigation:</strong> {risk.mitigation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Feature-specific fields */}
          {type === 'feature' && (
            <>
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-1">User Story</h3>
                <p className="text-sm text-text-secondary italic">{(item as Feature).userStory}</p>
              </div>
              <div className="flex gap-2">
                <Badge label={(item as Feature).priority} color={PRIORITY_COLORS[(item as Feature).priority]} />
                {(item as Feature).complianceRelevant && (
                  <Badge label="Compliance" color="bg-amber-500" />
                )}
              </div>
              {(item as Feature).acceptanceCriteria.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-text-primary mb-1">Acceptance Criteria</h3>
                  <ul className="list-disc list-inside text-sm text-text-secondary">
                    {(item as Feature).acceptanceCriteria.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Task-specific fields */}
          {type === 'task' && (
            <>
              <div className="flex gap-2 flex-wrap">
                <Badge label={(item as PlanningTask).type} color={TASK_TYPE_COLORS[(item as PlanningTask).type]} />
                <Badge label={(item as PlanningTask).complexity} color={COMPLEXITY_COLORS[(item as PlanningTask).complexity]} />
                {(item as PlanningTask).complianceRelevant && (
                  <Badge label="Compliance" color="bg-amber-500" />
                )}
              </div>
              {(item as PlanningTask).assignedAgents.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-text-primary mb-1">Assigned Agents</h3>
                  <div className="flex gap-1 flex-wrap">
                    {(item as PlanningTask).assignedAgents.map((agent) => (
                      <span key={agent} className="px-2 py-1 bg-bg-tertiary rounded text-xs text-text-secondary">
                        {agent}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(item as PlanningTask).acceptanceCriteria.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-text-primary mb-1">Acceptance Criteria</h3>
                  <ul className="list-disc list-inside text-sm text-text-secondary">
                    {(item as PlanningTask).acceptanceCriteria.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(item as PlanningTask).designReference && (
                <div>
                  <h3 className="text-sm font-medium text-text-primary mb-1">Design Reference</h3>
                  <div className="bg-bg-tertiary rounded p-3 space-y-2 text-sm">
                    {(item as PlanningTask).designReference?.mockupPath && (
                      <div className="flex items-center gap-2">
                        <span className="text-text-secondary">Mockup:</span>
                        <button
                          onClick={() => onNavigateToDesign?.((item as PlanningTask).designReference!.mockupPath!)}
                          className="text-accent-primary hover:underline"
                        >
                          {(item as PlanningTask).designReference?.mockupPath}
                        </button>
                      </div>
                    )}
                    {(item as PlanningTask).designReference?.componentNames?.length && (
                      <div>
                        <span className="text-text-secondary">Components: </span>
                        <span className="text-text-primary">
                          {(item as PlanningTask).designReference?.componentNames?.join(', ')}
                        </span>
                      </div>
                    )}
                    {(item as PlanningTask).designReference?.implementationNotes && (
                      <div>
                        <span className="text-text-secondary">Notes: </span>
                        <span className="text-text-primary">
                          {(item as PlanningTask).designReference?.implementationNotes}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {(item as PlanningTask).tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-text-primary mb-1">Tags</h3>
                  <div className="flex gap-1 flex-wrap">
                    {(item as PlanningTask).tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-bg-tertiary rounded text-xs text-text-secondary">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Export functions */
function exportAsMarkdown(plan: ProjectPlan): string {
  let md = '# Project Plan\n\n';

  // Summary
  md += '## Summary\n\n';
  md += `- **Epics:** ${plan.summary.totalEpics}\n`;
  md += `- **Features:** ${plan.summary.totalFeatures}\n`;
  md += `- **Tasks:** ${plan.summary.totalTasks}\n`;
  md += `- **Estimated Effort:** ${plan.summary.estimatedTotalEffort}\n\n`;

  // Epics
  for (const epic of plan.epics) {
    md += `## Epic: ${epic.title}\n\n`;
    md += `**Objective:** ${epic.objective}\n\n`;
    if (epic.description) md += `${epic.description}\n\n`;

    // Success Metrics
    if (epic.successMetrics.length > 0) {
      md += '### Success Metrics\n\n';
      epic.successMetrics.forEach(m => md += `- ${m}\n`);
      md += '\n';
    }

    // Features
    for (const feature of epic.features) {
      md += `### Feature: ${feature.title}\n\n`;
      md += `**Priority:** ${feature.priority}\n\n`;
      md += `**User Story:** ${feature.userStory}\n\n`;

      // Tasks
      if (feature.tasks.length > 0) {
        md += '#### Tasks\n\n';
        md += '| Task | Type | Complexity | Agents |\n';
        md += '|------|------|------------|--------|\n';
        for (const task of feature.tasks) {
          md += `| ${task.title} | ${task.type} | ${task.complexity} | ${task.assignedAgents.join(', ')} |\n`;
        }
        md += '\n';
      }
    }
  }

  return md;
}

function exportAsJson(plan: ProjectPlan): string {
  return JSON.stringify(plan, null, 2);
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Main Planning Page component */
export function PlanningPage({ plan, onNavigateToDesign }: PlanningPageProps) {
  const [selectedEpicId, setSelectedEpicId] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<{
    type: 'epic' | 'feature' | 'task';
    item: Epic | Feature | PlanningTask;
  } | null>(null);

  // Get selected items
  const selectedEpic = useMemo(() =>
    plan?.epics.find(e => e.id === selectedEpicId) ?? null,
    [plan, selectedEpicId]
  );

  const selectedFeature = useMemo(() =>
    selectedEpic?.features.find(f => f.id === selectedFeatureId) ?? null,
    [selectedEpic, selectedFeatureId]
  );

  // Handle exports
  const handleExportMarkdown = () => {
    if (!plan) return;
    const md = exportAsMarkdown(plan);
    downloadFile(md, 'project-plan.md', 'text/markdown');
  };

  const handleExportJson = () => {
    if (!plan) return;
    const json = exportAsJson(plan);
    downloadFile(json, 'project-plan.json', 'application/json');
  };

  if (!plan) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-bg-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">No Project Plan</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            Run a workflow with the Project Manager agent to generate a work breakdown structure.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with summary and export buttons */}
      <div className="p-4 border-b border-border-primary">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Project Plan</h2>
          <div className="flex gap-2">
            <button
              onClick={handleExportMarkdown}
              className="px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-xs text-text-secondary hover:bg-bg-card-hover hover:text-text-primary transition-colors"
            >
              Export Markdown
            </button>
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-xs text-text-secondary hover:bg-bg-card-hover hover:text-text-primary transition-colors"
            >
              Export JSON
            </button>
          </div>
        </div>
        <SummaryPanel summary={plan.summary} />
      </div>

      {/* Three-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Epics column */}
        <div className="w-1/3 border-r border-border-primary flex flex-col">
          <div className="p-3 border-b border-border-primary bg-bg-tertiary">
            <h3 className="text-sm font-medium text-text-primary">Epics ({plan.epics.length})</h3>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {plan.epics.map((epic) => (
              <EpicItem
                key={epic.id}
                epic={epic}
                isSelected={epic.id === selectedEpicId}
                onClick={() => {
                  setSelectedEpicId(epic.id);
                  setSelectedFeatureId(null);
                  setSelectedTaskId(null);
                }}
              />
            ))}
          </div>
        </div>

        {/* Features column */}
        <div className="w-1/3 border-r border-border-primary flex flex-col">
          <div className="p-3 border-b border-border-primary bg-bg-tertiary">
            <h3 className="text-sm font-medium text-text-primary">
              Features {selectedEpic ? `(${selectedEpic.features.length})` : ''}
            </h3>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {selectedEpic ? (
              selectedEpic.features.map((feature) => (
                <FeatureItem
                  key={feature.id}
                  feature={feature}
                  isSelected={feature.id === selectedFeatureId}
                  onClick={() => {
                    setSelectedFeatureId(feature.id);
                    setSelectedTaskId(null);
                  }}
                />
              ))
            ) : (
              <div className="text-sm text-text-secondary text-center py-8">
                Select an epic to view features
              </div>
            )}
          </div>
        </div>

        {/* Tasks column */}
        <div className="w-1/3 flex flex-col">
          <div className="p-3 border-b border-border-primary bg-bg-tertiary">
            <h3 className="text-sm font-medium text-text-primary">
              Tasks {selectedFeature ? `(${selectedFeature.tasks.length})` : ''}
            </h3>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {selectedFeature ? (
              selectedFeature.tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  isSelected={task.id === selectedTaskId}
                  onClick={() => {
                    setSelectedTaskId(task.id);
                    setDetailModal({ type: 'task', item: task });
                  }}
                  onDesignClick={() => {
                    if (task.designReference?.mockupPath) {
                      onNavigateToDesign?.(task.designReference.mockupPath);
                    }
                  }}
                />
              ))
            ) : (
              <div className="text-sm text-text-secondary text-center py-8">
                Select a feature to view tasks
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detailModal && (
        <DetailModal
          type={detailModal.type}
          item={detailModal.item}
          onClose={() => setDetailModal(null)}
          onNavigateToDesign={onNavigateToDesign}
        />
      )}
    </div>
  );
}
