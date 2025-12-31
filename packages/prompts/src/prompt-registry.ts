/**
 * Prompt Registry
 *
 * Manages prompt templates for different agents and versions.
 * Includes path traversal prevention for security.
 */

import { PromptRegistryError } from './errors.js';
import type { AgentType, PromptTemplate } from './types.js';
import { promptTemplateSchema } from './types.js';

/**
 * Template key format: id@version
 */
type TemplateKey = `${string}@${string}`;

/**
 * Prompt Registry class for managing prompt templates
 */
export class PromptRegistry {
  private templates: Map<TemplateKey, PromptTemplate> = new Map();
  private agentTemplates: Map<AgentType | 'universal', TemplateKey> = new Map();

  /**
   * Register a template with validation
   */
  register(template: PromptTemplate): void {
    // Validate template structure
    const result = promptTemplateSchema.safeParse(template);
    if (!result.success) {
      throw new PromptRegistryError(
        `Invalid template structure: ${result.error.message}`,
        { templateId: template.id, errors: result.error.errors }
      );
    }

    // Validate ID format (prevent path traversal)
    if (!this.isValidTemplateId(template.id)) {
      throw new PromptRegistryError('Template ID contains invalid characters', {
        templateId: template.id,
      });
    }

    const key: TemplateKey = `${template.id}@${template.version}`;

    // Check for duplicate
    if (this.templates.has(key)) {
      throw new PromptRegistryError(`Template already registered: ${key}`, {
        templateKey: key,
      });
    }

    this.templates.set(key, result.data);

    // Set as default for agent type if not already set
    if (
      template.agentType !== 'universal' &&
      !this.agentTemplates.has(template.agentType)
    ) {
      this.agentTemplates.set(template.agentType, key);
    }
  }

  /**
   * Validate template ID (prevent path traversal attacks)
   */
  private isValidTemplateId(id: string): boolean {
    // Only allow alphanumeric, hyphens, and underscores
    const validPattern = /^[a-zA-Z][a-zA-Z0-9_-]{0,99}$/;
    if (!validPattern.test(id)) {
      return false;
    }

    // Block path traversal attempts
    const dangerous = ['..', '/', '\\', '\0', '%2e', '%2f', '%5c'];
    const lowerCaseId = id.toLowerCase();
    for (const pattern of dangerous) {
      if (lowerCaseId.includes(pattern)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get template for agent type
   */
  getTemplate(agentType: AgentType): PromptTemplate | undefined {
    const templateKey = this.agentTemplates.get(agentType);
    if (templateKey) {
      return this.templates.get(templateKey);
    }
    return undefined;
  }

  /**
   * Get universal template if available
   */
  getUniversalTemplate(): PromptTemplate | undefined {
    const templateKey = this.agentTemplates.get('universal');
    if (templateKey) {
      return this.templates.get(templateKey);
    }
    return undefined;
  }

  /**
   * Get template by ID and optional version
   */
  getTemplateById(id: string, version?: string): PromptTemplate | undefined {
    if (!this.isValidTemplateId(id)) {
      return undefined;
    }

    if (version) {
      const key: TemplateKey = `${id}@${version}`;
      return this.templates.get(key);
    }

    // Find latest version
    const matching = Array.from(this.templates.entries())
      .filter(([key]) => key.startsWith(`${id}@`))
      .sort((a, b) => this.compareVersions(b[0], a[0]));

    return matching[0]?.[1];
  }

  /**
   * Compare two template keys by version
   */
  private compareVersions(keyA: string, keyB: string): number {
    const versionA = keyA.split('@')[1] ?? '0.0.0';
    const versionB = keyB.split('@')[1] ?? '0.0.0';

    const partsA = versionA.split('.').map(Number);
    const partsB = versionB.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const a = partsA[i] ?? 0;
      const b = partsB[i] ?? 0;
      if (a !== b) {
        return a - b;
      }
    }
    return 0;
  }

  /**
   * Set default template for agent type
   */
  setAgentTemplate(
    agentType: AgentType,
    templateId: string,
    version: string
  ): void {
    if (!this.isValidTemplateId(templateId)) {
      throw new PromptRegistryError('Template ID contains invalid characters', {
        templateId,
      });
    }

    const key: TemplateKey = `${templateId}@${version}`;
    if (!this.templates.has(key)) {
      throw new PromptRegistryError(`Template not found: ${key}`, {
        templateKey: key,
      });
    }
    this.agentTemplates.set(agentType, key);
  }

  /**
   * Remove template from registry
   */
  unregister(id: string, version: string): boolean {
    if (!this.isValidTemplateId(id)) {
      return false;
    }

    const key: TemplateKey = `${id}@${version}`;
    const template = this.templates.get(key);

    if (!template) {
      return false;
    }

    this.templates.delete(key);

    // Remove from agent templates if this was the default
    for (const [agentType, templateKey] of this.agentTemplates) {
      if (templateKey === key) {
        this.agentTemplates.delete(agentType);
      }
    }

    return true;
  }

  /**
   * List all registered templates
   */
  listTemplates(): Array<{ id: string; version: string; agentType: string }> {
    return Array.from(this.templates.values()).map((t) => ({
      id: t.id,
      version: t.version,
      agentType: t.agentType,
    }));
  }

  /**
   * Get count of registered templates
   */
  count(): number {
    return this.templates.size;
  }

  /**
   * Check if a template exists
   */
  has(id: string, version?: string): boolean {
    if (!this.isValidTemplateId(id)) {
      return false;
    }

    if (version) {
      const key: TemplateKey = `${id}@${version}`;
      return this.templates.has(key);
    }

    // Check if any version exists
    for (const key of this.templates.keys()) {
      if (key.startsWith(`${id}@`)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Clear all templates
   */
  clear(): void {
    this.templates.clear();
    this.agentTemplates.clear();
  }

  /**
   * Export all templates as JSON-serializable array
   */
  export(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Import templates from array
   */
  import(templates: PromptTemplate[]): { imported: number; failed: number } {
    let imported = 0;
    let failed = 0;

    for (const template of templates) {
      try {
        this.register(template);
        imported++;
      } catch {
        failed++;
      }
    }

    return { imported, failed };
  }
}
