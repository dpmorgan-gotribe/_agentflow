/**
 * Diagram Renderer
 *
 * Renders user flows as Mermaid diagrams for visualization.
 *
 * Security features:
 * - HTML entity escaping for all text content
 * - Mermaid-specific character escaping
 * - ID sanitization to prevent injection
 * - Content-Security-Policy compatible output
 */

import type { UserFlow, FlowStep, FlowTransition, Actor } from './schema.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Diagram direction
 */
export type DiagramDirection = 'TB' | 'BT' | 'LR' | 'RL';

/**
 * Mermaid theme
 */
export type MermaidTheme = 'default' | 'dark' | 'forest' | 'neutral' | 'base';

/**
 * Diagram style options
 */
export interface DiagramStyle {
  direction: DiagramDirection;
  theme: MermaidTheme;
  nodeSpacing: number;
  rankSpacing: number;
}

/**
 * Diagram type
 */
export type DiagramType = 'flowchart' | 'state' | 'sequence';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_STYLE: DiagramStyle = {
  direction: 'TB',
  theme: 'default',
  nodeSpacing: 50,
  rankSpacing: 50,
};

/**
 * Node colors by step type
 */
const STEP_COLORS = {
  start: { fill: '#22c55e', stroke: '#16a34a', color: '#fff' },
  end: { fill: '#3b82f6', stroke: '#2563eb', color: '#fff' },
  action: { fill: '#f3f4f6', stroke: '#9ca3af', color: '#111' },
  decision: { fill: '#f59e0b', stroke: '#d97706', color: '#fff' },
  process: { fill: '#8b5cf6', stroke: '#7c3aed', color: '#fff' },
  input: { fill: '#06b6d4', stroke: '#0891b2', color: '#fff' },
  display: { fill: '#ec4899', stroke: '#db2777', color: '#fff' },
  wait: { fill: '#6366f1', stroke: '#4f46e5', color: '#fff' },
  error: { fill: '#ef4444', stroke: '#dc2626', color: '#fff' },
  external: { fill: '#14b8a6', stroke: '#0d9488', color: '#fff' },
};

// ============================================================================
// Security Functions
// ============================================================================

/**
 * Escape HTML entities for safe display
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/`/g, '&#96;');
}

/**
 * Escape text for Mermaid labels
 * Mermaid uses special characters that need escaping
 */
function escapeMermaidLabel(text: string): string {
  return escapeHtml(text)
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
    .replace(/\(/g, '&#40;')
    .replace(/\)/g, '&#41;')
    .replace(/\|/g, '&#124;')
    .replace(/\n/g, '<br/>')
    .replace(/;/g, '&#59;');
}

/**
 * Sanitize ID for Mermaid compatibility
 * Only allow alphanumeric and underscores
 */
function sanitizeId(id: string): string {
  // Replace any non-alphanumeric characters with underscore
  const sanitized = id.replace(/[^a-zA-Z0-9]/g, '_');
  // Ensure it starts with a letter
  if (/^[0-9]/.test(sanitized)) {
    return `step_${sanitized}`;
  }
  return sanitized;
}

/**
 * Validate content doesn't contain injection attempts
 */
function isSafeContent(text: string): boolean {
  // Check for common injection patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:/i,
    /vbscript:/i,
  ];
  return !dangerousPatterns.some((pattern) => pattern.test(text));
}

// ============================================================================
// Diagram Renderer Class
// ============================================================================

/**
 * Diagram renderer class
 */
export class DiagramRenderer {
  private style: DiagramStyle;

  constructor(style: Partial<DiagramStyle> = {}) {
    this.style = { ...DEFAULT_STYLE, ...style };
  }

  /**
   * Update style options
   */
  setStyle(style: Partial<DiagramStyle>): void {
    this.style = { ...this.style, ...style };
  }

  /**
   * Render flow as Mermaid flowchart
   */
  renderFlowchart(flow: UserFlow): string {
    const lines: string[] = [
      `%%{init: {'theme': '${this.style.theme}'}}%%`,
      `flowchart ${this.style.direction}`,
    ];

    // Render steps (nodes)
    for (const step of flow.steps) {
      lines.push(`    ${this.renderNode(step)}`);
    }

    lines.push('');

    // Render transitions (edges)
    for (const transition of flow.transitions) {
      lines.push(`    ${this.renderEdge(transition)}`);
    }

    // Add styling
    lines.push('');
    lines.push(...this.generateStyles(flow));

    return lines.join('\n');
  }

