/**
 * Specification to HTML Generator
 *
 * Converts a UIDesignerSpecification into complete HTML/CSS files.
 * This is the core of the scalable generation pattern - Claude returns
 * a small spec (~3KB), this generator produces full HTML (~75KB).
 *
 * ARCHITECTURE:
 * - generateCSS(): Creates CSS variables and base styles from StyleSpec
 * - generatePage(): Creates a complete HTML page from PageSpec
 * - generateAllPages(): Orchestrates generation of all pages
 * - All output uses templates from ./templates/
 */

import type {
  UIDesignerSpecification,
  PageSpec,
  SectionSpec,
  StyleSpec,
} from '../schemas/ui-designer-spec.js';
import {
  renderSection,
  escapeHtml,
  type TemplateContext,
} from './templates/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Generated file
 */
export interface GeneratedFile {
  /** Relative path from project root */
  path: string;
  /** File content */
  content: string;
  /** File type */
  type: 'html' | 'css' | 'json';
}

/**
 * Generation result
 */
export interface GenerationResult {
  /** All generated files */
  files: GeneratedFile[];
  /** Generation metadata */
  metadata: {
    pageCount: number;
    totalSizeBytes: number;
    generatedAt: string;
  };
}

// ============================================================================
// CSS Generation
// ============================================================================

/**
 * Convert hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1] ?? '0', 16),
    g: parseInt(result[2] ?? '0', 16),
    b: parseInt(result[3] ?? '0', 16),
  } : null;
}

/**
 * Get border radius value from name
 */
function getBorderRadius(name: string): string {
  const values: Record<string, string> = {
    none: '0',
    small: '0.25rem',
    medium: '0.5rem',
    large: '1rem',
    full: '9999px',
  };
  return values[name] || '0.5rem';
}

/**
 * Generate CSS variables from style specification
 */
export function generateCSSVariables(style: StyleSpec): string {
  const primary = hexToRgb(style.primaryColor);
  const secondary = hexToRgb(style.secondaryColor);
  const accent = hexToRgb(style.accentColor);
  const bg = hexToRgb(style.backgroundColor);
  const text = hexToRgb(style.textColor);

  return `  /* Colors */
  --color-primary: ${style.primaryColor};
  --color-primary-rgb: ${primary ? `${primary.r}, ${primary.g}, ${primary.b}` : '59, 130, 246'};
  --color-secondary: ${style.secondaryColor};
  --color-secondary-rgb: ${secondary ? `${secondary.r}, ${secondary.g}, ${secondary.b}` : '99, 102, 241'};
  --color-accent: ${style.accentColor};
  --color-accent-rgb: ${accent ? `${accent.r}, ${accent.g}, ${accent.b}` : '139, 92, 246'};
  --color-background: ${style.backgroundColor};
  --color-background-rgb: ${bg ? `${bg.r}, ${bg.g}, ${bg.b}` : '255, 255, 255'};
  --color-text: ${style.textColor};
  --color-text-rgb: ${text ? `${text.r}, ${text.g}, ${text.b}` : '17, 24, 39'};
  --color-text-muted: rgba(var(--color-text-rgb), 0.6);
  --color-border: rgba(var(--color-text-rgb), 0.1);

  /* Typography */
  --font-heading: '${style.fontHeading}', ui-serif, Georgia, serif;
  --font-body: '${style.fontBody}', ui-sans-serif, system-ui, sans-serif;
  --font-size-base: 1rem;
  --font-size-sm: 0.875rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;
  --font-size-4xl: 2.25rem;
  --font-size-5xl: 3rem;
  --line-height: 1.6;

  /* Spacing */
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;
  --spacing-12: 3rem;
  --spacing-16: 4rem;
  --spacing-24: 6rem;

  /* Border Radius */
  --radius: ${getBorderRadius(style.borderRadius)};
  --radius-sm: calc(var(--radius) * 0.5);
  --radius-lg: calc(var(--radius) * 1.5);
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition: 200ms ease;
  --transition-slow: 300ms ease;

  /* Container */
  --container-max: 1200px;
  --container-padding: var(--spacing-4);`;
}

/**
 * Generate complete CSS file
 */
