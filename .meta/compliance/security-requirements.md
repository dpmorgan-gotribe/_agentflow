# Security Requirements

Detailed security requirements based on OWASP Top 10 (2021) and enterprise security best practices.

---

## OWASP Top 10 Coverage

### A01:2021 - Broken Access Control

**Risk:** Users acting outside their intended permissions.

**Mitigations:**

1. **Row-Level Security (RLS)**
   ```sql
   -- Every table with tenant data MUST have RLS
   ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

   CREATE POLICY tenant_isolation ON agents
     FOR ALL
     USING (tenant_id = current_setting('app.tenant_id')::uuid);
   ```

2. **Authorization Guards**
   ```typescript
   // Every endpoint MUST have auth guard
   @UseGuards(JwtAuthGuard, RolesGuard)
   @Roles('admin', 'user')
   @Get('agents')
   async findAll() { ... }
   ```

3. **Resource Ownership Checks**
   ```typescript
   // Verify ownership before operations
   async updateAgent(id: string, userId: string, dto: UpdateDto) {
     const agent = await this.findById(id);
     if (agent.ownerId !== userId) {
       throw new ForbiddenError('Not authorized to update this agent');
     }
     // proceed with update
   }
   ```

**Verification:**
- [ ] All tables have RLS enabled
- [ ] All endpoints have authentication
- [ ] Role-based access implemented
- [ ] Ownership verified for mutations

---

### A02:2021 - Cryptographic Failures

**Risk:** Exposure of sensitive data due to weak or missing encryption.

**Mitigations:**

1. **Password Hashing**
   ```typescript
   import bcrypt from 'bcrypt';

   const SALT_ROUNDS = 12;

   async function hashPassword(password: string): Promise<string> {
     return bcrypt.hash(password, SALT_ROUNDS);
   }

   async function verifyPassword(password: string, hash: string): Promise<boolean> {
     return bcrypt.compare(password, hash);
   }
   ```

2. **Data Encryption at Rest**
   ```typescript
   // Sensitive columns use pgcrypto
   // schema.ts
   export const users = pgTable('users', {
     id: uuid('id').primaryKey(),
     email: text('email').notNull(),
     // Encrypted PII
     ssn: text('ssn_encrypted'), // Encrypted with tenant key
   });
   ```