  /**
   * Render flow as Mermaid state diagram
   */
  renderStateDiagram(flow: UserFlow): string {
    const lines: string[] = [
      `%%{init: {'theme': '${this.style.theme}'}}%%`,
      'stateDiagram-v2',
    ];

    // Add start
    lines.push(`    [*] --> ${sanitizeId(flow.startStep)}`);

    // Render transitions
    for (const transition of flow.transitions) {
      const from = sanitizeId(transition.from);
      const to = sanitizeId(transition.to);
      const label = transition.label || transition.condition?.label || '';

      if (label && isSafeContent(label)) {
        lines.push(`    ${from} --> ${to}: ${escapeMermaidLabel(label)}`);
      } else {
        lines.push(`    ${from} --> ${to}`);
      }
    }

    // Add end states
    for (const endId of flow.endSteps) {
      lines.push(`    ${sanitizeId(endId)} --> [*]`);
    }

    // Add state descriptions
    lines.push('');
    for (const step of flow.steps) {
      const id = sanitizeId(step.id);
      const name = escapeMermaidLabel(step.name);
      lines.push(`    ${id}: ${name}`);
    }

    return lines.join('\n');
  }

  /**
   * Render flow as sequence diagram
   */
  renderSequenceDiagram(flow: UserFlow): string {
    const lines: string[] = [
      `%%{init: {'theme': '${this.style.theme}'}}%%`,
      'sequenceDiagram',
    ];

    // Define actors
    for (const actor of flow.actors) {
      const actorType = actor.type === 'user' ? 'actor' : 'participant';
      const id = sanitizeId(actor.id);
      const name = escapeMermaidLabel(actor.name);
      lines.push(`    ${actorType} ${id} as ${name}`);
    }

    lines.push('');

    // Walk through flow and generate sequence
    const visited = new Set<string>();
    this.walkFlowForSequence(flow, flow.startStep, visited, lines, 0);

    return lines.join('\n');
  }

  /**
   * Walk flow to generate sequence diagram
   */
  private walkFlowForSequence(
    flow: UserFlow,
    stepId: string,
    visited: Set<string>,
    lines: string[],
    depth: number
  ): void {
    // Prevent infinite recursion
    if (depth > 100 || visited.has(stepId)) return;
    visited.add(stepId);

    const step = flow.steps.find((s) => s.id === stepId);
    if (!step) return;

    // Default actors
    const userActor = flow.actors.find((a) => a.type === 'user');
    const systemActor = flow.actors.find((a) => a.type === 'system');
    const userId = userActor ? sanitizeId(userActor.id) : 'user';
    const systemId = systemActor ? sanitizeId(systemActor.id) : 'system';

    // Add user actions
    if (step.userActions) {
      for (const action of step.userActions) {
        if (isSafeContent(action.description)) {
          const desc = escapeMermaidLabel(action.description);
          lines.push(`    ${userId}->>${systemId}: ${desc}`);
        }
      }
    }

    // Add system behaviors
    if (step.systemBehaviors) {
      for (const behavior of step.systemBehaviors) {
        if (isSafeContent(behavior.description)) {
          const desc = escapeMermaidLabel(behavior.description);
          if (behavior.async) {
            lines.push(`    ${systemId}-->>${systemId}: ${desc}`);
          } else {
            lines.push(`    ${systemId}->>${systemId}: ${desc}`);
          }
        }
      }
    }

    // Add display
    if (step.type === 'display' && isSafeContent(step.description)) {
      const desc = escapeMermaidLabel(step.description);
      lines.push(`    ${systemId}-->>${userId}: ${desc}`);
    }

    // Continue to next steps
    const outgoing = flow.transitions.filter((t) => t.from === stepId);
    for (const transition of outgoing) {
      if (transition.condition && isSafeContent(transition.condition.label)) {
        const label = escapeMermaidLabel(transition.condition.label);
        lines.push(`    alt ${label}`);
        this.walkFlowForSequence(flow, transition.to, visited, lines, depth + 1);
        lines.push('    end');
      } else {
        this.walkFlowForSequence(flow, transition.to, visited, lines, depth + 1);
      }
    }
  }

  /**
   * Render node based on step type
   */
  private renderNode(step: FlowStep): string {
    const id = sanitizeId(step.id);
    const label = escapeMermaidLabel(step.name);

    switch (step.type) {
      case 'start':
        return `${id}((${label}))`;
      case 'end':
        return `${id}((${label}))`;
      case 'decision':
        return `${id}{${label}}`;
      case 'process':
        return `${id}[[${label}]]`;
      case 'input':
        return `${id}[/${label}/]`;
      case 'display':
        return `${id}[\\${label}\\]`;
      case 'error':
        return `${id}{{${label}}}`;
      case 'wait':
        return `${id}[|${label}|]`;
      case 'external':
        return `${id}[(${label})]`;
      case 'action':
      default:
        return `${id}[${label}]`;
    }
  }

  /**
   * Render edge with optional label
   */
  private renderEdge(transition: FlowTransition): string {
    const from = sanitizeId(transition.from);
    const to = sanitizeId(transition.to);
    const label = transition.label || transition.condition?.label;

    if (label && isSafeContent(label)) {
      return `${from} -->|${escapeMermaidLabel(label)}| ${to}`;
    }
    return `${from} --> ${to}`;
  }

