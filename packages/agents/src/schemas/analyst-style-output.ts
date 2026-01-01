/**
 * Analyst Style Research Output Schema
 *
 * Extended output schema for style research phase of design workflow.
 * The Analyst extracts style hints from prompts, researches domain competitors,
 * identifies user flows and screens, creates component inventory, and generates
 * 5 distinct style packages.
 *
 * SECURITY:
 * - URL validation on inspiration sources
 * - String length limits to prevent payload abuse
 */

import { z } from 'zod';

// Re-export style package types from langgraph for consistency
// These are the core types used in the workflow state
export {
  TypographySchema,
  IconConfigSchema,
  ColorPaletteSchema,
  VisualStyleSchema,
  CssConfigSchema,
  DesignReferenceSchema,
  StylePackageSchema,
  UserStyleHintsSchema,
  type Typography,
  type IconConfig,
  type ColorPalette,
  type VisualStyle,
  type CssConfig,
  type DesignReference,
  type StylePackage,
  type UserStyleHints,
} from '@aigentflow/langgraph';

export {
  ComponentInventorySchema,
  UserFlowSchema,
  ScreenDefinitionSchema,
  type ComponentInventory,
  type UserFlow,
  type ScreenDefinition,
} from '@aigentflow/langgraph';

/**
 * Color mention extracted from prompt
 */
export const ColorMentionSchema = z.object({
  /** The color mentioned */
  color: z.string().min(1).max(50),
  /** Context in which it was mentioned */
  context: z.string().max(200).optional(),
  /** Whether this is a must-use constraint */
  required: z.boolean().default(false),
});

export type ColorMention = z.infer<typeof ColorMentionSchema>;

/**
 * Font mention extracted from prompt
 */
export const FontMentionSchema = z.object({
  /** The font mentioned */
  font: z.string().min(1).max(100),
  /** Whether for headings, body, or both */
  usage: z.enum(['heading', 'body', 'both', 'unknown']).default('unknown'),
  /** Whether this is a must-use constraint */
  required: z.boolean().default(false),
});

export type FontMention = z.infer<typeof FontMentionSchema>;

/**
 * Inspiration URL extracted from prompt
 */
export const InspirationUrlSchema = z.object({
  /** The URL */
  url: z.string().url(),
  /** What aspects to take from this reference */
  aspects: z.array(z.enum([
    'color',
    'typography',
    'layout',
    'components',
    'animation',
    'iconography',
    'spacing',
    'overall_vibe',
  ])),
  /** Notes about the reference */
  notes: z.string().max(500).optional(),
});

export type InspirationUrl = z.infer<typeof InspirationUrlSchema>;

/**
 * Platform hint (iOS, Material, etc.)
 */
export const PlatformHintSchema = z.object({
  /** Platform name */
  platform: z.enum([
    'ios',
    'material',
    'fluent',
    'web',
    'macos',
    'windows',
    'custom',
  ]),
  /** Whether explicitly mentioned or inferred */
  explicit: z.boolean(),
  /** Confidence if inferred */
  confidence: z.number().min(0).max(1).optional(),
});

export type PlatformHint = z.infer<typeof PlatformHintSchema>;

/**
 * Style hints extracted from the user's prompt
 */
export const PromptStyleAnalysisSchema = z.object({
  /** Colors mentioned in the prompt */
  colors: z.array(ColorMentionSchema),
  /** Fonts mentioned in the prompt */
  fonts: z.array(FontMentionSchema),
  /** Inspiration URLs provided */
  inspirationUrls: z.array(InspirationUrlSchema),
  /** Mood/vibe keywords detected */
  moodKeywords: z.array(z.string().min(1).max(50)),
  /** Style keywords (minimal, bold, elegant, etc.) */
  styleKeywords: z.array(z.string().min(1).max(50)),
  /** Things to avoid */
  avoidKeywords: z.array(z.string().min(1).max(50)),
  /** Platform hints */
  platformHints: z.array(PlatformHintSchema),
  /** Target audience hints */
  audienceHints: z.object({
    /** Age range if mentioned */
    ageRange: z.string().max(50).optional(),
    /** Industry/domain */
    industry: z.string().max(100).optional(),
    /** Professional vs consumer */
    type: z.enum(['professional', 'consumer', 'enterprise', 'mixed', 'unknown']).default('unknown'),
    /** Any explicit mentions */
    explicit: z.array(z.string().max(200)),
  }),
  /** Raw hints summary for debugging */
  rawHintsSummary: z.string().max(1000),
});

export type PromptStyleAnalysis = z.infer<typeof PromptStyleAnalysisSchema>;

/**
 * Competitor/reference app analysis
 */
export const CompetitorAnalysisSchema = z.object({
  /** Competitor name */
  name: z.string().min(1).max(100),
  /** Website or app URL */
  url: z.string().url().optional(),
  /** Description */
  description: z.string().max(500),
  /** Style notes */
  styleNotes: z.string().max(1000),
  /** What to learn from them */
  takeaways: z.array(z.string().max(200)),
  /** What to avoid from them */
  avoid: z.array(z.string().max(200)),
  /** Relevance score */
  relevance: z.number().min(0).max(1),
});

