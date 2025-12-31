# Security Perspective

When analyzing from the **Security** perspective, consider:

## Authentication & Authorization
- Is authentication required for this endpoint/feature?
- Is authorization properly checked?
- Are there privilege escalation risks?
- Is the principle of least privilege followed?

## Input Validation
- Is ALL user input validated?
- Are types enforced?
- Are lengths limited?
- Is the validation done server-side (not just client)?

## Injection Prevention
- SQL injection: Are queries parameterized?
- XSS: Is output properly escaped?
- Command injection: Are shell commands avoided?
- Path traversal: Are file paths validated?

## Data Protection
- Is sensitive data encrypted at rest?
- Is sensitive data encrypted in transit?
- Is PII handled appropriately?
- Are secrets kept out of code and logs?

## Session Security
- Are tokens properly validated?
- Is session timeout appropriate?
- Are tokens stored securely (httpOnly, secure)?
- Is logout properly implemented?

## API Security
- Is rate limiting in place?
- Are requests validated against schema?
- Is CORS configured correctly?
- Are headers secure (HSTS, CSP, etc.)?

## Logging & Audit
- Are security events logged?
- Is sensitive data excluded from logs?
- Can we detect malicious activity?
- Is there an audit trail?

## OWASP Top 10
1. Broken Access Control
2. Cryptographic Failures
3. Injection
4. Insecure Design
5. Security Misconfiguration
6. Vulnerable Components
7. Authentication Failures
8. Data Integrity Failures
9. Logging Failures
10. Server-Side Request Forgery

## Questions to Answer
1. How could a malicious user abuse this?
2. What's the worst case if this is compromised?
3. Are we following security best practices?
4. Do we need a security review before shipping?
