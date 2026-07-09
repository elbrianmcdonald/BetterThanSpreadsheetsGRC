import { PrismaClient } from '@prisma/client';

// ============================================================================
// Globex Inc demo data (Org B) — a distinct, self-contained dataset so the two
// seeded companies look genuinely different when switching between them.
//
// Theme: Globex is a PAYMENTS / FINTECH processor (PCI-DSS, cardholder data,
// settlement, fraud) — deliberately unlike Acme's general-SaaS security data.
//
// Risks here use MANUAL matrix scoring (self-contained, no finding-link rollup
// or enterprise-risk tagging) to keep this module simple and idempotent.
// Identifier counters are advanced by seed.ts `syncIdentifierSequences`.
// ============================================================================

const ORG_B = '550e8400-e29b-41d4-a716-446655440002';
const GLOBEX_ADMIN = '550e8400-e29b-41d4-a716-446655440021';
const GLOBEX_ENGINEER = '550e8400-e29b-41d4-a716-446655440022';
const MATRIX_VERSION_ID = 'demo-globex-matrix-v1';

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

function scoreLI(
  likelihood: number,
  impact: number,
): { score: number; label: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' } {
  const score = likelihood * impact;
  if (score <= 3) return { score, label: 'Low', severity: 'LOW' };
  if (score <= 6) return { score, label: 'Medium', severity: 'MEDIUM' };
  return { score, label: 'High', severity: 'HIGH' };
}

