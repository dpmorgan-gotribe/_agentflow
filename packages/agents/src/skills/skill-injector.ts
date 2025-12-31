/**
 * Skill Injector
 *
 * Injects selected skills into agent prompts with multiple format options.
 * Handles token budget management and skill organization.
 *
 * Features:
 * - Multiple output formats (markdown, xml, plain)
 * - Token budget awareness
 * - Skill grouping by category
 * - Example inclusion (optional)
 *
 * SECURITY:
 * - Content escaping for XML format
 * - Token budget enforcement
 */

import type { LoadedSkill, SkillInjection, SkillCategory } from './types.js';
import { PRIORITY_WEIGHTS } from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Injection format options
 */
export type InjectionFormat = 'markdown' | 'xml' | 'plain';

/**
 * Injection options
 */
export interface InjectionOptions {
  /** Output format */
  format: InjectionFormat;
  /** Whether to include examples */
  includeExamples?: boolean;
  /** Group skills by category */
  groupByCategory?: boolean;
  /** Add section headers */
  addHeaders?: boolean;
  /** Maximum total tokens (will truncate if exceeded) */
  maxTokens?: number;
  /** Custom header text */
  headerText?: string;
  /** Custom footer text */
  footerText?: string;
}

/**
 * Default injection options
 */
const DEFAULT_OPTIONS: InjectionOptions = {
  format: 'markdown',
  includeExamples: true,
  groupByCategory: true,
  addHeaders: true,
};

// ============================================================================
// XML Escaping
// ============================================================================

/**
 * Escape special XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format a skill in markdown
 */
