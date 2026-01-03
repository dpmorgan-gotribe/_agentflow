/**
 * JSON Sanitizer
 *
 * Preprocesses LLM JSON output to fix common issues before Zod validation:
 * - Converts string booleans ("true", "false") to actual booleans
 * - Extracts primary values from nested objects (e.g., { primary: "#fff" } -> "#fff")
 * - Converts objects to arrays where arrays are expected
 *
 * This is necessary because LLMs sometimes output incorrect JSON types.
 */

/**
 * Fields that should be booleans but might come as strings
 */
const BOOLEAN_FIELDS = new Set([
  'ariaExpanded',
  'ariaHidden',
  'ariaPressed',
  'ariaSelected',
  'ariaDisabled',
  'isRequired',
  'isDisabled',
  'isChecked',
  'isOpen',
  'isLoading',
  'isActive',
  'isDark',
  'autoFocus',
  'disabled',
  'required',
  'checked',
  'readOnly',
  'multiple',
]);

/**
 * Fields that should be simple strings but might come as objects
 */
const STRING_FIELDS_WITH_PRIMARY = new Set([
  'primary',
  'secondary',
  'accent',
  'background',
  'surface',
  'text',
  'textSecondary',
  'error',
  'warning',
  'success',
  'info',
  'border',
  'muted',
]);

/**
 * Fields that should be arrays but might come as objects
 */
const ARRAY_FIELDS = new Set([
  'variants',
  'children',
  'pages',
  'components',
  'sharedComponents',
  'screens',
  'flows',
  'items',
  'options',
]);

/**
 * Typography fields that should be font stack strings
 * Claude often returns these as objects like { heading: "...", body: "..." }
 */
const TYPOGRAPHY_STRING_FIELDS = new Set([
  'fontFamily',
  'headingFamily',
  'monoFamily',
]);

/**
 * CSS value fields that should be strings but Claude often returns as numbers
 * e.g., "gap": 0 instead of "gap": "0"
 */
const CSS_VALUE_FIELDS = new Set([
  'gap',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'borderWidth',
  'borderRadius',
  'fontSize',
  'letterSpacing',
]);

/**
 * Fields that should remain unitless even when numeric
 * (line-height, z-index, opacity, scale ratios)
 */
const UNITLESS_FIELDS = new Set([
  'lineHeight',
  'scaleRatio',
  'opacity',
  'zIndex',
  'fontWeight',
  'order',
  'flexGrow',
  'flexShrink',
]);

/**
 * Convert a string to boolean if it represents a boolean value
 */
function stringToBoolean(value: unknown): unknown {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
  }
  return value;
}

/**
 * Extract primary value from an object if it has one
 */
function extractPrimaryValue(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if ('primary' in obj && typeof obj['primary'] === 'string') {
      return obj['primary'];
    }
    if ('DEFAULT' in obj && typeof obj['DEFAULT'] === 'string') {
      return obj['DEFAULT'];
    }
  }
  return value;
}

/**
 * Convert an object to an array if it should be an array
 */
function objectToArray(value: unknown, fieldName: string): unknown {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Convert object with named keys to array
    // e.g., { primary: {...}, secondary: {...} } -> [{ name: 'primary', ...}, { name: 'secondary', ...}]
    return Object.entries(obj).map(([name, item]) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return { name, ...(item as Record<string, unknown>) };
      }
      return { name, value: item };
    });
  }
  return value;
}

/**
 * Convert a font object to a font stack string
 *
 * Claude often returns typography font fields as objects:
 * - { heading: "Cormorant", body: "Satoshi" } -> "Cormorant, Satoshi, sans-serif"
 * - { primary: "Inter" } -> "Inter, sans-serif"
 * - ["Inter", "Roboto"] -> "Inter, Roboto, sans-serif"
 * - "Inter" -> "Inter" (already correct, return as-is)
 */
