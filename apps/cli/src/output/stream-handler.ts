/**
 * Stream Handler
 *
 * Handles SSE streaming from the API with validation and security.
 */

import EventSource from 'eventsource';
import chalk from 'chalk';
import { Spinner, createSpinner } from './spinner.js';
import type { AgentEvent } from '../types.js';
import { AgentEventSchema } from '../types.js';
import { StreamingError } from '../errors.js';
import { AGENT_COLORS, CLI_LIMITS } from '../constants.js';

/**
 * Stream handler options
 */
export interface StreamHandlerOptions {
  jsonMode?: boolean;
  onEvent?: (event: AgentEvent) => void;
}

/**
 * Stream handler for SSE task events
 */
export class StreamHandler {
  private eventSource?: EventSource;
  private spinner?: Spinner;
  private readonly jsonMode: boolean;
  private readonly onEvent?: (event: AgentEvent) => void;
  private resolveCompletion?: () => void;
  private rejectCompletion?: (error: Error) => void;

  constructor(options: StreamHandlerOptions = {}) {
    this.jsonMode = options.jsonMode ?? false;
    this.onEvent = options.onEvent;
  }

  /**
   * Connect to task stream
   */
  async connect(streamUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.eventSource = new EventSource(streamUrl);

        this.eventSource.onopen = () => {
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.eventSource.onerror = (error) => {
          // Only reject if we haven't connected yet
          if (this.eventSource?.readyState === EventSource.CONNECTING) {
            reject(new StreamingError('Failed to connect to task stream'));
          } else {
            this.handleConnectionError();
          }
        };
      } catch (error) {
        reject(
          new StreamingError(
            error instanceof Error ? error.message : 'Stream connection failed'
          )
        );
      }
    });
  }

  /**
   * Wait for stream completion
   */
  waitForCompletion(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.resolveCompletion = resolve;
      this.rejectCompletion = reject;
    });
  }

  /**
   * Disconnect from stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = undefined;
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    // Validate message size
    if (data.length > CLI_LIMITS.MAX_MESSAGE_SIZE) {
      console.error(chalk.yellow('Warning: Received oversized message, skipping'));
      return;
    }

    // Parse and validate event
    let event: AgentEvent;
    try {
      const parsed = JSON.parse(data);
      const validation = AgentEventSchema.safeParse(parsed);

      if (!validation.success) {
        console.error(chalk.yellow('Warning: Received invalid event format'));
        return;
      }

      event = validation.data;
    } catch {
      console.error(chalk.yellow('Warning: Failed to parse event'));
      return;
    }

    // Call event handler if provided
    if (this.onEvent) {
      this.onEvent(event);
    }

    // Handle event
    this.handleEvent(event);
  }

  /**
   * Handle validated event
   */
  private handleEvent(event: AgentEvent): void {
    // JSON mode: output raw JSON
    if (this.jsonMode) {
      console.log(JSON.stringify(event));
      return;
    }

    switch (event.type) {
      case 'agent_start':
        this.handleAgentStart(event);
        break;

      case 'agent_message':
        this.handleAgentMessage(event);
        break;

      case 'agent_complete':
        this.handleAgentComplete(event);
        break;

      case 'approval_required':
        this.handleApprovalRequired(event);
        break;

      case 'task_complete':
        this.handleTaskComplete(event);
        break;

      case 'error':
        this.handleError(event);
        break;
    }
  }

  /**
   * Handle agent_start event
   */
  private handleAgentStart(event: AgentEvent): void {
    this.spinner?.stop();
    this.spinner = createSpinner(
      `${this.formatAgent(event.agentId)} working...`
    );
    this.spinner.start();
  }

  /**
   * Handle agent_message event
   */
  private handleAgentMessage(event: AgentEvent): void {
    this.spinner?.stop();
    console.log(`${this.formatAgent(event.agentId)}: ${event.message}`);
    this.spinner?.start();
  }

  /**
   * Handle agent_complete event
   */
  private handleAgentComplete(event: AgentEvent): void {
    this.spinner?.succeed(`${this.formatAgent(event.agentId)} complete`);

    // Display artifacts if present
    if (event.artifacts && event.artifacts.length > 0) {
      for (const artifact of event.artifacts) {
        console.log(chalk.dim(`  → ${artifact.type}: ${artifact.path}`));
      }
    }
  }

  /**
   * Handle approval_required event
   */
  private handleApprovalRequired(_event: AgentEvent): void {
    this.spinner?.info('Approval required');
    console.log(chalk.yellow('\nRun: aigentflow approve <taskId>'));
    this.disconnect();
    this.resolveCompletion?.();
  }

  /**
   * Handle task_complete event
   */
  private handleTaskComplete(_event: AgentEvent): void {
    this.spinner?.succeed('Task complete');
    this.disconnect();
    this.resolveCompletion?.();
  }

  /**
   * Handle error event
   */
  private handleError(event: AgentEvent): void {
    this.spinner?.fail(`Error: ${event.error || 'Unknown error'}`);
    this.disconnect();
    this.rejectCompletion?.(new StreamingError(event.error || 'Task failed'));
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(): void {
    this.spinner?.fail('Connection lost');
    this.disconnect();
    this.rejectCompletion?.(new StreamingError('Stream connection lost'));
  }

  /**
   * Format agent name with color
   */
  private formatAgent(agentId?: string): string {
    const name = agentId || 'unknown';
    const colorName = AGENT_COLORS[name] || 'white';

    // Get chalk color function
    const colorFn =
      chalk[colorName as keyof typeof chalk] || chalk.white;

    if (typeof colorFn === 'function') {
      return (colorFn as (text: string) => string)(`[${name}]`);
    }

    return chalk.white(`[${name}]`);
  }
}

/**
 * Create a new stream handler
 */
export function createStreamHandler(
  options?: StreamHandlerOptions
): StreamHandler {
  return new StreamHandler(options);
}
