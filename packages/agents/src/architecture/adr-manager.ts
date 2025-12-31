/**
 * ADR Manager
 *
 * Manages Architecture Decision Records (ADRs) in memory.
 * Provides rendering to markdown format for artifact generation.
 *
 * Note: File I/O operations are handled by the caller via artifacts.
 * This keeps the agent package pure without filesystem dependencies.
 */

import type { ADR, ADRStatus, ADRAlternative, ADRConsequences } from '../schemas/architect-output.js';
import { generateADRId, createADR } from '../schemas/architect-output.js';

/**
 * ADR creation options
 */
export interface ADRCreateOptions {
  title: string;
  context: string;
  decision: string;
  consequences?: Partial<ADRConsequences>;
  alternatives?: ADRAlternative[];
  relatedADRs?: string[];
  status?: ADRStatus;
}

/**
 * ADR Manager class
 *
 * Manages ADRs in memory with support for:
 * - Creating new ADRs with auto-generated IDs
 * - Updating ADR status
 * - Rendering ADRs to markdown
 * - Validating ADR relationships
 */
export class ADRManager {
  private adrs: Map<string, ADR> = new Map();

  /**
   * Create a new ADR Manager
   *
   * @param existingAdrs - Optional array of existing ADRs to load
   */
  constructor(existingAdrs?: ADR[]) {
    if (existingAdrs) {
      for (const adr of existingAdrs) {
        this.adrs.set(adr.id, adr);
      }
    }
  }

  /**
   * Create a new ADR with auto-generated ID
   *
   * @param options - ADR creation options
   * @returns The created ADR
   */
  create(options: ADRCreateOptions): ADR {
    const existingIds = Array.from(this.adrs.keys());
    const id = generateADRId(existingIds);

    const adr: ADR = {
      ...createADR(id, options.title, options.context, options.decision),
      status: options.status || 'proposed',
      consequences: {
        positive: options.consequences?.positive || [],
        negative: options.consequences?.negative || [],
        risks: options.consequences?.risks || [],
      },
      alternatives: options.alternatives || [],
      relatedADRs: options.relatedADRs || [],
    };

    this.adrs.set(id, adr);
    return adr;
  }

  /**
   * Add an existing ADR
   *
   * @param adr - The ADR to add
   */
  add(adr: ADR): void {
    this.adrs.set(adr.id, adr);
  }

  /**
   * Get ADR by ID
   *
   * @param id - The ADR ID
   * @returns The ADR or undefined
   */
  get(id: string): ADR | undefined {
    return this.adrs.get(id);
  }

