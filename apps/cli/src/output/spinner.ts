/**
 * Spinner Wrapper
 *
 * Wrapper around ora spinner for consistent CLI feedback.
 */

import ora, { type Ora } from 'ora';

/**
 * Spinner state
 */
export type SpinnerState = 'spinning' | 'succeeded' | 'failed' | 'stopped';

/**
 * Create and manage a spinner
 */
export class Spinner {
  private spinner: Ora;
  private state: SpinnerState = 'stopped';

  constructor(text?: string) {
    this.spinner = ora({
      text,
      spinner: 'dots',
      color: 'cyan',
    });
  }

  /**
   * Start the spinner
   */
  start(text?: string): this {
    if (text) {
      this.spinner.text = text;
    }
    this.spinner.start();
    this.state = 'spinning';
    return this;
  }

  /**
   * Stop the spinner
   */
  stop(): this {
    this.spinner.stop();
    this.state = 'stopped';
    return this;
  }

  /**
   * Mark as succeeded
   */
  succeed(text?: string): this {
    this.spinner.succeed(text);
    this.state = 'succeeded';
    return this;
  }

  /**
   * Mark as failed
   */
  fail(text?: string): this {
    this.spinner.fail(text);
    this.state = 'failed';
    return this;
  }

  /**
   * Show info message
   */
  info(text?: string): this {
    this.spinner.info(text);
    this.state = 'stopped';
    return this;
  }

  /**
   * Show warning message
   */
  warn(text?: string): this {
    this.spinner.warn(text);
    this.state = 'stopped';
    return this;
  }

  /**
   * Update spinner text
   */
  text(text: string): this {
    this.spinner.text = text;
    return this;
  }

  /**
   * Get current state
   */
  getState(): SpinnerState {
    return this.state;
  }

  /**
   * Check if spinner is currently spinning
   */
  isSpinning(): boolean {
    return this.state === 'spinning';
  }
}

/**
 * Create a new spinner
 */
export function createSpinner(text?: string): Spinner {
  return new Spinner(text);
}
