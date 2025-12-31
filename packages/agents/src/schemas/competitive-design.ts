/**
 * Competitive Design Generation Schema
 *
 * Supports parallel design generation where multiple designers (up to 15)
 * create independent mockups for the same requirement. User selects the
 * winning design to proceed with implementation.
 *
 * Key features:
 * - Each designer gets unique style/focus/color assignments
 * - Competition results collected and compared
 * - Winner selection with rationale
 *
 * SECURITY:
 * - Tenant isolation via competition IDs
 * - String length limits
 */

import { z } from 'zod';
import { UIDesignerOutputSchema } from './ui-designer-output.js';

// ============================================================================
// Design Styles
// ============================================================================

/**
 * Design style approaches for variety in competitive designs
 */
export const DesignStyleSchema = z.enum([
  'minimal',
  'modern',
  'classic',
  'bold',
  'playful',
  'corporate',
  'elegant',
  'tech',
  'organic',
  'geometric',
]);

export type DesignStyle = z.infer<typeof DesignStyleSchema>;

/**
 * All design styles as array
 */
export const DESIGN_STYLES = DesignStyleSchema.options;

// ============================================================================
// Design Focus
// ============================================================================

/**
 * Design focus areas for variety
 */
export const DesignFocusSchema = z.enum([
  'usability',
  'aesthetics',
  'accessibility',
  'performance',
  'innovation',
]);

export type DesignFocus = z.infer<typeof DesignFocusSchema>;

/**
 * All design focuses as array
 */
export const DESIGN_FOCUSES = DesignFocusSchema.options;

// ============================================================================
// Color Schemes
// ============================================================================

/**
 * Color scheme approaches for variety
 */
export const ColorSchemeTypeSchema = z.enum([
  'vibrant',
  'muted',
  'monochrome',
  'complementary',
  'analogous',
  'triadic',
  'split-complementary',
  'tetradic',
]);

export type ColorSchemeType = z.infer<typeof ColorSchemeTypeSchema>;

/**
 * All color schemes as array
 */
export const COLOR_SCHEMES = ColorSchemeTypeSchema.options;

// ============================================================================
// Design Variant
// ============================================================================

/**
 * Design variant metadata assigned to each designer
 */
export const DesignVariantSchema = z.object({
  variantId: z.string().min(1).max(100),
  variantNumber: z.number().int().min(1).max(15),
  totalVariants: z.number().int().min(1).max(15),
  designStyle: DesignStyleSchema,
  designFocus: DesignFocusSchema,
  colorScheme: ColorSchemeTypeSchema,
});

export type DesignVariant = z.infer<typeof DesignVariantSchema>;

// ============================================================================
// Design Tradeoff
// ============================================================================

/**
 * Trade-off made during design
 */
export const DesignTradeoffSchema = z.object({
  aspect: z.string().min(1).max(100),
  choice: z.string().min(1).max(200),
  rationale: z.string().max(500),
  alternatives: z.array(z.string().max(200)).optional(),
});

export type DesignTradeoff = z.infer<typeof DesignTradeoffSchema>;

// ============================================================================
// Competition Metadata
// ============================================================================

/**
 * Metadata specific to competitive design output
 */
export const CompetitionMetadataSchema = z.object({
  variant: DesignVariantSchema,
  designRationale: z.string().max(2000),
  keyFeatures: z.array(z.string().max(200)),
  tradeoffs: z.array(DesignTradeoffSchema),
  inspirations: z.array(z.string().max(200)).optional(),
  targetAudience: z.string().max(500).optional(),
});

export type CompetitionMetadata = z.infer<typeof CompetitionMetadataSchema>;

// ============================================================================
// Competitive Design Output
// ============================================================================

/**
 * Extended UI Designer output for competitive designs
 */
export const CompetitiveDesignOutputSchema = UIDesignerOutputSchema.extend({
  competitionMetadata: CompetitionMetadataSchema,
});

export type CompetitiveDesignOutput = z.infer<typeof CompetitiveDesignOutputSchema>;

// ============================================================================
// Competition Submission
// ============================================================================

/**
 * Single design submission in a competition
 */
export const DesignSubmissionSchema = z.object({
  variantId: z.string().min(1).max(100),
  agentId: z.string().min(1).max(100),
  design: CompetitiveDesignOutputSchema,
  submittedAt: z.string().max(50),
  score: z.number().min(0).max(100).optional(),
  selected: z.boolean().default(false),
  feedback: z.string().max(1000).optional(),
});

export type DesignSubmission = z.infer<typeof DesignSubmissionSchema>;

// ============================================================================
// Competition Winner
// ============================================================================

/**
 * Winner selection info
 */
export const CompetitionWinnerSchema = z.object({
  variantId: z.string().min(1).max(100),
  reason: z.string().max(1000),
  selectedBy: z.string().max(100).optional(), // user ID
  selectedAt: z.string().max(50).optional(),
});

export type CompetitionWinner = z.infer<typeof CompetitionWinnerSchema>;

// ============================================================================
// Design Competition Result
// ============================================================================

/**
 * Complete design competition result
 */
export const DesignCompetitionResultSchema = z.object({
  competitionId: z.string().min(1).max(100),
  tenantId: z.string().min(1).max(100).optional(), // For tenant isolation
  requirement: z.string().max(5000),
  startedAt: z.string().max(50),
  completedAt: z.string().max(50).optional(),
  targetDesignerCount: z.number().int().min(1).max(15),
  submissions: z.array(DesignSubmissionSchema),
  winner: CompetitionWinnerSchema.optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
});

export type DesignCompetitionResult = z.infer<typeof DesignCompetitionResultSchema>;

// ============================================================================
// Competition Options
// ============================================================================

/**
 * Options for running a design competition
 */
