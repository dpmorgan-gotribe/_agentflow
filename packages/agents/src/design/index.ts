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
