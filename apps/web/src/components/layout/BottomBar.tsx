import { useState, useRef, useEffect } from 'react';
import { createTask } from '../../api';
import type { Task } from '../../types';

interface BottomBarProps {
  onTaskCreated: (task: Task) => void;
  disabled: boolean;
  isExecuting: boolean;
  onPause: () => void;
  onStop: () => void;
  currentProjectId: string | null;
}

export function BottomBar({
  onTaskCreated,
  disabled,
  isExecuting,
  onPause,
  onStop,
  currentProjectId,
}: BottomBarProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when expanded
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || disabled || loading || !currentProjectId) return;

    setLoading(true);
    try {
      const task = await createTask(prompt, currentProjectId);
      onTaskCreated(task);
      setPrompt('');
      setIsExpanded(false);
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setLoading(false);
    }
  };

  // Show message when no project is selected
  const noProjectSelected = !currentProjectId;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    // Ctrl+Enter or Cmd+Enter to submit
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e);
      return;
    }

    // Enter without shift submits in collapsed mode
    if (e.key === 'Enter' && !e.shiftKey && !isExpanded) {
      e.preventDefault();
      handleSubmit(e);
      return;
    }

    // Escape to collapse
    if (e.key === 'Escape' && isExpanded) {
      setIsExpanded(false);
    }
  };

  const handleInputClick = () => {
    if (!isExpanded) {
      setIsExpanded(true);
    }
  };

  return (
    <div
      className={`bg-bg-secondary border-t border-border-primary flex flex-col shrink-0 transition-all duration-200 ease-out ${
        isExpanded ? 'h-[25vh]' : 'h-bottom-bar'
      }`}
    >
      {/* Expanded Header */}
      {isExpanded && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary">
          <span className="text-xs text-text-muted">
            Describe what you want to build...
          </span>
          <button
            onClick={() => setIsExpanded(false)}
            className="text-text-muted hover:text-text-primary transition-colors p-1"
            title="Collapse (Esc)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 flex ${isExpanded ? 'flex-col p-4 gap-3' : 'items-center px-4 gap-3'}`}>
        {/* Command Input */}
        <form onSubmit={handleSubmit} className={`${isExpanded ? 'flex-1 flex flex-col' : 'flex-1'} relative`}>
          {isExpanded ? (
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your app idea in detail...

Examples:
• Build a todo app with categories, due dates, and priority levels
• Create a blog platform with markdown support and comments
• Design a dashboard for tracking fitness goals"
              disabled={disabled || loading}
              className="flex-1 w-full p-4 bg-bg-input border border-border-primary rounded-lg text-text-primary text-sm placeholder-text-muted outline-none transition-all focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/30 disabled:opacity-50 resize-none"
            />
          ) : (
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              onClick={handleInputClick}
              placeholder={noProjectSelected ? "Create or select a project first..." : "Tell the orchestrator what to do..."}
              disabled={disabled || loading || noProjectSelected}
              className="w-full py-2 px-4 pr-16 bg-bg-input border border-border-primary rounded-lg text-text-primary text-sm placeholder-text-muted outline-none transition-all focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/30 disabled:opacity-50 cursor-pointer"
            />
          )}
          {!isExpanded && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xs text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">
              Ctrl+K
            </span>
          )}
        </form>

        {/* Action Buttons */}
        <div className={`flex items-center gap-2 ${isExpanded ? 'justify-end' : ''}`}>
          {isExpanded && (
            <span className="text-2xs text-text-muted mr-2">
              Ctrl+Enter to execute
            </span>
          )}
          <button
            onClick={onPause}
            disabled={!isExecuting}
            className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded text-text-secondary text-xs font-medium hover:bg-bg-card-hover hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Pause
          </button>
          <button
            onClick={onStop}
            disabled={!isExecuting}
            className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded text-status-error text-xs font-medium hover:bg-bg-card-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Stop
          </button>
          <button
            onClick={(e) => handleSubmit(e)}
            disabled={disabled || loading || !prompt.trim()}
            className="px-6 py-2 bg-accent-primary hover:bg-accent-primary-hover rounded text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Starting...' : 'Execute'}
          </button>
        </div>
      </div>
    </div>
  );
}
