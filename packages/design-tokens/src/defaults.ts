/**
 * Default Design Tokens
 *
 * Provides sensible defaults for all design tokens.
 * Based on modern design system conventions (Tailwind-inspired).
 *
 * SECURITY:
 * - All color values use validated hex format
 * - No user input - static defaults only
 */

import type {
  DesignTokens,
  ColorScale,
  SemanticColors,
  TypographyTokens,
  SpacingScale,
  BorderRadius,
  BorderWidth,
  BoxShadow,
  Duration,
  Easing,
  Breakpoints,
  ZIndex,
} from './schema.js';

// ============================================================================
// Color Generation Helpers
// ============================================================================

/**
 * Adjust lightness of a hex color
 * @param hex - Base hex color (e.g., #3b82f6)
 * @param factor - Lightness factor (0-1, where 1 = white)
 */
function adjustLightness(hex: string, factor: number): string {
  // Remove # and parse
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);

  // Lighten (move toward white)
  if (factor > 0.5) {
    const adjust = (c: number) =>
      Math.min(255, Math.round(c + (255 - c) * (factor - 0.5) * 2));
    return `#${adjust(r).toString(16).padStart(2, '0')}${adjust(g).toString(16).padStart(2, '0')}${adjust(b).toString(16).padStart(2, '0')}`;
  }

  // Darken (move toward black)
  const darken = (c: number) => Math.max(0, Math.round(c * factor * 2));
  return `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`;
}

/**
 * Generate a color scale from a base color (500)
 */
function generateColorScale(base: string): ColorScale {
  return {
    50: adjustLightness(base, 0.95),
    100: adjustLightness(base, 0.9),
    200: adjustLightness(base, 0.8),
    300: adjustLightness(base, 0.7),
    400: adjustLightness(base, 0.6),
    500: base,
    600: adjustLightness(base, 0.4),
    700: adjustLightness(base, 0.3),
    800: adjustLightness(base, 0.2),
    900: adjustLightness(base, 0.1),
  };
}

// ============================================================================
// Predefined Color Scales
// ============================================================================

/**
 * Blue color scale (primary)
 */
const BLUE_SCALE: ColorScale = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
};

/**
 * Indigo color scale (secondary)
 */
const INDIGO_SCALE: ColorScale = {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
};

/**
 * Violet color scale (accent)
 */
const VIOLET_SCALE: ColorScale = {
  50: '#f5f3ff',
  100: '#ede9fe',
  200: '#ddd6fe',
  300: '#c4b5fd',
  400: '#a78bfa',
  500: '#8b5cf6',
  600: '#7c3aed',
  700: '#6d28d9',
  800: '#5b21b6',
  900: '#4c1d95',
};

/**
 * Green color scale (success)
 */
const GREEN_SCALE: ColorScale = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
};

/**
 * Amber color scale (warning)
 */
const AMBER_SCALE: ColorScale = {
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
};

/**
 * Red color scale (error)
 */
const RED_SCALE: ColorScale = {
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
  800: '#991b1b',
  900: '#7f1d1d',
};

/**
 * Cyan color scale (info)
 */
const CYAN_SCALE: ColorScale = {
  50: '#ecfeff',
  100: '#cffafe',
  200: '#a5f3fc',
  300: '#67e8f9',
  400: '#22d3ee',
  500: '#06b6d4',
  600: '#0891b2',
  700: '#0e7490',
  800: '#155e75',
  900: '#164e63',
};

/**
 * Gray color scale (neutral)
 */
const GRAY_SCALE: ColorScale = {
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
};

// ============================================================================
// Light Theme Colors
// ============================================================================

/**
 * Default light theme colors
 */