export type CompetitorAnalysis = z.infer<typeof CompetitorAnalysisSchema>;

/**
 * Domain research results
 */
export const DomainResearchSchema = z.object({
  /** Application category */
  appCategory: z.string().min(1).max(100),
  /** Primary domain/industry */
  domain: z.string().min(1).max(100),
  /** Key competitors analyzed */
  competitors: z.array(CompetitorAnalysisSchema),
  /** Common patterns in this domain */
  domainPatterns: z.array(z.string().max(200)),
  /** Typical user expectations */
  userExpectations: z.array(z.string().max(200)),
  /** Technical considerations */
  technicalConsiderations: z.array(z.string().max(200)),
});

export type DomainResearch = z.infer<typeof DomainResearchSchema>;

/**
 * Technology stack recommendation
 */
export const TechRecommendationSchema = z.object({
  /** Frontend framework */
  frontend: z.object({
    framework: z.string(),
    reasoning: z.string().max(500),
  }),
  /** CSS approach */
  css: z.object({
    approach: z.enum(['tailwind', 'css-modules', 'styled-components', 'emotion', 'vanilla']),
    reasoning: z.string().max(500),
  }),
  /** Component library suggestion */
  componentLibrary: z.object({
    name: z.string().optional(),
    reasoning: z.string().max(500),
  }),
  /** Animation library */
  animation: z.object({
    library: z.string().optional(),
    reasoning: z.string().max(500),
  }),
});

export type TechRecommendation = z.infer<typeof TechRecommendationSchema>;

/**
 * Style constraints that must be honored
 */
export const StyleConstraintsSchema = z.object({
  /** Colors that must be used */
  mustUseColors: z.array(z.string()),
  /** Fonts that must be used */
  mustUseFonts: z.array(z.string()),
  /** URLs that must be referenced */
  mustMatchUrls: z.array(z.string()),
  /** Styles that must be avoided */
  mustAvoid: z.array(z.string()),
  /** Platform constraints */
  platformConstraints: z.array(z.string()),
});

export type StyleConstraints = z.infer<typeof StyleConstraintsSchema>;

/**
 * Complete style research output from Analyst
 */
export const StyleResearchOutputSchema = z.object({
  /** Analysis of style hints in the prompt */
  promptAnalysis: PromptStyleAnalysisSchema,

  /** Domain and competitor research */
  domainResearch: DomainResearchSchema,

  /** All screens identified for the application */
  screens: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    purpose: z.string(),
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
    components: z.array(z.string()),
    flows: z.array(z.string()),
    navigatesTo: z.array(z.string()),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
  })),

  /** User flows identified */
  userFlows: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    steps: z.array(z.object({
      stepNumber: z.number(),
      screen: z.string(),
      action: z.string(),
      outcome: z.string(),
      componentsUsed: z.array(z.string()),
    })),
    entryPoint: z.string(),
    exitPoints: z.array(z.string()),
    isCriticalPath: z.boolean(),
  })),

  /** Component inventory */
  componentInventory: z.object({
    projectContext: z.object({
      appType: z.string(),
      domain: z.string(),
      platforms: z.array(z.enum(['web', 'mobile', 'desktop'])),
      audience: z.string(),
    }),
    navigation: z.array(z.string()),
    dataDisplay: z.array(z.string()),
    forms: z.array(z.string()),
    feedback: z.array(z.string()),
    overlays: z.array(z.string()),
    layout: z.array(z.string()),
    media: z.array(z.string()),
    specialized: z.array(z.object({
      component: z.string(),
      reason: z.string(),
      complexity: z.enum(['simple', 'moderate', 'complex', 'advanced']),
    })),
    requiredStates: z.array(z.string()),
    totalCount: z.number(),
  }),

  /** Technology stack recommendation */
  techStack: TechRecommendationSchema,

  /** 5 distinct style packages */
  stylePackages: z.array(z.object({
    id: z.string(),
    name: z.string(),
    moodDescription: z.string(),
    characteristics: z.array(z.string()),
    differentiator: z.string(),
    typography: z.object({
      headingFont: z.string(),
      bodyFont: z.string(),
      weights: z.array(z.number()),
      source: z.enum(['google', 'adobe', 'local', 'system']),
    }),
    icons: z.object({
      library: z.string(),
      style: z.enum(['outline', 'solid', 'duotone', 'thin', 'regular']),
    }),
    colors: z.object({
      primary: z.string(),
      secondary: z.string(),
      accent: z.string(),
      background: z.string(),
      surface: z.string(),
      text: z.string(),
      textMuted: z.string(),
    }),
    visual: z.object({
      borderRadius: z.string(),
      shadows: z.boolean(),
      gradients: z.boolean(),
    }),
    references: z.array(z.object({
      name: z.string(),
      url: z.string().optional(),
      notes: z.string(),
    })),
    honorsUserHints: z.boolean(),
    userHintsUsed: z.array(z.string()),
  })).min(5).max(5),

  /** Constraints that all styles must honor */
  styleConstraints: StyleConstraintsSchema,

  /** Summary for the orchestrator */
  summary: z.string().max(2000),

  /** Confidence in the analysis */
  confidence: z.number().min(0).max(1),
});

