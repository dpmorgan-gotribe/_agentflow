# Self-Review Architecture Proposal

**Date**: 2025-12-30
**Status**: Planning
**Scope**: All agents across the entire system
**Impact**: Fundamental change to agent execution model

---

## Executive Summary

Agents currently complete work without validating their output meets the original task requirements. This proposal introduces a **Self-Review Loop** pattern that ensures every agent:

1. Validates output against the original task/spec
2. Identifies gaps between output and requirements
3. Addresses identified gaps
4. Re-validates until no gaps remain (or max iterations)
5. Captures review patterns for self-learning

---

## Problem Analysis

### Current Agent Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CURRENT: LINEAR EXECUTION (No Validation)                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Task → Agent → Output → Done
         │
         └── "I produced something" ≠ "I produced what was asked"
```

### Problems Identified

| Problem | Impact | Example |
|---------|--------|---------|
| **No requirement validation** | Output may not match task | UI Designer creates mockup missing requested feature |
| **No quality gates** | Poor quality passes through | Tests written but don't cover edge cases |
| **No gap detection** | Missing elements undetected | Backend endpoint missing auth as specified |
| **No iterative improvement** | First attempt is final | Reviewer flags issues but no rework happens |
| **No learning from reviews** | Same mistakes repeated | Agent makes same oversight across tasks |

### Agent-Specific Gaps

| Agent | What They Produce | What's NOT Validated |
|-------|-------------------|---------------------|
| **Project Manager** | Epics/Features/Tasks | Do tasks cover all requirements? |
| **Architect** | Tech decisions, ADRs | Do decisions address constraints? |
| **UI Designer** | Mockups, stylesheets | Do mockups include all screens? |
| **Frontend Dev** | Components, tests | Do components match designs? |
| **Backend Dev** | Endpoints, logic | Do endpoints match API spec? |
| **Tester** | Test suites | Do tests cover acceptance criteria? |
| **Reviewer** | Review report | Did review catch all issues? |

---

## Proposed Solution: Self-Review Loop

### New Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PROPOSED: SELF-REVIEW LOOP                                                   │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────────────┐
                    │                                      │
                    ▼                                      │
Task ──▶ Agent ──▶ Output ──▶ Self-Review ──▶ Gaps? ──YES─┘
                                  │
                                  NO
                                  │
                                  ▼
                              Complete
                                  │
                                  ▼
                          Capture Learnings
```

### Detailed Self-Review Flow

```typescript
interface SelfReviewLoop {
  maxIterations: number;      // Default: 3
  qualityThreshold: number;   // Default: 0.8 (80%)

  async execute(task: Task): Promise<ReviewedOutput> {
    let iteration = 0;
    let output = await this.agent.produce(task);

    while (iteration < this.maxIterations) {
      // Phase 1: Self-Review
      const review = await this.selfReview(task, output);

      // Phase 2: Check Completion
      if (review.qualityScore >= this.qualityThreshold &&
          review.gaps.length === 0) {
        return this.markComplete(output, review);
      }

      // Phase 3: Address Gaps
      output = await this.addressGaps(output, review.gaps);
      iteration++;
    }

    // Max iterations reached - escalate
    return this.escalateForHumanReview(output, review);
  }
}
```

---

## Self-Review Components

### 1. SelfReviewResult Schema

```typescript
interface SelfReviewResult {
  // Original task reference
  taskId: string;
  taskRequirements: string[];

  // Review metrics
  qualityScore: number;           // 0.0 - 1.0
  completenessScore: number;      // 0.0 - 1.0
  correctnessScore: number;       // 0.0 - 1.0

  // Gap analysis
  gaps: Gap[];

  // Requirement coverage
  requirementsCovered: RequirementCoverage[];

  // Review metadata
  iteration: number;
  reviewDurationMs: number;

  // Decision
  decision: 'approved' | 'needs_work' | 'escalate';
  reasoning: string;
}

interface Gap {
  id: string;
  severity: 'critical' | 'major' | 'minor';
  category: 'missing' | 'incorrect' | 'incomplete' | 'quality';
  description: string;
  affectedRequirement?: string;
  suggestedFix: string;
  estimatedEffort: 'trivial' | 'small' | 'medium' | 'large';
}

interface RequirementCoverage {
  requirement: string;
  covered: boolean;
  coverageDetails: string;
  evidenceLocation?: string;  // Where in output this is addressed
}
```