function formatSkillMarkdown(skill: LoadedSkill, includeExamples: boolean): string {
  const lines: string[] = [];

  lines.push(`### ${skill.name}`);
  lines.push('');
  lines.push(`*Priority: ${skill.priority} | Category: ${skill.category}*`);
  lines.push('');
  lines.push(skill.instructions);

  if (includeExamples && skill.examples && skill.examples.length > 0) {
    lines.push('');
    lines.push('#### Examples');
    lines.push('');
    for (const example of skill.examples) {
      lines.push(`**Scenario:** ${example.scenario}`);
      lines.push('');
      lines.push('**Input:**');
      lines.push('```');
      lines.push(example.input);
      lines.push('```');
      lines.push('');
      lines.push('**Output:**');
      lines.push('```');
      lines.push(example.output);
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Format a skill in XML
 */
function formatSkillXml(skill: LoadedSkill, includeExamples: boolean): string {
  const lines: string[] = [];

  lines.push(`<skill id="${escapeXml(skill.id)}" priority="${skill.priority}" category="${skill.category}">`);
  lines.push(`  <name>${escapeXml(skill.name)}</name>`);
  lines.push(`  <instructions>`);
  lines.push(`    ${escapeXml(skill.instructions)}`);
  lines.push(`  </instructions>`);

  if (includeExamples && skill.examples && skill.examples.length > 0) {
    lines.push('  <examples>');
    for (const example of skill.examples) {
      lines.push('    <example>');
      lines.push(`      <scenario>${escapeXml(example.scenario)}</scenario>`);
      lines.push(`      <input>${escapeXml(example.input)}</input>`);
      lines.push(`      <output>${escapeXml(example.output)}</output>`);
      lines.push('    </example>');
    }
    lines.push('  </examples>');
  }

  lines.push('</skill>');

  return lines.join('\n');
}

/**
 * Format a skill in plain text
 */
function formatSkillPlain(skill: LoadedSkill, includeExamples: boolean): string {
  const lines: string[] = [];

  lines.push(`[${skill.name.toUpperCase()}]`);
  lines.push(`Priority: ${skill.priority} | Category: ${skill.category}`);
  lines.push('');
  lines.push(skill.instructions);

  if (includeExamples && skill.examples && skill.examples.length > 0) {
    lines.push('');
    lines.push('Examples:');
    for (let i = 0; i < skill.examples.length; i++) {
      const example = skill.examples[i];
      if (!example) continue;
      lines.push('');
      lines.push(`  Example ${i + 1}: ${example.scenario}`);
      lines.push(`  Input: ${example.input}`);
      lines.push(`  Output: ${example.output}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a single skill based on format option
 */
function formatSkill(
  skill: LoadedSkill,
  format: InjectionFormat,
  includeExamples: boolean
): string {
  switch (format) {
    case 'markdown':
      return formatSkillMarkdown(skill, includeExamples);
    case 'xml':
      return formatSkillXml(skill, includeExamples);
    case 'plain':
      return formatSkillPlain(skill, includeExamples);
    default:
      return formatSkillMarkdown(skill, includeExamples);
  }
}

// ============================================================================
// Category Headers
// ============================================================================

/**
 * Category display names
 */
const CATEGORY_NAMES: Record<SkillCategory, string> = {
  coding: 'Coding Skills',
  testing: 'Testing Skills',
  security: 'Security Skills',
  compliance: 'Compliance Skills',
  documentation: 'Documentation Skills',
  analysis: 'Analysis Skills',
  devops: 'DevOps Skills',
  database: 'Database Skills',
  api: 'API Skills',
  ui: 'UI/UX Skills',
};

/**
 * Format category header
 */
function formatCategoryHeader(
  category: SkillCategory,
  format: InjectionFormat
): string {
  const name = CATEGORY_NAMES[category] || category;

  switch (format) {
    case 'markdown':
      return `\n## ${name}\n`;
    case 'xml':
      return `\n<category name="${escapeXml(category)}">\n`;
    case 'plain':
      return `\n=== ${name.toUpperCase()} ===\n`;
    default:
      return `\n## ${name}\n`;
  }
}

/**
 * Format category footer (for XML)
 */
function formatCategoryFooter(format: InjectionFormat): string {
  if (format === 'xml') {
    return '</category>\n';
  }
  return '';
}

// ============================================================================
// Main Injection Functions
// ============================================================================

/**
 * Group skills by category
 */
function groupByCategory(skills: LoadedSkill[]): Map<SkillCategory, LoadedSkill[]> {
  const groups = new Map<SkillCategory, LoadedSkill[]>();

  for (const skill of skills) {
    const existing = groups.get(skill.category) || [];
    existing.push(skill);
    groups.set(skill.category, existing);
  }

  return groups;
}

/**
 * Sort skills by priority (descending)
 */
function sortByPriority(skills: LoadedSkill[]): LoadedSkill[] {
  return [...skills].sort(
    (a, b) => PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
  );
}

/**
 * Estimate token count for text (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Inject skills into a prompt
 */
export function injectSkills(
  skills: LoadedSkill[],
  options: Partial<InjectionOptions> = {}
): SkillInjection {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const parts: string[] = [];
  const includedSkills: string[] = [];
  let currentTokens = 0;

  // Add header
  if (opts.addHeaders) {
    const header = opts.headerText || getDefaultHeader(opts.format);
    parts.push(header);
    currentTokens += estimateTokens(header);
  }

  // Sort skills by priority
  const sorted = sortByPriority(skills);

  if (opts.groupByCategory) {
    // Group and format by category
    const groups = groupByCategory(sorted);

    // Process categories in a consistent order
    const categories: SkillCategory[] = [
      'security',
      'coding',
      'testing',
      'compliance',
      'api',
      'database',
      'devops',
      'documentation',
      'analysis',
      'ui',
    ];

    for (const category of categories) {
      const categorySkills = groups.get(category);
      if (!categorySkills || categorySkills.length === 0) continue;

      const categoryHeader = formatCategoryHeader(category, opts.format);
      const headerTokens = estimateTokens(categoryHeader);

      // Check if we can fit the header
      if (opts.maxTokens && currentTokens + headerTokens > opts.maxTokens) {
        break;
      }

      parts.push(categoryHeader);
      currentTokens += headerTokens;

      for (const skill of categorySkills) {
        const formatted = formatSkill(skill, opts.format, opts.includeExamples ?? true);
        const skillTokens = estimateTokens(formatted);

        // Check token budget
        if (opts.maxTokens && currentTokens + skillTokens > opts.maxTokens) {
          // Skip non-critical skills if over budget
          if (skill.priority !== 'critical') {
            continue;
          }
        }

        parts.push(formatted);
        includedSkills.push(skill.id);
        currentTokens += skillTokens;
      }

      parts.push(formatCategoryFooter(opts.format));
    }
  } else {
    // Format skills without grouping
    for (const skill of sorted) {
      const formatted = formatSkill(skill, opts.format, opts.includeExamples ?? true);
      const skillTokens = estimateTokens(formatted);

      // Check token budget
      if (opts.maxTokens && currentTokens + skillTokens > opts.maxTokens) {
        // Skip non-critical skills if over budget
        if (skill.priority !== 'critical') {
          continue;
        }
      }

      parts.push(formatted);
      parts.push(''); // Add spacing between skills
      includedSkills.push(skill.id);
      currentTokens += skillTokens;
    }
  }

  // Add footer
  if (opts.addHeaders) {
    const footer = opts.footerText || getDefaultFooter(opts.format);
    parts.push(footer);
    currentTokens += estimateTokens(footer);
  }

  return {
    content: parts.join('\n'),
    tokenCount: currentTokens,
    skills: includedSkills,
  };
}

/**
 * Get default header for format
 */
function getDefaultHeader(format: InjectionFormat): string {
  switch (format) {
    case 'markdown':
      return '# Skills and Guidelines\n\nThe following skills and guidelines apply to this task:\n';
    case 'xml':
      return '<skills>\n';
    case 'plain':
      return '========== SKILLS AND GUIDELINES ==========\n\nThe following skills and guidelines apply to this task:\n';
    default:
      return '';
  }
}

/**
 * Get default footer for format
 */
function getDefaultFooter(format: InjectionFormat): string {
  switch (format) {
    case 'markdown':
      return '\n---\n*Apply these skills throughout your work.*\n';
    case 'xml':
      return '</skills>\n';
    case 'plain':
      return '\n================================================\nApply these skills throughout your work.\n';
    default:
      return '';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a minimal injection (no examples, no grouping)
 */
export function injectSkillsMinimal(skills: LoadedSkill[]): SkillInjection {
  return injectSkills(skills, {
    format: 'plain',
    includeExamples: false,
    groupByCategory: false,
    addHeaders: false,
  });
}

/**
 * Create a compact markdown injection
 */
export function injectSkillsCompact(
  skills: LoadedSkill[],
  maxTokens?: number
): SkillInjection {
  return injectSkills(skills, {
    format: 'markdown',
    includeExamples: false,
    groupByCategory: true,
    addHeaders: true,
    maxTokens,
  });
}

/**
 * Create a full XML injection (for structured parsing)
 */
export function injectSkillsXml(skills: LoadedSkill[]): SkillInjection {
  return injectSkills(skills, {
    format: 'xml',
    includeExamples: true,
    groupByCategory: true,
    addHeaders: true,
  });
}

/**
 * Format skill list as a simple bullet list
 */
export function formatSkillList(skills: LoadedSkill[]): string {
  return skills.map((s) => `- ${s.name} (${s.priority})`).join('\n');
}

/**
 * Get skills summary for logging
 */
export function getSkillsSummary(skills: LoadedSkill[]): {
  count: number;
  totalTokens: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
} {
  const byCategory: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  let totalTokens = 0;

  for (const skill of skills) {
    byCategory[skill.category] = (byCategory[skill.category] || 0) + 1;
    byPriority[skill.priority] = (byPriority[skill.priority] || 0) + 1;
    totalTokens += skill.tokenBudget;
  }

  return {
    count: skills.length,
    totalTokens,
    byCategory,
    byPriority,
  };
}
