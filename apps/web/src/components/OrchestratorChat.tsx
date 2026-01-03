/**
 * OrchestratorChat Component
 *
 * Chat-style interface for interacting with the orchestrator.
 * Features:
 * - Message history with user/orchestrator messages
 * - Input field for sending messages
 * - Real-time thinking display
 * - Typewriter effect for responses
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ExtendedAgentEvent } from '../types';

/** Chat message types */
export interface ChatMessage {
  id: string;
  role: 'user' | 'orchestrator' | 'system';
  content: string;
  timestamp: string;
  thinking?: string;
  action?: string;
  targets?: string[];
  isStreaming?: boolean;
}

interface OrchestratorChatProps {
  taskId: string | undefined;
  orchestratorEvents: ExtendedAgentEvent[];
  isExecuting: boolean;
  onSendMessage: (message: string) => Promise<void>;
}

/** Convert orchestrator events to chat messages */
function eventsToMessages(events: ExtendedAgentEvent[]): ChatMessage[] {
  return events
    .filter((e) => e.agent === 'orchestrator' || e.agent === 'system')
    .map((event, index) => ({
      id: `event-${index}-${event.timestamp}`,
      role: 'orchestrator' as const,
      content: event.message || event.status || 'Processing...',
      timestamp: event.timestamp,
      thinking: event.thinking?.thinking,
      action: event.thinking?.action,
      targets: event.thinking?.targets,
    }));
}

/** Format timestamp for display */
function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function OrchestratorChat({
  taskId,
  orchestratorEvents,
  isExecuting,
  onSendMessage,
}: OrchestratorChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [userMessages, setUserMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Convert events to messages and merge with user messages
  const orchestratorMessages = eventsToMessages(orchestratorEvents);
  const allMessages = [...orchestratorMessages, ...userMessages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  // Handle sending a message
  const handleSend = useCallback(async () => {
    const message = inputValue.trim();
    if (!message || !taskId || isSending) return;

    // Add user message to local state
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setUserMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    try {
      await onSendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Add error message
      setUserMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'system',
          content: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [inputValue, taskId, isSending, onSendMessage]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    setInputValue(textarea.value);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {allMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-2xl mb-2 opacity-50">💬</div>
            <div className="text-xs text-text-muted">No messages yet</div>
            <div className="text-2xs text-text-muted mt-1">
              {taskId
                ? 'Send a message to guide the orchestrator'
                : 'Start a task to chat with the orchestrator'}
            </div>
          </div>
        ) : (
          <>
            {allMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-2 border-t border-border-primary bg-bg-tertiary/50">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              !taskId
                ? 'Start a task first...'
                : isExecuting
                  ? 'Send guidance to orchestrator...'
                  : 'Ask a question...'
            }
            disabled={!taskId || isSending}
            rows={1}
            className="flex-1 px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-xs text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '36px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!taskId || !inputValue.trim() || isSending}
            className="px-3 py-2 bg-accent-primary text-white rounded-lg text-xs font-medium hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {isSending ? '...' : 'Send'}
          </button>
        </div>
        <div className="text-2xs text-text-muted mt-1 text-center">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}

/** Individual message bubble */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser
            ? 'bg-accent-primary text-white'
            : isSystem
              ? 'bg-status-error/20 text-status-error border border-status-error/30'
              : 'bg-bg-tertiary text-text-primary border border-border-primary'
        }`}
      >
        {/* Header with role and time */}
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-2xs font-medium ${isUser ? 'text-white/80' : 'text-text-muted'}`}>
            {isUser ? 'You' : isSystem ? 'System' : 'Orchestrator'}
          </span>
          <span className={`text-2xs ${isUser ? 'text-white/60' : 'text-text-muted'}`}>
            {formatTime(message.timestamp)}
          </span>
          {message.action && (
            <span className="text-2xs px-1.5 py-0.5 bg-accent-primary/20 text-accent-primary rounded">
              {message.action}
            </span>
          )}
        </div>

        {/* Message content */}
        <div className="text-xs whitespace-pre-wrap break-words">
          {message.content}
        </div>

        {/* Thinking section */}
        {message.thinking && (
          <div className="mt-2 pt-2 border-t border-border-primary/30">
            <div className="flex items-center gap-1 text-2xs text-text-muted mb-1">
              <span>🧠</span>
              <span>Thinking</span>
            </div>
            <div className="text-2xs text-text-secondary line-clamp-3">
              {message.thinking}
            </div>
          </div>
        )}

        {/* Targets */}
        {message.targets && message.targets.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.targets.map((target, i) => (
              <span
                key={i}
                className="text-2xs px-1.5 py-0.5 bg-bg-tertiary/50 rounded text-text-muted"
              >
                → {target}
              </span>
            ))}
          </div>
        )}

        {/* Streaming indicator */}
        {message.isStreaming && (
          <div className="flex items-center gap-1 mt-1">
            <span className="animate-pulse text-2xs text-text-muted">●</span>
            <span className="text-2xs text-text-muted">Typing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