export async function seedGlobexDemoData(prisma: PrismaClient) {
  console.log('Creating Globex (Org B) demo data...\n');

  // --------------------------------------------------------------------------
  // Default risk matrix (3×3) + assessment type — idempotent.
  // --------------------------------------------------------------------------
  const existingType = await prisma.assessmentType.findFirst({
    where: { organizationId: ORG_B, isDefault: true },
  });
  if (!existingType) {
    await prisma.assessmentType.create({
      data: {
        id: 'demo-globex-assessment-type',
        organizationId: ORG_B,
        name: 'General Risk Assessment',
        description: 'Standard risk assessment for general organizational risks',
        isDefault: true,
        isActive: true,
      },
    });
  }

  const existingMatrix = await prisma.riskMatrixTemplate.findFirst({
    where: { organizationId: ORG_B, isDefault: true },
    select: { id: true },
  });
  if (!existingMatrix) {
    const tpl = await prisma.riskMatrixTemplate.create({
      data: {
        id: 'demo-globex-matrix',
        organizationId: ORG_B,
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
        id: MATRIX_VERSION_ID,
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
  }

  // --------------------------------------------------------------------------
  // Business units (payments-themed).
  // --------------------------------------------------------------------------
  const buData = [
    { name: 'Payments Engineering', code: 'PAY' },
    { name: 'Risk & Fraud',         code: 'FRD' },
    { name: 'Treasury & Settlement', code: 'TRS' },
    { name: 'Compliance',           code: 'CMP' },
    { name: 'Customer Operations',  code: 'COP' },
  ];
  const businessUnits: Record<string, string> = {};
  for (const bu of buData) {
    const record = await prisma.businessUnit.upsert({
      where: { organizationId_name: { organizationId: ORG_B, name: bu.name } },
      update: { code: bu.code },
      create: { organizationId: ORG_B, name: bu.name, code: bu.code },
    });
    businessUnits[bu.code] = record.id;
  }

  // --------------------------------------------------------------------------
  // People.
  // --------------------------------------------------------------------------
  const peopleData = [
    { name: 'Elena Voss',    email: 'elena.voss@globex-inc.com',    jobTitle: 'Head of Payments',        buCode: 'PAY' },
    { name: 'Raj Patel',     email: 'raj.patel@globex-inc.com',     jobTitle: 'Fraud Risk Lead',         buCode: 'FRD' },
    { name: 'Dana Fischer',  email: 'dana.fischer@globex-inc.com',  jobTitle: 'Treasury Manager',        buCode: 'TRS' },
    { name: 'Marcus Reed',   email: 'marcus.reed@globex-inc.com',   jobTitle: 'PCI Compliance Officer',  buCode: 'CMP' },
    { name: 'Priya Nair',    email: 'priya.nair@globex-inc.com',    jobTitle: 'Customer Ops Director',    buCode: 'COP' },
  ];
  for (const p of peopleData) {
    await prisma.person.upsert({
      where: { organizationId_email: { organizationId: ORG_B, email: p.email } },
      update: { name: p.name, jobTitle: p.jobTitle, businessUnitId: businessUnits[p.buCode] },
      create: {
        organizationId: ORG_B,
        name: p.name,
        email: p.email,
        jobTitle: p.jobTitle,
        businessUnitId: businessUnits[p.buCode],
      },
    });
  }

  // --------------------------------------------------------------------------
  // Findings (matrix-scored, payments-themed).
  // --------------------------------------------------------------------------
  const findingsData = [
    { id: 'globex-find-001', identifier: 'FND-2026-0001', title: 'Cardholder Data Stored Outside PCI Scope',        source: 'AUDIT' as const,   l: 3, i: 3, status: 'NEW' as const,        description: 'A quarterly PCI review found unmasked PANs written to an analytics data lake outside the defined cardholder data environment (CDE).' },
    { id: 'globex-find-002', identifier: 'FND-2026-0002', title: 'Missing Segmentation Between CDE and Corporate',  source: 'PENTEST' as const, l: 2, i: 3, status: 'TRIAGED' as const,    description: 'Penetration testing reached CDE hosts from a corporate workstation VLAN, indicating segmentation controls are incomplete.' },
    { id: 'globex-find-003', identifier: 'FND-2026-0003', title: 'Weak Key-Rotation Policy on Payment HSM',         source: 'AUDIT' as const,   l: 2, i: 3, status: 'NEW' as const,        description: 'Payment HSM data-encryption keys have not been rotated within the policy interval, weakening protection of stored account data.' },
    { id: 'globex-find-004', identifier: 'FND-2026-0004', title: 'Verbose API Errors Leak Transaction Metadata',    source: 'SCANNER' as const, l: 2, i: 2, status: 'TRIAGED' as const,    description: 'The merchant API returns stack traces and internal identifiers on error, exposing transaction routing metadata to callers.' },
    { id: 'globex-find-005', identifier: 'FND-2026-0005', title: 'Default Credentials on POS Middleware',           source: 'SCANNER' as const, l: 3, i: 3, status: 'NEW' as const,        description: 'Vulnerability scanning found vendor-default administrator credentials still active on point-of-sale integration middleware.' },
    { id: 'globex-find-006', identifier: 'FND-2026-0006', title: 'Insufficient Logging of Privileged Ledger Access', source: 'AUDIT' as const,  l: 2, i: 2, status: 'NEEDS_INFO' as const,  description: 'Access to the settlement ledger by privileged operators is not consistently logged, limiting fraud investigation capability.' },
    { id: 'globex-find-007', identifier: 'FND-2026-0007', title: 'Outdated TLS on Merchant API Endpoints',          source: 'SCANNER' as const, l: 2, i: 2, status: 'CLOSED' as const,     description: 'Two merchant-facing API endpoints negotiated TLS 1.1; they have since been reconfigured to require TLS 1.2+.' },
    { id: 'globex-find-008', identifier: 'FND-2026-0008', title: 'Fraud-Rules Engine Lacks Change Approval',        source: 'MANUAL' as const,  l: 1, i: 3, status: 'TRIAGED' as const,    description: 'Changes to fraud-scoring rules can be pushed to production without documented review or approval, risking undetected fraud gaps.' },
  ];
  for (const f of findingsData) {
    const s = scoreLI(f.l, f.i);
    await prisma.finding.upsert({
      where: { organizationId_identifier: { organizationId: ORG_B, identifier: f.identifier } },
      update: {
        title: f.title,
        description: f.description,
        source: f.source,
        severity: s.severity,
        severityLabel: s.label,
        status: f.status,
        inherentLikelihood: f.l,
        inherentImpact: f.i,
        inherentScore: s.score,
        matrixVersionId: MATRIX_VERSION_ID,
      },
      create: {
        id: f.id,
        organizationId: ORG_B,
        identifier: f.identifier,
        title: f.title,
        description: f.description,
        source: f.source,
        severity: s.severity,
        severityLabel: s.label,
        status: f.status,
        inherentLikelihood: f.l,
        inherentImpact: f.i,
        inherentScore: s.score,
        matrixVersionId: MATRIX_VERSION_ID,
        createdBy: GLOBEX_ENGINEER,
        assigneeId: GLOBEX_ENGINEER,
        ...(f.status === 'TRIAGED' || f.status === 'CLOSED' || f.status === 'NEEDS_INFO'
          ? { triagedBy: GLOBEX_ENGINEER, triagedAt: new Date('2026-02-10') }
          : {}),
        ...(f.status === 'CLOSED' ? { closedAt: new Date('2026-02-18') } : {}),
      },
    });
  }

  // --------------------------------------------------------------------------
  // Risks (manual matrix-scored, payments-themed). Identifiers start at 0003
  // because seed.ts already seeds RISK-2026-0001/-0002 for Globex.
  // --------------------------------------------------------------------------
  const risksData = [
    { id: 'globex-risk-0003', identifier: 'RISK-2026-0003', title: 'PCI-DSS Scope Creep in Cardholder Data Environment', il: 3, ii: 3, rl: 2, ri: 3, status: 'OPEN' as const,        description: 'Cardholder data is proliferating into systems outside the formally scoped CDE, expanding audit scope and breach exposure.' },
    { id: 'globex-risk-0004', identifier: 'RISK-2026-0004', title: 'Settlement Reconciliation Gaps',                    il: 2, ii: 3, rl: 2, ri: 2, status: 'ASSIGNED' as const,   description: 'Daily settlement and chargeback reconciliation has manual gaps that could let discrepancies or fraud go undetected.' },
    { id: 'globex-risk-0005', identifier: 'RISK-2026-0005', title: 'Single Acquiring-Bank Dependency',                   il: 2, ii: 3, rl: 2, ri: 3, status: 'OPEN' as const,        description: 'Card authorization depends on a single acquiring bank with no fallback, threatening payment continuity during an outage.' },
    { id: 'globex-risk-0006', identifier: 'RISK-2026-0006', title: 'Insider Access to Payment Ledger',                   il: 3, ii: 3, rl: 2, ri: 2, status: 'ASSIGNED' as const,   description: 'Privileged operators can alter the settlement ledger with insufficient logging and separation of duties.' },
    { id: 'globex-risk-0007', identifier: 'RISK-2026-0007', title: 'Fraud-Scoring Vendor Concentration',                 il: 2, ii: 2, rl: 2, ri: 2, status: 'OPEN' as const,        description: 'Real-time fraud decisions rely on one third-party scoring provider; an outage or model drift would raise fraud losses.' },
    { id: 'globex-risk-0008', identifier: 'RISK-2026-0008', title: 'Cryptographic Key Management Weakness',              il: 3, ii: 3, rl: 1, ri: 3, status: 'REMEDIATED' as const, description: 'HSM key-rotation and custody gaps risked exposure of stored account data; rotation and dual-custody controls are now enforced.' },
  ];
  for (const r of risksData) {
    const inh = scoreLI(r.il, r.ii);
    const res = scoreLI(r.rl, r.ri);
    const scoring = {
      title: r.title,
      description: r.description,
      severity: inh.severity,
      status: r.status,
      inherentLikelihood: r.il,
      inherentImpact: r.ii,
      inherentScore: inh.score,
      inherentScoreLabel: inh.label,
      residualLikelihood: r.rl,
      residualImpact: r.ri,
      residualScore: res.score,
      residualScoreLabel: res.label,
      matrixVersionId: MATRIX_VERSION_ID,
      useManualScore: true,
      manualLikelihood: r.rl,
      manualImpact: r.ri,
      manualScore: res.score,
      manualScoreLabel: res.label,
      calculatedScore: null,
      calculatedScoreLabel: null,
      effectiveScore: res.score,
      effectiveScoreLabel: res.label,
      effectiveScoreSource: 'MANUAL' as const,
    };
    await prisma.risk.upsert({
      where: { id: r.id },
      update: scoring,
      create: {
        id: r.id,
        organizationId: ORG_B,
        identifier: r.identifier,
        updatedAt: new Date(),
        ...scoring,
      },
    });
  }

  console.log(
    `  ✅ Globex demo data: ${buData.length} BUs, ${peopleData.length} people, ${findingsData.length} findings, ${risksData.length} risks\n`,
  );
}
