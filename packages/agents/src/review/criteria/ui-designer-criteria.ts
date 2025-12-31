/**
 * UI Designer Review Criteria
 *
 * Agent-specific review criteria for the UI Designer agent.
 * Validates mockups, design tokens, accessibility, and responsiveness.
 *
 * Security:
 * - Content regex patterns are bounded
 * - No filesystem access (artifacts provide content)
 */

import type { AgentOutput, AgentRequest, Artifact } from '../../types.js';
import type { RequirementCoverage } from '../schemas.js';
import {
  BaseAgentReviewCriteria,
  ReviewCriterion,
  ReviewContext,
  CriterionResult,
  criterionPassed,
  criterionFailed,
  criterionPartial,
} from './base-criteria.js';

// ============================================================================
// UI Designer Review Criteria
// ============================================================================

/**
 * Review criteria for UI Designer agent
 */
export class UIDesignerReviewCriteria extends BaseAgentReviewCriteria {
  agentId = 'ui_designer';

  criteria: ReviewCriterion[] = [
    // ========================================================================
    // Criterion: All Screens Created
    // ========================================================================
    {
      id: 'all_screens_created',
      name: 'All Screens Created',
      description: 'All requested screens have corresponding mockups',
      severity: 'critical',
      category: 'missing',

      async validate(
        output: AgentOutput,
        request: AgentRequest,
        _context: ReviewContext
      ): Promise<CriterionResult> {
        const mockups =
          output.artifacts?.filter((a) => a.type === 'mockup') || [];
        const requestedScreens = extractScreensFromTask(request);

        if (requestedScreens.length === 0) {
          return criterionPassed('No specific screens requested');
        }

        const missingScreens = requestedScreens.filter(
          (screen) => !mockups.some((m) => matchesScreen(m.path, screen))
        );

        const score =
          1 - missingScreens.length / Math.max(requestedScreens.length, 1);

        if (missingScreens.length === 0) {
          return criterionPassed(`All ${requestedScreens.length} screens created`);
        }

        return criterionFailed(
          `Missing screens: ${missingScreens.join(', ')}`,
          `Create mockups for: ${missingScreens.join(', ')}`,
          score,
          missingScreens.length > 2 ? 'large' : 'medium'
        );
      },
    },

    // ========================================================================
    // Criterion: Design Tokens Applied
    // ========================================================================
    {
      id: 'design_tokens_applied',
      name: 'Design Tokens Applied',
      description: 'Design tokens are consistently applied to all components',
      severity: 'major',
      category: 'quality',

      async validate(
        output: AgentOutput,
        _request: AgentRequest,
        _context: ReviewContext
      ): Promise<CriterionResult> {
        const stylesheets =
          output.artifacts?.filter((a) => a.type === 'stylesheet') || [];
        const mockups =
          output.artifacts?.filter((a) => a.type === 'mockup') || [];

        // No stylesheets - check inline styles in mockups
        if (stylesheets.length === 0 && mockups.length === 0) {
          return criterionFailed(
            'No stylesheets or mockups found',
            'Create a stylesheet with design tokens',
            0,
            'medium'
          );
        }

        // Check for CSS variable usage
        const allContent = [
          ...stylesheets.map((s) => s.content || ''),
          ...mockups.map((m) => m.content || ''),
        ].join('\n');

        const hasVariables =
          allContent.includes('var(--') || allContent.includes('$');
        const hasRootVariables = allContent.includes(':root');

        if (hasRootVariables && hasVariables) {
          return criterionPassed('Design tokens properly defined and applied');
        }

        if (hasVariables) {
          return criterionPartial(
            'CSS variables used but :root not found',
            0.7,
            'Define design tokens in :root selector',
            'small'
          );
        }

        // Check for hardcoded colors
        const hardcodedColors = (
          allContent.match(/#[0-9a-fA-F]{3,8}\b/g) || []
        ).length;
        if (hardcodedColors > 5) {
          return criterionFailed(
            `${hardcodedColors} hardcoded color values found`,
            'Replace hardcoded colors with design token CSS variables',
            0.3,
            'medium'
          );
        }

        return criterionPartial(
          'Limited design token usage detected',
          0.5,
          'Use CSS variables (var(--color-*)) for colors, fonts, and spacing',
          'medium'
        );
      },
    },

    // ========================================================================
    // Criterion: Accessibility Attributes
    // ========================================================================
    {
      id: 'accessibility_attributes',
      name: 'Accessibility Attributes',
      description: 'ARIA labels and roles present on interactive elements',
      severity: 'major',
      category: 'quality',

      async validate(
        output: AgentOutput,
        _request: AgentRequest,
        _context: ReviewContext
      ): Promise<CriterionResult> {
        const mockups =
          output.artifacts?.filter((a) => a.type === 'mockup') || [];

        if (mockups.length === 0) {
          return criterionPassed('No mockups to validate');
        }

        let totalInteractive = 0;
        let withAccessibility = 0;

        for (const mockup of mockups) {
          const content = mockup.content || '';

          // Count interactive elements
          const interactiveElements = (
            content.match(/<(button|input|a|select|textarea)/gi) || []
          ).length;

          // Count accessibility attributes
          const ariaAttributes = (content.match(/aria-|role=/gi) || []).length;
          const labels = (content.match(/<label/gi) || []).length;
          const forAttributes = (content.match(/for=["']/gi) || []).length;

          totalInteractive += interactiveElements;
          withAccessibility += Math.min(
            interactiveElements,
            ariaAttributes + labels + forAttributes
          );
        }

        if (totalInteractive === 0) {
          return criterionPassed('No interactive elements found');
        }

        const score = withAccessibility / totalInteractive;

        if (score >= 0.8) {
          return criterionPassed(
            `${Math.round(score * 100)}% of interactive elements have accessibility attributes`
          );
        }

        return criterionPartial(
          `${Math.round((1 - score) * 100)}% of interactive elements missing accessibility attributes`,
          score,
          'Add aria-label, role, and label elements to interactive components',
          'small'
        );
      },
    },

    // ========================================================================
    // Criterion: Responsive Design
    // ========================================================================
    {
      id: 'responsive_design',
      name: 'Responsive Design',
      description: 'Mobile and desktop layouts considered',
      severity: 'major',
      category: 'incomplete',

      async validate(
        output: AgentOutput,
        _request: AgentRequest,
        _context: ReviewContext
      ): Promise<CriterionResult> {
        const stylesheets =
          output.artifacts?.filter((a) => a.type === 'stylesheet') || [];
        const mockups =
          output.artifacts?.filter((a) => a.type === 'mockup') || [];

        const allContent = [
          ...stylesheets.map((s) => s.content || ''),
          ...mockups.map((m) => m.content || ''),
        ].join('\n');

        // Check for responsive indicators
        const hasMediaQueries =
          allContent.includes('@media') ||
          allContent.includes('min-width') ||
          allContent.includes('max-width');

        const hasFlexOrGrid =
          allContent.includes('flex') ||
          allContent.includes('grid') ||
          allContent.includes('display: flex') ||
          allContent.includes('display: grid');

        const hasViewport =
          allContent.includes('viewport') ||
          allContent.includes('vw') ||
          allContent.includes('vh');

        const indicators = [hasMediaQueries, hasFlexOrGrid, hasViewport].filter(
          Boolean
        ).length;

        const score = indicators / 3;

        if (indicators >= 2) {
          return criterionPassed('Responsive design patterns detected');
        }

        if (indicators === 1) {
          return criterionPartial(
            'Limited responsive design patterns',
            score,
            'Add media queries for mobile (< 768px) and tablet (< 1024px) breakpoints',
            'medium'
          );
        }

        return criterionFailed(
          'No responsive design patterns found',
          'Add media queries, flexbox/grid layouts, and viewport-relative units',
          0,
          'medium'
        );
      },
    },

    // ========================================================================
    // Criterion: Component Structure
    // ========================================================================
    {
      id: 'component_structure',
      name: 'Component Structure',
      description: 'HTML uses semantic elements and clear structure',
      severity: 'minor',
      category: 'quality',

      async validate(
        output: AgentOutput,
        _request: AgentRequest,
        _context: ReviewContext
      ): Promise<CriterionResult> {
        const mockups =
          output.artifacts?.filter((a) => a.type === 'mockup') || [];

        if (mockups.length === 0) {
          return criterionPassed('No mockups to validate');
        }

        let semanticCount = 0;
        let divCount = 0;

        for (const mockup of mockups) {
          const content = mockup.content || '';

          // Count semantic elements
          const semanticElements = (
            content.match(
              /<(header|footer|nav|main|article|section|aside|figure)/gi
            ) || []
          ).length;

          // Count divs
          const divElements = (content.match(/<div/gi) || []).length;

          semanticCount += semanticElements;
          divCount += divElements;
        }

        const totalElements = semanticCount + divCount;
        if (totalElements === 0) {
          return criterionPassed('No structural elements found');
        }

        const semanticRatio = semanticCount / totalElements;

        if (semanticRatio >= 0.3) {
          return criterionPassed(
            `Good semantic structure (${semanticCount} semantic, ${divCount} div)`
          );
        }

        if (semanticRatio >= 0.1) {
          return criterionPartial(
            `Limited semantic structure (${semanticCount} semantic, ${divCount} div)`,
            semanticRatio * 2,
            'Replace generic divs with semantic elements like header, nav, main, section',
            'small'
          );
        }

        return criterionFailed(
          `Poor semantic structure (${semanticCount} semantic, ${divCount} div)`,
          'Use semantic HTML elements: header, footer, nav, main, article, section, aside',
          0.2,
          'small'
        );
      },
    },
  ];

  /**
   * Check if a requirement is covered by the output
   */
  async checkRequirementCovered(
    requirement: string,
    output: AgentOutput,
    _context: ReviewContext
  ): Promise<RequirementCoverage> {
    const mockups =
      output.artifacts?.filter((a) => a.type === 'mockup') || [];
    const stylesheets =
      output.artifacts?.filter((a) => a.type === 'stylesheet') || [];
    const allContent = [...mockups, ...stylesheets]
      .map((a) => a.content || '')
      .join(' ');

    // Simple keyword matching
    const keywords = requirement
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    if (keywords.length === 0) {
      return {
        requirement,
        source: 'explicit',
        covered: true,
        coverageDetails: 'Requirement too vague to validate',
        confidence: 0.5,
      };
    }

    const matchCount = keywords.filter((kw) =>
      allContent.toLowerCase().includes(kw)
    ).length;

    const confidence = matchCount / keywords.length;
    const covered = confidence >= 0.5;

    return {
      requirement,
      source: 'explicit',
      covered,
      coverageDetails: covered
        ? `Found in design artifacts (${Math.round(confidence * 100)}% keyword match)`
        : `Requirement keywords not found in designs`,
      confidence,
    };
  }

  /**
   * Infer implicit requirements for UI design
   */
  protected override inferImplicitRequirements(request: AgentRequest): string[] {
    const implicit: string[] = [];
    const description = this.getTaskDescription(request).toLowerCase();

    // Form-related requirements
    if (description.includes('form')) {
      implicit.push('Form validation states (error, success)');
      implicit.push('Form submission feedback');
    }

    // Login-related requirements
    if (description.includes('login') || description.includes('sign in')) {
      implicit.push('Password visibility toggle');
      implicit.push('Forgot password link');
      implicit.push('Error message display');
    }

    // Dashboard-related requirements
    if (description.includes('dashboard')) {
      implicit.push('Navigation menu');
      implicit.push('User profile area');
      implicit.push('Loading states');
    }

    // Table-related requirements
    if (description.includes('table') || description.includes('list')) {
      implicit.push('Empty state display');
      implicit.push('Pagination or infinite scroll');
    }

    // Modal-related requirements
    if (description.includes('modal') || description.includes('dialog')) {
      implicit.push('Close button');
      implicit.push('Overlay backdrop');
      implicit.push('Focus trap');
    }

    return implicit;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract screen names from task description
 */
function extractScreensFromTask(request: AgentRequest): string[] {
  const taskContext = request.context.items.find(
    (item) => item.type === 'current_task'
  );

  let description = '';
  if (taskContext && typeof taskContext.content === 'object') {
    const content = taskContext.content as Record<string, unknown>;
    if (typeof content['description'] === 'string') {
      description = content['description'];
    } else if (typeof content['prompt'] === 'string') {
      description = content['prompt'];
    }
  }

  if (!description) return [];

  const screens: string[] = [];

  // Look for explicit screen mentions
  const screenPatterns = [
    /(\w+)\s+(?:page|screen|view)/gi,
    /(?:page|screen|view)\s+for\s+(\w+)/gi,
    /create\s+(?:a\s+)?(\w+)\s+(?:page|screen|view|mockup)/gi,
  ];

  for (const pattern of screenPatterns) {
    let match;
    while ((match = pattern.exec(description)) !== null) {
      const screenName = match[1]?.toLowerCase();
      if (screenName && screenName.length > 2) {
        screens.push(screenName);
      }
    }
  }

  return [...new Set(screens)];
}

/**
 * Check if artifact path matches a screen name
 */
function matchesScreen(artifactPath: string, screenName: string): boolean {
  const normalizedPath = artifactPath.toLowerCase();
  const normalizedScreen = screenName.toLowerCase();
  return normalizedPath.includes(normalizedScreen);
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create UI Designer review criteria instance
 */
export function createUIDesignerCriteria(): UIDesignerReviewCriteria {
  return new UIDesignerReviewCriteria();
}
