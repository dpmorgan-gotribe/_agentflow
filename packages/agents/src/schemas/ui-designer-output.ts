/**
 * UI Designer Output Schema
 *
 * Defines schemas for UI mockup generation including:
 * - Component hierarchy with accessibility
 * - Responsive styles across breakpoints
 * - Page layouts with regions
 * - Design tokens (colors, typography, spacing)
 *
 * SECURITY:
 * - Path validation for file outputs
 * - Content sanitization for XSS prevention
 * - String length limits
 */

import { z } from 'zod';
import { AgentTypeSchema } from '../types.js';

/**
 * Path validation regex - prevents traversal attacks
 */
const SAFE_PATH_REGEX = /^[a-zA-Z0-9_\-./\\:]+$/;

/**
 * Safe HTML content - basic XSS prevention
 * Allows alphanumeric, spaces, and common punctuation
 */
const SAFE_CONTENT_REGEX = /^[^<>]*$/;

// ============================================================================
// Component Types
// ============================================================================

/**
 * Supported component types for UI generation
 */
export const UIComponentTypeSchema = z.enum([
  'page',
  'section',
  'header',
  'footer',
  'navigation',
  'form',
  'input',
  'button',
  'card',
  'list',
  'table',
  'modal',
  'alert',
  'tabs',
  'accordion',
  'image',
  'text',
  'link',
  'icon',
  'container',
  'grid',
  'flex',
  'divider',
  'badge',
  'avatar',
  'tooltip',
  'dropdown',
  'checkbox',
  'radio',
  'select',
  'textarea',
  'slider',
  'switch',
  'progress',
  'spinner',
  'skeleton',
]);

export type UIComponentType = z.infer<typeof UIComponentTypeSchema>;

// ============================================================================
// Accessibility
// ============================================================================

/**
 * ARIA accessibility attributes
 */
export const AccessibilitySchema = z.object({
  role: z.string().max(50).optional(),
  ariaLabel: z.string().max(200).optional(),
  ariaDescribedBy: z.string().max(100).optional(),
  ariaLabelledBy: z.string().max(100).optional(),
  ariaExpanded: z.boolean().optional(),
  ariaHidden: z.boolean().optional(),
  ariaPressed: z.boolean().optional(),
  ariaSelected: z.boolean().optional(),
  ariaDisabled: z.boolean().optional(),
  ariaLive: z.enum(['off', 'polite', 'assertive']).optional(),
  tabIndex: z.number().int().min(-1).max(32767).optional(),
});

export type Accessibility = z.infer<typeof AccessibilitySchema>;

// ============================================================================
// Responsive Styles
// ============================================================================

/**
 * Responsive breakpoints
 */
export const BreakpointSchema = z.enum(['mobile', 'tablet', 'desktop', 'wide']);
export type Breakpoint = z.infer<typeof BreakpointSchema>;

/**
 * Breakpoint pixel values
 */
export const BREAKPOINT_VALUES = {
  mobile: 0,
  tablet: 640,
  desktop: 1024,
  wide: 1440,
} as const;

/**
 * CSS style declaration (property: value pairs)
 */
export const StyleSchema = z.record(
  z.string().min(1).max(50),
  z.string().max(500)
);
export type Style = z.infer<typeof StyleSchema>;

/**
 * Responsive styles for different breakpoints
 */
export const ResponsiveStylesSchema = z.object({
  base: StyleSchema,
  mobile: StyleSchema.optional(),
  tablet: StyleSchema.optional(),
  desktop: StyleSchema.optional(),
  wide: StyleSchema.optional(),
});

export type ResponsiveStyles = z.infer<typeof ResponsiveStylesSchema>;

// ============================================================================
// Component Variants
// ============================================================================

/**
 * Component variant (e.g., hover, focus, active states)
 */
export const ComponentVariantSchema = z.object({
  name: z.string().min(1).max(50),
  condition: z.string().max(200), // CSS pseudo-class or state
  styles: StyleSchema,
});

export type ComponentVariant = z.infer<typeof ComponentVariantSchema>;


// ============================================================================
// Component Definition
// ============================================================================