export type StyleResearchOutput = z.infer<typeof StyleResearchOutputSchema>;

/**
 * Helper to create empty style constraints
 */
export function createEmptyStyleConstraints(): StyleConstraints {
  return {
    mustUseColors: [],
    mustUseFonts: [],
    mustMatchUrls: [],
    mustAvoid: [],
    platformConstraints: [],
  };
}

/**
 * Helper to create empty prompt style analysis
 */
export function createEmptyPromptAnalysis(): PromptStyleAnalysis {
  return {
    colors: [],
    fonts: [],
    inspirationUrls: [],
    moodKeywords: [],
    styleKeywords: [],
    avoidKeywords: [],
    platformHints: [],
    audienceHints: {
      type: 'unknown',
      explicit: [],
    },
    rawHintsSummary: '',
  };
}

/**
 * Mood keywords to style package mapping
 */
export const MOOD_STYLE_MAPPING: Record<string, {
  borderRadius: string;
  shadows: boolean;
  gradients: boolean;
  typography: 'modern' | 'classic' | 'playful' | 'technical';
}> = {
  minimal: { borderRadius: 'sm', shadows: false, gradients: false, typography: 'modern' },
  bold: { borderRadius: 'lg', shadows: true, gradients: true, typography: 'modern' },
  elegant: { borderRadius: 'md', shadows: true, gradients: false, typography: 'classic' },
  playful: { borderRadius: 'full', shadows: true, gradients: true, typography: 'playful' },
  professional: { borderRadius: 'md', shadows: true, gradients: false, typography: 'modern' },
  technical: { borderRadius: 'none', shadows: false, gradients: false, typography: 'technical' },
  warm: { borderRadius: 'lg', shadows: true, gradients: false, typography: 'classic' },
  cool: { borderRadius: 'sm', shadows: true, gradients: true, typography: 'modern' },
  clean: { borderRadius: 'md', shadows: false, gradients: false, typography: 'modern' },
  creative: { borderRadius: 'lg', shadows: true, gradients: true, typography: 'playful' },
};

/**
 * Extract style hints from a prompt string
 */
export function extractStyleHintsFromPrompt(prompt: string): Partial<PromptStyleAnalysis> {
  const lowerPrompt = prompt.toLowerCase();

  // Color detection patterns
  const colorPatterns = [
    /\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey)\b/gi,
    /#[0-9a-fA-F]{3,6}\b/g,
    /\brgb\([^)]+\)/gi,
  ];

  const colors: ColorMention[] = [];
  for (const pattern of colorPatterns) {
    const matches = prompt.match(pattern);
    if (matches) {
      for (const match of matches) {
        colors.push({ color: match, required: false });
      }
    }
  }

  // Font detection
  const fontPatterns = [
    /\b(inter|roboto|helvetica|arial|poppins|montserrat|open sans|lato|nunito|playfair|merriweather|source sans|fira|jetbrains|geist)\b/gi,
  ];

  const fonts: FontMention[] = [];
  for (const pattern of fontPatterns) {
    const matches = prompt.match(pattern);
    if (matches) {
      for (const match of matches) {
        fonts.push({ font: match, usage: 'unknown', required: false });
      }
    }
  }

  // URL detection
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const urls = prompt.match(urlPattern) || [];
  const inspirationUrls: InspirationUrl[] = urls.map((url) => ({
    url,
    aspects: ['overall_vibe'],
  }));

  // Mood keywords
  const moodKeywords: string[] = [];
  const moodPatterns = [
    'minimal', 'minimalist', 'clean', 'simple',
    'bold', 'vibrant', 'colorful', 'bright',
    'elegant', 'sophisticated', 'luxury', 'premium',
    'playful', 'fun', 'friendly', 'casual',
    'professional', 'corporate', 'business',
    'modern', 'contemporary', 'sleek',
    'traditional', 'classic', 'timeless',
    'dark', 'light', 'warm', 'cool',
  ];

  for (const mood of moodPatterns) {
    if (lowerPrompt.includes(mood)) {
      moodKeywords.push(mood);
    }
  }

  // Platform hints
  const platformHints: PlatformHint[] = [];
  if (lowerPrompt.includes('ios') || lowerPrompt.includes('iphone') || lowerPrompt.includes('apple')) {
    platformHints.push({ platform: 'ios', explicit: true });
  }
  if (lowerPrompt.includes('material') || lowerPrompt.includes('android') || lowerPrompt.includes('google')) {
    platformHints.push({ platform: 'material', explicit: true });
  }
  if (lowerPrompt.includes('fluent') || lowerPrompt.includes('microsoft') || lowerPrompt.includes('windows')) {
    platformHints.push({ platform: 'fluent', explicit: true });
  }

  return {
    colors,
    fonts,
    inspirationUrls,
    moodKeywords,
    platformHints,
    styleKeywords: moodKeywords, // Overlap for now
    avoidKeywords: [],
  };
}
