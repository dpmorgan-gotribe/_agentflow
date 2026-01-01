/**
 * Component Inventory Schemas
 *
 * Defines the component inventory structure that the Analyst creates
 * to document all UI components needed for the application.
 * This inventory is used by UI designers to create the mega page
 * showcasing all components in different style packages.
 */

import { z } from 'zod';

/**
 * Component complexity levels
 */
export const ComponentComplexitySchema = z.enum([
  'simple',     // Basic component, few states
  'moderate',   // Multiple states, some interactivity
  'complex',    // Many states, significant interactivity
  'advanced',   // Composite, data-driven, or animated
]);

export type ComponentComplexity = z.infer<typeof ComponentComplexitySchema>;

/**
 * Component categories
 */
export const ComponentCategorySchema = z.enum([
  'navigation',
  'data_display',
  'forms',
  'feedback',
  'layout',
  'media',
  'specialized',
  'overlays',
  'utility',
]);

export type ComponentCategory = z.infer<typeof ComponentCategorySchema>;

/**
 * Common component states that should be demonstrated
 */
export const ComponentStateSchema = z.enum([
  'default',
  'hover',
  'active',
  'focus',
  'disabled',
  'loading',
  'error',
  'success',
  'empty',
  'selected',
  'expanded',
  'collapsed',
  'readonly',
]);

export type ComponentState = z.infer<typeof ComponentStateSchema>;

/**
 * Base component definition
 */
export const BaseComponentSchema = z.object({
  /** Component name */
  name: z.string(),
  /** Description of the component's purpose */
  description: z.string(),
  /** Category this component belongs to */
  category: ComponentCategorySchema,
  /** Complexity level */
  complexity: ComponentComplexitySchema,
  /** States this component should demonstrate */
  states: z.array(ComponentStateSchema),
  /** Variants (e.g., primary, secondary, outline) */
  variants: z.array(z.string()),
  /** Sizes to support */
  sizes: z.array(z.enum(['xs', 'sm', 'md', 'lg', 'xl'])).optional(),
  /** Whether this is a required component */
  required: z.boolean().default(true),
  /** Notes about implementation */
  notes: z.string().optional(),
});

export type BaseComponent = z.infer<typeof BaseComponentSchema>;

/**
 * Navigation component specifics
 */
export const NavigationComponentSchema = BaseComponentSchema.extend({
  category: z.literal('navigation'),
  /** Navigation type */
  navigationType: z.enum([
    'navbar',
    'sidebar',
    'tabs',
    'breadcrumbs',
    'pagination',
    'stepper',
    'menu',
    'drawer',
    'bottom_nav',
  ]).optional(),
  /** Whether it supports mobile responsiveness */
  mobileVariant: z.boolean().default(true),
});

export type NavigationComponent = z.infer<typeof NavigationComponentSchema>;

/**
 * Data display component specifics
 */
export const DataDisplayComponentSchema = BaseComponentSchema.extend({
  category: z.literal('data_display'),
  /** Data display type */
  displayType: z.enum([
    'table',
    'list',
    'grid',
    'card',
    'badge',
    'tag',
    'avatar',
    'stat',
    'chart',
    'timeline',
    'tree',
    'description_list',
  ]).optional(),
  /** Whether it supports sorting */
  sortable: z.boolean().optional(),
  /** Whether it supports filtering */
  filterable: z.boolean().optional(),
  /** Whether it supports pagination */
  paginated: z.boolean().optional(),
});

export type DataDisplayComponent = z.infer<typeof DataDisplayComponentSchema>;

/**
 * Form component specifics
 */
export const FormComponentSchema = BaseComponentSchema.extend({
  category: z.literal('forms'),
  /** Form element type */
  formType: z.enum([
    'input',
    'textarea',
    'select',
    'checkbox',
    'radio',
    'switch',
    'slider',
    'date_picker',
    'time_picker',
    'file_upload',
    'color_picker',
    'autocomplete',
    'form_group',
    'form_label',
    'form_error',
  ]).optional(),
  /** Validation states to show */
  validationStates: z.array(z.enum(['valid', 'invalid', 'warning'])).optional(),
});

