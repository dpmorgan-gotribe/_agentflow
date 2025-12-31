/**
 * Schema Index
 *
 * Aggregated exports for all database schemas.
 */

// Tenant schema
export {
  tenants,
  tenantTypeEnum,
  tenantStatusEnum,
  type Tenant,
  type NewTenant,
  type TenantSettings,
  type TenantQuotas,
  type TenantUsage,
} from './tenants.js';

// Project schema
export {
  projects,
  projectStatusEnum,
  type Project,
  type NewProject,
  type ProjectConfig,
} from './projects.js';

// Task schema
export {
  tasks,
  taskStatusEnum,
  taskTypeEnum,
  type Task,
  type NewTask,
  type TaskAnalysis,
  type TaskError,
  type TaskCheckpoint,
} from './tasks.js';

// Agent schema
export {
  agents,
  agentStatusEnum,
  agentRoleEnum,
  type Agent,
  type NewAgent,
  type AgentCapabilities,
  type AgentMetrics,
  type AgentContext,
} from './agents.js';

// Lessons schema
export {
  lessons,
  lessonCategoryEnum,
  lessonSeverityEnum,
  type Lesson,
  type NewLesson,
  type LessonTags,
  type LessonContext,
  type LessonMetrics,
} from './lessons.js';

// Audit schema
export {
  auditLogs,
  auditActionEnum,
  auditOutcomeEnum,
  type AuditLog,
  type NewAuditLog,
  type AuditDetails,
  type AuditRequestInfo,
} from './audit.js';
