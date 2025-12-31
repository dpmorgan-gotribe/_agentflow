/**
 * CSS Generator
 *
 * Generates CSS custom properties from design tokens.
 * Supports themes, component styles, and responsive utilities.
 *
 * SECURITY:
 * - CSS value escaping prevents injection
 * - No user input directly in CSS output
 * - Generated CSS is safe for injection into pages
 */

import type {
  DesignTokens,
  SemanticColors,
  ColorScale,
  ThemeMode,
} from './schema.js';
import {
  DEFAULT_TOKENS,
  DEFAULT_LIGHT_COLORS,
  DEFAULT_DARK_COLORS,
} from './defaults.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Generator options
 */
export interface GeneratorOptions {
  /** CSS variable prefix (default: '') */
  prefix?: string;
  /** Include CSS reset (default: true) */
  includeReset?: boolean;
  /** Include utility classes (default: false) */
  includeUtilities?: boolean;
  /** Minify output (default: false) */
  minify?: boolean;
  /** Theme mode (default: 'auto') */
  theme?: ThemeMode;
}

/**
 * Resolved generator options
 */
type ResolvedOptions = Required<GeneratorOptions>;

// ============================================================================
// CSS Escaping
// ============================================================================

/**
 * Escape CSS value for safe injection
 * SECURITY: Prevents CSS injection attacks
 */
