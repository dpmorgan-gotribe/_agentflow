/**
 * HTML Generator
 *
 * Pure functions for generating HTML mockups from UI component definitions.
 * No filesystem access - returns strings for CLI layer to save.
 *
 * Features:
 * - Semantic HTML5 generation
 * - Accessibility attributes (ARIA)
 * - Responsive styles via CSS variables
 * - Skip links and focus management
 *
 * SECURITY:
 * - Content sanitization for XSS prevention
 * - Attribute escaping
 */

import type {
  UIComponent,
  MockupPage,
  UIDesignerOutput,
  Style,
  Accessibility,
  ColorPalette,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '../schemas/ui-designer-output.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * HTML tag mapping for component types
 */
const TAG_MAP: Record<string, string> = {
  page: 'div',
  section: 'section',
  header: 'header',
  footer: 'footer',
  navigation: 'nav',
  form: 'form',
  input: 'input',
  button: 'button',
  card: 'article',
  list: 'ul',
  table: 'table',
  modal: 'dialog',
  alert: 'div',
  tabs: 'div',
  accordion: 'div',
  image: 'img',
  text: 'p',
  link: 'a',
  icon: 'span',
  container: 'div',
  grid: 'div',
  flex: 'div',
  divider: 'hr',
  badge: 'span',
  avatar: 'div',
  tooltip: 'div',
  dropdown: 'div',
  checkbox: 'input',
  radio: 'input',
  select: 'select',
  textarea: 'textarea',
  slider: 'input',
  switch: 'input',
  progress: 'progress',
  spinner: 'div',
  skeleton: 'div',
};

/**
 * Self-closing HTML tags
 */
const SELF_CLOSING_TAGS = new Set(['input', 'img', 'hr', 'br']);

// ============================================================================
// Escaping Functions
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape attribute value
 */
export function escapeAttribute(value: string): string {
  return value.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ============================================================================
// Style Helpers
// ============================================================================

/**
 * Convert camelCase to kebab-case
 */
export function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Convert style object to inline CSS string
 */
export function styleObjectToString(styles: Style): string {
  return Object.entries(styles)
    .map(([key, value]) => `${camelToKebab(key)}: ${escapeAttribute(value)}`)
    .join('; ');
}

// ============================================================================
// Accessibility Helpers
// ============================================================================

/**
 * Render accessibility attributes to HTML string
 */
export function renderAccessibility(a11y?: Accessibility): string {
  if (!a11y) return '';

  const attrs: string[] = [];

  if (a11y.role) attrs.push(`role="${escapeAttribute(a11y.role)}"`);
  if (a11y.ariaLabel) attrs.push(`aria-label="${escapeAttribute(a11y.ariaLabel)}"`);
  if (a11y.ariaDescribedBy)
    attrs.push(`aria-describedby="${escapeAttribute(a11y.ariaDescribedBy)}"`);
  if (a11y.ariaLabelledBy)
    attrs.push(`aria-labelledby="${escapeAttribute(a11y.ariaLabelledBy)}"`);
  if (a11y.ariaExpanded !== undefined)
    attrs.push(`aria-expanded="${a11y.ariaExpanded}"`);
  if (a11y.ariaHidden !== undefined)
    attrs.push(`aria-hidden="${a11y.ariaHidden}"`);
  if (a11y.ariaPressed !== undefined)
    attrs.push(`aria-pressed="${a11y.ariaPressed}"`);
  if (a11y.ariaSelected !== undefined)
    attrs.push(`aria-selected="${a11y.ariaSelected}"`);
  if (a11y.ariaDisabled !== undefined)
    attrs.push(`aria-disabled="${a11y.ariaDisabled}"`);
  if (a11y.ariaLive) attrs.push(`aria-live="${escapeAttribute(a11y.ariaLive)}"`);
  if (a11y.tabIndex !== undefined) attrs.push(`tabindex="${a11y.tabIndex}"`);

  return attrs.length > 0 ? ' ' + attrs.join(' ') : '';
}

// ============================================================================
// Component Rendering
// ============================================================================

/**
 * Get HTML tag for component type
 */
export function getHtmlTag(type: string): string {
  return TAG_MAP[type] || 'div';
}

/**
 * Render component attributes to HTML string
 */
export function renderAttributes(
  component: UIComponent,
  additionalAttrs?: Record<string, string>
): string {
  const allAttrs: Record<string, string> = {
    ...component.attributes,
    ...additionalAttrs,
  };

  if (Object.keys(allAttrs).length === 0) return '';

  return Object.entries(allAttrs)
    .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
    .join('');
}

/**
 * Render a single component to HTML
 */
export function renderComponent(
  component: UIComponent,
  depth: number = 0
): string {
  const indent = '  '.repeat(depth);
  const tag = getHtmlTag(component.type);
  const styles = styleObjectToString(component.styles.base);
  const attrs = renderAttributes(component);
  const a11y = renderAccessibility(component.accessibility);

  // Self-closing tags
  if (SELF_CLOSING_TAGS.has(tag)) {
    return `${indent}<${tag} id="${escapeAttribute(component.id)}" style="${styles}"${attrs}${a11y} />`;
  }

  // Tags with children or content
  const children = component.children
    ? component.children.map((c) => renderComponent(c, depth + 1)).join('\n')
    : '';

  const content = component.content ? escapeHtml(component.content) : '';

  if (children) {
    return `${indent}<${tag} id="${escapeAttribute(component.id)}" style="${styles}"${attrs}${a11y}>
${children}
${indent}</${tag}>`;
  }

  return `${indent}<${tag} id="${escapeAttribute(component.id)}" style="${styles}"${attrs}${a11y}>${content}</${tag}>`;
}

// ============================================================================
// CSS Variable Generation
// ============================================================================

/**
 * Generate CSS variables from color palette
 */
export function generateColorVariables(colors: ColorPalette): string[] {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(colors)) {
    if (value) {
      lines.push(`      --color-${camelToKebab(name)}: ${value};`);
    }
  }
  return lines;
}

/**
 * Generate CSS variables from typography
 */
export function generateTypographyVariables(typography: Typography): string[] {
  const lines: string[] = [];

  lines.push(`      --font-family: ${typography.fontFamily};`);
  if (typography.headingFamily) {
    lines.push(`      --font-heading: ${typography.headingFamily};`);
  }
  if (typography.monoFamily) {
    lines.push(`      --font-mono: ${typography.monoFamily};`);
  }
  lines.push(`      --font-size-base: ${typography.baseFontSize};`);

  // Generate font size scale
  const baseSize = parseFloat(typography.baseFontSize);
  const ratio = typography.scaleRatio;
  for (let i = -2; i <= 6; i++) {
    const size = baseSize * Math.pow(ratio, i);
    lines.push(`      --font-size-${i + 3}: ${size.toFixed(3)}rem;`);
  }

  if (typography.lineHeight) {
    lines.push(`      --line-height: ${typography.lineHeight};`);
  }
  if (typography.letterSpacing) {
    lines.push(`      --letter-spacing: ${typography.letterSpacing};`);
  }

  return lines;
}

/**
 * Generate CSS variables from spacing
 */
export function generateSpacingVariables(spacing: Spacing): string[] {
  const lines: string[] = [];
  lines.push(`      --spacing-unit: ${spacing.unit}px;`);

  for (let i = 0; i < spacing.scale.length; i++) {
    const multiplier = spacing.scale[i];
    if (multiplier !== undefined) {
      const value = spacing.unit * multiplier;
      lines.push(`      --spacing-${i}: ${value}px;`);
    }
  }

  return lines;
}

/**
 * Generate CSS variables from border radius
 */
export function generateBorderRadiusVariables(radius: BorderRadius): string[] {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(radius)) {
    lines.push(`      --radius-${name}: ${value};`);
  }
  return lines;
}

