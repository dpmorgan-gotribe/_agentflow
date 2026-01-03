/**
 * UI Designer Specification Schema
 *
 * Minimal specification schema for scalable UI generation.
 * Claude returns a small specification (~3KB), agent code generates full HTML (~75KB).
 *
 * This solves the JSON truncation problem where complex apps (10+ screens)
 * would produce 74KB+ JSON responses that get truncated mid-stream.
 *
 * ARCHITECTURE:
 * - Claude specifies WHAT to build (page names, section types, style preferences)
 * - Agent code generates HOW to build it (full HTML from templates)
 *
 * SIZE TARGETS:
 * - 3 screens: ~1KB specification
 * - 10 screens: ~3KB specification
 * - 20 screens: ~5KB specification
 * - 50 screens: ~10KB specification
 */

import { z } from 'zod';

// ============================================================================
// Section Types
// ============================================================================

/**
 * All supported section types for page generation.
 * Each maps to a template in the template library.
 */
export const SectionTypeSchema = z.enum([
  // Hero sections
  'hero',                    // Full-width hero with heading/subheading
  'hero-split',              // Split layout with image on one side
  'hero-video',              // Video background hero
  'hero-minimal',            // Minimal text-only hero

  // Feature sections
  'features-grid',           // 3-4 column feature cards
  'features-list',           // Vertical feature list with icons
  'features-alternating',    // Alternating left/right features
  'features-icons',          // Icon-focused feature grid

  // Social proof
  'testimonials-carousel',   // Rotating testimonials
  'testimonials-grid',       // Grid of testimonial cards
  'testimonials-featured',   // Single large featured testimonial
  'testimonials-quotes',     // Quote-style testimonials

  // Pricing & conversion
  'pricing-table',           // Comparison table
  'pricing-cards',           // Pricing tier cards
  'cta-banner',              // Full-width call-to-action
  'cta-centered',            // Centered CTA with button
  'cta-split',               // CTA with image

  // Information sections
  'about-story',             // Company/practitioner story
  'about-mission',           // Mission/values section
  'team-grid',               // Team member cards
  'team-featured',           // Featured team member
  'process-steps',           // Numbered process/timeline
  'process-horizontal',      // Horizontal process flow
  'faq-accordion',           // Expandable FAQ
  'faq-two-column',          // Two-column FAQ
  'stats-bar',               // Statistics/numbers bar
  'stats-grid',              // Statistics in grid

  // Services/offerings
  'services-grid',           // Service cards in grid
  'services-list',           // Detailed service list
  'services-tabs',           // Tabbed services
  'expertise-grid',          // Expertise/specialty areas

  // Contact & location
  'contact-form',            // Contact form section
  'contact-split',           // Contact with map/image
  'contact-minimal',         // Minimal contact info
  'location-map',            // Map with location details
  'booking-cta',             // Booking call-to-action

  // Content sections
  'content-text',            // Rich text content block
  'content-image',           // Image with caption
  'content-gallery',         // Image gallery
  'content-video',           // Embedded video

  // Navigation & structure
  'navbar',                  // Standard navigation bar
  'navbar-transparent',      // Transparent overlay navbar
  'navbar-centered',         // Centered logo navbar
  'footer-simple',           // Simple footer with links
  'footer-mega',             // Multi-column mega footer
  'footer-minimal',          // Minimal copyright footer

  // Utility sections
  'divider',                 // Visual divider/spacer
  'banner-announcement',     // Announcement banner
  'newsletter',              // Newsletter signup
]);

export type SectionType = z.infer<typeof SectionTypeSchema>;

// ============================================================================
// Section Variants
// ============================================================================

/**
 * Common variants that can apply to multiple section types.
 * Templates use these to adjust styling/layout.
 */
