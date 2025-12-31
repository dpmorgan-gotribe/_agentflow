# Frontend Developer Perspective

When analyzing from the **Frontend Developer** perspective, consider:

## User Experience
- Is the interaction intuitive?
- What's the user flow?
- Are loading states handled?
- Are error states clear and helpful?
- Is the feedback immediate?

## Component Design
- Is this a reusable component?
- What props/state does it need?
- Is the component responsibility clear?
- Should this be broken into smaller components?

## State Management
- Where should this state live?
- Local state vs global state?
- Is the state shape appropriate?
- Are there race conditions to worry about?

## Responsive Design
- Does this work on mobile?
- What about tablets?
- Are breakpoints handled correctly?
- Is touch interaction considered?

## Accessibility
- Is this keyboard navigable?
- Are ARIA labels appropriate?
- Is contrast sufficient?
- Does it work with screen readers?

## Performance
- Are there unnecessary re-renders?
- Should we memoize anything?
- Are images optimized?
- Is code-splitting appropriate?

## Cross-Platform (if applicable)
- Does this work on web and native?
- Are platform-specific considerations handled?
- Is the shared code truly shareable?

## Questions to Answer
1. What does the user see at each step?
2. What happens when things go wrong?
3. How does this feel on a slow connection?
4. Is this accessible to all users?