  /**
   * List all ADRs
   *
   * @returns Array of all ADRs sorted by ID
   */
  list(): ADR[] {
    return Array.from(this.adrs.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * List ADRs by status
   *
   * @param status - The status to filter by
   * @returns Array of ADRs with matching status
   */
  listByStatus(status: ADRStatus): ADR[] {
    return this.list().filter((adr) => adr.status === status);
  }

  /**
   * Update ADR status
   *
   * @param id - The ADR ID
   * @param status - The new status
   * @returns true if updated, false if ADR not found
   */
  updateStatus(id: string, status: ADRStatus): boolean {
    const adr = this.adrs.get(id);
    if (!adr) return false;

    adr.status = status;
    return true;
  }

  /**
   * Link two ADRs as related
   *
   * @param id1 - First ADR ID
   * @param id2 - Second ADR ID
   * @returns true if both ADRs exist and were linked
   */
  link(id1: string, id2: string): boolean {
    const adr1 = this.adrs.get(id1);
    const adr2 = this.adrs.get(id2);

    if (!adr1 || !adr2) return false;

    if (!adr1.relatedADRs.includes(id2)) {
      adr1.relatedADRs.push(id2);
    }
    if (!adr2.relatedADRs.includes(id1)) {
      adr2.relatedADRs.push(id1);
    }

    return true;
  }

  /**
   * Supersede an ADR with a new one
   *
   * @param oldId - The ADR to supersede
   * @param newId - The new ADR
   * @returns true if successful
   */
  supersede(oldId: string, newId: string): boolean {
    const oldAdr = this.adrs.get(oldId);
    const newAdr = this.adrs.get(newId);

    if (!oldAdr || !newAdr) return false;

    oldAdr.status = 'superseded';
    this.link(oldId, newId);

    return true;
  }

  /**
   * Validate all ADR relationships
   *
   * @returns Validation result with any issues found
   */
  validate(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    for (const adr of this.adrs.values()) {
      // Check related ADRs exist
      for (const relatedId of adr.relatedADRs) {
        if (!this.adrs.has(relatedId)) {
          issues.push(`ADR ${adr.id} references non-existent ADR ${relatedId}`);
        }
      }

      // Check for empty required fields
      if (!adr.context.trim()) {
        issues.push(`ADR ${adr.id} has empty context`);
      }
      if (!adr.decision.trim()) {
        issues.push(`ADR ${adr.id} has empty decision`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Render ADR as markdown
   *
   * @param adr - The ADR to render
   * @returns Markdown string
   */
  renderMarkdown(adr: ADR): string {
    const lines: string[] = [];

    lines.push(`# ${adr.id}: ${adr.title}`);
    lines.push('');
    lines.push(`**Status:** ${adr.status}`);
    lines.push(`**Date:** ${adr.date}`);
    lines.push('');

    lines.push('## Context');
    lines.push('');
    lines.push(adr.context);
    lines.push('');

    lines.push('## Decision');
    lines.push('');
    lines.push(adr.decision);
    lines.push('');

    lines.push('## Consequences');
    lines.push('');

    if (adr.consequences.positive.length > 0) {
      lines.push('### Positive');
      lines.push('');
      for (const p of adr.consequences.positive) {
        lines.push(`- ${p}`);
      }
      lines.push('');
    }

    if (adr.consequences.negative.length > 0) {
      lines.push('### Negative');
      lines.push('');
      for (const n of adr.consequences.negative) {
        lines.push(`- ${n}`);
      }
      lines.push('');
    }

    if (adr.consequences.risks.length > 0) {
      lines.push('### Risks');
      lines.push('');
      for (const r of adr.consequences.risks) {
        lines.push(`- ${r}`);
      }
      lines.push('');
    }

    if (adr.alternatives.length > 0) {
      lines.push('## Alternatives Considered');
      lines.push('');
      for (const alt of adr.alternatives) {
        lines.push(`### ${alt.option}`);
        lines.push('');
        if (alt.pros.length > 0) {
          lines.push('**Pros:**');
          for (const p of alt.pros) {
            lines.push(`- ${p}`);
          }
          lines.push('');
        }
        if (alt.cons.length > 0) {
          lines.push('**Cons:**');
          for (const c of alt.cons) {
            lines.push(`- ${c}`);
          }
          lines.push('');
        }
      }
    }

    if (adr.relatedADRs.length > 0) {
      lines.push('## Related ADRs');
      lines.push('');
      for (const related of adr.relatedADRs) {
        lines.push(`- ${related}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate filename for ADR
   *
   * @param adr - The ADR
   * @returns Filename in format ADR-0001-title-slug.md
   */
  generateFilename(adr: ADR): string {
    const slug = adr.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${adr.id}-${slug}.md`;
  }

  /**
   * Generate full path for ADR
   *
   * @param adr - The ADR
   * @param baseDir - Base directory (default: docs/architecture/decisions)
   * @returns Full path for the ADR file
   */
  generatePath(adr: ADR, baseDir = 'docs/architecture/decisions'): string {
    return `${baseDir}/${this.generateFilename(adr)}`;
  }

  /**
   * Get ADR count
   */
  get count(): number {
    return this.adrs.size;
  }

  /**
   * Clear all ADRs
   */
  clear(): void {
    this.adrs.clear();
  }
}

/**
 * Render directory structure as markdown
 *
 * @param structure - The directory structure
 * @param indent - Current indentation level
 * @returns Markdown string with tree representation
 */
export function renderDirectoryStructure(
  structure: { path: string; description: string; children?: unknown[] },
  indent = 0
): string {
  const prefix = indent === 0 ? '' : '  '.repeat(indent - 1) + '├── ';
  let result = `${prefix}${structure.path}/`;

  if (structure.description) {
    result += ` # ${structure.description}`;
  }
  result += '\n';

  if (structure.children && Array.isArray(structure.children)) {
    for (let i = 0; i < structure.children.length; i++) {
      const child = structure.children[i] as {
        path: string;
        description: string;
        children?: unknown[];
      };
      result += renderDirectoryStructure(child, indent + 1);
    }
  }

  return result;
}

/**
 * Render coding conventions as markdown
 *
 * @param conventions - The coding conventions
 * @returns Markdown string
 */
export function renderCodingConventions(conventions: {
  naming: Record<string, string>;
  formatting: { indentation: string; lineLength: number; quotes: string; semicolons: boolean };
  patterns: Array<{ name: string; description: string; example: string }>;
  antiPatterns: Array<{ name: string; description: string; alternative: string }>;
}): string {
  const lines: string[] = [];

  lines.push('# Coding Conventions');
  lines.push('');

  lines.push('## Naming Conventions');
  lines.push('');
  lines.push(`- **Files:** ${conventions.naming['files'] || 'kebab-case'}`);
  lines.push(`- **Directories:** ${conventions.naming['directories'] || 'kebab-case'}`);
  lines.push(`- **Components:** ${conventions.naming['components'] || 'PascalCase'}`);
  lines.push(`- **Functions:** ${conventions.naming['functions'] || 'camelCase'}`);
  lines.push(`- **Variables:** ${conventions.naming['variables'] || 'camelCase'}`);
  lines.push(`- **Constants:** ${conventions.naming['constants'] || 'SCREAMING_SNAKE_CASE'}`);
  lines.push(`- **Types:** ${conventions.naming['types'] || 'PascalCase'}`);
  lines.push('');

  lines.push('## Formatting');
  lines.push('');
  lines.push(`- **Indentation:** ${conventions.formatting.indentation}`);
  lines.push(`- **Line Length:** ${conventions.formatting.lineLength}`);
  lines.push(`- **Quotes:** ${conventions.formatting.quotes}`);
  lines.push(`- **Semicolons:** ${conventions.formatting.semicolons ? 'Required' : 'None'}`);
  lines.push('');

  if (conventions.patterns.length > 0) {
    lines.push('## Patterns');
    lines.push('');
    for (const pattern of conventions.patterns) {
      lines.push(`### ${pattern.name}`);
      lines.push('');
      lines.push(pattern.description);
      lines.push('');
      lines.push('```typescript');
      lines.push(pattern.example);
      lines.push('```');
      lines.push('');
    }
  }

  if (conventions.antiPatterns.length > 0) {
    lines.push('## Anti-Patterns (Avoid)');
    lines.push('');
    for (const anti of conventions.antiPatterns) {
      lines.push(`### ❌ ${anti.name}`);
      lines.push('');
      lines.push(anti.description);
      lines.push('');
      lines.push(`**Instead:** ${anti.alternative}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
