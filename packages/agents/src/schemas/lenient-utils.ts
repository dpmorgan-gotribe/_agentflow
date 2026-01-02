/**
 * Lenient Schema Utilities
 *
 * Provides reusable Zod schema builders that accept flexible input formats
 * and normalize them to expected types. These utilities help prevent
 * validation failures when Claude's JSON output varies slightly from
 * our strict schema definitions.
 *
 * Usage:
 * - Use these utilities instead of strict z.enum(), z.array(), etc.
 * - All utilities have sensible fallbacks and never throw on valid-ish input
 */

import { z } from 'zod';

/**
 * Lenient enum that fuzzy-matches values and falls back to default
 *
 * Features:
 * - Case-insensitive matching
 * - Ignores hyphens, underscores, and spaces
 * - Falls back to provided default if no match
 *
 * @example
 * const PhaseSchema = lenientEnum(['analyzing', 'planning', 'designing'], 'analyzing');
 * PhaseSchema.parse('ANALYZING') // 'analyzing'
 * PhaseSchema.parse('Analyzing') // 'analyzing'
 * PhaseSchema.parse('unknown') // 'analyzing' (fallback)
 */
export function lenientEnum<T extends string>(
  values: readonly T[],
  fallback: T
): z.ZodEffects<z.ZodString, T, string> {
  return z.string().transform((val): T => {
    // Normalize input for comparison
    const normalizedInput = val.toLowerCase().replace(/[-_\s]/g, '');

    // Try to find a matching value
    const match = values.find(
      (v) => v.toLowerCase().replace(/[-_\s]/g, '') === normalizedInput
    );

    return match ?? fallback;
  });
}

/**
 * Lenient enum that also accepts the value directly (for pre-validated data)
 */
export function lenientEnumWithPassthrough<T extends string>(
  values: readonly T[],
  fallback: T
): z.ZodPipeline<z.ZodUnion<[z.ZodEnum<[T, ...T[]]>, z.ZodEffects<z.ZodString, T, string>]>, z.ZodEnum<[T, ...T[]]>> {
  return z.union([
    z.enum(values as [T, ...T[]]),
    lenientEnum(values, fallback),
  ]).pipe(z.enum(values as [T, ...T[]]));
}

/**
 * Lenient array that accepts various input formats
 *
 * Features:
 * - Accepts array of items
 * - Accepts single item (wraps in array)
 * - Accepts null/undefined (returns empty array)
 * - Never fails, falls back to empty array
 *
 * @example
 * const TagsSchema = lenientArray(z.string());
 * TagsSchema.parse(['a', 'b']) // ['a', 'b']
 * TagsSchema.parse('single') // ['single']
 * TagsSchema.parse(null) // []
 * TagsSchema.parse(undefined) // []
 */
export function lenientArray<T extends z.ZodTypeAny>(
  schema: T
): z.ZodCatch<z.ZodArray<T>> {
  return z.preprocess((val) => {
    if (val === null || val === undefined) return [];
    if (Array.isArray(val)) return val;
    return [val];
  }, z.array(schema)).catch([]);
}

/**
 * Lenient array that filters out invalid items instead of failing
 *
 * @example
 * const NumsSchema = lenientArrayFilter(z.number());
 * NumsSchema.parse([1, 'invalid', 2]) // [1, 2]
 */
export function lenientArrayFilter<T extends z.ZodTypeAny>(
  schema: T
): z.ZodEffects<z.ZodArray<z.ZodAny>, z.infer<T>[], unknown[]> {
  return z.array(z.any()).transform((arr) => {
    const results: z.infer<T>[] = [];
    for (const item of arr) {
      const parsed = schema.safeParse(item);
      if (parsed.success) {
        results.push(parsed.data);
      }
    }
    return results;
  });
}

/**
 * Lenient object-or-string schema
 *
 * Accepts either a full object or a string that gets converted to an object
 * with the string as a specified field value.
 *
 * @example
 * const InterfaceSchema = z.object({
 *   name: z.string(),
 *   type: z.string().default('function'),
 *   description: z.string().default(''),
 * });
 * const LenientInterface = lenientObjectOrString(InterfaceSchema, 'name');
 *
 * LenientInterface.parse({ name: 'IAuth', type: 'api' }) // { name: 'IAuth', type: 'api', description: '' }
 * LenientInterface.parse('IAuth') // { name: 'IAuth', type: 'function', description: '' }
 */
export function lenientObjectOrString<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  nameField: keyof z.infer<T>
): z.ZodUnion<[T, z.ZodEffects<z.ZodString, z.infer<T>, string>]> {
  return z.union([
    schema,
    z.string().transform((name) => {
      // Create a minimal object with just the name field
      // The schema's defaults will fill in the rest
      const obj = { [nameField]: name } as Record<string, unknown>;
      return schema.parse(obj) as z.infer<T>;
    }),
  ]);
}

/**
 * Lenient number that accepts strings
 *
 * @example
 * lenientNumber.parse(42) // 42
 * lenientNumber.parse('42') // 42
 * lenientNumber.parse('42.5') // 42.5
 * lenientNumber.parse('invalid') // 0
 */
export const lenientNumber = z.union([
  z.number(),
  z.string().transform((s) => {
    const parsed = parseFloat(s);
    return isNaN(parsed) ? 0 : parsed;
  }),
]).pipe(z.number());