/**
 * UI Component interface for TypeScript (matches schema below)
 */
export interface UIComponent {
  id: string;
  type: UIComponentType;
  name: string;
  description?: string;
  content?: string;
  attributes?: Record<string, string>;
  styles: ResponsiveStyles;
  accessibility?: Accessibility;
  children?: UIComponent[];
  variants?: ComponentVariant[];
}

/**
 * UI Component schema with recursive children
 */
export const UIComponentSchema: z.ZodType<UIComponent> = z.lazy(() =>
  z.object({
    id: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, {
        message: 'ID must start with letter and contain only alphanumeric, underscore, or hyphen',
      }),
    type: UIComponentTypeSchema,
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    content: z
      .string()
      .max(5000)
      .refine((c) => SAFE_CONTENT_REGEX.test(c), {
        message: 'Content contains potentially unsafe characters',
      })
      .optional(),
    attributes: z
      .record(
        z.string().min(1).max(50),
        z.string().max(500)
      )
      .optional(),
    styles: ResponsiveStylesSchema,
    accessibility: AccessibilitySchema.optional(),
    children: z.array(z.lazy(() => UIComponentSchema)).optional(),
    variants: z.array(ComponentVariantSchema).optional(),
  })
);

// ============================================================================
// Page Layout
// ============================================================================

/**
 * Layout types for page structure
 * Includes common layout patterns + 'custom' as a catch-all
 * Uses .catch() to handle unknown values gracefully
 */
export const LayoutTypeSchema = z.enum([
  'single-column',
  'two-column',
  'three-column',
  'dashboard',
  'landing',
  'form',
  'auth',
  'sidebar',
  'centered',
  'fullwidth',
  'custom',
]).catch('custom'); // Fall back to 'custom' for unknown layout types

export type LayoutType = z.infer<typeof LayoutTypeSchema>;

/**
 * Layout region (area in the grid/layout)
 */
export const LayoutRegionSchema = z.object({
  name: z.string().min(1).max(50),
  area: z.string().max(100), // CSS grid area name
  components: z.array(z.string().max(100)), // Component IDs
});

export type LayoutRegion = z.infer<typeof LayoutRegionSchema>;

/**
 * Page layout definition
 */
export const PageLayoutSchema = z.object({
  type: LayoutTypeSchema.default('single-column'),
  regions: z.array(LayoutRegionSchema).default([]),
  gridTemplate: z.string().max(500).optional(), // CSS grid-template
  gap: z.string().max(50).optional(),
});

export type PageLayout = z.infer<typeof PageLayoutSchema>;

// ============================================================================
// Page Meta
// ============================================================================

/**
 * Theme preference
 */
export const ThemeSchema = z.enum(['light', 'dark', 'auto']);
export type Theme = z.infer<typeof ThemeSchema>;

/**
 * Page metadata
 */
export const PageMetaSchema = z.object({
  viewport: z.string().max(200).default('width=device-width, initial-scale=1'),
  theme: ThemeSchema.default('auto'),
  lang: z.string().max(10).default('en'),
  charset: z.string().max(20).default('UTF-8'),
});

export type PageMeta = z.infer<typeof PageMetaSchema>;

// ============================================================================
// Mockup Page
// ============================================================================

/**
 * Complete page mockup definition
 * Uses defaults for lenient parsing of Claude responses
 */
export const MockupPageSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  path: z
    .string()
    .min(1)
    .max(200)
    .refine((p) => p.startsWith('/'), {
      message: 'Path must start with /',
    })
    .default('/'),
  layout: PageLayoutSchema.default({}), // Will apply nested defaults
  components: z.array(UIComponentSchema).default([]),
  meta: PageMetaSchema.optional(),
});

export type MockupPage = z.infer<typeof MockupPageSchema>;

// ============================================================================
// Design Tokens
// ============================================================================

/**
 * Color palette definition
 * Most fields are optional with sensible defaults for lenient parsing
 */
