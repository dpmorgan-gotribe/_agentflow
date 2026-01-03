/**
 * Section Template Registry
 *
 * Maps section types to HTML template generators.
 * Templates receive style tokens and content, return complete HTML sections.
 *
 * ARCHITECTURE:
 * - Each template is a pure function: (style, content, variant) => HTML
 * - Templates use CSS variables for styling (generated separately)
 * - Content is escaped to prevent XSS
 * - Templates are mobile-first and accessible
 */

import type { SectionType, SectionContent, SectionVariant, StyleSpec } from '../../schemas/ui-designer-spec.js';
import { escapeHtml } from '../html-generator.js';

// Re-export for convenience
export { escapeHtml };

// ============================================================================
// Template Types
// ============================================================================

/**
 * Template render context
 */
export interface TemplateContext {
  /** Style specification */
  style: StyleSpec;
  /** Section content */
  content?: SectionContent;
  /** Section variant */
  variant?: SectionVariant;
  /** Optional section ID for anchors */
  sectionId?: string;
}

/**
 * Template function signature
 */
export type TemplateFunction = (ctx: TemplateContext) => string;

/**
 * Template with metadata
 */
export interface Template {
  /** Template render function */
  render: TemplateFunction;
  /** Supported variants */
  variants: string[];
  /** Default variant */
  defaultVariant: string;
  /** Description for documentation */
  description: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get background class based on variant
 */
export function getBackgroundClass(variant?: SectionVariant, useDark = false): string {
  if (variant === 'dark' || useDark) {
    return 'bg-dark text-light';
  }
  if (variant === 'gradient') {
    return 'bg-gradient';
  }
  return 'bg-light';
}

/**
 * Get text alignment class
 */
export function getAlignmentClass(variant?: SectionVariant): string {
  if (variant === 'centered') return 'text-center';
  if (variant === 'right') return 'text-right';
  return 'text-left';
}

/**
 * Get padding class based on variant
 */
export function getPaddingClass(variant?: SectionVariant): string {
  if (variant === 'compact') return 'py-8';
  if (variant === 'spacious') return 'py-24';
  return 'py-16';
}

/**
 * Generate section wrapper with common attributes
 */
export function wrapSection(
  content: string,
  ctx: TemplateContext,
  extraClasses = ''
): string {
  const bgClass = getBackgroundClass(ctx.variant, ctx.style.useDarkSections);
  const paddingClass = getPaddingClass(ctx.variant);
  const idAttr = ctx.sectionId ? ` id="${escapeHtml(ctx.sectionId)}"` : '';

  return `<section${idAttr} class="section ${bgClass} ${paddingClass} ${extraClasses}">
  <div class="container">
    ${content}
  </div>
</section>`;
}

/**
 * Render a button
 */
export function renderButton(
  text: string,
  url: string,
  primary = true,
  extraClasses = ''
): string {
  const btnClass = primary ? 'btn btn-primary' : 'btn btn-secondary';
  return `<a href="${escapeHtml(url)}" class="${btnClass} ${extraClasses}">${escapeHtml(text)}</a>`;
}

/**
 * Render heading with optional subheading
 */
export function renderHeading(
  heading?: string,
  subheading?: string,
  centered = false
): string {
  if (!heading && !subheading) return '';

  const alignClass = centered ? 'text-center' : '';

  let html = `<div class="section-header ${alignClass}">`;
  if (heading) {
    html += `<h2 class="section-title">${escapeHtml(heading)}</h2>`;
  }
  if (subheading) {
    html += `<p class="section-subtitle">${escapeHtml(subheading)}</p>`;
  }
  html += '</div>';

  return html;
}

/**
 * Get icon SVG placeholder (simplified icons)
 */
export function renderIcon(iconName?: string): string {
  if (!iconName) return '';

  // Simple placeholder icons using basic SVG shapes
  const icons: Record<string, string> = {
    check: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    star: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    heart: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    arrow: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    phone: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    mail: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    location: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    clock: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    user: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    settings: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  };

  // Return icon or generic circle placeholder
  return icons[iconName.toLowerCase()] ||
    `<span class="icon-placeholder" aria-hidden="true">${escapeHtml(iconName.charAt(0).toUpperCase())}</span>`;
}

// ============================================================================
// Hero Templates
// ============================================================================

function heroTemplate(ctx: TemplateContext): string {
  const { content, variant } = ctx;
  const isDark = variant === 'dark';
  const isSplit = variant === 'split-left' || variant === 'split-right';

  if (isSplit) {
    const imageFirst = variant === 'split-left';
    return `<section class="hero hero-split ${isDark ? 'bg-dark text-light' : 'bg-light'}">
  <div class="container">
    <div class="hero-grid ${imageFirst ? 'image-first' : 'image-last'}">
      <div class="hero-content">
        ${content?.heading ? `<h1 class="hero-title">${escapeHtml(content.heading)}</h1>` : ''}
        ${content?.subheading ? `<p class="hero-subtitle">${escapeHtml(content.subheading)}</p>` : ''}
        ${content?.description ? `<p class="hero-description">${escapeHtml(content.description)}</p>` : ''}
        <div class="hero-buttons">
          ${content?.buttonText ? renderButton(content.buttonText, content.buttonUrl || '#', true) : ''}
          ${content?.secondaryButtonText ? renderButton(content.secondaryButtonText, content.secondaryButtonUrl || '#', false) : ''}
        </div>
      </div>
      <div class="hero-image">
        <div class="image-placeholder" aria-label="${escapeHtml(content?.imageAlt || 'Hero image')}">
          <span>Image</span>
        </div>
      </div>
    </div>
  </div>
</section>`;
  }

  // Full-width hero
  return `<section class="hero ${isDark ? 'bg-dark text-light' : 'bg-light'} ${variant === 'full-height' ? 'hero-full' : ''}">
  <div class="container">
    <div class="hero-content text-center">
      ${content?.heading ? `<h1 class="hero-title">${escapeHtml(content.heading)}</h1>` : ''}
      ${content?.subheading ? `<p class="hero-subtitle">${escapeHtml(content.subheading)}</p>` : ''}
      ${content?.description ? `<p class="hero-description">${escapeHtml(content.description)}</p>` : ''}
      <div class="hero-buttons">
        ${content?.buttonText ? renderButton(content.buttonText, content.buttonUrl || '#', true) : ''}
        ${content?.secondaryButtonText ? renderButton(content.secondaryButtonText, content.secondaryButtonUrl || '#', false) : ''}
      </div>
    </div>
  </div>
</section>`;
}

// ============================================================================
// Features Templates
// ============================================================================

function featuresGridTemplate(ctx: TemplateContext): string {
  const { content, variant } = ctx;
  const items = content?.items || [];
  const columns = items.length <= 3 ? 3 : 4;

  let itemsHtml = '';
  for (const item of items) {
    itemsHtml += `
      <div class="feature-card">
        ${item.icon ? `<div class="feature-icon">${renderIcon(item.icon)}</div>` : ''}
        <h3 class="feature-title">${escapeHtml(item.title)}</h3>
        ${item.description ? `<p class="feature-description">${escapeHtml(item.description)}</p>` : ''}
      </div>`;
  }

  const inner = `
    ${renderHeading(content?.heading, content?.subheading, true)}
    <div class="features-grid grid-${columns}">
      ${itemsHtml}
    </div>
  `;

  return wrapSection(inner, ctx, 'features');
}

function featuresListTemplate(ctx: TemplateContext): string {
  const { content } = ctx;
  const items = content?.items || [];

  let itemsHtml = '';
  for (const item of items) {
    itemsHtml += `
      <div class="feature-row">
        <div class="feature-icon-lg">${renderIcon(item.icon || 'check')}</div>
        <div class="feature-content">
          <h3 class="feature-title">${escapeHtml(item.title)}</h3>
          ${item.description ? `<p class="feature-description">${escapeHtml(item.description)}</p>` : ''}
        </div>
      </div>`;
  }

  const inner = `
    ${renderHeading(content?.heading, content?.subheading)}
    <div class="features-list">
      ${itemsHtml}
    </div>
  `;

  return wrapSection(inner, ctx, 'features');
}

// ============================================================================
// Testimonials Templates
// ============================================================================

function testimonialsGridTemplate(ctx: TemplateContext): string {
  const { content } = ctx;
  const testimonials = content?.testimonials || [];

  let cardsHtml = '';
  for (const t of testimonials) {
    const stars = t.rating
      ? '<div class="testimonial-rating">' + '★'.repeat(t.rating) + '☆'.repeat(5 - t.rating) + '</div>'
      : '';

    cardsHtml += `
      <div class="testimonial-card">
        ${stars}
        <blockquote class="testimonial-quote">"${escapeHtml(t.quote)}"</blockquote>
        <div class="testimonial-author">
          <div class="author-avatar">${escapeHtml(t.author.charAt(0))}</div>
          <div class="author-info">
            <div class="author-name">${escapeHtml(t.author)}</div>
            ${t.role ? `<div class="author-role">${escapeHtml(t.role)}</div>` : ''}
          </div>
        </div>
      </div>`;
  }

  const inner = `
    ${renderHeading(content?.heading, content?.subheading, true)}
    <div class="testimonials-grid">
      ${cardsHtml}
    </div>
  `;

  return wrapSection(inner, ctx, 'testimonials');
}

// ============================================================================
// Pricing Templates
// ============================================================================

function pricingCardsTemplate(ctx: TemplateContext): string {
  const { content } = ctx;
  const tiers = content?.tiers || [];

  let cardsHtml = '';
  for (const tier of tiers) {
    const highlightClass = tier.highlighted ? 'pricing-card-highlighted' : '';
    const featuresHtml = tier.features
      .map(f => `<li class="pricing-feature">${renderIcon('check')} ${escapeHtml(f)}</li>`)
      .join('');

    cardsHtml += `
      <div class="pricing-card ${highlightClass}">
        ${tier.highlighted ? '<div class="pricing-badge">Popular</div>' : ''}
        <h3 class="pricing-name">${escapeHtml(tier.name)}</h3>
        <div class="pricing-price">${escapeHtml(tier.price)}</div>
        ${tier.description ? `<p class="pricing-description">${escapeHtml(tier.description)}</p>` : ''}
        <ul class="pricing-features">
          ${featuresHtml}
        </ul>
        ${renderButton(tier.buttonText || 'Get Started', '#', tier.highlighted, 'pricing-button')}
      </div>`;
  }

  const inner = `
    ${renderHeading(content?.heading, content?.subheading, true)}
    <div class="pricing-grid">
      ${cardsHtml}
    </div>
  `;

  return wrapSection(inner, ctx, 'pricing');
}

// ============================================================================
// CTA Templates
// ============================================================================

function ctaBannerTemplate(ctx: TemplateContext): string {
  const { content, variant } = ctx;
  const isDark = variant === 'dark' || variant === 'gradient';

  return `<section class="cta-banner ${isDark ? 'bg-primary text-light' : 'bg-light'}">
  <div class="container">
    <div class="cta-content text-center">
      ${content?.heading ? `<h2 class="cta-title">${escapeHtml(content.heading)}</h2>` : ''}
      ${content?.subheading ? `<p class="cta-subtitle">${escapeHtml(content.subheading)}</p>` : ''}
      <div class="cta-buttons">
        ${content?.buttonText ? renderButton(content.buttonText, content.buttonUrl || '#', !isDark) : ''}
        ${content?.secondaryButtonText ? renderButton(content.secondaryButtonText, content.secondaryButtonUrl || '#', false) : ''}
      </div>
    </div>
  </div>
</section>`;
}

// ============================================================================
// Contact Templates
// ============================================================================

function contactFormTemplate(ctx: TemplateContext): string {
  const { content } = ctx;

  const inner = `
    ${renderHeading(content?.heading, content?.subheading, true)}
    <div class="contact-grid">
      <form class="contact-form" action="#" method="POST">
        <div class="form-group">
          <label for="name" class="form-label">Name</label>
          <input type="text" id="name" name="name" class="form-input" required>
        </div>
        <div class="form-group">
          <label for="email" class="form-label">Email</label>
          <input type="email" id="email" name="email" class="form-input" required>
        </div>
        <div class="form-group">
          <label for="phone" class="form-label">Phone (optional)</label>
          <input type="tel" id="phone" name="phone" class="form-input">
        </div>
        <div class="form-group">
          <label for="message" class="form-label">Message</label>
          <textarea id="message" name="message" class="form-textarea" rows="5" required></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-full">Send Message</button>
      </form>
      <div class="contact-info">
        ${content?.description ? `<p class="contact-description">${escapeHtml(content.description)}</p>` : ''}
        <div class="contact-details">
          <div class="contact-item">
            ${renderIcon('mail')}
            <span>contact@example.com</span>
          </div>
          <div class="contact-item">
            ${renderIcon('phone')}
            <span>+1 (555) 123-4567</span>
          </div>
          <div class="contact-item">
            ${renderIcon('location')}
            <span>123 Main St, City, Country</span>
          </div>
        </div>
      </div>
    </div>
  `;

  return wrapSection(inner, ctx, 'contact');
}

// ============================================================================
// FAQ Templates
// ============================================================================

function faqAccordionTemplate(ctx: TemplateContext): string {
  const { content } = ctx;
  const faqs = content?.faqs || [];

  let faqsHtml = '';
  for (let i = 0; i < faqs.length; i++) {
    const faq = faqs[i];
    if (!faq) continue;
    faqsHtml += `
      <details class="faq-item" ${i === 0 ? 'open' : ''}>
        <summary class="faq-question">${escapeHtml(faq.question)}</summary>
        <div class="faq-answer">
          <p>${escapeHtml(faq.answer)}</p>
        </div>
      </details>`;
  }

  const inner = `
    ${renderHeading(content?.heading, content?.subheading, true)}
    <div class="faq-list">
      ${faqsHtml}
    </div>
  `;

  return wrapSection(inner, ctx, 'faq');
}

// ============================================================================
// Stats Templates
// ============================================================================

function statsBarTemplate(ctx: TemplateContext): string {
  const { content, variant } = ctx;
  const stats = content?.stats || [];
  const isDark = variant === 'dark';

  let statsHtml = '';
  for (const stat of stats) {
    statsHtml += `
      <div class="stat-item">
        <div class="stat-value">${escapeHtml(stat.value)}</div>
        <div class="stat-label">${escapeHtml(stat.label)}</div>
      </div>`;
  }

  return `<section class="stats-bar ${isDark ? 'bg-dark text-light' : 'bg-primary text-light'}">
  <div class="container">
    <div class="stats-grid">
      ${statsHtml}
    </div>
  </div>
</section>`;
}

// ============================================================================
// Process/Steps Templates
// ============================================================================

function processStepsTemplate(ctx: TemplateContext): string {
  const { content } = ctx;
  const steps = content?.steps || [];

  let stepsHtml = '';
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) continue;
    stepsHtml += `
      <div class="process-step">
        <div class="step-number">${i + 1}</div>
        <div class="step-content">
          <h3 class="step-title">${escapeHtml(step.title)}</h3>
          <p class="step-description">${escapeHtml(step.description)}</p>
        </div>
      </div>`;
  }

  const inner = `
    ${renderHeading(content?.heading, content?.subheading, true)}
    <div class="process-steps">
      ${stepsHtml}
    </div>
  `;

  return wrapSection(inner, ctx, 'process');
}

