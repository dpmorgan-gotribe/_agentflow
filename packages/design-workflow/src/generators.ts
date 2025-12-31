/**
 * Output Generators
 *
 * Generates kitchen sink, screen mockups, and gallery from design options.
 *
 * Security features:
 * - HTML escaping for user content
 * - Path sanitization
 * - Content length limits
 */

import {
  DesignOption,
  ScreenDefinition,
  ScreenMockup,
  KitchenSink,
  DesignComponent,
  MAX_HTML_LENGTH,
} from './types.js';
import { extractComponentsFromDesign, extractCssClasses } from './token-extraction.js';
import { buildDesignSpec, generateCssVariables } from './design-spec.js';

// ============================================================================
// HTML Escaping
// ============================================================================

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] ?? char);
}

/**
 * Sanitize path segment
 */
function sanitizePathSegment(segment: string): string {
  return segment
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// ============================================================================
// Kitchen Sink Generator
// ============================================================================

/**
 * Generate kitchen sink HTML with all components
 */
export function generateKitchenSink(design: DesignOption): KitchenSink {
  const spec = buildDesignSpec(design);
  const tokens = design.tokens;

  // Extract or use provided components
  const components = design.components ?? extractComponentsFromDesign(design.html);

  // Generate CSS
  const css = generateKitchenSinkCss(spec.cssVariables, tokens?.borderRadius);

  // Generate component sections
  const componentSections = generateComponentSections(components);

  // Build full HTML
  const html = generateKitchenSinkHtml(design.name, css, componentSections);

  // Extract all classes
  const classes = extractCssClasses(html);

  return {
    html,
    css,
    components,
    classes,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate kitchen sink CSS
 */
function generateKitchenSinkCss(cssVariables: string, borderRadius?: string): string {
  return `/* Kitchen Sink Styles */
${cssVariables}

/* Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body);
  background: var(--color-background);
  color: var(--color-text);
  line-height: var(--line-height, 1.5);
}

/* Container */
.kitchen-sink {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacing-xl, 32px);
}

/* Sections */
.section {
  margin-bottom: var(--spacing-xl, 32px);
  padding: var(--spacing-lg, 24px);
  background: var(--color-surface);
  border-radius: ${borderRadius ?? '8px'};
}

.section-title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: var(--spacing-md, 16px);
  color: var(--color-text);
  border-bottom: 2px solid var(--color-primary);
  padding-bottom: var(--spacing-sm, 8px);
}

/* Component Grid */
.component-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-md, 16px);
}

.component-item {
  padding: var(--spacing-md, 16px);
  background: var(--color-background);
  border-radius: ${borderRadius ?? '8px'};
  border: 1px solid var(--color-surface);
}

.component-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary, #6B7280);
  margin-bottom: var(--spacing-sm, 8px);
}

/* Typography Samples */
.typography-sample h1 { font-size: 2.5rem; margin-bottom: 0.5em; }
.typography-sample h2 { font-size: 2rem; margin-bottom: 0.5em; }
.typography-sample h3 { font-size: 1.5rem; margin-bottom: 0.5em; }
.typography-sample h4 { font-size: 1.25rem; margin-bottom: 0.5em; }
.typography-sample p { margin-bottom: 1em; }

/* Color Swatches */
.color-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm, 8px);
}

.color-swatch {
  width: 80px;
  height: 80px;
  border-radius: ${borderRadius ?? '8px'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 500;
}
`;
}

/**
 * Generate component sections HTML
 */
function generateComponentSections(components: DesignComponent[]): string {
  // Group components by type
  const groups: Record<string, DesignComponent[]> = {};

  for (const component of components) {
    const existing = groups[component.type];
    if (existing) {
      existing.push(component);
    } else {
      groups[component.type] = [component];
    }
  }

  const sections: string[] = [];

  for (const [type, comps] of Object.entries(groups)) {
    const items = comps
      .slice(0, 5)
      .map(
        (c) => `
      <div class="component-item">
        <div class="component-name">${escapeHtml(c.name)}</div>
        ${c.html}
      </div>
    `
      )
      .join('\n');

    sections.push(`
    <section class="section">
      <h2 class="section-title">${escapeHtml(type.charAt(0).toUpperCase() + type.slice(1))}s</h2>
      <div class="component-grid">
        ${items}
      </div>
    </section>
  `);
  }

  return sections.join('\n');
}

/**
 * Generate full kitchen sink HTML document
 */
function generateKitchenSinkHtml(
  designName: string,
  css: string,
  componentSections: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kitchen Sink - ${escapeHtml(designName)}</title>
  <style>
${css}
  </style>
</head>
<body>
  <div class="kitchen-sink">
    <header>
      <h1 style="font-family: var(--font-heading); margin-bottom: var(--spacing-lg);">
        ${escapeHtml(designName)} - Component Library
      </h1>
    </header>

    <!-- Color Palette -->
    <section class="section">
      <h2 class="section-title">Color Palette</h2>
      <div class="color-swatches">
        <div class="color-swatch" style="background: var(--color-primary); color: white;">Primary</div>
        <div class="color-swatch" style="background: var(--color-secondary); color: white;">Secondary</div>
        <div class="color-swatch" style="background: var(--color-accent); color: white;">Accent</div>
        <div class="color-swatch" style="background: var(--color-background); border: 1px solid #ccc;">Background</div>
        <div class="color-swatch" style="background: var(--color-surface); border: 1px solid #ccc;">Surface</div>
        <div class="color-swatch" style="background: var(--color-text); color: white;">Text</div>
      </div>
    </section>

    <!-- Typography -->
    <section class="section">
      <h2 class="section-title">Typography</h2>
      <div class="typography-sample">
        <h1 style="font-family: var(--font-heading);">Heading 1</h1>
        <h2 style="font-family: var(--font-heading);">Heading 2</h2>
        <h3 style="font-family: var(--font-heading);">Heading 3</h3>
        <h4 style="font-family: var(--font-heading);">Heading 4</h4>
        <p style="font-family: var(--font-body);">
          Body text sample. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>
      </div>
    </section>

    <!-- Components -->
    ${componentSections}
  </div>
</body>
</html>`;
}

// ============================================================================
// Screen Mockup Generator
// ============================================================================

/**
 * Generate a screen mockup HTML structure (without AI content)
 */
export function generateScreenMockupShell(
  screen: ScreenDefinition,
  design: DesignOption
): ScreenMockup {
  const spec = buildDesignSpec(design);
  const css = generateKitchenSinkCss(spec.cssVariables, design.tokens?.borderRadius);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(screen.name)} - ${escapeHtml(design.name)}</title>
  <style>
${css}

/* Screen-specific styles */
.screen-container {
  min-height: 100vh;
}
  </style>
</head>
<body>
  <div class="screen-container">
    <!-- Screen: ${escapeHtml(screen.name)} -->
    <!-- Description: ${escapeHtml(screen.description)} -->
    <!-- Category: ${screen.category} -->

    <main>
      <h1 style="font-family: var(--font-heading); padding: var(--spacing-lg);">
        ${escapeHtml(screen.name)}
      </h1>
      <p style="padding: 0 var(--spacing-lg); color: var(--color-text-secondary, #6B7280);">
        ${escapeHtml(screen.description)}
      </p>

      <!-- AI-generated content will be placed here -->
      <div class="screen-content" style="padding: var(--spacing-lg);">
        <!-- Placeholder for ${escapeHtml(screen.name)} content -->
      </div>
    </main>
  </div>
</body>
</html>`;

  return {
    screenId: screen.id,
    name: screen.name,
    html,
    css,
    path: `screens/${sanitizePathSegment(screen.id)}.html`,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate a screen mockup with full content
 */
export function createScreenMockup(
  screen: ScreenDefinition,
  design: DesignOption,
  content: string
): ScreenMockup {
  const spec = buildDesignSpec(design);
  const css = generateKitchenSinkCss(spec.cssVariables, design.tokens?.borderRadius);

  // Validate content length
  const safeContent = content.slice(0, MAX_HTML_LENGTH);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(screen.name)} - ${escapeHtml(design.name)}</title>
  <style>
${css}

/* Screen-specific styles */
.screen-container {
  min-height: 100vh;
}
  </style>
</head>
<body>
  <div class="screen-container">
    ${safeContent}
  </div>
</body>
</html>`;

  return {
    screenId: screen.id,
    name: screen.name,
    html,
    css,
    path: `screens/${sanitizePathSegment(screen.id)}.html`,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Gallery Generator
// ============================================================================

/**
 * Generate gallery index HTML
 */
export function generateGalleryHtml(
  options: DesignOption[],
  kitchenSink?: KitchenSink,
  mockups?: ScreenMockup[]
): string {
  const optionCards = options
    .map(
      (opt, i) => `
    <div class="gallery-card">
      <div class="gallery-card-preview">
        <iframe src="options/option-${i + 1}-${sanitizePathSegment(opt.mood)}.html"
                title="${escapeHtml(opt.name)}"
                loading="lazy"></iframe>
      </div>
      <div class="gallery-card-info">
        <h3>${escapeHtml(opt.name)}</h3>
        <p class="mood">${escapeHtml(opt.mood)}</p>
        <p>${escapeHtml(opt.description.slice(0, 150))}...</p>
        <a href="options/option-${i + 1}-${sanitizePathSegment(opt.mood)}.html"
           class="view-link">View Full Design →</a>
      </div>
    </div>
  `
    )
    .join('\n');

  const mockupLinks =
    mockups
      ?.map(
        (m) => `
    <a href="${m.path}" class="mockup-link">
      <span class="mockup-icon">📱</span>
      ${escapeHtml(m.name)}
    </a>
  `
      )
      .join('\n') ?? '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Design Gallery</title>
  <style>
    :root {
      --primary: #3B82F6;
      --surface: #F9FAFB;
      --text: #111827;
      --text-secondary: #6B7280;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f3f4f6;
      color: var(--text);
      line-height: 1.5;
    }
    .gallery-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .gallery-header {
      text-align: center;
      margin-bottom: 40px;
    }
    .gallery-header h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
    }
    .gallery-header p {
      color: var(--text-secondary);
      font-size: 1.125rem;
    }
    .gallery-section {
      margin-bottom: 60px;
    }
    .gallery-section-title {
      font-size: 1.5rem;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--primary);
    }
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 24px;
    }
    .gallery-card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .gallery-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15);
    }
    .gallery-card-preview {
      height: 250px;
      overflow: hidden;
      background: var(--surface);
    }
    .gallery-card-preview iframe {
      width: 200%;
      height: 200%;
      transform: scale(0.5);
      transform-origin: top left;
      border: none;
      pointer-events: none;
    }
    .gallery-card-info {
      padding: 20px;
    }
    .gallery-card-info h3 {
      font-size: 1.25rem;
      margin-bottom: 8px;
    }
    .gallery-card-info .mood {
      display: inline-block;
      padding: 4px 12px;
      background: var(--primary);
      color: white;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .gallery-card-info p {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin-bottom: 16px;
    }
    .view-link {
      color: var(--primary);
      font-weight: 500;
      text-decoration: none;
    }
    .view-link:hover {
      text-decoration: underline;
    }
    .mockup-links {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .mockup-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: white;
      border-radius: 8px;
      text-decoration: none;
      color: var(--text);
      font-weight: 500;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: background 0.2s;
    }
    .mockup-link:hover {
      background: var(--surface);
    }
    .mockup-icon {
      font-size: 1.25rem;
    }
    .kitchen-sink-link {
      display: inline-block;
      padding: 16px 32px;
      background: var(--primary);
      color: white;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 1.125rem;
      transition: opacity 0.2s;
    }
    .kitchen-sink-link:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="gallery-container">
    <header class="gallery-header">
      <h1>🎨 Design Gallery</h1>
      <p>Choose a design direction for your project</p>
    </header>

    <section class="gallery-section">
      <h2 class="gallery-section-title">Design Options</h2>
      <div class="gallery-grid">
        ${optionCards}
      </div>
    </section>

    ${
      kitchenSink
        ? `
    <section class="gallery-section">
      <h2 class="gallery-section-title">Component Library</h2>
      <a href="kitchen-sink.html" class="kitchen-sink-link">
        📚 View Kitchen Sink →
      </a>
    </section>
    `
        : ''
    }

    ${
      mockups && mockups.length > 0
        ? `
    <section class="gallery-section">
      <h2 class="gallery-section-title">Screen Mockups</h2>
      <div class="mockup-links">
        ${mockupLinks}
      </div>
    </section>
    `
        : ''
    }
  </div>
</body>
</html>`;
}

// ============================================================================
// Screen Parsing
// ============================================================================

/**
 * Parse screens from PM agent output with fallbacks
 */
export function parseScreensFromOutput(output: string): ScreenDefinition[] {
  const screens: ScreenDefinition[] = [];

  // Strategy 1: Try JSON parsing
  try {
    // Look for JSON code block
    const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      const parsed = JSON.parse(jsonMatch[1]) as { screens?: unknown[] };
      if (Array.isArray(parsed.screens)) {
        for (const s of parsed.screens) {
          const screen = parseScreenObject(s);
          if (screen) screens.push(screen);
        }
        if (screens.length > 0) return screens;
      }
    }

    // Try direct JSON parse
    const directParse = JSON.parse(output) as { screens?: unknown[] };
    if (Array.isArray(directParse.screens)) {
      for (const s of directParse.screens) {
        const screen = parseScreenObject(s);
        if (screen) screens.push(screen);
      }
      if (screens.length > 0) return screens;
    }
  } catch {
    // JSON parsing failed, try fallbacks
  }

  // Strategy 2: Try pipe-delimited format
  const pipeMatch = output.match(/---SCREENS---\s*([\s\S]*?)(?:---|$)/);
  if (pipeMatch && pipeMatch[1]) {
    const lines = pipeMatch[1].trim().split('\n');
    for (const line of lines) {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length >= 3) {
        screens.push({
          id: sanitizeId(parts[0] ?? ''),
          name: parts[1] ?? '',
          description: parts[2] ?? '',
          category: parseCategory(parts[3]),
        });
      }
    }
    if (screens.length > 0) return screens;
  }

  // Strategy 3: Extract from markdown headings
  const headingMatches = output.matchAll(/###\s+(.+?)(?:\n|$)([\s\S]*?)(?=###|$)/g);
  for (const match of headingMatches) {
    const name = match[1]?.trim() ?? '';
    const description = match[2]?.trim().split('\n')[0] ?? '';
    if (name) {
      screens.push({
        id: sanitizeId(name),
        name,
        description,
        category: 'other',
      });
    }
  }

  return screens;
}

/**
 * Parse a screen object with field normalization
 */
function parseScreenObject(obj: unknown): ScreenDefinition | null {
  if (typeof obj !== 'object' || obj === null) return null;

  const s = obj as Record<string, unknown>;

  // Get ID with fallbacks
  const rawId = String(s['id'] ?? s['screen_id'] ?? s['name'] ?? '');
  const id = sanitizeId(rawId);

  // Get name with fallbacks
  const name = String(s['name'] ?? s['title'] ?? s['screen_name'] ?? s['id'] ?? '');

  if (!id || !name) return null;

  return {
    id,
    name,
    description: String(s['description'] ?? s['desc'] ?? s['summary'] ?? name),
    category: parseCategory(s['category'] ?? s['type']),
  };
}

/**
 * Sanitize ID to valid format
 */
function sanitizeId(id: string): string {
  return id
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 50);
}

/**
 * Parse category with fallback
 */
function parseCategory(value: unknown): ScreenDefinition['category'] {
  const str = String(value ?? '').toLowerCase();
  const validCategories = ['public', 'auth', 'dashboard', 'admin', 'settings', 'profile'];
  if (validCategories.includes(str)) {
    return str as ScreenDefinition['category'];
  }
  return 'other';
}

/**
 * Default screens if parsing fails
 */
export function getDefaultScreens(): ScreenDefinition[] {
  return [
    {
      id: 'landing',
      name: 'Landing Page',
      description: 'Main public landing page with hero section',
      category: 'public',
    },
    {
      id: 'login',
      name: 'Login',
      description: 'User authentication login screen',
      category: 'auth',
    },
    {
      id: 'dashboard',
      name: 'Dashboard',
      description: 'Main user dashboard with overview',
      category: 'dashboard',
    },
  ];
}