export const DEFAULT_LIGHT_COLORS: SemanticColors = {
  primary: BLUE_SCALE,
  secondary: INDIGO_SCALE,
  accent: VIOLET_SCALE,
  success: GREEN_SCALE,
  warning: AMBER_SCALE,
  error: RED_SCALE,
  info: CYAN_SCALE,
  neutral: GRAY_SCALE,

  background: {
    default: '#ffffff',
    subtle: '#f9fafb',
    muted: '#f3f4f6',
  },

  surface: {
    default: '#ffffff',
    raised: '#ffffff',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  text: {
    default: '#111827',
    muted: '#6b7280',
    subtle: '#9ca3af',
    inverse: '#ffffff',
    link: '#3b82f6',
    linkHover: '#2563eb',
  },

  border: {
    default: '#e5e7eb',
    muted: '#f3f4f6',
    focus: '#3b82f6',
  },
};

// ============================================================================
// Dark Theme Colors
// ============================================================================

/**
 * Dark versions of color scales (lighter base)
 */
const DARK_BLUE_SCALE: ColorScale = {
  50: '#172554',
  100: '#1e3a8a',
  200: '#1e40af',
  300: '#1d4ed8',
  400: '#2563eb',
  500: '#3b82f6',
  600: '#60a5fa',
  700: '#93c5fd',
  800: '#bfdbfe',
  900: '#dbeafe',
};

const DARK_INDIGO_SCALE: ColorScale = {
  50: '#1e1b4b',
  100: '#312e81',
  200: '#3730a3',
  300: '#4338ca',
  400: '#4f46e5',
  500: '#6366f1',
  600: '#818cf8',
  700: '#a5b4fc',
  800: '#c7d2fe',
  900: '#e0e7ff',
};

const DARK_VIOLET_SCALE: ColorScale = {
  50: '#2e1065',
  100: '#4c1d95',
  200: '#5b21b6',
  300: '#6d28d9',
  400: '#7c3aed',
  500: '#8b5cf6',
  600: '#a78bfa',
  700: '#c4b5fd',
  800: '#ddd6fe',
  900: '#ede9fe',
};

const DARK_GREEN_SCALE: ColorScale = {
  50: '#052e16',
  100: '#14532d',
  200: '#166534',
  300: '#15803d',
  400: '#16a34a',
  500: '#22c55e',
  600: '#4ade80',
  700: '#86efac',
  800: '#bbf7d0',
  900: '#dcfce7',
};

const DARK_AMBER_SCALE: ColorScale = {
  50: '#451a03',
  100: '#78350f',
  200: '#92400e',
  300: '#b45309',
  400: '#d97706',
  500: '#f59e0b',
  600: '#fbbf24',
  700: '#fcd34d',
  800: '#fde68a',
  900: '#fef3c7',
};

const DARK_RED_SCALE: ColorScale = {
  50: '#450a0a',
  100: '#7f1d1d',
  200: '#991b1b',
  300: '#b91c1c',
  400: '#dc2626',
  500: '#ef4444',
  600: '#f87171',
  700: '#fca5a5',
  800: '#fecaca',
  900: '#fee2e2',
};

const DARK_CYAN_SCALE: ColorScale = {
  50: '#083344',
  100: '#164e63',
  200: '#155e75',
  300: '#0e7490',
  400: '#0891b2',
  500: '#06b6d4',
  600: '#22d3ee',
  700: '#67e8f9',
  800: '#a5f3fc',
  900: '#cffafe',
};

const DARK_GRAY_SCALE: ColorScale = {
  50: '#030712',
  100: '#111827',
  200: '#1f2937',
  300: '#374151',
  400: '#4b5563',
  500: '#6b7280',
  600: '#9ca3af',
  700: '#d1d5db',
  800: '#e5e7eb',
  900: '#f3f4f6',
};

/**
 * Default dark theme colors
 */
export const DEFAULT_DARK_COLORS: SemanticColors = {
  primary: DARK_BLUE_SCALE,
  secondary: DARK_INDIGO_SCALE,
  accent: DARK_VIOLET_SCALE,
  success: DARK_GREEN_SCALE,
  warning: DARK_AMBER_SCALE,
  error: DARK_RED_SCALE,
  info: DARK_CYAN_SCALE,
  neutral: DARK_GRAY_SCALE,

  background: {
    default: '#111827',
    subtle: '#1f2937',
    muted: '#374151',
  },

  surface: {
    default: '#1f2937',
    raised: '#374151',
    overlay: 'rgba(0, 0, 0, 0.75)',
  },

  text: {
    default: '#f9fafb',
    muted: '#9ca3af',
    subtle: '#6b7280',
    inverse: '#111827',
    link: '#60a5fa',
    linkHover: '#93c5fd',
  },

  border: {
    default: '#374151',
    muted: '#1f2937',
    focus: '#60a5fa',
  },
};

// ============================================================================
// Typography Defaults
// ============================================================================

/**
 * Default typography tokens
 */
export const DEFAULT_TYPOGRAPHY: TypographyTokens = {
  fontFamily: {
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    heading: undefined,
    serif: undefined,
  },

  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '3.75rem',
  },

  fontWeight: {
    thin: 100,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
};

// ============================================================================
// Spacing Defaults
// ============================================================================

/**
 * Default spacing scale (based on 4px)
 */
export const DEFAULT_SPACING: SpacingScale = {
  '0': '0',
  px: '1px',
  '0.5': '0.125rem',
  '1': '0.25rem',
  '1.5': '0.375rem',
  '2': '0.5rem',
  '2.5': '0.625rem',
  '3': '0.75rem',
  '3.5': '0.875rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '7': '1.75rem',
  '8': '2rem',
  '9': '2.25rem',
  '10': '2.5rem',
  '11': '2.75rem',
  '12': '3rem',
  '14': '3.5rem',
  '16': '4rem',
  '20': '5rem',
  '24': '6rem',
  '28': '7rem',
  '32': '8rem',
  '36': '9rem',
  '40': '10rem',
  '44': '11rem',
  '48': '12rem',
  '52': '13rem',
  '56': '14rem',
  '60': '15rem',
  '64': '16rem',
  '72': '18rem',
  '80': '20rem',
  '96': '24rem',
};

// ============================================================================
// Border Defaults
// ============================================================================

/**
 * Default border radius
 */
export const DEFAULT_BORDER_RADIUS: BorderRadius = {
  none: '0',
  sm: '0.125rem',
  default: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
  full: '9999px',
};

/**
 * Default border width
 */
export const DEFAULT_BORDER_WIDTH: BorderWidth = {
  '0': '0',
  default: '1px',
  '2': '2px',
  '4': '4px',
  '8': '8px',
};

// ============================================================================
// Shadow Defaults
// ============================================================================

/**
 * Default box shadow
 */
export const DEFAULT_BOX_SHADOW: BoxShadow = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  default: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
};