// ============================================================================
// Navigation Templates
// ============================================================================

function navbarTemplate(ctx: TemplateContext): string {
  const { content, variant, style } = ctx;
  const links = content?.links || [];
  const isTransparent = variant === 'light' || variant === 'transparent';

  const linksHtml = links
    .map(link => `<a href="${escapeHtml(link.url)}" class="nav-link">${escapeHtml(link.text)}</a>`)
    .join('');

  return `<header class="navbar ${isTransparent ? 'navbar-transparent' : 'navbar-solid'}">
  <div class="container">
    <a href="/" class="navbar-brand">${escapeHtml(style.mood === 'elegant' ? '✦' : '●')} ${escapeHtml(ctx.content?.heading || 'Brand')}</a>
    <nav class="navbar-nav" role="navigation" aria-label="Main navigation">
      ${linksHtml}
    </nav>
    <button class="navbar-toggle" aria-label="Toggle navigation" aria-expanded="false">
      <span class="hamburger"></span>
    </button>
  </div>
</header>`;
}

// ============================================================================
// Footer Templates
// ============================================================================

function footerSimpleTemplate(ctx: TemplateContext): string {
  const { content } = ctx;
  const links = content?.links || [];

  const linksHtml = links
    .map(link => `<a href="${escapeHtml(link.url)}" class="footer-link">${escapeHtml(link.text)}</a>`)
    .join('');

  return `<footer class="footer footer-simple">
  <div class="container">
    <div class="footer-content">
      ${content?.description ? `<p class="footer-copyright">${escapeHtml(content.description)}</p>` : ''}
      ${links.length > 0 ? `<nav class="footer-links">${linksHtml}</nav>` : ''}
    </div>
  </div>
</footer>`;
}

