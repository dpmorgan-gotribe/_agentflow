/**
 * Design Spec Builder
 *
 * Generates design specifications for consistent styling across outputs.
 * The design spec is injected into every UI prompt to ensure
 * kitchen sink and screen mockups match the approved design.
 *
 * Security features:
 * - Content escaping for CSS
 * - Length limits on generated content
 */

import {
  DesignOption,
  DesignSpec,
  DesignComponent,
  ExtractedTokens,
  DesignMood,
} from './types.js';
import { extractCssClasses } from './token-extraction.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Mood descriptions for design instructions
 */
const MOOD_DESCRIPTIONS: Record<DesignMood, string> = {
  minimalist: 'Clean, focused, generous whitespace, subtle interactions',
  bold: 'Strong colors, prominent elements, high contrast, impactful',
  elegant: 'Refined, sophisticated, subtle gradients, fine details',
  playful: 'Vibrant colors, rounded shapes, fun animations, friendly',
  corporate: 'Professional, trustworthy, structured layouts, muted colors',
  modern: 'Contemporary aesthetics, flat design, clean typography',
  classic: 'Timeless design, traditional elements, serif fonts',
  futuristic: 'Cutting-edge, gradients, glass morphism, tech-forward',
};

/**
 * CSS property escaping patterns
 */