3. **TLS in Transit**
   ```typescript
   // Force HTTPS in production
   if (env.NODE_ENV === 'production') {
     app.use((req, res, next) => {
       if (req.header('x-forwarded-proto') !== 'https') {
         res.redirect(`https://${req.header('host')}${req.url}`);
       } else {
         next();
       }
     });
   }
   ```

**Verification:**
- [ ] Passwords hashed with bcrypt (cost >= 12)
- [ ] PII encrypted at rest
- [ ] TLS 1.2+ enforced
- [ ] No sensitive data in URLs

---

### A03:2021 - Injection

**Risk:** Hostile data sent to interpreter as part of command/query.

**Mitigations:**

1. **SQL Injection Prevention**
   ```typescript
   // ✅ ALWAYS use Drizzle ORM parameterized queries
   const agent = await db.query.agents.findFirst({
     where: eq(agents.id, agentId), // Safe - parameterized
   });

   // ❌ NEVER concatenate SQL
   // const agent = db.execute(`SELECT * FROM agents WHERE id = '${agentId}'`);
   ```

2. **Command Injection Prevention**
   ```typescript
   // ✅ Use spawn with array arguments
   import { spawn } from 'child_process';

   const proc = spawn('git', ['log', '--oneline', '-n', '10']);

   // ❌ NEVER use shell with user input
   // exec(`git log ${userInput}`);
   ```

3. **NoSQL Injection Prevention**
   ```typescript
   // ✅ Validate all query parameters
   const query = querySchema.parse(req.query);
   const results = await collection.find(query);
   ```

**Verification:**
- [ ] All database queries use ORM
- [ ] No raw SQL with string concatenation
- [ ] No shell execution with user input
- [ ] All inputs validated with Zod

---

### A04:2021 - Insecure Design

**Risk:** Missing or ineffective security controls.

**Mitigations:**

1. **Threat Modeling**
   - Document threat model for each feature
   - Identify trust boundaries
   - Apply defense in depth

2. **Secure Defaults**
   ```typescript
   // Default to most restrictive
   const agentConfig = {
     allowExternalNetwork: false,  // Default: no external access
     allowFileWrite: false,        // Default: read-only
     maxExecutionTime: 60000,      // Default: 1 minute timeout
     ...userConfig,                // User can override
   };
   ```

3. **Rate Limiting**
   ```typescript
   @RateLimit({
     points: 100,      // 100 requests
     duration: 60,     // per 60 seconds
     blockDuration: 60 // block for 60 seconds if exceeded
   })
   @Post('execute')
   async executeAgent() { ... }
   ```

**Verification:**
- [ ] Threat model documented
- [ ] Secure defaults configured
- [ ] Rate limiting on all endpoints
- [ ] Input size limits enforced

---

### A05:2021 - Security Misconfiguration

**Risk:** Insecure default configurations, incomplete setup.

**Mitigations:**

1. **Security Headers**
   ```typescript
   import helmet from 'helmet';

   app.use(helmet({
     contentSecurityPolicy: {
       directives: {
         defaultSrc: ["'self'"],
         scriptSrc: ["'self'"],
         styleSrc: ["'self'", "'unsafe-inline'"],
         imgSrc: ["'self'", "data:", "https:"],
       },
     },
     hsts: {
       maxAge: 31536000,
       includeSubDomains: true,
       preload: true,
     },
   }));
   ```

2. **CORS Configuration**
   ```typescript
   app.enableCors({
     origin: env.ALLOWED_ORIGINS.split(','),
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
     allowedHeaders: ['Content-Type', 'Authorization'],
     credentials: true,
   });
   ```

3. **Error Handling**
   ```typescript
   // Never expose stack traces in production
   if (env.NODE_ENV === 'production') {
     app.useGlobalFilters(new ProductionExceptionFilter());
   }
   ```

**Verification:**
- [ ] Security headers configured
- [ ] CORS restrictive
- [ ] Debug mode disabled in production
- [ ] Default credentials changed

---

### A06:2021 - Vulnerable and Outdated Components

**Risk:** Using components with known vulnerabilities.

**Mitigations:**

1. **Dependency Scanning**
   ```bash
   # Run in CI/CD
   pnpm audit --audit-level=high

   # Deep scan with Snyk
   snyk test
   ```

2. **Automated Updates**
   ```yaml
   # Dependabot configuration
   version: 2
   updates:
     - package-ecosystem: "npm"
       directory: "/"
       schedule:
         interval: "weekly"
       open-pull-requests-limit: 10
   ```

3. **Version Pinning**
   ```json
   // package.json - pin exact versions for security-critical deps
   {
     "dependencies": {
       "bcrypt": "5.1.1",
       "@anthropic-ai/sdk": "0.24.0"
     }
   }
   ```

**Verification:**
- [ ] No high/critical vulnerabilities
- [ ] Dependencies updated regularly
- [ ] Lock file committed
- [ ] Deprecated packages replaced

---

### A07:2021 - Identification and Authentication Failures

**Risk:** Weak authentication mechanisms.

**Mitigations:**

1. **Strong Password Policy**
   ```typescript
   const passwordSchema = z.string()
     .min(12, 'Password must be at least 12 characters')
     .regex(/[A-Z]/, 'Must contain uppercase letter')
     .regex(/[a-z]/, 'Must contain lowercase letter')
     .regex(/[0-9]/, 'Must contain number')
     .regex(/[^A-Za-z0-9]/, 'Must contain special character');
   ```

2. **JWT Security**
   ```typescript
   const jwtConfig = {
     secret: env.JWT_SECRET,          // Min 256 bits
     expiresIn: '15m',                // Short-lived access tokens
     refreshExpiresIn: '7d',          // Longer refresh tokens
     algorithm: 'HS256',
   };

   // Rotate refresh tokens on use
   async function refreshToken(token: string) {
     const payload = verify(token);
     await invalidateToken(token);    // One-time use
     return generateNewTokens(payload.userId);
   }
   ```

3. **Brute Force Protection**
   ```typescript
   @RateLimit({
     points: 5,         // 5 attempts
     duration: 900,     // per 15 minutes
     blockDuration: 900 // block for 15 minutes
   })
   @Post('login')
   async login() { ... }
   ```

**Verification:**
- [ ] Strong password policy enforced
- [ ] JWT tokens short-lived
- [ ] Refresh token rotation
- [ ] Brute force protection
- [ ] Account lockout after failures

---

### A08:2021 - Software and Data Integrity Failures

**Risk:** Untrusted data affecting code execution.

**Mitigations:**

1. **Signed Artifacts**
   ```bash
   # Sign releases
   gpg --sign --armor release.tar.gz

   # Verify signatures
   gpg --verify release.tar.gz.asc
   ```

2. **Dependency Integrity**
   ```bash
   # Use lock file with integrity hashes
   pnpm install --frozen-lockfile
   ```

3. **CI/CD Pipeline Security**
   ```yaml
   # Pin action versions
   - uses: actions/checkout@v4.1.1
   - uses: actions/setup-node@v4.0.0
   ```

**Verification:**
- [ ] Lock file integrity verified
- [ ] CI/CD actions pinned
- [ ] Release artifacts signed
- [ ] No untrusted code execution

---

### A09:2021 - Security Logging and Monitoring Failures

**Risk:** Insufficient logging to detect attacks.

**Mitigations:**

1. **Security Event Logging**
   ```typescript
   // Log security-relevant events
   const securityEvents = [
     'auth.login.success',
     'auth.login.failure',
     'auth.logout',
     'auth.password.change',
     'auth.mfa.enabled',
     'access.denied',
     'data.export',
     'admin.action',
   ];

   async function logSecurityEvent(event: string, context: object) {
     await auditLog.create({
       event,
       timestamp: new Date(),
       userId: context.userId,
       ip: context.ip,
       userAgent: context.userAgent,
       details: context.details,
     });
   }
   ```

2. **No Sensitive Data in Logs**
   ```typescript
   // ❌ NEVER log sensitive data
   logger.info('User login', { password: user.password });

   // ✅ Sanitize before logging
   logger.info('User login', {
     userId: user.id,
     email: maskEmail(user.email),
   });
   ```

3. **Log Retention**
   ```typescript
   // Security logs retained for 1 year
   // Application logs retained for 30 days
   const logRetention = {
     security: 365,
     application: 30,
     debug: 7,
   };
   ```

**Verification:**
- [ ] Auth events logged
- [ ] Access denied logged
- [ ] Admin actions logged
- [ ] No PII in logs
- [ ] Log retention configured

---

### A10:2021 - Server-Side Request Forgery (SSRF)

**Risk:** Server making requests to unintended locations.

**Mitigations:**

1. **URL Validation**
   ```typescript
   const allowedHosts = [
     'api.anthropic.com',
     'api.openai.com',
   ];

   function validateUrl(url: string): boolean {
     const parsed = new URL(url);
     return allowedHosts.includes(parsed.hostname);
   }
   ```

2. **Block Internal IPs**
   ```typescript
   function isInternalIp(ip: string): boolean {
     const internal = [
       /^127\./,           // Loopback
       /^10\./,            // Private Class A
       /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
       /^192\.168\./,      // Private Class C
       /^169\.254\./,      // Link-local
       /^0\./,             // Current network
     ];
     return internal.some(pattern => pattern.test(ip));
   }
   ```

3. **Disable Redirects**
   ```typescript
   const response = await fetch(url, {
     redirect: 'error', // Don't follow redirects
     timeout: 5000,
   });
   ```

**Verification:**
- [ ] URL allowlist enforced
- [ ] Internal IPs blocked
- [ ] Redirects disabled
- [ ] Request timeouts set

---

## Security Testing

### Automated Testing

```bash
# SAST - Static Analysis
pnpm security:sast

# DAST - Dynamic Analysis (staging only)
pnpm security:dast

# Dependency Audit
pnpm audit

# Secret Detection
gitleaks detect

# Container Scanning
trivy image aigentflow:latest
```

### Manual Testing

- [ ] Penetration test (quarterly)
- [ ] Code review for security
- [ ] Configuration review
- [ ] Access control testing

---

## Incident Response

1. **Detection** - Monitor for anomalies
2. **Containment** - Isolate affected systems
3. **Eradication** - Remove threat
4. **Recovery** - Restore services
5. **Lessons** - Post-incident review

Contact: security@aigentflow.io