function footerMegaTemplate(ctx: TemplateContext): string {
  const { content, style } = ctx;
  const links = content?.links || [];

  // Group links into columns (simple grouping)
  const columns: Array<{ text: string; url: string }[]> = [[], [], []];
  links.forEach((link, i) => {
    const col = columns[i % 3];
    if (col) col.push(link);
  });

  const columnsHtml = columns
    .filter(col => col.length > 0)
    .map(col => {
      const linksHtml = col
        .map(link => `<a href="${escapeHtml(link.url)}" class="footer-link">${escapeHtml(link.text)}</a>`)
        .join('');
      return `<div class="footer-column">${linksHtml}</div>`;
    })
    .join('');

  return `<footer class="footer footer-mega bg-dark text-light">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="footer-logo">${escapeHtml(style.mood === 'elegant' ? '✦' : '●')} ${escapeHtml(content?.heading || 'Brand')}</div>
        ${content?.description ? `<p class="footer-description">${escapeHtml(content.description)}</p>` : ''}
      </div>
      ${columnsHtml}
    </div>
    <div class="footer-bottom">
      <p>© ${new Date().getFullYear()} All rights reserved.</p>
    </div>
  </div>
</footer>`;
}

// ============================================================================
// Template Registry
// ============================================================================

/**
 * Registry of all available templates
 */