export function generateCSS(style: StyleSpec): string {
  const googleFonts = style.googleFonts || [
    `${style.fontHeading}:400,500,600,700`,
    `${style.fontBody}:400,500,600`,
  ];

  const fontImports = googleFonts
    .map(font => {
      const encoded = encodeURIComponent(font.replace(/ /g, '+'));
      return `@import url('https://fonts.googleapis.com/css2?family=${encoded}&display=swap');`;
    })
    .join('\n');

  return `/* Generated by Aigentflow UI Designer */
/* Specification-driven generation */

${fontImports}

:root {
${generateCSSVariables(style)}
}

/* Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  line-height: var(--line-height);
  color: var(--color-text);
  background-color: var(--color-background);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: var(--spacing-4);
}

h1 { font-size: var(--font-size-5xl); }
h2 { font-size: var(--font-size-4xl); }
h3 { font-size: var(--font-size-2xl); }
h4 { font-size: var(--font-size-xl); }

p {
  margin-bottom: var(--spacing-4);
}

a {
  color: var(--color-primary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

a:hover {
  color: var(--color-secondary);
}

/* Container */
.container {
  width: 100%;
  max-width: var(--container-max);
  margin: 0 auto;
  padding: 0 var(--container-padding);
}

/* Section */
.section {
  padding: var(--spacing-16) 0;
}

.section-header {
  margin-bottom: var(--spacing-12);
}

.section-title {
  font-size: var(--font-size-4xl);
  margin-bottom: var(--spacing-4);
}

.section-subtitle {
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  max-width: 600px;
}

.section-header.text-center .section-subtitle {
  margin: 0 auto;
}

/* Background Variants */
.bg-light {
  background-color: var(--color-background);
  color: var(--color-text);
}

.bg-dark {
  background-color: var(--color-text);
  color: var(--color-background);
}

.bg-dark .section-subtitle {
  color: rgba(255, 255, 255, 0.7);
}

.bg-primary {
  background-color: var(--color-primary);
  color: white;
}

.bg-gradient {
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  color: white;
}

/* Text Alignment */
.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

/* Padding Variants */
.py-8 { padding-top: var(--spacing-8); padding-bottom: var(--spacing-8); }
.py-16 { padding-top: var(--spacing-16); padding-bottom: var(--spacing-16); }
.py-24 { padding-top: var(--spacing-24); padding-bottom: var(--spacing-24); }

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-3) var(--spacing-6);
  font-size: var(--font-size-base);
  font-weight: 500;
  border-radius: var(--radius);
  border: none;
  cursor: pointer;
  transition: all var(--transition);
  text-decoration: none;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--color-secondary);
  color: white;
}

.btn-secondary {
  background-color: transparent;
  color: var(--color-text);
  border: 2px solid var(--color-border);
}

.btn-secondary:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-full {
  width: 100%;
}

/* Grids */
.grid-3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-8);
}

.grid-4 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--spacing-6);
}

/* Hero */
.hero {
  padding: var(--spacing-24) 0;
  min-height: 60vh;
  display: flex;
  align-items: center;
}

.hero-full {
  min-height: 100vh;
}

.hero-title {
  font-size: clamp(2.5rem, 5vw, 4rem);
  margin-bottom: var(--spacing-6);
}

.hero-subtitle {
  font-size: var(--font-size-xl);
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-8);
  max-width: 600px;
}

.hero-split .hero-subtitle {
  color: inherit;
  opacity: 0.8;
}

.hero-content.text-center .hero-subtitle {
  margin-left: auto;
  margin-right: auto;
}

.hero-buttons {
  display: flex;
  gap: var(--spacing-4);
  flex-wrap: wrap;
}

.hero-content.text-center .hero-buttons {
  justify-content: center;
}

.hero-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-12);
  align-items: center;
}

.hero-grid.image-first {
  direction: rtl;
}

.hero-grid.image-first > * {
  direction: ltr;
}

.hero-image {
  position: relative;
}

.image-placeholder {
  aspect-ratio: 4/3;
  background: linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.1), rgba(var(--color-secondary-rgb), 0.1));
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* Features */
.feature-card {
  padding: var(--spacing-6);
  background: var(--color-background);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  transition: all var(--transition);
}

.feature-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.feature-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--color-primary-rgb), 0.1);
  color: var(--color-primary);
  border-radius: var(--radius);
  margin-bottom: var(--spacing-4);
}

.feature-title {
  font-size: var(--font-size-xl);
  margin-bottom: var(--spacing-2);
}

.feature-description {
  color: var(--color-text-muted);
  margin-bottom: 0;
}

.features-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-8);
}

.feature-row {
  display: flex;
  gap: var(--spacing-6);
  align-items: flex-start;
}

.feature-icon-lg {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--color-primary-rgb), 0.1);
  color: var(--color-primary);
  border-radius: var(--radius);
  flex-shrink: 0;
}

/* Testimonials */
.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-8);
}

.testimonial-card {
  padding: var(--spacing-8);
  background: var(--color-background);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
}

.testimonial-rating {
  color: var(--color-accent);
  margin-bottom: var(--spacing-4);
  font-size: var(--font-size-lg);
}

.testimonial-quote {
  font-size: var(--font-size-lg);
  font-style: italic;
  margin-bottom: var(--spacing-6);
  line-height: 1.7;
}

.testimonial-author {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.author-avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background: rgba(var(--color-primary-rgb), 0.1);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.author-name {
  font-weight: 600;
}

.author-role {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* Pricing */
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-8);
  align-items: start;
}

.pricing-card {
  padding: var(--spacing-8);
  background: var(--color-background);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  position: relative;
}

.pricing-card-highlighted {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-lg);
}

.pricing-badge {
  position: absolute;
  top: 0;
  right: var(--spacing-4);
  transform: translateY(-50%);
  background: var(--color-primary);
  color: white;
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.pricing-name {
  font-size: var(--font-size-xl);
  margin-bottom: var(--spacing-2);
}

.pricing-price {
  font-size: var(--font-size-4xl);
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: var(--spacing-4);
}

.pricing-description {
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-6);
}

.pricing-features {
  list-style: none;
  margin-bottom: var(--spacing-8);
}

.pricing-feature {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.pricing-feature:last-child {
  border-bottom: none;
}

.pricing-button {
  width: 100%;
}

/* CTA */
.cta-banner {
  padding: var(--spacing-16) 0;
}

.cta-title {
  font-size: var(--font-size-3xl);
  margin-bottom: var(--spacing-4);
}

.cta-subtitle {
  font-size: var(--font-size-lg);
  margin-bottom: var(--spacing-8);
  opacity: 0.9;
}

.cta-buttons {
  display: flex;
  gap: var(--spacing-4);
  justify-content: center;
  flex-wrap: wrap;
}

/* Contact */
.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-12);
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.form-label {
  font-weight: 500;
}

.form-input,
.form-textarea {
  padding: var(--spacing-3) var(--spacing-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-family: inherit;
  font-size: var(--font-size-base);
  transition: border-color var(--transition-fast);
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.contact-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.contact-details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.contact-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

/* FAQ */
.faq-list {
  max-width: 800px;
  margin: 0 auto;
}

.faq-item {
  border-bottom: 1px solid var(--color-border);
}

.faq-question {
  padding: var(--spacing-6) 0;
  font-weight: 500;
  cursor: pointer;
  list-style: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.faq-question::after {
  content: '+';
  font-size: var(--font-size-xl);
  color: var(--color-text-muted);
  transition: transform var(--transition);
}

.faq-item[open] .faq-question::after {
  content: '−';
}

.faq-answer {
  padding-bottom: var(--spacing-6);
  color: var(--color-text-muted);
}

/* Stats */
.stats-bar {
  padding: var(--spacing-12) 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-8);
  text-align: center;
}

.stat-value {
  font-size: var(--font-size-4xl);
  font-weight: 700;
  margin-bottom: var(--spacing-2);
}

.stat-label {
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.8;
}

/* Process */
.process-steps {
  display: grid;
  gap: var(--spacing-8);
  max-width: 800px;
  margin: 0 auto;
}

.process-step {
  display: flex;
  gap: var(--spacing-6);
  align-items: flex-start;
}

.step-number {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-full);
  font-weight: 700;
  font-size: var(--font-size-xl);
  flex-shrink: 0;
}

.step-title {
  font-size: var(--font-size-xl);
  margin-bottom: var(--spacing-2);
}

.step-description {
  color: var(--color-text-muted);
  margin-bottom: 0;
}

/* Navbar */
.navbar {
  padding: var(--spacing-4) 0;
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border);
}

.navbar-transparent {
  background: transparent;
  border-bottom: none;
  position: absolute;
  left: 0;
  right: 0;
}

.navbar .container {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.navbar-brand {
  font-family: var(--font-heading);
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
}

.navbar-nav {
  display: flex;
  gap: var(--spacing-6);
}

.nav-link {
  color: var(--color-text);
  font-weight: 500;
  transition: color var(--transition-fast);
}

.nav-link:hover {
  color: var(--color-primary);
}

.navbar-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--spacing-2);
}

.hamburger {
  display: block;
  width: 24px;
  height: 2px;
  background: var(--color-text);
  position: relative;
}

.hamburger::before,
.hamburger::after {
  content: '';
  position: absolute;
  width: 24px;
  height: 2px;
  background: var(--color-text);
  left: 0;
}

.hamburger::before { top: -8px; }
.hamburger::after { top: 8px; }

/* Footer */
.footer {
  padding: var(--spacing-12) 0;
  border-top: 1px solid var(--color-border);
}

.footer-simple .footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-4);
}

.footer-copyright {
  color: var(--color-text-muted);
  margin-bottom: 0;
}

.footer-links {
  display: flex;
  gap: var(--spacing-6);
}

.footer-link {
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}

.footer-link:hover {
  color: var(--color-primary);
}

.footer-mega {
  padding: var(--spacing-16) 0 var(--spacing-8);
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr repeat(3, 1fr);
  gap: var(--spacing-12);
  margin-bottom: var(--spacing-12);
}

.footer-logo {
  font-family: var(--font-heading);
  font-size: var(--font-size-xl);
  font-weight: 600;
  margin-bottom: var(--spacing-4);
}

.footer-description {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 0;
}

.footer-column {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.footer-mega .footer-link {
  color: rgba(255, 255, 255, 0.7);
}

.footer-mega .footer-link:hover {
  color: white;
}

.footer-bottom {
  padding-top: var(--spacing-8);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
}

/* Icons */
.icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.icon-placeholder {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--color-primary-rgb), 0.1);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

/* Responsive */
@media (max-width: 768px) {
  :root {
    --container-padding: var(--spacing-6);
  }

  .hero-grid {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .hero-grid.image-first {
    direction: ltr;
  }

  .hero-image {
    order: -1;
  }

  .hero-buttons {
    justify-content: center;
  }

  .contact-grid {
    grid-template-columns: 1fr;
  }

  .footer-grid {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .navbar-nav {
    display: none;
  }

  .navbar-toggle {
    display: block;
  }
}

/* Print */
@media print {
  .navbar,
  .footer {
    display: none;
  }
}
`;
}

