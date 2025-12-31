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
   */
  protected buildSystemPrompt(context: AgentContext): string {
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
   */
  protected buildUserPrompt(request: AgentRequest): string {
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
   */
  protected async processResult(
    parsed: UIDesignerOutput,
    request: AgentRequest
  ): Promise<{ result: UIDesignerOutput; artifacts: Artifact[] }> {
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
    const hasComponents = result.sharedComponents.length > 0;
    const totalComponents = result.pages.reduce(
      (sum, page) => sum + countComponents(page.components),
      0
    );

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
}
