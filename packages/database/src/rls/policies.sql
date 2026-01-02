-- =============================================================================
-- Row-Level Security (RLS) Policies
--
-- Multi-tenant isolation at the database level.
-- These policies ensure tenants can only access their own data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Create roles first (must exist before policies reference them)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  -- Application role (normal users)
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;

  -- Service role (bypasses RLS for system operations)
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Helper function to get current tenant ID from session context
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Enable RLS on all tenant-scoped tables
-- -----------------------------------------------------------------------------

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_executions ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Tenants Table Policies
-- Tenants can only see their own tenant record
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_isolation ON tenants
  FOR ALL
  USING (id = current_tenant_id());

-- Allow service role to bypass RLS (for system operations)
DROP POLICY IF EXISTS tenant_service_role ON tenants;
CREATE POLICY tenant_service_role ON tenants
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------------------
-- Projects Table Policies
-- Projects are scoped to tenant
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS project_tenant_isolation ON projects;
CREATE POLICY project_tenant_isolation ON projects
  FOR ALL
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS project_service_role ON projects;
CREATE POLICY project_service_role ON projects
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------------------
-- Tasks Table Policies
-- Tasks are scoped to tenant
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS task_tenant_isolation ON tasks;
CREATE POLICY task_tenant_isolation ON tasks
  FOR ALL
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS task_service_role ON tasks;
CREATE POLICY task_service_role ON tasks
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------------------
-- Agents Table Policies
-- Agents are scoped to tenant
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS agent_tenant_isolation ON agents;
CREATE POLICY agent_tenant_isolation ON agents
  FOR ALL
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS agent_service_role ON agents;
CREATE POLICY agent_service_role ON agents
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------------------
-- Lessons Table Policies
-- Lessons are scoped to tenant
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS lesson_tenant_isolation ON lessons;
CREATE POLICY lesson_tenant_isolation ON lessons
  FOR ALL
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS lesson_service_role ON lessons;
CREATE POLICY lesson_service_role ON lessons
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------------------
-- Audit Logs Table Policies
-- Audit logs are scoped to tenant (read-only for tenants)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS audit_tenant_read ON audit_logs;
CREATE POLICY audit_tenant_read ON audit_logs
  FOR SELECT
  USING (tenant_id = current_tenant_id());

-- Only service role can insert audit logs
DROP POLICY IF EXISTS audit_service_insert ON audit_logs;
CREATE POLICY audit_service_insert ON audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS audit_service_role ON audit_logs;
CREATE POLICY audit_service_role ON audit_logs
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------------------
-- Users Table Policies
-- Users are scoped to tenant
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS user_tenant_isolation ON users;
CREATE POLICY user_tenant_isolation ON users
  FOR ALL
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS user_service_role ON users;
CREATE POLICY user_service_role ON users
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------------------
-- Artifacts Table Policies
-- Artifacts are scoped to tenant via tasks
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS artifact_tenant_isolation ON artifacts;
CREATE POLICY artifact_tenant_isolation ON artifacts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = artifacts.task_id
      AND tasks.tenant_id = current_tenant_id()
    )
  );

DROP POLICY IF EXISTS artifact_service_role ON artifacts;
CREATE POLICY artifact_service_role ON artifacts
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------------------
-- Approvals Table Policies
-- Approvals are scoped to tenant via tasks
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS approval_tenant_isolation ON approvals;
CREATE POLICY approval_tenant_isolation ON approvals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = approvals.task_id
      AND tasks.tenant_id = current_tenant_id()
    )
  );

DROP POLICY IF EXISTS approval_service_role ON approvals;
CREATE POLICY approval_service_role ON approvals
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------------------
-- Task Executions Table Policies
-- Task executions are scoped to tenant via tasks
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS task_execution_tenant_isolation ON task_executions;
CREATE POLICY task_execution_tenant_isolation ON task_executions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_executions.task_id
      AND tasks.tenant_id = current_tenant_id()
    )
  );

DROP POLICY IF EXISTS task_execution_service_role ON task_executions;
CREATE POLICY task_execution_service_role ON task_executions
  FOR ALL
  TO service_role
  USING (true);

-- -----------------------------------------------------------------------------
-- Grant appropriate permissions
-- -----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- -----------------------------------------------------------------------------
-- Force RLS for table owners (important for security)
-- This ensures RLS is applied even to table owners
-- -----------------------------------------------------------------------------

ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE agents FORCE ROW LEVEL SECURITY;
ALTER TABLE lessons FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE approvals FORCE ROW LEVEL SECURITY;
ALTER TABLE task_executions FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Development Seed Data
-- Creates a dev tenant for local development with dev-token-12345
-- -----------------------------------------------------------------------------

INSERT INTO tenants (id, name, slug, type, status, owner_user_id, owner_email, owner_name, quotas)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Development Tenant',
  'dev',
  'professional',
  'active',
  '00000000-0000-0000-0000-000000000001',
  'dev@localhost',
  'Dev User',
  '{"maxUsers": 100, "maxProjects": 100, "maxTokensPerMonth": 10000000, "maxStorageGB": 100, "maxConcurrentAgents": 10}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Dev project for local development
INSERT INTO projects (id, tenant_id, name, description, status)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  '00000000-0000-0000-0000-000000000001',
  'Dev Project',
  'Development testing project',
  'active'
)
ON CONFLICT (id) DO NOTHING;
