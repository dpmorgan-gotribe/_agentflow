# Task: Add Kill All Button & Emergency Shutdown

## Metadata
| Field | Value |
|-------|-------|
| Created | 2026-01-01 |
| Status | completed |
| Type | task |
| Phase | 3 |
| Task ID | SHUTDOWN-BUTTON |

## Original Prompt
> add a button to the top header bar in aigentflow that stops the api server and website this button should kill all processes for the running app. The problem its trying to solve is we are taking up to 30mins stopping and restarting the app.

## Context Loaded
- Current Phase: Phase 3 (Design System)
- Root Cause: No graceful shutdown handlers in API - connections, SSE streams, workflows hang
- Missing: SIGTERM/SIGINT handlers, cleanup on exit, actual abort API call

## Acceptance Criteria
- Emergency kill script for instant termination
- Graceful shutdown endpoint with proper cleanup
- Kill All button in Header component
- Confirmation dialog before killing
- All SSE streams closed
- All workflows aborted
- Database connections closed

## Steps
### Analysis
- [x] 1. Architect review - Identified missing shutdown handlers
- [x] 2. Security scan - Shutdown endpoint needs auth protection
- [x] 3. Identify file boundaries - API + Web components

### Implementation
- [x] 4. Create scripts/kill-all.ps1 (emergency script)
- [x] 5. Add shutdown handlers to apps/api/src/main.ts
- [x] 6. Create shutdown module in apps/api/src/modules/system/
- [x] 7. Add cleanup to TasksService.onApplicationShutdown
- [x] 8. Add cleanup to WorkflowService.onApplicationShutdown
- [x] 9. Add Kill All button to Header component
- [x] 10. Add confirmation dialog

### Verification
- [x] 11. Typecheck passes
- [ ] 12. Test kill script terminates all processes
- [ ] 13. Test graceful shutdown cleans up properly

## Current Step
**Step 12**: Manual testing

## File Boundaries
| Agent | Can Modify |
|-------|-----------|
| backend_dev | apps/api/**, scripts/** |
| frontend_dev | apps/web/** |

## Files to Modify
| File | Action | Status |
|------|--------|--------|
| scripts/kill-all.ps1 | create | pending |
| scripts/kill-all.sh | create | pending |
| apps/api/src/main.ts | modify | pending |
| apps/api/src/modules/system/system.module.ts | create | pending |
| apps/api/src/modules/system/system.controller.ts | create | pending |
| apps/api/src/modules/system/system.service.ts | create | pending |
| apps/api/src/modules/tasks/tasks.service.ts | modify | pending |
| apps/api/src/modules/workflow/workflow.service.ts | modify | pending |
| apps/web/src/components/layout/Header.tsx | modify | pending |
| apps/web/src/components/dialogs/ShutdownDialog.tsx | create | pending |
| apps/web/src/lib/api.ts | modify | pending |

## Resume Notes
Last action: Completed analysis, user approved "Both" approach
Next action: Create emergency kill script
Blockers: None
