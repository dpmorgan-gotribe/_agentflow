/**
 * CLI Formatter
 *
 * Formats activity events for CLI display with colors and icons.
 *
 * Uses ANSI escape codes for terminal colors (no external dependencies).
 *
 * Security features:
 * - Content sanitization for terminal output
 * - XSS prevention (control character removal)
 */

import { ActivityEvent, ActivitySeverity, ActivityType, DisplayFormat } from '../types.js';

// ============================================================================
// ANSI Color Codes
// ============================================================================

/**
 * ANSI escape codes for colors
 */
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Bright colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

/**
 * Apply color to text
 */
function color(text: string, colorCode: string): string {
  return `${colorCode}${text}${ANSI.reset}`;
}

// ============================================================================
// Severity Colors
// ============================================================================

/**
 * Color codes for each severity level
 */
const SEVERITY_COLORS: Record<ActivitySeverity, string> = {
  debug: ANSI.gray,
  info: ANSI.blue,
  success: ANSI.green,
  warning: ANSI.yellow,
  error: ANSI.red,
};

// ============================================================================
// Icons
// ============================================================================

/**
 * Icons for agent types (using agent ID prefix)
 */
const AGENT_ICONS: Record<string, string> = {
  orchestrator: '🎯',
  project_manager: '📋',
  architect: '🏗️',
  analyst: '🔍',
  ui_designer: '🎨',
  frontend: '⚛️',
  backend: '⚙️',
  tester: '🧪',
  bug_fixer: '🔧',
  reviewer: '👀',
  git: '📦',
  compliance: '🛡️',
};

/**
 * Icons for activity types
 */
const TYPE_ICONS: Partial<Record<ActivityType, string>> = {
  workflow_start: '🚀',
  workflow_complete: '✅',
  workflow_error: '❌',
  workflow_pause: '⏸️',
  workflow_resume: '▶️',
  agent_start: '▶',
  agent_thinking: '💭',
  agent_complete: '✓',
  agent_error: '✗',
  file_write: '📝',
  file_read: '📖',
  file_delete: '🗑️',
  git_commit: '📦',
  git_push: '⬆️',
  git_conflict: '⚠️',
  user_approval: '👍',
  user_rejection: '👎',
  system_warning: '⚠️',
  system_error: '❌',
  design_generated: '🎨',
  design_approved: '✅',
  mockup_created: '🖼️',
  tokens_extracted: '🎯',
};

// ============================================================================
// Sanitization
// ============================================================================

/**
 * Sanitize text for terminal output
 * Removes control characters that could affect terminal behavior
 */
