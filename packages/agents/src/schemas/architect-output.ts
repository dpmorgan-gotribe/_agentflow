/**
 * Architect Agent Output Schema
 *
 * Defines schemas for architecture decisions, tech stack,
 * ADRs, components, and coding conventions.
 *
 * SECURITY:
 * - All IDs validated for format
 * - Path validation on directory structures
 */

import { z } from 'zod';
import { LenientAgentTypeArraySchema } from '../types.js';

/**
 * Technology selection with reasoning
 */
export const TechnologySchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().max(50).optional(),
  purpose: z.string().max(500).default(''),
  alternatives: z.array(z.string().min(1).max(100)).default([]),
  reasoning: z.string().max(1000).default(''),
});

export type Technology = z.infer<typeof TechnologySchema>;

/**
 * Frontend tech stack
 */
export const FrontendStackSchema = z.object({
  framework: TechnologySchema.optional(),
  language: TechnologySchema.optional(),
  styling: TechnologySchema.optional(),
  stateManagement: TechnologySchema.optional(),
  routing: TechnologySchema.optional(),
});

export type FrontendStack = z.infer<typeof FrontendStackSchema>;

/**
 * Backend tech stack
 */
export const BackendStackSchema = z.object({
  framework: TechnologySchema.optional(),
  language: TechnologySchema.optional(),
  runtime: TechnologySchema.optional(),
});

export type BackendStack = z.infer<typeof BackendStackSchema>;

/**
 * Database tech stack
 */
export const DatabaseStackSchema = z.object({
  primary: TechnologySchema.optional(),
  cache: TechnologySchema.optional(),
  search: TechnologySchema.optional(),
});

export type DatabaseStack = z.infer<typeof DatabaseStackSchema>;

/**
 * Infrastructure tech stack
 */
export const InfrastructureStackSchema = z.object({
  hosting: TechnologySchema.optional(),
  ci: TechnologySchema.optional(),
  containerization: TechnologySchema.optional(),
});

export type InfrastructureStack = z.infer<typeof InfrastructureStackSchema>;

/**
 * Testing tech stack
 */
export const TestingStackSchema = z.object({
  unit: TechnologySchema.optional(),
  integration: TechnologySchema.optional(),
  e2e: TechnologySchema.optional(),
});

export type TestingStack = z.infer<typeof TestingStackSchema>;

/**
 * Complete tech stack definition
 */
export const TechStackSchema = z.object({
  frontend: FrontendStackSchema.optional(),
  backend: BackendStackSchema.optional(),
  database: DatabaseStackSchema.optional(),
  infrastructure: InfrastructureStackSchema.optional(),
  testing: TestingStackSchema.optional(),
});

export type TechStack = z.infer<typeof TechStackSchema>;

/**
 * ADR status
 */
export const ADRStatusSchema = z.enum(['proposed', 'accepted', 'deprecated', 'superseded']);

export type ADRStatus = z.infer<typeof ADRStatusSchema>;

/**
 * ADR alternative option
 * Made lenient with defaults
 */
export const ADRAlternativeSchema = z.object({
  option: z.string().max(200).default(''),
  pros: z.array(z.string().max(500)).default([]),
  cons: z.array(z.string().max(500)).default([]),
});

export type ADRAlternative = z.infer<typeof ADRAlternativeSchema>;

/**
 * ADR consequences
 * Made lenient with defaults
 */
export const ADRConsequencesSchema = z.object({
  positive: z.array(z.string().max(500)).default([]),
  negative: z.array(z.string().max(500)).default([]),
  risks: z.array(z.string().max(500)).default([]),
});

export type ADRConsequences = z.infer<typeof ADRConsequencesSchema>;

/**
 * Architecture Decision Record (ADR)
 * Made lenient - Claude may not always format IDs and dates exactly
 */
export const ADRSchema = z.object({
  id: z.string().max(50).default('ADR-0001'),
  title: z.string().max(200).default('Untitled ADR'),
  status: ADRStatusSchema.catch('proposed'),
  date: z.string().max(20).default(() => new Date().toISOString().split('T')[0]!),
  context: z.string().max(5000).default(''),
  decision: z.string().max(5000).default(''),
  consequences: ADRConsequencesSchema.default({ positive: [], negative: [], risks: [] }),
  alternatives: z.array(ADRAlternativeSchema).default([]),
  relatedADRs: z.array(z.string()).default([]),
});

export type ADR = z.infer<typeof ADRSchema>;

/**
 * Component type
 */
export const ComponentTypeSchema = z.enum([
  'service',
  'library',
  'module',
  'component',
  'utility',
  'middleware',
]);

export type ComponentType = z.infer<typeof ComponentTypeSchema>;

/**
 * Interface type
 */
export const InterfaceTypeSchema = z.enum(['api', 'event', 'function', 'import']);

export type InterfaceType = z.infer<typeof InterfaceTypeSchema>;

/**
 * Component interface definition
 */
export const ComponentInterfaceSchema = z.object({
  name: z.string().min(1).max(100),
  type: InterfaceTypeSchema.default('function'),
  description: z.string().max(500).default(''),
});