export type FormComponent = z.infer<typeof FormComponentSchema>;

/**
 * Feedback component specifics
 */
export const FeedbackComponentSchema = BaseComponentSchema.extend({
  category: z.literal('feedback'),
  /** Feedback type */
  feedbackType: z.enum([
    'alert',
    'toast',
    'notification',
    'progress',
    'spinner',
    'skeleton',
    'empty_state',
    'error_boundary',
    'banner',
  ]).optional(),
  /** Auto-dismiss behavior */
  autoDismiss: z.boolean().optional(),
  /** Position on screen */
  position: z.string().optional(),
});

export type FeedbackComponent = z.infer<typeof FeedbackComponentSchema>;

/**
 * Overlay component specifics
 */
export const OverlayComponentSchema = BaseComponentSchema.extend({
  category: z.literal('overlays'),
  /** Overlay type */
  overlayType: z.enum([
    'modal',
    'dialog',
    'drawer',
    'popover',
    'tooltip',
    'dropdown',
    'context_menu',
    'command_palette',
    'lightbox',
  ]).optional(),
  /** Close behavior */
  closeBehavior: z.array(z.enum(['button', 'backdrop', 'escape'])).optional(),
});

export type OverlayComponent = z.infer<typeof OverlayComponentSchema>;

/**
 * Specialized component for domain-specific needs
 */
export const SpecializedComponentSchema = BaseComponentSchema.extend({
  category: z.literal('specialized'),
  /** Reason this specialized component is needed */
  reason: z.string(),
  /** Domain this component is specific to */
  domain: z.string().optional(),
  /** Reference to similar components in other apps */
  similarTo: z.array(z.string()).optional(),
});

export type SpecializedComponent = z.infer<typeof SpecializedComponentSchema>;

/**
 * Media component specifics
 */
export const MediaComponentSchema = BaseComponentSchema.extend({
  category: z.literal('media'),
  /** Media type */
  mediaType: z.enum([
    'image',
    'video',
    'audio',
    'gallery',
    'carousel',
    'icon',
    'illustration',
    'avatar_group',
  ]).optional(),
  /** Whether it supports lazy loading */
  lazyLoad: z.boolean().optional(),
  /** Aspect ratios to support */
  aspectRatios: z.array(z.string()).optional(),
});

export type MediaComponent = z.infer<typeof MediaComponentSchema>;

/**
 * Layout component specifics
 */
export const LayoutComponentSchema = BaseComponentSchema.extend({
  category: z.literal('layout'),
  /** Layout type */
  layoutType: z.enum([
    'container',
    'grid',
    'flex',
    'stack',
    'divider',
    'spacer',
    'card',
    'panel',
    'section',
    'header',
    'footer',
    'sidebar_layout',
  ]).optional(),
  /** Responsive breakpoints */
  breakpoints: z.array(z.string()).optional(),
});

export type LayoutComponent = z.infer<typeof LayoutComponentSchema>;

/**
 * Union of all component types
 */
export const ComponentDefinitionSchema = z.discriminatedUnion('category', [
  NavigationComponentSchema,
  DataDisplayComponentSchema,
  FormComponentSchema,
  FeedbackComponentSchema,
  OverlayComponentSchema,
  SpecializedComponentSchema,
  MediaComponentSchema,
  LayoutComponentSchema,
  BaseComponentSchema.extend({ category: z.literal('utility') }),
]);

export type ComponentDefinition = z.infer<typeof ComponentDefinitionSchema>;

/**
 * User flow for the application
 */
export const UserFlowSchema = z.object({
  /** Flow ID */
  id: z.string(),
  /** Flow name */
  name: z.string(),
  /** Description of the flow */
  description: z.string(),
  /** Steps in the flow */
  steps: z.array(z.object({
    /** Step number */
    stepNumber: z.number(),
    /** Screen or component involved */
    screen: z.string(),
    /** User action */
    action: z.string(),
    /** Expected outcome */
    outcome: z.string(),
    /** Components used in this step */
    componentsUsed: z.array(z.string()),
  })),
  /** Entry point screen */
  entryPoint: z.string(),
  /** Exit points */
  exitPoints: z.array(z.string()),
  /** Is this a critical/happy path */
  isCriticalPath: z.boolean().default(false),
});

