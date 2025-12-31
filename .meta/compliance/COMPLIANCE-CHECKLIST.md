# Compliance Checklist

Master compliance requirements for Aigentflow. All code must pass these checks before merge.

> **Enforcement Layers:**
> 1. Meta-orchestrator rules (pre-write checks)
> 2. Pre-commit hooks (automated validation)
> 3. CI/CD gates (pipeline checks)
> 4. Runtime enforcement (in-app validation)

---

## Quick Reference

| Category | Requirement | Enforcement |
|----------|-------------|-------------|
| Security | OWASP Top 10 coverage | Pre-write + CI |
| Privacy | GDPR Article compliance | Pre-write + Runtime |
| Accessibility | WCAG 2.1 AA | CI + Manual |
| Licensing | Approved licenses only | Pre-commit + CI |
| Code Quality | 80% test coverage | Pre-commit + CI |
| Type Safety | TypeScript strict mode | Pre-commit |

---

## 1. Security Requirements

> See: `security-requirements.md` for detailed OWASP coverage

### 1.1 Pre-Write Security Checks (MANDATORY)

Before ANY file write, the security perspective MUST verify:

- [ ] **No Hardcoded Secrets**
  - No API keys, passwords, tokens in code
  - No hardcoded URLs that should be environment variables
  - No private IPs or internal hostnames

- [ ] **Injection Prevention**
  - SQL: Only parameterized queries via Drizzle ORM
  - Command: No shell command construction from user input
  - XSS: All user content through sanitization

- [ ] **Authentication/Authorization**
  - All new endpoints have auth guard
  - RLS policies exist for new tables
  - Tenant isolation verified

- [ ] **Data Handling**
  - PII fields marked in schema
  - Encryption at rest for sensitive fields
  - Audit logging for data access

### 1.2 OWASP Top 10 (2021) Coverage

| ID | Risk | Mitigation | Verified By |
|----|------|------------|-------------|
| A01 | Broken Access Control | PostgreSQL RLS, auth guards | Security agent |
| A02 | Cryptographic Failures | bcrypt passwords, TLS, encrypted PII | Security agent |
| A03 | Injection | Drizzle ORM, Zod validation | Pre-commit |
| A04 | Insecure Design | Threat modeling, secure defaults | Architect agent |
| A05 | Security Misconfiguration | Secure headers, minimal permissions | CI/CD |
| A06 | Vulnerable Components | npm audit, Snyk scan | CI/CD |
| A07 | Auth Failures | JWT rotation, rate limiting | Security agent |
| A08 | Data Integrity Failures | Signed releases, integrity checks | CI/CD |
| A09 | Logging Failures | Structured logging, no PII in logs | Security agent |
| A10 | SSRF | URL validation, allowlists | Security agent |

### 1.3 Security Gate Criteria

```yaml
# Blocking (must fix before merge)
- Hardcoded secrets detected
- SQL injection vulnerability
- Command injection vulnerability
- Missing authentication on endpoint
- Missing RLS policy on table
- XSS vulnerability

# Warning (should fix, requires justification to bypass)
- Missing rate limiting
- Missing audit logging
- Overly permissive CORS
- Weak password requirements
```

---

## 2. Privacy Requirements

> See: `privacy-requirements.md` for detailed GDPR coverage

### 2.1 Data Classification

| Classification | Examples | Requirements |
|---------------|----------|--------------|
| **PII** | Email, name, IP address | Encrypted, audit logged, consent tracked |
| **Sensitive PII** | SSN, health data, financial | Encrypted, access restricted, retention limits |
| **Internal** | System logs, metrics | No external exposure |
| **Public** | Documentation, marketing | No restrictions |

### 2.2 GDPR Article Compliance

