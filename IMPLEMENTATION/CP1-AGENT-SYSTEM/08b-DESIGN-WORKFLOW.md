# Step 08b: Design-First Workflow

> **Checkpoint:** CP2 - Design System
> **Previous Step:** 08a-ACTIVITY-SYSTEM.md
> **Next Step:** 24a-EARLY-WEB-INTERFACE.md

---

## Overview

The Design-First Workflow is the end-to-end process for generating UI designs from user prompts. This document describes the actual implementation in `src/core/design-workflow.ts` (~2000 lines).

Key capabilities:
- Generate 3 design options in parallel (Minimalist, Bold, Elegant)
- Extract design tokens from approved design
- Generate kitchen sink / component library
- Generate screen mockups with consistent styling
- Maintain design consistency across all outputs

---

## Workflow Stages

```
User Prompt
     ↓
┌────────────────────────────────────────────────┐
│ Stage 1: Generate Design Options (Parallel)   │
│   • UI Designer 1 → Minimalist Design         │
│   • UI Designer 2 → Bold Design               │
│   • UI Designer 3 → Elegant Design            │
└────────────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────────────┐
│ Stage 2: Select Design Direction              │
│   • User selects (--select N) or             │
│   • Auto-selects first option                 │
└────────────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────────────┐
│ Stage 3: Extract Tokens & Components          │
│   • extractDesignTokensFromHtml()             │
│   • extractComponentsFromDesign()             │
└────────────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────────────┐
│ Stage 4: Analysis & Architecture              │
│   • analyzeWithDesign() - Analyst agent       │
│   • planArchitecture() - Architect agent      │
└────────────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────────────┐
│ Stage 5: Identify Screens & Flows             │
│   • createUserFlows() - PM agent              │
│   • Parse screens with robust fallbacks       │
└────────────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────────────┐
│ Stage 6: Create Kitchen Sink                  │
│   • createKitchenSink() with buildDesignSpec()│
│   • Component library with all patterns       │
└────────────────────────────────────────────────┘
     ↓
┌────────────────────────────────────────────────┐
│ Stage 7: Generate Screen Mockups (Parallel)   │
│   • generateScreenMockup() × N screens        │
│   • Uses design spec + kitchen sink classes   │
└────────────────────────────────────────────────┘
     ↓
Output: .aigentflow/designs/
├── index.html (gallery)
├── options/option-1-minimalist.html
├── options/option-2-bold.html
├── options/option-3-elegant.html
├── kitchen-sink.html
├── styles.css
├── screens/*.html (N mockups)
└── flows/*.json (user flows)
```

---

## Key Functions

### Design Generation

| Function | Lines | Purpose |
|----------|-------|---------|
| `runDesignFirstWorkflow()` | 60-160 | Main entry point |
| `generateDesignOptions()` | 1100-1200 | Parallel 3 UI designers |
| `generateSingleDesignOption()` | 1200-1344 | Single design generation |

### Token Extraction

| Function | Lines | Purpose |
|----------|-------|---------|
| `extractDesignTokensFromHtml()` | 162-280 | Extract colors, fonts, spacing |
| `extractComponentsFromDesign()` | 280-376 | Extract button/card/form patterns |

### Design Consistency (Added 2025-12-30)

| Function | Lines | Purpose |
|----------|-------|---------|
| `buildDesignSpec()` | 378-440 | Generate CSS variables + instructions |
| `extractComponentSnippets()` | 442-490 | Extract component patterns |
| `listKitchenSinkClasses()` | 492-534 | List available CSS classes |

### Screen Generation

| Function | Lines | Purpose |
|----------|-------|---------|
| `createUserFlows()` | 1408-1620 | PM identifies screens & flows |
| `createKitchenSink()` | 1627-1707 | Generate component library |
| `generateScreenMockup()` | 1712-1786 | Generate single screen |

---

## Design Consistency System

### Problem

When a design is selected, subsequent outputs (kitchen sink, screens) didn't match the approved design colors and styles.

### Solution

The `buildDesignSpec()` function generates a comprehensive specification injected into every UI prompt:

```typescript
function buildDesignSpec(design: DesignOption): string {
  const tokens = design.tokens;
  const palette = design.colorPalette || [];

  const cssVars = `
