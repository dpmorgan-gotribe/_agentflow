/**
 * UI Designer Agent
 *
 * Generates HTML mockups based on feature requirements.
 * Produces responsive, accessible designs with structured component hierarchy.
 *
 * Capabilities:
 * - mockup_generation: Generate HTML mockups from requirements
 * - responsive_design: Create responsive layouts for multiple screen sizes
 * - accessibility: Add accessibility attributes to components
 *
 * SECURITY:
 * - Content sanitization for XSS prevention
 * - Path validation for generated files
 * - Tenant isolation via context
 */

import type { AIProviderResponse } from '@aigentflow/ai-provider';
import { BaseAgent } from '../base-agent.js';
import type {
  AgentMetadata,
  AgentContext,
  AgentRequest,
  RoutingHints,
  Artifact,
} from '../types.js';
import { AgentTypeEnum, ContextTypeEnum, ArtifactTypeEnum } from '../types.js';
import type {
  UIDesignerOutput,
  MockupPage,
  UIComponent,
  ColorPalette,
  Typography,
  Spacing,
  MegaPage,
  ComponentShowcase,
  AssetManifest,
} from '../schemas/ui-designer-output.js';
import {
  UIDesignerOutputSchema,
  createDefaultColorPalette,
  createDefaultTypography,
  createDefaultSpacing,
  createDefaultBorderRadius,
  createDefaultShadows,
  countComponents,
} from '../schemas/ui-designer-output.js';
import type { StylePackage, ComponentInventory } from '@aigentflow/langgraph';
import {
  generatePageHTML,
  generateComponentDoc,
  slugify,
} from '../design/index.js';

/**
 * Extended request for UI design
 */
interface UIDesignerRequest extends AgentRequest {
  designRequirements?: {
    targetPlatform?: 'web' | 'mobile' | 'desktop';
    colorScheme?: 'light' | 'dark' | 'auto';
    existingTokens?: Partial<{
      colorPalette: ColorPalette;
      typography: Typography;
      spacing: Spacing;
    }>;
  };
  /**
   * Style package for mega page generation (style competition)
   * When provided, the designer creates a mega page showcasing ALL components
   */
  stylePackage?: StylePackage;
  /**
   * Component inventory from analyst - list of all components to showcase
   */
  componentInventory?: ComponentInventory;
  /**
   * Whether this is a mega page generation request
   */
  isMegaPageRequest?: boolean;
}

/**
 * UI Designer Agent implementation
 */
export class UIDesignerAgent extends BaseAgent {
  constructor() {
    const metadata: AgentMetadata = {
      id: AgentTypeEnum.UI_DESIGNER,
      name: 'UI Designer',
      description: 'Generates HTML mockups from feature requirements',
      version: '1.0.0',
      capabilities: [
        {
          name: 'mockup_generation',
          description: 'Generate HTML mockups from requirements',
          inputTypes: ['requirements', 'user_story', 'feature_spec'],
          outputTypes: ['html', 'component_tree', 'design_spec'],
        },
        {
          name: 'responsive_design',
          description: 'Create responsive layouts for multiple screen sizes',
          inputTypes: ['mockup'],
          outputTypes: ['responsive_mockup'],
        },
        {
          name: 'accessibility',
          description: 'Add accessibility attributes to components',
          inputTypes: ['component'],
          outputTypes: ['accessible_component'],
        },
        {
          name: 'mega_page_generation',
          description: 'Generate a comprehensive component showcase page for style competition',
          inputTypes: ['style_package', 'component_inventory'],
          outputTypes: ['mega_page', 'css', 'component_showcase'],
        },
      ],
      requiredContext: [
        { type: ContextTypeEnum.CURRENT_TASK, required: true },
        { type: ContextTypeEnum.PROJECT_CONFIG, required: false },
        { type: ContextTypeEnum.DESIGN_TOKENS, required: false },
      ],
      outputSchema: 'ui-designer-output',
    };

    super(metadata);
  }

