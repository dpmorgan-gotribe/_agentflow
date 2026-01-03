# Bug Fix: Scalable UI Artifact Generation

## Metadata
| Field | Value |
|-------|-------|
| Created | 2026-01-03 |
| Status | in_progress |
| Type | bug_fix + architecture |
| Phase | 3 (Design System) |
| Priority | critical |
| Supersedes | bug-2026-01-03-ui-designer-json-parse.md |

## Original Prompt
> UI Designer agent fails with JSON parse error for complex apps

## Error Details
- **Error Message**: `SyntaxError: Expected ',' or '}' after property value in JSON at position 24974`
- **Observed On**: Osteopath project (10+ screens, premium design)

---

## The Problem

### Immediate Symptom
UI Designer agent fails when generating mockups for complex applications. Claude returns a 74KB+ JSON response with nested component trees that gets truncated, causing JSON parse failures.

### Evidence
```
osteopath project:
├── designs/mockups/     ← EMPTY (no files generated)
├── research/            ← Style research completed OK
└── styles/              ← Style package created OK
```

The workflow fails at UI Designer because the JSON response is too large.

### Current Architecture (Flawed)

```
┌─────────────────────────────────────────────────────────────┐
│                    Current Flow                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Claude returns:                                             │
│  {                                                           │
│    "pages": [{                                               │
│      "components": [{                                        │
│        "children": [{                                        │
│          "children": [{ ... }]  ← Deep nesting              │
│        }]                                                    │
│      }]                                                      │
│    }]                              ← 74KB+ JSON              │
│  }                                                           │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                         │
│  │  JSON.parse()   │ ← FAILS: Truncated at position 24974   │
│  └─────────────────┘                                         │
│           │                                                  │
│           ✗ Never reaches file writing code                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Why the Previous Plan Won't Work

The previous plan (`bug-2026-01-03-ui-designer-json-parse.md`) proposed:
> "Agent writes files directly → returns only paths"

**This is impossible because:**
1. Claude CLI returns TEXT only - it cannot write files
2. The agent code writes files AFTER parsing Claude's response
3. If Claude's response is truncated, JSON.parse() fails
4. We never reach the file-writing code

The previous plan also partially implemented `outputDir` and `writeArtifactFile()`, but these only help AFTER successful parsing.

---

## Root Cause Analysis

```
WHY does JSON parse fail?
  └─▶ Response truncated at ~25KB of a ~75KB JSON

WHY is response truncated?
  └─▶ Output approaches token limits / streaming cutoff

WHY is JSON 75KB?
  └─▶ Schema requires FULL component trees with all properties:
      - Every component with styles, accessibility, children
      - All CSS properties inline
      - All content embedded

WHY does schema require full trees?
  └─▶ Design assumed Claude would return parseable HTML structure

ROOT CAUSE: Schema design conflates SPECIFICATION with CONTENT
  - Claude should specify WHAT to build (small)
  - Agent code should generate HOW to build it (large)
```

---

## Solution: Specification-Driven Generation

### Core Principle
> **Claude returns SPECIFICATIONS (3KB), agent generates CONTENT (75KB)**

```
┌─────────────────────────────────────────────────────────────┐
│                    New Flow                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Claude returns SPECIFICATION (~3KB):                        │
│  {                                                           │
│    "pages": [{                                               │
│      "name": "Landing",                                      │
│      "sections": [                                           │
│        { "type": "hero", "variant": "split" },              │
│        { "type": "features", "variant": "grid-3" }          │
│      ]                                                       │
│    }],                                                       │
│    "style": { "mood": "elegant", "primary": "#1A2B4A" }     │
│  }                                                           │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                         │
│  │  JSON.parse()   │ ← SUCCEEDS: Only 3KB                   │
│  └─────────────────┘                                         │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────┐                     │
│  │  Agent Code: spec-to-html.ts        │                     │
│  │  - Load section templates           │                     │
│  │  - Apply design tokens              │                     │
│  │  - Generate 75KB of HTML            │                     │
│  └─────────────────────────────────────┘                     │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                         │
│  │  Write Files    │ ← landing.html, about.html, etc.       │
│  └─────────────────┘                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Size Comparison