export type UserFlow = z.infer<typeof UserFlowSchema>;

/**
 * Screen definition
 */
export const ScreenDefinitionSchema = z.object({
  /** Screen ID */
  id: z.string(),
  /** Screen name */
  name: z.string(),
  /** Screen description */
  description: z.string(),
  /** Screen purpose */
  purpose: z.string(),
  /** Screen type */
  type: z.enum([
    'landing',
    'dashboard',
    'list',
    'detail',
    'form',
    'settings',
    'profile',
    'auth',
    'onboarding',
    'error',
    'empty',
    'search',
    'checkout',
    'confirmation',
  ]),
  /** Components used on this screen */
  components: z.array(z.string()),
  /** User flows this screen participates in */
  flows: z.array(z.string()),
  /** Navigation from this screen */
  navigatesTo: z.array(z.string()),
  /** Data requirements */
  dataRequirements: z.array(z.string()).optional(),
  /** States the screen can be in */
  screenStates: z.array(z.enum([
    'loading',
    'empty',
    'error',
    'populated',
    'filtered',
    'searching',
  ])).optional(),
});

export type ScreenDefinition = z.infer<typeof ScreenDefinitionSchema>;

/**
 * Complete component inventory
 */
export const ComponentInventorySchema = z.object({
  /** Project context */
  projectContext: z.object({
    /** Application type */
    appType: z.string(),
    /** Primary domain */
    domain: z.string(),
    /** Target platforms */
    platforms: z.array(z.enum(['web', 'mobile', 'desktop'])),
    /** Target audience description */
    audience: z.string(),
  }),

  /** All screens identified */
  screens: z.array(ScreenDefinitionSchema),

  /** All user flows identified */
  userFlows: z.array(UserFlowSchema),

  /** Components by category */
  navigation: z.array(NavigationComponentSchema.or(BaseComponentSchema)),
  dataDisplay: z.array(DataDisplayComponentSchema.or(BaseComponentSchema)),
  forms: z.array(FormComponentSchema.or(BaseComponentSchema)),
  feedback: z.array(FeedbackComponentSchema.or(BaseComponentSchema)),
  overlays: z.array(OverlayComponentSchema.or(BaseComponentSchema)),
  layout: z.array(LayoutComponentSchema.or(BaseComponentSchema)),
  media: z.array(MediaComponentSchema.or(BaseComponentSchema)),
  specialized: z.array(SpecializedComponentSchema),
  utility: z.array(BaseComponentSchema),

  /** Required states that must be demonstrated */
  requiredStates: z.array(ComponentStateSchema),

  /** Summary statistics */
  summary: z.object({
    totalComponents: z.number(),
    totalScreens: z.number(),
    totalFlows: z.number(),
    complexityBreakdown: z.record(ComponentComplexitySchema, z.number()),
    categoryBreakdown: z.record(ComponentCategorySchema, z.number()),
  }),

  /** Notes from analysis */
  analysisNotes: z.array(z.string()).optional(),

  /** Timestamp of inventory creation */
  createdAt: z.string(),
});

export type ComponentInventory = z.infer<typeof ComponentInventorySchema>;

/**
 * Mega page section definition
 * Used to organize components in the mega page showcase
 */
export const MegaPageSectionSchema = z.object({
  /** Section ID */
  id: z.string(),
  /** Section title */
  title: z.string(),
  /** Section description */
  description: z.string(),
  /** Category of components in this section */
  category: ComponentCategorySchema,
  /** Components to show in this section */
  components: z.array(z.object({
    name: z.string(),
    variants: z.array(z.string()),
    states: z.array(ComponentStateSchema),
    sizes: z.array(z.string()).optional(),
  })),
  /** Layout for this section */
  layout: z.enum(['grid', 'list', 'showcase', 'comparison']),
});

export type MegaPageSection = z.infer<typeof MegaPageSectionSchema>;

/**
 * Helper to create an empty component inventory
 */
