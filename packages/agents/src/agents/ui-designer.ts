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
  FullDesignOutput,
  ScreenMockup,
  UserFlowDiagram,
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
 * Screen definition from analyst for full design mode
 */
interface ScreenDefinition {
  id: string;
  name: string;
  category?: string;
  description: string;
  userFlowIds: string[];
  componentsNeeded: string[];
  statesNeeded?: string[];
  responsiveRequired?: boolean;
}

/**
 * User flow definition from analyst
 */
interface UserFlowDefinition {
  id: string;
  name: string;
  description: string;
  userGoal: string;
  actor: string;
  steps: Array<{
    screenId: string;
    action: string;
    nextScreenId?: string;
    alternativePaths?: Array<{ condition: string; screenId: string }>;
  }>;
}

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
  /**
   * Full design mode: create ALL screens with approved style
   * Sprint 5 addition
   */
  isFullDesignRequest?: boolean;
  /**
   * Approved style package from style competition
   */
  approvedStylePackage?: StylePackage;
  /**
   * All screens to design (from analyst)
   */
  screens?: ScreenDefinition[];
  /**
   * User flows for navigation mapping (from analyst)
   */
  userFlows?: UserFlowDefinition[];
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
        {
          name: 'full_design_generation',
          description: 'Generate all screen mockups with approved style after style competition',
          inputTypes: ['approved_style', 'screens', 'user_flows', 'component_inventory'],
          outputTypes: ['screen_mockups', 'user_flow_diagrams', 'global_css', 'handoff_notes'],
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
   * Overridden to support regular mockups, mega page, and full design generation
   */
  protected buildSystemPrompt(context: AgentContext, request?: AgentRequest): string {
    const uiRequest = request as UIDesignerRequest | undefined;

    // Check for full design mode (Sprint 5)
    if (uiRequest?.isFullDesignRequest && uiRequest.approvedStylePackage) {
      return this.buildFullDesignSystemPrompt(uiRequest.approvedStylePackage);
    }

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
   * Overridden to support regular mockups, mega page, and full design generation
   */
  protected buildUserPrompt(request: AgentRequest): string {
    const uiRequest = request as UIDesignerRequest;

    // Check for full design mode (Sprint 5)
    if (uiRequest.isFullDesignRequest && uiRequest.approvedStylePackage && uiRequest.screens) {
      return this.buildFullDesignUserPrompt(
        uiRequest.screens,
        uiRequest.userFlows || [],
        uiRequest.approvedStylePackage,
        uiRequest.componentInventory
      );
    }

    // Check if this is a mega page request
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
   * Overridden to support regular mockups, mega page, and full design generation
   */
  protected async processResult(
    parsed: UIDesignerOutput,
    request: AgentRequest
  ): Promise<{ result: UIDesignerOutput; artifacts: Artifact[] }> {
    const uiRequest = request as UIDesignerRequest;

    // Check for full design mode (Sprint 5)
    if (uiRequest.isFullDesignRequest || parsed.fullDesign) {
      return this.processFullDesignResult(parsed, uiRequest);
    }

    // Check if this is a mega page request
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
    const hasFullDesign = result.fullDesign !== undefined;
    const totalComponents = result.pages.reduce(
      (sum, page) => sum + countComponents(page.components),
      0
    );

    // If this is a full design generation, route to PM for task references
    if (hasFullDesign) {
      const screenCount = result.fullDesign?.screens.length ?? 0;
      const flowCount = result.fullDesign?.userFlows.length ?? 0;
      return {
        suggestNext: [AgentTypeEnum.PROJECT_MANAGER], // PM will reference designs in tasks
        skipAgents: [],
        needsApproval: true, // Full designs need review before handoff to PM
        hasFailures: screenCount === 0,
        isComplete: false,
        notes: `Generated full design with ${screenCount} screen(s) and ${flowCount} user flow(s)`,
      };
    }

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

  // ============================================================================
  // Full Design Mode Methods (Sprint 5)
  // ============================================================================

  /**
   * Build system prompt for full design mode
   * Generates ALL screens with the approved style after style competition
   */
  protected buildFullDesignSystemPrompt(approvedStyle: StylePackage): string {
    return `You are an expert UI/UX designer creating a complete set of screen mockups.

## Your Task
Create ALL screen mockups for the application using the APPROVED style package.
This is the FULL DESIGN PHASE after the style has been selected from the competition.

## Approved Style Package: "${approvedStyle.name}"
Mood: ${approvedStyle.moodDescription}

### Typography
- Heading Font: ${approvedStyle.typography.headingFont}
- Body Font: ${approvedStyle.typography.bodyFont}
- Weights: ${approvedStyle.typography.weights.join(', ')}

### Colors
- Primary: ${approvedStyle.colors.primary}
- Secondary: ${approvedStyle.colors.secondary}
- Accent: ${approvedStyle.colors.accent}
- Background: ${approvedStyle.colors.background}
- Text: ${approvedStyle.colors.text}
${approvedStyle.colors.palette ? `- Full Palette: ${JSON.stringify(approvedStyle.colors.palette)}` : ''}

### Visual Style
- Border Radius: ${approvedStyle.visual.borderRadius}
- Shadows: ${approvedStyle.visual.shadows ? 'Enabled' : 'Minimal'}
- Gradients: ${approvedStyle.visual.gradients ? 'Enabled' : 'None'}
${approvedStyle.visual.animations ? `- Animations: ${approvedStyle.visual.animations}` : ''}

### Icon Library
${approvedStyle.icons.library} (${approvedStyle.icons.style} style)

### CSS Framework
${approvedStyle.css.framework}${approvedStyle.css.darkMode ? ' with Dark Mode' : ''}

## Requirements

1. **Screen Coverage**: Generate a mockup for EVERY screen in the screen list
2. **State Variations**: Include all screen states (loading, empty, error, success)
3. **Responsive Variants**: Create mobile, tablet, desktop layouts for each screen
4. **Navigation**: Ensure screens link correctly according to user flows
5. **Consistency**: Use the same design tokens across all screens
6. **Accessibility**: Include ARIA labels and semantic HTML
7. **Interactive CSS**: Real CSS for hover/focus states

## Output Format
Output valid JSON with:
- fullDesign: Complete full design output with:
  - stylePackageId: "${approvedStyle.id}"
  - stylePackageName: "${approvedStyle.name}"
  - screens: Array of ScreenMockup objects with states and responsive variants
  - userFlows: Array of UserFlowDiagram objects with Mermaid diagrams
  - globalCss: Shared CSS with design tokens as CSS variables
  - sharedComponents: Reusable component HTML snippets
  - handoffNotes: Implementation notes for developers

## Screen Mockup Structure
Each screen must have:
- id: Unique identifier matching the screen list
- name: Human-readable name
- category: Screen category (auth, dashboard, settings, etc.)
- description: What the screen does
- path: URL path
- html: Complete HTML content
- css: Screen-specific CSS (if any)
- states: Array of state variations (loading, empty, error, success)
- responsiveVariants: Array with mobile, tablet, desktop HTML
- componentsUsed: List of component IDs used
- connectedScreens: IDs of screens linked from this one
- userFlows: IDs of user flows this screen participates in

## User Flow Diagram Structure
Each user flow must have:
- id: Unique identifier
- name: Flow name (e.g., "User Login")
- description: What the flow accomplishes
- userGoal: The user's objective
- steps: Array of flow steps with screenIds and actions
- mermaidDiagram: Mermaid flowchart syntax for visualization

## Design Principles
1. Mobile-first responsive design
2. Consistent spacing using the design system
3. Clear visual hierarchy
4. Accessible color contrast
5. Intuitive navigation patterns
6. Loading and error state handling
7. Empty state with helpful guidance
`;
  }

  /**
   * Build user prompt for full design mode
   */
  protected buildFullDesignUserPrompt(
    screens: ScreenDefinition[],
    userFlows: UserFlowDefinition[],
    approvedStyle: StylePackage,
    componentInventory?: ComponentInventory
  ): string {
    let prompt = `Generate complete mockups for ALL screens using the "${approvedStyle.name}" style.\n\n`;

    prompt += `## Screens to Design (${screens.length} total)\n\n`;

    for (const screen of screens) {
      prompt += `### ${screen.name} (id: ${screen.id})\n`;
      prompt += `- Category: ${screen.category || 'general'}\n`;
      prompt += `- Description: ${screen.description}\n`;
      prompt += `- Components: ${screen.componentsNeeded.join(', ')}\n`;
      if (screen.statesNeeded && screen.statesNeeded.length > 0) {
        prompt += `- States needed: ${screen.statesNeeded.join(', ')}\n`;
      }
      if (screen.userFlowIds.length > 0) {
        prompt += `- Part of flows: ${screen.userFlowIds.join(', ')}\n`;
      }
      prompt += '\n';
    }

    if (userFlows.length > 0) {
      prompt += `## User Flows (${userFlows.length} total)\n\n`;

      for (const flow of userFlows) {
        prompt += `### ${flow.name} (id: ${flow.id})\n`;
        prompt += `- Goal: ${flow.userGoal}\n`;
        prompt += `- Actor: ${flow.actor}\n`;
        prompt += `- Steps:\n`;
        flow.steps.forEach((step, i) => {
          prompt += `  ${i + 1}. Screen "${step.screenId}": ${step.action}`;
          if (step.nextScreenId) {
            prompt += ` → ${step.nextScreenId}`;
          }
          prompt += '\n';
          if (step.alternativePaths && step.alternativePaths.length > 0) {
            for (const alt of step.alternativePaths) {
              prompt += `     - If ${alt.condition}: → ${alt.screenId}\n`;
            }
          }
        });
        prompt += '\n';
      }
    }

    if (componentInventory) {
      prompt += `## Available Components\n`;
      const allComponents = [
        ...(componentInventory.navigation?.map(c => c.name) || []),
        ...(componentInventory.dataDisplay?.map(c => c.name) || []),
        ...(componentInventory.forms?.map(c => c.name) || []),
        ...(componentInventory.feedback?.map(c => c.name) || []),
        ...(componentInventory.media?.map(c => c.name) || []),
      ];
      prompt += allComponents.join(', ') + '\n\n';
    }

    prompt += `Generate complete HTML mockups for each screen with:
1. All required states (loading, empty, error, success as applicable)
2. Responsive variants for mobile (< 768px), tablet (768-1024px), desktop (> 1024px)
3. Mermaid diagrams for each user flow
4. Global CSS with design tokens as CSS variables
5. Shared component snippets that are reused

Output valid JSON matching the UIDesignerOutput schema with fullDesign populated.`;

    return prompt;
  }

  /**
   * Process full design result and generate artifacts
   */
  protected async processFullDesignResult(
    parsed: UIDesignerOutput,
    request: UIDesignerRequest
  ): Promise<{ result: UIDesignerOutput; artifacts: Artifact[] }> {
    const artifacts: Artifact[] = [];
    const projectId = request.context.projectId || 'default';
    const styleId = request.approvedStylePackage?.id || 'approved';
    const outputDir = `${projectId}/designs/full-design/${styleId}`;

    const fullDesign = parsed.fullDesign;
    if (!fullDesign) {
      return { result: parsed, artifacts };
    }

    // Escape HTML helper
    const escapeHtml = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    // Generate global CSS file
    artifacts.push({
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.STYLESHEET,
      path: `${outputDir}/global.css`,
      content: fullDesign.globalCss,
      metadata: {
        stylePackageId: fullDesign.stylePackageId,
        generatedAt: fullDesign.generatedAt,
      },
    });

    // Generate HTML for each screen
    for (const screen of fullDesign.screens) {
      const screenDir = `${outputDir}/screens/${screen.id}`;

      // Main screen HTML
      const screenHtml = this.buildScreenHTML(screen, fullDesign);
      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.MOCKUP,
        path: `${screenDir}/${slugify(screen.name)}.html`,
        content: screenHtml,
        metadata: {
          screenId: screen.id,
          screenName: screen.name,
          category: screen.category,
          stateCount: screen.states.length,
          responsiveVariantCount: screen.responsiveVariants.length,
          componentsUsed: screen.componentsUsed,
          connectedScreens: screen.connectedScreens,
        },
      });

      // State variant HTML files
      for (const state of screen.states) {
        artifacts.push({
          id: this.generateArtifactId(),
          type: ArtifactTypeEnum.MOCKUP,
          path: `${screenDir}/states/${state.name}.html`,
          content: this.buildStateHTML(state, screen, fullDesign),
          metadata: {
            screenId: screen.id,
            stateName: state.name,
            conditions: state.conditions,
          },
        });
      }

      // Responsive variant HTML files
      for (const variant of screen.responsiveVariants) {
        artifacts.push({
          id: this.generateArtifactId(),
          type: ArtifactTypeEnum.MOCKUP,
          path: `${screenDir}/responsive/${variant.breakpoint}.html`,
          content: this.buildResponsiveHTML(variant, screen, fullDesign),
          metadata: {
            screenId: screen.id,
            breakpoint: variant.breakpoint,
            minWidth: variant.minWidth,
          },
        });
      }
    }

    // Generate user flow diagrams
    for (const flow of fullDesign.userFlows) {
      // Mermaid diagram file
      if (flow.mermaidDiagram) {
        artifacts.push({
          id: this.generateArtifactId(),
          type: ArtifactTypeEnum.DOCUMENTATION,
          path: `${outputDir}/flows/${flow.id}.md`,
          content: this.buildFlowMarkdown(flow),
          metadata: {
            flowId: flow.id,
            flowName: flow.name,
            stepCount: flow.steps.length,
          },
        });
      }

      // Flow JSON for programmatic access
      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.CONFIG_FILE,
        path: `${outputDir}/flows/${flow.id}.json`,
        content: JSON.stringify(flow, null, 2),
        metadata: {
          flowId: flow.id,
          flowName: flow.name,
        },
      });
    }

    // Generate shared components documentation
    if (fullDesign.sharedComponents.length > 0) {
      let componentDoc = `# Shared Components\n\n`;
      for (const comp of fullDesign.sharedComponents) {
        componentDoc += `## ${comp.name}\n\n`;
        componentDoc += `ID: \`${comp.id}\`\n\n`;
        if (comp.usage) {
          componentDoc += `Usage: ${comp.usage}\n\n`;
        }
        componentDoc += `\`\`\`html\n${comp.html}\n\`\`\`\n\n`;
      }
      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.DOCUMENTATION,
        path: `${outputDir}/shared-components.md`,
        content: componentDoc,
        metadata: {
          componentCount: fullDesign.sharedComponents.length,
        },
      });
    }

    // Generate handoff notes
    if (fullDesign.handoffNotes.length > 0) {
      let handoffDoc = `# Design Handoff Notes\n\n`;
      handoffDoc += `Style Package: ${fullDesign.stylePackageName}\n`;
      handoffDoc += `Generated: ${fullDesign.generatedAt}\n\n`;
      handoffDoc += `## Implementation Notes\n\n`;
      for (const note of fullDesign.handoffNotes) {
        handoffDoc += `- ${note}\n`;
      }
      artifacts.push({
        id: this.generateArtifactId(),
        type: ArtifactTypeEnum.DOCUMENTATION,
        path: `${outputDir}/handoff-notes.md`,
        content: handoffDoc,
        metadata: {
          noteCount: fullDesign.handoffNotes.length,
        },
      });
    }

    // Generate design spec JSON
    artifacts.push({
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.CONFIG_FILE,
      path: `${outputDir}/design-spec.json`,
      content: JSON.stringify(fullDesign, null, 2),
      metadata: {
        screenCount: fullDesign.screens.length,
        flowCount: fullDesign.userFlows.length,
        sharedComponentCount: fullDesign.sharedComponents.length,
        stylePackageId: fullDesign.stylePackageId,
      },
    });

    return { result: parsed, artifacts };
  }

  /**
   * Build complete HTML for a screen mockup
   */
  private buildScreenHTML(screen: ScreenMockup, fullDesign: FullDesignOutput): string {
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
  <title>${escapeHtml(screen.name)} - ${escapeHtml(fullDesign.stylePackageName)}</title>
  <style>
${fullDesign.globalCss}
${screen.css || ''}
  </style>
</head>
<body>
  <div class="screen-mockup" data-screen-id="${escapeHtml(screen.id)}" data-category="${escapeHtml(screen.category || '')}">
${screen.html}
  </div>
  <footer class="mockup-meta">
    <p>Screen: ${escapeHtml(screen.name)} | Path: ${escapeHtml(screen.path)}</p>
    <p>Components: ${screen.componentsUsed.map(c => escapeHtml(c)).join(', ')}</p>
  </footer>
</body>
</html>`;
  }

  /**
   * Build HTML for a screen state variant
   */
  private buildStateHTML(
    state: { name: string; description: string; html: string; conditions?: string },
    screen: ScreenMockup,
    fullDesign: FullDesignOutput
  ): string {
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
  <title>${escapeHtml(screen.name)} (${escapeHtml(state.name)}) - ${escapeHtml(fullDesign.stylePackageName)}</title>
  <style>
${fullDesign.globalCss}
${screen.css || ''}
  </style>
</head>
<body>
  <div class="screen-mockup state-${escapeHtml(state.name)}" data-screen-id="${escapeHtml(screen.id)}" data-state="${escapeHtml(state.name)}">
    <header class="state-indicator">
      <span class="state-badge">${escapeHtml(state.name)}</span>
      <span class="state-desc">${escapeHtml(state.description)}</span>
    </header>
${state.html}
  </div>
  <footer class="mockup-meta">
    <p>Screen: ${escapeHtml(screen.name)} | State: ${escapeHtml(state.name)}</p>
    ${state.conditions ? `<p>Conditions: ${escapeHtml(state.conditions)}</p>` : ''}
  </footer>
</body>
</html>`;
  }

  /**
   * Build HTML for a responsive variant
   */
  private buildResponsiveHTML(
    variant: { breakpoint: string; minWidth?: number; html: string; layoutChanges?: string },
    screen: ScreenMockup,
    fullDesign: FullDesignOutput
  ): string {
    const escapeHtml = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const viewportWidth = variant.minWidth || (variant.breakpoint === 'mobile' ? 375 : variant.breakpoint === 'tablet' ? 768 : 1280);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${viewportWidth}, initial-scale=1.0">
  <title>${escapeHtml(screen.name)} (${escapeHtml(variant.breakpoint)}) - ${escapeHtml(fullDesign.stylePackageName)}</title>
  <style>
${fullDesign.globalCss}
${screen.css || ''}
  </style>
</head>
<body class="responsive-preview responsive-${escapeHtml(variant.breakpoint)}" style="max-width: ${viewportWidth}px;">
  <header class="responsive-indicator">
    <span class="breakpoint-badge">${escapeHtml(variant.breakpoint)}</span>
    <span class="viewport-width">${viewportWidth}px</span>
  </header>
  <div class="screen-mockup" data-screen-id="${escapeHtml(screen.id)}" data-breakpoint="${escapeHtml(variant.breakpoint)}">
${variant.html}
  </div>
  <footer class="mockup-meta">
    <p>Screen: ${escapeHtml(screen.name)} | Breakpoint: ${escapeHtml(variant.breakpoint)}</p>
    ${variant.layoutChanges ? `<p>Layout changes: ${escapeHtml(variant.layoutChanges)}</p>` : ''}
  </footer>
</body>
</html>`;
  }

  /**
   * Build markdown documentation for a user flow with Mermaid diagram
   */
  private buildFlowMarkdown(flow: UserFlowDiagram): string {
    let md = `# ${flow.name}\n\n`;
    md += `${flow.description}\n\n`;
    md += `**User Goal:** ${flow.userGoal}\n\n`;
    md += `**Actor:** ${flow.actor}\n\n`;

    md += `## Flow Diagram\n\n`;
    md += `\`\`\`mermaid\n${flow.mermaidDiagram || this.generateMermaidFromSteps(flow)}\n\`\`\`\n\n`;

    md += `## Steps\n\n`;
    for (const step of flow.steps) {
      md += `### ${step.id}: ${step.label}\n`;
      md += `- **Type:** ${step.type}\n`;
      md += `- **Screen:** ${step.screenId}\n`;
      if (step.action) {
        md += `- **Action:** ${step.action}\n`;
      }
      if (step.nextSteps.length > 0) {
        md += `- **Next Steps:**\n`;
        for (const next of step.nextSteps) {
          md += `  - ${next.stepId}${next.condition ? ` (if ${next.condition})` : ''}\n`;
        }
      }
      md += '\n';
    }

    return md;
  }

  /**
   * Generate Mermaid flowchart from flow steps (fallback if not provided)
   */
  private generateMermaidFromSteps(flow: UserFlowDiagram): string {
    const lines: string[] = ['flowchart TD'];

    for (const step of flow.steps) {
      // Define node shape based on type
      let nodeShape: string;
      switch (step.type) {
        case 'start':
          nodeShape = `${step.id}([${step.label}])`;
          break;
        case 'end':
          nodeShape = `${step.id}([${step.label}])`;
          break;
        case 'decision':
          nodeShape = `${step.id}{${step.label}}`;
          break;
        case 'action':
          nodeShape = `${step.id}[/${step.label}/]`;
          break;
        default:
          nodeShape = `${step.id}[${step.label}]`;
      }
      lines.push(`    ${nodeShape}`);
    }

    // Add edges
    for (const step of flow.steps) {
      for (const next of step.nextSteps) {
        const label = next.condition ? `|${next.condition}|` : '';
        lines.push(`    ${step.id} -->${label} ${next.stepId}`);
      }
    }

    return lines.join('\n');
  }
}
