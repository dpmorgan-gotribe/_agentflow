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
import { AgentTypeSchema } from '../types.js';

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
 */
export const ADRAlternativeSchema = z.object({
  option: z.string().min(1).max(200),
  pros: z.array(z.string().min(1).max(500)),
  cons: z.array(z.string().min(1).max(500)),
});

export type ADRAlternative = z.infer<typeof ADRAlternativeSchema>;

/**
 * ADR consequences
 */
export const ADRConsequencesSchema = z.object({
  positive: z.array(z.string().min(1).max(500)),
  negative: z.array(z.string().min(1).max(500)),
  risks: z.array(z.string().min(1).max(500)),
});

export type ADRConsequences = z.infer<typeof ADRConsequencesSchema>;

/**
 * Architecture Decision Record (ADR)
 */
export const ADRSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(50)
    .regex(/^ADR-\d{4}$/, 'ADR ID must be in format ADR-0001'),
  title: z.string().min(1).max(200),
  status: ADRStatusSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  context: z.string().min(1).max(5000),
  decision: z.string().min(1).max(5000),
  consequences: ADRConsequencesSchema,
  alternatives: z.array(ADRAlternativeSchema),
  relatedADRs: z.array(z.string().regex(/^ADR-\d{4}$/)),
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
 */
export const BodySchemaDefinition = z.object({
  contentType: z.string().min(1).max(100),
  schema: z.record(z.unknown()),
});

export type BodySchema = z.infer<typeof BodySchemaDefinition>;

/**
 * API endpoint definition
 */
export const APIEndpointSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(500)
    .regex(/^\//, 'Path must start with /'),
  method: HTTPMethodSchema,
  description: z.string().min(1).max(500),
  requestBody: BodySchemaDefinition.optional(),
  responseBody: BodySchemaDefinition,
  authentication: z.boolean(),
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
 */
export interface DirectoryStructure {
  path: string;
  description: string;
  children?: DirectoryStructure[];
}

export const DirectoryStructureSchema: z.ZodType<DirectoryStructure> = z.object({
  path: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9/_.-]+$/, 'Invalid path characters'),
  description: z.string().min(1).max(500),
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
 * Formatting conventions
 */
export const FormattingConventionsSchema = z.object({
  indentation: z.string().max(50).default('2 spaces'),
  lineLength: z.number().int().min(40).max(200).default(100),
  quotes: z.enum(['single', 'double']).default('single'),
  semicolons: z.boolean().default(true),
});

export type FormattingConventions = z.infer<typeof FormattingConventionsSchema>;

/**
 * Code pattern example
 */
export const PatternSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).default(''),
  example: z.string().max(5000).default(''),
});

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
 * Coding conventions
 */
export const CodingConventionsSchema = z.object({
  naming: NamingConventionsSchema.default({}),
  formatting: FormattingConventionsSchema.default({}),
  patterns: z.array(PatternSchema).default([]),
  antiPatterns: z.array(AntiPatternSchema).default([]),
});

export type CodingConventions = z.infer<typeof CodingConventionsSchema>;

/**
 * Architect routing hints
 */
export const ArchitectRoutingHintsSchema = z.object({
  suggestNext: z.array(AgentTypeSchema).default([]),
  skipAgents: z.array(AgentTypeSchema).default([]),
  needsApproval: z.boolean().default(false),
  hasFailures: z.boolean().default(false),
  isComplete: z.boolean().default(true),
  notes: z.string().max(1000).optional(),
});

export type ArchitectRoutingHints = z.infer<typeof ArchitectRoutingHintsSchema>;

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
  securityConsiderations: z.array(z.string().min(1).max(500)).default([]),
  scalabilityNotes: z.array(z.string().min(1).max(500)).default([]),
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