| Article | Requirement | Implementation |
|---------|-------------|----------------|
| Art. 5 | Data minimization | Only collect necessary data |
| Art. 6 | Lawful basis | Document processing basis |
| Art. 7 | Consent | Explicit consent tracking |
| Art. 15 | Right of access | Data export API |
| Art. 17 | Right to erasure | Data deletion API |
| Art. 25 | Privacy by design | Default privacy settings |
| Art. 32 | Security measures | Encryption, access controls |
| Art. 33 | Breach notification | Incident response plan |

### 2.3 PII Handling Checklist

- [ ] PII fields identified in schema with `@pii` decorator
- [ ] Encryption at rest enabled for PII columns
- [ ] Access to PII is audit logged
- [ ] PII is not included in application logs
- [ ] Data retention policy defined and enforced
- [ ] Data export functionality available
- [ ] Data deletion functionality available
- [ ] Consent tracking implemented where required

---

## 3. Accessibility Requirements

### 3.1 WCAG 2.1 AA Compliance

| Principle | Guidelines | Verification |
|-----------|------------|--------------|
| **Perceivable** | Alt text, captions, color contrast | axe-core scan |
| **Operable** | Keyboard nav, focus visible, timing | Manual + automated |
| **Understandable** | Clear labels, error identification | Manual review |
| **Robust** | Valid HTML, ARIA support | axe-core + W3C validator |

### 3.2 Accessibility Checklist

- [ ] All images have descriptive alt text
- [ ] Color contrast ratio >= 4.5:1 for text
- [ ] All functionality available via keyboard
- [ ] Focus indicators visible
- [ ] Form inputs have associated labels
- [ ] Error messages are descriptive and linked to fields
- [ ] Page has proper heading hierarchy
- [ ] ARIA landmarks used appropriately
- [ ] Dynamic content updates announced to screen readers

### 3.3 Automated Testing

```bash
# Run accessibility audit
pnpm test:a11y

# Tools used:
# - axe-core for automated checks
# - Lighthouse accessibility audit
# - WAVE browser extension (manual)
```

---

## 4. License Compliance

> See: `license-allowlist.yaml` for approved licenses

### 4.1 Approved Licenses

| License | Status | Notes |
|---------|--------|-------|
| MIT | Approved | Preferred |
| Apache-2.0 | Approved | Preferred |
| BSD-2-Clause | Approved | |
| BSD-3-Clause | Approved | |
| ISC | Approved | |
| 0BSD | Approved | |
| CC0-1.0 | Approved | For data/docs |
| Unlicense | Approved | |

### 4.2 Restricted Licenses

| License | Status | Notes |
|---------|--------|-------|
| GPL-2.0 | Restricted | Requires legal review |
| GPL-3.0 | Restricted | Requires legal review |
| LGPL-2.1 | Restricted | Requires legal review |
| LGPL-3.0 | Restricted | Requires legal review |
| AGPL-3.0 | Prohibited | Do not use |
| SSPL | Prohibited | Do not use |
| BSL | Restricted | Check terms |

### 4.3 License Check Automation

```bash
# Pre-commit hook
pnpm license:check

# CI/CD gate
license-checker --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD"
```

---

## 5. Code Quality Requirements

### 5.1 Test Coverage

| Metric | Minimum | Target |
|--------|---------|--------|
| Statements | 80% | 90% |
| Branches | 75% | 85% |
| Functions | 80% | 90% |
| Lines | 80% | 90% |

### 5.2 Code Quality Gates

```yaml
# Pre-commit requirements
- TypeScript strict mode passes
- ESLint no errors (warnings allowed)
- Prettier formatting applied
- Test coverage >= 80%

# CI/CD requirements
- All tests pass
- No security vulnerabilities (npm audit)
- License compliance verified
- Build succeeds
- Docker image builds
```

### 5.3 Static Analysis

| Tool | Purpose | Gate |
|------|---------|------|
| TypeScript | Type safety | Pre-commit |
| ESLint | Code quality | Pre-commit |
| Prettier | Formatting | Pre-commit |
| npm audit | Vulnerability scan | CI |
| Snyk | Deep security scan | CI |
| SonarQube | Code quality metrics | CI (optional) |