  /**
   * Build system prompt for UI design
   * Overridden to support both regular mockups and mega page generation
   */
  protected buildSystemPrompt(context: AgentContext, request?: AgentRequest): string {
    // Check if we have stylePackage in context for mega page mode
    const stylePackageContext = context.items.find(
      (i) => i.type === 'style_package' as never
    );
    if (stylePackageContext?.content) {
      return this.buildMegaPageSystemPrompt(stylePackageContext.content as StylePackage);
    }

    const designTokens = context.items.find(
      (i) => i.type === ContextTypeEnum.DESIGN_TOKENS
    );
    const projectConfig = context.items.find(
      (i) => i.type === ContextTypeEnum.PROJECT_CONFIG
    )?.content as Record<string, unknown> | undefined;

    let prompt = `You are an expert UI/UX designer and frontend architect.
Your task is to generate HTML mockups based on feature requirements.

## Your Responsibilities:
1. Analyze the feature requirements thoroughly
2. Design a component hierarchy that is reusable and maintainable
3. Create responsive layouts that work on mobile, tablet, and desktop
4. Include proper accessibility attributes (ARIA roles, labels)
5. Use semantic HTML elements
6. Apply consistent styling patterns

## Output Format:
You must output valid JSON matching this schema:
- projectName: Name of the project
- version: "1.0.0"
- generatedAt: ISO timestamp
- pages: Array of page definitions with:
  - id: Unique identifier (alphanumeric, hyphens, underscores only)
  - name: Human-readable name
  - title: Page title
  - description: What the page does
  - path: URL path (must start with /)
  - layout: Layout configuration
  - components: Array of UI components
- sharedComponents: Reusable components across pages
- colorPalette: Color scheme (primary, secondary, accent, background, surface, text, etc.)
- typography: Font settings (fontFamily, baseFontSize, scaleRatio)
- spacing: Spacing scale (unit in px, array of multipliers)
- routingHints: Routing information for orchestrator

## Component Structure:
Each component must have:
- id: Unique identifier (start with letter, use alphanumeric/hyphens only)
- type: One of: page, section, header, footer, navigation, form, input, button, card, list, table, modal, alert, tabs, accordion, image, text, link, icon, container, grid, flex, divider, badge, avatar, tooltip, dropdown, checkbox, radio, select, textarea, slider, switch, progress, spinner, skeleton
- name: Human-readable name
- styles: Object with "base" property containing CSS key-value pairs
- accessibility: ARIA attributes as needed (role, ariaLabel, etc.)
- children: Nested components (if any)

## Design Principles:
1. Mobile-first responsive design
2. Minimum touch target size of 44x44px
3. Sufficient color contrast (WCAG AA - 4.5:1 for text)
4. Clear visual hierarchy
5. Consistent spacing using 4px/8px grid
6. Semantic HTML structure
7. Keyboard navigable
`;

    if (designTokens) {
      prompt += `\n## Existing Design Tokens:\n${JSON.stringify(designTokens.content, null, 2)}\nUse these tokens for consistency.\n`;
    }

    if (projectConfig) {
      const uiConfig = projectConfig['ui'] as Record<string, unknown> | undefined;
      if (uiConfig) {
        prompt += `\n## Project UI Configuration:\n${JSON.stringify(uiConfig, null, 2)}\n`;
      }
    }

    return prompt;
  }

  /**
   * Build user prompt with requirements
   * Overridden to support both regular mockups and mega page generation
   */
  protected buildUserPrompt(request: AgentRequest): string {
    // Check if this is a mega page request
    const uiRequest = request as UIDesignerRequest;
    if (uiRequest.stylePackage && uiRequest.componentInventory) {
      return this.buildMegaPageUserPrompt(
        uiRequest.componentInventory,
        uiRequest.stylePackage
      );
    }

    const task = request.context.task;
    const previousOutputs = request.context.previousOutputs || [];

    let prompt = `## Feature Requirements:\n`;
    prompt += `Task Type: ${task.taskType}\n`;
    prompt += `Complexity: ${task.complexity}\n`;
    prompt += `Requires Backend: ${task.requiresBackend}\n`;
    prompt += `Requires UI: ${task.requiresUI}\n\n`;

    // Include original prompt if available
    const taskContext = request.context.items.find(
      (i) => i.type === ContextTypeEnum.CURRENT_TASK
    );
    if (taskContext && typeof taskContext.content === 'object') {
      prompt += `## Original Request:\n${JSON.stringify(taskContext.content, null, 2)}\n\n`;
    }

    // Include planner output if available
    const plannerOutput = previousOutputs.find(
      (o): o is { agentId: string; result: unknown } =>
        typeof o === 'object' &&
        o !== null &&
        'agentId' in o &&
        (o as { agentId: string }).agentId === AgentTypeEnum.PLANNER
    );
    if (plannerOutput) {
      prompt += `## Implementation Plan:\n${JSON.stringify(plannerOutput.result, null, 2)}\n\n`;
    }

    // Include architect output if available
    const architectOutput = previousOutputs.find(
      (o): o is { agentId: string; result: unknown } =>
        typeof o === 'object' &&
        o !== null &&
        'agentId' in o &&
        (o as { agentId: string }).agentId === AgentTypeEnum.ARCHITECT
    );
    if (architectOutput) {
      prompt += `## Architecture:\n${JSON.stringify(architectOutput.result, null, 2)}\n\n`;
    }

    // Include project manager output if available
    const pmOutput = previousOutputs.find(
      (o): o is { agentId: string; result: unknown } =>
        typeof o === 'object' &&
        o !== null &&
        'agentId' in o &&
        (o as { agentId: string }).agentId === AgentTypeEnum.PROJECT_MANAGER
    );
    if (pmOutput) {
      prompt += `## Work Breakdown:\n${JSON.stringify(pmOutput.result, null, 2)}\n\n`;
    }

    prompt += `\nGenerate a complete UI design with mockups for this feature.
Include at least one page with components.
Output valid JSON only matching the UIDesignerOutput schema.`;

    return prompt;
  }