:root {
  /* Colors - USE THESE EXACT VALUES */
  --color-primary: ${tokens?.colors.primary || palette[0]};
  --color-secondary: ${tokens?.colors.secondary || palette[1]};
  --color-accent: ${tokens?.colors.accent || palette[2]};
  --color-background: ${tokens?.colors.background};
  --color-surface: ${tokens?.colors.surface};
  --color-text: ${tokens?.colors.text};
  /* Typography */
  --font-heading: ${tokens?.typography.headingFont};
  --font-body: ${tokens?.typography.bodyFont};
  /* Spacing, Radius, Shadows... */
}`;

  return `
## APPROVED DESIGN: ${design.name}
Style: ${design.mood} - ${design.description}

## MANDATORY CSS VARIABLES
${cssVars}

## COLOR PALETTE
- Primary: ${tokens?.colors.primary} (CTAs, headers)
- Secondary: ${tokens?.colors.secondary} (accents)
- Accent: ${tokens?.colors.accent} (highlights)

## DESIGN MOOD
${design.mood}: Apply through spacing, shadows, border-radius
`;
}
```

---

## PM Screen Parsing

### Problem

PM agent sometimes returns different field names, causing 0 screens to be parsed.

### Solution

Robust parsing with fallbacks:

```typescript
if (Array.isArray(parsed.screens)) {
  screens = parsed.screens
    .map((s: Record<string, unknown>) => {
      // Generate id from name if not provided
      const rawId = String(s.id || s.name || '');
      const id = rawId.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      return {
        id,
        name: String(s.name || s.id || ''),
        description: String(s.description || s.name || ''),
        // Use type as fallback for category
        category: String(s.category || s.type || 'public'),
      };
    })
    .filter((s: Screen) => s.id && s.name);
}
```

### Parsing Strategies

1. **JSON Code Block** (primary): ````json { "screens": [...] } ```
2. **Pipe-Delimited** (fallback): `---SCREENS--- id|name|desc|category`
3. **Markdown Headings** (last resort): Extract from `### Screen Name`

---

## Output Structure

```
.aigentflow/designs/
├── index.html                    # Gallery with all artifacts
├── options/
│   ├── option-1-minimalist.html  # Design option 1
│   ├── option-2-bold.html        # Design option 2
│   └── option-3-elegant.html     # Design option 3
├── kitchen-sink.html             # Component library
├── styles.css                    # Extracted stylesheet
├── screens/
│   ├── landing-page.html         # Screen mockups
│   ├── login-screen.html
│   ├── dashboard.html
│   └── ... (N screens)
└── flows/
    └── user-flow.json            # User flow definitions
```

---

## CLI Integration

```bash
# Run with automatic approval
aigentflow run "Build a todo app" --no-approval --select 1

# Flags:
#   --no-approval    Skip approval prompts
#   --select N       Auto-select design option N (1-3)
```

---

## Environment Configuration

```env
# .env file
USE_CLAUDE_CLI=true              # Use Claude CLI for AI
AI_MODEL=claude-sonnet-4-20250514
AI_MAX_TOKENS=8192
AI_TEMPERATURE=0.7
CLAUDE_CLI_TIMEOUT=300000        # 5 minutes (increased from 2 min)
MAX_CONCURRENT_AGENTS=15
```

---

## Test Coverage

The design workflow is tested through:
- Unit tests for token extraction
- Integration tests for full workflow
- Manual testing with real prompts

Example test prompt used:
- "Shield & Navigate" coaching platform
- "Give As You Pay" micro-donation app (34 screens generated)

---

## Related Documentation

- `06-UI-DESIGNER-AGENT.md` - UI Designer agent specification
- `07-DESIGN-TOKENS.md` - Design token schema and CSS generation
- `08-USER-FLOWS.md` - Original user flows plan (see implementation note)
- `CP-RUNTIME-CHECKPOINT.md` - Runtime checkpoint with fixes

---

## Validation Checklist

```
[x] Design options generated in parallel (3 designers)
[x] Design tokens extracted from approved design
[x] Kitchen sink uses approved design tokens
[x] Screen mockups use consistent styling
[x] PM screen parsing handles field variations
[x] Fallback screens available if parsing fails
[x] Output gallery generated (index.html)
[x] CLI flags work (--no-approval, --select)
[x] Timeout sufficient for complex prompts (5 min)
```
