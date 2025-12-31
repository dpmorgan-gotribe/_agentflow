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
  purpose: z.string().min(1).max(500),
  alternatives: z.array(z.string().min(1).max(100)),
  reasoning: z.string().min(1).max(1000),
});

export type Technology = z.infer<typeof TechnologySchema>;

/**
 * Frontend tech stack
 */
export const FrontendStackSchema = z.object({
  framework: TechnologySchema,
  language: TechnologySchema,
  styling: TechnologySchema,
  stateManagement: TechnologySchema.optional(),
  routing: TechnologySchema.optional(),
});

export type FrontendStack = z.infer<typeof FrontendStackSchema>;

/**
 * Backend tech stack
 */
export const BackendStackSchema = z.object({
  framework: TechnologySchema,
  language: TechnologySchema,
  runtime: TechnologySchema.optional(),
});

export type BackendStack = z.infer<typeof BackendStackSchema>;

/**
 * Database tech stack
 */
export const DatabaseStackSchema = z.object({
  primary: TechnologySchema,
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
  unit: TechnologySchema,
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
  testing: TestingStackSchema,
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
  type: InterfaceTypeSchema,
  description: z.string().min(1).max(500),
});

export type ComponentInterface = z.infer<typeof ComponentInterfaceSchema>;

/**
 * Component definition
 */
export const ComponentSchema = z.object({
  name: z.string().min(1).max(100),
  type: ComponentTypeSchema,
  description: z.string().min(1).max(1000),
  responsibilities: z.array(z.string().min(1).max(500)),
  dependencies: z.array(z.string().min(1).max(100)),
  interfaces: z.array(ComponentInterfaceSchema),
  location: z
    .string()
    .min(1)
    .max(500)
    .regex(/^[a-zA-Z0-9/_.-]+$/, 'Invalid path characters'),
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
  type: z.string().min(1).max(100),
  required: z.boolean(),
  description: z.string().min(1).max(500),
  constraints: z.array(z.string().min(1).max(200)).optional(),
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
  type: RelationshipTypeSchema,
  description: z.string().min(1).max(500),
});

export type Relationship = z.infer<typeof RelationshipSchema>;

/**
 * Data model definition
 */
export const DataModelSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  fields: z.array(DataFieldSchema),
  relationships: z.array(RelationshipSchema),
  indexes: z.array(z.string().min(1).max(200)).optional(),
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
  files: z.string().min(1).max(200),
  directories: z.string().min(1).max(200),
  components: z.string().min(1).max(200),
  functions: z.string().min(1).max(200),
  variables: z.string().min(1).max(200),
  constants: z.string().min(1).max(200),
  types: z.string().min(1).max(200),
});

export type NamingConventions = z.infer<typeof NamingConventionsSchema>;

/**
 * Formatting conventions
 */
export const FormattingConventionsSchema = z.object({
  indentation: z.string().min(1).max(50),
  lineLength: z.number().int().min(40).max(200),
  quotes: z.enum(['single', 'double']),
  semicolons: z.boolean(),
});

export type FormattingConventions = z.infer<typeof FormattingConventionsSchema>;

/**
 * Code pattern example
 */
export const PatternSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  example: z.string().min(1).max(5000),
});

export type Pattern = z.infer<typeof PatternSchema>;

/**
 * Anti-pattern to avoid
 */
export const AntiPatternSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  alternative: z.string().min(1).max(1000),
});

export type AntiPattern = z.infer<typeof AntiPatternSchema>;

/**
 * Coding conventions
 */
export const CodingConventionsSchema = z.object({
  naming: NamingConventionsSchema,
  formatting: FormattingConventionsSchema,
  patterns: z.array(PatternSchema),
  antiPatterns: z.array(AntiPatternSchema),
});

export type CodingConventions = z.infer<typeof CodingConventionsSchema>;

/**
 * Architect routing hints
 */
export const ArchitectRoutingHintsSchema = z.object({
  suggestNext: z.array(AgentTypeSchema),
  skipAgents: z.array(AgentTypeSchema),
  needsApproval: z.boolean(),
  hasFailures: z.boolean(),
  isComplete: z.boolean(),
  notes: z.string().max(1000).optional(),
});

export type ArchitectRoutingHints = z.infer<typeof ArchitectRoutingHintsSchema>;

/**
 * Complete Architect output
 */
export const ArchitectOutputSchema = z.object({
  techStack: TechStackSchema,
  adrs: z.array(ADRSchema),
  components: z.array(ComponentSchema),
  directoryStructure: DirectoryStructureSchema,
  apiEndpoints: z.array(APIEndpointSchema).optional(),
  dataModels: z.array(DataModelSchema).optional(),
  codingConventions: CodingConventionsSchema,
  securityConsiderations: z.array(z.string().min(1).max(500)),
  scalabilityNotes: z.array(z.string().min(1).max(500)),
  routingHints: ArchitectRoutingHintsSchema,
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