/**
 * Generate CSS variables from shadows
 */
export function generateShadowVariables(shadows: Shadows): string[] {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(shadows)) {
    lines.push(`      --shadow-${name}: ${value};`);
  }
  return lines;
}

/**
 * Generate all CSS variables from design tokens
 */
export function generateCSSVariables(design: UIDesignerOutput): string {
  const lines: string[] = [];

  // Colors
  lines.push(...generateColorVariables(design.colorPalette));
  lines.push('');

  // Typography (optional)
  if (design.typography) {
    lines.push(...generateTypographyVariables(design.typography));
    lines.push('');
  }

  // Spacing (optional)
  if (design.spacing) {
    lines.push(...generateSpacingVariables(design.spacing));
    lines.push('');
  }

  // Border radius
  if (design.borderRadius) {
    lines.push(...generateBorderRadiusVariables(design.borderRadius));
    lines.push('');
  }

  // Shadows
  if (design.shadows) {
    lines.push(...generateShadowVariables(design.shadows));
  }

  return lines.join('\n');
}

// ============================================================================
// Page HTML Generation
// ============================================================================

/**
 * Generate base CSS for mockup pages
 */
export function generateBaseCSS(): string {
  return `    /* Base reset */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--font-family);
      font-size: var(--font-size-base);
      line-height: var(--line-height, 1.5);
      color: var(--color-text);
      background-color: var(--color-background);
    }

    /* Responsive grid */
    .layout-grid {
      display: grid;
      gap: var(--spacing-4);
      padding: var(--spacing-4);
    }

    /* Focus styles for accessibility */
    :focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    /* Skip link for accessibility */
    .skip-link {
      position: absolute;
      top: -40px;
      left: 0;
      background: var(--color-primary);
      color: white;
      padding: 8px 16px;
      z-index: 100;
      text-decoration: none;
      font-weight: 500;
    }

    .skip-link:focus {
      top: 0;
    }

    /* Responsive breakpoints */
    @media (max-width: 640px) {
      .hide-mobile { display: none !important; }
    }

    @media (min-width: 641px) and (max-width: 1024px) {
      .hide-tablet { display: none !important; }
    }

    @media (min-width: 1025px) {
      .hide-desktop { display: none !important; }
    }

    /* Button base */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-2) var(--spacing-4);
      font-family: inherit;
      font-size: var(--font-size-3);
      font-weight: 500;
      border-radius: var(--radius-md, 0.375rem);
      border: none;
      cursor: pointer;
      transition: background-color 0.2s, transform 0.1s;
    }

    .btn-primary {
      background-color: var(--color-primary);
      color: white;
    }

    .btn-secondary {
      background-color: var(--color-secondary);
      color: white;
    }

    /* Card base */
    .card {
      background-color: var(--color-surface);
      border-radius: var(--radius-lg, 0.5rem);
      box-shadow: var(--shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1));
      padding: var(--spacing-4);
    }

    /* Input base */
    .input {
      width: 100%;
      padding: var(--spacing-2) var(--spacing-3);
      font-family: inherit;
      font-size: var(--font-size-3);
      border: 1px solid var(--color-border, #e5e7eb);
      border-radius: var(--radius-md, 0.375rem);
      background-color: var(--color-background);
      color: var(--color-text);
    }

    .input:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
    }`;
}

