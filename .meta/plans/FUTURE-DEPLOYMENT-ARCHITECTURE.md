# Future Deployment Architecture Plan

**Status**: PARKED (Come back when ready to ship)
**Created**: 2026-01-02
**Priority**: Later - Focus on product first

## Executive Summary

Aigentflow will be deployed as a two-tier architecture:
1. **Central Hub** (aigentflow.com) - Auth, billing, server provisioning
2. **User Instances** (User's Hetzner servers) - Aigentflow + user's apps

## User Journeys

### Journey 1: Desktop App (Token-Only Tier)
```
User downloads desktop → Works with local/GitHub repos → Pays for tokens only
User handles their own deployment
```

### Journey 2: Managed Server (Server Tier)
```
User signs up → Provisions Hetzner server → Creates/clones projects
Aigentflow deploys user's apps to their server
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                 AIGENTFLOW.COM (Central Hub)                    │
│  Auth │ Billing │ Server Registry │ GitHub OAuth │ Provisioning │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
    ┌───────────────┐                   ┌───────────────┐
    │  Desktop App  │                   │   Web App     │
    │   (Tauri)     │                   │   (React)     │
    └───────────────┘                   └───────────────┘
            │                                   │
            └─────────────────┬─────────────────┘
                              ▼
    ┌─────────────────────────────────────────────────────────────┐
    │              USER'S SERVER (Hetzner)                        │
    │  ┌─────────────────────────────────────────────────────┐   │
    │  │ Aigentflow Instance (API + Agents + Workflow)        │   │
    │  └─────────────────────────────────────────────────────┘   │
    │  ┌─────────────────────────────────────────────────────┐   │
    │  │ K3s Cluster (User's deployed apps + databases)       │   │
    │  └─────────────────────────────────────────────────────┘   │
    │  ┌─────────────────────────────────────────────────────┐   │
    │  │ Git Repos (cloned from GitHub)                       │   │
    │  └─────────────────────────────────────────────────────┘   │
    └─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │     GITHUB      │
                    │ (Source of Truth)│
                    └─────────────────┘
```

## Database Strategy

### Central Database (Multi-tenant, RLS)
- users, organizations, org_members
- servers, server_environments
- github_connections
- billing (customers, subscriptions, invoices)
- token_usage

### Instance Database (Single-tenant, per server)
- projects, project_databases
- tasks, task_executions, artifacts
- deployments
- agents, activity_logs

### Project Databases (On-demand)
- Created per project based on requirements
- PostgreSQL, MySQL, MongoDB, Redis, etc.

## Codebase Split (When Ready)

```
apps/
├── central/          # aigentflow.com API (NEW)
├── instance/         # Renamed from apps/api
├── web/              # Dashboard (connects to central or instance)
└── desktop/          # Tauri wrapper (NEW)

packages/
├── database-central/ # Multi-tenant schema (NEW)
├── database/         # Instance schema (existing, simplified)
├── provisioner/      # OpenTofu + Hetzner (NEW)
├── github/           # OAuth + repo operations (NEW)
├── deployer/         # K3s deployment (NEW)
└── ...existing...
```

## New Components Needed

| Component | Purpose |
|-----------|---------|
| `@aigentflow/central-api` | Auth, billing, server registry |
| `@aigentflow/provisioner` | OpenTofu + Hetzner API integration |
| `@aigentflow/github` | GitHub OAuth + repo CRUD + webhooks |
| `@aigentflow/deployer` | K3s deployment orchestration |
| `@aigentflow/desktop` | Tauri app shell |

## Key Decisions (To Make Later)

1. **Central hosting**: Hetzner container vs managed K8s
2. **Auth provider**: Clerk vs Auth0 vs custom
3. **Billing**: Stripe (confirmed)
4. **Domain strategy**: *.aigentflow.cloud for user apps?
5. **SSL**: Let's Encrypt automation

## When to Revisit

Come back to this plan when:
- [ ] Core product features are complete
- [ ] Ready to onboard beta users
- [ ] Need to set up billing
- [ ] Ready for public launch

---

*This plan is intentionally high-level. Details will be filled in when we're ready to ship.*
