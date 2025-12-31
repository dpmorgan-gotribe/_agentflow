# Privacy Requirements

GDPR and privacy compliance requirements for Aigentflow.

---

## Data Classification

### Classification Levels

| Level | Description | Examples | Requirements |
|-------|-------------|----------|--------------|
| **Public** | No sensitivity | Docs, marketing | None |
| **Internal** | Business data | Logs, metrics | Access control |
| **Confidential** | Business sensitive | Financials, contracts | Encryption, audit |
| **PII** | Personal data | Email, name, IP | GDPR compliance |
| **Sensitive PII** | Special category | Health, biometrics | Enhanced protection |

### PII Examples

| Data Type | Classification | Special Handling |
|-----------|---------------|------------------|
| Email address | PII | Consent required |
| Full name | PII | Consent required |
| IP address | PII | Log retention limits |
| User agent | PII | Anonymize after use |
| Phone number | PII | Encrypt at rest |
| Physical address | PII | Encrypt at rest |
| Date of birth | Sensitive PII | Strict access control |
| Government ID | Sensitive PII | Encrypt, audit access |
| Financial data | Sensitive PII | PCI-DSS compliance |
| Health data | Sensitive PII | HIPAA if applicable |

---

## GDPR Article Compliance

### Article 5: Principles

| Principle | Implementation |
|-----------|----------------|
| **Lawfulness** | Document legal basis for each data type |
| **Fairness** | Transparent privacy policy |
| **Transparency** | Clear data collection notices |
| **Purpose limitation** | Use data only for stated purposes |
| **Data minimization** | Collect only necessary data |
| **Accuracy** | Allow users to update data |
| **Storage limitation** | Enforce retention periods |
| **Integrity** | Encrypt and secure data |
| **Accountability** | Document compliance measures |

### Article 6: Lawful Basis

```typescript
// Document legal basis for each processing activity
enum LawfulBasis {
  CONSENT = 'consent',           // User explicitly agreed
  CONTRACT = 'contract',         // Necessary for service
  LEGAL = 'legal_obligation',    // Required by law
  VITAL = 'vital_interests',     // Protect life
  PUBLIC = 'public_task',        // Public interest
  LEGITIMATE = 'legitimate_interest', // Business need, balanced
}

// Example: Document processing activities
const processingActivities = [
  {
    activity: 'User authentication',
    dataTypes: ['email', 'password_hash'],
    lawfulBasis: LawfulBasis.CONTRACT,
    retention: '90 days after account deletion',
  },
  {
    activity: 'Marketing emails',
    dataTypes: ['email', 'name'],
    lawfulBasis: LawfulBasis.CONSENT,
    retention: 'Until consent withdrawn',
  },
];
```

### Article 7: Consent

```typescript
// Consent must be:
// - Freely given
// - Specific
// - Informed
// - Unambiguous

interface ConsentRecord {
  userId: string;
  purpose: string;           // What they're consenting to
  timestamp: Date;           // When consent was given
  method: string;            // How consent was obtained
  version: string;           // Version of consent text
  ipAddress: string;         // For audit purposes
  withdrawn?: Date;          // When consent was withdrawn
}

// Store consent records
const consentSchema = pgTable('consent_records', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  purpose: text('purpose').notNull(),
  consentedAt: timestamp('consented_at').notNull(),
  method: text('method').notNull(),
  version: text('version').notNull(),
  ipAddress: text('ip_address'),
  withdrawnAt: timestamp('withdrawn_at'),
});
```

### Article 15: Right of Access

```typescript
// Data Subject Access Request (DSAR)
@Get('my-data')
@UseGuards(JwtAuthGuard)
async getMyData(@CurrentUser() user: User) {
  const data = await this.dsarService.collectUserData(user.id);

  return {
    personalData: {
      profile: data.profile,
      preferences: data.preferences,
    },
    processingActivities: data.processingLog,
    thirdPartySharing: data.sharingRecords,
    consentRecords: data.consents,
    exportedAt: new Date().toISOString(),
  };
}
```

### Article 17: Right to Erasure

```typescript
// "Right to be forgotten"
@Delete('my-data')
@UseGuards(JwtAuthGuard)
async deleteMyData(@CurrentUser() user: User) {
  // Verify identity (may require additional auth)
  await this.authService.verifyDeleteRequest(user.id);

  // Delete or anonymize all user data
  await this.dsarService.deleteUserData(user.id);

  // Log deletion for compliance
  await this.auditLog.record({
    action: 'user.data.deleted',
    userId: user.id,
    timestamp: new Date(),
  });

  return { message: 'Data deletion initiated', completionDate: '30 days' };
}

// Data deletion service
class DsarService {
  async deleteUserData(userId: string) {
    // 1. Delete primary data
    await this.userRepository.delete(userId);

    // 2. Delete related data
    await this.agentRepository.deleteByOwner(userId);
    await this.taskRepository.deleteByOwner(userId);

    // 3. Anonymize data that must be retained
    await this.analyticsRepository.anonymize(userId);

    // 4. Remove from backups (within retention policy)
    await this.backupService.scheduleRemoval(userId);

    // 5. Notify third parties
    await this.thirdPartyService.requestDeletion(userId);
  }
}
```

### Article 25: Privacy by Design