  /**
   * Parse LLM response into structured output
   */
  protected parseResponse(response: AIProviderResponse): UIDesignerOutput {
    const text = this.extractTextContent(response);
    const parsed = this.parseJSON<UIDesignerOutput>(text);

    // Add defaults if missing
    const withDefaults: UIDesignerOutput = {
      ...parsed,
      colorPalette: parsed.colorPalette || createDefaultColorPalette(),
      typography: parsed.typography || createDefaultTypography(),
      spacing: parsed.spacing || createDefaultSpacing(),
      borderRadius: parsed.borderRadius || createDefaultBorderRadius(),
      shadows: parsed.shadows || createDefaultShadows(),
      generatedAt: parsed.generatedAt || new Date().toISOString(),
      version: parsed.version || '1.0.0',
      pages: parsed.pages || [],
      sharedComponents: parsed.sharedComponents || [],
      routingHints: parsed.routingHints || {
        suggestNext: [AgentTypeEnum.FRONTEND_DEV],
        skipAgents: [],
        needsApproval: true,
        hasFailures: false,
        isComplete: false,
      },
    };

    // Validate against schema
    const result = UIDesignerOutputSchema.safeParse(withDefaults);
    if (!result.success) {
      this.log('warn', 'Output validation failed', {
        errors: result.error.errors,
      });
      throw new Error(`Invalid output format: ${result.error.message}`);
    }

    return result.data;
  }