// ============================================================================
// Animation Defaults
// ============================================================================

/**
 * Default durations
 */
export const DEFAULT_DURATION: Duration = {
  '0': '0ms',
  '75': '75ms',
  '100': '100ms',
  '150': '150ms',
  '200': '200ms',
  '300': '300ms',
  '500': '500ms',
  '700': '700ms',
  '1000': '1000ms',
};

/**
 * Default easing functions
 */
export const DEFAULT_EASING: Easing = {
  linear: 'linear',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
};

// ============================================================================
// Breakpoint Defaults
// ============================================================================

/**
 * Default breakpoints
 */
export const DEFAULT_BREAKPOINTS: Breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// ============================================================================
// Z-Index Defaults
// ============================================================================

/**
 * Default z-index scale
 */
export const DEFAULT_ZINDEX: ZIndex = {
  auto: 'auto',
  '0': 0,
  '10': 10,
  '20': 20,
  '30': 30,
  '40': 40,
  '50': 50,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modal: 1040,
  popover: 1050,
  tooltip: 1060,
};

// ============================================================================
// Complete Default Tokens
// ============================================================================

/**
 * Complete default design tokens (light theme)
 */
export const DEFAULT_TOKENS: DesignTokens = {
  name: 'default',
  version: '1.0.0',
  colors: DEFAULT_LIGHT_COLORS,
  typography: DEFAULT_TYPOGRAPHY,
  spacing: DEFAULT_SPACING,
  borderRadius: DEFAULT_BORDER_RADIUS,
  borderWidth: DEFAULT_BORDER_WIDTH,
  boxShadow: DEFAULT_BOX_SHADOW,
  duration: DEFAULT_DURATION,
  easing: DEFAULT_EASING,
  breakpoints: DEFAULT_BREAKPOINTS,
  zIndex: DEFAULT_ZINDEX,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate color scale from base color
 */
export { generateColorScale };

/**
 * Create custom tokens by merging with defaults
 */
export function createTokens(overrides: Partial<DesignTokens>): DesignTokens {
  return {
    ...DEFAULT_TOKENS,
    ...overrides,
    colors: overrides.colors
      ? { ...DEFAULT_TOKENS.colors, ...overrides.colors }
      : DEFAULT_TOKENS.colors,
    typography: overrides.typography
      ? { ...DEFAULT_TOKENS.typography, ...overrides.typography }
      : DEFAULT_TOKENS.typography,
  };
}