// ============================================================================
// HTML Generation
// ============================================================================

/**
 * Generate HTML for a single section
 */
export function generateSectionHTML(
  section: SectionSpec,
  style: StyleSpec
): string {
  const ctx: TemplateContext = {
    style,
    content: section.content,
    variant: section.variant,
    sectionId: section.id,
  };

  return renderSection(section.type, ctx);
}

/**
 * Generate complete HTML page
 */
export function generatePageHTML(
  page: PageSpec,
  spec: UIDesignerSpecification
): string {
  const { style, sharedSections } = spec;

  // Generate sections HTML
  const sectionsHtml = page.sections
    .map(section => generateSectionHTML(section, style))
    .join('\n\n');

  // Generate navbar if specified
  const navbarHtml = sharedSections?.navbar
    ? generateSectionHTML(sharedSections.navbar, style)
    : '';

  // Generate footer if specified
  const footerHtml = sharedSections?.footer
    ? generateSectionHTML(sharedSections.footer, style)
    : '';

  const pageTitle = page.title || `${page.name} | ${spec.projectName}`;
  const metaDescription = page.metaDescription || page.description;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <title>${escapeHtml(pageTitle)}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  ${navbarHtml}

  <main id="main-content">
    ${sectionsHtml}
  </main>

  ${footerHtml}
</body>
</html>`;
}

// ============================================================================
// Full Generation
// ============================================================================

/**
 * Generate all files from a specification
 */
export function generateAllPages(spec: UIDesignerSpecification): GenerationResult {
  const files: GeneratedFile[] = [];

  // Generate CSS
  const cssContent = generateCSS(spec.style);
  files.push({
    path: 'designs/mockups/styles.css',
    content: cssContent,
    type: 'css',
  });

  // Generate each page
  for (const page of spec.pages) {
    const pageHtml = generatePageHTML(page, spec);
    const fileName = page.path === '/' ? 'index' : page.path.replace(/^\//, '').replace(/\//g, '-');

    files.push({
      path: `designs/mockups/${fileName}.html`,
      content: pageHtml,
      type: 'html',
    });
  }

  // Generate spec JSON (minimal version)
  const specJson = JSON.stringify({
    projectName: spec.projectName,
    pages: spec.pages.map(p => ({
      id: p.id,
      name: p.name,
      path: p.path,
      file: `${p.path === '/' ? 'index' : p.path.replace(/^\//, '').replace(/\//g, '-')}.html`,
    })),
    style: {
      mood: spec.style.mood,
      primaryColor: spec.style.primaryColor,
    },
    generatedAt: new Date().toISOString(),
  }, null, 2);

  files.push({
    path: 'designs/mockups/spec.json',
    content: specJson,
    type: 'json',
  });

  // Calculate total size
  const totalSize = files.reduce((sum, f) => sum + f.content.length, 0);

  return {
    files,
    metadata: {
      pageCount: spec.pages.length,
      totalSizeBytes: totalSize,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Helper to generate just one page (for incremental generation)
 */
export function generateSinglePage(
  page: PageSpec,
  spec: UIDesignerSpecification
): GeneratedFile {
  const pageHtml = generatePageHTML(page, spec);
  const fileName = page.path === '/' ? 'index' : page.path.replace(/^\//, '').replace(/\//g, '-');

  return {
    path: `designs/mockups/${fileName}.html`,
    content: pageHtml,
    type: 'html',
  };
}