---

## 6. Enforcement Configuration

### 6.1 Pre-Commit Hooks

```yaml
# .husky/pre-commit
#!/bin/sh

# Type check
pnpm type-check || exit 1

# Lint
pnpm lint || exit 1

# Test with coverage
pnpm test:coverage || exit 1

# Secret detection
gitleaks protect --staged || exit 1

# License check
pnpm license:check || exit 1
```

### 6.2 CI/CD Pipeline Gates

```yaml
# .github/workflows/ci.yml
jobs:
  security:
    steps:
      - name: Secret Detection
        uses: gitleaks/gitleaks-action@v2

      - name: Dependency Audit
        run: pnpm audit --audit-level=high

      - name: SAST Scan
        uses: github/codeql-action/analyze@v2

  quality:
    steps:
      - name: Type Check
        run: pnpm type-check

      - name: Lint
        run: pnpm lint

      - name: Test
        run: pnpm test:coverage

      - name: Coverage Gate
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 80% threshold"
            exit 1
          fi

  license:
    steps:
      - name: License Check
        run: pnpm license:check

  accessibility:
    steps:
      - name: Build
        run: pnpm build

      - name: Accessibility Audit
        run: pnpm test:a11y
```

### 6.3 Runtime Enforcement

```typescript
// Built into Aigentflow application

// 1. PostgreSQL RLS - tenant isolation
CREATE POLICY tenant_isolation ON agents
  USING (tenant_id = current_setting('app.tenant_id'));

// 2. Zod validation - input validation
const input = agentInputSchema.parse(request.body);

// 3. Audit logging - sensitive operations
await auditLog.record({
  action: 'agent.execute',
  userId: user.id,
  tenantId: tenant.id,
  resourceId: agent.id,
  timestamp: new Date(),
});

// 4. Rate limiting - abuse prevention
@RateLimit({ points: 100, duration: 60 })
@Post('execute')
async execute() { ... }
```

---

## 7. Compliance Review Process

### 7.1 Per-Checkpoint Review

At each checkpoint, verify:

1. **Security Review**
   - [ ] All new endpoints have auth
   - [ ] All new tables have RLS
   - [ ] No new security vulnerabilities
   - [ ] Secrets management verified

2. **Privacy Review**
   - [ ] New PII fields documented
   - [ ] Data flows documented
   - [ ] Consent requirements met
   - [ ] Retention policies applied

3. **Quality Review**
   - [ ] Test coverage maintained
   - [ ] No new technical debt
   - [ ] Documentation updated
   - [ ] Performance acceptable

### 7.2 Release Review

Before any release:

1. **Security Audit**
   - [ ] Penetration test completed (major releases)
   - [ ] Dependency vulnerabilities resolved
   - [ ] Security headers configured
   - [ ] TLS/certificates valid

2. **Compliance Audit**
   - [ ] Privacy impact assessment
   - [ ] Accessibility audit
   - [ ] License compliance report
   - [ ] Data processing documentation

3. **Sign-off**
   - [ ] Security team approval
   - [ ] Legal review (if required)
   - [ ] Product owner approval

---

## 8. Incident Response

### 8.1 Security Incident

```
1. DETECT - Identify and confirm the incident
2. CONTAIN - Isolate affected systems
3. ERADICATE - Remove threat
4. RECOVER - Restore services
5. LESSONS - Post-incident review
```

### 8.2 Data Breach

```
1. IDENTIFY - Scope of breach, data affected
2. CONTAIN - Stop ongoing breach
3. ASSESS - Impact assessment, affected users
4. NOTIFY - Within 72 hours per GDPR Art. 33
5. REMEDIATE - Fix vulnerabilities
6. DOCUMENT - Full incident report
```

### 8.3 Contact

- Security issues: security@aigentflow.io
- Privacy concerns: privacy@aigentflow.io
- Compliance questions: compliance@aigentflow.io

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-31 | Initial compliance checklist |