### 2. Agent-Specific Review Criteria

Each agent type has specific review criteria:

#### UI Designer Self-Review

```typescript
const UI_DESIGNER_REVIEW_CRITERIA = {
  // Completeness checks
  'all_screens_created': {
    description: 'All requested screens have mockups',
    validator: (output, task) => {
      const requestedScreens = extractScreensFromTask(task);
      const createdScreens = output.artifacts.filter(a => a.type === 'mockup');
      return requestedScreens.every(s =>
        createdScreens.some(c => matchesScreen(c, s))
      );
    }
  },

  // Design consistency
  'design_tokens_applied': {
    description: 'Design tokens consistently applied',
    validator: (output) => validateTokenUsage(output.stylesheets)
  },

  // Accessibility
  'accessibility_standards': {
    description: 'WCAG 2.1 AA standards met',
    validator: (output) => validateAccessibility(output.mockups)
  },

  // Responsiveness
  'responsive_design': {
    description: 'Mobile and desktop layouts provided',
    validator: (output) => hasResponsiveVariants(output.mockups)
  },

  // User flow coverage
  'user_flows_complete': {
    description: 'All user flows have corresponding screens',
    validator: (output, task) => validateFlowCoverage(output, task)
  }
};
```

#### Frontend Developer Self-Review

```typescript
const FRONTEND_DEV_REVIEW_CRITERIA = {
  // Code quality
  'typescript_compiles': {
    description: 'TypeScript code compiles without errors',
    validator: async (output) => await compileCheck(output.sourceFiles)
  },

  // Design fidelity
  'matches_mockups': {
    description: 'Components match approved mockups',
    validator: (output, context) => {
      const mockups = context.previousOutputs.find(o => o.agentId === 'ui_designer');
      return validateDesignFidelity(output.components, mockups);
    }
  },

  // Test coverage
  'tests_exist': {
    description: 'All components have corresponding tests',
    validator: (output) => validateTestCoverage(output)
  },

  // Accessibility implementation
  'aria_attributes': {
    description: 'Proper ARIA attributes on interactive elements',
    validator: (output) => validateAriaUsage(output.components)
  }
};
```

#### Project Manager Self-Review

```typescript
const PROJECT_MANAGER_REVIEW_CRITERIA = {
  // Requirement coverage
  'all_requirements_tasked': {
    description: 'Every requirement from prompt maps to at least one task',
    validator: (output, task) => {
      const requirements = extractRequirements(task.prompt);
      const tasks = flattenTasks(output.epics);
      return requirements.every(req =>
        tasks.some(t => coversRequirement(t, req))
      );
    }
  },

  // Dependency validity
  'dependencies_valid': {
    description: 'All task dependencies exist and are acyclic',
    validator: (output) => validateDependencyGraph(output.epics)
  },

  // Completeness
  'no_orphan_tasks': {
    description: 'All tasks belong to a feature',
    validator: (output) => !hasOrphanTasks(output.epics)
  },

  // Acceptance criteria
  'acceptance_criteria_present': {
    description: 'Every task has acceptance criteria',
    validator: (output) => {
      const tasks = flattenTasks(output.epics);
      return tasks.every(t => t.acceptanceCriteria.length > 0);
    }
  }
};
```

### 3. BaseAgent Enhancement

