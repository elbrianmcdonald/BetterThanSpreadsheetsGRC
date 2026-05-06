import { PrismaClient, QuestionType, QuestionnaireUsageType, RiskQuestionStatus } from '@prisma/client';

// ----------------------------------------------------------------------------
// Inline 3×3 default risk matrix payload. This duplicates a slice of
// `src/lib/matrix/defaults.ts` because the prisma seed script runs against the
// standalone runner image, which tree-shakes out source files not referenced
// by the running Next.js server. Keep in sync with the canonical defaults if
// they ever change.
// ----------------------------------------------------------------------------
const DEFAULT_3x3_SCALES = {
  likelihood: [
    { value: 1, label: 'Rare', description: 'May occur only in exceptional circumstances' },
    { value: 2, label: 'Possible', description: 'Might occur at some time' },
    { value: 3, label: 'Likely', description: 'Will probably occur in most circumstances' },
  ],
  impact: [
    { value: 1, label: 'Minor', description: 'Some impact, minor disruption' },
    { value: 2, label: 'Moderate', description: 'Noticeable impact, requires management attention' },
    { value: 3, label: 'Major', description: 'Significant impact, threatens objectives' },
  ],
};
const DEFAULT_3x3_THRESHOLDS = [
  { label: 'Low', minValue: 0, maxValue: 3, color: '#22C55E', slaDays: 90 },
  { label: 'Medium', minValue: 3, maxValue: 6, color: '#EAB308', slaDays: 30 },
  { label: 'High', minValue: 6, maxValue: 9, color: '#EF4444', slaDays: 7 },
];

// ============================================================================
// Demo Data Seed Module
// Populates realistic demo data for all features so dashboards aren't empty.
// All data is for Org A (Acme Corporation) only.
// ============================================================================

// Existing entity IDs (created by seed.ts, referenced here)
const ORG_A = '550e8400-e29b-41d4-a716-446655440001';
const ALICE = '550e8400-e29b-41d4-a716-446655440011'; // ORG_ADMIN
const BOB   = '550e8400-e29b-41d4-a716-446655440012'; // GRC_ANALYST
const RISK_A1 = '550e8400-e29b-41d4-a716-446655440051';
const RISK_A2 = '550e8400-e29b-41d4-a716-446655440052';
const FRAMEWORK_ISO27001 = '550e8400-e29b-41d4-a716-446655440074';
const FRAMEWORK_NIST80053 = '550e8400-e29b-41d4-a716-446655440072';