export const SectionVariantSchema = z.enum([
  // Background variants
  'light',                   // Light background
  'dark',                    // Dark background
  'gradient',                // Gradient background
  'image',                   // Image background
  'transparent',             // Transparent background (for navbars)

  // Layout variants
  'centered',                // Center-aligned content
  'left',                    // Left-aligned content
  'right',                   // Right-aligned content
  'split-left',              // Image on left
  'split-right',             // Image on right

  // Size variants
  'compact',                 // Reduced padding
  'spacious',                // Extra padding
  'full-height',             // Full viewport height

  // Style variants
  'minimal',                 // Minimal styling
  'bordered',                // With borders
  'shadowed',                // With shadows
  'rounded',                 // Rounded corners
]).optional();

export type SectionVariant = z.infer<typeof SectionVariantSchema>;

// ============================================================================
// Section Content
// ============================================================================

/**
 * Content that can be specified for a section.
 * Only TEXT content - no HTML, no nested structures.
 * Templates handle the actual markup.
 */
export const SectionContentSchema = z.object({
  // Primary text
  heading: z.string().max(200).optional(),
  subheading: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),

  // Button/CTA
  buttonText: z.string().max(50).optional(),
  buttonUrl: z.string().max(200).optional(),
  secondaryButtonText: z.string().max(50).optional(),
  secondaryButtonUrl: z.string().max(200).optional(),

  // List items (for features, services, etc.)
  items: z.array(z.object({
    title: z.string().max(100),
    description: z.string().max(300).optional(),
    icon: z.string().max(50).optional(),      // Icon name (e.g., "heart", "star")
  })).max(12).optional(),

  // Testimonials
  testimonials: z.array(z.object({
    quote: z.string().max(500),
    author: z.string().max(100),
    role: z.string().max(100).optional(),
    rating: z.number().min(1).max(5).optional(),
  })).max(6).optional(),

  // Pricing tiers
  tiers: z.array(z.object({
    name: z.string().max(50),
    price: z.string().max(50),               // "$99/mo" or "Contact us"
    description: z.string().max(200).optional(),
    features: z.array(z.string().max(100)).max(10),
    highlighted: z.boolean().optional(),
    buttonText: z.string().max(30).optional(),
  })).max(4).optional(),

  // FAQ items
  faqs: z.array(z.object({
    question: z.string().max(200),
    answer: z.string().max(1000),
  })).max(10).optional(),

  // Stats/numbers
  stats: z.array(z.object({
    value: z.string().max(20),               // "500+" or "99%"
    label: z.string().max(50),
  })).max(6).optional(),

  // Team members
  team: z.array(z.object({
    name: z.string().max(100),
    role: z.string().max(100),
    bio: z.string().max(300).optional(),
  })).max(8).optional(),

  // Process steps
  steps: z.array(z.object({
    title: z.string().max(100),
    description: z.string().max(300),
  })).max(8).optional(),

  // Navigation links
  links: z.array(z.object({
    text: z.string().max(50),
    url: z.string().max(200),
  })).max(10).optional(),

  // Image references (just descriptions, templates use placeholders)
  imageAlt: z.string().max(200).optional(),
  imagePosition: z.enum(['left', 'right', 'top', 'bottom', 'background']).optional(),
}).strict();

export type SectionContent = z.infer<typeof SectionContentSchema>;

// ============================================================================
// Section Specification
// ============================================================================

/**
 * Complete specification for a single section.
 */
export const SectionSpecSchema = z.object({
  /** Section type - maps to template */
  type: SectionTypeSchema,

  /** Optional variant for styling */
  variant: SectionVariantSchema,

  /** Content to display in this section */
  content: SectionContentSchema.optional(),

  /** Optional custom ID for anchor links */
  id: z.string().max(50).regex(/^[a-z][a-z0-9-]*$/).optional(),
});

export type SectionSpec = z.infer<typeof SectionSpecSchema>;

// ============================================================================
// Page Layout
// ============================================================================

/**
 * Page layout type
 */
export const PageLayoutSchema = z.enum([
  'full-width',              // No max-width container
  'contained',               // Max-width container (default)
  'sidebar-left',            // Left sidebar layout
  'sidebar-right',           // Right sidebar layout
  'centered',                // Narrow centered content
]);

export type PageLayout = z.infer<typeof PageLayoutSchema>;

// ============================================================================
// Page Specification
// ============================================================================

/**
 * Complete specification for a single page.
 */
