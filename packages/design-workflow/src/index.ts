/**
 * @aigentflow/design-workflow
 *
 * Design-first workflow for generating UI designs from user prompts.
 *
 * Features:
 * - Generate 3 design options in parallel (Minimalist, Bold, Elegant)
 * - Extract design tokens from approved design
 * - Generate kitchen sink / component library
 * - Generate screen mockups with consistent styling
 * - Maintain design consistency across all outputs
 *
 * Security:
 * - Zod validation for all schemas
 * - HTML escaping for user content
 * - Path sanitization for output files
 * - Content length limits
 *
 * @packageDocumentation
 */

// Version
export const DESIGN_WORKFLOW_VERSION = '1.0.0';

// ============================================================================
// Type Exports
// ============================================================================

export {
  // Constants
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_HTML_LENGTH,
  MAX_CSS_LENGTH,
  MAX_SCREENS,
  MAX_COMPONENTS,
  MAX_COLORS,
  // Design Mood
  DesignMoodSchema,
  type DesignMood,
  // Color
  ColorValueSchema,
  DesignColorsSchema,
  type DesignColors,
  // Typography
  DesignTypographySchema,
  type DesignTypography,
  // Spacing
  DesignSpacingSchema,
  type DesignSpacing,
  // Tokens
  ExtractedTokensSchema,
  type ExtractedTokens,
  // Component
  DesignComponentSchema,
  type DesignComponent,
  // Design Option
  DesignOptionSchema,
  type DesignOption,
  // Screen
  ScreenCategorySchema,
  type ScreenCategory,
  ScreenDefinitionSchema,
  type ScreenDefinition,
  ScreenMockupSchema,
  type ScreenMockup,
  // Kitchen Sink
  KitchenSinkSchema,
  type KitchenSink,
  // Design Spec
  DesignSpecSchema,
  type DesignSpec,
  // Workflow Config
  WorkflowConfigSchema,
  type WorkflowConfig,
  // Workflow Result
  WorkflowResultSchema,
  type WorkflowResult,
  // Validation helpers
  validateDesignOption,
  validateWorkflowConfig,
  createDefaultConfig,
} from './types.js';

// ============================================================================
// Token Extraction Exports
// ============================================================================

export {
  // Color extraction
  extractColors,
  categorizeColors,
  // Typography extraction
  extractTypography,
  // Spacing extraction
  extractSpacing,
  // Main extraction
  extractDesignTokensFromHtml,
  // Component extraction
  extractComponentsFromDesign,
  // CSS class extraction
  extractCssClasses,
  listKitchenSinkClasses,
} from './token-extraction.js';

// ============================================================================
// Design Spec Exports
// ============================================================================

export {
  // CSS generation
  generateCssVariables,
  // Instructions generation
  generateColorInstructions,
  generateTypographyInstructions,
  generateSpacingInstructions,
  // Component snippets
  extractComponentSnippets,
  // Main builder
  buildDesignSpec,
  // Prompt generation
  generateDesignSpecPrompt,
  // Class utilities
  getKitchenSinkClasses,
  generateClassDocumentation,
} from './design-spec.js';

// ============================================================================
// Generator Exports
// ============================================================================

export {
  // Kitchen sink
  generateKitchenSink,
  // Screen mockups
  generateScreenMockupShell,
  createScreenMockup,
  // Gallery
  generateGalleryHtml,
  // Screen parsing
  parseScreensFromOutput,
  getDefaultScreens,
} from './generators.js';

// ============================================================================
// Workflow Exports
// ============================================================================

export {
  // AI Provider interface
  type DesignAIProvider,
  // Events
  type WorkflowEventType,
  type WorkflowEvent,
  type WorkflowEventHandler,
  // Workflow class
  DesignWorkflow,
  // Factory functions
  createDesignWorkflow,
  runDesignFirstWorkflow,
} from './workflow.js';