export const TEMPLATES: Partial<Record<SectionType, Template>> = {
  // Heroes
  'hero': {
    render: heroTemplate,
    variants: ['light', 'dark', 'split-left', 'split-right', 'full-height'],
    defaultVariant: 'light',
    description: 'Full-width hero section with heading, subheading, and CTA',
  },
  'hero-split': {
    render: (ctx) => heroTemplate({ ...ctx, variant: ctx.variant || 'split-right' }),
    variants: ['split-left', 'split-right'],
    defaultVariant: 'split-right',
    description: 'Split hero with image on one side',
  },
  'hero-minimal': {
    render: heroTemplate,
    variants: ['light', 'dark', 'centered'],
    defaultVariant: 'centered',
    description: 'Minimal text-only hero',
  },

  // Features
  'features-grid': {
    render: featuresGridTemplate,
    variants: ['light', 'dark', 'compact', 'spacious'],
    defaultVariant: 'light',
    description: 'Feature cards in a responsive grid',
  },
  'features-list': {
    render: featuresListTemplate,
    variants: ['light', 'dark'],
    defaultVariant: 'light',
    description: 'Vertical list of features with icons',
  },
  'features-icons': {
    render: featuresGridTemplate,
    variants: ['light', 'dark', 'centered'],
    defaultVariant: 'centered',
    description: 'Icon-focused feature grid',
  },

  // Testimonials
  'testimonials-grid': {
    render: testimonialsGridTemplate,
    variants: ['light', 'dark'],
    defaultVariant: 'light',
    description: 'Grid of testimonial cards',
  },
  'testimonials-carousel': {
    render: testimonialsGridTemplate, // Same HTML, carousel handled by JS
    variants: ['light', 'dark'],
    defaultVariant: 'light',
    description: 'Rotating testimonial carousel',
  },
  'testimonials-featured': {
    render: testimonialsGridTemplate,
    variants: ['light', 'dark', 'centered'],
    defaultVariant: 'centered',
    description: 'Single featured testimonial',
  },

  // Pricing
  'pricing-cards': {
    render: pricingCardsTemplate,
    variants: ['light', 'dark'],
    defaultVariant: 'light',
    description: 'Pricing tier cards',
  },
  'pricing-table': {
    render: pricingCardsTemplate, // Can be extended
    variants: ['light', 'dark'],
    defaultVariant: 'light',
    description: 'Pricing comparison table',
  },

  // CTA
  'cta-banner': {
    render: ctaBannerTemplate,
    variants: ['light', 'dark', 'gradient'],
    defaultVariant: 'gradient',
    description: 'Full-width call-to-action banner',
  },
  'cta-centered': {
    render: ctaBannerTemplate,
    variants: ['light', 'dark'],
    defaultVariant: 'light',
    description: 'Centered CTA section',
  },

  // Contact
  'contact-form': {
    render: contactFormTemplate,
    variants: ['light', 'dark'],
    defaultVariant: 'light',
    description: 'Contact form with info',
  },
  'contact-split': {
    render: contactFormTemplate,
    variants: ['light', 'dark'],
    defaultVariant: 'light',
    description: 'Contact with map/image split',
  },

  // FAQ
  'faq-accordion': {
    render: faqAccordionTemplate,
    variants: ['light', 'dark'],
    defaultVariant: 'light',
    description: 'Expandable FAQ accordion',
  },

  // Stats
  'stats-bar': {
    render: statsBarTemplate,
    variants: ['light', 'dark', 'gradient'],
    defaultVariant: 'dark',
    description: 'Statistics/numbers bar',
  },

  // Process
  'process-steps': {
    render: processStepsTemplate,
    variants: ['light', 'dark'],
    defaultVariant: 'light',
    description: 'Numbered process steps',
  },

  // Navigation
  'navbar': {
    render: navbarTemplate,
    variants: ['light', 'dark', 'transparent'],
    defaultVariant: 'light',
    description: 'Standard navigation bar',
  },
  'navbar-transparent': {
    render: (ctx) => navbarTemplate({ ...ctx, variant: 'transparent' }),
    variants: ['transparent'],
    defaultVariant: 'transparent',
    description: 'Transparent overlay navbar',
  },

  // Footer
  'footer-simple': {
    render: footerSimpleTemplate,
    variants: ['light', 'dark'],
    defaultVariant: 'dark',
    description: 'Simple footer with links',
  },
  'footer-mega': {
    render: footerMegaTemplate,
    variants: ['dark'],
    defaultVariant: 'dark',
    description: 'Multi-column mega footer',
  },
};

/**
 * Get a template by section type
 */
export function getTemplate(type: SectionType): Template | undefined {
  return TEMPLATES[type];
}

/**
 * Render a section using its template
 */
export function renderSection(
  type: SectionType,
  ctx: TemplateContext
): string {
  const template = TEMPLATES[type];

  if (!template) {
    // Fallback for unknown types
    return `<section class="section section-placeholder">
  <div class="container">
    <p class="text-muted">Section type "${escapeHtml(type)}" not implemented</p>
  </div>
</section>`;
  }

  return template.render(ctx);
}

/**
 * Get all available section types
 */
export function getAvailableSectionTypes(): SectionType[] {
  return Object.keys(TEMPLATES) as SectionType[];
}