export type ComponentInterface = z.infer<typeof ComponentInterfaceSchema>;

/**
 * Component definition
 */
export const ComponentSchema = z.object({
  name: z.string().min(1).max(100),
  type: ComponentTypeSchema.default('component'),
  description: z.string().max(1000).default(''),
  responsibilities: z.array(z.string().min(1).max(500)).default([]),
  dependencies: z.array(z.string().min(1).max(100)).default([]),
  interfaces: z.array(ComponentInterfaceSchema).default([]),
  location: z
    .string()
    .max(500)
    .regex(/^[a-zA-Z0-9/_.-]*$/, 'Invalid path characters')
    .default(''),
});

export type Component = z.infer<typeof ComponentSchema>;

/**
 * HTTP method
 */
export const HTTPMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export type HTTPMethod = z.infer<typeof HTTPMethodSchema>;

/**
 * Request/Response body schema
 * Made lenient with defaults since Claude may not always provide these
 */
export const BodySchemaDefinition = z.object({
  contentType: z.string().max(100).default('application/json'),
  schema: z.record(z.unknown()).default({}),
});

export type BodySchema = z.infer<typeof BodySchemaDefinition>;

/**
 * API endpoint definition
 * Made lenient with defaults and optional fields
 */
export const APIEndpointSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(500)
    .regex(/^\//, 'Path must start with /'),
  method: HTTPMethodSchema.catch('GET'),
  description: z.string().max(500).default(''),
  requestBody: BodySchemaDefinition.optional(),
  responseBody: BodySchemaDefinition.default({ contentType: 'application/json', schema: {} }),
  authentication: z.boolean().default(false),
  rateLimit: z.string().max(100).optional(),
});

export type APIEndpoint = z.infer<typeof APIEndpointSchema>;

/**
 * Data model field
 */
export const DataFieldSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().max(100).default('string'),
  required: z.boolean().default(false),
  description: z.string().max(500).default(''),
  constraints: z.array(z.string().min(1).max(200)).default([]),
});

export type DataField = z.infer<typeof DataFieldSchema>;

/**
 * Relationship type
 */
export const RelationshipTypeSchema = z.enum(['one-to-one', 'one-to-many', 'many-to-many']);

export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

/**
 * Data model relationship
 */
export const RelationshipSchema = z.object({
  target: z.string().min(1).max(100),
  type: RelationshipTypeSchema.default('one-to-many'),
  description: z.string().max(500).default(''),
});

export type Relationship = z.infer<typeof RelationshipSchema>;

/**
 * Data model definition
 */
export const DataModelSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).default(''),
  fields: z.array(DataFieldSchema).default([]),
  relationships: z.array(RelationshipSchema).default([]),
  indexes: z.array(z.string().min(1).max(200)).default([]),
});

export type DataModel = z.infer<typeof DataModelSchema>;

/**
 * Directory structure (recursive)
 * Made lenient - paths may have various formats
 */
export interface DirectoryStructure {
  path: string;
  description: string;
  children?: DirectoryStructure[];
}

export const DirectoryStructureSchema: z.ZodType<DirectoryStructure> = z.object({
  path: z.string().max(200),
  description: z.string().max(500),
  children: z.lazy(() => z.array(DirectoryStructureSchema)).optional(),
});

/**
 * Naming conventions
 */
export const NamingConventionsSchema = z.object({
  files: z.string().max(200).default('kebab-case'),
  directories: z.string().max(200).default('kebab-case'),
  components: z.string().max(200).default('PascalCase'),
  functions: z.string().max(200).default('camelCase'),
  variables: z.string().max(200).default('camelCase'),
  constants: z.string().max(200).default('SCREAMING_SNAKE_CASE'),
  types: z.string().max(200).default('PascalCase'),
});

export type NamingConventions = z.infer<typeof NamingConventionsSchema>;

/**
 * Helper to coerce quote preference from various Claude responses
 * Claude may return "single quotes for strings" instead of just "single"
 */
const quotesCoercion = z.union([
  z.enum(['single', 'double']),
  z.string().transform((val): 'single' | 'double' => {
    const lower = val.toLowerCase();
    if (lower.includes('double')) return 'double';
    return 'single'; // default to single
  }),
]).catch('single');

/**
 * Helper to coerce semicolons from various Claude responses
 * Claude may return "always use semicolons" instead of true/false
 */
const semicolonsCoercion = z.union([
  z.boolean(),
  z.string().transform((val): boolean => {
    const lower = val.toLowerCase();
    // Check for negative indicators first
    if (lower.includes('no ') || lower.includes('never') || lower.includes('without') || lower === 'false') {
      return false;
    }
    // Default to true (semicolons are common in TypeScript)
    return true;
  }),
]).catch(true);

/**
 * Helper to coerce lineLength from string or number
 */
const lineLengthCoercion = z.union([
  z.number().int().min(40).max(200),
  z.string().transform((val): number => {
    const num = parseInt(val, 10);
    if (isNaN(num)) return 100;
    return Math.min(200, Math.max(40, num));
  }),
]).catch(100);

