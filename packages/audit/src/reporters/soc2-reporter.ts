/**
 * SOC2 Compliance Reporter
 *
 * Generates SOC2-compliant audit reports based on the
 * Trust Services Criteria framework.
 */

import type { AuditEvent, AuditCategory } from '../types.js';
import { AuditStore } from '../audit-store.js';

/**
 * SOC2 Control Categories
 */
export type SOC2Category =
  | 'CC1'
  | 'CC2'
  | 'CC3'
  | 'CC4'
  | 'CC5'
  | 'CC6'
  | 'CC7'
  | 'CC8'
  | 'CC9';

/**
 * Control compliance status
 */
export type ComplianceStatus = 'compliant' | 'non-compliant' | 'partial';

/**
 * Individual control assessment
 */
export interface ControlAssessment {
  category: SOC2Category;
  controlId: string;
  description: string;
  evidenceCount: number;
  status: ComplianceStatus;
  findings: string[];
}

/**
 * SOC2 Report summary
 */
export interface SOC2Summary {
  totalControls: number;
  compliantControls: number;
  nonCompliantControls: number;
  partialControls: number;
  overallStatus: ComplianceStatus;
}

/**
 * Complete SOC2 Report
 */
export interface SOC2Report {
  reportDate: string;
  periodStart: string;
  periodEnd: string;
  controls: ControlAssessment[];
  summary: SOC2Summary;
}

/**
 * SOC2 Reporter implementation
 */
export class SOC2Reporter {
  private readonly store: AuditStore;

  constructor(store: AuditStore) {
    this.store = store;
  }

  /**
   * Generate SOC2 compliance report
   */
  async generateReport(startDate: Date, endDate: Date): Promise<SOC2Report> {
    const events = await this.store.query({ startDate, endDate });

    // Assess all 9 control categories
    const controls = [
      this.checkCC1(events),
      this.checkCC2(events),
      this.checkCC3(events),
      this.checkCC4(events),
      this.checkCC5(events),
      this.checkCC6(events),
      this.checkCC7(events),
      this.checkCC8(events),
      this.checkCC9(events),
    ];

    // Calculate summary
    const compliant = controls.filter((c) => c.status === 'compliant').length;
    const nonCompliant = controls.filter(
      (c) => c.status === 'non-compliant'
    ).length;
    const partial = controls.filter((c) => c.status === 'partial').length;

    let overallStatus: ComplianceStatus = 'compliant';
    if (nonCompliant > 0) {
      overallStatus = 'non-compliant';
    } else if (partial > 0) {
      overallStatus = 'partial';
    }

    return {
      reportDate: new Date().toISOString(),
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      controls,
      summary: {
        totalControls: controls.length,
        compliantControls: compliant,
        nonCompliantControls: nonCompliant,
        partialControls: partial,
        overallStatus,
      },
    };
  }

  /**
   * CC1: Control Environment
   *
   * The entity demonstrates a commitment to integrity and ethical values.
   */
  private checkCC1(events: AuditEvent[]): ControlAssessment {
    const complianceEvents = events.filter(
      (e) => e.category === 'compliance_event'
    );
    const securityEvents = events.filter(
      (e) => e.category === 'security_event'
    );

    const evidenceCount = complianceEvents.length + securityEvents.length;
    const findings: string[] = [];

    let status: ComplianceStatus = 'compliant';
    if (evidenceCount === 0) {
      status = 'partial';
      findings.push('No compliance or security events recorded');
    }

    return {
      category: 'CC1',
      controlId: 'CC1.1',
      description:
        'Security policies are established, communicated, and enforced',
      evidenceCount,
      status,
      findings,
    };
  }

  /**
   * CC2: Communication and Information
   *
   * The entity obtains or generates and uses relevant, quality information.
   */
  private checkCC2(events: AuditEvent[]): ControlAssessment {
    const systemEvents = events.filter((e) => e.category === 'system_event');
    const evidenceCount = systemEvents.length;
    const findings: string[] = [];

    let status: ComplianceStatus = 'compliant';
    if (evidenceCount === 0) {
      status = 'non-compliant';
      findings.push('No system events recorded - logging may not be active');
    }

    return {
      category: 'CC2',
      controlId: 'CC2.1',
      description: 'Information is communicated internally and externally',
      evidenceCount,
      status,
      findings,
    };
  }

  /**
   * CC3: Risk Assessment
   *
   * The entity identifies and assesses risks.
   */
  private checkCC3(events: AuditEvent[]): ControlAssessment {
    const securityEvents = events.filter(
      (e) => e.category === 'security_event'
    );
    const errorEvents = events.filter((e) => e.category === 'error_event');

    const evidenceCount = securityEvents.length + errorEvents.length;
    const findings: string[] = [];

    let status: ComplianceStatus = 'compliant';
    if (securityEvents.length === 0) {
      status = 'partial';
      findings.push('No security events - consider implementing security scans');
    }

    return {
      category: 'CC3',
      controlId: 'CC3.1',
      description: 'Security risks are identified and assessed',
      evidenceCount,
      status,
      findings,
    };
  }

  /**
   * CC4: Monitoring Activities
   *
   * The entity selects, develops, and performs ongoing evaluations.
   */
  private checkCC4(events: AuditEvent[]): ControlAssessment {
    const evidenceCount = events.length;
    const findings: string[] = [];

    let status: ComplianceStatus = 'compliant';
    if (evidenceCount < 10) {
      status = 'partial';
      findings.push('Limited monitoring evidence - ensure continuous logging');
    }

    return {
      category: 'CC4',
      controlId: 'CC4.1',
      description: 'Ongoing evaluations are performed',
      evidenceCount,
      status,
      findings,
    };
  }

