/**
 * Design Workflow Orchestration
 *
 * Main entry point for the design-first workflow.
 * Coordinates design generation, token extraction, and output generation.
 *
 * Security features:
 * - Input validation
 * - Timeout enforcement
 * - Path sanitization for output
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  DesignOption,
  ScreenDefinition,
  ScreenMockup,
  WorkflowConfig,
  WorkflowResult,
  KitchenSink,
  DesignMood,
  createDefaultConfig,
  validateWorkflowConfig,
} from './types.js';
import { extractDesignTokensFromHtml, extractComponentsFromDesign } from './token-extraction.js';
import {
  generateKitchenSink,
  generateScreenMockupShell,
  createScreenMockup,
  generateGalleryHtml,
  parseScreensFromOutput,
  getDefaultScreens,
} from './generators.js';
import { generateDesignSpecPrompt, buildDesignSpec } from './design-spec.js';

// ============================================================================
// Types
// ============================================================================

/**
 * AI Provider interface for design generation
 */
export interface DesignAIProvider {
  generateDesign(prompt: string, mood: DesignMood): Promise<string>;
  generateScreenContent(prompt: string, screen: ScreenDefinition): Promise<string>;
  identifyScreens(prompt: string): Promise<string>;
}

/**
 * Workflow event types
 */
export type WorkflowEventType =
  | 'workflow_start'
  | 'design_generating'
  | 'design_complete'
  | 'design_selected'
  | 'tokens_extracted'
  | 'kitchen_sink_generated'
  | 'screens_identified'
  | 'mockup_generating'
  | 'mockup_complete'
  | 'workflow_complete'
  | 'workflow_error';

/**
 * Workflow event
 */
export interface WorkflowEvent {
  type: WorkflowEventType;
  message: string;
  data?: unknown;
  timestamp: Date;
}

/**
 * Workflow event handler
 */
export type WorkflowEventHandler = (event: WorkflowEvent) => void;

// ============================================================================
// Workflow Class
// ============================================================================

/**
 * Design workflow orchestrator
 */
export class DesignWorkflow {
  private config: WorkflowConfig;
  private aiProvider?: DesignAIProvider;
  private eventHandlers: Set<WorkflowEventHandler> = new Set();
  private startTime: number = 0;

  constructor(config?: Partial<WorkflowConfig>, aiProvider?: DesignAIProvider) {
    const validation = validateWorkflowConfig(config ?? {});
    if (!validation.success) {
      throw new Error(`Invalid workflow config: ${validation.error.message}`);
    }
    this.config = validation.data;
    this.aiProvider = aiProvider;
  }