| App Complexity | Current (Full Tree) | New (Specification) |
|----------------|---------------------|---------------------|
| 3 screens | ~25KB | ~1KB |
| 10 screens | ~75KB ❌ | ~3KB ✓ |
| 20 screens | ~200KB ❌ | ~5KB ✓ |
| 50 screens | ~500KB ❌ | ~10KB ✓ |

---

## New Schema Design

### UIDesignerSpecification (What Claude Returns)

```typescript
// ~3KB for a 10-page app
interface UIDesignerSpecification {
  projectName: string;

  // Design direction (not full tokens)
  style: {
    mood: 'minimal' | 'bold' | 'elegant' | 'playful' | 'professional';
    primaryColor: string;      // "#1A2B4A"
    secondaryColor: string;
    accentColor: string;
    fontHeading: string;       // "Cormorant Garamond"
    fontBody: string;          // "Satoshi"
    darkMode: boolean;
  };

  // Page specifications (not full component trees)
  pages: Array<{
    id: string;
    name: string;
    path: string;              // "/about"
    description: string;       // "Company story and team"
    layout: 'full-width' | 'sidebar' | 'centered';
    sections: Array<{
      type: SectionType;       // "hero" | "features" | "testimonials" | ...
      variant?: string;        // "split-left" | "grid-3" | "carousel"
      content?: {
        heading?: string;
        subheading?: string;
        items?: string[];      // Feature titles, testimonial names, etc.
      };
    }>;
  }>;

  // Just component NAMES that are shared
  sharedComponents: string[];  // ["navbar", "footer", "cta-button"]
}
```

### Section Type Library

```typescript
type SectionType =
  // Heroes
  | 'hero'              // Full-width hero
  | 'hero-split'        // Split with image
  | 'hero-video'        // Video background

  // Content
  | 'features-grid'     // 3-4 column feature cards
  | 'features-list'     // Vertical feature list
  | 'features-icons'    // Icon-focused features

  // Social Proof
  | 'testimonials-carousel'
  | 'testimonials-grid'
  | 'testimonials-quotes'

  // Conversion
  | 'pricing-table'
  | 'pricing-cards'
  | 'cta-banner'
  | 'cta-centered'

  // Information
  | 'team-grid'
  | 'process-steps'
  | 'faq-accordion'
  | 'stats-bar'

  // Contact
  | 'contact-form'
  | 'contact-split'
  | 'map-section'

  // Navigation
  | 'navbar'
  | 'navbar-mega'
  | 'footer-simple'
  | 'footer-mega';
```

---

## Implementation Plan

### Phase 1: Specification Schema ✅
**Goal**: Define the minimal schema Claude will return

- [x] 1.1 Create `packages/agents/src/schemas/ui-designer-spec.ts`
- [x] 1.2 Define `SectionTypeSchema` enum (50+ section types)
- [x] 1.3 Define `SectionSpecSchema` (type + variant + content)
- [x] 1.4 Define `PageSpecSchema` (id, name, path, layout, sections)
- [x] 1.5 Define `StyleSpecSchema` (mood, colors, fonts)
- [x] 1.6 Define `UIDesignerSpecificationSchema` (complete)
- [x] 1.7 Add validation helpers and type exports

### Phase 2: Section Template Library ✅
**Goal**: HTML templates for each section type

- [x] 2.1 Create `packages/agents/src/design/templates/` directory
- [x] 2.2 Create template registry (`templates/index.ts`)
- [x] 2.3 Implement hero templates (3 variants)
- [x] 2.4 Implement features templates (2 variants: grid + list)
- [x] 2.5 Implement testimonials templates (grid)
- [x] 2.6 Implement pricing templates (cards)
- [x] 2.7 Implement CTA templates (banner)
- [x] 2.8 Implement contact templates (form)
- [x] 2.9 Implement navigation/footer templates (navbar, footer-simple, footer-mega)
- [x] 2.10 Implement additional templates (faq-accordion, stats-bar, process-steps)

