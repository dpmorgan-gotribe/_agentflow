/**
 * Context Formatter
 *
 * Formats retrieved context for prompt injection.
 * Supports multiple output formats: markdown, XML, structured.
 *
 * Security:
 * - HTML/XML escaping for content
 * - Length limits to prevent prompt injection
 */

import type { RetrievedContext, ContextItem } from '../context-manager.js';

/**
 * Format options
 */
export interface FormatOptions {
  format: 'markdown' | 'xml' | 'plain';
  includeMetadata: boolean;
  includeSummary: boolean;
  maxItemContentLength: number;
}

/**
 * Default format options
 */
const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  format: 'markdown',
  includeMetadata: true,
  includeSummary: true,
  maxItemContentLength: 2000,
};

/**
 * Structured context for agent consumption
 */
export interface StructuredContext {
  lessons: Array<{
    content: string;
    category: string;
    confidence: number;
    tags?: string[];
  }>;
  code: Array<{
    content: string;
    filePath: string;
    language: string;
    lines?: { start: number; end: number };
  }>;
  history: Array<{
    content: string;
    taskId: string;
    status: string;
  }>;
  summary: {
    totalItems: number;
    totalTokens: number;
    tokenBudget: number;
    truncated: boolean;
  };
}

/**
 * Context formatter for prompt injection
 */
export class ContextFormatter {
  private readonly options: FormatOptions;

  constructor(options: Partial<FormatOptions> = {}) {
    this.options = { ...DEFAULT_FORMAT_OPTIONS, ...options };
  }

  /**
   * Format context for prompt injection
   */
  format(context: RetrievedContext): string {
    switch (this.options.format) {
      case 'xml':
        return this.formatXml(context);
      case 'plain':
        return this.formatPlain(context);
      case 'markdown':
      default:
        return this.formatMarkdown(context);
    }
  }

  /**
   * Format as markdown (default)
   */
  formatMarkdown(context: RetrievedContext): string {
    const sections: string[] = [];

    // Group items by type
    const lessons = context.items.filter((i) => i.type === 'lesson');
    const code = context.items.filter((i) => i.type === 'code');
    const history = context.items.filter((i) => i.type === 'history');

    // Format lessons section
    if (lessons.length > 0) {
      sections.push(this.formatLessonsMarkdown(lessons));
    }

    // Format code section
    if (code.length > 0) {
      sections.push(this.formatCodeMarkdown(code));
    }

    // Format history section
    if (history.length > 0) {
      sections.push(this.formatHistoryMarkdown(history));
    }

    // Add summary
    if (this.options.includeSummary) {
      sections.push(this.formatSummaryMarkdown(context));
    }

    return sections.join('\n\n');
  }