export function createEmptyInventory(): ComponentInventory {
  return {
    projectContext: {
      appType: '',
      domain: '',
      platforms: ['web'],
      audience: '',
    },
    screens: [],
    userFlows: [],
    navigation: [],
    dataDisplay: [],
    forms: [],
    feedback: [],
    overlays: [],
    layout: [],
    media: [],
    specialized: [],
    utility: [],
    requiredStates: ['default', 'hover', 'disabled', 'loading', 'error'],
    summary: {
      totalComponents: 0,
      totalScreens: 0,
      totalFlows: 0,
      complexityBreakdown: {
        simple: 0,
        moderate: 0,
        complex: 0,
        advanced: 0,
      },
      categoryBreakdown: {
        navigation: 0,
        data_display: 0,
        forms: 0,
        feedback: 0,
        layout: 0,
        media: 0,
        specialized: 0,
        overlays: 0,
        utility: 0,
      },
    },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Helper to calculate inventory summary
 */
export function calculateInventorySummary(
  inventory: Omit<ComponentInventory, 'summary'>
): ComponentInventory['summary'] {
  const allComponents = [
    ...inventory.navigation,
    ...inventory.dataDisplay,
    ...inventory.forms,
    ...inventory.feedback,
    ...inventory.overlays,
    ...inventory.layout,
    ...inventory.media,
    ...inventory.specialized,
    ...inventory.utility,
  ];

  const complexityBreakdown: Record<ComponentComplexity, number> = {
    simple: 0,
    moderate: 0,
    complex: 0,
    advanced: 0,
  };

  const categoryBreakdown: Record<ComponentCategory, number> = {
    navigation: inventory.navigation.length,
    data_display: inventory.dataDisplay.length,
    forms: inventory.forms.length,
    feedback: inventory.feedback.length,
    layout: inventory.layout.length,
    media: inventory.media.length,
    specialized: inventory.specialized.length,
    overlays: inventory.overlays.length,
    utility: inventory.utility.length,
  };

  for (const component of allComponents) {
    complexityBreakdown[component.complexity]++;
  }

  return {
    totalComponents: allComponents.length,
    totalScreens: inventory.screens.length,
    totalFlows: inventory.userFlows.length,
    complexityBreakdown,
    categoryBreakdown,
  };
}

/**
 * Helper to get all component names from inventory
 */
export function getAllComponentNames(inventory: ComponentInventory): string[] {
  const allComponents = [
    ...inventory.navigation,
    ...inventory.dataDisplay,
    ...inventory.forms,
    ...inventory.feedback,
    ...inventory.overlays,
    ...inventory.layout,
    ...inventory.media,
    ...inventory.specialized,
    ...inventory.utility,
  ];

  return allComponents.map((c) => c.name);
}

/**
 * Helper to organize inventory into mega page sections
 */
export function createMegaPageSections(
  inventory: ComponentInventory
): MegaPageSection[] {
  const sections: MegaPageSection[] = [];

  const categoryMap: Record<ComponentCategory, BaseComponent[]> = {
    navigation: inventory.navigation,
    data_display: inventory.dataDisplay,
    forms: inventory.forms,
    feedback: inventory.feedback,
    overlays: inventory.overlays,
    layout: inventory.layout,
    media: inventory.media,
    specialized: inventory.specialized,
    utility: inventory.utility,
  };

  const categoryTitles: Record<ComponentCategory, string> = {
    navigation: 'Navigation Components',
    data_display: 'Data Display',
    forms: 'Form Elements',
    feedback: 'Feedback & Status',
    overlays: 'Overlays & Modals',
    layout: 'Layout Components',
    media: 'Media Components',
    specialized: 'Specialized Components',
    utility: 'Utility Components',
  };

  for (const [category, components] of Object.entries(categoryMap)) {
    if (components.length > 0) {
      sections.push({
        id: category,
        title: categoryTitles[category as ComponentCategory],
        description: `All ${category.replace('_', ' ')} components for the application`,
        category: category as ComponentCategory,
        components: components.map((c) => ({
          name: c.name,
          variants: c.variants,
          states: c.states,
          sizes: c.sizes,
        })),
        layout: category === 'forms' ? 'list' : 'grid',
      });
    }
  }

  return sections;
}