export const CompetitionOptionsSchema = z.object({
  maxDesigners: z.number().int().min(1).max(15).default(5),
  timeoutMs: z.number().int().min(30000).max(600000).default(300000), // 5 min default
  requireMinimumSubmissions: z.number().int().min(1).max(15).default(3),
  autoSelect: z.boolean().default(false), // Auto-select winner based on scoring
});

export type CompetitionOptions = z.infer<typeof CompetitionOptionsSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate variant assignments for designers
 */
export function generateVariantAssignments(count: number): DesignVariant[] {
  const variants: DesignVariant[] = [];

  for (let i = 0; i < count; i++) {
    const styleIndex = i % DESIGN_STYLES.length;
    const focusIndex = i % DESIGN_FOCUSES.length;
    const schemeIndex = i % COLOR_SCHEMES.length;

    variants.push({
      variantId: `variant-${i + 1}`,
      variantNumber: i + 1,
      totalVariants: count,
      designStyle: DESIGN_STYLES[styleIndex] as DesignStyle,
      designFocus: DESIGN_FOCUSES[focusIndex] as DesignFocus,
      colorScheme: COLOR_SCHEMES[schemeIndex] as ColorSchemeType,
    });
  }

  return variants;
}

/**
 * Get style guidance for a design style
 */
export function getStyleGuidance(style: DesignStyle): string {
  const guidance: Record<DesignStyle, string> = {
    minimal:
      'Use plenty of whitespace. Limit color palette to 2-3 colors. Focus on essential elements only.',
    modern:
      'Use contemporary UI patterns. Include subtle animations/transitions. Clean lines and flat design.',
    classic:
      'Traditional layout patterns. Established typography. Familiar UI conventions.',
    bold: 'Strong visual hierarchy. Large typography. High contrast elements.',
    playful:
      'Creative layouts. Fun color combinations. Engaging micro-interactions.',
    corporate:
      'Professional appearance. Trust-inspiring design. Clear information hierarchy.',
    elegant:
      'Refined aesthetics. Sophisticated color palette. Premium feel.',
    tech: 'Modern tech aesthetic. Data-driven visuals. Technical precision.',
    organic:
      'Natural shapes and curves. Soft colors. Flowing layouts.',
    geometric:
      'Strong geometric shapes. Grid-based layouts. Mathematical precision.',
  };
  return guidance[style];
}

/**
 * Get focus guidance for a design focus
 */
export function getFocusGuidance(focus: DesignFocus): string {
  const guidance: Record<DesignFocus, string> = {
    usability:
      'Prioritize ease of use. Clear call-to-actions. Intuitive navigation.',
    aesthetics:
      'Visual appeal is paramount. Beautiful component styling. Cohesive visual language.',
    accessibility:
      'WCAG AAA compliance. Screen reader optimization. Keyboard navigation.',
    performance:
      'Minimal DOM elements. Efficient layout structure. Fast perceived loading.',
    innovation:
      'Novel UI patterns. Creative interactions. Pushing boundaries.',
  };
  return guidance[focus];
}

/**
 * Get color scheme guidance
 */
export function getColorSchemeGuidance(scheme: ColorSchemeType): string {
  const guidance: Record<ColorSchemeType, string> = {
    vibrant: 'Use bright, energetic colors that grab attention.',
    muted: 'Use soft, subdued colors that are easy on the eyes.',
    monochrome: 'Use variations of a single color for a cohesive look.',
    complementary: 'Use colors opposite on the color wheel for contrast.',
    analogous: 'Use colors adjacent on the color wheel for harmony.',
    triadic: 'Use three evenly spaced colors for balanced variety.',
    'split-complementary':
      'Use a base color with two colors adjacent to its complement.',
    tetradic: 'Use four colors in two complementary pairs.',
  };
  return guidance[scheme];
}

/**
 * Build complete variant instruction for a designer
 */
export function buildVariantInstruction(variant: DesignVariant): string {
  return `You are Designer #${variant.variantNumber} of ${variant.totalVariants} in a competitive design challenge.

Your assigned style: ${variant.designStyle.toUpperCase()}
Your assigned focus: ${variant.designFocus.toUpperCase()}
Your color scheme: ${variant.colorScheme.toUpperCase()}

Design Guidance:
${getStyleGuidance(variant.designStyle)}
${getFocusGuidance(variant.designFocus)}
${getColorSchemeGuidance(variant.colorScheme)}

Remember: Create a UNIQUE design that stands out from other competitors while fulfilling the requirements.`;
}

/**
 * Get successful submissions from a competition
 */
export function getSuccessfulSubmissions(
  competition: DesignCompetitionResult
): DesignSubmission[] {
  return competition.submissions.filter((s) => s.design !== undefined);
}

/**
 * Get winning design from a competition
 */
export function getWinningDesign(
  competition: DesignCompetitionResult
): CompetitiveDesignOutput | undefined {
  if (!competition.winner) return undefined;
  const submission = competition.submissions.find(
    (s) => s.variantId === competition.winner?.variantId
  );
  return submission?.design;
}

/**
 * Calculate competition success rate
 */
export function calculateSuccessRate(
  competition: DesignCompetitionResult
): number {
  const successful = getSuccessfulSubmissions(competition).length;
  return successful / competition.targetDesignerCount;
}

/**
 * Sort submissions by score (descending)
 */
export function sortSubmissionsByScore(
  submissions: DesignSubmission[]
): DesignSubmission[] {
  return [...submissions].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/**
 * Get design by variant number
 */
export function getDesignByVariant(
  competition: DesignCompetitionResult,
  variantNumber: number
): CompetitiveDesignOutput | undefined {
  const submission = competition.submissions.find(
    (s) => s.design.competitionMetadata.variant.variantNumber === variantNumber
  );
  return submission?.design;
}
