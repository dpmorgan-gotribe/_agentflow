/**
 * Design Token Schema
 *
 * Defines the structure for all design tokens used in the system.
 * Based on the Design Tokens Community Group specification.
 *
 * SECURITY:
 * - Color value validation prevents XSS via malformed values
 * - String length limits prevent payload abuse
 * - Strict regex patterns for safe CSS generation
 */

import { z } from 'zod';

// ============================================================================
// Color Tokens
// ============================================================================

/**
 * Color value regex - validates hex, rgb, rgba, hsl, hsla formats
 * SECURITY: Prevents injection via malformed color strings
 */
const COLOR_VALUE_REGEX = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+)?\s*\)|hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*(,\s*[\d.]+)?\s*\))$/;

/**
 * Color value - supports hex, rgb, rgba, hsl, hsla
 */
export const ColorValueSchema = z
  .string()
  .min(3)
  .max(100)
  .refine((val) => COLOR_VALUE_REGEX.test(val), {
    message: 'Invalid color format. Use hex (#fff), rgb(), rgba(), hsl(), or hsla()',
  });

export type ColorValue = z.infer<typeof ColorValueSchema>;

/**
 * Color scale - numbered variants from 50-900
 */
export const ColorScaleSchema = z.object({
  50: ColorValueSchema,
  100: ColorValueSchema,
  200: ColorValueSchema,
  300: ColorValueSchema,
  400: ColorValueSchema,
  500: ColorValueSchema,
  600: ColorValueSchema,
  700: ColorValueSchema,
  800: ColorValueSchema,
  900: ColorValueSchema,
});

export type ColorScale = z.infer<typeof ColorScaleSchema>;

/**
 * Semantic color tokens
 */
export const SemanticColorsSchema = z.object({
  // Brand colors
  primary: ColorScaleSchema,
  secondary: ColorScaleSchema,
  accent: ColorScaleSchema,

  // Feedback colors
  success: ColorScaleSchema,
  warning: ColorScaleSchema,
  error: ColorScaleSchema,
  info: ColorScaleSchema,

  // Neutral colors
  neutral: ColorScaleSchema,

  // Surface colors
  background: z.object({
    default: ColorValueSchema,
    subtle: ColorValueSchema,
    muted: ColorValueSchema,
  }),
  surface: z.object({
    default: ColorValueSchema,
    raised: ColorValueSchema,
    overlay: z.string().max(100), // Allow rgba for overlay
  }),

  // Text colors
  text: z.object({
    default: ColorValueSchema,
    muted: ColorValueSchema,
    subtle: ColorValueSchema,
    inverse: ColorValueSchema,
    link: ColorValueSchema,
    linkHover: ColorValueSchema,
  }),

  // Border colors
  border: z.object({
    default: ColorValueSchema,
    muted: ColorValueSchema,
    focus: ColorValueSchema,
  }),
});

export type SemanticColors = z.infer<typeof SemanticColorsSchema>;

// ============================================================================
// Typography Tokens
// ============================================================================

/**
 * Font family token
 */
export const FontFamilySchema = z.object({
  sans: z.string().min(1).max(500),
  serif: z.string().max(500).optional(),
  mono: z.string().min(1).max(500),
  heading: z.string().max(500).optional(),
});

export type FontFamily = z.infer<typeof FontFamilySchema>;

/**
 * Font size scale
 */
export const FontSizeSchema = z.object({
  xs: z.string().max(20),
  sm: z.string().max(20),
  base: z.string().max(20),
  lg: z.string().max(20),
  xl: z.string().max(20),
  '2xl': z.string().max(20),
  '3xl': z.string().max(20),
  '4xl': z.string().max(20),
  '5xl': z.string().max(20),
  '6xl': z.string().max(20),
});

export type FontSize = z.infer<typeof FontSizeSchema>;

/**
 * Font weight scale
 */
