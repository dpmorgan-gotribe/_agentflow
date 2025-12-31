# Testing Requirements

Standard testing practices for this project.

## Coverage Requirements

- **Minimum overall coverage**: 80%
- **Critical paths**: 100%
- **New code**: Must have tests

## Test Types

### Unit Tests
- Test individual functions/classes in isolation
- Mock external dependencies
- Fast to run (<100ms per test)
- Located next to source: `*.test.ts`

```typescript
describe('calculateTotal', () => {
  it('should sum item prices', () => {
    const items = [{ price: 10 }, { price: 20 }];
    expect(calculateTotal(items)).toBe(30);
  });

  it('should return 0 for empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });

  it('should handle negative values', () => {
    const items = [{ price: 10 }, { price: -5 }];
    expect(calculateTotal(items)).toBe(5);
  });
});
```

### Integration Tests
- Test component interactions
- Use real dependencies where practical
- Located in `tests/integration/`

### E2E Tests
- Test critical user flows
- Run against real or staging environment
- Located in `tests/e2e/`
- Keep minimal - slow and potentially flaky

## What to Test

### Always Test
- Public APIs and interfaces
- Business logic
- Error handling
- Edge cases and boundaries
- Security-related code

### Test Patterns
```typescript
describe('Feature', () => {
  describe('happy path', () => {
    it('should handle normal input', () => {});
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {});
    it('should handle maximum values', () => {});
    it('should handle special characters', () => {});
  });

  describe('error cases', () => {
    it('should throw for invalid input', () => {});
    it('should handle network errors', () => {});
  });
});
```

## Mocking

### What to Mock
- External APIs
- Database (for unit tests)
- Time-dependent operations
- Random operations

### What NOT to Mock
- The code under test
- Simple pure functions
- Types/interfaces

### Mocking Pattern
```typescript
// Create mock with type safety
const mockService = {
  getData: jest.fn<Promise<Data>, [string]>(),
};

// Setup
mockService.getData.mockResolvedValue(testData);

// Verify
expect(mockService.getData).toHaveBeenCalledWith('id');
```

## Test Data

### Use Factories
```typescript
const createTestUser = (overrides?: Partial<User>): User => ({
  id: 'test-id',
  name: 'Test User',
  email: 'test@example.com',
  ...overrides,
});
```

### Keep Test Data Minimal
- Only include what the test needs
- Don't create realistic-looking fake data that might be confused with real data

## Assertions

### Be Specific
```typescript
// ❌ Bad
expect(result).toBeTruthy();

// ✅ Good
expect(result.status).toBe('success');
expect(result.data.length).toBe(3);
```

### One Concept Per Test
```typescript
// ❌ Bad - testing multiple things
it('should validate and save user', () => {
  expect(validate(user)).toBe(true);
  expect(save(user)).toBeTruthy();
});

// ✅ Good - separate tests
it('should validate user', () => {
  expect(validate(user)).toBe(true);
});

it('should save valid user', () => {
  expect(save(validUser)).toBeTruthy();
});
```