export async function seedDemoData(prisma: PrismaClient) {
  console.log('Creating demo data for all features...\n');

  // ========================================================================
  // Layer 1: Business Units
  // ========================================================================
  console.log('  Creating business units...');
  const buData = [
    { name: 'Engineering',          code: 'ENG' },
    { name: 'Finance & Accounting', code: 'FIN' },
    { name: 'Human Resources',      code: 'HR'  },
    { name: 'IT Operations',        code: 'ITO' },
    { name: 'Sales & Marketing',    code: 'SAL' },
  ];

  const businessUnits: Record<string, string> = {};
  for (const bu of buData) {
    const record = await prisma.businessUnit.upsert({
      where: { organizationId_name: { organizationId: ORG_A, name: bu.name } },
      update: { code: bu.code },
      create: { organizationId: ORG_A, name: bu.name, code: bu.code },
    });
    businessUnits[bu.code] = record.id;
  }
  console.log(`  ✅ ${buData.length} business units\n`);

  // ========================================================================
  // Layer 2: People
  // ========================================================================
  console.log('  Creating people...');
  const peopleData = [
    { name: 'Sarah Chen',    email: 'sarah.chen@acme-corp.com',    jobTitle: 'CISO',                buCode: 'ITO' },
    { name: 'Mike Torres',   email: 'mike.torres@acme-corp.com',   jobTitle: 'VP Engineering',      buCode: 'ENG' },
    { name: 'Lisa Park',     email: 'lisa.park@acme-corp.com',     jobTitle: 'Compliance Manager',  buCode: 'FIN' },
    { name: 'James Wilson',  email: 'james.wilson@acme-corp.com',  jobTitle: 'IT Director',         buCode: 'ITO' },
    { name: 'Rachel Green',  email: 'rachel.green@acme-corp.com',  jobTitle: 'HR Director',         buCode: 'HR'  },
    { name: 'Tom Bradley',   email: 'tom.bradley@acme-corp.com',   jobTitle: 'Security Architect',  buCode: 'ENG' },
  ];

  const people: Record<string, string> = {};
  for (const p of peopleData) {
    const record = await prisma.person.upsert({
      where: { organizationId_email: { organizationId: ORG_A, email: p.email } },
      update: { name: p.name, jobTitle: p.jobTitle, businessUnitId: businessUnits[p.buCode] },
      create: {
        organizationId: ORG_A,
        name: p.name,
        email: p.email,
        jobTitle: p.jobTitle,
        businessUnitId: businessUnits[p.buCode],
      },
    });
    people[p.name] = record.id;
  }
  console.log(`  ✅ ${peopleData.length} people\n`);

  // ========================================================================
  // Layer 3A: Strategy + Goals + Objectives
  // ========================================================================
  console.log('  Creating strategy, goals, and objectives...');
  const strategy = await prisma.strategy.upsert({
    where: { id: 'demo-strategy-fy2026' },
    update: {},
    create: {
      id: 'demo-strategy-fy2026',
      organizationId: ORG_A,
      title: 'FY2026 Cybersecurity Strategy',
      description: 'Comprehensive cybersecurity strategy focused on achieving compliance certifications, reducing risk exposure, and implementing zero trust architecture.',
      fiscalYearStart: 2026,
      fiscalYearEnd: 2026,
      status: 'ACTIVE',
      ownerId: ALICE,
      createdById: ALICE,
    },
  });

  const goalsData = [
    { id: 'demo-goal-soc2',      title: 'Achieve SOC 2 Type II Certification',     targetDate: new Date('2026-09-30'), sortOrder: 0 },
    { id: 'demo-goal-risk',      title: 'Reduce Critical Risk Exposure by 50%',    targetDate: new Date('2026-12-31'), sortOrder: 1 },
    { id: 'demo-goal-zerotrust', title: 'Implement Zero Trust Architecture',        targetDate: new Date('2026-12-31'), sortOrder: 2 },
  ];

  for (const g of goalsData) {
    await prisma.goal.upsert({
      where: { id: g.id },
      update: {},
      create: {
        id: g.id,
        strategyId: strategy.id,
        title: g.title,
        targetDate: g.targetDate,
        sortOrder: g.sortOrder,
        ownerId: ALICE,
        createdById: ALICE,
      },
    });
  }

  const objectivesData = [
    { id: 'demo-obj-gap',     goalId: 'demo-goal-soc2',      title: 'Complete gap assessment against SOC 2 criteria',          status: 'COMPLETED' as const,   kpiType: 'MANUAL_PERCENTAGE' as const, targetValue: 100, currentValue: 100 },
    { id: 'demo-obj-gaps-rem', goalId: 'demo-goal-soc2',     title: 'Remediate all critical gaps identified in assessment',    status: 'IN_PROGRESS' as const, kpiType: 'MANUAL_PERCENTAGE' as const, targetValue: 100, currentValue: 60  },
    { id: 'demo-obj-vuln',    goalId: 'demo-goal-risk',      title: 'Deploy enterprise vulnerability management platform',     status: 'IN_PROGRESS' as const, kpiType: 'MANUAL_PERCENTAGE' as const, targetValue: 100, currentValue: 45  },
    { id: 'demo-obj-sla',     goalId: 'demo-goal-risk',      title: 'Establish risk treatment SLAs for all severity levels',   status: 'NOT_STARTED' as const, kpiType: 'MANUAL_BOOLEAN' as const,    targetValue: 1,   currentValue: 0   },
    { id: 'demo-obj-proxy',   goalId: 'demo-goal-zerotrust', title: 'Deploy identity-aware proxy for all internal services',   status: 'AT_RISK' as const,     kpiType: 'MANUAL_PERCENTAGE' as const, targetValue: 100, currentValue: 30  },
    { id: 'demo-obj-sso',     goalId: 'demo-goal-zerotrust', title: 'Migrate all applications to enterprise SSO',              status: 'IN_PROGRESS' as const, kpiType: 'MANUAL_PERCENTAGE' as const, targetValue: 100, currentValue: 70  },
  ];

  for (const o of objectivesData) {
    await prisma.objective.upsert({
      where: { id: o.id },
      update: {},
      create: {
        id: o.id,
        goalId: o.goalId,
        title: o.title,
        status: o.status,
        kpiType: o.kpiType,
        targetValue: o.targetValue,
        currentValue: o.currentValue,
        createdById: BOB,
      },
    });
  }
  console.log(`  ✅ 1 strategy, ${goalsData.length} goals, ${objectivesData.length} objectives\n`);

  // ========================================================================
  // Layer 3B: Findings + Comments
  // ========================================================================
  console.log('  Creating findings...');
  const findingsData = [
    { id: 'demo-find-001', identifier: 'FND-2026-0001', title: 'Outdated TLS 1.0 Configuration on Edge Servers',           source: 'SCANNER' as const, severity: 'HIGH' as const,   status: 'TRIAGED' as const,   description: 'Automated vulnerability scan detected TLS 1.0 still enabled on 3 edge servers. TLS 1.0 has known vulnerabilities (BEAST, POODLE) and should be disabled in favor of TLS 1.2+.' },
    { id: 'demo-find-002', identifier: 'FND-2026-0002', title: 'Missing WAF on Public-Facing API Gateway',                  source: 'PENTEST' as const, severity: 'HIGH' as const,   status: 'ACCEPTED' as const,  description: 'External penetration test found no Web Application Firewall protecting the public API gateway. This leaves the API vulnerable to common web attacks including SQL injection and XSS.' },
    { id: 'demo-find-003', identifier: 'FND-2026-0003', title: 'Excessive S3 Bucket Permissions in Production',             source: 'AUDIT' as const,   severity: 'MEDIUM' as const, status: 'TRIAGED' as const,   description: 'Internal audit revealed 12 S3 buckets with overly permissive IAM policies granting broad read/write access beyond what is needed for operational use.' },
    { id: 'demo-find-004', identifier: 'FND-2026-0004', title: 'Unencrypted Database Backups in Secondary Region',          source: 'SCANNER' as const, severity: 'HIGH' as const,   status: 'NEW' as const,       description: 'Configuration scan detected that database backups replicated to the DR region are not encrypted at rest, potentially exposing sensitive customer data.' },
    { id: 'demo-find-005', identifier: 'FND-2026-0005', title: 'Stale Service Accounts with Elevated Privileges',           source: 'AUDIT' as const,   severity: 'MEDIUM' as const, status: 'NEEDS_INFO' as const, description: '8 service accounts identified that have not been used in 90+ days but retain administrative privileges. Ownership and purpose need to be verified.' },
    { id: 'demo-find-006', identifier: 'FND-2026-0006', title: 'Missing DMARC Policy on Corporate Email Domain',            source: 'MANUAL' as const,  severity: 'LOW' as const,    status: 'ACCEPTED' as const,  description: 'Corporate email domain acme-corp.com lacks a DMARC policy, making it susceptible to email spoofing and phishing attacks impersonating the organization.' },
  ];

  for (const f of findingsData) {
    await prisma.finding.upsert({
      where: { organizationId_identifier: { organizationId: ORG_A, identifier: f.identifier } },
      update: {},
      create: {
        id: f.id,
        organizationId: ORG_A,
        identifier: f.identifier,
        title: f.title,
        description: f.description,
        source: f.source,
        severity: f.severity,
        status: f.status,
        createdBy: BOB,
        assigneeId: BOB,
        ...(f.status === 'TRIAGED' || f.status === 'ACCEPTED' || f.status === 'NEEDS_INFO'
          ? { triagedBy: BOB, triagedAt: new Date('2026-01-20') }
          : {}),
        ...(f.status === 'ACCEPTED'
          ? { acceptedBy: ALICE, acceptedAt: new Date('2026-01-25') }
          : {}),
      },
    });
  }

  // Finding comments
  const findingCommentsData = [
    { findingId: 'demo-find-001', content: 'Confirmed TLS 1.0 is still active on edge-proxy-1, edge-proxy-2, and edge-proxy-3. Coordinating with infrastructure team for remediation window.' },
    { findingId: 'demo-find-002', content: 'WAF deployment approved by change advisory board. CloudGuard WAF solution selected, implementation scheduled for sprint 4.' },
    { findingId: 'demo-find-003', content: 'Working with DevOps to apply least-privilege IAM policies. 5 of 12 buckets already remediated.' },
    { findingId: 'demo-find-005', content: 'Sent inquiry to department heads to verify ownership of these service accounts. Awaiting responses from Engineering and IT Ops.' },
  ];

  for (const c of findingCommentsData) {
    const existing = await prisma.findingComment.findFirst({
      where: { findingId: c.findingId, content: c.content },
    });
    if (!existing) {
      await prisma.findingComment.create({
        data: {
          organizationId: ORG_A,
          findingId: c.findingId,
          userId: BOB,
          content: c.content,
        },
      });
    }
  }
  console.log(`  ✅ ${findingsData.length} findings, ${findingCommentsData.length} comments\n`);

  // ========================================================================
  // Layer 4: Risk Assessments + Scenarios + Treatments + Comments
  // ========================================================================
  console.log('  Creating risk assessments...');

  const assessmentsData = [
    {
      id: 'demo-ra-001',
      identifier: 'RSK-2026-0001',
      title: 'TLS Configuration Risk Assessment',
      findingId: 'demo-find-001',
      inherentScore: 0.72,
      treatment: 'MITIGATE' as const,
    },
    {
      id: 'demo-ra-002',
      identifier: 'RSK-2026-0002',
      title: 'Public API Exposure Risk Assessment',
      findingId: 'demo-find-002',
      inherentScore: 0.85,
      treatment: 'MITIGATE' as const,
    },
  ];

  for (const ra of assessmentsData) {
    await prisma.riskAssessment.upsert({
      where: { organizationId_identifier: { organizationId: ORG_A, identifier: ra.identifier } },
      update: {},
      create: {
        id: ra.id,
        organizationId: ORG_A,
        identifier: ra.identifier,
        title: ra.title,
        findingId: ra.findingId,
        status: 'APPROVED',
        treatment: ra.treatment,
        inherentScore: ra.inherentScore,
        inherentScoreLabel: ra.inherentScore >= 0.8 ? 'High' : 'Medium',
        createdBy: BOB,
        ownerId: ALICE,
        approvedBy: ALICE,
        approvedAt: new Date('2026-02-01'),
        riskOwnerId: people['Sarah Chen'],
        businessUnitId: businessUnits['ITO'],
      },
    });
  }

  // Risk Scenarios
  const scenariosData = [
    { assessmentId: 'demo-ra-001', description: 'Attacker exploits TLS 1.0 vulnerability to perform man-in-the-middle attack on edge traffic, intercepting authentication tokens.', order: 0 },
    { assessmentId: 'demo-ra-001', description: 'Compliance audit failure due to PCI-DSS requirement 4.1 mandating TLS 1.2 minimum, resulting in remediation timeline and potential fines.', order: 1 },
    { assessmentId: 'demo-ra-002', description: 'Attacker bypasses missing WAF to exploit OWASP Top 10 vulnerabilities in API, gaining unauthorized access to customer data.', order: 0 },
  ];

  for (const s of scenariosData) {
    const existing = await prisma.riskScenario.findFirst({
      where: { assessmentId: s.assessmentId, description: s.description },
    });
    if (!existing) {
      await prisma.riskScenario.create({
        data: {
          organizationId: ORG_A,
          assessmentId: s.assessmentId,
          description: s.description,
          order: s.order,
        },
      });
    }
  }

  // Risk Treatments on existing risks
  const treatmentsData = [
    {
      riskId: RISK_A1,
      treatmentType: 'REMEDIATE' as const,
      justification: 'Critical SQL Server patches must be applied to prevent exploitation of known CVEs. Compensating controls insufficient for long-term mitigation.',
      actionStatus: 'IN_PROGRESS' as const,
      detail: 'Apply all critical security patches to production SQL Server 2019 instance during next maintenance window.',
      targetCompletionDate: new Date('2026-03-15'),
    },
    {
      riskId: RISK_A2,
      treatmentType: 'ACCEPT' as const,
      justification: 'MFA rollout is planned for Q2 2026 as part of Zero Trust initiative. Risk is accepted in the interim with compensating controls (IP allowlisting, session timeout reduction).',
      actionStatus: 'NOT_STARTED' as const,
      detail: null,
      targetCompletionDate: null,
    },
  ];

  for (const t of treatmentsData) {
    const existing = await prisma.riskTreatment.findFirst({
      where: { riskId: t.riskId, organizationId: ORG_A },
    });
    if (!existing) {
      await prisma.riskTreatment.create({
        data: {
          organizationId: ORG_A,
          riskId: t.riskId,
          treatmentType: t.treatmentType,
          justification: t.justification,
          actionStatus: t.actionStatus,
          detail: t.detail,
          targetCompletionDate: t.targetCompletionDate,
          assignedToId: people['James Wilson'],
          decidedById: ALICE,
        },
      });
    }
  }

  // Risk Comments
  const riskCommentsData = [
    { riskId: RISK_A1, comment: 'Patch test completed successfully in staging environment. Scheduling production deployment for next maintenance window.', commentType: 'REMEDIATION_UPDATE' as const },
    { riskId: RISK_A1, comment: 'What is the expected downtime during patching? Need to coordinate with application teams.', commentType: 'QUESTION' as const },
    { riskId: RISK_A2, comment: 'Accepting this risk until MFA rollout completes in Q2. Compensating controls in place: IP allowlist for admin access, 15-minute session timeout.', commentType: 'DECISION_RATIONALE' as const },
  ];

  for (const c of riskCommentsData) {
    const existing = await prisma.riskComment.findFirst({
      where: { riskId: c.riskId, comment: c.comment },
    });
    if (!existing) {
      await prisma.riskComment.create({
        data: {
          organizationId: ORG_A,
          riskId: c.riskId,
          comment: c.comment,
          commentType: c.commentType,
          authorId: BOB,
        },
      });
    }
  }

  // Risk Status History
  const statusHistoryData = [
    { riskId: RISK_A1, oldStatus: 'OPEN' as const, newStatus: 'ASSIGNED' as const, reason: 'Assigned to IT Operations for patch remediation' },
    { riskId: RISK_A2, oldStatus: 'OPEN' as const, newStatus: 'ASSIGNED' as const, reason: 'Assigned to IT Operations pending MFA rollout' },
  ];

  for (const h of statusHistoryData) {
    const existing = await prisma.riskStatusHistory.findFirst({
      where: { riskId: h.riskId, newStatus: h.newStatus },
    });
    if (!existing) {
      await prisma.riskStatusHistory.create({
        data: {
          organizationId: ORG_A,
          riskId: h.riskId,
          oldStatus: h.oldStatus,
          newStatus: h.newStatus,
          reason: h.reason,
          changedById: ALICE,
        },
      });
    }
  }
  console.log(`  ✅ ${assessmentsData.length} risk assessments, ${scenariosData.length} scenarios, ${treatmentsData.length} treatments\n`);

  // ========================================================================
  // Layer 5A: Compliance Assessments + Scores
  // ========================================================================
  console.log('  Creating compliance assessments...');

  const compAssessmentsData = [
    {
      id: 'demo-ca-001',
      identifier: 'COMP-2026-0001',
      name: 'ISO 27001 Annual Assessment',
      frameworkId: FRAMEWORK_ISO27001,
      status: 'IN_PROGRESS' as const,
      businessUnitId: businessUnits['ENG'],
    },
    {
      id: 'demo-ca-002',
      identifier: 'COMP-2026-0002',
      name: 'NIST 800-53 Moderate Baseline Assessment',
      frameworkId: FRAMEWORK_NIST80053,
      status: 'DRAFT' as const,
      businessUnitId: businessUnits['ITO'],
      baseline: 'MODERATE',
    },
  ];

  for (const ca of compAssessmentsData) {
    await prisma.complianceAssessment.upsert({
      where: { organizationId_identifier: { organizationId: ORG_A, identifier: ca.identifier } },
      update: {},
      create: {
        id: ca.id,
        organizationId: ORG_A,
        frameworkId: ca.frameworkId,
        businessUnitId: ca.businessUnitId,
        identifier: ca.identifier,
        name: ca.name,
        status: ca.status,
        ownerId: ALICE,
        assessorId: BOB,
        baseline: 'baseline' in ca ? ca.baseline : null,
      },
    });
  }

  // Control Assessment Scores for CA-1 (ISO 27001)
  const isoControls = await prisma.control.findMany({
    where: { frameworkId: FRAMEWORK_ISO27001, organizationId: ORG_A },
    select: { id: true },
  });

  // Check if scores already exist
  const existingScoreCount = await prisma.controlAssessmentScore.count({
    where: { assessmentId: 'demo-ca-001' },
  });

  let scoreStats = { compliant: 0, partial: 0, nonCompliant: 0, notAssessed: 0 };
  if (existingScoreCount === 0 && isoControls.length > 0) {
    const statuses: Array<'COMPLIANT' | 'PARTIALLY_COMPLIANT' | 'NON_COMPLIANT' | 'NOT_ASSESSED'> = [];
    // ~60% COMPLIANT, ~15% PARTIALLY, ~10% NON_COMPLIANT, ~15% NOT_ASSESSED
    for (let i = 0; i < isoControls.length; i++) {
      const r = i / isoControls.length;
      if (r < 0.60) statuses.push('COMPLIANT');
      else if (r < 0.75) statuses.push('PARTIALLY_COMPLIANT');
      else if (r < 0.85) statuses.push('NON_COMPLIANT');
      else statuses.push('NOT_ASSESSED');
    }
    // Shuffle deterministically
    for (let i = statuses.length - 1; i > 0; i--) {
      const j = (i * 7 + 3) % (i + 1);
      [statuses[i], statuses[j]] = [statuses[j]!, statuses[i]!];
    }

    for (let i = 0; i < isoControls.length; i++) {
      const st = statuses[i]!;
      if (st === 'COMPLIANT') scoreStats.compliant++;
      else if (st === 'PARTIALLY_COMPLIANT') scoreStats.partial++;
      else if (st === 'NON_COMPLIANT') scoreStats.nonCompliant++;
      else scoreStats.notAssessed++;

      await prisma.controlAssessmentScore.create({
        data: {
          assessmentId: 'demo-ca-001',
          controlId: isoControls[i]!.id,
          status: st,
          assessedById: BOB,
          assessedAt: new Date('2026-02-10'),
        },
      });
    }

    // Update aggregate counts on the assessment
    const complianceScore = isoControls.length > 0
      ? ((scoreStats.compliant + scoreStats.partial * 0.5) / (isoControls.length - scoreStats.notAssessed)) * 100
      : 0;

    await prisma.complianceAssessment.update({
      where: { id: 'demo-ca-001' },
      data: {
        totalControls: isoControls.length,
        compliantCount: scoreStats.compliant,
        nonCompliantCount: scoreStats.nonCompliant,
        partialCount: scoreStats.partial,
        notAssessedCount: scoreStats.notAssessed,
        complianceScore: Math.round(complianceScore * 100) / 100,
      },
    });
  }

  // Control Assessment Scores for CA-2 (NIST 800-53 Moderate baseline) — all NOT_ASSESSED
  const nistModerateControls = await prisma.control.findMany({
    where: {
      frameworkId: FRAMEWORK_NIST80053,
      organizationId: ORG_A,
      baselines: { contains: 'MODERATE' },
    },
    select: { id: true },
  });

  const existingNistScoreCount = await prisma.controlAssessmentScore.count({
    where: { assessmentId: 'demo-ca-002' },
  });

  if (existingNistScoreCount === 0 && nistModerateControls.length > 0) {
    await prisma.controlAssessmentScore.createMany({
      data: nistModerateControls.map((c) => ({
        assessmentId: 'demo-ca-002',
        controlId: c.id,
        status: 'NOT_ASSESSED' as const,
      })),
    });

    await prisma.complianceAssessment.update({
      where: { id: 'demo-ca-002' },
      data: {
        totalControls: nistModerateControls.length,
        compliantCount: 0,
        nonCompliantCount: 0,
        partialCount: 0,
        notAssessedCount: nistModerateControls.length,
        complianceScore: 0,
      },
    });
  }
  console.log(`  ✅ ${compAssessmentsData.length} compliance assessments, ${isoControls.length + nistModerateControls.length} control scores\n`);

  // ========================================================================
  // Layer 5B: Standards + Controls
  // ========================================================================
  console.log('  Creating standards...');

  const standard = await prisma.standard.upsert({
    where: { organizationId_title: { organizationId: ORG_A, title: 'Acme Information Security Policy' } },
    update: {},
    create: {
      id: 'demo-standard-isp',
      organizationId: ORG_A,
      title: 'Acme Information Security Policy',
      description: 'Comprehensive information security policy establishing baseline security requirements for all Acme Corporation systems, personnel, and processes.',
      status: 'ACTIVE',
      version: 1,
      effectiveDate: new Date('2025-07-01'),
      reviewCycleMonths: 12,
      ownerId: ALICE,
      createdById: ALICE,
    },
  });

  const stdControlsData = [
    { code: 'ISP-001', title: 'Password Policy',                 criticality: 'HIGH' as const,   description: 'All user accounts must use passwords meeting minimum complexity requirements: 12+ characters, mixed case, numbers, and symbols.' },
    { code: 'ISP-002', title: 'Multi-Factor Authentication',     criticality: 'HIGH' as const,   description: 'MFA is required for all remote access, privileged accounts, and access to systems processing sensitive data.' },
    { code: 'ISP-003', title: 'Data Classification',             criticality: 'HIGH' as const,   description: 'All organizational data must be classified as Public, Internal, Confidential, or Restricted, with handling procedures for each level.' },
    { code: 'ISP-004', title: 'Encryption Standards',            criticality: 'HIGH' as const,   description: 'Data at rest must be encrypted with AES-256. Data in transit must use TLS 1.2 or higher. Key management must follow NIST guidelines.' },
    { code: 'ISP-005', title: 'Acceptable Use Policy',           criticality: 'MEDIUM' as const, description: 'Personnel must use organizational resources responsibly. Personal use is permitted within reason. Prohibited activities include unauthorized software installation.' },
    { code: 'ISP-006', title: 'Incident Response Procedures',    criticality: 'HIGH' as const,   description: 'All security incidents must be reported within 1 hour. IR team must be activated within 4 hours for severity 1 incidents.' },
    { code: 'ISP-007', title: 'Access Review Requirements',      criticality: 'MEDIUM' as const, description: 'User access rights must be reviewed quarterly. Privileged access must be reviewed monthly. Unused accounts must be disabled after 90 days.' },
    { code: 'ISP-008', title: 'Vendor Security Requirements',    criticality: 'MEDIUM' as const, description: 'All vendors processing organizational data must meet minimum security requirements including SOC 2 Type II or equivalent certification.' },
    { code: 'ISP-009', title: 'Change Management',               criticality: 'MEDIUM' as const, description: 'All changes to production systems must follow the change management process including peer review, testing, and approval.' },
    { code: 'ISP-010', title: 'Security Awareness Training',     criticality: 'LOW' as const,    description: 'All personnel must complete security awareness training within 30 days of hire and annually thereafter. Phishing simulations conducted quarterly.' },
  ];

  for (let i = 0; i < stdControlsData.length; i++) {
    const sc = stdControlsData[i]!;
    await prisma.standardControl.upsert({
      where: { standardId_code: { standardId: standard.id, code: sc.code } },
      update: {},
      create: {
        standardId: standard.id,
        code: sc.code,
        title: sc.title,
        description: sc.description,
        criticality: sc.criticality,
        sortOrder: i,
      },
    });
  }
  console.log(`  ✅ 1 standard, ${stdControlsData.length} controls\n`);

  // ========================================================================
  // Layer 6: Vendors + Assessments
  // ========================================================================
  console.log('  Creating vendors...');

  const vendorsData = [
    { id: 'demo-vnd-001', identifier: 'VND-2026-0001', name: 'CloudGuard Security',  category: 'Cloud Security',      riskTier: 'CRITICAL' as const, status: 'ACTIVE' as const },
    { id: 'demo-vnd-002', identifier: 'VND-2026-0002', name: 'DataVault Pro',         category: 'Backup & Recovery',   riskTier: 'HIGH' as const,     status: 'ACTIVE' as const },
    { id: 'demo-vnd-003', identifier: 'VND-2026-0003', name: 'OfficeStream',          category: 'Productivity Suite',  riskTier: 'LOW' as const,      status: 'ACTIVE' as const },
    { id: 'demo-vnd-004', identifier: 'VND-2026-0004', name: 'LegacyServ Inc',        category: 'Legacy Hosting',      riskTier: 'MEDIUM' as const,   status: 'UNDER_REVIEW' as const },
  ];

  for (const v of vendorsData) {
    await prisma.vendor.upsert({
      where: { organizationId_identifier: { organizationId: ORG_A, identifier: v.identifier } },
      update: {},
      create: {
        id: v.id,
        organizationId: ORG_A,
        identifier: v.identifier,
        name: v.name,
        category: v.category,
        riskTier: v.riskTier,
        status: v.status,
        businessUnitId: businessUnits['ITO'],
        itOwnerId: people['James Wilson'],
        businessOwnerId: people['Sarah Chen'],
        createdById: BOB,
      },
    });
  }

  const vendorAssessmentsData = [
    {
      id: 'demo-vas-001',
      identifier: 'VA-2026-0001',
      vendorId: 'demo-vnd-001',
      title: 'CloudGuard Annual Security Review',
      status: 'COMPLETED' as const,
      riskScore: 87,
      recommendation: 'APPROVE' as const,
      summary: 'CloudGuard maintains strong security posture. SOC 2 Type II report reviewed with no exceptions. Encryption, access controls, and monitoring meet requirements.',
    },
    {
      id: 'demo-vas-002',
      identifier: 'VA-2026-0002',
      vendorId: 'demo-vnd-004',
      title: 'LegacyServ Risk Assessment',
      status: 'IN_PROGRESS' as const,
      riskScore: null,
      recommendation: null,
      summary: null,
    },
  ];

  for (const va of vendorAssessmentsData) {
    await prisma.vendorAssessment.upsert({
      where: { organizationId_identifier: { organizationId: ORG_A, identifier: va.identifier } },
      update: {},
      create: {
        id: va.id,
        organizationId: ORG_A,
        identifier: va.identifier,
        vendorId: va.vendorId,
        title: va.title,
        status: va.status,
        riskScore: va.riskScore,
        recommendation: va.recommendation,
        summary: va.summary,
        assessorId: BOB,
        createdById: BOB,
        ...(va.status === 'COMPLETED'
          ? { completedAt: new Date('2026-02-01'), completedById: BOB }
          : {}),
      },
    });
  }
  console.log(`  ✅ ${vendorsData.length} vendors, ${vendorAssessmentsData.length} assessments\n`);

  // ========================================================================
  // Layer 7: Assets + Owners
  // ========================================================================
  console.log('  Creating assets...');

  const ownerNames = ['Infrastructure Team', 'Application Team'];
  const assetOwners: Record<string, string> = {};
  for (const name of ownerNames) {
    const owner = await prisma.assetOwner.upsert({
      where: { organizationId_name: { organizationId: ORG_A, name } },
      update: {},
      create: { organizationId: ORG_A, name, createdById: ALICE },
    });
    assetOwners[name] = owner.id;
  }

  const assetsData = [
    { id: 'demo-ast-001', identifier: 'AST-2026-0001', name: 'Production Database Cluster', type: 'DATABASE' as const,    status: 'ACTIVE' as const,            owner: 'Infrastructure Team', buCode: 'ITO' },
    { id: 'demo-ast-002', identifier: 'AST-2026-0002', name: 'Customer Portal',             type: 'APPLICATION' as const, status: 'ACTIVE' as const,            owner: 'Application Team',    buCode: 'ENG' },
    { id: 'demo-ast-003', identifier: 'AST-2026-0003', name: 'Core Network Switch',         type: 'NETWORK' as const,     status: 'ACTIVE' as const,            owner: 'Infrastructure Team', buCode: 'ITO' },
    { id: 'demo-ast-004', identifier: 'AST-2026-0004', name: 'File Storage Array',          type: 'STORAGE' as const,     status: 'ACTIVE' as const,            owner: 'Infrastructure Team', buCode: 'ITO' },
    { id: 'demo-ast-005', identifier: 'AST-2026-0005', name: 'CI/CD Build Server',          type: 'SERVER' as const,      status: 'UNDER_MAINTENANCE' as const, owner: 'Application Team',    buCode: 'ENG' },
    { id: 'demo-ast-006', identifier: 'AST-2026-0006', name: 'Admin Workstations',          type: 'ENDPOINT' as const,    status: 'ACTIVE' as const,            owner: 'Infrastructure Team', buCode: 'ITO' },
  ];

  for (const a of assetsData) {
    await prisma.asset.upsert({
      where: { organizationId_identifier: { organizationId: ORG_A, identifier: a.identifier } },
      update: {},
      create: {
        id: a.id,
        organizationId: ORG_A,
        identifier: a.identifier,
        name: a.name,
        type: a.type,
        status: a.status,
        ownerId: assetOwners[a.owner],
        businessUnitId: businessUnits[a.buCode],
        createdById: BOB,
      },
    });
  }
  console.log(`  ✅ ${ownerNames.length} asset owners, ${assetsData.length} assets\n`);

  // ========================================================================
  // Layer 8: BIA Configuration + Data
  // ========================================================================
  console.log('  Creating BIA configuration...');

  const biaConfig = await prisma.bIAConfiguration.upsert({
    where: { organizationId: ORG_A },
    update: {},
    create: {
      id: 'demo-bia-config',
      organizationId: ORG_A,
      scoreScaleMin: 1,
      scoreScaleMax: 5,
      tierThresholds: [],
    },
  });

  // Impact Categories
  const categoriesData = [
    { name: 'Financial',    weight: 30, sortOrder: 0 },
    { name: 'Operational',  weight: 25, sortOrder: 1 },
    { name: 'Reputational', weight: 25, sortOrder: 2 },
    { name: 'Regulatory',   weight: 20, sortOrder: 3 },
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoriesData) {
    const record = await prisma.bIAImpactCategory.upsert({
      where: { configurationId_name: { configurationId: biaConfig.id, name: cat.name } },
      update: { weight: cat.weight, sortOrder: cat.sortOrder },
      create: {
        configurationId: biaConfig.id,
        name: cat.name,
        weight: cat.weight,
        sortOrder: cat.sortOrder,
      },
    });
    categories[cat.name] = record.id;
  }

  // Tier Definitions
  const tiersData = [
    { name: 'Mission Critical',    tierLevel: 0, rtoText: '1 hour',   rpoText: '15 minutes', colorHex: '#EF4444', sortOrder: 0 },
    { name: 'Business Critical',   tierLevel: 1, rtoText: '4 hours',  rpoText: '1 hour',     colorHex: '#F97316', sortOrder: 1 },
    { name: 'Business Operational', tierLevel: 2, rtoText: '24 hours', rpoText: '4 hours',    colorHex: '#EAB308', sortOrder: 2 },
    { name: 'Administrative',      tierLevel: 3, rtoText: '72 hours', rpoText: '24 hours',   colorHex: '#22C55E', sortOrder: 3 },
  ];

  const tiers: Record<string, string> = {};
  for (const tier of tiersData) {
    const record = await prisma.bIATierDefinition.upsert({
      where: { configurationId_name: { configurationId: biaConfig.id, name: tier.name } },
      update: { rtoText: tier.rtoText, rpoText: tier.rpoText, colorHex: tier.colorHex },
      create: {
        configurationId: biaConfig.id,
        name: tier.name,
        tierLevel: tier.tierLevel,
        rtoText: tier.rtoText,
        rpoText: tier.rpoText,
        colorHex: tier.colorHex,
        sortOrder: tier.sortOrder,
      },
    });
    tiers[tier.name] = record.id;
  }

  // Business Functions
  const functionsData = [
    { id: 'demo-bf-tech', identifier: 'BF-2026-0001', name: 'Core Technology Services' },
    { id: 'demo-bf-corp', identifier: 'BF-2026-0002', name: 'Corporate Operations' },
  ];

  for (const bf of functionsData) {
    await prisma.businessFunction.upsert({
      where: { organizationId_identifier: { organizationId: ORG_A, identifier: bf.identifier } },
      update: {},
      create: {
        id: bf.id,
        organizationId: ORG_A,
        identifier: bf.identifier,
        name: bf.name,
        createdById: ALICE,
      },
    });
  }

  // Business Processes
  const processesData = [
    { id: 'demo-bp-001', identifier: 'BP-2026-0001', name: 'Customer Transaction Processing', functionId: 'demo-bf-tech', assessmentStatus: 'COMPLETED' as const, tierName: 'Mission Critical' },
    { id: 'demo-bp-002', identifier: 'BP-2026-0002', name: 'Internal Communication Platform', functionId: 'demo-bf-tech', assessmentStatus: 'COMPLETED' as const, tierName: 'Business Operational' },
    { id: 'demo-bp-003', identifier: 'BP-2026-0003', name: 'Financial Reporting System',      functionId: 'demo-bf-corp', assessmentStatus: 'DRAFT' as const,     tierName: 'Business Critical' },
    { id: 'demo-bp-004', identifier: 'BP-2026-0004', name: 'Employee Onboarding',             functionId: 'demo-bf-corp', assessmentStatus: 'NOT_STARTED' as const, tierName: null },
  ];

  for (const bp of processesData) {
    await prisma.businessProcess.upsert({
      where: { organizationId_identifier: { organizationId: ORG_A, identifier: bp.identifier } },
      update: {},
      create: {
        id: bp.id,
        organizationId: ORG_A,
        identifier: bp.identifier,
        name: bp.name,
        businessFunctionId: bp.functionId,
        assessmentStatus: bp.assessmentStatus,
        calculatedTierId: bp.tierName ? tiers[bp.tierName] : undefined,
        ownerId: ALICE,
        createdById: ALICE,
      },
    });
  }

  // BIA Impact Scores (4 processes x 4 categories)
  const impactScoresData: Array<{ processId: string; categoryName: string; score: number }> = [
    // Customer Transaction Processing (Tier 1 - high scores)
    { processId: 'demo-bp-001', categoryName: 'Financial',    score: 5 },
    { processId: 'demo-bp-001', categoryName: 'Operational',  score: 5 },
    { processId: 'demo-bp-001', categoryName: 'Reputational', score: 4 },
    { processId: 'demo-bp-001', categoryName: 'Regulatory',   score: 4 },
    // Internal Communication Platform (Tier 3 - moderate)
    { processId: 'demo-bp-002', categoryName: 'Financial',    score: 2 },
    { processId: 'demo-bp-002', categoryName: 'Operational',  score: 3 },
    { processId: 'demo-bp-002', categoryName: 'Reputational', score: 1 },
    { processId: 'demo-bp-002', categoryName: 'Regulatory',   score: 1 },
    // Financial Reporting System (Tier 2)
    { processId: 'demo-bp-003', categoryName: 'Financial',    score: 4 },
    { processId: 'demo-bp-003', categoryName: 'Operational',  score: 3 },
    { processId: 'demo-bp-003', categoryName: 'Reputational', score: 3 },
    { processId: 'demo-bp-003', categoryName: 'Regulatory',   score: 5 },
    // Employee Onboarding (no tier yet)
    { processId: 'demo-bp-004', categoryName: 'Financial',    score: 1 },
    { processId: 'demo-bp-004', categoryName: 'Operational',  score: 2 },
    { processId: 'demo-bp-004', categoryName: 'Reputational', score: 1 },
    { processId: 'demo-bp-004', categoryName: 'Regulatory',   score: 2 },
  ];

  for (const is of impactScoresData) {
    const catId = categories[is.categoryName];
    if (!catId) continue;
    await prisma.bIAImpactScore.upsert({
      where: { processId_categoryId: { processId: is.processId, categoryId: catId } },
      update: { score: is.score },
      create: {
        processId: is.processId,
        categoryId: catId,
        score: is.score,
      },
    });
  }
  console.log(`  ✅ BIA: 1 config, ${categoriesData.length} categories, ${tiersData.length} tiers, ${functionsData.length} functions, ${processesData.length} processes, ${impactScoresData.length} scores\n`);

  // ========================================================================
  // Layer 9: Identifier Sequences
  // ========================================================================
  console.log('  Updating identifier sequences...');
  // Hardcoded seed identifiers need their IdentifierSequence counters set
  // or the generator produces a colliding value on first real create.
  const ORG_B_ID = '550e8400-e29b-41d4-a716-446655440002';
  const sequences: Array<{
    organizationId: string;
    prefix: string;
    year: number;
    lastSequence: number;
  }> = [
    // Org A (Acme Corp) — demo-data.ts + seed.ts seeded identifiers
    { organizationId: ORG_A,    prefix: 'FND',  year: 2026, lastSequence: 6 },
    { organizationId: ORG_A,    prefix: 'RSK',  year: 2026, lastSequence: 2 },
    { organizationId: ORG_A,    prefix: 'COMP', year: 2026, lastSequence: 2 },
    { organizationId: ORG_A,    prefix: 'VND',  year: 2026, lastSequence: 4 },
    { organizationId: ORG_A,    prefix: 'VA',   year: 2026, lastSequence: 2 },
    { organizationId: ORG_A,    prefix: 'AST',  year: 2026, lastSequence: 6 },
    { organizationId: ORG_A,    prefix: 'BP',   year: 2026, lastSequence: 4 },
    { organizationId: ORG_A,    prefix: 'BF',   year: 2026, lastSequence: 2 },
    { organizationId: ORG_A,    prefix: 'RISK', year: 2026, lastSequence: 2 },
    // Org B (Globex) — seed.ts seeds RISK-2026-0001/-0002
    { organizationId: ORG_B_ID, prefix: 'RISK', year: 2026, lastSequence: 2 },
  ];

  for (const seq of sequences) {
    await prisma.identifierSequence.upsert({
      where: {
        organizationId_prefix_year: {
          organizationId: seq.organizationId,
          prefix: seq.prefix,
          year: seq.year,
        },
      },
      update: { lastSequence: seq.lastSequence },
      create: {
        organizationId: seq.organizationId,
        prefix: seq.prefix,
        year: seq.year,
        lastSequence: seq.lastSequence,
      },
    });
  }
  console.log(`  ✅ ${sequences.length} identifier sequences\n`);

  // ========================================================================
  // Layer 11: Risk-Assessment Defaults (Risk Matrix + Assessment Type)
  // Inline implementation (see DEFAULT_3x3_* constants at top of file for the
  // matrix payload). Idempotent — skips if the org already has a default
  // matrix and assessment type.
  // ========================================================================
  console.log('  Seeding default risk matrix + assessment type...');

  // Default Assessment Type (idempotent on isDefault flag).
  const existingAssessmentType = await prisma.assessmentType.findFirst({
    where: { organizationId: ORG_A, isDefault: true },
  });
  if (!existingAssessmentType) {
    await prisma.assessmentType.create({
      data: {
        id: 'demo-default-assessment-type',
        organizationId: ORG_A,
        name: 'General Risk Assessment',
        description: 'Standard risk assessment for general organizational risks',
        isDefault: true,
        isActive: true,
      },
    });
  }

  // Default Risk Matrix Template + published v1.
  let defaultMatrix = await prisma.riskMatrixTemplate.findFirst({
    where: { organizationId: ORG_A, isDefault: true },
    select: { id: true, currentVersionId: true, name: true },
  });
  if (!defaultMatrix) {
    const tpl = await prisma.riskMatrixTemplate.create({
      data: {
        id: 'demo-default-matrix',
        organizationId: ORG_A,
        name: 'Standard 3×3 Risk Matrix',
        description: 'Default 3×3 2D risk matrix using likelihood and impact dimensions',
        dimensionCount: 2,
        gridSize: 3,
        outputScaleMax: 9,
        isDefault: true,
        isActive: true,
      },
    });
    const ver = await prisma.riskMatrixVersion.create({
      data: {
        id: 'demo-default-matrix-v1',
        templateId: tpl.id,
        versionNumber: 1,
        scales: DEFAULT_3x3_SCALES,
        thresholds: DEFAULT_3x3_THRESHOLDS,
        isActive: true,
        publishedAt: new Date(),
      },
    });
    await prisma.riskMatrixTemplate.update({
      where: { id: tpl.id },
      data: { currentVersionId: ver.id },
    });
    defaultMatrix = { id: tpl.id, currentVersionId: ver.id, name: tpl.name };
  }
  if (!defaultMatrix?.currentVersionId) {
    throw new Error('Default risk matrix did not seed correctly');
  }
  const matrixVersionId = defaultMatrix.currentVersionId;
  console.log(`  ✅ Default matrix "${defaultMatrix.name}" published\n`);

  // ========================================================================
  // Layer 12: Risk-Assessment Questionnaire Template (NIST CSF 2.0 lite)
  // 5 sections (Identify/Protect/Detect/Respond/Recover) × 12 questions,
  // each linked to a seeded ISP-* StandardControl. 1 unresolved reference
  // (`ISP-MISSING`) so the post-import "Resolve Now" wizard has data to act
  // on for demo purposes.
  // ========================================================================
  console.log('  Creating risk-assessment questionnaire template...');

  // Look up the seeded StandardControl IDs by code so questions can FK them.
  const ispControls = await prisma.standardControl.findMany({
    where: { Standard: { organizationId: ORG_A } },
    select: { id: true, code: true },
  });
  const ispByCode: Record<string, string> = Object.fromEntries(
    ispControls.map((c) => [c.code, c.id])
  );

  const TEMPLATE_ID = 'demo-ra-template-csf';
  const ratemplate = await prisma.questionnaireTemplate.upsert({
    where: { id: TEMPLATE_ID },
    update: {},
    create: {
      id: TEMPLATE_ID,
      organizationId: ORG_A,
      name: 'NIST CSF 2.0 — Demo Assessment',
      description: 'Demo template — 12 NIST CSF 2.0 questions across the 5 Functions, mapped to the org standard library.',
      usageType: QuestionnaireUsageType.RISK_ASSESSMENT,
      isSystemTemplate: false,
      isActive: true,
      version: 1,
      createdById: ALICE,
      updatedAt: new Date(),
    },
  });

  type SeedQuestion = {
    number: string;
    text: string;
    /** ISP-* code for resolution; missing or unknown becomes an unresolvedReference. */
    refCode: string;
  };
  const sectionsData: { id: string; title: string; questions: SeedQuestion[] }[] = [
    {
      id: 'demo-ra-section-id',
      title: 'Identify',
      questions: [
        { number: 'ID.AM-1', text: 'Are physical assets inventoried and managed?', refCode: 'ISP-001' },
        { number: 'ID.AM-2', text: 'Are software platforms and applications inventoried?', refCode: 'ISP-003' },
        { number: 'ID.RA-1', text: 'Are vulnerabilities identified and documented?', refCode: 'ISP-006' },
      ],
    },
    {
      id: 'demo-ra-section-pr',
      title: 'Protect',
      questions: [
        { number: 'PR.AC-1', text: 'Are credentials managed for authorized devices and users?', refCode: 'ISP-002' },
        { number: 'PR.AC-4', text: 'Are access permissions managed (least privilege)?', refCode: 'ISP-007' },
        { number: 'PR.DS-1', text: 'Is data-at-rest protected?', refCode: 'ISP-004' },
        { number: 'PR.DS-2', text: 'Is data-in-transit protected?', refCode: 'ISP-MISSING' /* unresolved on purpose */ },
      ],
    },
    {
      id: 'demo-ra-section-de',
      title: 'Detect',
      questions: [
        { number: 'DE.CM-1', text: 'Is the network monitored to detect potential cybersecurity events?', refCode: 'ISP-006' },
        { number: 'DE.AE-3', text: 'Is event data collected and correlated from multiple sources?', refCode: 'ISP-006' },
      ],
    },
    {
      id: 'demo-ra-section-rs',
      title: 'Respond',
      questions: [
        { number: 'RS.RP-1', text: 'Is a response plan executed during or after an incident?', refCode: 'ISP-006' },
      ],
    },
    {
      id: 'demo-ra-section-rc',
      title: 'Recover',
      questions: [
        { number: 'RC.RP-1', text: 'Is a recovery plan executed during or after a cybersecurity incident?', refCode: 'ISP-009' },
        { number: 'RC.IM-1', text: 'Are recovery plans incorporating lessons learned?', refCode: 'ISP-010' },
      ],
    },
  ];

  let templateQuestionTotal = 0;
  // First pass: build the template-side sections + questions. Map keyed by question id
  // so we can clone them later. Idempotent via upsert on the deterministic IDs.
  const templateQuestionByPath: Record<string, { id: string; refCode: string; number: string; text: string }> = {};
  for (let sIdx = 0; sIdx < sectionsData.length; sIdx++) {
    const sec = sectionsData[sIdx]!;
    await prisma.questionnaireSection.upsert({
      where: { id: sec.id },
      update: {},
      create: {
        id: sec.id,
        templateId: ratemplate.id,
        title: sec.title,
        sortOrder: sIdx,
        updatedAt: new Date(),
      },
    });
    for (let qIdx = 0; qIdx < sec.questions.length; qIdx++) {
      const q = sec.questions[qIdx]!;
      const qId = `${sec.id}-q${qIdx + 1}`;
      const stdControlId = ispByCode[q.refCode] ?? null;
      const unresolved = stdControlId ? null : q.refCode;
      await prisma.questionnaireQuestion.upsert({
        where: { id: qId },
        update: {},
        create: {
          id: qId,
          sectionId: sec.id,
          number: q.number,
          questionText: q.text,
          questionType: QuestionType.TEXT,
          isRequired: false,
          sortOrder: qIdx,
          isLongText: false,
          standardControlId: stdControlId,
          unresolvedReference: unresolved,
          updatedAt: new Date(),
        },
      });
      templateQuestionByPath[`${sec.id}/${qIdx + 1}`] = {
        id: qId,
        refCode: q.refCode,
        number: q.number,
        text: q.text,
      };
      templateQuestionTotal++;
    }
  }
  console.log(`  ✅ Template "${ratemplate.name}" with ${sectionsData.length} sections, ${templateQuestionTotal} questions\n`);

  // ========================================================================
  // Layer 13: Two RiskAssessmentProjects — one with an attached questionnaire
  // (partly answered, ready for the Questionnaire-tab demo), one without
  // (lands on the empty-state template picker).
  // ========================================================================
  console.log('  Creating risk assessments...');

  const PROJECT_WITH_Q_ID = 'demo-ra-project-with-q';
  const PROJECT_EMPTY_ID = 'demo-ra-project-empty';

  await prisma.riskAssessmentProject.upsert({
    where: { id: PROJECT_WITH_Q_ID },
    update: {},
    create: {
      id: PROJECT_WITH_Q_ID,
      organizationId: ORG_A,
      subject: 'Q3 Internal IT Risk Review',
      description: 'Quarterly review of IT controls scoped to access management, data protection, monitoring, and incident response.',
      matrixVersionId,
      assigneeId: BOB,
      createdById: ALICE,
      status: 'IN_PROGRESS',
      dueDate: new Date('2026-09-30'),
    },
  });

  await prisma.riskAssessmentProject.upsert({
    where: { id: PROJECT_EMPTY_ID },
    update: {},
    create: {
      id: PROJECT_EMPTY_ID,
      organizationId: ORG_A,
      subject: 'Cloud Migration Risk Assessment',
      description: 'Pre-migration risk review for the AWS lift-and-shift of the legacy ERP. Awaiting questionnaire selection.',
      matrixVersionId,
      assigneeId: ALICE,
      createdById: ALICE,
      status: 'IN_PROGRESS',
      dueDate: new Date('2026-08-15'),
    },
  });

  // Cloned snapshot: deep-copy the template into the first project.
  const QUESTIONNAIRE_ID = 'demo-ra-questionnaire-1';
  const existingQuestionnaire = await prisma.riskAssessmentQuestionnaire.findUnique({
    where: { id: QUESTIONNAIRE_ID },
    select: { id: true },
  });
  if (!existingQuestionnaire) {
    await prisma.riskAssessmentQuestionnaire.create({
      data: {
        id: QUESTIONNAIRE_ID,
        organizationId: ORG_A,
        riskAssessmentProjectId: PROJECT_WITH_Q_ID,
        templateId: ratemplate.id,
        templateName: ratemplate.name,
        updatedAt: new Date(),
      },
    });

    // Clone every section/question. Pre-answer 3 of the 12 questions so the
    // tab's progress bar isn't 0% out of the box but also isn't fully
    // satisfied — leaves room for the demo presenter to answer a question
    // live and watch the "Submit for Approval" gate flip.
    const PREANSWER: Record<string, { status: RiskQuestionStatus; notes: string }> = {
      'ID.AM-1': {
        status: RiskQuestionStatus.IMPLEMENTED,
        notes: 'CMDB sync runs nightly against AWS Config. Validated 2026-04-15 by Tom Bradley.',
      },
      'PR.AC-1': {
        status: RiskQuestionStatus.PARTIAL,
        notes: 'MFA enforced for SSO + privileged accounts. Service accounts still on rotated static credentials — exception until 2026-Q4.',
      },
      'PR.DS-1': {
        status: RiskQuestionStatus.NOT_IMPLEMENTED,
        notes: 'Production database volumes confirmed unencrypted at rest (AWS RDS — encryption flag was not set at creation time). Treatment plan in Q3.',
      },
    };

    for (let sIdx = 0; sIdx < sectionsData.length; sIdx++) {
      const sec = sectionsData[sIdx]!;
      const cloneSectionId = `${QUESTIONNAIRE_ID}-${sec.id}`;
      await prisma.riskAssessmentSection.create({
        data: {
          id: cloneSectionId,
          questionnaireId: QUESTIONNAIRE_ID,
          name: sec.title,
          order: sIdx,
          updatedAt: new Date(),
        },
      });
      for (let qIdx = 0; qIdx < sec.questions.length; qIdx++) {
        const q = sec.questions[qIdx]!;
        const tplQ = templateQuestionByPath[`${sec.id}/${qIdx + 1}`]!;
        const stdControlId = ispByCode[q.refCode] ?? null;
        const unresolved = stdControlId ? null : q.refCode;
        const pre = PREANSWER[q.number];
        await prisma.riskAssessmentQuestion.create({
          data: {
            id: `${cloneSectionId}-q${qIdx + 1}`,
            sectionId: cloneSectionId,
            number: q.number,
            text: q.text,
            isCustom: false,
            templateQuestionId: tplQ.id,
            standardControlId: stdControlId,
            unresolvedReference: unresolved,
            status: pre?.status ?? null,
            notes: pre?.notes ?? null,
            order: qIdx,
            updatedAt: new Date(),
          },
        });
      }
    }
    console.log(`  ✅ 2 risk assessments (1 with attached questionnaire, 3/${templateQuestionTotal} pre-answered)\n`);
  } else {
    console.log(`  ⏭️  Risk assessments already seeded — skipping\n`);
  }

  console.log('✅ Demo data seeding complete!\n');
}