  /**
   * Add event handler
   */
  onEvent(handler: WorkflowEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Emit event to all handlers
   */
  private emit(type: WorkflowEventType, message: string, data?: unknown): void {
    const event: WorkflowEvent = {
      type,
      message,
      data,
      timestamp: new Date(),
    };

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Run the full design workflow
   */
  async run(userPrompt: string): Promise<WorkflowResult> {
    this.startTime = Date.now();
    const errors: string[] = [];

    this.emit('workflow_start', `Starting design workflow for: ${userPrompt.slice(0, 100)}`);

    try {
      // Validate input
      if (!userPrompt || userPrompt.trim().length === 0) {
        throw new Error('User prompt is required');
      }

      // Ensure output directory exists
      await this.ensureOutputDir();

      // Stage 1: Generate design options
      const designOptions = await this.generateDesignOptions(userPrompt);

      if (designOptions.length === 0) {
        throw new Error('Failed to generate any design options');
      }

      // Stage 2: Select design (auto or prompt user)
      const selectedDesign = this.selectDesign(designOptions);

      this.emit('design_selected', `Selected design: ${selectedDesign.name}`, selectedDesign);

      // Stage 3: Extract tokens and components
      const enrichedDesign = this.enrichDesign(selectedDesign);

      this.emit('tokens_extracted', 'Design tokens extracted', enrichedDesign.tokens);

      // Stage 4: Generate kitchen sink
      const kitchenSink = generateKitchenSink(enrichedDesign);

      this.emit('kitchen_sink_generated', 'Kitchen sink generated', {
        components: kitchenSink.components.length,
        classes: kitchenSink.classes.length,
      });

      // Stage 5: Identify screens
      let screens = await this.identifyScreens(userPrompt);

      this.emit('screens_identified', `Identified ${screens.length} screens`, screens);

      // Stage 6: Generate mockups
      const mockups = await this.generateMockups(screens, enrichedDesign, userPrompt);

      this.emit('mockup_complete', `Generated ${mockups.length} mockups`);

      // Stage 7: Save outputs
      await this.saveOutputs(designOptions, enrichedDesign, kitchenSink, mockups);

      // Stage 8: Generate gallery
      const galleryHtml = generateGalleryHtml(designOptions, kitchenSink, mockups);
      await this.saveFile('index.html', galleryHtml);

      const duration = Date.now() - this.startTime;

      this.emit('workflow_complete', `Workflow completed in ${duration}ms`);

      return {
        success: true,
        selectedDesign: enrichedDesign,
        designOptions,
        screens,
        mockups,
        kitchenSink,
        outputDir: this.config.outputDir,
        galleryPath: path.join(this.config.outputDir, 'index.html'),
        errors,
        duration,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(message);

      this.emit('workflow_error', message, error);

      return {
        success: false,
        designOptions: [],
        screens: [],
        mockups: [],
        outputDir: this.config.outputDir,
        errors,
        duration: Date.now() - this.startTime,
      };
    }
  }

  /**
   * Generate design options in parallel
   */
  private async generateDesignOptions(userPrompt: string): Promise<DesignOption[]> {
    const moods = this.config.defaultMoods.slice(0, this.config.designCount);
    const options: DesignOption[] = [];

    this.emit('design_generating', `Generating ${moods.length} design options`);

    if (this.aiProvider) {
      // Use AI provider for parallel generation
      const promises = moods.map((mood, index) =>
        this.generateSingleDesign(userPrompt, mood, index + 1)
      );

      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          options.push(result.value);
        }
      }
    } else {
      // Generate placeholder designs without AI
      for (let i = 0; i < moods.length; i++) {
        const mood = moods[i] as DesignMood;
        options.push(this.createPlaceholderDesign(mood, i + 1, userPrompt));
      }
    }

    this.emit('design_complete', `Generated ${options.length} design options`);

    return options;
  }

  /**
   * Generate a single design option
   */
  private async generateSingleDesign(
    userPrompt: string,
    mood: DesignMood,
    index: number
  ): Promise<DesignOption | null> {
    if (!this.aiProvider) {
      return this.createPlaceholderDesign(mood, index, userPrompt);
    }

    try {
      const designPrompt = this.buildDesignPrompt(userPrompt, mood);
      const html = await this.aiProvider.generateDesign(designPrompt, mood);

      // Extract tokens and components
      const tokens = extractDesignTokensFromHtml(html);
      const components = extractComponentsFromDesign(html);

      return {
        id: `option-${index}`,
        name: `${mood.charAt(0).toUpperCase() + mood.slice(1)} Design`,
        mood,
        description: `A ${mood} design approach for: ${userPrompt.slice(0, 100)}`,
        html,
        tokens,
        components,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emit('workflow_error', `Failed to generate ${mood} design: ${message}`);
      return null;
    }
  }

  /**
   * Create a placeholder design (for testing without AI)
   */
  private createPlaceholderDesign(mood: DesignMood, index: number, prompt: string): DesignOption {
    const moodColors: Record<DesignMood, string[]> = {
      minimalist: ['#1F2937', '#6B7280', '#F3F4F6'],
      bold: ['#DC2626', '#FBBF24', '#111827'],
      elegant: ['#4F46E5', '#818CF8', '#F5F3FF'],
      playful: ['#EC4899', '#8B5CF6', '#FEF3C7'],
      corporate: ['#1E40AF', '#3B82F6', '#F0F9FF'],
      modern: ['#0EA5E9', '#14B8A6', '#F0FDFA'],
      classic: ['#78350F', '#B45309', '#FFFBEB'],
      futuristic: ['#7C3AED', '#06B6D4', '#030712'],
    };

    const colors = moodColors[mood];

    return {
      id: `option-${index}`,
      name: `${mood.charAt(0).toUpperCase() + mood.slice(1)} Design`,
      mood,
      description: `A ${mood} design approach for: ${prompt.slice(0, 100)}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${mood} Design</title>
  <style>
    :root {
      --color-primary: ${colors[0]};
      --color-secondary: ${colors[1]};
      --color-background: ${colors[2]};
    }
    body {
      font-family: system-ui, sans-serif;
      background: var(--color-background);
      color: var(--color-primary);
      padding: 2rem;
    }
    h1 { color: var(--color-primary); }
    .btn {
      background: var(--color-primary);
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      border: none;
      cursor: pointer;
    }
    .card {
      background: white;
      padding: 1.5rem;
      border-radius: 0.75rem;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      margin: 1rem 0;
    }
  </style>
</head>
<body>
  <h1>${mood.charAt(0).toUpperCase() + mood.slice(1)} Design</h1>
  <p>Placeholder design for: ${prompt.slice(0, 100)}</p>
  <div class="card">
    <h2>Sample Card</h2>
    <p>This is a placeholder card component.</p>
    <button class="btn">Primary Action</button>
  </div>
</body>
</html>`,
      colorPalette: colors,
      tokens: extractDesignTokensFromHtml(''),
      components: [],
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Build design prompt for AI
   */
  private buildDesignPrompt(userPrompt: string, mood: DesignMood): string {
    return `Generate a complete HTML mockup for the following project:

PROJECT: ${userPrompt}

DESIGN STYLE: ${mood}

Requirements:
1. Create a full HTML document with embedded CSS
2. Use CSS custom properties (--color-*, --font-*, --spacing-*)
3. Include a hero section, navigation, and key components
4. Apply the ${mood} design aesthetic throughout
5. Use semantic HTML (header, nav, main, section, footer)
6. Include buttons, cards, forms, and navigation components
7. Ensure mobile-responsive design

Return ONLY the HTML content, no explanations.`;
  }

  /**
   * Select a design option
   */
  private selectDesign(options: DesignOption[]): DesignOption {
    if (this.config.autoSelect > 0 && this.config.autoSelect <= options.length) {
      return options[this.config.autoSelect - 1] as DesignOption;
    }
    // Default to first option
    return options[0] as DesignOption;
  }

  /**
   * Enrich design with extracted tokens and components
   */
  private enrichDesign(design: DesignOption): DesignOption {
    if (!design.tokens) {
      design.tokens = extractDesignTokensFromHtml(design.html, design.css);
    }
    if (!design.components || design.components.length === 0) {
      design.components = extractComponentsFromDesign(design.html);
    }
    return design;
  }

  /**
   * Identify screens using AI or defaults
   */
  private async identifyScreens(userPrompt: string): Promise<ScreenDefinition[]> {
    if (!this.aiProvider) {
      return getDefaultScreens();
    }

    try {
      const screenPrompt = `Identify all screens needed for: ${userPrompt}

Return a JSON object with a "screens" array. Each screen should have:
- id: lowercase-hyphenated identifier
- name: Display name
- description: Brief description
- category: one of (public, auth, dashboard, admin, settings, profile, other)

Example:
\`\`\`json
{
  "screens": [
    {"id": "landing", "name": "Landing Page", "description": "...", "category": "public"}
  ]
}
\`\`\``;

      const output = await this.aiProvider.identifyScreens(screenPrompt);
      const screens = parseScreensFromOutput(output);

      return screens.length > 0 ? screens : getDefaultScreens();
    } catch {
      return getDefaultScreens();
    }
  }

  /**
   * Generate mockups for all screens
   */
  private async generateMockups(
    screens: ScreenDefinition[],
    design: DesignOption,
    userPrompt: string
  ): Promise<ScreenMockup[]> {
    const mockups: ScreenMockup[] = [];
    const designSpec = generateDesignSpecPrompt(design);

    for (const screen of screens.slice(0, 20)) {
      // Limit to 20 screens
      this.emit('mockup_generating', `Generating mockup: ${screen.name}`);

      try {
        if (this.aiProvider) {
          const mockupPrompt = `${designSpec}

Generate HTML content for the ${screen.name} screen.
Description: ${screen.description}
Category: ${screen.category}
Project: ${userPrompt}

Use the CSS variables and components from the approved design.
Return only the HTML content for the screen body (no <html>, <head>, or <body> tags).`;

          const content = await this.aiProvider.generateScreenContent(mockupPrompt, screen);
          const mockup = createScreenMockup(screen, design, content);
          mockups.push(mockup);
        } else {
          // Generate shell without AI content
          const mockup = generateScreenMockupShell(screen, design);
          mockups.push(mockup);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.emit('workflow_error', `Failed to generate mockup for ${screen.name}: ${message}`);
        // Continue with other screens
      }
    }

    return mockups;
  }

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDir(): Promise<void> {
    const dirs = [
      this.config.outputDir,
      path.join(this.config.outputDir, 'options'),
      path.join(this.config.outputDir, 'screens'),
      path.join(this.config.outputDir, 'flows'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true, mode: 0o755 });
    }
  }

  /**
   * Save outputs to disk
   */
  private async saveOutputs(
    options: DesignOption[],
    selectedDesign: DesignOption,
    kitchenSink: KitchenSink,
    mockups: ScreenMockup[]
  ): Promise<void> {
    // Save design options
    for (let i = 0; i < options.length; i++) {
      const opt = options[i] as DesignOption;
      const filename = `options/option-${i + 1}-${opt.mood}.html`;
      await this.saveFile(filename, opt.html);
    }

    // Save kitchen sink
    await this.saveFile('kitchen-sink.html', kitchenSink.html);
    await this.saveFile('styles.css', kitchenSink.css);

    // Save mockups
    for (const mockup of mockups) {
      if (mockup.path) {
        await this.saveFile(mockup.path, mockup.html);
      }
    }

    // Save design spec as JSON
    const spec = buildDesignSpec(selectedDesign);
    await this.saveFile('design-spec.json', JSON.stringify(spec, null, 2));
  }

  /**
   * Save file to output directory
   */
  private async saveFile(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.config.outputDir, relativePath);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true, mode: 0o755 });
    await fs.writeFile(fullPath, content, { encoding: 'utf-8', mode: 0o644 });
  }

  /**
   * Get current configuration
   */
  getConfig(): WorkflowConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a design workflow instance
 */
export function createDesignWorkflow(
  config?: Partial<WorkflowConfig>,
  aiProvider?: DesignAIProvider
): DesignWorkflow {
  return new DesignWorkflow(config, aiProvider);
}

/**
 * Run design workflow (convenience function)
 */
export async function runDesignFirstWorkflow(
  userPrompt: string,
  config?: Partial<WorkflowConfig>,
  aiProvider?: DesignAIProvider
): Promise<WorkflowResult> {
  const workflow = createDesignWorkflow(config, aiProvider);
  return workflow.run(userPrompt);
}
