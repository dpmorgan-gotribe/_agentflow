/**
 * Orchestrator Service
 *
 * Manages user interaction with the orchestrator during workflow execution.
 * Handles:
 * - Storing user messages per task
 * - Notifying workflow of new messages
 * - Retrieving conversation history
 */

import { Injectable, Logger } from '@nestjs/common';
import { WorkflowService } from '../workflow/workflow.service';

/** User message to orchestrator */
export interface OrchestratorMessage {
  id: string;
  taskId: string;
  role: 'user' | 'orchestrator';
  content: string;
  timestamp: string;
}

/** Conversation history for a task */
export interface ConversationHistory {
  taskId: string;
  messages: OrchestratorMessage[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  /** In-memory storage for conversations (per task) */
  private conversations = new Map<string, ConversationHistory>();

  constructor(private readonly workflowService: WorkflowService) {}

  /**
   * Send a message to the orchestrator for a specific task
   */
  async sendMessage(taskId: string, content: string): Promise<OrchestratorMessage> {
    this.logger.log(`User message for task ${taskId}: ${content.slice(0, 50)}...`);

    // Create the message
    const message: OrchestratorMessage = {
      id: crypto.randomUUID(),
      taskId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    // Store in conversation history
    this.addMessageToHistory(taskId, message);

    // Notify the workflow service about the user message
    // This will be picked up by the orchestrator in its next thinking step
    this.notifyWorkflow(taskId, message);

    return message;
  }

  /**
   * Get conversation history for a task
   */
  getHistory(taskId: string): ConversationHistory | null {
    return this.conversations.get(taskId) || null;
  }

  /**
   * Get all messages for a task
   */
  getMessages(taskId: string): OrchestratorMessage[] {
    return this.conversations.get(taskId)?.messages || [];
  }

  /**
   * Add an orchestrator response to the history
   */
  addOrchestratorMessage(taskId: string, content: string): OrchestratorMessage {
    const message: OrchestratorMessage = {
      id: crypto.randomUUID(),
      taskId,
      role: 'orchestrator',
      content,
      timestamp: new Date().toISOString(),
    };

    this.addMessageToHistory(taskId, message);
    return message;
  }

  /**
   * Clear conversation history for a task
   */
  clearHistory(taskId: string): void {
    this.conversations.delete(taskId);
    this.logger.debug(`Cleared conversation history for task ${taskId}`);
  }

  /**
   * Add a message to the conversation history
   */
  private addMessageToHistory(taskId: string, message: OrchestratorMessage): void {
    let history = this.conversations.get(taskId);

    if (!history) {
      history = {
        taskId,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.conversations.set(taskId, history);
    }

    history.messages.push(message);
    history.updatedAt = new Date().toISOString();

    // Limit history to last 50 messages per task
    if (history.messages.length > 50) {
      history.messages = history.messages.slice(-50);
    }
  }

  /**
   * Notify the workflow about a new user message
   *
   * This triggers the workflow to incorporate the user's guidance
   * in its next decision-making step.
   */
  private notifyWorkflow(taskId: string, message: OrchestratorMessage): void {
    // Get the event stream for this task
    const eventStream = this.workflowService.getEventStream(taskId);

    if (eventStream) {
      // Emit a user_message event through the SSE stream
      // The frontend will receive this and can update the UI accordingly
      this.logger.debug(`Notifying workflow of user message for task ${taskId}`);

      // The workflow will pick up user messages from the conversation history
      // when it enters its next thinking phase
    } else {
      this.logger.warn(`No active workflow found for task ${taskId}`);
    }
  }

  /**
   * Get pending user messages that the orchestrator hasn't processed yet
   *
   * Called by the workflow when entering a thinking phase to check
   * if there are any user messages to incorporate.
   */
  getPendingUserMessages(taskId: string): OrchestratorMessage[] {
    const history = this.conversations.get(taskId);
    if (!history) return [];

    // Return user messages from the last 5 minutes that haven't been processed
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return history.messages.filter(
      (m) =>
        m.role === 'user' &&
        new Date(m.timestamp).getTime() > fiveMinutesAgo
    );
  }
}
