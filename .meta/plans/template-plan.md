# [Project Name] Implementation Plan

## Plan Metadata
- **Version**: 1.0
- **Created**: YYYY-MM-DD
- **Status**: not_started | in_progress | completed
- **Current Phase**: 0

## Constitution (Rules That Never Break)

These rules apply across ALL phases:

1. All code must have TypeScript strict types
2. Test coverage minimum 80%
3. No secrets in code - use environment variables
4. All API endpoints require authentication
5. All database queries must be parameterized
6. [Add your project-specific rules]

---

## Phase 1: Foundation
**Status**: pending
**Gate**: automatic
**Checkpoint**: All tests pass, core structure in place

### Description
Set up the project foundation including tooling, basic structure, and core patterns.

### Tasks
- [ ] **Project scaffolding**
  - Dependencies: none
  - Acceptance: Project runs, tests execute, linting works
  
- [ ] **Database setup**
  - Dependencies: scaffolding
  - Acceptance: Migrations run, seed data loads
  
- [ ] **Base patterns**
  - Dependencies: database
  - Acceptance: Repository pattern implemented, example CRUD works

### Phase Notes
- Focus on getting the development experience right
- Don't optimize prematurely
- Establish patterns that will scale

### Risks
| Risk | Mitigation |
|------|------------|
| Scope creep | Stick to foundation only |

---

## Phase 2: Core Features
**Status**: pending
**Gate**: human_approval
**Checkpoint**: Core functionality works end-to-end
**Depends On**: Phase 1

### Description
Implement the core features that define the product's value proposition.

### Tasks
- [ ] **Feature A**
  - Dependencies: none
  - Acceptance: [criteria]
  
- [ ] **Feature B**
  - Dependencies: Feature A
  - Acceptance: [criteria]
  
- [ ] **Feature C**
  - Dependencies: none (can parallel with A)
  - Acceptance: [criteria]

### Phase Notes
- This phase may take longest
- Consider breaking into sub-phases if needed
- Human approval required before Phase 3

### Risks
| Risk | Mitigation |
|------|------------|
| Complexity | Break into smaller tasks |
| Integration issues | Test integrations early |

---

## Phase 3: Polish & Production
**Status**: pending
**Gate**: human_approval
**Checkpoint**: Production-ready
**Depends On**: Phase 2

### Description
Prepare for production: error handling, monitoring, performance, security hardening.

### Tasks
- [ ] **Error handling**
  - Dependencies: none
  - Acceptance: All errors handled gracefully
  
- [ ] **Monitoring setup**
  - Dependencies: none
  - Acceptance: Key metrics visible
  
- [ ] **Security audit**
  - Dependencies: all features complete
  - Acceptance: No critical vulnerabilities
  
- [ ] **Performance optimization**
  - Dependencies: monitoring
  - Acceptance: Meets performance targets

### Phase Notes
- Don't skip security
- Get external review if possible

---

## Appendix: Decision Log

| Date | Decision | Rationale | ADR |
|------|----------|-----------|-----|
| | | | |

## Appendix: Change Log

| Date | Version | Change | Reason |
|------|---------|--------|--------|
| | 1.0 | Initial plan | - |

---

## How to Use This Plan

1. **Copy this file** to `.meta/plans/current-plan.md`
2. **Customize** the phases, tasks, and acceptance criteria for your project
3. **Run** `/start-phase 1` to begin
4. **Update** task checkboxes as you complete work
5. **Run** `/checkpoint` after significant progress
6. **Get approval** at human_approval gates before proceeding