export const FontWeightSchema = z.object({
  thin: z.number().int().min(100).max(900),
  light: z.number().int().min(100).max(900),
  normal: z.number().int().min(100).max(900),
  medium: z.number().int().min(100).max(900),
  semibold: z.number().int().min(100).max(900),
  bold: z.number().int().min(100).max(900),
  extrabold: z.number().int().min(100).max(900),
});

export type FontWeight = z.infer<typeof FontWeightSchema>;

/**
 * Line height scale
 */
export const LineHeightSchema = z.object({
  none: z.number().min(0).max(5),
  tight: z.number().min(0).max(5),
  snug: z.number().min(0).max(5),
  normal: z.number().min(0).max(5),
  relaxed: z.number().min(0).max(5),
  loose: z.number().min(0).max(5),
});

export type LineHeight = z.infer<typeof LineHeightSchema>;

/**
 * Letter spacing scale
 */
export const LetterSpacingSchema = z.object({
  tighter: z.string().max(20),
  tight: z.string().max(20),
  normal: z.string().max(20),
  wide: z.string().max(20),
  wider: z.string().max(20),
  widest: z.string().max(20),
});

export type LetterSpacing = z.infer<typeof LetterSpacingSchema>;

/**
 * Complete typography tokens
 */
export const TypographyTokensSchema = z.object({
  fontFamily: FontFamilySchema,
  fontSize: FontSizeSchema,
  fontWeight: FontWeightSchema,
  lineHeight: LineHeightSchema,
  letterSpacing: LetterSpacingSchema,
});

export type TypographyTokens = z.infer<typeof TypographyTokensSchema>;

// ============================================================================
// Spacing Tokens
// ============================================================================

/**
 * Spacing scale - keys as strings for numeric-like values
 */
export const SpacingScaleSchema = z.object({
  '0': z.string().max(20),
  px: z.string().max(20),
  '0.5': z.string().max(20),
  '1': z.string().max(20),
  '1.5': z.string().max(20),
  '2': z.string().max(20),
  '2.5': z.string().max(20),
  '3': z.string().max(20),
  '3.5': z.string().max(20),
  '4': z.string().max(20),
  '5': z.string().max(20),
  '6': z.string().max(20),
  '7': z.string().max(20),
  '8': z.string().max(20),
  '9': z.string().max(20),
  '10': z.string().max(20),
  '11': z.string().max(20),
  '12': z.string().max(20),
  '14': z.string().max(20),
  '16': z.string().max(20),
  '20': z.string().max(20),
  '24': z.string().max(20),
  '28': z.string().max(20),
  '32': z.string().max(20),
  '36': z.string().max(20),
  '40': z.string().max(20),
  '44': z.string().max(20),
  '48': z.string().max(20),
  '52': z.string().max(20),
  '56': z.string().max(20),
  '60': z.string().max(20),
  '64': z.string().max(20),
  '72': z.string().max(20),
  '80': z.string().max(20),
  '96': z.string().max(20),
});

export type SpacingScale = z.infer<typeof SpacingScaleSchema>;

// ============================================================================
// Border Tokens
// ============================================================================

/**
 * Border radius scale
 */
export const BorderRadiusSchema = z.object({
  none: z.string().max(20),
  sm: z.string().max(20),
  default: z.string().max(20),
  md: z.string().max(20),
  lg: z.string().max(20),
  xl: z.string().max(20),
  '2xl': z.string().max(20),
  '3xl': z.string().max(20),
  full: z.string().max(20),
});

export type BorderRadius = z.infer<typeof BorderRadiusSchema>;

/**
 * Border width scale
 */
export const BorderWidthSchema = z.object({
  '0': z.string().max(20),
  default: z.string().max(20),
  '2': z.string().max(20),
  '4': z.string().max(20),
  '8': z.string().max(20),
});

export type BorderWidth = z.infer<typeof BorderWidthSchema>;

// ============================================================================
// Shadow Tokens
// ============================================================================