```typescript
// Default privacy settings
const defaultPrivacySettings = {
  profileVisibility: 'private',       // Not public by default
  analyticsEnabled: false,            // Opt-in, not opt-out
  marketingEmails: false,             // Opt-in
  thirdPartySharing: false,           // Opt-in
  dataRetentionDays: 30,              // Minimum retention
};

// Privacy-first data collection
function collectMinimalData(input: unknown): UserProfile {
  const validated = userProfileSchema.parse(input);

  // Only return necessary fields
  return {
    id: validated.id,
    email: validated.email,
    // Don't collect unnecessary data like phone, address
    // unless explicitly needed for service
  };
}
```

### Article 32: Security Measures

```typescript
// Technical measures
const securityMeasures = {
  encryption: {
    atRest: 'AES-256',
    inTransit: 'TLS 1.3',
  },
  authentication: {
    passwords: 'bcrypt with cost 12',
    sessions: 'JWT with 15min expiry',
    mfa: 'TOTP supported',
  },
  accessControl: {
    database: 'PostgreSQL RLS',
    api: 'Role-based access control',
  },
  monitoring: {
    logging: 'Structured audit logs',
    alerting: 'Anomaly detection',
  },
};
```

### Article 33: Breach Notification

```typescript
// Breach response procedure
const breachProcedure = {
  detection: {
    timeline: 'Immediate upon discovery',
    actions: [
      'Assess scope and impact',
      'Identify affected data subjects',
      'Determine if personal data exposed',
    ],
  },
  notification: {
    authority: {
      timeline: '72 hours',
      recipient: 'Data Protection Authority',
      content: [
        'Nature of breach',
        'Categories of data',
        'Approximate number of subjects',
        'Likely consequences',
        'Measures taken',
      ],
    },
    subjects: {
      timeline: 'Without undue delay if high risk',
      content: [
        'Nature of breach',
        'Likely consequences',
        'Measures taken',
        'Contact for information',
      ],
    },
  },
};
```

---

## Data Retention

### Retention Periods

| Data Type | Retention Period | Basis |
|-----------|-----------------|-------|
| Account data | Account lifetime + 90 days | Contract |
| Transaction logs | 7 years | Legal (financial) |
| Security logs | 1 year | Legitimate interest |
| Application logs | 30 days | Legitimate interest |
| Analytics (aggregated) | Indefinite | Legitimate interest |
| Marketing consent | Until withdrawn | Consent |
| Support tickets | 2 years after resolution | Contract |

### Implementation

```typescript
// Automated data retention
@Cron('0 2 * * *') // Run daily at 2 AM
async enforceDataRetention() {
  const retentionPolicies = [
    { table: 'application_logs', days: 30 },
    { table: 'security_logs', days: 365 },
    { table: 'deleted_users', days: 90 },
  ];

  for (const policy of retentionPolicies) {
    const cutoff = subDays(new Date(), policy.days);
    await this.db.delete(policy.table)
      .where(lt(createdAt, cutoff));

    await this.auditLog.record({
      action: 'data.retention.enforced',
      table: policy.table,
      deletedBefore: cutoff,
    });
  }
}
```

---

## PII Handling in Code

### Schema Annotations

```typescript
// Mark PII fields in schema
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),

  // @pii - Personal Identifiable Information
  email: text('email').notNull(),       // PII
  name: text('name'),                    // PII

  // @pii-sensitive - Enhanced protection
  phoneNumber: text('phone_encrypted'), // Encrypted PII

  // Non-PII
  createdAt: timestamp('created_at'),
  role: text('role'),
});
```

### Logging Sanitization

```typescript
// Sanitize PII before logging
function sanitizeForLogging(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const piiFields = ['email', 'name', 'phone', 'ip', 'ssn', 'address'];
  const sanitized = { ...data };

  for (const field of piiFields) {
    if (field in sanitized) {
      sanitized[field] = maskPii(sanitized[field], field);
    }
  }

  return sanitized;
}

function maskPii(value: string, type: string): string {
  switch (type) {
    case 'email':
      const [local, domain] = value.split('@');
      return `${local[0]}***@${domain}`;
    case 'phone':
      return `***-***-${value.slice(-4)}`;
    case 'ip':
      return value.split('.').slice(0, 2).join('.') + '.xxx.xxx';
    default:
      return '***REDACTED***';
  }
}
```

### Data Export Format

```typescript
// GDPR-compliant data export
interface DataExport {
  exportedAt: string;
  dataSubject: {
    id: string;
    email: string;
  };
  categories: {
    profile: ProfileData;
    preferences: PreferencesData;
    activity: ActivityData[];
    consents: ConsentRecord[];
  };
  processingActivities: ProcessingActivity[];
  thirdParties: ThirdPartySharing[];
  retentionInfo: RetentionInfo;
}
```

---

## Third-Party Data Sharing

### Data Processing Agreements

All third-party processors must have DPA:

| Processor | Purpose | Data Shared | DPA Status |
|-----------|---------|-------------|------------|
| AWS | Infrastructure | All data | Signed |
| Anthropic | AI processing | Prompts, outputs | Signed |
| Stripe | Payments | Financial data | Signed |
| SendGrid | Email | Email addresses | Signed |

### Sharing Records

```typescript
// Track data sharing
const dataSharingSchema = pgTable('data_sharing_records', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id'),
  processor: text('processor').notNull(),
  purpose: text('purpose').notNull(),
  dataCategories: text('data_categories').array(),
  sharedAt: timestamp('shared_at').notNull(),
  legalBasis: text('legal_basis').notNull(),
});
```

---

## Privacy Contacts

- Data Protection Officer: dpo@aigentflow.io
- Privacy inquiries: privacy@aigentflow.io
- Data requests: dsar@aigentflow.io