export const PageSpecSchema = z.object({
  /** Unique page identifier */
  id: z.string().max(50).regex(/^[a-z][a-z0-9-]*$/),

  /** Human-readable page name */
  name: z.string().max(100),

  /** URL path (e.g., "/about", "/services") */
  path: z.string().max(200).regex(/^\/[a-z0-9-/]*$/),

  /** Brief description of page purpose */
  description: z.string().max(300),

  /** Page title for <title> tag */
  title: z.string().max(100).optional(),

  /** Meta description for SEO */
  metaDescription: z.string().max(160).optional(),

  /** Layout type */
  layout: PageLayoutSchema.default('contained'),

  /** Ordered list of sections on this page */
  sections: z.array(SectionSpecSchema).min(1).max(20),
});

export type PageSpec = z.infer<typeof PageSpecSchema>;

// ============================================================================
// Style Specification
// ============================================================================

/**
 * Design mood/direction
 */
export const DesignMoodSchema = z.enum([
  'minimal',                 // Clean, lots of whitespace
  'bold',                    // Strong colors, high contrast
  'elegant',                 // Refined, sophisticated
  'playful',                 // Fun, colorful
  'professional',            // Corporate, trustworthy
  'modern',                  // Contemporary, trendy
  'classic',                 // Traditional, timeless
  'warm',                    // Inviting, friendly
  'dark',                    // Dark mode aesthetic
]);

export type DesignMood = z.infer<typeof DesignMoodSchema>;

/**
 * Style specification - design tokens in minimal form.
 */
export const StyleSpecSchema = z.object({
  /** Overall design mood/direction */
  mood: DesignMoodSchema,

  /** Primary brand color (hex) */
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),

  /** Secondary color (hex) */
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),

  /** Accent color for CTAs/highlights (hex) */
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),

  /** Background color (hex) */
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#FFFFFF'),

  /** Text color (hex) */
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#111827'),

  /** Heading font family */
  fontHeading: z.string().max(100),

  /** Body font family */
  fontBody: z.string().max(100),

  /** Border radius style */
  borderRadius: z.enum(['none', 'small', 'medium', 'large', 'full']).default('medium'),

  /** Whether to use dark sections */
  useDarkSections: z.boolean().default(false),

  /** Google Fonts to load */
  googleFonts: z.array(z.string().max(100)).max(4).optional(),
});

export type StyleSpec = z.infer<typeof StyleSpecSchema>;

// ============================================================================
// Complete Specification
// ============================================================================

/**
 * Complete UI Designer Specification
 *
 * This is what Claude returns - a minimal specification that the agent
 * code uses to generate full HTML mockups.
 *
 * Target size: ~3KB for 10-page app
 */
export const UIDesignerSpecificationSchema = z.object({
  /** Project name */
  projectName: z.string().max(100),

  /** Project description */
  projectDescription: z.string().max(500).optional(),

  /** Style specification */
  style: StyleSpecSchema,

  /** All pages to generate */
  pages: z.array(PageSpecSchema).min(1).max(50),

  /** Shared components to include on all pages */
  sharedSections: z.object({
    /** Navbar specification (added to top of each page) */
    navbar: SectionSpecSchema.optional(),

    /** Footer specification (added to bottom of each page) */
    footer: SectionSpecSchema.optional(),
  }).optional(),

  /** Generation metadata */
  metadata: z.object({
    generatedAt: z.string().optional(),
    version: z.string().default('1.0.0'),
  }).optional(),
});

export type UIDesignerSpecification = z.infer<typeof UIDesignerSpecificationSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a minimal page spec
 */
export function createPageSpec(
  id: string,
  name: string,
  path: string,
  sections: SectionSpec[]
): PageSpec {
  return {
    id,
    name,
    path,
    description: `${name} page`,
    layout: 'contained',
    sections,
  };
}

/**
 * Create a minimal section spec
 */
export function createSectionSpec(
  type: SectionType,
  content?: Partial<SectionContent>,
  variant?: SectionVariant
): SectionSpec {
  return {
    type,
    variant,
    content: content as SectionContent,
  };
}

/**
 * Create default style spec
 */