```typescript
abstract class BaseAgent {
  // Existing methods...

  /**
   * Self-review configuration (agent-specific)
   */
  protected abstract getSelfReviewCriteria(): ReviewCriteria[];

  /**
   * Main execution with self-review loop
   */
  async execute(request: AgentRequest): Promise<AgentOutput> {
    const config = this.getSelfReviewConfig();
    let iteration = 0;
    let output: AgentOutput;
    let review: SelfReviewResult;

    // Initial production
    output = await this.produce(request);

    // Self-review loop
    while (iteration < config.maxIterations) {
      // Perform self-review
      review = await this.selfReview(request, output);

      // Log review for learning
      await this.logReviewForLearning(request, output, review);

      // Check if complete
      if (review.decision === 'approved') {
        output.selfReviewResult = review;
        output.qualityScore = review.qualityScore;
        return output;
      }

      // Check if should escalate
      if (review.decision === 'escalate' ||
          iteration === config.maxIterations - 1) {
        output.selfReviewResult = review;
        output.routingHints.needsApproval = true;
        output.routingHints.escalationReason = review.reasoning;
        return output;
      }

      // Address gaps
      output = await this.addressGaps(request, output, review.gaps);
      iteration++;
    }

    return output;
  }

  /**
   * Self-review against original task
   */
  protected async selfReview(
    request: AgentRequest,
    output: AgentOutput
  ): Promise<SelfReviewResult> {
    const criteria = this.getSelfReviewCriteria();
    const gaps: Gap[] = [];
    const coverages: RequirementCoverage[] = [];

    // Extract requirements from task
    const requirements = await this.extractRequirements(request);

    // Validate each criterion
    for (const criterion of criteria) {
      const result = await criterion.validator(output, request);
      if (!result.passed) {
        gaps.push({
          id: generateId('gap'),
          severity: criterion.severity,
          category: criterion.category,
          description: criterion.description,
          suggestedFix: result.suggestedFix,
          estimatedEffort: result.estimatedEffort,
        });
      }
    }

    // Check requirement coverage
    for (const req of requirements) {
      const covered = await this.checkRequirementCovered(req, output);
      coverages.push(covered);
      if (!covered.covered) {
        gaps.push({
          id: generateId('gap'),
          severity: 'major',
          category: 'missing',
          description: `Requirement not addressed: ${req}`,
          affectedRequirement: req,
          suggestedFix: `Add implementation for: ${req}`,
          estimatedEffort: 'medium',
        });
      }
    }

    // Calculate scores
    const qualityScore = this.calculateQualityScore(gaps, coverages);
    const completenessScore = coverages.filter(c => c.covered).length / coverages.length;

    return {
      taskId: request.context.task.id,
      taskRequirements: requirements,
      qualityScore,
      completenessScore,
      correctnessScore: 1 - (gaps.filter(g => g.category === 'incorrect').length / criteria.length),
      gaps,
      requirementsCovered: coverages,
      iteration: this.currentIteration,
      reviewDurationMs: Date.now() - this.reviewStartTime,
      decision: this.determineDecision(qualityScore, gaps),
      reasoning: this.generateReviewReasoning(gaps, coverages),
    };
  }

  /**
   * Address identified gaps
   */
  protected async addressGaps(
    request: AgentRequest,
    currentOutput: AgentOutput,
    gaps: Gap[]
  ): Promise<AgentOutput> {
    // Build prompt specifically for addressing gaps
    const gapPrompt = this.buildGapAddressingPrompt(request, currentOutput, gaps);

    // Generate improvements
    const improvements = await this.callLLM(gapPrompt);

    // Merge improvements into current output
    return this.mergeImprovements(currentOutput, improvements);
  }
}
```

---

## Integration with Self-Learning

### Review Patterns Captured

```typescript
interface ReviewLearning {
  // What was reviewed
  agentId: string;
  taskType: string;
  taskComplexity: string;

  // Review outcome
  initialQualityScore: number;
  finalQualityScore: number;
  iterationsRequired: number;

  // Patterns detected
  commonGaps: GapPattern[];
  successfulFixes: FixPattern[];
  escalationReasons: string[];

  // Learning signals
  shouldLearn: boolean;
  learningType: 'positive' | 'negative' | 'neutral';

  // For future use
  embeddings?: number[];  // Semantic embedding of task + gaps
}

interface GapPattern {
  category: string;
  frequency: number;
  typicalFix: string;
  preventionHint: string;
}

interface FixPattern {
  gapCategory: string;
  fixApproach: string;
  successRate: number;
}
```

### Learning Integration Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ SELF-REVIEW → SELF-LEARNING INTEGRATION                                      │
└─────────────────────────────────────────────────────────────────────────────┘

Self-Review Loop                          Self-Learning System (CP7)
────────────────                          ─────────────────────────

1. Agent produces output
         │
2. Self-review identifies gaps ──────────▶ Pattern Detection
         │                                  • Common gap patterns
3. Agent addresses gaps                    • Agent weaknesses
         │
4. Review passes OR escalates ───────────▶ Lesson Extraction
         │                                  • Successful fix patterns
5. Log review result ────────────────────▶ Qdrant Vector Storage
                                            • Semantic gap embeddings
                                            • Similar task matching

Future Improvement:
─────────────────

6. Similar task received ◀───────────────── Context Manager retrieves:
         │                                   • Past gaps for this task type