/**
 * Generate complete HTML page from mockup
 */
export function generatePageHTML(
  page: MockupPage,
  design: UIDesignerOutput
): string {
  const cssVars = generateCSSVariables(design);
  const baseCSS = generateBaseCSS();

  const componentsHtml = page.components
    .map((comp) => renderComponent(comp, 2))
    .join('\n\n');

  const theme = page.meta?.theme || 'auto';
  const viewport = page.meta?.viewport || 'width=device-width, initial-scale=1';
  const lang = page.meta?.lang || 'en';
  const charset = page.meta?.charset || 'UTF-8';

  return `<!DOCTYPE html>
<html lang="${escapeAttribute(lang)}" data-theme="${escapeAttribute(theme)}">
<head>
  <meta charset="${escapeAttribute(charset)}">
  <meta name="viewport" content="${escapeAttribute(viewport)}">
  <title>${escapeHtml(page.title)}</title>
  <style>
    :root {
${cssVars}
    }

${baseCSS}
  </style>
</head>
<body>
  <a href="#main" class="skip-link">Skip to main content</a>

  <main id="main">
${componentsHtml}
  </main>

  <!-- Generated by Aigentflow UI Designer -->
  <!-- Page: ${escapeHtml(page.name)} (${escapeHtml(page.id)}) -->
  <!-- Path: ${escapeHtml(page.path)} -->
</body>
</html>`;
}

// ============================================================================
// Documentation Generation
// ============================================================================

/**
 * Generate component documentation in Markdown
 */
export function generateComponentDoc(components: UIComponent[]): string {
  let doc = '# Component Library\n\n';
  doc += `Generated: ${new Date().toISOString()}\n\n`;
  doc += `Total Components: ${components.length}\n\n`;

  for (const comp of components) {
    doc += `## ${comp.name}\n\n`;
    doc += `**Type:** \`${comp.type}\`\n`;
    doc += `**ID:** \`${comp.id}\`\n\n`;

    if (comp.description) {
      doc += `${comp.description}\n\n`;
    }

    if (comp.accessibility) {
      doc += '### Accessibility\n\n';
      doc += '| Attribute | Value |\n';
      doc += '|-----------|-------|\n';
      for (const [key, value] of Object.entries(comp.accessibility)) {
        if (value !== undefined) {
          doc += `| ${key} | ${value} |\n`;
        }
      }
      doc += '\n';
    }

    if (comp.variants && comp.variants.length > 0) {
      doc += '### Variants\n\n';
      for (const variant of comp.variants) {
        doc += `- **${variant.name}**: ${variant.condition}\n`;
      }
      doc += '\n';
    }

    if (comp.children && comp.children.length > 0) {
      doc += `### Children (${comp.children.length})\n\n`;
      for (const child of comp.children) {
        doc += `- \`${child.id}\` (${child.type}): ${child.name}\n`;
      }
      doc += '\n';
    }

    doc += '---\n\n';
  }

  return doc;
}

/**
 * Convert string to URL-friendly slug
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