  /**
   * Format lessons as markdown
   */
  private formatLessonsMarkdown(lessons: ContextItem[]): string {
    const lines = ['## Relevant Lessons', ''];

    for (const lesson of lessons) {
      const category = lesson.metadata['category'] || 'General';
      const confidence = lesson.metadata['confidence'];
      const tags = lesson.metadata['tags'] as string[] | undefined;

      let header = `### ${category}`;
      if (typeof confidence === 'number') {
        header += ` (${Math.round(confidence * 100)}% confidence)`;
      }

      lines.push(header);
      lines.push('');
      lines.push(this.truncateContent(lesson.content));
      lines.push('');

      if (this.options.includeMetadata && tags && tags.length > 0) {
        lines.push(`Tags: ${tags.join(', ')}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Format code as markdown
   */
  private formatCodeMarkdown(code: ContextItem[]): string {
    const lines = ['## Relevant Code', ''];

    for (const item of code) {
      const filePath = (item.metadata['file_path'] ||
        item.metadata['filePath']) as string;
      const language = (item.metadata['language'] as string) || 'text';
      const lineStart = item.metadata['line_start'] as number | undefined;
      const lineEnd = item.metadata['line_end'] as number | undefined;

      let header = `### ${filePath}`;
      if (lineStart !== undefined && lineEnd !== undefined) {
        header += ` (lines ${lineStart}-${lineEnd})`;
      }

      lines.push(header);
      lines.push('');
      lines.push(`\`\`\`${language}`);
      lines.push(this.truncateContent(item.content));
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format history as markdown
   */
  private formatHistoryMarkdown(history: ContextItem[]): string {
    const lines = ['## Previous Similar Tasks', ''];

    for (const item of history) {
      const taskId = item.metadata['taskId'] as string;
      const status = item.metadata['status'] as string;

      lines.push(`### Task ${taskId.substring(0, 8)} (${status})`);
      lines.push('');
      lines.push(this.truncateContent(item.content));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format summary as markdown
   */
  private formatSummaryMarkdown(context: RetrievedContext): string {
    const lessons = context.items.filter((i) => i.type === 'lesson').length;
    const code = context.items.filter((i) => i.type === 'code').length;
    const history = context.items.filter((i) => i.type === 'history').length;

    const parts = [
      '---',
      `Context: ${context.items.length} items`,
      `(${lessons} lessons, ${code} code, ${history} history)`,
      `Tokens: ${context.totalTokens}/${context.tokenBudget}`,
    ];

    if (context.truncated) {
      parts.push('(truncated)');
    }

    return parts.join(' | ');
  }

  /**
   * Format as XML for structured parsing
   */
  formatXml(context: RetrievedContext): string {
    const lines = ['<context>'];

    // Group by type
    const lessons = context.items.filter((i) => i.type === 'lesson');
    const code = context.items.filter((i) => i.type === 'code');
    const history = context.items.filter((i) => i.type === 'history');

    if (lessons.length > 0) {
      lines.push('  <lessons>');
      for (const lesson of lessons) {
        lines.push(this.formatLessonXml(lesson));
      }
      lines.push('  </lessons>');
    }

    if (code.length > 0) {
      lines.push('  <code>');
      for (const item of code) {
        lines.push(this.formatCodeXml(item));
      }
      lines.push('  </code>');
    }

    if (history.length > 0) {
      lines.push('  <history>');
      for (const item of history) {
        lines.push(this.formatHistoryXml(item));
      }
      lines.push('  </history>');
    }

    if (this.options.includeSummary) {
      lines.push('  <summary>');
      lines.push(`    <total_items>${context.items.length}</total_items>`);
      lines.push(`    <total_tokens>${context.totalTokens}</total_tokens>`);
      lines.push(`    <token_budget>${context.tokenBudget}</token_budget>`);
      lines.push(`    <truncated>${context.truncated}</truncated>`);
      lines.push('  </summary>');
    }

    lines.push('</context>');

    return lines.join('\n');
  }

  /**
   * Format lesson as XML
   */
  private formatLessonXml(lesson: ContextItem): string {
    const category = this.escapeXml(
      (lesson.metadata['category'] as string) || 'general'
    );
    const confidence = lesson.metadata['confidence'] || 0.5;
    const content = this.escapeXml(this.truncateContent(lesson.content));

    return `    <lesson category="${category}" confidence="${confidence}">
      <content>${content}</content>
    </lesson>`;
  }

  /**
   * Format code as XML
   */
  private formatCodeXml(item: ContextItem): string {
    const filePath = this.escapeXml(
      (item.metadata['file_path'] as string) || 'unknown'
    );
    const language = this.escapeXml((item.metadata['language'] as string) || 'text');
    const content = this.escapeXml(this.truncateContent(item.content));

    return `    <file path="${filePath}" language="${language}">
      <content>${content}</content>
    </file>`;
  }

  /**
   * Format history as XML
   */
  private formatHistoryXml(item: ContextItem): string {
    const taskId = this.escapeXml((item.metadata['taskId'] as string) || 'unknown');
    const status = this.escapeXml((item.metadata['status'] as string) || 'unknown');
    const content = this.escapeXml(this.truncateContent(item.content));

    return `    <task id="${taskId}" status="${status}">
      <content>${content}</content>
    </task>`;
  }

  /**
   * Format as plain text
   */
  formatPlain(context: RetrievedContext): string {
    const lines: string[] = [];

    for (const item of context.items) {
      lines.push(`[${item.type.toUpperCase()}]`);
      lines.push(this.truncateContent(item.content));
      lines.push('');
    }

    if (this.options.includeSummary) {
      lines.push(
        `--- ${context.items.length} items | ${context.totalTokens}/${context.tokenBudget} tokens ---`
      );
    }

    return lines.join('\n');
  }

  /**
   * Format as structured object for agent consumption
   */
  formatStructured(context: RetrievedContext): StructuredContext {
    return {
      lessons: context.items
        .filter((i) => i.type === 'lesson')
        .map((i) => ({
          content: this.truncateContent(i.content),
          category: (i.metadata['category'] as string) || 'general',
          confidence: (i.metadata['confidence'] as number) || 0.5,
          tags: i.metadata['tags'] as string[] | undefined,
        })),
      code: context.items
        .filter((i) => i.type === 'code')
        .map((i) => ({
          content: this.truncateContent(i.content),
          filePath: (i.metadata['file_path'] as string) || 'unknown',
          language: (i.metadata['language'] as string) || 'text',
          lines:
            i.metadata['line_start'] !== undefined
              ? {
                  start: i.metadata['line_start'] as number,
                  end: i.metadata['line_end'] as number,
                }
              : undefined,
        })),
      history: context.items
        .filter((i) => i.type === 'history')
        .map((i) => ({
          content: this.truncateContent(i.content),
          taskId: (i.metadata['taskId'] as string) || 'unknown',
          status: (i.metadata['status'] as string) || 'unknown',
        })),
      summary: {
        totalItems: context.items.length,
        totalTokens: context.totalTokens,
        tokenBudget: context.tokenBudget,
        truncated: context.truncated,
      },
    };
  }

  /**
   * Truncate content to max length
   */
  private truncateContent(content: string): string {
    if (content.length <= this.options.maxItemContentLength) {
      return content;
    }

    // Try to break at a good point
    const truncated = content.substring(0, this.options.maxItemContentLength);
    const lastNewline = truncated.lastIndexOf('\n');
    const lastPeriod = truncated.lastIndexOf('.');

    const breakPoint = Math.max(
      lastNewline,
      lastPeriod,
      this.options.maxItemContentLength - 50
    );

    return content.substring(0, breakPoint) + '\n[truncated]';
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

/**
 * Create context formatter
 */
export function createContextFormatter(
  options?: Partial<FormatOptions>
): ContextFormatter {
  return new ContextFormatter(options);
}
