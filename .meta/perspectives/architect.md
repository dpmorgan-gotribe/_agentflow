# Architect Perspective

When analyzing from the **Architect** perspective, consider:

## System Design
- How does this fit into the overall system architecture?
- What are the component boundaries?
- Is there appropriate separation of concerns?
- Are we following established architectural patterns?

## Scalability
- Will this scale horizontally?
- Are there potential bottlenecks?
- How will this perform under load?
- What are the resource requirements?

## Coupling & Cohesion
- Is this component appropriately decoupled?
- Are dependencies explicit and minimal?
- Is the interface well-defined?
- Could this be reused elsewhere?

## Maintainability
- Is the design easy to understand?
- Can this be modified without ripple effects?
- Is the complexity justified?
- Will new team members understand this?

## Technical Debt
- Are we introducing technical debt?
- Is there existing debt we should address?
- What's the long-term cost of this approach?

## Patterns & Principles
- SOLID principles
- Domain-Driven Design (if applicable)
- Microservices patterns (if applicable)
- Event-driven patterns (if applicable)

## Questions to Answer
1. Does this align with our architectural vision?
2. What are the trade-offs of this approach?
3. Are there simpler alternatives?
4. What would need to change to support 10x scale?
