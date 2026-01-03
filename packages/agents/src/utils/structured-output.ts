/**
 * Structured Output Utilities
 *
 * Provides consistent structured output handling for all agents.
 * Ensures Claude CLI returns properly formatted JSON that matches Zod schemas.
 *
 * Key Features:
 * - JSON-only output instruction formatting
 * - Robust JSON extraction from various formats
 * - Parse retry with clearer prompting
 * - Schema validation with detailed errors
 */

import type { z } from 'zod';

/**
 * Standard output instruction to append to system prompts
 * Forces Claude to output only valid JSON
 */
export const STRUCTURED_OUTPUT_INSTRUCTION = `

CRITICAL OUTPUT REQUIREMENTS:
1. You MUST output ONLY valid JSON - no markdown, no prose, no explanations
2. Start your response with { and end with }
3. Do NOT wrap the JSON in code blocks (no \`\`\`json or \`\`\`)
4. Do NOT include any text before or after the JSON
5. Ensure all strings are properly escaped
6. Include ALL required fields from the schema`;

/**
 * Build a structured output system prompt suffix with schema example
 */
export function buildStructuredOutputPrompt<T>(
  schemaDescription: string,
  exampleOutput: T
): string {
  return `${STRUCTURED_OUTPUT_INSTRUCTION}

REQUIRED OUTPUT FORMAT:
${schemaDescription}

EXAMPLE OUTPUT (follow this structure exactly):
${JSON.stringify(exampleOutput, null, 2)}

Remember: Output ONLY the JSON object, nothing else.`;
}

/**
 * Extract JSON from various response formats
 *
 * Handles:
 * - Clean JSON: {"key": "value"}
 * - Markdown wrapped: ```json\n{"key": "value"}\n```
 * - Prose + JSON: "Here is the result:\n{"key": "value"}"
 * - JSON followed by explanation text
 * - Multiple JSON blocks (takes first complete one)
 */
export function extractJSON(text: string): string {
  // Trim whitespace
  const cleaned = text.trim();

  // Fast path: If starts with { or [ and is valid JSON, use it directly
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {
      // Continue to more robust extraction
    }
  }

  // Try to extract from markdown code block first
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch?.[1]) {
    const extracted = codeBlockMatch[1].trim();
    if (extracted.startsWith('{') || extracted.startsWith('[')) {
      try {
        JSON.parse(extracted);
        return extracted;
      } catch {
        // Continue to balanced extraction
      }
    }
  }

  // Use balanced JSON extraction for objects (handles JSON followed by text)
  if (cleaned.includes('{')) {
    const extracted = extractBalancedJSON(cleaned, '{', '}');
    try {
      JSON.parse(extracted);
      return extracted;
    } catch {
      // Continue to array check
    }
  }

  // Use balanced JSON extraction for arrays
  if (cleaned.includes('[')) {
    const extracted = extractBalancedJSON(cleaned, '[', ']');
    try {
      JSON.parse(extracted);
      return extracted;
    } catch {
      // Fall through
    }
  }

  // Return as-is if no valid JSON found
  return cleaned;
}

/**
 * Extract balanced JSON by counting braces/brackets
 */
function extractBalancedJSON(
  text: string,
  openChar: string,
  closeChar: string
): string {
  const startIndex = text.indexOf(openChar);
  if (startIndex === -1) return text;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === openChar) {
      depth++;
    } else if (char === closeChar) {
      depth--;
      if (depth === 0) {
        return text.substring(startIndex, i + 1);
      }
    }
  }

  // Unbalanced, return from start
  return text.substring(startIndex);
}

/**
 * Parse and validate JSON with a Zod schema
 * Returns detailed error information on failure
 */
export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    jsonError?: string;
    zodErrors?: string[];
    rawContent: string;
    extractedJSON?: string;
  };
}

export function parseWithSchema<T>(
  rawContent: string,
  schema: z.ZodSchema<T>
): ParseResult<T> {
  // Extract JSON from content
  const extracted = extractJSON(rawContent);

  // Try to parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted);
  } catch (jsonError) {
    return {
      success: false,
      error: {
        message: 'Failed to parse JSON from response',
        jsonError: jsonError instanceof Error ? jsonError.message : String(jsonError),
        rawContent: rawContent.substring(0, 500),
        extractedJSON: extracted.substring(0, 500),
      },
    };
  }

  // Validate with Zod schema
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      error: {
        message: 'JSON does not match expected schema',
        zodErrors: result.error.errors.map(
          (e) => `${e.path.join('.')}: ${e.message}`
        ),
        rawContent: rawContent.substring(0, 500),
        extractedJSON: extracted.substring(0, 500),
      },
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Generate a retry prompt for when structured output fails
 */
export function generateRetryPrompt<T>(
  originalPrompt: string,
  parseError: ParseResult<T>['error'],
  schemaDescription: string
): string {
  const errors = parseError?.zodErrors?.join('\n  - ') || parseError?.jsonError || 'Unknown error';

  return `Your previous response could not be parsed as valid JSON.

ERRORS:
  - ${errors}

ORIGINAL REQUEST:
${originalPrompt}

REQUIRED FORMAT:
${schemaDescription}

Please respond with ONLY a valid JSON object. Do not include:
- Any text before or after the JSON
- Markdown code blocks
- Explanations or commentary

Start your response with { and end with }`;
}