  /**
   * Process result and generate artifacts
   * Overridden to support both regular mockups and mega page generation
   */
  protected async processResult(
    parsed: UIDesignerOutput,
    request: AgentRequest
  ): Promise<{ result: UIDesignerOutput; artifacts: Artifact[] }> {
    // Check if this is a mega page request
    const uiRequest = request as UIDesignerRequest;
    if (uiRequest.stylePackage || parsed.megaPage) {
      return this.processMegaPageResult(parsed, uiRequest);
    }

    const artifacts: Artifact[] = [];
    const projectId = request.context.projectId || 'default';
    const outputDir = `${projectId}/designs/mockups`;

    // Generate HTML for each page
    for (const page of parsed.pages) {
      const html = generatePageHTML(page, parsed);
      const fileName = `${slugify(page.name)}.html`;
      const filePath = `${outputDir}/${fileName}`;

      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.MOCKUP,
        path: filePath,
        content: html,
        metadata: {
          pageId: page.id,
          pageName: page.name,
          pagePath: page.path,
          componentCount: countComponents(page.components),
          generatedAt: parsed.generatedAt,
        },
      });
    }

    // Generate component library documentation
    if (parsed.sharedComponents.length > 0) {
      const componentDoc = generateComponentDoc(parsed.sharedComponents);
      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.DOCUMENTATION,
        path: `${outputDir}/components.md`,
        content: componentDoc,
        metadata: {
          componentCount: parsed.sharedComponents.length,
        },
      });
    }

    // Generate design spec JSON
    artifacts.push({
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.CONFIG_FILE,
      path: `${outputDir}/design-spec.json`,
      content: JSON.stringify(parsed, null, 2),
      metadata: {
        pageCount: parsed.pages.length,
        sharedComponentCount: parsed.sharedComponents.length,
        totalComponentCount: parsed.pages.reduce(
          (sum, page) => sum + countComponents(page.components),
          0
        ),
      },
    });

    return { result: parsed, artifacts };
  }

  /**
   * Generate routing hints for orchestrator
   */
  protected generateRoutingHints(
    result: UIDesignerOutput,
    artifacts: Artifact[],
    _request: AgentRequest
  ): RoutingHints {
    const hasPages = result.pages.length > 0;
    const hasMegaPage = result.megaPage !== undefined;
    const totalComponents = result.pages.reduce(
      (sum, page) => sum + countComponents(page.components),
      0
    );

    // If this is a mega page generation, route to approval for style selection
    if (hasMegaPage) {
      return {
        suggestNext: [], // Orchestrator will handle style competition
        skipAgents: [],
        needsApproval: true, // Mega pages need approval for style selection
        hasFailures: false,
        isComplete: false,
        notes: `Generated mega page with ${result.megaPage?.componentShowcase.length ?? 0} component showcases`,
      };
    }

    return {
      suggestNext: [AgentTypeEnum.FRONTEND_DEV],
      skipAgents: [],
      needsApproval: true, // Designs should be reviewed
      hasFailures: !hasPages,
      isComplete: false,
      notes: hasPages
        ? `Generated ${result.pages.length} page(s) with ${totalComponents} component(s), ${result.sharedComponents.length} shared`
        : 'No pages generated - design may need revision',
    };
  }

  /**
   * Check if this is a mega page generation request
   */
  private isMegaPageRequest(request: UIDesignerRequest): boolean {
    return !!(request.isMegaPageRequest || request.stylePackage);
  }

  /**
   * Build system prompt for mega page generation
   */
  protected buildMegaPageSystemPrompt(stylePackage: StylePackage): string {
    return `You are an expert UI/UX designer creating a comprehensive component showcase page.

## Your Task
Create a MEGA PAGE that showcases ALL components from a design system using a specific style package.
This page is for a STYLE COMPETITION where users will compare different design styles.

## Style Package: "${stylePackage.name}"
Mood: ${stylePackage.moodDescription}

### Typography
- Heading Font: ${stylePackage.typography.headingFont}
- Body Font: ${stylePackage.typography.bodyFont}
- Weights: ${stylePackage.typography.weights.join(', ')}

### Colors
- Primary: ${stylePackage.colors.primary}
- Secondary: ${stylePackage.colors.secondary}
- Accent: ${stylePackage.colors.accent}
- Background: ${stylePackage.colors.background}
- Text: ${stylePackage.colors.text}

### Visual Style
- Border Radius: ${stylePackage.visual.borderRadius}
- Shadows: ${stylePackage.visual.shadows ? 'Enabled' : 'Minimal'}
- Gradients: ${stylePackage.visual.gradients ? 'Enabled' : 'None'}

### Icon Library
${stylePackage.icons.library} (${stylePackage.icons.style} style)

## Requirements

1. **Component Coverage**: Include EVERY component from the inventory
2. **State Variations**: Show all states (default, hover, active, focus, disabled, loading, error)
3. **Size Variations**: Show different sizes where applicable (sm, md, lg)
4. **Color Variations**: Show primary, secondary, danger, warning, success, info variants
5. **Responsive**: Include responsive breakpoint indicators
6. **Interactive CSS**: Use real CSS for hover/focus states (not placeholders)
7. **CSS Variables**: Output design tokens as CSS custom properties

## Output Format
Output valid JSON with:
- projectName: Style package name
- megaPage: Complete mega page definition with:
  - id: Unique identifier
  - stylePackageId: "${stylePackage.id}"
  - stylePackageName: "${stylePackage.name}"
  - html: Complete HTML content
  - css: CSS with variables and component styles
  - componentShowcase: Array of component entries with variants and states
  - assets: Font and icon manifest

## Design Principles
1. Clean, organized layout with clear sections
2. Component sections grouped by category
3. Labels and descriptions for each component
4. Code snippets or class names visible
5. Real interactive states (CSS :hover, :focus)
6. Dark mode toggle if applicable
`;
  }

  /**
   * Build user prompt for mega page generation
   */
  protected buildMegaPageUserPrompt(
    componentInventory: ComponentInventory,
    stylePackage: StylePackage
  ): string {
    let prompt = `Generate a mega page showcasing the following components using the "${stylePackage.name}" style:\n\n`;

    prompt += `## Component Inventory\n\n`;

    const formatComponents = (components: Array<{ name: string }> | undefined): string => {
      if (!components || components.length === 0) return 'None';
      return components.map(c => c.name).join(', ');
    };

    prompt += `### Navigation Components\n`;
    prompt += formatComponents(componentInventory.navigation);
    prompt += '\n\n';

    prompt += `### Data Display Components\n`;
    prompt += formatComponents(componentInventory.dataDisplay);
    prompt += '\n\n';

    prompt += `### Form Components\n`;
    prompt += formatComponents(componentInventory.forms);
    prompt += '\n\n';

    prompt += `### Feedback Components\n`;
    prompt += formatComponents(componentInventory.feedback);
    prompt += '\n\n';

    prompt += `### Media Components\n`;
    prompt += formatComponents(componentInventory.media);
    prompt += '\n\n';

    if (componentInventory.specialized?.length) {
      prompt += `### Specialized Components\n`;
      for (const spec of componentInventory.specialized) {
        prompt += `- ${spec.name}: ${spec.reason} (complexity: ${spec.complexity})\n`;
      }
      prompt += '\n';
    }

    prompt += `### Required States\n`;
    const states = componentInventory.requiredStates;
    prompt += (states && states.length > 0) ? states.join(', ') : 'default, hover, active, disabled';
    prompt += '\n\n';

    prompt += `Generate a complete mega page with all components styled according to the "${stylePackage.name}" style package.
Include CSS variables for all design tokens and real CSS for interactive states.
Output valid JSON matching the UIDesignerOutput schema with megaPage populated.`;

    return prompt;
  }

  /**
   * Process mega page result and generate artifacts
   */
  protected async processMegaPageResult(
    parsed: UIDesignerOutput,
    request: UIDesignerRequest
  ): Promise<{ result: UIDesignerOutput; artifacts: Artifact[] }> {
    const artifacts: Artifact[] = [];
    const projectId = request.context.projectId || 'default';
    const styleId = request.stylePackage?.id || 'default';
    const outputDir = `${projectId}/designs/mega-pages/${styleId}`;

    if (parsed.megaPage) {
      // Generate HTML file
      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.MOCKUP,
        path: `${outputDir}/mega-page.html`,
        content: this.buildMegaPageHTML(parsed.megaPage),
        metadata: {
          stylePackageId: parsed.megaPage.stylePackageId,
          stylePackageName: parsed.megaPage.stylePackageName,
          componentCount: parsed.megaPage.componentShowcase.length,
          isInteractive: parsed.megaPage.isInteractive,
          generatedAt: parsed.megaPage.generatedAt,
        },
      });

      // Generate CSS file
      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.STYLESHEET,
        path: `${outputDir}/styles.css`,
        content: parsed.megaPage.css,
        metadata: {
          stylePackageId: parsed.megaPage.stylePackageId,
          includesDarkMode: parsed.megaPage.includesDarkMode,
        },
      });

      // Generate component showcase JSON
      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.CONFIG_FILE,
        path: `${outputDir}/component-showcase.json`,
        content: JSON.stringify(parsed.megaPage.componentShowcase, null, 2),
        metadata: {
          componentCount: parsed.megaPage.componentShowcase.length,
        },
      });

      // Generate asset manifest
      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.CONFIG_FILE,
        path: `${outputDir}/assets.json`,
        content: JSON.stringify(parsed.megaPage.assets, null, 2),
        metadata: {
          fontCount: parsed.megaPage.assets.fonts.length,
          hasIcons: !!parsed.megaPage.assets.icons,
        },
      });
    }

    return { result: parsed, artifacts };
  }

  /**
   * Build complete mega page HTML with embedded CSS and components
   */
  private buildMegaPageHTML(megaPage: MegaPage): string {
    // Escape HTML for safety
    const escapeHtml = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(megaPage.stylePackageName)} - Component Showcase</title>
  <style>