### Phase 3: Spec-to-HTML Generator ✅
**Goal**: Convert specification to full HTML/CSS

- [x] 3.1 Create `packages/agents/src/design/spec-to-html.ts`
- [x] 3.2 Implement `generateCSS(style)` - creates CSS variables
- [x] 3.3 Implement `generateSectionHTML(spec, style)` - renders section
- [x] 3.4 Implement `generatePageHTML(pageSpec, style)` - full page HTML
- [x] 3.5 Implement `generateAllPages(spec)` - orchestrates all pages
- [x] 3.6 Add responsive styles handling
- [x] 3.7 Export from `design/index.ts`

### Phase 4: Update UI Designer Agent ✅
**Goal**: Switch to specification mode for complex apps

- [x] 4.1 Add `buildSpecificationSystemPrompt()` with example output
- [x] 4.2 Add `tryParseAsSpecification()` response handler
- [x] 4.3 Update `processResult()` to call spec-to-html generator
- [x] 4.4 Add `shouldUseSpecificationMode()` complexity detection (>5 screens)
- [x] 4.5 Keep backward compat for simple apps via schema detection
- [x] 4.6 Add `processSpecificationResult()` method
- [x] 4.7 TypeScript passes

### Phase 5: Integration & Testing

- [ ] 5.1 Unit tests for specification schema
- [ ] 5.2 Unit tests for each template
- [ ] 5.3 Unit tests for spec-to-html generator
- [ ] 5.4 Integration test: osteopath project (10+ screens)
- [ ] 5.5 Visual review of generated mockups
- [ ] 5.6 Clean up partial implementation from previous attempt

---

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `schemas/ui-designer-spec.ts` | CREATE | Minimal specification schema |
| `design/templates/index.ts` | CREATE | Template registry |
| `design/templates/*.ts` | CREATE | Section HTML templates |
| `design/spec-to-html.ts` | CREATE | Specification → HTML generator |
| `agents/ui-designer.ts` | MODIFY | Add specification mode |
| `schemas/ui-designer-output.ts` | MODIFY | Add spec field to output |

## Cleanup Needed

Files partially modified that need review:
- `packages/agents/src/utils/file-writer.ts` - Keep, still useful
- `packages/agents/src/types.ts` - Keep outputDir addition
- `apps/api/src/modules/workflow/agent-adapter.ts` - Keep outputDir passing

---

## Current Step
**Phase 5, Step 5.4**: Integration test with osteopath project

## Resume Notes
**Last action**: Completed Phase 4 - UI Designer agent now supports specification mode
**Next action**: Run integration test with a complex app to verify the fix works
**Blockers**: None

### Implementation Summary
- Created `ui-designer-spec.ts` with 50+ section types
- Created `templates/index.ts` with 13 section templates
- Created `spec-to-html.ts` with full HTML/CSS generation
- Updated `ui-designer.ts` with specification mode:
  - Auto-detects >5 screens and switches to spec mode
  - Parses Claude's ~3KB specification
  - Generates ~75KB HTML using templates
  - Writes files to outputDir

---

## Success Criteria

1. ✓ Osteopath project (10+ screens) generates successfully
2. ✓ JSON response stays under 10KB for any app size
3. ✓ All mockups render correctly in preview
4. ✓ Style competition works with 5 parallel designers
5. ✓ No truncation errors in any scenario

## Lesson to Capture (After Implementation)

- **Category**: architecture
- **Title**: Specification-Driven Generation for Large Outputs
- **Root Cause**: Asking AI to return large content in JSON
- **Prevention**: Schema design must separate what (specification) from how (content)
- **Pattern**: AI returns decisions/specs → Code generates content
- **Anti-Pattern**: AI returns >10KB JSON with inline content
