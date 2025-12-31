/**
 * Token Extraction
 *
 * Extracts design tokens (colors, typography, spacing) from HTML/CSS.
 *
 * Security features:
 * - Input sanitization for regex
 * - Length limits on extracted values
 * - No eval or dynamic code execution
 */

import {
  ExtractedTokens,
  DesignColors,
  DesignTypography,
  DesignSpacing,
  DesignComponent,
  MAX_HTML_LENGTH,
  MAX_CSS_LENGTH,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Common color patterns to extract
 */
const COLOR_PATTERNS = {
  hex: /#([0-9A-Fa-f]{3,8})\b/g,
  rgb: /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/gi,
  rgba: /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)/gi,
  hsl: /hsl\(\s*\d+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*\)/gi,
  cssVar: /var\(--[a-zA-Z0-9_-]+\)/g,
};

/**
 * CSS variable patterns
 */
const CSS_VAR_PATTERNS = {
  colorPrimary: /--(?:color-)?primary\s*:\s*([^;]+)/i,
  colorSecondary: /--(?:color-)?secondary\s*:\s*([^;]+)/i,
  colorAccent: /--(?:color-)?accent\s*:\s*([^;]+)/i,
  colorBackground: /--(?:color-)?(?:bg|background)\s*:\s*([^;]+)/i,
  colorSurface: /--(?:color-)?surface\s*:\s*([^;]+)/i,
  colorText: /--(?:color-)?text\s*:\s*([^;]+)/i,
  fontHeading: /--font-(?:heading|title|display)\s*:\s*([^;]+)/i,
  fontBody: /--font-(?:body|text|base)\s*:\s*([^;]+)/i,
  spacing: /--spacing-(?:base|unit)\s*:\s*([^;]+)/i,
  radius: /--(?:border-)?radius\s*:\s*([^;]+)/i,
};

/**
 * Inline style patterns
 */