function escapeCSSValue(value: string): string {
  // Remove any potential CSS injection attempts
  return value
    .replace(/[<>'"]/g, '') // Remove HTML-like characters
    .replace(/[\\]/g, '\\\\') // Escape backslashes
    .replace(/\n/g, ' ') // Replace newlines
    .replace(/;/g, '') // Remove semicolons (could break out of value)
    .trim();
}

/**
 * Escape CSS identifier
 */
function escapeCSSIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

// ============================================================================
// CSS Generator
// ============================================================================

/**
 * CSS Generator class
 */
export class CSSGenerator {
  private tokens: DesignTokens;
  private options: ResolvedOptions;

  constructor(
    tokens: DesignTokens = DEFAULT_TOKENS,
    options: GeneratorOptions = {}
  ) {
    this.tokens = tokens;
    this.options = {
      prefix: options.prefix ?? '',
      includeReset: options.includeReset ?? true,
      includeUtilities: options.includeUtilities ?? false,
      minify: options.minify ?? false,
      theme: options.theme ?? 'auto',
    };
  }

  /**
   * Generate complete CSS
   */
  generate(): string {
    const parts: string[] = [];

    // CSS Reset
    if (this.options.includeReset) {
      parts.push(this.generateReset());
    }

    // CSS Variables
    parts.push(this.generateVariables());

    // Theme variants
    if (this.options.theme === 'auto') {
      parts.push(this.generateDarkTheme());
    }

    // Utilities
    if (this.options.includeUtilities) {
      parts.push(this.generateUtilities());
    }

    const css = parts.join('\n\n');
    return this.options.minify ? this.minifyCSS(css) : css;
  }

  /**
   * Generate only CSS variables
   */
  generateVariables(): string {
    const prefix = this.getPrefix();
    const lines: string[] = [':root {'];

    // Colors
    lines.push(...this.generateColorVariables(this.tokens.colors, prefix));

    // Typography
    lines.push(...this.generateTypographyVariables(prefix));

    // Spacing
    lines.push(...this.generateSpacingVariables(prefix));

    // Border
    lines.push(...this.generateBorderVariables(prefix));

    // Shadows
    lines.push(...this.generateShadowVariables(prefix));

    // Animation
    lines.push(...this.generateAnimationVariables(prefix));

    // Breakpoints
    lines.push(...this.generateBreakpointVariables(prefix));

    // Z-Index
    lines.push(...this.generateZIndexVariables(prefix));

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Get CSS variable prefix
   */
  private getPrefix(): string {
    return this.options.prefix ? `${this.options.prefix}-` : '';
  }

  /**
   * Generate color CSS variables
   */
  private generateColorVariables(
    colors: SemanticColors,
    prefix: string
  ): string[] {
    const lines: string[] = ['  /* Colors */'];

    // Color scales
    const scales = [
      'primary',
      'secondary',
      'accent',
      'success',
      'warning',
      'error',
      'info',
      'neutral',
    ] as const;

    for (const scale of scales) {
      const colorScale = colors[scale] as ColorScale;
      for (const [shade, value] of Object.entries(colorScale)) {
        lines.push(
          `  --${prefix}color-${scale}-${shade}: ${escapeCSSValue(value)};`
        );
      }
    }

    // Background colors
    lines.push('  /* Background */');
    for (const [name, value] of Object.entries(colors.background)) {
      lines.push(`  --${prefix}bg-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`);
    }

    // Surface colors
    lines.push('  /* Surface */');
    for (const [name, value] of Object.entries(colors.surface)) {
      lines.push(
        `  --${prefix}surface-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`
      );
    }

    // Text colors
    lines.push('  /* Text */');
    for (const [name, value] of Object.entries(colors.text)) {
      lines.push(`  --${prefix}text-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`);
    }

    // Border colors
    lines.push('  /* Border */');
    for (const [name, value] of Object.entries(colors.border)) {
      lines.push(
        `  --${prefix}border-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`
      );
    }

    return lines;
  }

  /**
   * Generate typography CSS variables
   */
  private generateTypographyVariables(prefix: string): string[] {
    const { typography } = this.tokens;
    const lines: string[] = ['  /* Typography */'];

    // Font families
    for (const [name, value] of Object.entries(typography.fontFamily)) {
      if (value) {
        lines.push(`  --${prefix}font-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`);
      }
    }

    // Font sizes
    for (const [name, value] of Object.entries(typography.fontSize)) {
      lines.push(`  --${prefix}text-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`);
    }

    // Font weights
    for (const [name, value] of Object.entries(typography.fontWeight)) {
      lines.push(`  --${prefix}font-${escapeCSSIdentifier(name)}: ${value};`);
    }

    // Line heights
    for (const [name, value] of Object.entries(typography.lineHeight)) {
      lines.push(`  --${prefix}leading-${escapeCSSIdentifier(name)}: ${value};`);
    }

    // Letter spacing
    for (const [name, value] of Object.entries(typography.letterSpacing)) {
      lines.push(`  --${prefix}tracking-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`);
    }

    return lines;
  }

  /**
   * Generate spacing CSS variables
   */
  private generateSpacingVariables(prefix: string): string[] {
    const lines: string[] = ['  /* Spacing */'];

    for (const [name, value] of Object.entries(this.tokens.spacing)) {
      const varName = name.toString().replace('.', '_');
      lines.push(`  --${prefix}space-${escapeCSSIdentifier(varName)}: ${escapeCSSValue(value)};`);
    }

    return lines;
  }

  /**
   * Generate border CSS variables
   */
  private generateBorderVariables(prefix: string): string[] {
    const lines: string[] = ['  /* Border */'];

    // Border radius
    for (const [name, value] of Object.entries(this.tokens.borderRadius)) {
      lines.push(`  --${prefix}rounded-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`);
    }

    // Border width
    for (const [name, value] of Object.entries(this.tokens.borderWidth)) {
      lines.push(`  --${prefix}border-w-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`);
    }

    return lines;
  }

  /**
   * Generate shadow CSS variables
   */
  private generateShadowVariables(prefix: string): string[] {
    const lines: string[] = ['  /* Shadows */'];

    for (const [name, value] of Object.entries(this.tokens.boxShadow)) {
      lines.push(`  --${prefix}shadow-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`);
    }

    return lines;
  }

  /**
   * Generate animation CSS variables
   */
  private generateAnimationVariables(prefix: string): string[] {
    const lines: string[] = ['  /* Animation */'];

    // Duration
    for (const [name, value] of Object.entries(this.tokens.duration)) {
      lines.push(`  --${prefix}duration-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`);
    }

    // Easing
    for (const [name, value] of Object.entries(this.tokens.easing)) {
      lines.push(`  --${prefix}ease-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`);
    }

    return lines;
  }

  /**
   * Generate breakpoint CSS variables
   */
  private generateBreakpointVariables(prefix: string): string[] {
    const lines: string[] = ['  /* Breakpoints */'];

    for (const [name, value] of Object.entries(this.tokens.breakpoints)) {
      lines.push(`  --${prefix}screen-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`);
    }

    return lines;
  }

  /**
   * Generate z-index CSS variables
   */
  private generateZIndexVariables(prefix: string): string[] {
    const lines: string[] = ['  /* Z-Index */'];

    for (const [name, value] of Object.entries(this.tokens.zIndex)) {
      lines.push(`  --${prefix}z-${escapeCSSIdentifier(name)}: ${value};`);
    }

    return lines;
  }

  /**
   * Generate dark theme CSS
   */
  private generateDarkTheme(): string {
    const prefix = this.getPrefix();
    const darkColors = DEFAULT_DARK_COLORS;

    const lines: string[] = [
      '/* Dark theme via system preference */',
      '@media (prefers-color-scheme: dark) {',
      '  :root {',
    ];

    // Color scales
    const scales = [
      'primary',
      'secondary',
      'accent',
      'success',
      'warning',
      'error',
      'info',
      'neutral',
    ] as const;

    for (const scale of scales) {
      const colorScale = darkColors[scale] as ColorScale;
      for (const [shade, value] of Object.entries(colorScale)) {
        lines.push(
          `    --${prefix}color-${scale}-${shade}: ${escapeCSSValue(value)};`
        );
      }
    }

    // Background colors
    for (const [name, value] of Object.entries(darkColors.background)) {
      lines.push(`    --${prefix}bg-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`);
    }

    // Surface colors
    for (const [name, value] of Object.entries(darkColors.surface)) {
      lines.push(
        `    --${prefix}surface-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`
      );
    }

    // Text colors
    for (const [name, value] of Object.entries(darkColors.text)) {
      lines.push(`    --${prefix}text-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`);
    }

    // Border colors
    for (const [name, value] of Object.entries(darkColors.border)) {
      lines.push(
        `    --${prefix}border-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`
      );
    }

    lines.push('  }');
    lines.push('}');
    lines.push('');

    // Manual dark mode class
    lines.push('/* Dark theme via data attribute */');
    lines.push('[data-theme="dark"] {');

    for (const scale of scales) {
      const colorScale = darkColors[scale] as ColorScale;
      for (const [shade, value] of Object.entries(colorScale)) {
        lines.push(
          `  --${prefix}color-${scale}-${shade}: ${escapeCSSValue(value)};`
        );
      }
    }

    for (const [name, value] of Object.entries(darkColors.background)) {
      lines.push(`  --${prefix}bg-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`);
    }

    for (const [name, value] of Object.entries(darkColors.surface)) {
      lines.push(
        `  --${prefix}surface-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`
      );
    }

    for (const [name, value] of Object.entries(darkColors.text)) {
      lines.push(`  --${prefix}text-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`);
    }

    for (const [name, value] of Object.entries(darkColors.border)) {
      lines.push(
        `  --${prefix}border-${escapeCSSIdentifier(name)}: ${escapeCSSValue(value)};`
      );
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate CSS reset
   */
  private generateReset(): string {
    const prefix = this.getPrefix();

    return `/* CSS Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--${prefix}font-sans);
  font-size: var(--${prefix}text-base);
  line-height: var(--${prefix}leading-normal);
  color: var(--${prefix}text-default);
  background-color: var(--${prefix}bg-default);
}

img, picture, video, canvas, svg {
  display: block;
  max-width: 100%;
}

input, button, textarea, select {
  font: inherit;
}

p, h1, h2, h3, h4, h5, h6 {
  overflow-wrap: break-word;
}

a {
  color: var(--${prefix}text-link);
  text-decoration: none;
}

a:hover {
  color: var(--${prefix}text-linkHover);
  text-decoration: underline;
}

button {
  cursor: pointer;
}

:focus-visible {
  outline: 2px solid var(--${prefix}border-focus);
  outline-offset: 2px;
}`;
  }

  /**
   * Generate utility classes
   */
  private generateUtilities(): string {
    const prefix = this.getPrefix();

    return `/* Utility Classes */

/* Display */
.hidden { display: none; }
.block { display: block; }
.inline { display: inline; }
.inline-block { display: inline-block; }
.flex { display: flex; }
.inline-flex { display: inline-flex; }
.grid { display: grid; }

/* Flex */
.flex-row { flex-direction: row; }
.flex-col { flex-direction: column; }
.flex-wrap { flex-wrap: wrap; }
.items-center { align-items: center; }
.items-start { align-items: flex-start; }
.items-end { align-items: flex-end; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.justify-around { justify-content: space-around; }
.gap-1 { gap: var(--${prefix}space-1); }
.gap-2 { gap: var(--${prefix}space-2); }
.gap-4 { gap: var(--${prefix}space-4); }
.gap-8 { gap: var(--${prefix}space-8); }

/* Spacing */
.p-0 { padding: var(--${prefix}space-0); }
.p-1 { padding: var(--${prefix}space-1); }
.p-2 { padding: var(--${prefix}space-2); }
.p-4 { padding: var(--${prefix}space-4); }
.p-8 { padding: var(--${prefix}space-8); }
.px-4 { padding-left: var(--${prefix}space-4); padding-right: var(--${prefix}space-4); }
.py-2 { padding-top: var(--${prefix}space-2); padding-bottom: var(--${prefix}space-2); }
.m-0 { margin: var(--${prefix}space-0); }
.m-1 { margin: var(--${prefix}space-1); }
.m-2 { margin: var(--${prefix}space-2); }
.m-4 { margin: var(--${prefix}space-4); }
.m-auto { margin: auto; }
.mx-auto { margin-left: auto; margin-right: auto; }

/* Text */
.text-xs { font-size: var(--${prefix}text-xs); }
.text-sm { font-size: var(--${prefix}text-sm); }
.text-base { font-size: var(--${prefix}text-base); }
.text-lg { font-size: var(--${prefix}text-lg); }
.text-xl { font-size: var(--${prefix}text-xl); }
.text-2xl { font-size: var(--${prefix}text-2xl); }
.font-normal { font-weight: var(--${prefix}font-normal); }
.font-medium { font-weight: var(--${prefix}font-medium); }
.font-semibold { font-weight: var(--${prefix}font-semibold); }
.font-bold { font-weight: var(--${prefix}font-bold); }
.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

/* Colors */
.text-primary { color: var(--${prefix}color-primary-500); }
.text-secondary { color: var(--${prefix}color-secondary-500); }
.text-muted { color: var(--${prefix}text-muted); }
.bg-primary { background-color: var(--${prefix}color-primary-500); }
.bg-secondary { background-color: var(--${prefix}color-secondary-500); }
.bg-surface { background-color: var(--${prefix}surface-default); }

/* Border Radius */
.rounded-none { border-radius: var(--${prefix}rounded-none); }
.rounded-sm { border-radius: var(--${prefix}rounded-sm); }
.rounded { border-radius: var(--${prefix}rounded-default); }
.rounded-md { border-radius: var(--${prefix}rounded-md); }
.rounded-lg { border-radius: var(--${prefix}rounded-lg); }
.rounded-xl { border-radius: var(--${prefix}rounded-xl); }
.rounded-full { border-radius: var(--${prefix}rounded-full); }

/* Shadows */
.shadow-none { box-shadow: var(--${prefix}shadow-none); }
.shadow-sm { box-shadow: var(--${prefix}shadow-sm); }
.shadow { box-shadow: var(--${prefix}shadow-default); }
.shadow-md { box-shadow: var(--${prefix}shadow-md); }
.shadow-lg { box-shadow: var(--${prefix}shadow-lg); }
.shadow-xl { box-shadow: var(--${prefix}shadow-xl); }

/* Width/Height */
.w-full { width: 100%; }
.h-full { height: 100%; }
.min-h-screen { min-height: 100vh; }
.max-w-sm { max-width: 24rem; }
.max-w-md { max-width: 28rem; }
.max-w-lg { max-width: 32rem; }
.max-w-xl { max-width: 36rem; }
.max-w-2xl { max-width: 42rem; }

/* Transitions */
.transition { transition: all var(--${prefix}duration-200) var(--${prefix}ease-inOut); }
.transition-colors { transition: color, background-color, border-color var(--${prefix}duration-200) var(--${prefix}ease-inOut); }`;
  }

  /**
   * Simple CSS minification
   */
  private minifyCSS(css: string): string {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*([{}:;,])\s*/g, '$1') // Remove space around special chars
      .replace(/;}/g, '}') // Remove trailing semicolons
      .trim();
  }

  /**
   * Generate JSON export of tokens
   */
  toJSON(): string {
    return JSON.stringify(this.tokens, null, 2);
  }

  /**
   * Get current tokens
   */
  getTokens(): DesignTokens {
    return this.tokens;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a CSS generator with custom tokens
 */
export function createGenerator(
  tokens?: Partial<DesignTokens>,
  options?: GeneratorOptions
): CSSGenerator {
  const mergedTokens: DesignTokens = {
    ...DEFAULT_TOKENS,
    ...tokens,
    colors: tokens?.colors
      ? { ...DEFAULT_TOKENS.colors, ...tokens.colors }
      : DEFAULT_TOKENS.colors,
    typography: tokens?.typography
      ? { ...DEFAULT_TOKENS.typography, ...tokens.typography }
      : DEFAULT_TOKENS.typography,
  };
  return new CSSGenerator(mergedTokens, options);
}

/**
 * Quick generate CSS from default tokens
 */
export function generateDefaultCSS(options?: GeneratorOptions): string {
  const generator = new CSSGenerator(DEFAULT_TOKENS, options);
  return generator.generate();
}
