/**
 * System Service
 *
 * Handles system-level operations including graceful shutdown.
 */

import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { exec } from 'child_process';

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
  async triggerShutdown(reason: string, frontendPort?: number): Promise<void> {
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
      this.killProcessTree(frontendPort);
    }, 500);
  }

  /**
   * Kill processes listening on a specific port
   */
  private killByPort(port: number): void {
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      // Windows: Find PIDs listening on port and kill them
      // Using netstat to find the PID, then taskkill
      exec(
        `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port} ^| findstr LISTENING') do taskkill /F /PID %a`,
        { shell: 'cmd.exe' },
        (error) => {
          if (error) {
            this.logger.warn(`Failed to kill process on port ${port}: ${error.message}`);
          } else {
            this.logger.log(`Killed process on port ${port}`);
          }
        },
      );
    } else {
      // Unix: Use lsof to find and kill process on port
      exec(`lsof -ti:${port} | xargs -r kill -9`, (error) => {
        if (error) {
          this.logger.warn(`Failed to kill process on port ${port}: ${error.message}`);
        } else {
          this.logger.log(`Killed process on port ${port}`);
        }
      });
    }
  }

  /**
   * Kill all Vite dev server ports (5173-5178)
   * Vite increments ports when previous ones are in use
   */
  private killAllVitePorts(): void {
    const vitePorts = [5173, 5174, 5175, 5176, 5177, 5178];
    this.logger.log(`Killing all Vite dev servers on ports ${vitePorts.join(', ')}...`);

    for (const port of vitePorts) {
      this.killByPort(port);
    }
  }

  /**
   * Kill the entire process tree (API + frontend + all children)
   * This ensures the Kill All button actually stops everything
   */
  private killProcessTree(frontendPort?: number): void {
    const ppid = process.ppid;
    const isWindows = process.platform === 'win32';

    // Kill all Vite dev server instances (they can spawn on multiple ports)
    this.killAllVitePorts();

    // Also kill specific frontend port if provided
    if (frontendPort && ![5173, 5174, 5175, 5176, 5177, 5178].includes(frontendPort)) {
      this.logger.log(`Killing additional frontend on port ${frontendPort}...`);
      this.killByPort(frontendPort);
    }

    if (ppid && ppid !== 1) {
      this.logger.log(`Killing parent process tree (PPID: ${ppid})...`);

      if (isWindows) {
        // Windows: taskkill with /T flag kills entire process tree
        exec(`taskkill /F /T /PID ${ppid}`, (error) => {
          if (error) {
            this.logger.warn(`Failed to kill parent tree: ${error.message}`);
            process.exit(0);
          }
        });
      } else {
        // Unix: Kill the process group
        try {
          process.kill(-ppid, 'SIGTERM');
        } catch {
          this.logger.warn('Failed to kill parent process group');
          process.exit(0);
        }
      }
    } else {
      // No parent to kill, just exit
      process.exit(0);
    }
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