function sanitizeForTerminal(text: string): string {
  // Remove ANSI escape sequences (except our own)
  // Remove other control characters except newline and tab
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

// ============================================================================
// CLI Formatter Class
// ============================================================================

/**
 * Formatter options
 */
export interface CLIFormatterOptions {
  format?: DisplayFormat;
  showTimestamps?: boolean;
  showIcons?: boolean;
  useColors?: boolean;
}

/**
 * CLI Formatter for activity events
 */
export class CLIFormatter {
  private displayFormat: DisplayFormat;
  private showTimestamps: boolean;
  private showIcons: boolean;
  private useColors: boolean;

  constructor(options: CLIFormatterOptions = {}) {
    this.displayFormat = options.format ?? 'simple';
    this.showTimestamps = options.showTimestamps ?? true;
    this.showIcons = options.showIcons ?? true;
    this.useColors = options.useColors ?? true;
  }

  /**
   * Format event for display
   */
  format(event: ActivityEvent): string {
    switch (this.displayFormat) {
      case 'json':
        return this.formatJson(event);
      case 'compact':
        return this.formatCompact(event);
      case 'detailed':
        return this.formatDetailed(event);
      case 'simple':
      default:
        return this.formatSimple(event);
    }
  }

  /**
   * Simple format - one line per event
   */
  private formatSimple(event: ActivityEvent): string {
    const colorCode = this.useColors ? SEVERITY_COLORS[event.severity] : '';
    const icon = this.showIcons ? this.getIcon(event) + ' ' : '';
    const timestamp = this.showTimestamps
      ? this.colorize(`[${this.formatTime(event.timestamp)}] `, ANSI.gray)
      : '';
    const agent = event.agentId
      ? this.colorize(`[${event.agentId}] `, ANSI.cyan)
      : '';

    let line = `${timestamp}${icon}${agent}${this.colorize(event.title, colorCode)}`;

    if (event.message !== event.title) {
      line += ` ${this.colorize('-', ANSI.gray)} ${sanitizeForTerminal(event.message)}`;
    }

    if (event.progress) {
      const bar = this.formatProgressBar(event.progress.percentage);
      line += ` ${bar} ${event.progress.percentage}%`;
    }

    if (event.duration !== undefined) {
      line += ` ${this.colorize(`(${this.formatDuration(event.duration)})`, ANSI.gray)}`;
    }

    return line;
  }

  /**
   * Compact format - minimal output
   */
  private formatCompact(event: ActivityEvent): string {
    const icon = this.getIcon(event);
    const severityChar = event.severity.charAt(0).toUpperCase();
    return `${icon} [${severityChar}] ${sanitizeForTerminal(event.title)}`;
  }

  /**
   * Detailed format - multi-line with full info
   */
  private formatDetailed(event: ActivityEvent): string {
    const lines: string[] = [];
    const colorCode = this.useColors ? SEVERITY_COLORS[event.severity] : '';

    lines.push(this.colorize('─'.repeat(60), colorCode));
    lines.push(`${this.getIcon(event)} ${this.colorize(event.title, colorCode + ANSI.bold)}`);
    lines.push('');
    lines.push(`  ${this.colorize('Time:', ANSI.gray)} ${event.timestamp}`);
    lines.push(`  ${this.colorize('Type:', ANSI.gray)} ${event.type}`);
    lines.push(`  ${this.colorize('Category:', ANSI.gray)} ${event.category}`);
    lines.push(`  ${this.colorize('Severity:', ANSI.gray)} ${event.severity}`);

    if (event.agentId) {
      lines.push(`  ${this.colorize('Agent:', ANSI.gray)} ${event.agentId}`);
    }

    lines.push('');
    lines.push(`  ${sanitizeForTerminal(event.message)}`);

    if (event.progress) {
      lines.push('');
      const bar = this.formatProgressBar(event.progress.percentage, 30);
      lines.push(
        `  ${this.colorize('Progress:', ANSI.gray)} ${bar} ${event.progress.current}/${event.progress.total}`
      );
    }

    if (event.duration !== undefined) {
      lines.push(`  ${this.colorize('Duration:', ANSI.gray)} ${this.formatDuration(event.duration)}`);
    }

    if (event.details && Object.keys(event.details).length > 0) {
      lines.push('');
      lines.push(`  ${this.colorize('Details:', ANSI.gray)}`);
      for (const [key, value] of Object.entries(event.details)) {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        lines.push(`    ${key}: ${sanitizeForTerminal(valueStr)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * JSON format - raw JSON output
   */
  private formatJson(event: ActivityEvent): string {
    return JSON.stringify(event, null, 2);
  }

  /**
   * Get icon for event
   */
  private getIcon(event: ActivityEvent): string {
    // Check agent ID first
    if (event.agentId) {
      const agentKey = event.agentId.toLowerCase();
      for (const [key, icon] of Object.entries(AGENT_ICONS)) {
        if (agentKey.includes(key)) {
          return icon;
        }
      }
    }

    // Fall back to type icon
    return TYPE_ICONS[event.type] ?? '•';
  }

  /**
   * Format timestamp to time only
   */
  private formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  /**
   * Format progress bar
   */
  private formatProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    const filledBar = '█'.repeat(filled);
    const emptyBar = '░'.repeat(empty);

    if (this.useColors) {
      return color(filledBar, ANSI.green) + color(emptyBar, ANSI.gray);
    }
    return filledBar + emptyBar;
  }

  /**
   * Apply color if colors are enabled
   */
  private colorize(text: string, colorCode: string): string {
    if (!this.useColors || !colorCode) return text;
    return color(text, colorCode);
  }

  /**
   * Set display format
   */
  setFormat(format: DisplayFormat): void {
    this.displayFormat = format;
  }

  /**
   * Enable/disable timestamps
   */
  setShowTimestamps(show: boolean): void {
    this.showTimestamps = show;
  }

  /**
   * Enable/disable icons
   */
  setShowIcons(show: boolean): void {
    this.showIcons = show;
  }

  /**
   * Enable/disable colors
   */
  setUseColors(use: boolean): void {
    this.useColors = use;
  }
}

// ============================================================================
// Spinner Animation
// ============================================================================

/**
 * Spinner animation frames
 */
export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Create a spinner animation helper
 */
export function createSpinner(): {
  frame: () => string;
  reset: () => void;
} {
  let index = 0;

  return {
    frame: () => {
      const frame = SPINNER_FRAMES[index % SPINNER_FRAMES.length];
      index = (index + 1) % SPINNER_FRAMES.length;
      // SPINNER_FRAMES is a constant non-empty array, so frame is always defined
      return frame as string;
    },
    reset: () => {
      index = 0;
    },
  };
}

// ============================================================================
// Activity Display Helper
// ============================================================================

/**
 * Create a CLI activity display that streams events
 */
export function createActivityDisplay(options: CLIFormatterOptions = {}): {
  formatter: CLIFormatter;
  log: (event: ActivityEvent) => void;
} {
  const formatter = new CLIFormatter(options);

  return {
    formatter,
    log: (event: ActivityEvent) => {
      const line = formatter.format(event);
      // eslint-disable-next-line no-console
      console.log(line);
    },
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a CLI formatter
 */
export function createCLIFormatter(options?: CLIFormatterOptions): CLIFormatter {
  return new CLIFormatter(options);
}

/**
 * Format a single event (convenience function)
 */
export function formatActivityEvent(
  event: ActivityEvent,
  format: DisplayFormat = 'simple'
): string {
  const formatter = new CLIFormatter({ format });
  return formatter.format(event);
}
