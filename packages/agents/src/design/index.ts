/**
 * Design Module
 *
 * Exports pure functions for UI design generation.
 * No filesystem access - data passed from CLI layer.
 */

export {
  // HTML escaping
  escapeHtml,
  escapeAttribute,
  // Style helpers
  camelToKebab,
  styleObjectToString,
  // Accessibility
  renderAccessibility,
  // Component rendering
  getHtmlTag,
  renderAttributes,
  renderComponent,
  // CSS variable generation
  generateColorVariables,
  generateTypographyVariables,
  generateSpacingVariables,
  generateBorderRadiusVariables,
  generateShadowVariables,
  generateCSSVariables,
  // Page generation
  generateBaseCSS,
  generatePageHTML,
  // Documentation
  generateComponentDoc,
  slugify,
} from './html-generator.js';

// Specification-driven generation (scalable)
export {
  generateCSS,
  generateCSSVariables as generateSpecCSSVariables,
  generateSectionHTML,
  generatePageHTML as generateSpecPageHTML,
  generateAllPages,
  generateSinglePage,
  type GeneratedFile,
  type GenerationResult,
} from './spec-to-html.js';

// Section templates
export {
  TEMPLATES,
  getTemplate,
  renderSection,
  getAvailableSectionTypes,
  wrapSection,
  renderButton,
  renderHeading,
  renderIcon,
  type TemplateContext,
  type TemplateFunction,
  type Template,
} from './templates/index.js';
