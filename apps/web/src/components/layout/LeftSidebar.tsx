import { useState, useEffect, useCallback } from 'react';
import type { Project, ProjectWithFiles, FileNode } from '../../types';
import { apiClient, deleteProject } from '../../api';

interface LeftSidebarProps {
  currentProjectId: string | null;
  onProjectChange: (projectId: string) => void;
  activeWorktreeCount?: number;
  currentTaskId?: string | null;
}

/** File/folder icons */
const FILE_ICONS: Record<string, string> = {
  ts: '📄',
  tsx: '⚛️',
  js: '📜',
  jsx: '⚛️',
  json: '{}',
  md: '📝',
  html: '🌐',
  css: '🎨',
  scss: '🎨',
  yaml: '⚙️',
  yml: '⚙️',
  default: '📄',
};

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

/** Recursive file tree component */
function FileTree({
  nodes,
  depth = 0,
  expandedPaths,
  onToggle,
}: {
  nodes: FileNode[];
  depth?: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
}) {
  return (
    <div className="flex flex-col">
      {nodes.map((node) => (
        <div key={node.path}>
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 cursor-pointer hover:bg-bg-tertiary rounded text-xs ${
              depth > 0 ? 'ml-3' : ''
            }`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => node.type === 'directory' && onToggle(node.path)}
          >
            {node.type === 'directory' ? (
              <>
                <span className="text-text-muted text-2xs">
                  {expandedPaths.has(node.path) ? '▼' : '▶'}
                </span>
                <span>📁</span>
              </>
            ) : (
              <>
                <span className="text-2xs opacity-0">▶</span>
                <span>{getFileIcon(node.name)}</span>
              </>
            )}
            <span className="text-text-primary truncate">{node.name}</span>
          </div>
          {node.type === 'directory' &&
            node.children &&
            expandedPaths.has(node.path) && (
              <FileTree
                nodes={node.children}
                depth={depth + 1}
                expandedPaths={expandedPaths}
                onToggle={onToggle}
              />
            )}
        </div>
      ))}
    </div>
  );
}

export function LeftSidebar({
  currentProjectId,
  onProjectChange,
  activeWorktreeCount = 0,
  currentTaskId,
}: LeftSidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectWithFiles | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [otherProjectsExpanded, setOtherProjectsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Handle project deletion
  const handleDeleteProject = useCallback(async () => {
    if (!currentProjectId) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await deleteProject(currentProjectId);

      if (result.success) {
        // Clear current project selection
        onProjectChange('');
        // Refresh projects list
        const updatedProjects = await apiClient.get<Project[]>('/projects');
        setProjects(updatedProjects);
        setShowDeleteConfirm(false);
      } else {
        setDeleteError(result.error || 'Failed to delete project');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  }, [currentProjectId, onProjectChange]);

  // Fetch all projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await apiClient.get<Project[]>('/projects');
        setProjects(response);
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      }
    };
    fetchProjects();
  }, []);

  // Fetch current project files when project changes
  useEffect(() => {
    if (!currentProjectId) {
      setCurrentProject(null);
      return;
    }

    const fetchProjectFiles = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get<ProjectWithFiles>(
          `/projects/${currentProjectId}/files?depth=4`
        );
        setCurrentProject(response);
        // Auto-expand first level directories
        const firstLevelDirs = response.files
          .filter((f) => f.type === 'directory')
          .map((f) => f.path);
        setExpandedPaths(new Set(firstLevelDirs));
      } catch (error) {
        // If project not found (404), clear the stale project reference
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('404')) {
          console.warn(`Project ${currentProjectId} not found, clearing selection`);
          // Clear the stale project ID from store
          onProjectChange('');
        } else {
          console.error('Failed to fetch project files:', error);
        }
        setCurrentProject(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProjectFiles();
  }, [currentProjectId, onProjectChange]);

  const togglePath = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const otherProjects = projects.filter((p) => p.id !== currentProjectId);

  return (
    <aside className="w-left-sidebar bg-bg-secondary border-r border-border-primary flex flex-col overflow-hidden shrink-0">
      {/* Current Project Header */}
      <div className="p-3 border-b border-border-primary">
        <div className="flex items-center justify-between mb-1">
          <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
            Current Project
          </span>
          {currentProject && (
            <div className="flex items-center gap-1.5">
              <span className="text-2xs px-1.5 py-0.5 rounded bg-status-success/20 text-status-success">
                {currentProject.status}
              </span>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-0.5 text-text-muted hover:text-status-error hover:bg-status-error/10 rounded transition-colors"
                title="Delete project"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {currentProject ? (
          <div className="text-sm font-medium text-text-primary truncate">
            {currentProject.name}
          </div>
        ) : (
          <div className="text-xs text-text-muted italic">
            No project selected
          </div>
        )}
      </div>

      {/* Worktrees Section */}
      <div className="p-3 border-b border-border-primary">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
            Worktrees
          </span>
          <span className="text-2xs px-1.5 py-0.5 rounded bg-status-success/20 text-status-success">
            {activeWorktreeCount} active
          </span>
        </div>
        {currentTaskId ? (
          <div className="p-2 bg-bg-card border border-border-primary rounded">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-text-primary">
                task-{currentTaskId.slice(0, 8)}
              </span>
              <span className="text-2xs px-1.5 py-0.5 rounded bg-status-success/20 text-status-success">
                active
              </span>
            </div>
            <div className="text-2xs text-text-muted font-mono">
              /worktrees/task-{currentTaskId.slice(0, 8)}
            </div>
          </div>
        ) : (
          <div className="text-xs text-text-muted italic text-center py-4">
            No active worktrees
          </div>
        )}
      </div>

      {/* Files Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 pb-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
              Files
            </span>
            {currentProject && (
              <span className="text-2xs text-text-muted">
                {currentProject.files.length} items
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="px-3 py-4 text-xs text-text-muted text-center">
            Loading files...
          </div>
        ) : currentProject && currentProject.files.length > 0 ? (
          <div className="px-1 pb-3">
            <FileTree
              nodes={currentProject.files}
              expandedPaths={expandedPaths}
              onToggle={togglePath}
            />
          </div>
        ) : currentProject ? (
          <div className="px-3 py-4 text-xs text-text-muted italic text-center">
            No files yet
          </div>
        ) : (
          <div className="px-3 py-4 text-xs text-text-muted italic text-center">
            Select or create a project
          </div>
        )}
      </div>

      {/* Other Projects Section */}
      <div className="border-t border-border-primary">
        <button
          className="w-full p-3 flex items-center justify-between hover:bg-bg-tertiary transition-colors"
          onClick={() => setOtherProjectsExpanded(!otherProjectsExpanded)}
        >
          <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
            Other Projects
          </span>
          <div className="flex items-center gap-2">
            <span className="text-2xs text-text-muted">
              {otherProjects.length}
            </span>
            <span className="text-text-muted text-xs">
              {otherProjectsExpanded ? '▼' : '▶'}
            </span>
          </div>
        </button>

        {otherProjectsExpanded && (
          <div className="px-2 pb-2 max-h-48 overflow-y-auto">
            {otherProjects.length === 0 ? (
              <div className="px-2 py-3 text-xs text-text-muted italic text-center">
                No other projects
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {otherProjects.map((project) => (
                  <button
                    key={project.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-tertiary transition-colors text-left w-full"
                    onClick={() => onProjectChange(project.id)}
                  >
                    <span className="w-2 h-2 rounded-full bg-accent-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-text-primary truncate">
                        {project.name}
                      </div>
                      <div className="text-2xs text-text-muted truncate">
                        {project.slug}
                      </div>
                    </div>
                    <span
                      className={`text-2xs px-1.5 py-0.5 rounded shrink-0 ${
                        project.status === 'active'
                          ? 'bg-status-success/20 text-status-success'
                          : project.status === 'initializing'
                            ? 'bg-status-warning/20 text-status-warning'
                            : 'bg-bg-tertiary text-text-muted'
                      }`}
                    >
                      {project.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && currentProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary border border-border-primary rounded-lg shadow-xl max-w-md w-full mx-4 p-4">
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Delete Project?
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              This will permanently delete <span className="font-medium text-text-primary">"{currentProject.name}"</span> and abort all running tasks. This cannot be undone.
            </p>

            {deleteError && (
              <div className="mb-4 p-2 bg-status-error/10 border border-status-error/30 rounded text-sm text-status-error">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-3 py-1.5 text-sm rounded border border-border-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className="px-3 py-1.5 text-sm rounded bg-status-error text-white hover:bg-status-error/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