const INLINE_PATTERNS = {
  backgroundColor: /background(?:-color)?:\s*([^;'"]+)/gi,
  color: /(?<!background-)color:\s*([^;'"]+)/gi,
  fontFamily: /font-family:\s*([^;'"]+)/gi,
  fontSize: /font-size:\s*([^;'"]+)/gi,
  padding: /padding:\s*([^;'"]+)/gi,
  margin: /margin:\s*([^;'"]+)/gi,
  borderRadius: /border-radius:\s*([^;'"]+)/gi,
  boxShadow: /box-shadow:\s*([^;'"]+)/gi,
};

// ============================================================================
// Color Extraction
// ============================================================================

/**
 * Extract all colors from HTML/CSS content
 */
export function extractColors(content: string): string[] {
  // Validate input length
  if (content.length > MAX_HTML_LENGTH + MAX_CSS_LENGTH) {
    content = content.slice(0, MAX_HTML_LENGTH + MAX_CSS_LENGTH);
  }

  const colors = new Set<string>();

  // Extract hex colors
  const hexMatches = content.match(COLOR_PATTERNS.hex);
  if (hexMatches) {
    for (const match of hexMatches) {
      colors.add(normalizeColor(match));
    }
  }

  // Extract rgb colors
  const rgbMatches = content.match(COLOR_PATTERNS.rgb);
  if (rgbMatches) {
    for (const match of rgbMatches) {
      colors.add(match.toLowerCase());
    }
  }

  // Extract rgba colors
  const rgbaMatches = content.match(COLOR_PATTERNS.rgba);
  if (rgbaMatches) {
    for (const match of rgbaMatches) {
      colors.add(match.toLowerCase());
    }
  }

  // Extract hsl colors
  const hslMatches = content.match(COLOR_PATTERNS.hsl);
  if (hslMatches) {
    for (const match of hslMatches) {
      colors.add(match.toLowerCase());
    }
  }

  return Array.from(colors).slice(0, 50); // Limit to 50 colors
}

/**
 * Normalize color to consistent format
 */
function normalizeColor(color: string): string {
  // Expand 3-digit hex to 6-digit
  if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return color.toLowerCase();
}

/**
 * Categorize colors into semantic roles
 */
export function categorizeColors(colors: string[]): DesignColors {
  // Sort colors by luminance to help categorization
  const sorted = colors.slice().sort((a, b) => getLuminance(a) - getLuminance(b));

  // Find dark and light colors
  const darkColors = sorted.filter((c) => getLuminance(c) < 0.3);
  const lightColors = sorted.filter((c) => getLuminance(c) > 0.7);
  const midColors = sorted.filter((c) => {
    const l = getLuminance(c);
    return l >= 0.3 && l <= 0.7;
  });

  // Heuristic assignment
  return {
    primary: midColors[0] ?? colors[0] ?? '#3B82F6',
    secondary: midColors[1] ?? colors[1] ?? '#6366F1',
    accent: midColors[2] ?? colors[2] ?? '#8B5CF6',
    background: lightColors[0] ?? '#FFFFFF',
    surface: lightColors[1] ?? lightColors[0] ?? '#F9FAFB',
    text: darkColors[0] ?? '#111827',
    textSecondary: darkColors[1] ?? '#6B7280',
  };
}

/**
 * Calculate relative luminance of a color
 */
function getLuminance(color: string): number {
  // Parse hex color
  const hex = color.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return 0.5; // Default for non-hex colors
  }

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  // sRGB luminance formula
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ============================================================================
// Typography Extraction
// ============================================================================

/**
 * Extract typography settings from content
 */
export function extractTypography(content: string): DesignTypography {
  const fonts = new Set<string>();

  // Extract font-family declarations
  const fontMatches = content.match(INLINE_PATTERNS.fontFamily);
  if (fontMatches) {
    for (const match of fontMatches) {
      const fontValue = match.replace(/font-family:\s*/i, '').trim();
      // Extract first font from stack
      const firstFont = fontValue.split(',')[0]?.trim().replace(/['"]/g, '');
      if (firstFont) {
        fonts.add(firstFont);
      }
    }
  }

  // Check for CSS variables
  const headingMatch = content.match(CSS_VAR_PATTERNS.fontHeading);
  const bodyMatch = content.match(CSS_VAR_PATTERNS.fontBody);

  const fontList = Array.from(fonts);

  return {
    headingFont: headingMatch?.[1]?.trim() ?? fontList[0] ?? 'Inter, sans-serif',
    bodyFont: bodyMatch?.[1]?.trim() ?? fontList[1] ?? fontList[0] ?? 'Inter, sans-serif',
    monoFont: 'ui-monospace, monospace',
    baseFontSize: extractFirstMatch(content, /font-size:\s*(\d+px)/i) ?? '16px',
    lineHeight: extractFirstMatch(content, /line-height:\s*([\d.]+)/i) ?? '1.5',
  };
}

/**
 * Extract first match from pattern
 */
function extractFirstMatch(content: string, pattern: RegExp): string | undefined {
  const match = content.match(pattern);
  return match?.[1]?.trim();
}

// ============================================================================
// Spacing Extraction
// ============================================================================

/**
 * Extract spacing values from content
 */
export function extractSpacing(content: string): DesignSpacing {
  // Look for spacing CSS variables
  const spacingMatch = content.match(CSS_VAR_PATTERNS.spacing);

  // Look for common padding/margin values
  const paddingMatches = content.match(INLINE_PATTERNS.padding) ?? [];
  const marginMatches = content.match(INLINE_PATTERNS.margin) ?? [];

  const allSpacing = [...paddingMatches, ...marginMatches];
  const spacingValues = new Set<string>();

  for (const match of allSpacing) {
    const value = match.replace(/(?:padding|margin):\s*/i, '').trim();
    // Extract individual values
    const parts = value.split(/\s+/);
    for (const part of parts) {
      if (/^\d+(?:px|rem|em)$/.test(part)) {
        spacingValues.add(part);
      }
    }
  }

  const sorted = Array.from(spacingValues).sort((a, b) => {
    const aNum = parseFloat(a);
    const bNum = parseFloat(b);
    return aNum - bNum;
  });

  return {
    unit: spacingMatch?.[1]?.trim() ?? '4px',
    xs: sorted[0] ?? '4px',
    sm: sorted[1] ?? '8px',
    md: sorted[2] ?? '16px',
    lg: sorted[3] ?? '24px',
    xl: sorted[4] ?? '32px',
  };
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract all design tokens from HTML content
 */
export function extractDesignTokensFromHtml(html: string, css?: string): ExtractedTokens {
  // Combine HTML and CSS for extraction
  const content = (html + (css ?? '')).slice(0, MAX_HTML_LENGTH + MAX_CSS_LENGTH);

  // Extract colors
  const colors = extractColors(content);
  const categorizedColors = categorizeColors(colors);

  // Extract typography
  const typography = extractTypography(content);

  // Extract spacing
  const spacing = extractSpacing(content);

  // Extract border radius
  const radiusMatch = content.match(CSS_VAR_PATTERNS.radius);
  const inlineRadius = content.match(INLINE_PATTERNS.borderRadius);
  const borderRadius =
    radiusMatch?.[1]?.trim() ??
    inlineRadius?.[0]?.replace(/border-radius:\s*/i, '').trim() ??
    '8px';

  // Extract shadows
  const shadowMatches = content.match(INLINE_PATTERNS.boxShadow) ?? [];
  const shadows = shadowMatches
    .map((m) => m.replace(/box-shadow:\s*/i, '').trim())
    .slice(0, 10);

  return {
    colors: categorizedColors,
    typography,
    spacing,
    borderRadius,
    shadows: shadows.length > 0 ? shadows : undefined,
  };
}

// ============================================================================
// Component Extraction
// ============================================================================

/**
 * Component type patterns to detect
 */
const COMPONENT_PATTERNS: Array<{
  type: DesignComponent['type'];
  patterns: RegExp[];
}> = [
  {
    type: 'button',
    patterns: [
      /<button[^>]*>[\s\S]*?<\/button>/gi,
      /<a[^>]*class="[^"]*btn[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
      /<[^>]*role="button"[^>]*>[\s\S]*?<\/[^>]+>/gi,
    ],
  },
  {
    type: 'card',
    patterns: [
      /<div[^>]*class="[^"]*card[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
      /<article[^>]*>[\s\S]*?<\/article>/gi,
    ],
  },
  {
    type: 'form',
    patterns: [/<form[^>]*>[\s\S]*?<\/form>/gi],
  },
  {
    type: 'input',
    patterns: [
      /<input[^>]*>/gi,
      /<textarea[^>]*>[\s\S]*?<\/textarea>/gi,
      /<select[^>]*>[\s\S]*?<\/select>/gi,
    ],
  },
  {
    type: 'navigation',
    patterns: [/<nav[^>]*>[\s\S]*?<\/nav>/gi],
  },
  {
    type: 'header',
    patterns: [/<header[^>]*>[\s\S]*?<\/header>/gi],
  },
  {
    type: 'footer',
    patterns: [/<footer[^>]*>[\s\S]*?<\/footer>/gi],
  },
  {
    type: 'modal',
    patterns: [
      /<div[^>]*class="[^"]*modal[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
      /<dialog[^>]*>[\s\S]*?<\/dialog>/gi,
    ],
  },
  {
    type: 'alert',
    patterns: [
      /<div[^>]*class="[^"]*alert[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
      /<div[^>]*role="alert"[^>]*>[\s\S]*?<\/div>/gi,
    ],
  },
  {
    type: 'list',
    patterns: [/<ul[^>]*>[\s\S]*?<\/ul>/gi, /<ol[^>]*>[\s\S]*?<\/ol>/gi],
  },
  {
    type: 'table',
    patterns: [/<table[^>]*>[\s\S]*?<\/table>/gi],
  },
];

/**
 * Extract components from design HTML
 */
export function extractComponentsFromDesign(html: string): DesignComponent[] {
  // Validate input length
  if (html.length > MAX_HTML_LENGTH) {
    html = html.slice(0, MAX_HTML_LENGTH);
  }

  const components: DesignComponent[] = [];
  const seen = new Set<string>();

  for (const { type, patterns } of COMPONENT_PATTERNS) {
    for (const pattern of patterns) {
      const matches = html.match(pattern) ?? [];

      for (const match of matches.slice(0, 10)) {
        // Limit per type
        // Create a simple hash to avoid duplicates
        const hash = simpleHash(match);
        if (seen.has(hash)) continue;
        seen.add(hash);

        // Extract classes
        const classMatch = match.match(/class="([^"]+)"/);
        const classes = classMatch?.[1]?.split(/\s+/).filter((c) => c.length > 0);

        // Generate name from type and index
        const typeCount = components.filter((c) => c.type === type).length;
        const name = `${type}-${typeCount + 1}`;

        components.push({
          name,
          type,
          html: match.slice(0, 10000), // Limit individual component size
          classes: classes?.slice(0, 20),
        });

        // Stop if we have enough components
        if (components.length >= 50) {
          return components;
        }
      }
    }
  }

  return components;
}

/**
 * Simple string hash for deduplication
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

// ============================================================================
// CSS Class Extraction
// ============================================================================

/**
 * Extract all CSS classes from HTML
 */
export function extractCssClasses(html: string): string[] {
  const classes = new Set<string>();

  // Match all class attributes
  const classMatches = html.match(/class="([^"]+)"/g) ?? [];

  for (const match of classMatches) {
    const classValue = match.replace(/class="|"/g, '');
    const classNames = classValue.split(/\s+/);

    for (const className of classNames) {
      if (className && className.length > 0 && className.length < 100) {
        classes.add(className);
      }
    }
  }

  return Array.from(classes).slice(0, 500);
}

/**
 * List classes from kitchen sink HTML
 */
export function listKitchenSinkClasses(html: string): string[] {
  return extractCssClasses(html);
}