const CSS_UNSAFE_CHARS = /[<>'"&;{}()]/g;

// ============================================================================
// CSS Variable Generation
// ============================================================================

/**
 * Escape value for CSS
 */
function escapeCssValue(value: string): string {
  return value.replace(CSS_UNSAFE_CHARS, '');
}

/**
 * Generate CSS variables from design tokens
 */
export function generateCssVariables(tokens: ExtractedTokens, palette?: string[]): string {
  const colors = tokens.colors;
  const typography = tokens.typography;
  const spacing = tokens.spacing;

  const lines: string[] = [':root {', '  /* Colors - USE THESE EXACT VALUES */'];

  // Color variables
  lines.push(`  --color-primary: ${escapeCssValue(colors.primary)};`);
  lines.push(`  --color-secondary: ${escapeCssValue(colors.secondary)};`);
  lines.push(`  --color-accent: ${escapeCssValue(colors.accent)};`);
  lines.push(`  --color-background: ${escapeCssValue(colors.background)};`);
  lines.push(`  --color-surface: ${escapeCssValue(colors.surface)};`);
  lines.push(`  --color-text: ${escapeCssValue(colors.text)};`);

  if (colors.textSecondary) {
    lines.push(`  --color-text-secondary: ${escapeCssValue(colors.textSecondary)};`);
  }
  if (colors.error) {
    lines.push(`  --color-error: ${escapeCssValue(colors.error)};`);
  }
  if (colors.success) {
    lines.push(`  --color-success: ${escapeCssValue(colors.success)};`);
  }
  if (colors.warning) {
    lines.push(`  --color-warning: ${escapeCssValue(colors.warning)};`);
  }

  // Additional palette colors
  if (palette && palette.length > 0) {
    lines.push('');
    lines.push('  /* Additional Palette */');
    palette.slice(0, 10).forEach((color, i) => {
      lines.push(`  --palette-${i + 1}: ${escapeCssValue(color)};`);
    });
  }

  // Typography
  lines.push('');
  lines.push('  /* Typography */');
  lines.push(`  --font-heading: ${escapeCssValue(typography.headingFont)};`);
  lines.push(`  --font-body: ${escapeCssValue(typography.bodyFont)};`);
  if (typography.monoFont) {
    lines.push(`  --font-mono: ${escapeCssValue(typography.monoFont)};`);
  }
  if (typography.baseFontSize) {
    lines.push(`  --font-size-base: ${escapeCssValue(typography.baseFontSize)};`);
  }
  if (typography.lineHeight) {
    lines.push(`  --line-height: ${escapeCssValue(typography.lineHeight)};`);
  }

  // Spacing
  if (spacing) {
    lines.push('');
    lines.push('  /* Spacing */');
    if (spacing.unit) lines.push(`  --spacing-unit: ${escapeCssValue(spacing.unit)};`);
    if (spacing.xs) lines.push(`  --spacing-xs: ${escapeCssValue(spacing.xs)};`);
    if (spacing.sm) lines.push(`  --spacing-sm: ${escapeCssValue(spacing.sm)};`);
    if (spacing.md) lines.push(`  --spacing-md: ${escapeCssValue(spacing.md)};`);
    if (spacing.lg) lines.push(`  --spacing-lg: ${escapeCssValue(spacing.lg)};`);
    if (spacing.xl) lines.push(`  --spacing-xl: ${escapeCssValue(spacing.xl)};`);
  }

  // Border radius
  if (tokens.borderRadius) {
    lines.push('');
    lines.push('  /* Borders */');
    lines.push(`  --border-radius: ${escapeCssValue(tokens.borderRadius)};`);
  }

  // Shadows
  if (tokens.shadows && tokens.shadows.length > 0) {
    lines.push('');
    lines.push('  /* Shadows */');
    tokens.shadows.slice(0, 5).forEach((shadow, i) => {
      lines.push(`  --shadow-${i + 1}: ${escapeCssValue(shadow)};`);
    });
  }

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// Color Instructions
// ============================================================================

/**
 * Generate color usage instructions
 */
export function generateColorInstructions(tokens: ExtractedTokens): string {
  const colors = tokens.colors;

  return `## COLOR USAGE
- **Primary (${colors.primary})**: Main CTAs, headers, active states, primary buttons
- **Secondary (${colors.secondary})**: Secondary actions, accents, hover states
- **Accent (${colors.accent})**: Highlights, badges, notifications, links
- **Background (${colors.background})**: Page background
- **Surface (${colors.surface})**: Cards, modals, elevated surfaces
- **Text (${colors.text})**: Headings, primary text, labels
${colors.textSecondary ? `- **Text Secondary (${colors.textSecondary})**: Descriptions, meta info, placeholders` : ''}
${colors.error ? `- **Error (${colors.error})**: Error states, destructive actions` : ''}
${colors.success ? `- **Success (${colors.success})**: Success states, confirmations` : ''}
${colors.warning ? `- **Warning (${colors.warning})**: Warning states, cautions` : ''}

IMPORTANT: Use var(--color-*) CSS variables, not hardcoded values.`;
}

// ============================================================================
// Typography Instructions
// ============================================================================

/**
 * Generate typography usage instructions
 */
export function generateTypographyInstructions(tokens: ExtractedTokens): string {
  const typography = tokens.typography;

  return `## TYPOGRAPHY
- **Headings**: Use var(--font-heading) = ${typography.headingFont}
- **Body Text**: Use var(--font-body) = ${typography.bodyFont}
${typography.monoFont ? `- **Code/Mono**: Use var(--font-mono) = ${typography.monoFont}` : ''}

Apply font weights:
- Headings: font-weight: 600-700 (semibold to bold)
- Body: font-weight: 400 (normal)
- Emphasis: font-weight: 500-600 (medium to semibold)

Use consistent line-height: ${typography.lineHeight ?? '1.5'}`;
}

// ============================================================================
// Spacing Instructions
// ============================================================================

/**
 * Generate spacing usage instructions
 */
export function generateSpacingInstructions(tokens: ExtractedTokens): string {
  const spacing = tokens.spacing;

  if (!spacing) {
    return `## SPACING
Use consistent spacing scale:
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px

Apply via padding, margin, gap properties.`;
  }

  return `## SPACING
Use the design's spacing scale:
- xs: var(--spacing-xs) = ${spacing.xs}
- sm: var(--spacing-sm) = ${spacing.sm}
- md: var(--spacing-md) = ${spacing.md}
- lg: var(--spacing-lg) = ${spacing.lg}
- xl: var(--spacing-xl) = ${spacing.xl}

IMPORTANT: Use var(--spacing-*) CSS variables for consistency.`;
}

// ============================================================================
// Component Snippets
// ============================================================================

/**
 * Extract component snippets for reuse
 */
export function extractComponentSnippets(
  components: DesignComponent[]
): Record<string, string> {
  const snippets: Record<string, string> = {};

  for (const component of components.slice(0, 20)) {
    // Use component name as key, sanitized
    const key = component.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // Truncate HTML to reasonable size
    snippets[key] = component.html.slice(0, 5000);
  }

  return snippets;
}

// ============================================================================
// Main Design Spec Builder
// ============================================================================

/**
 * Build a complete design specification from a design option
 */
export function buildDesignSpec(design: DesignOption): DesignSpec {
  const tokens = design.tokens ?? {
    colors: {
      primary: design.colorPalette?.[0] ?? '#3B82F6',
      secondary: design.colorPalette?.[1] ?? '#6366F1',
      accent: design.colorPalette?.[2] ?? '#8B5CF6',
      background: '#FFFFFF',
      surface: '#F9FAFB',
      text: '#111827',
    },
    typography: {
      headingFont: 'Inter, sans-serif',
      bodyFont: 'Inter, sans-serif',
    },
  };

  const cssVariables = generateCssVariables(tokens, design.colorPalette);
  const colorInstructions = generateColorInstructions(tokens);
  const typographyInstructions = generateTypographyInstructions(tokens);
  const spacingInstructions = generateSpacingInstructions(tokens);

  const componentSnippets = design.components
    ? extractComponentSnippets(design.components)
    : undefined;

  return {
    designName: design.name,
    mood: design.mood,
    cssVariables,
    colorInstructions,
    typographyInstructions,
    spacingInstructions,
    componentSnippets,
  };
}

// ============================================================================
// Prompt Injection
// ============================================================================

/**
 * Generate full design spec for prompt injection
 */
export function generateDesignSpecPrompt(design: DesignOption): string {
  const spec = buildDesignSpec(design);
  const moodDescription = MOOD_DESCRIPTIONS[spec.mood];

  const lines: string[] = [
    '='.repeat(60),
    '## APPROVED DESIGN SPECIFICATION',
    '='.repeat(60),
    '',
    `**Design**: ${spec.designName}`,
    `**Style**: ${spec.mood} - ${moodDescription}`,
    '',
    '## MANDATORY CSS VARIABLES',
    'Include these in your <style> block:',
    '',
    '```css',
    spec.cssVariables,
    '```',
    '',
    spec.colorInstructions,
    '',
    spec.typographyInstructions,
    '',
    spec.spacingInstructions ?? '',
    '',
    `## DESIGN MOOD: ${spec.mood.toUpperCase()}`,
    moodDescription,
    '',
    'Apply this mood through:',
    '- Border radius (rounded for playful, sharp for corporate)',
    '- Shadows (subtle for minimalist, prominent for bold)',
    '- Spacing (generous for elegant, compact for efficient)',
    '- Animations (subtle for elegant, dynamic for playful)',
    '',
    '='.repeat(60),
    'IMPORTANT: Match the approved design EXACTLY.',
    'Use the CSS variables defined above.',
    '='.repeat(60),
  ];

  // Add component snippets if available
  if (spec.componentSnippets && Object.keys(spec.componentSnippets).length > 0) {
    lines.push('');
    lines.push('## REUSABLE COMPONENT PATTERNS');
    lines.push('Use these patterns from the approved design:');
    lines.push('');

    for (const [name, html] of Object.entries(spec.componentSnippets).slice(0, 10)) {
      lines.push(`### ${name}`);
      lines.push('```html');
      lines.push(html.slice(0, 1000) + (html.length > 1000 ? '...' : ''));
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Kitchen Sink Classes
// ============================================================================

/**
 * Get available CSS classes from kitchen sink HTML
 */
export function getKitchenSinkClasses(kitchenSinkHtml: string): string[] {
  return extractCssClasses(kitchenSinkHtml);
}

/**
 * Generate CSS class documentation
 */
export function generateClassDocumentation(classes: string[]): string {
  const lines: string[] = [
    '## AVAILABLE CSS CLASSES',
    'Use these classes from the kitchen sink:',
    '',
  ];

  // Group classes by prefix
  const groups: Record<string, string[]> = {};

  for (const className of classes) {
    const prefix = className.split('-')[0] ?? 'other';
    if (!groups[prefix]) {
      groups[prefix] = [];
    }
    groups[prefix].push(className);
  }

  for (const [prefix, classNames] of Object.entries(groups)) {
    if (classNames.length > 0) {
      lines.push(`### ${prefix}`);
      lines.push(classNames.slice(0, 20).map((c) => `- \`${c}\``).join('\n'));
      lines.push('');
    }
  }

  return lines.join('\n');
}