/**
 * Box shadow scale
 */
export const BoxShadowSchema = z.object({
  none: z.string().max(200),
  sm: z.string().max(200),
  default: z.string().max(200),
  md: z.string().max(200),
  lg: z.string().max(200),
  xl: z.string().max(200),
  '2xl': z.string().max(200),
  inner: z.string().max(200),
});

export type BoxShadow = z.infer<typeof BoxShadowSchema>;

// ============================================================================
// Animation Tokens
// ============================================================================

/**
 * Duration scale
 */
export const DurationSchema = z.object({
  '0': z.string().max(20),
  '75': z.string().max(20),
  '100': z.string().max(20),
  '150': z.string().max(20),
  '200': z.string().max(20),
  '300': z.string().max(20),
  '500': z.string().max(20),
  '700': z.string().max(20),
  '1000': z.string().max(20),
});

export type Duration = z.infer<typeof DurationSchema>;

/**
 * Easing functions
 */
export const EasingSchema = z.object({
  linear: z.string().max(100),
  in: z.string().max(100),
  out: z.string().max(100),
  inOut: z.string().max(100),
});

export type Easing = z.infer<typeof EasingSchema>;

// ============================================================================
// Breakpoint Tokens
// ============================================================================

/**
 * Responsive breakpoints
 */
export const BreakpointsSchema = z.object({
  sm: z.string().max(20),
  md: z.string().max(20),
  lg: z.string().max(20),
  xl: z.string().max(20),
  '2xl': z.string().max(20),
});

export type Breakpoints = z.infer<typeof BreakpointsSchema>;

// ============================================================================
// Z-Index Tokens
// ============================================================================

/**
 * Z-index scale
 */
export const ZIndexSchema = z.object({
  auto: z.literal('auto'),
  '0': z.number().int(),
  '10': z.number().int(),
  '20': z.number().int(),
  '30': z.number().int(),
  '40': z.number().int(),
  '50': z.number().int(),
  dropdown: z.number().int(),
  sticky: z.number().int(),
  fixed: z.number().int(),
  modal: z.number().int(),
  popover: z.number().int(),
  tooltip: z.number().int(),
});

export type ZIndex = z.infer<typeof ZIndexSchema>;

// ============================================================================
// Complete Design Tokens
// ============================================================================

/**
 * Complete design token set
 */
export const DesignTokensSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().max(20).regex(/^\d+\.\d+\.\d+$/, {
    message: 'Version must be in semver format',
  }),
  colors: SemanticColorsSchema,
  typography: TypographyTokensSchema,
  spacing: SpacingScaleSchema,
  borderRadius: BorderRadiusSchema,
  borderWidth: BorderWidthSchema,
  boxShadow: BoxShadowSchema,
  duration: DurationSchema,
  easing: EasingSchema,
  breakpoints: BreakpointsSchema,
  zIndex: ZIndexSchema,
});

export type DesignTokens = z.infer<typeof DesignTokensSchema>;

/**
 * Theme mode
 */
export const ThemeModeSchema = z.enum(['light', 'dark', 'auto']);
export type ThemeMode = z.infer<typeof ThemeModeSchema>;

/**
 * Theme tokens (subset that changes between themes)
 */
export interface ThemeTokens {
  colors: SemanticColors;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate a complete token set
 */
export function validateTokens(data: unknown): DesignTokens {
  return DesignTokensSchema.parse(data);
}

/**
 * Safe parse tokens
 */
export function safeParseTokens(
  data: unknown
): { success: true; data: DesignTokens } | { success: false; error: z.ZodError } {
  const result = DesignTokensSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validate a color value
 */
export function isValidColor(value: string): boolean {
  return ColorValueSchema.safeParse(value).success;
}

/**
 * Validate a color scale
 */
export function isValidColorScale(scale: unknown): scale is ColorScale {
  return ColorScaleSchema.safeParse(scale).success;
}
