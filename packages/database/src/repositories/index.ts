/**
 * Repository Index
 *
 * Aggregated exports for all repository implementations.
 */

// Base repository
export {
  BaseRepository,
  type PaginationOptions,
  type PaginatedResult,
  type RepositoryConfig,
} from './base.repository.js';

// Tenant repository
export {
  TenantRepository,
  type TenantWithStats,
} from './tenant.repository.js';

// Project repository
export {
  ProjectRepository,
  type ProjectWithStats,
} from './project.repository.js';

// Task repository
export {
  TaskRepository,
  type TaskWithRelations,
} from './task.repository.js';

// Lesson repository
export {
  LessonRepository,
  type LessonSearchOptions,
} from './lesson.repository.js';

// Agent repository
export {
  AgentRepository,
  type AgentAvailability,
} from './agent.repository.js';

// Audit repository
export {
  AuditRepository,
  type AuditLogFilter,
  type AuditStats,
} from './audit.repository.js';

// User repository
export { UserRepository } from './user.repository.js';

// Artifact repository
export { ArtifactRepository } from './artifact.repository.js';

// Approval repository
export { ApprovalRepository } from './approval.repository.js';

// Task execution repository
export { TaskExecutionRepository } from './task-execution.repository.js';
