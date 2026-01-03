import { useState } from 'react';
import { createProject } from '../api';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (projectId: string) => void;
}

/**
 * Converts a project name to a URL-safe slug
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export function NewProjectModal({ isOpen, onClose, onProjectCreated }: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const slug = slugify(name);
  const isValid = name.trim().length >= 2 && slug.length >= 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const project = await createProject(name.trim(), description.trim() || undefined);
      onProjectCreated(project.id);
      // Reset form
      setName('');
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setName('');
      setDescription('');
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text-primary">Create New Project</h2>
          <button
            onClick={handleClose}
            disabled={isCreating}
            className="text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div>
            <label htmlFor="project-name" className="block text-xs font-medium text-text-secondary mb-1.5">
              Project Name <span className="text-status-error">*</span>
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome App"
              disabled={isCreating}
              autoFocus
              className="w-full py-2 px-3 bg-bg-input border border-border-primary rounded-lg text-text-primary text-sm placeholder-text-muted outline-none transition-all focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/30 disabled:opacity-50"
            />
            {name.trim() && (
              <p className="text-2xs text-text-muted mt-1">
                Directory: <code className="bg-bg-tertiary px-1 rounded">.aigentflow/projects/{slug}/</code>
              </p>
            )}
          </div>

          {/* Description (Optional) */}
          <div>
            <label htmlFor="project-description" className="block text-xs font-medium text-text-secondary mb-1.5">
              Description <span className="text-text-muted">(optional)</span>
            </label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of what you're building..."
              disabled={isCreating}
              rows={3}
              className="w-full py-2 px-3 bg-bg-input border border-border-primary rounded-lg text-text-primary text-sm placeholder-text-muted outline-none transition-all focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/30 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-status-error/10 border border-status-error/30 rounded-lg p-3 text-xs text-status-error">
              {error}
            </div>
          )}

          {/* Info Box */}
          <div className="bg-bg-tertiary rounded-lg p-3 text-xs text-text-secondary">
            <p className="mb-2">Creating a project will:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Create a new directory for your project</li>
              <li>Initialize a Git repository</li>
              <li>Generate project configuration files</li>
              <li>All agent outputs will be saved here</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isCreating}
              className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary hover:bg-bg-card-hover transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || isCreating}
              className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover rounded text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