function fontObjectToString(value: unknown): string | unknown {
  // Already a string - return as-is
  if (typeof value === 'string') {
    return value;
  }

  // Array of fonts -> join with comma and add fallback
  if (Array.isArray(value)) {
    const fonts = value.filter((f): f is string => typeof f === 'string');
    const firstFont = fonts[0];
    if (firstFont) {
      const fallback = firstFont.toLowerCase().includes('mono') ? 'monospace' : 'sans-serif';
      return fonts.join(', ') + ', ' + fallback;
    }
    return value;
  }

  // Object with font properties -> extract and join
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const fonts: string[] = [];

    // Extract fonts in priority order (heading first, then body, etc.)
    const priorityKeys = ['heading', 'display', 'primary', 'body', 'secondary', 'mono', 'code'];
    for (const key of priorityKeys) {
      if (key in obj && typeof obj[key] === 'string') {
        fonts.push(obj[key] as string);
      }
    }

    // Also include any other string values not in priority list
    for (const [key, val] of Object.entries(obj)) {
      if (!priorityKeys.includes(key) && typeof val === 'string') {
        fonts.push(val);
      }
    }

    const firstFont = fonts[0];
    if (firstFont) {
      // Add fallback based on first font type
      const fallback = firstFont.toLowerCase().includes('mono') ? 'monospace' : 'sans-serif';
      return fonts.join(', ') + ', ' + fallback;
    }
  }

  // Return unchanged if we can't convert
  return value;
}

/**
 * Convert a number to a CSS value string
 *
 * Claude often returns CSS values as numbers:
 * - 0 -> "0"
 * - 16 -> "16px" (add px for non-zero numbers)
 * - "16px" -> "16px" (already correct)
 *
 * @param value The value to convert
 * @param fieldName The field name (to check if unitless)
 */
function toCSSValue(value: unknown, fieldName: string): string | unknown {
  // Already a string - return as-is
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    // 0 stays as "0" (no units needed)
    if (value === 0) {
      return '0';
    }

    // Check if this field should be unitless
    if (UNITLESS_FIELDS.has(fieldName)) {
      return String(value);
    }

    // Add 'px' for dimensional values
    return `${value}px`;
  }

  // Return unchanged if we can't convert
  return value;
}

/**
 * Recursively sanitize JSON data to fix common LLM output issues
 */
export function sanitizeLLMJson(data: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 50) return data;

  // Handle null/undefined
  if (data === null || data === undefined) return data;

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLLMJson(item, depth + 1));
  }

  // Handle objects
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      let sanitizedValue = value;

      // Convert string booleans to actual booleans
      if (BOOLEAN_FIELDS.has(key)) {
        sanitizedValue = stringToBoolean(sanitizedValue);
      }

      // Extract primary value from nested objects for color fields
      if (STRING_FIELDS_WITH_PRIMARY.has(key) && typeof value === 'object') {
        sanitizedValue = extractPrimaryValue(sanitizedValue);
      }

      // Convert objects to arrays for array fields
      if (ARRAY_FIELDS.has(key) && typeof value === 'object' && !Array.isArray(value)) {
        sanitizedValue = objectToArray(sanitizedValue, key);
      }

      // Convert typography font objects to font stack strings
      // e.g., { heading: "Font1", body: "Font2" } -> "Font1, Font2, sans-serif"
      if (TYPOGRAPHY_STRING_FIELDS.has(key) && typeof value === 'object') {
        sanitizedValue = fontObjectToString(sanitizedValue);
      }

      // Convert numeric CSS values to strings
      // e.g., "gap": 0 -> "gap": "0", "gap": 16 -> "gap": "16px"
      if (CSS_VALUE_FIELDS.has(key) && typeof sanitizedValue === 'number') {
        sanitizedValue = toCSSValue(sanitizedValue, key);
      }

      // Recursively sanitize nested values
      result[key] = sanitizeLLMJson(sanitizedValue, depth + 1);
    }

    return result;
  }

  // Return primitives as-is
  return data;
}

/**
 * Parse JSON with sanitization for LLM output
 */
export function parseLLMJson<T = unknown>(jsonString: string): T {
  const parsed = JSON.parse(jsonString);
  return sanitizeLLMJson(parsed) as T;
}

/**
 * Sanitize data for UI Designer output specifically
 */
export function sanitizeUIDesignerOutput(data: unknown): unknown {
  return sanitizeLLMJson(data);
}