export function createDefaultStyleSpec(): StyleSpec {
  return {
    mood: 'professional',
    primaryColor: '#3B82F6',
    secondaryColor: '#6366F1',
    accentColor: '#8B5CF6',
    backgroundColor: '#FFFFFF',
    textColor: '#111827',
    fontHeading: 'Inter',
    fontBody: 'Inter',
    borderRadius: 'medium',
    useDarkSections: false,
  };
}

/**
 * Validate a specification and return errors
 */
export function validateSpecification(spec: unknown): {
  valid: boolean;
  data?: UIDesignerSpecification;
  errors?: string[];
} {
  const result = UIDesignerSpecificationSchema.safeParse(spec);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  return {
    valid: false,
    errors: result.error.errors.map(
      (e) => `${e.path.join('.')}: ${e.message}`
    ),
  };
}

/**
 * Estimate the JSON size of a specification
 */
export function estimateSpecSize(spec: UIDesignerSpecification): number {
  return JSON.stringify(spec).length;
}

/**
 * Get all section types used in a specification
 */
export function getUsedSectionTypes(spec: UIDesignerSpecification): SectionType[] {
  const types = new Set<SectionType>();

  for (const page of spec.pages) {
    for (const section of page.sections) {
      types.add(section.type);
    }
  }

  if (spec.sharedSections?.navbar) {
    types.add(spec.sharedSections.navbar.type);
  }
  if (spec.sharedSections?.footer) {
    types.add(spec.sharedSections.footer.type);
  }

  return Array.from(types);
}

// ============================================================================
// Example Specification (for documentation)
// ============================================================================

/**
 * Example specification for a simple landing page.
 * This demonstrates the minimal format Claude should return.
 */
export const EXAMPLE_SPECIFICATION: UIDesignerSpecification = {
  projectName: 'Acme Corp',
  projectDescription: 'Corporate website with services and contact',
  style: {
    mood: 'professional',
    primaryColor: '#1E40AF',
    secondaryColor: '#3B82F6',
    accentColor: '#F59E0B',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    fontHeading: 'Poppins',
    fontBody: 'Inter',
    borderRadius: 'medium',
    useDarkSections: true,
    googleFonts: ['Poppins:600,700', 'Inter:400,500'],
  },
  pages: [
    {
      id: 'home',
      name: 'Home',
      path: '/',
      description: 'Main landing page',
      layout: 'full-width',
      sections: [
        {
          type: 'hero',
          variant: 'dark',
          content: {
            heading: 'Build Something Amazing',
            subheading: 'We help companies transform their digital presence',
            buttonText: 'Get Started',
            buttonUrl: '/contact',
          },
        },
        {
          type: 'features-grid',
          content: {
            heading: 'Our Services',
            items: [
              { title: 'Web Development', description: 'Modern, responsive websites' },
              { title: 'Mobile Apps', description: 'iOS and Android applications' },
              { title: 'Cloud Solutions', description: 'Scalable infrastructure' },
            ],
          },
        },
        {
          type: 'cta-banner',
          variant: 'gradient',
          content: {
            heading: 'Ready to get started?',
            buttonText: 'Contact Us',
            buttonUrl: '/contact',
          },
        },
      ],
    },
  ],
  sharedSections: {
    navbar: {
      type: 'navbar',
      content: {
        links: [
          { text: 'Home', url: '/' },
          { text: 'Services', url: '/services' },
          { text: 'About', url: '/about' },
          { text: 'Contact', url: '/contact' },
        ],
      },
    },
    footer: {
      type: 'footer-simple',
      content: {
        description: '© 2024 Acme Corp. All rights reserved.',
        links: [
          { text: 'Privacy', url: '/privacy' },
          { text: 'Terms', url: '/terms' },
        ],
      },
    },
  },
};

// ============================================================================
// Schema Documentation for Prompts
// ============================================================================

/**
 * Schema documentation for inclusion in prompts.
 * This ensures Claude knows exactly what format to return in specification mode.
 */