7. Pre-emptive guidance ─────────────────▶  • Successful fixes
         │                                   • Prevention hints
8. Agent avoids common gaps
```

### Lesson Capture from Reviews

```typescript
// In lesson extraction (Step 33: LESSON-EXTRACTION)
interface ReviewBasedLesson {
  id: string;
  source: 'self_review';

  // Context
  agentId: string;
  taskType: string;
  taskDescription: string;

  // What happened
  gapsIdentified: Gap[];
  fixesApplied: Fix[];
  iterationsToComplete: number;
  finalQualityScore: number;

  // Learning
  lessonTitle: string;
  lessonSummary: string;
  preventionStrategy: string;

  // For retrieval
  tags: string[];
  embedding: number[];

  // Quality signals
  humanValidated: boolean;
  applicationCount: number;
  successRate: number;
}
```

---

## Implementation Plan

### Affected Steps

| Checkpoint | Step | Change Required |
|------------|------|-----------------|
| CP1 | 12-AGENT-FRAMEWORK | Add SelfReviewLoop to BaseAgent |
| CP1 | 15-ORCHESTRATOR-AGENT | Update routing for review escalations |
| CP1 | 16-PROJECT-MANAGER | Add PM-specific review criteria |
| CP1 | 17-ARCHITECT-AGENT | Add architecture review criteria |
| CP1 | 18-ANALYST-AGENT | Add research review criteria |
| CP2 | 20-UI-DESIGNER-AGENT | Add design review criteria |
| CP3 | 28-FRONTEND-DEV | Add frontend review criteria |
| CP3 | 29-BACKEND-DEV | Add backend review criteria |
| CP3 | 30-TESTER-AGENT | Add test quality review criteria |
| CP3 | 31-BUG-FIXER | Enhance with review-driven fixes |
| CP3 | 32-REVIEWER-AGENT | Add meta-review (review-the-review) |
| CP3 | 33-LESSON-EXTRACTION | Add review-based learning |
| CP7 | 43-PATTERN-DETECTION | Detect review patterns |

### New Step: Self-Review Framework

**Proposed Location**: After Step 12 (Agent Framework), before individual agents

```
CP1: AGENT SYSTEM
├── 12-AGENT-FRAMEWORK ──▶ 12a-SELF-REVIEW-FRAMEWORK ──▶ 13-ORCHESTRATOR-GRAPH
```

**Step 12a Contents**:
1. SelfReviewLoop implementation
2. SelfReviewResult schema
3. Gap detection utilities
4. Requirement extraction
5. Quality scoring
6. Learning integration hooks
7. Escalation handling

### Implementation Phases

**Phase 1: Core Framework** (Step 12a)
- Add SelfReviewLoop class
- Add SelfReviewResult schema
- Add BaseAgent.selfReview() method
- Add BaseAgent.addressGaps() method
- Add quality scoring utilities

**Phase 2: Agent-Specific Criteria** (Steps 15-32)
- Define review criteria for each agent
- Implement agent-specific validators
- Add requirement extraction per agent type

**Phase 3: Learning Integration** (Step 33 + CP7)
- Connect review results to lesson extraction
- Add review patterns to Qdrant
- Enable retrieval of similar review patterns
- Pre-emptive guidance from past reviews

---

## Configuration Options

```typescript
interface SelfReviewConfig {
  // Loop control
  enabled: boolean;                  // Default: true
  maxIterations: number;             // Default: 3
  qualityThreshold: number;          // Default: 0.8

  // Escalation
  escalateOnCriticalGaps: boolean;   // Default: true
  escalateAfterIterations: number;   // Default: 2

  // Performance
  timeoutPerIteration: number;       // Default: 60000 (1 min)
  cacheReviewResults: boolean;       // Default: true

  // Learning
  captureForLearning: boolean;       // Default: true
  learningThreshold: number;         // Gaps above this trigger learning

  // Agent-specific overrides
  agentOverrides: Record<string, Partial<SelfReviewConfig>>;
}
```

---

## Validation Checklist

### Step 12a: Self-Review Framework

```
□ Self-Review Framework
  □ SelfReviewLoop class implemented
  □ SelfReviewResult schema defined
  □ Gap interface defined
  □ RequirementCoverage interface defined
  □ BaseAgent.selfReview() method works
  □ BaseAgent.addressGaps() method works
  □ Quality scoring calculates correctly
  □ Escalation triggers on critical gaps
  □ Max iterations enforced
  □ Review results logged for learning
  □ Configuration options work
  □ Tests pass for all components