export const ColorPaletteSchema = z.object({
  primary: z.string().max(50).default('#3B82F6'),
  secondary: z.string().max(50).default('#6366F1'),
  accent: z.string().max(50).default('#8B5CF6'),
  background: z.string().max(50).default('#FFFFFF'),
  surface: z.string().max(50).default('#F9FAFB'),
  text: z.string().max(50).default('#111827'),
  textSecondary: z.string().max(50).default('#6B7280'),
  error: z.string().max(50).default('#EF4444'),
  warning: z.string().max(50).default('#F59E0B'),
  success: z.string().max(50).default('#10B981'),
  info: z.string().max(50).default('#3B82F6'),
  border: z.string().max(50).optional(),
  muted: z.string().max(50).optional(),
});

export type ColorPalette = z.infer<typeof ColorPaletteSchema>;

/**
 * Typography settings
 */
export const TypographySchema = z.object({
  fontFamily: z.string().max(200),
  headingFamily: z.string().max(200).optional(),
  monoFamily: z.string().max(200).optional(),
  baseFontSize: z.string().max(20),
  scaleRatio: z.number().min(1).max(2),
  lineHeight: z.number().min(1).max(3).optional(),
  letterSpacing: z.string().max(20).optional(),
});

export type Typography = z.infer<typeof TypographySchema>;

/**
 * Spacing scale
 */
export const SpacingSchema = z.object({
  unit: z.number().int().min(1).max(32), // Base unit in px
  scale: z.array(z.number().min(0).max(100)), // Multipliers
});

export type Spacing = z.infer<typeof SpacingSchema>;

/**
 * Border radius settings
 */
export const BorderRadiusSchema = z.object({
  none: z.string().max(20).default('0'),
  sm: z.string().max(20).default('0.125rem'),
  md: z.string().max(20).default('0.375rem'),
  lg: z.string().max(20).default('0.5rem'),
  xl: z.string().max(20).default('0.75rem'),
  full: z.string().max(20).default('9999px'),
});

export type BorderRadius = z.infer<typeof BorderRadiusSchema>;

/**
 * Shadow definitions
 */
export const ShadowsSchema = z.object({
  none: z.string().max(100).default('none'),
  sm: z.string().max(100).default('0 1px 2px 0 rgb(0 0 0 / 0.05)'),
  md: z
    .string()
    .max(100)
    .default('0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'),
  lg: z
    .string()
    .max(100)
    .default('0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'),
  xl: z
    .string()
    .max(100)
    .default('0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'),
});

export type Shadows = z.infer<typeof ShadowsSchema>;

// ============================================================================
// Mega Page & Style Competition
// ============================================================================

/**
 * Component state variants for mega page showcase
 */
export const ComponentStateSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200),
  html: z.string().max(10000),
  cssClass: z.string().max(100).optional(),
});

export type ComponentState = z.infer<typeof ComponentStateSchema>;

/**
 * Component showcase entry for mega page
 * Shows all variants and states of a component
 */
export const ComponentShowcaseSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50), // navigation, forms, feedback, etc.
  description: z.string().max(500),
  variants: z.array(
    z.object({
      name: z.string().min(1).max(50), // primary, secondary, danger, etc.
      html: z.string().max(10000),
    })
  ),
  states: z.array(ComponentStateSchema), // default, hover, active, disabled, loading, error
  responsiveNotes: z.string().max(500).optional(),
});

export type ComponentShowcase = z.infer<typeof ComponentShowcaseSchema>;

/**
 * Asset manifest for mega page
 * Tracks fonts, icons, and other assets used
 */
export const AssetManifestSchema = z.object({
  fonts: z.array(
    z.object({
      family: z.string().min(1).max(100),
      source: z.string().max(200), // google, adobe, system, custom
      weights: z.array(z.number().int().min(100).max(900)),
      styles: z.array(z.enum(['normal', 'italic'])),
    })
  ),
  icons: z.object({
    library: z.string().max(100), // lucide, phosphor, heroicons, etc.
    style: z.string().max(50), // solid, outline, duotone
    iconList: z.array(z.string().max(50)), // specific icons used
  }).optional(),
  images: z.array(
    z.object({
      path: z.string().max(200),
      alt: z.string().max(200),
      purpose: z.string().max(100), // hero, logo, placeholder
    })
  ).optional(),
});

