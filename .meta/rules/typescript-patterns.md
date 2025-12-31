# TypeScript Patterns

Standard TypeScript patterns to follow in this project.

## Types

### Always use explicit types
```typescript
// ❌ Bad
const process = (data) => { ... }

// ✅ Good  
const process = (data: InputData): OutputData => { ... }
```

### Prefer interfaces for objects
```typescript
// ✅ Preferred
interface User {
  id: string;
  name: string;
}

// ⚠️ Use type for unions/intersections
type Status = 'active' | 'inactive';
```

### Use `unknown` instead of `any`
```typescript
// ❌ Bad
function parse(data: any) { ... }

// ✅ Good
function parse(data: unknown) { 
  if (isValidData(data)) { ... }
}
```

## Error Handling

### Use typed errors
```typescript
class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
```

### Handle errors explicitly
```typescript
// ✅ Good
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof DomainError) {
    // Handle known error
  } else {
    // Log and rethrow unknown errors
    logger.error('Unexpected error', { error });
    throw error;
  }
}
```

## Async/Await

### Always await promises
```typescript
// ❌ Bad - unhandled promise
saveData(data);

// ✅ Good
await saveData(data);
```

### Use Promise.all for parallel operations
```typescript
// ❌ Bad - sequential when could be parallel
const user = await getUser(id);
const orders = await getOrders(id);

// ✅ Good - parallel
const [user, orders] = await Promise.all([
  getUser(id),
  getOrders(id)
]);
```

## Null Handling

### Use optional chaining
```typescript
// ✅ Good
const city = user?.address?.city;
```

### Use nullish coalescing
```typescript
// ✅ Good
const name = user.name ?? 'Anonymous';
```

### Validate at boundaries
```typescript
// Validate at API boundaries, then types flow through
function handleRequest(body: unknown): Response {
  const validated = validateInput(body); // Throws if invalid
  return processValidated(validated);    // Types are now known
}
```

## Enums

### Prefer const assertions for simple cases
```typescript
// ✅ Good for simple string unions
const Status = {
  Active: 'active',
  Inactive: 'inactive',
} as const;

type Status = typeof Status[keyof typeof Status];
```

### Use enums for complex cases
```typescript
// ✅ Good when you need reverse mapping or iteration
enum Permission {
  Read = 1,
  Write = 2,
  Admin = 4,
}
```