  /**
   * CC5: Control Activities
   *
   * The entity deploys control activities through policies.
   */
  private checkCC5(events: AuditEvent[]): ControlAssessment {
    const authzEvents = events.filter((e) => e.category === 'authorization');
    const evidenceCount = authzEvents.length;
    const findings: string[] = [];

    let status: ComplianceStatus = 'compliant';
    if (evidenceCount === 0) {
      status = 'partial';
      findings.push(
        'No authorization events - ensure access controls are logged'
      );
    }

    return {
      category: 'CC5',
      controlId: 'CC5.1',
      description: 'Authorization controls are implemented',
      evidenceCount,
      status,
      findings,
    };
  }

  /**
   * CC6: Logical and Physical Access Controls
   *
   * The entity restricts logical and physical access.
   */
  private checkCC6(events: AuditEvent[]): ControlAssessment {
    const authEvents = events.filter((e) => e.category === 'authentication');
    const authzEvents = events.filter((e) => e.category === 'authorization');

    const evidenceCount = authEvents.length + authzEvents.length;
    const findings: string[] = [];

    // Check for failed login attempts
    const failedLogins = authEvents.filter((e) => e.outcome === 'failure');
    if (failedLogins.length > authEvents.length * 0.1) {
      findings.push(
        `High failed login rate: ${failedLogins.length}/${authEvents.length}`
      );
    }

    let status: ComplianceStatus = 'compliant';
    if (evidenceCount === 0) {
      status = 'partial';
      findings.push('No access control events logged');
    }

    return {
      category: 'CC6',
      controlId: 'CC6.1',
      description: 'Logical access controls are implemented',
      evidenceCount,
      status,
      findings,
    };
  }

  /**
   * CC7: System Operations
   *
   * The entity detects and responds to system operations issues.
   */
  private checkCC7(events: AuditEvent[]): ControlAssessment {
    const orchestrationEvents = events.filter(
      (e) => e.category === 'orchestration'
    );
    const agentEvents = events.filter((e) => e.category === 'agent_execution');
    const errorEvents = events.filter((e) => e.category === 'error_event');

    const totalOperations = orchestrationEvents.length + agentEvents.length;
    const errorRate =
      totalOperations > 0 ? errorEvents.length / totalOperations : 0;

    const evidenceCount = totalOperations;
    const findings: string[] = [];

    let status: ComplianceStatus = 'compliant';
    if (errorRate >= 0.1) {
      status = 'partial';
      findings.push(`Error rate exceeds 10%: ${(errorRate * 100).toFixed(1)}%`);
    }

    return {
      category: 'CC7',
      controlId: 'CC7.1',
      description: 'System operations are monitored and issues are detected',
      evidenceCount,
      status,
      findings,
    };
  }

  /**
   * CC8: Change Management
   *
   * The entity authorizes, designs, develops, and implements changes.
   */
  private checkCC8(events: AuditEvent[]): ControlAssessment {
    const fileEvents = events.filter((e) => e.category === 'file_operation');
    const gitEvents = events.filter((e) => e.category === 'git_operation');

    const evidenceCount = fileEvents.length + gitEvents.length;
    const findings: string[] = [];

    // Check for file operations without git commits
    if (fileEvents.length > 0 && gitEvents.length === 0) {
      findings.push(
        'File changes detected without git commits - ensure version control'
      );
    }

    let status: ComplianceStatus = 'compliant';
    if (evidenceCount === 0) {
      status = 'partial';
      findings.push('No change management events recorded');
    }

    return {
      category: 'CC8',
      controlId: 'CC8.1',
      description: 'Changes are tracked, authorized, and documented',
      evidenceCount,
      status,
      findings,
    };
  }

  /**
   * CC9: Risk Mitigation
   *
   * The entity identifies, selects, and develops risk mitigation activities.
   */
  private checkCC9(events: AuditEvent[]): ControlAssessment {
    const securityEvents = events.filter(
      (e) => e.category === 'security_event'
    );
    const complianceEvents = events.filter(
      (e) => e.category === 'compliance_event'
    );

    // Check for security events that were mitigated (successful outcome)
    const mitigatedEvents = securityEvents.filter(
      (e) => e.outcome === 'success'
    );

    const evidenceCount = mitigatedEvents.length + complianceEvents.length;
    const findings: string[] = [];

    let status: ComplianceStatus = 'compliant';
    if (evidenceCount === 0) {
      status = 'partial';
      findings.push('No risk mitigation activities recorded');
    }

    return {
      category: 'CC9',
      controlId: 'CC9.1',
      description: 'Risks are identified and mitigated',
      evidenceCount,
      status,
      findings,
    };
  }

  /**
   * Get category breakdown for specific control
   */
  async getCategoryBreakdown(
    startDate: Date,
    endDate: Date,
    categories: AuditCategory[]
  ): Promise<Record<AuditCategory, number>> {
    const events = await this.store.query({ startDate, endDate, categories });

    const breakdown: Partial<Record<AuditCategory, number>> = {};
    for (const event of events) {
      const cat = event.category as AuditCategory;
      breakdown[cat] = (breakdown[cat] ?? 0) + 1;
    }

    return breakdown as Record<AuditCategory, number>;
  }
}