/**
 * Common schema descriptions for agent outputs
 */
export const SCHEMA_DESCRIPTIONS = {
  orchestrator: `{
  "taskClassification": {
    "type": "feature"|"bugfix"|"refactor"|"research"|"deployment"|"config",
    "complexity": "trivial"|"simple"|"moderate"|"complex"|"epic",
    "requiresDesign": boolean,
    "requiresArchitecture": boolean,
    "requiresCompliance": boolean,
    "estimatedAgents": number,
    "confidence": number (0-1)
  },
  "routingDecision": {
    "nextAgent": string,
    "reason": string,
    "priority": number
  },
  "state": {
    "phase": "analyzing"|"planning"|"designing"|"building"|"testing"|"reviewing"|"complete",
    "completedAgents": string[],
    "pendingAgents": string[],
    "approvalsPending": string[],
    "failureCount": number,
    "lastDecision": string,
    "totalTokensUsed": number,
    "iterationCount": number
  },
  "routingHints": {
    "suggestNext": string[],
    "skipAgents": string[],
    "needsApproval": boolean,
    "hasFailures": boolean,
    "isComplete": boolean,
    "blockedBy": string (optional),
    "notes": string (optional)
  }
}`,

  architect: `{
  "techStack": {
    "frontend": { "framework": {...}, "language": {...}, "styling": {...} },
    "backend": { "framework": {...}, "language": {...} },
    "database": { "primary": {...} },
    "testing": { "unit": {...} }
  },
  "adrs": [
    {
      "id": "ADR-0001",
      "title": "string",
      "status": "proposed"|"accepted"|"deprecated"|"superseded",
      "date": "YYYY-MM-DD",
      "context": "string",
      "decision": "string",
      "consequences": { "positive": [], "negative": [], "risks": [] },
      "alternatives": [{ "option": "string", "pros": [], "cons": [] }],
      "relatedADRs": []
    }
  ],
  "components": [...],
  "directoryStructure": { "path": "string", "description": "string", "children": [...] },
  "codingConventions": {...},
  "securityConsiderations": string[],
  "scalabilityNotes": string[],
  "routingHints": {...}
}`,

  projectManager: `{
  "workBreakdown": {
    "epics": [
      {
        "id": "string",
        "title": "string",
        "description": "string",
        "priority": "critical"|"high"|"medium"|"low",
        "features": [...]
      }
    ]
  },
  "summary": {
    "totalEpics": number,
    "totalFeatures": number,
    "totalTasks": number,
    "estimatedComplexity": "trivial"|"simple"|"moderate"|"complex"|"epic",
    "criticalPath": string[]
  },
  "routingHints": {
    "suggestNext": string[],
    "skipAgents": string[],
    "needsApproval": boolean,
    "hasFailures": boolean,
    "isComplete": boolean,
    "notes": string
  }
}`,

  analyst: `{
  "reportType": "comparison"|"best_practices"|"investigation"|"recommendation"|"feasibility",
  "title": "string",
  "summary": "string",
  "findings": [
    {
      "title": "string",
      "description": "string",
      "evidence": string[],
      "confidence": number (0-1)
    }
  ],
  "recommendations": [
    {
      "title": "string",
      "description": "string",
      "priority": "critical"|"high"|"medium"|"low",
      "implementation": string[],
      "alternatives": string[]
    }
  ],
  "sources": [
    {
      "title": "string",
      "url": "string",
      "credibility": "official"|"expert"|"community"|"unknown",
      "type": "documentation"|"article"|"paper"|"repository"|"discussion"
    }
  ],
  "routingHints": {...}
}`,

  uiDesigner: `{
  "designTokens": {
    "colors": { "primary": {...}, "secondary": {...}, ... },
    "typography": { "fontFamily": {...}, "fontSize": {...} },
    "spacing": {...}
  },
  "mockups": [
    {
      "id": "string",
      "name": "string",
      "type": "page"|"component"|"layout",
      "html": "string (valid HTML)"
    }
  ],
  "components": [
    {
      "id": "string",
      "name": "string",
      "type": "button"|"input"|"card"|...,
      "html": "string",
      "css": "string"
    }
  ],
  "routingHints": {...}
}`,
};

/**
 * Wrap a system prompt with structured output instructions
 */
export function wrapSystemPrompt(
  basePrompt: string,
  agentType: keyof typeof SCHEMA_DESCRIPTIONS
): string {
  const schemaDescription = SCHEMA_DESCRIPTIONS[agentType];
  if (!schemaDescription) {
    return basePrompt + STRUCTURED_OUTPUT_INSTRUCTION;
  }

  return `${basePrompt}

${STRUCTURED_OUTPUT_INSTRUCTION}

REQUIRED OUTPUT SCHEMA:
${schemaDescription}`;
}
