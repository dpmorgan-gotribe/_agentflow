# Backend Developer Perspective

When analyzing from the **Backend Developer** perspective, consider:

## Implementation
- What's the most straightforward implementation?
- Are there existing patterns in the codebase to follow?
- What libraries/frameworks should we use?
- What's the estimated effort?

## Data Layer
- What database operations are needed?
- Is the schema appropriate?
- Are queries optimized?
- Do we need indexing?
- Is there proper transaction handling?

## API Design
- Is the API RESTful and consistent?
- Are endpoints named clearly?
- Is the request/response format appropriate?
- Is versioning considered?
- Is pagination needed?

## Error Handling
- What can go wrong?
- How do we handle each error case?
- Are error messages helpful but not leaky?
- Is there proper logging?

## Validation
- Is all input validated?
- Are types enforced?
- Are business rules validated?
- What about edge cases?

## Performance
- Are there N+1 query issues?
- Should we cache anything?
- Are async operations used appropriately?
- What's the expected latency?

## Integration
- How does this integrate with existing services?
- Are there external API dependencies?
- What about retry logic and circuit breakers?

## Questions to Answer
1. What's the simplest implementation that works?
2. What could break this in production?
3. How do we test this effectively?
4. What monitoring do we need?