export type AssetManifest = z.infer<typeof AssetManifestSchema>;

/**
 * Mega page definition for style competition
 * Contains ALL components from the component inventory in a single page
 */
export const MegaPageSchema = z.object({
  /** Unique identifier for the mega page */
  id: z.string().min(1).max(100),
  /** Style package ID this mega page is based on */
  stylePackageId: z.string().max(100),
  /** Style package name */
  stylePackageName: z.string().max(100),
  /** Full HTML content of the mega page */
  html: z.string().max(500000), // Large limit for comprehensive showcase
  /** CSS content (design tokens as CSS variables + component styles) */
  css: z.string().max(100000),
  /** Component showcase entries */
  componentShowcase: z.array(ComponentShowcaseSchema),
  /** Asset manifest */
  assets: AssetManifestSchema,
  /** Whether the page includes interactive elements (hover, focus) */
  isInteractive: z.boolean().default(true),
  /** Whether dark mode styles are included */
  includesDarkMode: z.boolean().default(false),
  /** Generation timestamp */
  generatedAt: z.string().max(50),
});

export type MegaPage = z.infer<typeof MegaPageSchema>;

// ============================================================================
// Full Design Mode Schemas (Sprint 5)
// ============================================================================

/**
 * Screen state variants (empty, loading, error, success)
 */
export const ScreenStateSchema = z.object({
  name: z.enum(['default', 'loading', 'empty', 'error', 'success', 'partial']),
  description: z.string().max(200),
  html: z.string().max(100000),
  conditions: z.string().max(200).optional(), // When this state appears
});

export type ScreenState = z.infer<typeof ScreenStateSchema>;

/**
 * Responsive variant of a screen
 */
export const ResponsiveVariantSchema = z.object({
  breakpoint: z.enum(['mobile', 'tablet', 'desktop', 'wide']),
  minWidth: z.number().int().min(0).max(3840).optional(), // e.g., 320, 768, 1024, 1440
  html: z.string().max(100000),
  layoutChanges: z.string().max(500).optional(), // Description of layout differences
});

export type ResponsiveVariant = z.infer<typeof ResponsiveVariantSchema>;

/**
 * Complete screen mockup for full design mode
 * Each screen has all states and responsive variants
 */
export const ScreenMockupSchema = z.object({
  /** Screen ID from analyst's screen definitions */
  id: z.string().min(1).max(100),
  /** Human-readable name */
  name: z.string().min(1).max(100),
  /** Screen category (auth, dashboard, settings, etc.) */
  category: z.string().max(50).optional(),
  /** Description of the screen's purpose */
  description: z.string().max(500),
  /** URL path for the screen */
  path: z.string().max(200),
  /** Default HTML (desktop view, default state) */
  html: z.string().max(100000),
  /** CSS specific to this screen */
  css: z.string().max(50000).optional(),
  /** State variants (loading, empty, error) */
  states: z.array(ScreenStateSchema).default([]),
  /** Responsive variants */
  responsiveVariants: z.array(ResponsiveVariantSchema).default([]),
  /** Components used on this screen */
  componentsUsed: z.array(z.string().max(100)).default([]),
  /** Connected screens (navigation targets) */
  connectedScreens: z.array(z.string().max(100)).default([]),
  /** User flow(s) this screen belongs to */
  userFlows: z.array(z.string().max(100)).default([]),
  /** Accessibility notes */
  accessibilityNotes: z.string().max(500).optional(),
});

export type ScreenMockup = z.infer<typeof ScreenMockupSchema>;

/**
 * Step in a user flow diagram
 */
export const UserFlowStepSchema = z.object({
  /** Step ID (unique within the flow) */
  id: z.string().min(1).max(50),
  /** Screen ID this step represents */
  screenId: z.string().min(1).max(100),
  /** Label shown in the diagram */
  label: z.string().max(100),
  /** Step type */
  type: z.enum(['start', 'screen', 'decision', 'action', 'end']),
  /** Action user takes (button click, form submit, etc.) */
  action: z.string().max(200).optional(),
  /** Next step ID(s) - multiple for decision nodes */
  nextSteps: z.array(
    z.object({
      stepId: z.string().max(50),
      condition: z.string().max(100).optional(), // "Yes", "Login success", etc.
    })
  ).default([]),
  /** Position hint for diagram layout */
  position: z.object({
    x: z.number().int(),
    y: z.number().int(),
  }).optional(),
});

