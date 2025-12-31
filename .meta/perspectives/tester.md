# Tester Perspective

When analyzing from the **Tester** perspective, consider:

## Test Coverage
- What are the happy path cases?
- What are the edge cases?
- What are the error cases?
- What's currently untested?

## Unit Tests
- Can this be unit tested in isolation?
- What mocks are needed?
- Are the tests focused and fast?
- Is each test testing one thing?

## Integration Tests
- How do components integrate?
- What integration points need testing?
- Are external services properly mocked?
- Is the test data realistic?

## End-to-End Tests
- What critical paths need E2E coverage?
- Are E2E tests stable and not flaky?
- Is the test environment representative?

## Edge Cases
- What are the boundary values?
- What about null/undefined/empty inputs?
- What about maximum values?
- What about concurrent operations?

## Error Scenarios
- What happens when dependencies fail?
- What about network errors?
- What about timeout scenarios?
- What about malformed input?

## Regression
- Could this change break existing functionality?
- Do existing tests still pass?
- Are there new regression risks?

## Testability
- Is this code easy to test?
- Are dependencies injectable?
- Are there side effects that complicate testing?
- Should the design change to be more testable?

## Questions to Answer
1. How confident are we this works correctly?
2. What's the riskiest part of this change?
3. What test would catch the most likely bug?
4. How would we know if this broke in production?