```

### Per-Agent Updates

```
□ Agent: [Name]
  □ Review criteria defined
  □ Validators implemented
  □ Requirement extractor works
  □ Gap addressing produces improvements
  □ Quality score reflects actual quality
  □ Learning hooks connected
  □ Tests pass
```

---

## API Impact

### New Endpoints

```typescript
// Get self-review results for a task
GET /api/v1/tasks/:id/reviews
Response: SelfReviewResult[]

// Get review patterns (learning insights)
GET /api/v1/agents/:agentId/review-patterns
Response: ReviewPattern[]

// Force re-review of an output
POST /api/v1/tasks/:id/re-review
Body: { agentId: string }
Response: SelfReviewResult
```

### SSE Event Updates

```typescript
// New event types for self-review
type ReviewEventType =
  | 'review_started'
  | 'review_iteration'
  | 'gaps_identified'
  | 'gaps_addressing'
  | 'review_passed'
  | 'review_escalated';

interface ReviewEvent {
  type: ReviewEventType;
  agentId: string;
  iteration: number;
  qualityScore: number;
  gapCount: number;
  decision?: 'approved' | 'needs_work' | 'escalate';
}
```

---

## UI Updates (Early Web Interface)

### Self-Review Visibility

```
Agent Activity Feed (with self-review):

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎨 UI Designer                                                              │
│ Creating mockups for login page...                                          │
│ ✓ Mockup created                                                            │
│                                                                             │
│ 🔍 Self-Review (Iteration 1)                                                │
│ Quality: 72% | Completeness: 85%                                            │
│ Gaps found:                                                                 │
│   • [Major] Missing forgot password screen                                  │
│   • [Minor] Design tokens not applied to buttons                            │
│                                                                             │
│ 🔧 Addressing gaps...                                                       │
│ ✓ Added forgot password screen                                              │
│ ✓ Applied design tokens to buttons                                          │
│                                                                             │
│ 🔍 Self-Review (Iteration 2)                                                │
│ Quality: 94% | Completeness: 100%                                           │
│ ✓ All requirements covered                                                  │
│ ✓ Review passed                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cost Considerations

### Token Usage Impact

| Scenario | Additional Tokens | Justification |
|----------|------------------|---------------|
| Self-review call | ~500-1000 per iteration | Validation prompt |
| Gap addressing | ~1000-2000 per gap | Improvement generation |
| Typical task (3 iterations) | ~5000-8000 additional | Quality assurance |

### Mitigation Strategies

1. **Caching**: Cache review results for similar outputs
2. **Fast-path**: Skip review for trivial tasks
3. **Progressive**: More thorough review for complex tasks
4. **Batching**: Review multiple aspects in single call

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Infinite loop | Low | High | Hard limit on iterations |
| Over-engineering | Medium | Medium | Quality threshold tuning |
| Token cost explosion | Medium | Medium | Caching, fast-path |
| False positives | Medium | Low | Human validation of patterns |
| Review hallucination | Low | Medium | Structured validation |

---

## Success Metrics

### Immediate (CP2 Completion)

```
□ Self-review loop functional for all agents
□ Average iterations to completion: < 2.5
□ Quality scores improve between iterations
□ Escalation rate: < 15%
□ User satisfaction with outputs: > 80%
```

### Long-term (CP7 Self-Evolution)

```
□ Common gaps decrease over time
□ First-iteration quality improves
□ Lessons successfully prevent repeat gaps
□ Agent performance correlates with review patterns
```

---

## Recommendation

**Approve this architecture** because:

1. **Quality assurance** - Agents validate their own work
2. **Requirement coverage** - All task requirements verified
3. **Iterative improvement** - Gaps addressed before completion
4. **Learning integration** - Review patterns improve future work
5. **Transparency** - Users see the review process
6. **Configurable** - Can tune per agent and task type

---

## Next Steps (Upon Approval)

1. Create **Step 12a: Self-Review Framework** in CP1
2. Update **Step 12: Agent Framework** with review hooks
3. Update each agent step (15-32) with review criteria
4. Update **Step 33: Lesson Extraction** with review learning
5. Update **24a: Early Web Interface** with review visibility
6. Update **CHECKPOINTS.md** with validation criteria
7. Update **00-OVERVIEW.md** with new step
