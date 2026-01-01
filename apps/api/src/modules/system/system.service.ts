/**
 * System Service
 *
 * Handles system-level operations including graceful shutdown.
 */

import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';

@Injectable()
export class SystemService implements OnApplicationShutdown {
  private readonly logger = new Logger(SystemService.name);
  private shutdownCallbacks: Array<() => Promise<void>> = [];
  private isShuttingDown = false;

  /**
   * Register a callback to be executed during shutdown
   */
  registerShutdownCallback(callback: () => Promise<void>): void {
    this.shutdownCallbacks.push(callback);
  }

  /**
   * Check if shutdown is in progress
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Trigger graceful shutdown
   */
  async triggerShutdown(reason: string): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.logger.warn(`Initiating shutdown: ${reason}`);

    // Execute all registered callbacks
    for (const callback of this.shutdownCallbacks) {
      try {
        await callback();
      } catch (error) {
        this.logger.error('Shutdown callback failed:', error);
      }
    }

    // Exit process after a short delay to allow response to be sent
    setTimeout(() => {
      this.logger.log('Exiting process...');
      process.exit(0);
    }, 500);
  }

  /**
   * NestJS lifecycle hook - called when application is shutting down
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Application shutdown triggered by signal: ${signal ?? 'unknown'}`);

    if (!this.isShuttingDown) {
      this.isShuttingDown = true;

      for (const callback of this.shutdownCallbacks) {
        try {
          await callback();
        } catch (error) {
          this.logger.error('Shutdown callback failed:', error);
        }
      }
    }
  }
}