export type UserFlowStep = z.infer<typeof UserFlowStepSchema>;

/**
 * Complete user flow diagram
 */
export const UserFlowDiagramSchema = z.object({
  /** Flow ID from analyst */
  id: z.string().min(1).max(100),
  /** Flow name (e.g., "User Registration", "Checkout") */
  name: z.string().min(1).max(100),
  /** Description of what this flow accomplishes */
  description: z.string().max(500),
  /** Goal of the user in this flow */
  userGoal: z.string().max(200),
  /** Actor performing the flow (guest, member, admin) */
  actor: z.string().max(50).default('user'),
  /** Steps in the flow */
  steps: z.array(UserFlowStepSchema),
  /** Start step ID */
  startStepId: z.string().max(50),
  /** End step ID(s) */
  endStepIds: z.array(z.string().max(50)),
  /** Happy path step IDs in order */
  happyPath: z.array(z.string().max(50)).default([]),
  /** Mermaid diagram source code */
  mermaidDiagram: z.string().max(10000).optional(),
});

export type UserFlowDiagram = z.infer<typeof UserFlowDiagramSchema>;

/**
 * Full design output - all screens with an approved style
 */
export const FullDesignOutputSchema = z.object({
  /** Selected style package ID */
  stylePackageId: z.string().min(1).max(100),
  /** Style package name */
  stylePackageName: z.string().min(1).max(100),
  /** All screen mockups */
  screens: z.array(ScreenMockupSchema),
  /** User flow diagrams */
  userFlows: z.array(UserFlowDiagramSchema),
  /** Global CSS (design tokens + shared styles) */
  globalCss: z.string().max(100000),
  /** Shared component HTML templates */
  sharedComponents: z.array(
    z.object({
      id: z.string().min(1).max(100),
      name: z.string().min(1).max(100),
      html: z.string().max(20000),
      usage: z.string().max(200).optional(),
    })
  ).default([]),
  /** Design handoff notes for developers */
  handoffNotes: z.array(z.string().max(500)).default([]),
  /** Generated at timestamp */
  generatedAt: z.string().max(50),
});

export type FullDesignOutput = z.infer<typeof FullDesignOutputSchema>;

// ============================================================================
// Routing Hints
// ============================================================================

/**
 * UI Designer routing hints
 * All fields have defaults for lenient parsing of Claude responses
 */