${megaPage.css}
  </style>
  ${this.buildFontLinks(megaPage.assets)}
</head>
<body>
  <header class="mega-page-header">
    <h1>${escapeHtml(megaPage.stylePackageName)}</h1>
    <p class="style-id">Style ID: ${escapeHtml(megaPage.stylePackageId)}</p>
    ${megaPage.includesDarkMode ? '<button id="theme-toggle">Toggle Dark Mode</button>' : ''}
  </header>
  <main class="mega-page-content">
${megaPage.html}
  </main>
  <footer class="mega-page-footer">
    <p>Generated: ${megaPage.generatedAt}</p>
  </footer>
  ${megaPage.includesDarkMode ? this.buildDarkModeScript() : ''}
</body>
</html>`;
  }

  /**
   * Build font link tags from asset manifest
   */
  private buildFontLinks(assets: AssetManifest): string {
    const googleFonts = assets.fonts.filter(f => f.source === 'google');
    if (googleFonts.length === 0) return '';

    const fontParams = googleFonts.map(f => {
      const weights = f.weights.join(';');
      return `family=${encodeURIComponent(f.family)}:wght@${weights}`;
    }).join('&');

    return `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?${fontParams}&display=swap" rel="stylesheet">`;
  }

  /**
   * Build dark mode toggle script
   */
  private buildDarkModeScript(): string {
    return `<script>
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
    });
  </script>`;
  }
}
