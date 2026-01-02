CREATE TYPE "public"."agent_role" AS ENUM('orchestrator', 'architect', 'backend', 'frontend', 'ui_designer', 'reviewer', 'tester', 'devops');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('idle', 'initializing', 'working', 'waiting', 'completed', 'failed', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."approval_decision" AS ENUM('pending', 'approved', 'rejected', 'deferred');--> statement-breakpoint
CREATE TYPE "public"."approval_type" AS ENUM('design', 'architecture', 'implementation', 'final', 'security', 'compliance');--> statement-breakpoint
CREATE TYPE "public"."artifact_status" AS ENUM('generated', 'pending_review', 'approved', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."artifact_type" AS ENUM('mockup', 'source_file', 'test_file', 'config_file', 'documentation', 'schema', 'migration', 'asset');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('auth.login', 'auth.logout', 'auth.token_refresh', 'auth.password_change', 'auth.mfa_enable', 'auth.mfa_disable', 'tenant.create', 'tenant.update', 'tenant.suspend', 'tenant.delete', 'project.create', 'project.update', 'project.archive', 'project.delete', 'task.create', 'task.start', 'task.complete', 'task.fail', 'task.abort', 'agent.spawn', 'agent.terminate', 'agent.assign', 'security.permission_change', 'security.api_key_create', 'security.api_key_revoke', 'security.rate_limit_hit', 'data.export', 'data.import', 'data.backup', 'data.restore');--> statement-breakpoint
CREATE TYPE "public"."audit_outcome" AS ENUM('success', 'failure', 'blocked', 'error');--> statement-breakpoint
CREATE TYPE "public"."execution_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lesson_category" AS ENUM('bug_fix', 'architecture', 'security', 'performance', 'pattern', 'tooling', 'process');--> statement-breakpoint
CREATE TYPE "public"."lesson_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'archived', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'analyzing', 'orchestrating', 'agent_working', 'awaiting_approval', 'completing', 'completed', 'failed', 'aborted');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('feature', 'bugfix', 'refactor', 'docs', 'config', 'test');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended', 'pending', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."tenant_type" AS ENUM('free', 'starter', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'pending', 'suspended', 'deleted');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"task_id" uuid,
	"role" "agent_role" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "agent_status" DEFAULT 'idle' NOT NULL,
	"is_pooled" boolean DEFAULT false,
	"capabilities" jsonb DEFAULT '{"tools":[],"languages":[],"frameworks":[],"maxConcurrency":1}'::jsonb,
	"context" jsonb DEFAULT '{}'::jsonb,
	"metrics" jsonb DEFAULT '{"tasksCompleted":0,"tokensUsed":0,"averageLatencyMs":0,"successRate":1}'::jsonb,
	"tokens_used_session" integer DEFAULT 0,
	"max_tokens_session" integer DEFAULT 100000,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_active_at" timestamp,
	"terminated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"type" "approval_type" NOT NULL,
	"request" jsonb NOT NULL,
	"decision" "approval_decision" DEFAULT 'pending' NOT NULL,
	"response" jsonb,
	"requested_by_id" uuid,
	"decided_by_id" uuid,
	"artifact_ids" jsonb DEFAULT '[]'::jsonb,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"execution_id" uuid,
	"type" "artifact_type" NOT NULL,
	"path" text NOT NULL,
	"filename" text NOT NULL,
	"content" text,
	"content_size" integer,
	"status" "artifact_status" DEFAULT 'generated' NOT NULL,
	"approved" boolean,
	"approved_by" uuid,
	"approved_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" integer DEFAULT 1,
	"previous_version_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"outcome" "audit_outcome" NOT NULL,
	"actor_id" uuid,
	"actor_type" text NOT NULL,
	"actor_email" text,
	"target_type" text,
	"target_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb,
	"request_info" jsonb DEFAULT '{}'::jsonb,
	"ip_address" "inet",
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid,
	"task_id" uuid,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"category" "lesson_category" NOT NULL,
	"severity" "lesson_severity" DEFAULT 'info' NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '{"components":[],"technologies":[],"keywords":[]}'::jsonb,
	"metrics" jsonb DEFAULT '{"timesApplied":0,"preventedIssues":0}'::jsonb,
	"relevance_score" integer DEFAULT 50,
	"captured_by" text,
	"phase" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"tech_stack" jsonb DEFAULT '[]'::jsonb,
	"repository_url" text,
	"default_branch" text DEFAULT 'main',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "task_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"agent_type" "agent_role" NOT NULL,
	"agent_instance_id" uuid,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"status" "execution_status" DEFAULT 'pending' NOT NULL,
	"duration_ms" integer,
	"tokens_used" integer,
	"metrics" jsonb,
	"error" text,
	"error_code" text,
	"iteration" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"type" "task_type" NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"analysis" jsonb,
	"current_agent" text,
	"completed_agents" jsonb DEFAULT '[]'::jsonb,
	"agent_queue" jsonb DEFAULT '[]'::jsonb,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"error" jsonb,
	"checkpoints" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "tenant_type" DEFAULT 'free' NOT NULL,
	"status" "tenant_status" DEFAULT 'pending' NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"owner_email" text NOT NULL,
	"owner_name" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"quotas" jsonb NOT NULL,
	"usage" jsonb DEFAULT '{"currentUsers":0,"currentProjects":0,"tokensThisMonth":0,"storageUsedGB":0}'::jsonb,
	"stripe_customer_id" text,
	"subscription_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"suspended_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"external_id" text,
	"auth_provider" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_execution_id_task_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."task_executions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agents_tenant_idx" ON "agents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "agents_task_idx" ON "agents" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "agents_status_idx" ON "agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agents_role_idx" ON "agents" USING btree ("role");--> statement-breakpoint
CREATE INDEX "agents_pooled_idx" ON "agents" USING btree ("is_pooled");--> statement-breakpoint
CREATE INDEX "approvals_task_idx" ON "approvals" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "approvals_type_idx" ON "approvals" USING btree ("type");--> statement-breakpoint
CREATE INDEX "approvals_decision_idx" ON "approvals" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "approvals_created_idx" ON "approvals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "artifacts_task_idx" ON "artifacts" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "artifacts_execution_idx" ON "artifacts" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "artifacts_type_idx" ON "artifacts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "artifacts_status_idx" ON "artifacts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "artifacts_path_idx" ON "artifacts" USING btree ("path");--> statement-breakpoint
CREATE INDEX "audit_tenant_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_outcome_idx" ON "audit_logs" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_target_idx" ON "audit_logs" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "lessons_tenant_idx" ON "lessons" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "lessons_project_idx" ON "lessons" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "lessons_category_idx" ON "lessons" USING btree ("category");--> statement-breakpoint
CREATE INDEX "lessons_severity_idx" ON "lessons" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "projects_tenant_idx" ON "projects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "task_executions_task_idx" ON "task_executions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_executions_agent_idx" ON "task_executions" USING btree ("agent_type");--> statement-breakpoint
CREATE INDEX "task_executions_status_idx" ON "task_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "task_executions_created_idx" ON "task_executions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tasks_tenant_idx" ON "tasks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenants_slug_idx" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tenants_status_idx" ON "tenants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_external_id_idx" ON "users" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_email_idx" ON "users" USING btree ("tenant_id","email");