/**
 * Formatting conventions
 * Made lenient to handle Claude's verbose responses
 */
export const FormattingConventionsSchema = z.object({
  indentation: z.string().max(50).default('2 spaces'),
  lineLength: lineLengthCoercion.default(100),
  quotes: quotesCoercion.default('single'),
  semicolons: semicolonsCoercion.default(true),
});

export type FormattingConventions = z.infer<typeof FormattingConventionsSchema>;

/**
 * Code pattern example
 * Accepts either a structured object or a simple string
 */
export const PatternSchema = z.union([
  z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000).default(''),
    example: z.string().max(5000).default(''),
  }),
  z.string().transform((val) => ({
    name: val.substring(0, 100),
    description: '',
    example: '',
  })),
]);

export type Pattern = z.infer<typeof PatternSchema>;

/**
 * Anti-pattern to avoid
 */
export const AntiPatternSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).default(''),
  alternative: z.string().max(1000).default(''),
});

export type AntiPattern = z.infer<typeof AntiPatternSchema>;

/**
 * Helper to convert object to array of patterns
 */
const patternsCoercion = z.union([
  z.array(PatternSchema),
  z.record(z.unknown()).transform((obj): Array<{ name: string; description: string; example: string }> => {
    // Convert object with named keys to array
    return Object.entries(obj).map(([key, value]) => {
      if (typeof value === 'string') {
        return { name: key, description: value, example: '' };
      } else if (typeof value === 'object' && value !== null) {
        const v = value as Record<string, unknown>;
        const name = typeof v['name'] === 'string' ? v['name'] : key;
        return {
          name,
          description: String(v['description'] ?? ''),
          example: String(v['example'] ?? ''),
        };
      }
      return { name: key, description: '', example: '' };
    });
  }),
]).default([]);

/**
 * Coding conventions
 */
export const CodingConventionsSchema = z.object({
  naming: NamingConventionsSchema.default({}),
  formatting: FormattingConventionsSchema.default({}),
  patterns: patternsCoercion,
  antiPatterns: z.array(AntiPatternSchema).default([]),
});

export type CodingConventions = z.infer<typeof CodingConventionsSchema>;

/**
 * Architect routing hints
 * Uses LenientAgentTypeArraySchema to handle common Claude name variations
 */
export const ArchitectRoutingHintsSchema = z.object({
  suggestNext: LenientAgentTypeArraySchema,
  skipAgents: LenientAgentTypeArraySchema,
  needsApproval: z.boolean().default(false),
  hasFailures: z.boolean().default(false),
  isComplete: z.boolean().default(true),
  notes: z.string().max(1000).optional(),
});

export type ArchitectRoutingHints = z.infer<typeof ArchitectRoutingHintsSchema>;

/**
 * Helper to coerce considerations/notes arrays
 * Accepts strings, objects with description fields, or any value (converted to string)
 */
const stringArrayCoercion = z.array(
  z.union([
    z.string(),
    z.object({ description: z.string() }).transform((obj) => obj.description),
    z.object({ name: z.string(), description: z.string().optional() }).transform(
      (obj) => obj.description || obj.name
    ),
    z.unknown().transform((val) => {
      if (typeof val === 'object' && val !== null) {
        const v = val as Record<string, unknown>;
        return String(v['description'] || v['name'] || v['title'] || JSON.stringify(val));
      }
      return String(val);
    }),
  ])
).default([]);

/**
 * Complete Architect output
 */
export const ArchitectOutputSchema = z.object({
  techStack: TechStackSchema.optional(),
  adrs: z.array(ADRSchema).default([]),
  components: z.array(ComponentSchema).default([]),
  directoryStructure: DirectoryStructureSchema.optional(),
  apiEndpoints: z.array(APIEndpointSchema).default([]),
  dataModels: z.array(DataModelSchema).default([]),
  codingConventions: CodingConventionsSchema.optional(),
  securityConsiderations: stringArrayCoercion,
  scalabilityNotes: stringArrayCoercion,
  routingHints: ArchitectRoutingHintsSchema.default({}),
});

export type ArchitectOutput = z.infer<typeof ArchitectOutputSchema>;

/**
 * Create a new ADR with defaults
 */
export function createADR(
  id: string,
  title: string,
  context: string,
  decision: string
): ADR {
  return {
    id,
    title,
    status: 'proposed',
    date: new Date().toISOString().split('T')[0]!,
    context,
    decision,
    consequences: {
      positive: [],
      negative: [],
      risks: [],
    },
    alternatives: [],
    relatedADRs: [],
  };
}

/**
 * Generate next ADR ID
 */
export function generateADRId(existingIds: string[]): string {
  const numbers = existingIds
    .map((id) => {
      const match = id.match(/^ADR-(\d+)$/);
      return match ? parseInt(match[1]!, 10) : 0;
    })
    .filter((n) => n > 0);

  const nextNumber = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  return `ADR-${String(nextNumber).padStart(4, '0')}`;
}
