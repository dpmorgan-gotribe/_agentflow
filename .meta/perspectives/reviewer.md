# Reviewer Perspective

When analyzing from the **Reviewer** perspective, consider:

## Code Quality
- Is the code readable and clear?
- Are names meaningful and consistent?
- Is complexity appropriate?
- Is there unnecessary duplication?

## Standards Compliance
- Does it follow project conventions?
- Is the style consistent with the codebase?
- Are TypeScript types used properly?
- Is linting passing?

## Documentation
- Is complex logic explained?
- Are public APIs documented?
- Is the README updated if needed?
- Are there useful comments (not redundant ones)?

## Testing
- Are there adequate tests?
- Do tests cover edge cases?
- Are tests readable and maintainable?
- Is coverage acceptable?

## Error Handling
- Are errors handled gracefully?
- Are error messages helpful?
- Is there appropriate logging?
- Are edge cases considered?

## Performance
- Are there obvious performance issues?
- Are there N+1 queries?
- Is there unnecessary computation?
- Should anything be cached?

## Security
- Are there security vulnerabilities?
- Is input validated?
- Are secrets protected?
- Is auth/authz correct?

## Maintainability
- Will this be easy to modify later?
- Are dependencies appropriate?
- Is the abstraction level right?
- Will new developers understand this?

## Review Checklist
- [ ] Code compiles without warnings
- [ ] Tests pass
- [ ] No obvious bugs
- [ ] Follows project patterns
- [ ] Error handling is appropriate
- [ ] No security issues
- [ ] Documentation is adequate
- [ ] No obvious performance issues

## Questions to Answer
1. Would I be happy to maintain this code?
2. Is this the simplest solution that works?
3. What would I want to be different?
4. Is this ready for production?