/**
 * Lenient integer that accepts strings and floats
 */
export const lenientInt = z.union([
  z.number(),
  z.string().transform((s) => {
    const parsed = parseInt(s, 10);
    return isNaN(parsed) ? 0 : parsed;
  }),
]).pipe(z.number().int());

/**
 * Lenient boolean that accepts various truthy/falsy representations
 *
 * @example
 * lenientBoolean.parse(true) // true
 * lenientBoolean.parse('true') // true
 * lenientBoolean.parse('yes') // true
 * lenientBoolean.parse(1) // true
 * lenientBoolean.parse('false') // false
 * lenientBoolean.parse(0) // false
 */
export const lenientBoolean = z.union([
  z.boolean(),
  z.string().transform((s) => {
    const lower = s.toLowerCase().trim();
    return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'on';
  }),
  z.number().transform((n) => n !== 0),
]).pipe(z.boolean()).catch(false);

/**
 * Lenient ID that normalizes to lowercase-kebab format
 *
 * Features:
 * - Converts to lowercase
 * - Replaces invalid characters with hyphens
 * - Removes leading/trailing hyphens
 * - Collapses multiple hyphens
 *
 * @example
 * lenientId().parse('My Feature ID') // 'my-feature-id'
 * lenientId().parse('TASK_001') // 'task-001'
 * lenientId().parse('--invalid--') // 'invalid'
 */
export function lenientId(maxLength = 100): z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString> {
  return z.string().transform((id) =>
    id
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, maxLength) || 'unnamed'
  ).pipe(z.string().min(1).max(maxLength));
}

/**
 * Lenient path that accepts various path formats
 *
 * Features:
 * - Normalizes backslashes to forward slashes
 * - Allows more characters than strict regex
 * - Falls back to empty string
 *
 * @example
 * lenientPath().parse('src\\components\\Button.tsx') // 'src/components/Button.tsx'
 * lenientPath().parse('/absolute/path') // '/absolute/path'
 */
export function lenientPath(maxLength = 500): z.ZodCatch<z.ZodEffects<z.ZodString, string, string>> {
  return z.string().transform((path) =>
    path.replace(/\\/g, '/').slice(0, maxLength)
  ).catch('');
}

/**
 * Lenient confidence/percentage value clamped to 0-1
 *
 * Features:
 * - Accepts numbers or string numbers
 * - Clamps to 0-1 range
 * - Falls back to 0.5 on invalid input
 *
 * @example
 * lenientConfidence.parse(0.75) // 0.75
 * lenientConfidence.parse('0.8') // 0.8
 * lenientConfidence.parse(1.5) // 1 (clamped)
 * lenientConfidence.parse(-0.5) // 0 (clamped)
 * lenientConfidence.parse('invalid') // 0.5 (fallback)
 */
export const lenientConfidence = z.union([
  z.number(),
  z.string().transform((s) => parseFloat(s)),
]).transform((n) => {
  if (isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}).catch(0.5);

/**
 * Lenient string that accepts any primitive and converts to string
 *
 * @example
 * lenientString().parse('hello') // 'hello'
 * lenientString().parse(42) // '42'
 * lenientString().parse(null) // ''
 */
export function lenientString(maxLength = 10000): z.ZodCatch<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull, z.ZodUndefined]>, string, string | number | boolean | null | undefined>> {
  return z.union([
    z.string(),
    z.number().transform(String),
    z.boolean().transform(String),
    z.null().transform(() => ''),
    z.undefined().transform(() => ''),
  ]).transform((s) => s.slice(0, maxLength)).catch('');
}

/**
 * Lenient URL that accepts various URL formats
 *
 * Falls back to empty string if invalid
 */
export const lenientUrl = z.string().transform((url) => {
  try {
    // Try to parse as URL
    new URL(url);
    return url;
  } catch {
    // If it looks like a relative URL or path, keep it
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
      return url;
    }
    // Try adding https://
    try {
      new URL(`https://${url}`);
      return `https://${url}`;
    } catch {
      return '';
    }
  }
}).catch('');

/**
 * Lenient date string that accepts various date formats
 *
 * Falls back to current date if invalid
 */
export const lenientDateString = z.string().transform((date) => {
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return new Date().toISOString().split('T')[0]!;
  }
  return parsed.toISOString().split('T')[0]!;
}).catch(() => new Date().toISOString().split('T')[0]!);

/**
 * Helper to make any schema optional with a default value
 *
 * @example
 * const schema = withDefault(z.string(), 'default');
 * schema.parse(undefined) // 'default'
 * schema.parse('value') // 'value'
 */
export function withDefault<T extends z.ZodTypeAny>(
  schema: T,
  defaultValue: z.infer<T>
): z.ZodCatch<z.ZodDefault<T>> {
  return schema.default(defaultValue).catch(defaultValue);
}

/**
 * Helper to make a schema that accepts the value or null/undefined
 */
export function nullable<T extends z.ZodTypeAny>(
  schema: T,
  defaultValue: z.infer<T>
): z.ZodCatch<z.ZodNullable<z.ZodOptional<T>>> {
  return schema.optional().nullable().catch(defaultValue);
}