export const UI_DESIGNER_SPEC_SCHEMA_DOC = `
## Required Specification Schema

Return a JSON object with this EXACT structure:

\`\`\`json
{
  "projectName": "string - Project name (max 100 chars)",
  "projectDescription": "string (optional) - Brief project description",

  "style": {
    "mood": "string - One of: minimal, bold, elegant, playful, professional, modern, classic, warm, dark",
    "primaryColor": "string - Hex color (e.g. '#1E40AF')",
    "secondaryColor": "string - Hex color",
    "accentColor": "string - Hex color for CTAs/highlights",
    "backgroundColor": "string - Hex color (default '#FFFFFF')",
    "textColor": "string - Hex color (default '#111827')",
    "fontHeading": "string - Heading font name (e.g. 'Poppins')",
    "fontBody": "string - Body font name (e.g. 'Inter')",
    "borderRadius": "string - One of: none, small, medium, large, full",
    "useDarkSections": "boolean - Whether to use dark backgrounds for some sections",
    "googleFonts": "string[] (optional) - Fonts to load (e.g. ['Poppins:600,700'])"
  },

  "pages": [
    {
      "id": "string - Lowercase with hyphens (e.g. 'about-us')",
      "name": "string - Human-readable name",
      "path": "string - URL path starting with / (e.g. '/about')",
      "description": "string - Brief page description",
      "title": "string (optional) - Browser tab title",
      "layout": "string - One of: full-width, contained, sidebar-left, sidebar-right, centered",
      "sections": [
        {
          "type": "string - Section type (see list below)",
          "variant": "string (optional) - Styling variant",
          "content": { /* Section-specific content */ }
        }
      ]
    }
  ],

  "sharedSections": {
    "navbar": { /* Section spec for navigation */ },
    "footer": { /* Section spec for footer */ }
  }
}
\`\`\`

## Section Types

Available section types (use these exact strings):

**Heroes**: hero, hero-split, hero-video, hero-minimal
**Features**: features-grid, features-list, features-alternating, features-icons
**Testimonials**: testimonials-carousel, testimonials-grid, testimonials-featured, testimonials-quotes
**Pricing**: pricing-table, pricing-cards
**CTAs**: cta-banner, cta-centered, cta-split
**About**: about-story, about-mission
**Team**: team-grid, team-featured
**Process**: process-steps, process-horizontal
**FAQ**: faq-accordion, faq-two-column
**Stats**: stats-bar, stats-grid
**Services**: services-grid, services-list, services-tabs, expertise-grid
**Contact**: contact-form, contact-split, contact-minimal, location-map, booking-cta
**Content**: content-text, content-image, content-gallery, content-video
**Navigation**: navbar, navbar-transparent, navbar-centered, footer-simple, footer-mega, footer-minimal
**Utility**: divider, banner-announcement, newsletter

## Section Variants

Optional variants that modify section appearance:

**Background**: light, dark, gradient, image, transparent
**Layout**: centered, left, right, split-left, split-right
**Size**: compact, spacious, full-height
**Style**: minimal, bordered, shadowed, rounded

## CRITICAL FORMAT REQUIREMENTS

1. **All page IDs must be lowercase with hyphens only** (e.g. "about-us", not "About Us")
2. **All paths must start with /** (e.g. "/about", not "about")
3. **All colors must be hex codes** with # prefix (e.g. "#3B82F6")
4. **Section types must match exactly** from the list above
5. **Keep content minimal** - just text, no HTML markup
6. **Max 20 sections per page** - be selective
7. **Max 50 pages total** - for larger apps, group related content

## Example Section Content

For features-grid:
\`\`\`json
{
  "type": "features-grid",
  "content": {
    "heading": "Our Services",
    "items": [
      { "title": "Web Development", "description": "Modern websites", "icon": "globe" },
      { "title": "Mobile Apps", "description": "iOS and Android", "icon": "smartphone" }
    ]
  }
}
\`\`\`

For hero:
\`\`\`json
{
  "type": "hero",
  "variant": "dark",
  "content": {
    "heading": "Build Something Amazing",
    "subheading": "We help companies transform their digital presence",
    "buttonText": "Get Started",
    "buttonUrl": "/contact"
  }
}
\`\`\`
`;