  /**
   * Generate CSS styles for nodes
   */
  private generateStyles(flow: UserFlow): string[] {
    const lines: string[] = [];
    const styleGroups: Record<string, string[]> = {};

    // Group steps by type
    for (const step of flow.steps) {
      const id = sanitizeId(step.id);
      const existing = styleGroups[step.type];
      if (existing) {
        existing.push(id);
      } else {
        styleGroups[step.type] = [id];
      }
    }

    // Apply styles by type
    for (const [type, ids] of Object.entries(styleGroups)) {
      const colors = STEP_COLORS[type as keyof typeof STEP_COLORS];
      if (colors && ids.length > 0) {
        lines.push(
          `    style ${ids.join(',')} fill:${colors.fill},stroke:${colors.stroke},color:${colors.color}`
        );
      }
    }

    return lines;
  }

  /**
   * Generate HTML page with diagram
   */
  generateHtmlPage(
    flow: UserFlow,
    diagramType: DiagramType = 'flowchart'
  ): string {
    let diagram: string;
    switch (diagramType) {
      case 'state':
        diagram = this.renderStateDiagram(flow);
        break;
      case 'sequence':
        diagram = this.renderSequenceDiagram(flow);
        break;
      default:
        diagram = this.renderFlowchart(flow);
    }

    const escapedName = escapeHtml(flow.name);
    const escapedDescription = escapeHtml(flow.description);
    const escapedId = escapeHtml(flow.id);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'self' 'unsafe-inline';">
  <title>${escapedName} - User Flow</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f9fafb;
      color: #111827;
    }
    h1 {
      color: #111827;
      margin: 0 0 8px 0;
      font-size: 1.5rem;
    }
    .description {
      color: #6b7280;
      margin-bottom: 20px;
      font-size: 0.875rem;
    }
    .mermaid {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow-x: auto;
    }
    .meta {
      margin-top: 20px;
      padding: 16px;
      background: white;
      border-radius: 8px;
      font-size: 0.875rem;
      color: #6b7280;
    }
    .meta strong { color: #374151; }
    .meta-row { margin-bottom: 4px; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-approved { background: #d1fae5; color: #065f46; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <h1>${escapedName}</h1>
  <p class="description">${escapedDescription}</p>

  <div class="mermaid">
${diagram}
  </div>

  <div class="meta">
    <div class="meta-row"><strong>Flow ID:</strong> ${escapedId}</div>
    <div class="meta-row"><strong>Version:</strong> ${escapeHtml(flow.version)}</div>
    <div class="meta-row"><strong>Created:</strong> ${escapeHtml(flow.createdAt)}</div>
    <div class="meta-row"><strong>Steps:</strong> ${flow.steps.length}</div>
    <div class="meta-row"><strong>Transitions:</strong> ${flow.transitions.length}</div>
    <div class="meta-row">
      <strong>Status:</strong>
      <span class="badge badge-${flow.approval.status}">${flow.approval.status}</span>
    </div>
  </div>

  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: '${this.style.theme}',
      securityLevel: 'strict'
    });
  </script>
</body>
</html>`;
  }

  /**
   * Render diagram as SVG string (for embedding)
   */
  renderDiagramCode(
    flow: UserFlow,
    diagramType: DiagramType = 'flowchart'
  ): string {
    switch (diagramType) {
      case 'state':
        return this.renderStateDiagram(flow);
      case 'sequence':
        return this.renderSequenceDiagram(flow);
      default:
        return this.renderFlowchart(flow);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a diagram renderer with default options
 */
export function createDiagramRenderer(
  options?: Partial<DiagramStyle>
): DiagramRenderer {
  return new DiagramRenderer(options);
}

/**
 * Render a flow as a flowchart (convenience function)
 */
export function renderFlowchart(
  flow: UserFlow,
  options?: Partial<DiagramStyle>
): string {
  const renderer = new DiagramRenderer(options);
  return renderer.renderFlowchart(flow);
}

/**
 * Render a flow as a state diagram (convenience function)
 */
export function renderStateDiagram(
  flow: UserFlow,
  options?: Partial<DiagramStyle>
): string {
  const renderer = new DiagramRenderer(options);
  return renderer.renderStateDiagram(flow);
}

/**
 * Render a flow as a sequence diagram (convenience function)
 */
export function renderSequenceDiagram(
  flow: UserFlow,
  options?: Partial<DiagramStyle>
): string {
  const renderer = new DiagramRenderer(options);
  return renderer.renderSequenceDiagram(flow);
}

/**
 * Generate an HTML page for a flow (convenience function)
 */
export function generateFlowHtmlPage(
  flow: UserFlow,
  diagramType: DiagramType = 'flowchart',
  options?: Partial<DiagramStyle>
): string {
  const renderer = new DiagramRenderer(options);
  return renderer.generateHtmlPage(flow, diagramType);
}
