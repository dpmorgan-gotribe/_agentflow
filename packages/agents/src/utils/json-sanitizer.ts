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
