/**
 * @aigentflow/design-tokens
 *
 * Comprehensive design token system with CSS generation and theme management.
 * Based on the Design Tokens Community Group specification.
 *
 * Features:
 * - Complete token schema with Zod validation
 * - Light and dark theme defaults (Tailwind-inspired)
 * - CSS variable generation with prefix support
 * - Theme management with system preference detection
 * - Minification and utility class generation
 *
 * @packageDocumentation
 */

// Version
export const DESIGN_TOKENS_VERSION = '1.0.0';

// ============================================================================
// Schema Exports
// ============================================================================

export {
  // Color schemas
  ColorValueSchema,
  ColorScaleSchema,
  SemanticColorsSchema,
  type ColorValue,
  type ColorScale,
  type SemanticColors,
  // Typography schemas
  FontFamilySchema,
  FontSizeSchema,
  FontWeightSchema,
  LineHeightSchema,
  LetterSpacingSchema,
  TypographyTokensSchema,
  type FontFamily,
  type FontSize,
  type FontWeight,
  type LineHeight,
  type LetterSpacing,
  type TypographyTokens,
  // Spacing schema
  SpacingScaleSchema,
  type SpacingScale,
  // Border schemas
  BorderRadiusSchema,
  BorderWidthSchema,
  type BorderRadius,
  type BorderWidth,
  // Shadow schema
  BoxShadowSchema,
  type BoxShadow,
  // Animation schemas
  DurationSchema,
  EasingSchema,
  type Duration,
  type Easing,
  // Breakpoint schema
  BreakpointsSchema,
  type Breakpoints,
  // Z-Index schema
  ZIndexSchema,
  type ZIndex,
  // Complete token set
  DesignTokensSchema,
  type DesignTokens,
  // Theme mode
  ThemeModeSchema,
  type ThemeMode,
  type ThemeTokens,
  // Validation helpers
  validateTokens,
  safeParseTokens,
  isValidColor,
  isValidColorScale,
} from './schema.js';

// ============================================================================
// Default Exports
// ============================================================================

export {
  // Light theme
  DEFAULT_LIGHT_COLORS,
  // Dark theme
  DEFAULT_DARK_COLORS,
  // Typography
  DEFAULT_TYPOGRAPHY,
  // Spacing
  DEFAULT_SPACING,
  // Border
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  // Shadow
  DEFAULT_BOX_SHADOW,
  // Animation
  DEFAULT_DURATION,
  DEFAULT_EASING,
  // Breakpoints
  DEFAULT_BREAKPOINTS,
  // Z-Index
  DEFAULT_ZINDEX,
  // Complete defaults
  DEFAULT_TOKENS,
  // Helpers
  generateColorScale,
  createTokens,
} from './defaults.js';

// ============================================================================
// Generator Exports
// ============================================================================

export {
  CSSGenerator,
  createGenerator,
  generateDefaultCSS,
  type GeneratorOptions,
} from './generator.js';

// ============================================================================
// Theme Exports
// ============================================================================

export {
  ThemeManager,
  getThemeManager,
  resetThemeManager,
  type ThemeConfig,
  type ThemeChangeEvent,
  type ThemeChangeListener,
} from './theme.js';