export const UIDesignerRoutingHintsSchema = z.object({
  suggestNext: z.array(AgentTypeSchema).default([]),
  skipAgents: z.array(AgentTypeSchema).default([]),
  needsApproval: z.boolean().default(true), // Default to needing approval for UI designs
  hasFailures: z.boolean().default(false),
  isComplete: z.boolean().default(true),
  pageCount: z.number().int().min(0).optional(),
  componentCount: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

export type UIDesignerRoutingHints = z.infer<typeof UIDesignerRoutingHintsSchema>;

// ============================================================================
// Complete Output
// ============================================================================

/**
 * Complete UI Designer output
 * Uses defaults for lenient parsing of Claude responses
 */
export const UIDesignerOutputSchema = z.object({
  projectName: z.string().min(1).max(100).default('Untitled Project'),
  version: z.string().max(20).default('1.0.0'),
  generatedAt: z.string().max(50).default(() => new Date().toISOString()),

  // Pages
  pages: z.array(MockupPageSchema).default([]),

  // Shared components (reusable across pages)
  sharedComponents: z.array(UIComponentSchema).default([]),

  // Design tokens - use default() to apply all nested defaults
  colorPalette: ColorPaletteSchema.default({}),
  typography: TypographySchema.optional(),
  spacing: SpacingSchema.optional(),
  borderRadius: BorderRadiusSchema.optional(),
  shadows: ShadowsSchema.optional(),

  // Mega page for style competition (optional)
  megaPage: MegaPageSchema.optional(),

  // Full design output - all screens with approved style (optional)
  fullDesign: FullDesignOutputSchema.optional(),

  // Routing hints - use default() to apply all nested defaults
  routingHints: UIDesignerRoutingHintsSchema.default({}),

  // Notes for developers/reviewers
  notes: z.array(z.string().max(500)).optional(),
});

export type UIDesignerOutput = z.infer<typeof UIDesignerOutputSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a default color palette
 */
export function createDefaultColorPalette(): ColorPalette {
  return {
    primary: '#3B82F6',
    secondary: '#6366F1',
    accent: '#8B5CF6',
    background: '#FFFFFF',
    surface: '#F9FAFB',
    text: '#111827',
    textSecondary: '#6B7280',
    error: '#EF4444',
    warning: '#F59E0B',
    success: '#10B981',
    info: '#3B82F6',
    border: '#E5E7EB',
    muted: '#9CA3AF',
  };
}

/**
 * Create default typography settings
 */
export function createDefaultTypography(): Typography {
  return {
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    headingFamily: 'inherit',
    monoFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
    baseFontSize: '1rem',
    scaleRatio: 1.25,
    lineHeight: 1.5,
    letterSpacing: 'normal',
  };
}

/**
 * Create default spacing scale
 */
export function createDefaultSpacing(): Spacing {
  return {
    unit: 4, // 4px base unit
    scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64],
  };
}

/**
 * Create default border radius
 */
export function createDefaultBorderRadius(): BorderRadius {
  return {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    full: '9999px',
  };
}

/**
 * Create default shadows
 */
export function createDefaultShadows(): Shadows {
  return {
    none: 'none',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  };
}

/**
 * Create a UI component
 */
export function createUIComponent(
  id: string,
  type: UIComponentType,
  name: string,
  styles: ResponsiveStyles = { base: {} }
): UIComponent {
  return {
    id,
    type,
    name,
    styles,
  };
}

/**
 * Create a mockup page
 */
export function createMockupPage(
  id: string,
  name: string,
  title: string,
  path: string,
  layout: PageLayout = { type: 'single-column', regions: [] }
): MockupPage {
  return {
    id,
    name,
    title,
    path,
    description: '',
    layout,
    components: [],
  };
}

/**
 * Count total components in a page (including nested)
 */
export function countComponents(components: UIComponent[]): number {
  let count = components.length;
  for (const comp of components) {
    if (comp.children) {
      count += countComponents(comp.children);
    }
  }
  return count;
}

/**
 * Flatten component tree to array
 */
export function flattenComponents(components: UIComponent[]): UIComponent[] {
  const result: UIComponent[] = [];
  for (const comp of components) {
    result.push(comp);
    if (comp.children) {
      result.push(...flattenComponents(comp.children));
    }
  }
  return result;
}

/**
 * Find component by ID in tree
 */
export function findComponentById(
  components: UIComponent[],
  id: string
): UIComponent | undefined {
  for (const comp of components) {
    if (comp.id === id) return comp;
    if (comp.children) {
      const found = findComponentById(comp.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Get components by type
 */
export function getComponentsByType(
  components: UIComponent[],
  type: UIComponentType
): UIComponent[] {
  return flattenComponents(components).filter((c) => c.type === type);
}

/**
 * Validate component IDs are unique
 */
export function validateUniqueIds(components: UIComponent[]): boolean {
  const ids = new Set<string>();
  const flattened = flattenComponents(components);
  for (const comp of flattened) {
    if (ids.has(comp.id)) {
      return false;
    }
    ids.add(comp.id);
  }
  return true;
}

/**
 * Check if component has accessibility attributes
 */
export function hasAccessibility(component: UIComponent): boolean {
  return (
    component.accessibility !== undefined &&
    Object.keys(component.accessibility).length > 0
  );
}

/**
 * Count accessible components
 */
export function countAccessibleComponents(components: UIComponent[]): number {
  return flattenComponents(components).filter(hasAccessibility).length;
}
