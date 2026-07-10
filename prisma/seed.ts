import { PrismaClient, RiskTemplateCategory } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'crypto';
import { seedNistCsf2Framework } from './seeds/nist-csf-2';
import { seedNist800171R3Controls } from './seeds/nist-800-171-r3';
import { seedNist80053Controls } from './seeds/nist-800-53-r5';
import { seedC2m2Framework } from './seeds/c2m2';
import { seedOwaspSammFramework } from './seeds/owasp-samm';
import { seedDemoData } from './seeds/demo-data';
import { seedGlobexDemoData } from './seeds/demo-data-globex';

// NOTE: the seed runs via `tsx prisma/seed.ts` in the standalone runner image,
// which tree-shakes out `src/`. So we can't import from `@/server/...` here —
// the membership backfill is inlined below (kept in sync with
// src/server/services/organization/backfill.ts, which the app + tests use).
async function backfillMemberships(
  _db: PrismaClient,
): Promise<{ created: number }> {
  // Role Consolidation Epic 2: obsolete. There is no stored User.role to backfill
  // from — staff carry platformRole (all-org, no membership) and Business Users are
  // provisioned with a membership directly. Retained as a no-op for callers.
  return { created: 0 };
}
import { seedEnterpriseRisks } from './seeds/enterprise-risks';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Default password for all test users: Admin123!@#
const DEFAULT_PASSWORD_HASH = '$2b$10$jDC2qxxxP6CLnU9xz.eMNuQIIR68cDhkyRa5S6GW..TrLbPSiA6Oa';

/**
 * Advance each IdentifierSequence counter up to the max identifier actually
 * used by seeded rows, per (organizationId, prefix, year). The demo seed writes
 * explicit identifiers (e.g. FND-2026-0007) but does NOT touch IdentifierSequence,
 * so without this the generator would re-issue FND-2026-0001 and collide on the
 * next create. Run AFTER all rows are seeded. Never lowers an existing counter
 * (so app-created rows beyond the seed are preserved across re-seeds).
 */
async function syncIdentifierSequences(db: PrismaClient) {
  const specs: { prefix: string; rows: () => Promise<{ organizationId: string; identifier: string | null }[]> }[] = [
    { prefix: 'FND', rows: () => db.finding.findMany({ select: { organizationId: true, identifier: true } }) },
    { prefix: 'RISK', rows: () => db.risk.findMany({ select: { organizationId: true, identifier: true } }) },
    { prefix: 'RSK', rows: () => db.riskAssessment.findMany({ select: { organizationId: true, identifier: true } }) },
  ];
  for (const { prefix, rows } of specs) {
    const maxByKey = new Map<string, { org: string; year: number; seq: number }>();
    for (const r of await rows()) {
      const m = /^[A-Z]+-(\d{4})-(\d+)$/.exec(r.identifier ?? '');
      if (!m) continue;
      const year = parseInt(m[1]!, 10);
      const seq = parseInt(m[2]!, 10);
      const key = `${r.organizationId}|${year}`;
      const cur = maxByKey.get(key);
      if (!cur || seq > cur.seq) maxByKey.set(key, { org: r.organizationId, year, seq });
    }
    for (const { org, year, seq } of maxByKey.values()) {
      const where = { organizationId_prefix_year: { organizationId: org, prefix, year } };
      const existing = await db.identifierSequence.findUnique({ where });
      if (!existing) {
        await db.identifierSequence.create({ data: { organizationId: org, prefix, year, lastSequence: seq } });
      } else if (existing.lastSequence < seq) {
        await db.identifierSequence.update({ where, data: { lastSequence: seq } });
      }
    }
  }
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Create Organization A
  console.log('Creating Organization A...');
  const orgA = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Acme Corporation',
      slug: 'acme-corp',
      active: true,
      updatedAt: new Date(),
      settings: {
        industry: 'Technology',
        employees: 500,
      },
    },
  });
  console.log(`✅ Created Organization A: ${orgA.name} (${orgA.id})\n`);

  // Create Organization B
  console.log('Creating Organization B...');
  const orgB = await prisma.organization.upsert({
    where: { slug: 'globex-inc' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Globex Inc',
      slug: 'globex-inc',
      active: true,
      updatedAt: new Date(),
      settings: {
        industry: 'Manufacturing',
        employees: 1200,
      },
    },
  });
  console.log(`✅ Created Organization B: ${orgB.name} (${orgB.id})\n`);

  // Create Users for Organization A
  console.log('Creating users for Organization A...');
  const userA1 = await prisma.user.upsert({
    where: { email: 'admin@acme-corp.com' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440011',
      email: 'admin@acme-corp.com',
      name: 'Alice Admin',
      hashedPassword: DEFAULT_PASSWORD_HASH,
      platformRole: 'ADMINISTRATOR',
      organizationId: orgA.id,
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  const userA2 = await prisma.user.upsert({
    where: { email: 'analyst@acme-corp.com' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440012',
      email: 'analyst@acme-corp.com',
      name: 'Bob Analyst',
      hashedPassword: DEFAULT_PASSWORD_HASH,
      platformRole: 'ANALYST',
      organizationId: orgA.id,
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });
  console.log(`✅ Created ${userA1.name} and ${userA2.name}\n`);

  // Create Users for Organization B
  console.log('Creating users for Organization B...');
  const userB1 = await prisma.user.upsert({
    where: { email: 'admin@globex-inc.com' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440021',
      email: 'admin@globex-inc.com',
      name: 'Carol Admin',
      hashedPassword: DEFAULT_PASSWORD_HASH,
      platformRole: 'ADMINISTRATOR',
      organizationId: orgB.id,
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  const userB2 = await prisma.user.upsert({
    where: { email: 'engineer@globex-inc.com' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440022',
      email: 'engineer@globex-inc.com',
      name: 'David Engineer',
      hashedPassword: DEFAULT_PASSWORD_HASH,
      platformRole: 'ANALYST',
      organizationId: orgB.id,
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });
  console.log(`✅ Created ${userB1.name} and ${userB2.name}\n`);

  // Create Evidence records for Organization A
  console.log('Creating evidence records for Organization A...');
  const evidenceA1 = await prisma.evidence.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440031' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440031',
      organizationId: orgA.id,
      title: 'SOC 2 Audit Report 2024',
      originalFileName: 'soc2-2024.pdf',
      description: 'Annual SOC 2 Type II audit report',
      filePath: '/uploads/acme-corp/soc2-2024.pdf',
      fileSize: 2548736,
      fileType: 'application/pdf',
      uploadedBy: userA2.id,
      updatedAt: new Date(),
    },
  });

  const evidenceA2 = await prisma.evidence.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440032' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440032',
      organizationId: orgA.id,
      title: 'Penetration Test Results',
      originalFileName: 'pentest-q4.pdf',
      description: 'Q4 2024 penetration testing report',
      filePath: '/uploads/acme-corp/pentest-q4.pdf',
      fileSize: 1024000,
      fileType: 'application/pdf',
      uploadedBy: userA2.id,
      updatedAt: new Date(),
    },
  });
  console.log(`✅ Created ${evidenceA1.title} and ${evidenceA2.title}\n`);

  // Create Evidence records for Organization B
  console.log('Creating evidence records for Organization B...');
  const evidenceB1 = await prisma.evidence.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440041' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440041',
      organizationId: orgB.id,
      title: 'ISO 27001 Certificate',
      originalFileName: 'iso27001-cert.pdf',
      description: 'Current ISO 27001:2013 certification',
      filePath: '/uploads/globex-inc/iso27001-cert.pdf',
      fileSize: 512000,
      fileType: 'application/pdf',
      uploadedBy: userB2.id,
      updatedAt: new Date(),
    },
  });

  const evidenceB2 = await prisma.evidence.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440042' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440042',
      organizationId: orgB.id,
      title: 'Incident Response Plan',
      originalFileName: 'ir-plan.docx',
      description: 'Updated incident response procedures',
      filePath: '/uploads/globex-inc/ir-plan.docx',
      fileSize: 256000,
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      uploadedBy: userB2.id,
      updatedAt: new Date(),
    },
  });
  console.log(`✅ Created ${evidenceB1.title} and ${evidenceB2.title}\n`);

  // Create Risk records for Organization A
  console.log('Creating risk records for Organization A...');
  const riskA1 = await prisma.risk.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440051' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440051',
      identifier: 'RISK-2026-0001',
      organizationId: orgA.id,
      title: 'Unpatched SQL Server 2019',
      description: 'Production SQL Server missing critical security patches',
      severity: 'HIGH',
      status: 'OPEN',
      updatedAt: new Date(),
    },
  });

  const riskA2 = await prisma.risk.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440052' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440052',
      identifier: 'RISK-2026-0002',
      organizationId: orgA.id,
      title: 'Missing MFA on Admin Accounts',
      description: 'Administrative accounts do not have MFA enabled',
      severity: 'MEDIUM',
      status: 'OPEN',
      updatedAt: new Date(),
    },
  });
  console.log(`✅ Created ${riskA1.title} and ${riskA2.title}\n`);

  // Create Risk records for Organization B
  console.log('Creating risk records for Organization B...');
  const riskB1 = await prisma.risk.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440061' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440061',
      identifier: 'RISK-2026-0001',
      organizationId: orgB.id,
      title: 'Weak Password Policy',
      description: 'Password complexity requirements do not meet NIST standards',
      severity: 'MEDIUM',
      status: 'OPEN',
      updatedAt: new Date(),
    },
  });

  const riskB2 = await prisma.risk.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440062' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440062',
      identifier: 'RISK-2026-0002',
      organizationId: orgB.id,
      title: 'Unsegmented Network',
      description: 'Flat network architecture increases blast radius',
      severity: 'HIGH',
      status: 'REMEDIATED',
      updatedAt: new Date(),
    },
  });
  console.log(`✅ Created ${riskB1.title} and ${riskB2.title}\n`);

  // Create Framework records - Four frameworks for Org A: NIST CSF, NIST 800-53r5, NIST 800-171, ISO 27001:2022
  console.log('Creating framework records...');

  const frameworkNISTCSF = await prisma.framework.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440071' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440071',
      organizationId: orgA.id,
      name: 'NIST Cybersecurity Framework',
      code: 'NISTCSF',
      version: '2.0',
      isActive: true,
      activatedAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    },
  });

  const frameworkNIST80053 = await prisma.framework.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440072' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440072',
      organizationId: orgA.id,
      name: 'NIST SP 800-53',
      code: 'NIST80053',
      version: 'Rev 5.2.0',
      isActive: true,
      activatedAt: new Date('2024-01-15'),
      updatedAt: new Date(),
    },
  });

  const frameworkNIST800171 = await prisma.framework.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440073' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440073',
      organizationId: orgA.id,
      name: 'NIST SP 800-171',
      code: 'NIST800171',
      version: 'Rev 3',
      isActive: true,
      activatedAt: new Date('2024-02-01'),
      updatedAt: new Date(),
    },
  });

  const frameworkISO = await prisma.framework.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440074' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440074',
      organizationId: orgA.id,
      name: 'ISO/IEC 27001',
      code: 'ISO27001',
      version: '2022',
      isActive: true,
      activatedAt: new Date('2024-02-15'),
      updatedAt: new Date(),
    },
  });

  // Org B gets ISO 27001 and NIST 800-171
  const frameworkB1 = await prisma.framework.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440081' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440081',
      organizationId: orgB.id,
      name: 'ISO/IEC 27001',
      code: 'ISO27001',
      version: '2022',
      isActive: true,
      activatedAt: new Date('2024-03-15'),
      updatedAt: new Date(),
    },
  });

  const frameworkB2 = await prisma.framework.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440082' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440082',
      organizationId: orgB.id,
      name: 'NIST SP 800-171',
      code: 'NIST800171',
      version: 'Rev 3',
      isActive: true,
      activatedAt: new Date('2024-03-20'),
      updatedAt: new Date(),
    },
  });
  console.log(`✅ Created NIST CSF 2.0, NIST 800-53r5, NIST 800-171, ISO 27001:2022 for Org A\n`);
  console.log(`✅ Created ISO 27001:2022, NIST 800-171 for Org B\n`);

  // Create Control records for all frameworks (needed for evidence amplification)
  console.log('Creating control records...');

  // NIST 800-53 Rev 5.2.0 Controls (all 1,196 controls with baselines from CPRT Excel)
  const existing80053 = await prisma.control.count({ where: { frameworkId: frameworkNIST80053.id } });
  let nist80053Result = { familyCount: 20, controlCount: existing80053 };
  if (existing80053 === 0) {
    nist80053Result = await seedNist80053Controls(prisma, frameworkNIST80053.id, orgA.id);
  }
  console.log(`  ✅ NIST 800-53 Rev 5.2.0: ${nist80053Result.familyCount} families, ${nist80053Result.controlCount} controls`);

  // NIST 800-171 Rev 3 Controls (CUI Protection) - seeded from modular file
  const existing800171 = await prisma.control.count({ where: { frameworkId: frameworkNIST800171.id } });
  let nist800171Result = { familyCount: 17, controlCount: existing800171 };
  if (existing800171 === 0) {
    nist800171Result = await seedNist800171R3Controls(prisma, frameworkNIST800171.id, orgA.id);
  }
  console.log(`  ✅ NIST 800-171 Rev 3: ${nist800171Result.familyCount} families, ${nist800171Result.controlCount} controls`);

  // Also seed NIST 800-171 Rev 3 for Org B
  const existing800171B = await prisma.control.count({ where: { frameworkId: frameworkB2.id } });
  let nist800171ResultB = { familyCount: 17, controlCount: existing800171B };
  if (existing800171B === 0) {
    nist800171ResultB = await seedNist800171R3Controls(prisma, frameworkB2.id, orgB.id);
  }
  console.log(`  ✅ NIST 800-171 Rev 3 (Org B): ${nist800171ResultB.familyCount} families, ${nist800171ResultB.controlCount} controls`);

  // ISO 27001 Controls
  const iso27001Controls = [
    { controlId: 'A.5.12', title: 'Classification of Information', description: 'Information shall be classified in terms of legal requirements, value, criticality and sensitivity to unauthorized disclosure or modification.' },
    { controlId: 'A.5.13', title: 'Labeling of Information', description: 'An appropriate set of procedures for information labeling shall be developed and implemented.' },
    { controlId: 'A.5.14', title: 'Information Transfer', description: 'Information transfer rules, procedures, or agreements shall be in place for all types of transfer facilities.' },
    { controlId: 'A.5.15', title: 'Access Control', description: 'Rules to control physical and logical access to information and other associated assets shall be established and implemented.' },
    { controlId: 'A.5.16', title: 'Identity Management', description: 'The full lifecycle of identities shall be managed.' },
    { controlId: 'A.5.17', title: 'Authentication Information', description: 'Allocation and management of authentication information shall be controlled by a management process.' },
    { controlId: 'A.5.18', title: 'Access Rights', description: 'Access rights to information and other associated assets shall be provisioned, reviewed, modified and removed.' },
    { controlId: 'A.5.19', title: 'Information Security in Supplier Relationships', description: 'Processes and procedures shall be defined and implemented to manage the information security risks associated with the use of supplier\'s products or services.' },
    { controlId: 'A.5.20', title: 'Addressing Security Within Supplier Agreements', description: 'Relevant information security requirements shall be established and agreed with each supplier.' },
    { controlId: 'A.5.21', title: 'Managing Information Security in the ICT Supply Chain', description: 'Processes and procedures shall be defined and implemented to manage the information security risks associated with the ICT products and services supply chain.' },
    { controlId: 'A.5.22', title: 'Monitoring, Review and Change Management of Supplier Services', description: 'The organization shall regularly monitor, review, evaluate and manage change in supplier information security practices.' },
    { controlId: 'A.5.23', title: 'Information Security for Use of Cloud Services', description: 'Processes for acquisition, use, management and exit from cloud services shall be established.' },
    { controlId: 'A.5.24', title: 'Information Security Incident Management Planning and Preparation', description: 'The organization shall plan and prepare for managing information security incidents.' },
    { controlId: 'A.5.25', title: 'Assessment and Decision on Information Security Events', description: 'The organization shall assess information security events and decide if they are to be categorized as information security incidents.' },
    { controlId: 'A.5.26', title: 'Response to Information Security Incidents', description: 'Information security incidents shall be responded to in accordance with the documented procedures.' },
    { controlId: 'A.5.27', title: 'Learning from Information Security Incidents', description: 'Knowledge gained from information security incidents shall be used to strengthen and improve the information security controls.' },
    { controlId: 'A.5.28', title: 'Collection of Evidence', description: 'The organization shall establish and implement procedures for the identification, collection, acquisition and preservation of evidence.' },
    { controlId: 'A.5.29', title: 'Information Security During Disruption', description: 'The organization shall plan how to maintain information security at an appropriate level during disruption.' },
    { controlId: 'A.5.30', title: 'ICT Readiness for Business Continuity', description: 'ICT readiness shall be planned, implemented, maintained and tested based on business continuity objectives.' },
    { controlId: 'A.5.33', title: 'Protection of Records', description: 'Records shall be protected from loss, destruction, falsification, unauthorized access and unauthorized release.' },
    { controlId: 'A.5.34', title: 'Privacy and Protection of PII', description: 'The organization shall identify and meet the requirements regarding the preservation of privacy and protection of PII.' },
    { controlId: 'A.6.3', title: 'Information Security Awareness, Education and Training', description: 'Personnel of the organization and relevant interested parties shall receive appropriate information security awareness education and training.' },
    { controlId: 'A.6.4', title: 'Disciplinary Process', description: 'A disciplinary process shall be formalized and communicated to take actions against personnel and other relevant interested parties who have committed an information security policy violation.' },
    { controlId: 'A.6.8', title: 'Information Security Event Reporting', description: 'The organization shall provide a mechanism for personnel to report observed or suspected information security events.' },
    { controlId: 'A.7.1', title: 'Physical Security Perimeters', description: 'Security perimeters shall be defined and used to protect areas that contain either sensitive or critical information and information processing facilities.' },
    { controlId: 'A.7.2', title: 'Physical Entry', description: 'Secure areas shall be protected by appropriate entry controls to ensure that only authorized personnel are allowed access.' },
    { controlId: 'A.7.3', title: 'Securing Offices, Rooms and Facilities', description: 'Physical security for offices, rooms and facilities shall be designed and implemented.' },
    { controlId: 'A.7.4', title: 'Physical Security Monitoring', description: 'Premises shall be continuously monitored for unauthorized physical access.' },
    { controlId: 'A.7.5', title: 'Protecting Against Physical and Environmental Threats', description: 'Protection against physical and environmental threats, such as natural disasters and other intentional or unintentional physical threats to infrastructure shall be designed and implemented.' },
    { controlId: 'A.7.8', title: 'Equipment Siting and Protection', description: 'Equipment shall be sited securely and protected.' },
    { controlId: 'A.8.2', title: 'Privileged Access Rights', description: 'The allocation and use of privileged access rights shall be restricted and managed.' },
    { controlId: 'A.8.3', title: 'Information Access Restriction', description: 'Access to information and other associated assets shall be restricted in accordance with the established topic-specific policy on access control.' },
    { controlId: 'A.8.5', title: 'Secure Authentication', description: 'Secure authentication technologies and procedures shall be implemented.' },
    { controlId: 'A.8.8', title: 'Management of Technical Vulnerabilities', description: 'Information about technical vulnerabilities of information systems in use shall be obtained and appropriate measures shall be taken.' },
    { controlId: 'A.8.9', title: 'Configuration Management', description: 'Configurations, including security configurations, of hardware, software, services and networks shall be established, documented, implemented, monitored and reviewed.' },
    { controlId: 'A.8.13', title: 'Information Backup', description: 'Backup copies of information, software and systems shall be maintained and regularly tested.' },
    { controlId: 'A.8.14', title: 'Redundancy of Information Processing Facilities', description: 'Information processing facilities shall be implemented with redundancy sufficient to meet availability requirements.' },
    { controlId: 'A.8.15', title: 'Logging', description: 'Logs that record activities, exceptions, faults and other relevant events shall be produced, stored, protected and analysed.' },
    { controlId: 'A.8.16', title: 'Monitoring Activities', description: 'Networks, systems and applications shall be monitored for anomalous behaviour and appropriate actions taken.' },
    { controlId: 'A.8.17', title: 'Clock Synchronization', description: 'The clocks of information processing systems used by the organization shall be synchronized to approved time sources.' },
    { controlId: 'A.8.20', title: 'Networks Security', description: 'Networks and network devices shall be secured, managed and controlled to protect information in systems and applications.' },
    { controlId: 'A.8.21', title: 'Security of Network Services', description: 'Security mechanisms, service levels and service requirements of network services shall be identified, implemented and monitored.' },
    { controlId: 'A.8.22', title: 'Segregation of Networks', description: 'Groups of information services, users and information systems shall be segregated in the organization\'s networks.' },
    { controlId: 'A.8.24', title: 'Use of Cryptography', description: 'Rules for the effective use of cryptography, including cryptographic key management, shall be defined and implemented.' },
    { controlId: 'A.8.32', title: 'Change Management', description: 'Changes to information processing facilities and information systems shall be subject to change management procedures.' },
  ];

  for (const control of iso27001Controls) {
    const existing = await prisma.control.findFirst({
      where: { frameworkId: frameworkISO.id, controlId: control.controlId },
    });
    if (!existing) {
      await prisma.control.create({
        data: {
          id: randomUUID(),
          organizationId: orgA.id,
          frameworkId: frameworkISO.id,
          controlId: control.controlId,
          title: control.title,
          description: control.description,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    }
  }

  // NIST CSF Controls
  const nistcsfControls = [
    { controlId: 'PR.AC-1', title: 'Identities and Credentials', description: 'Identities and credentials are issued, managed, verified, revoked, and audited for authorized devices, users and processes.' },
    { controlId: 'PR.AC-2', title: 'Physical Access to Assets', description: 'Physical access to assets is managed and protected.' },
    { controlId: 'PR.AC-3', title: 'Remote Access', description: 'Remote access is managed.' },
    { controlId: 'PR.AC-4', title: 'Access Permissions and Authorizations', description: 'Access permissions and authorizations are managed, incorporating the principles of least privilege and separation of duties.' },
    { controlId: 'PR.AC-5', title: 'Network Integrity', description: 'Network integrity is protected (e.g., network segregation, network segmentation).' },
    { controlId: 'PR.AC-6', title: 'Identities Proofed and Bound', description: 'Identities are proofed and bound to credentials and asserted in interactions.' },
    { controlId: 'PR.AC-7', title: 'Users, Devices, and Other Assets Authenticated', description: 'Users, devices, and other assets are authenticated (e.g., single-factor, multi-factor) commensurate with the risk of the transaction.' },
    { controlId: 'PR.AT-1', title: 'All Users Informed and Trained', description: 'All users are informed and trained.' },
    { controlId: 'PR.AT-2', title: 'Privileged Users Understand Responsibilities', description: 'Privileged users understand their roles and responsibilities.' },
    { controlId: 'PR.AT-3', title: 'Third-Party Stakeholders Understand Roles', description: 'Third-party stakeholders (e.g., suppliers, customers, partners) understand their roles and responsibilities.' },
    { controlId: 'PR.AT-4', title: 'Senior Executives Understand Roles', description: 'Senior executives understand their roles and responsibilities.' },
    { controlId: 'PR.DS-1', title: 'Data-at-Rest Protection', description: 'Data-at-rest is protected.' },
    { controlId: 'PR.DS-2', title: 'Data-in-Transit Protection', description: 'Data-in-transit is protected.' },
    { controlId: 'PR.DS-3', title: 'Assets Formally Managed', description: 'Assets are formally managed throughout removal, transfers, and disposition.' },
    { controlId: 'PR.DS-5', title: 'Data Leakage Protection', description: 'Protections against data leaks are implemented.' },
    { controlId: 'PR.IP-1', title: 'Configuration Management', description: 'A baseline configuration of information technology/industrial control systems is created and maintained incorporating security principles.' },
    { controlId: 'PR.IP-3', title: 'Configuration Change Control', description: 'Configuration change control processes are in place.' },
    { controlId: 'PR.IP-4', title: 'Backups Conducted', description: 'Backups of information are conducted, maintained, and tested.' },
    { controlId: 'PR.IP-5', title: 'Physical Operating Environment', description: 'Policy and regulations regarding the physical operating environment for organizational assets are met.' },
    { controlId: 'PR.IP-9', title: 'Response and Recovery Plans', description: 'Response plans (Incident Response and Business Continuity) and recovery plans (Incident Recovery and Disaster Recovery) are in place and managed.' },
    { controlId: 'PR.IP-12', title: 'Vulnerability Management', description: 'A vulnerability management plan is developed and implemented.' },
    { controlId: 'PR.PT-4', title: 'Communications and Control Networks Protection', description: 'Communications and control networks are protected.' },
    { controlId: 'DE.AE-1', title: 'Baseline of Network Operations', description: 'A baseline of network operations and expected data flows for users and systems is established and managed.' },
    { controlId: 'DE.AE-2', title: 'Detected Events Analyzed', description: 'Detected events are analyzed to understand attack targets and methods.' },
    { controlId: 'DE.AE-3', title: 'Event Data Collection', description: 'Event data are collected and correlated from multiple sources and sensors.' },
    { controlId: 'DE.CM-1', title: 'Network Monitoring', description: 'The network is monitored to detect potential cybersecurity events.' },
    { controlId: 'DE.CM-7', title: 'Unauthorized Activity Monitoring', description: 'Monitoring for unauthorized personnel, connections, devices, and software is performed.' },
    { controlId: 'DE.CM-8', title: 'Vulnerability Scans', description: 'Vulnerability scans are performed.' },
    { controlId: 'RS.RP-1', title: 'Response Plan Execution', description: 'Response plan is executed during or after an incident.' },
    { controlId: 'RS.CO-1', title: 'Response Coordination', description: 'Personnel know their roles and order of operations when a response is needed.' },
    { controlId: 'RS.AN-1', title: 'Notifications from Detection Systems', description: 'Notifications from detection systems are investigated.' },
    { controlId: 'RS.MI-1', title: 'Incidents Contained', description: 'Incidents are contained.' },
    { controlId: 'RS.IM-1', title: 'Response Plans Incorporate Lessons', description: 'Response plans incorporate lessons learned.' },
    { controlId: 'RC.RP-1', title: 'Recovery Plan Execution', description: 'Recovery plan is executed during or after a cybersecurity incident.' },
    { controlId: 'RC.IM-1', title: 'Recovery Plans Incorporate Lessons', description: 'Recovery plans incorporate lessons learned into future activities.' },
    { controlId: 'ID.SC-1', title: 'Supply Chain Risk Management Processes', description: 'Cyber supply chain risk management processes are identified, established, assessed, managed, and agreed to by organizational stakeholders.' },
    { controlId: 'ID.SC-2', title: 'Suppliers and Third Party Partners Identified', description: 'Suppliers and third party partners of information systems, components, and services are identified, prioritized, and assessed using a cyber supply chain risk assessment process.' },
    { controlId: 'ID.SC-3', title: 'Contracts Include Security Requirements', description: 'Contracts with suppliers and third-party partners are used to implement appropriate measures designed to meet the objectives of an organization\'s cybersecurity program and Cyber Supply Chain Risk Management Plan.' },
    { controlId: 'ID.SC-4', title: 'Supplier Assessments', description: 'Suppliers and third-party partners are routinely assessed using audits, test results, or other forms of evaluations to confirm they are meeting their contractual obligations.' },
  ];

  for (const control of nistcsfControls) {
    const existing = await prisma.control.findFirst({
      where: { frameworkId: frameworkNISTCSF.id, controlId: control.controlId },
    });
    if (!existing) {
      await prisma.control.create({
        data: {
          id: randomUUID(),
          organizationId: orgA.id,
          frameworkId: frameworkNISTCSF.id,
          controlId: control.controlId,
          title: control.title,
          description: control.description,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    }
  }

  console.log(`✅ Created ${nist80053Result.familyCount + nist80053Result.controlCount + nist800171Result.familyCount + nist800171Result.controlCount + iso27001Controls.length + nistcsfControls.length} control records\n`);

  // Create Control Domains (Story 2.3: Simplified Control Taxonomy)
  console.log('Creating control domains...');
  const controlDomains = [
    {
      id: '550e8400-e29b-41d4-a716-446655440101',
      code: 'ACCESS_CONTROL',
      name: 'Access Control',
      description: 'Policies and procedures for managing user access to systems and data, including role-based access control and least privilege principles.',
      sortOrder: 1,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440102',
      code: 'AUTHENTICATION',
      name: 'Authentication & Identity',
      description: 'User authentication mechanisms, multi-factor authentication, identity verification, and account management.',
      sortOrder: 2,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440103',
      code: 'DATA_PROTECTION',
      name: 'Data Protection',
      description: 'Data classification, handling, retention, disposal, and protection of sensitive information throughout its lifecycle.',
      sortOrder: 3,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440104',
      code: 'ENCRYPTION',
      name: 'Encryption & Cryptography',
      description: 'Encryption of data at rest and in transit, cryptographic key management, and secure communication protocols.',
      sortOrder: 4,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440105',
      code: 'NETWORK_SECURITY',
      name: 'Network Security',
      description: 'Firewalls, network segmentation, VPNs, intrusion detection/prevention, and network monitoring.',
      sortOrder: 5,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440106',
      code: 'LOGGING_MONITORING',
      name: 'Logging & Monitoring',
      description: 'Security event logging, log management, SIEM integration, alerting, and continuous monitoring.',
      sortOrder: 6,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440107',
      code: 'INCIDENT_RESPONSE',
      name: 'Incident Response',
      description: 'Incident detection, response procedures, forensics, communication protocols, and lessons learned.',
      sortOrder: 7,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440108',
      code: 'BUSINESS_CONTINUITY',
      name: 'Business Continuity & DR',
      description: 'Backup procedures, disaster recovery planning, business continuity plans, and resilience testing.',
      sortOrder: 8,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440109',
      code: 'PHYSICAL_SECURITY',
      name: 'Physical Security',
      description: 'Facility access controls, environmental controls, hardware security, and physical asset protection.',
      sortOrder: 9,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440110',
      code: 'THIRD_PARTY_RISK',
      name: 'Third-Party Risk Management',
      description: 'Vendor security assessments, contract security requirements, supply chain risk, and ongoing monitoring.',
      sortOrder: 10,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440111',
      code: 'SECURITY_AWARENESS',
      name: 'Security Awareness & Training',
      description: 'Employee security training, phishing awareness, security culture initiatives, and awareness programs.',
      sortOrder: 11,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440112',
      code: 'CHANGE_MANAGEMENT',
      name: 'Change & Configuration Management',
      description: 'Change control processes, configuration baselines, patch management, and secure deployment practices.',
      sortOrder: 12,
    },
  ];

  for (const domain of controlDomains) {
    await prisma.controlDomain.upsert({
      where: { code: domain.code },
      update: { ...domain, updatedAt: new Date() },
      create: { ...domain, updatedAt: new Date() },
    });
  }
  console.log(`✅ Created ${controlDomains.length} control domains\n`);

  // Story 2.4: Create Control Domain Mappings (OSCAL Translation Engine)
  console.log('Creating control domain mappings...');

  // Get control domain IDs for mapping
  const domainMap = new Map<string, string>();
  const allDomains = await prisma.controlDomain.findMany();
  for (const domain of allDomains) {
    domainMap.set(domain.code, domain.id);
  }

  // Comprehensive control domain mappings for ISO 27001:2022, NIST CSF 2.0, NIST 800-53r5, and NIST 800-171
  const controlMappings = [
    // ACCESS_CONTROL mappings
    { domainCode: 'ACCESS_CONTROL', frameworkCode: 'ISO27001', controlId: 'A.5.15', confidence: 100 }, // Access control
    { domainCode: 'ACCESS_CONTROL', frameworkCode: 'ISO27001', controlId: 'A.5.16', confidence: 100 }, // Identity management
    { domainCode: 'ACCESS_CONTROL', frameworkCode: 'ISO27001', controlId: 'A.5.18', confidence: 100 }, // Access rights
    { domainCode: 'ACCESS_CONTROL', frameworkCode: 'ISO27001', controlId: 'A.8.2', confidence: 95 },  // Privileged access
    { domainCode: 'ACCESS_CONTROL', frameworkCode: 'ISO27001', controlId: 'A.8.3', confidence: 95 },  // Information access
    { domainCode: 'ACCESS_CONTROL', frameworkCode: 'NIST80053', controlId: 'AC-02', confidence: 100 }, // Account Management
    { domainCode: 'ACCESS_CONTROL', frameworkCode: 'NIST80053', controlId: 'AC-03', confidence: 100 }, // Access Enforcement
    { domainCode: 'ACCESS_CONTROL', frameworkCode: 'NIST80053', controlId: 'AC-05', confidence: 100 }, // Separation of Duties
    { domainCode: 'ACCESS_CONTROL', frameworkCode: 'NIST80053', controlId: 'AC-06', confidence: 100 }, // Least Privilege
    { domainCode: 'ACCESS_CONTROL', frameworkCode: 'NIST800171', controlId: '03.01.01', confidence: 100 }, // Account Management
    { domainCode: 'ACCESS_CONTROL', frameworkCode: 'NIST800171', controlId: '03.01.02', confidence: 100 }, // Access Enforcement
    { domainCode: 'ACCESS_CONTROL', frameworkCode: 'NIST800171', controlId: '03.01.05', confidence: 100 }, // Least Privilege
    { domainCode: 'ACCESS_CONTROL', frameworkCode: 'NISTCSF', controlId: 'PR.AC-1', confidence: 100 }, // Identities and credentials
    { domainCode: 'ACCESS_CONTROL', frameworkCode: 'NISTCSF', controlId: 'PR.AC-3', confidence: 100 }, // Remote access
    { domainCode: 'ACCESS_CONTROL', frameworkCode: 'NISTCSF', controlId: 'PR.AC-4', confidence: 100 }, // Access permissions

    // AUTHENTICATION mappings
    { domainCode: 'AUTHENTICATION', frameworkCode: 'ISO27001', controlId: 'A.5.17', confidence: 100 }, // Authentication info
    { domainCode: 'AUTHENTICATION', frameworkCode: 'ISO27001', controlId: 'A.8.5', confidence: 100 },  // Secure authentication
    { domainCode: 'AUTHENTICATION', frameworkCode: 'NIST80053', controlId: 'IA-02', confidence: 100 }, // Identification and Authentication
    { domainCode: 'AUTHENTICATION', frameworkCode: 'NIST80053', controlId: 'IA-05', confidence: 100 }, // Authenticator Management
    { domainCode: 'AUTHENTICATION', frameworkCode: 'NIST80053', controlId: 'AC-07', confidence: 100 }, // Unsuccessful Logon Attempts
    { domainCode: 'AUTHENTICATION', frameworkCode: 'NIST800171', controlId: '03.05.01', confidence: 100 }, // Identification and Authentication
    { domainCode: 'AUTHENTICATION', frameworkCode: 'NIST800171', controlId: '03.05.02', confidence: 100 }, // Multifactor Authentication
    { domainCode: 'AUTHENTICATION', frameworkCode: 'NIST800171', controlId: '03.05.03', confidence: 100 }, // Authenticator Management
    { domainCode: 'AUTHENTICATION', frameworkCode: 'NISTCSF', controlId: 'PR.AC-1', confidence: 95 },  // Identities and credentials
    { domainCode: 'AUTHENTICATION', frameworkCode: 'NISTCSF', controlId: 'PR.AC-7', confidence: 100 }, // Authentication

    // DATA_PROTECTION mappings
    { domainCode: 'DATA_PROTECTION', frameworkCode: 'ISO27001', controlId: 'A.5.12', confidence: 100 }, // Classification of information
    { domainCode: 'DATA_PROTECTION', frameworkCode: 'ISO27001', controlId: 'A.5.13', confidence: 100 }, // Labeling of information
    { domainCode: 'DATA_PROTECTION', frameworkCode: 'ISO27001', controlId: 'A.5.14', confidence: 100 }, // Information transfer
    { domainCode: 'DATA_PROTECTION', frameworkCode: 'ISO27001', controlId: 'A.5.33', confidence: 100 }, // Protection of records
    { domainCode: 'DATA_PROTECTION', frameworkCode: 'ISO27001', controlId: 'A.5.34', confidence: 100 }, // Privacy and PII protection
    { domainCode: 'DATA_PROTECTION', frameworkCode: 'NIST80053', controlId: 'SC-08', confidence: 100 }, // Transmission Confidentiality
    { domainCode: 'DATA_PROTECTION', frameworkCode: 'NIST80053', controlId: 'SC-28', confidence: 100 }, // Protection at Rest
    { domainCode: 'DATA_PROTECTION', frameworkCode: 'NIST800171', controlId: '03.01.03', confidence: 100 }, // Information Flow Enforcement
    { domainCode: 'DATA_PROTECTION', frameworkCode: 'NIST800171', controlId: '03.08.01', confidence: 100 }, // Media Protection
    { domainCode: 'DATA_PROTECTION', frameworkCode: 'NIST800171', controlId: '03.13.08', confidence: 95 },  // Transmission Confidentiality (replaces withdrawn 3.13.16)
    { domainCode: 'DATA_PROTECTION', frameworkCode: 'NISTCSF', controlId: 'PR.DS-1', confidence: 100 }, // Data-at-rest
    { domainCode: 'DATA_PROTECTION', frameworkCode: 'NISTCSF', controlId: 'PR.DS-2', confidence: 100 }, // Data-in-transit
    { domainCode: 'DATA_PROTECTION', frameworkCode: 'NISTCSF', controlId: 'PR.DS-5', confidence: 100 }, // Data leakage protection

    // ENCRYPTION mappings
    { domainCode: 'ENCRYPTION', frameworkCode: 'ISO27001', controlId: 'A.8.24', confidence: 100 }, // Use of cryptography
    { domainCode: 'ENCRYPTION', frameworkCode: 'ISO27001', controlId: 'A.5.14', confidence: 85 },  // Information transfer
    { domainCode: 'ENCRYPTION', frameworkCode: 'NIST80053', controlId: 'SC-12', confidence: 100 }, // Cryptographic Key Management
    { domainCode: 'ENCRYPTION', frameworkCode: 'NIST80053', controlId: 'SC-13', confidence: 100 }, // Cryptographic Protection
    { domainCode: 'ENCRYPTION', frameworkCode: 'NIST800171', controlId: '03.13.08', confidence: 100 }, // Transmission Confidentiality and Integrity
    { domainCode: 'ENCRYPTION', frameworkCode: 'NIST800171', controlId: '03.13.10', confidence: 100 }, // Cryptographic Key Establishment and Management
    { domainCode: 'ENCRYPTION', frameworkCode: 'NIST800171', controlId: '03.13.11', confidence: 100 }, // Cryptographic Protection
    { domainCode: 'ENCRYPTION', frameworkCode: 'NISTCSF', controlId: 'PR.DS-1', confidence: 95 },  // Data-at-rest protection
    { domainCode: 'ENCRYPTION', frameworkCode: 'NISTCSF', controlId: 'PR.DS-2', confidence: 95 },  // Data-in-transit protection

    // NETWORK_SECURITY mappings
    { domainCode: 'NETWORK_SECURITY', frameworkCode: 'ISO27001', controlId: 'A.8.20', confidence: 100 }, // Networks security
    { domainCode: 'NETWORK_SECURITY', frameworkCode: 'ISO27001', controlId: 'A.8.21', confidence: 100 }, // Security of network services
    { domainCode: 'NETWORK_SECURITY', frameworkCode: 'ISO27001', controlId: 'A.8.22', confidence: 100 }, // Segregation of networks
    { domainCode: 'NETWORK_SECURITY', frameworkCode: 'NIST80053', controlId: 'SC-07', confidence: 100 }, // Boundary Protection
    { domainCode: 'NETWORK_SECURITY', frameworkCode: 'NIST80053', controlId: 'AC-04', confidence: 100 }, // Information Flow Enforcement
    { domainCode: 'NETWORK_SECURITY', frameworkCode: 'NIST800171', controlId: '03.13.01', confidence: 100 }, // Boundary Protection
    { domainCode: 'NETWORK_SECURITY', frameworkCode: 'NIST800171', controlId: '03.13.06', confidence: 100 }, // Network Communications – Deny by Default – Allow by Exception
    { domainCode: 'NETWORK_SECURITY', frameworkCode: 'NISTCSF', controlId: 'PR.AC-5', confidence: 100 }, // Network integrity
    { domainCode: 'NETWORK_SECURITY', frameworkCode: 'NISTCSF', controlId: 'PR.PT-4', confidence: 100 }, // Communications protection
    { domainCode: 'NETWORK_SECURITY', frameworkCode: 'NISTCSF', controlId: 'DE.CM-1', confidence: 95 },  // Network monitoring

    // LOGGING_MONITORING mappings
    { domainCode: 'LOGGING_MONITORING', frameworkCode: 'ISO27001', controlId: 'A.8.15', confidence: 100 }, // Logging
    { domainCode: 'LOGGING_MONITORING', frameworkCode: 'ISO27001', controlId: 'A.8.16', confidence: 100 }, // Monitoring activities
    { domainCode: 'LOGGING_MONITORING', frameworkCode: 'ISO27001', controlId: 'A.8.17', confidence: 100 }, // Clock synchronization
    { domainCode: 'LOGGING_MONITORING', frameworkCode: 'NIST80053', controlId: 'AU-02', confidence: 100 }, // Event Logging
    { domainCode: 'LOGGING_MONITORING', frameworkCode: 'NIST80053', controlId: 'AU-06', confidence: 100 }, // Audit Review and Analysis
    { domainCode: 'LOGGING_MONITORING', frameworkCode: 'NIST80053', controlId: 'SI-04', confidence: 100 }, // System Monitoring
    { domainCode: 'LOGGING_MONITORING', frameworkCode: 'NIST800171', controlId: '03.03.01', confidence: 100 }, // Event Logging
    { domainCode: 'LOGGING_MONITORING', frameworkCode: 'NIST800171', controlId: '03.03.03', confidence: 100 }, // Audit Record Review, Analysis, and Reporting
    { domainCode: 'LOGGING_MONITORING', frameworkCode: 'NIST800171', controlId: '03.14.06', confidence: 100 }, // System Monitoring
    { domainCode: 'LOGGING_MONITORING', frameworkCode: 'NISTCSF', controlId: 'DE.AE-1', confidence: 100 }, // Baseline of operations
    { domainCode: 'LOGGING_MONITORING', frameworkCode: 'NISTCSF', controlId: 'DE.AE-3', confidence: 100 }, // Event data collection
    { domainCode: 'LOGGING_MONITORING', frameworkCode: 'NISTCSF', controlId: 'DE.CM-1', confidence: 100 }, // Network monitoring

    // INCIDENT_RESPONSE mappings
    { domainCode: 'INCIDENT_RESPONSE', frameworkCode: 'ISO27001', controlId: 'A.5.24', confidence: 100 }, // Incident planning
    { domainCode: 'INCIDENT_RESPONSE', frameworkCode: 'ISO27001', controlId: 'A.5.25', confidence: 100 }, // Assessment and decision
    { domainCode: 'INCIDENT_RESPONSE', frameworkCode: 'ISO27001', controlId: 'A.5.26', confidence: 100 }, // Response to incidents
    { domainCode: 'INCIDENT_RESPONSE', frameworkCode: 'ISO27001', controlId: 'A.5.27', confidence: 100 }, // Learning from incidents
    { domainCode: 'INCIDENT_RESPONSE', frameworkCode: 'NIST80053', controlId: 'IR-04', confidence: 100 }, // Incident Handling
    { domainCode: 'INCIDENT_RESPONSE', frameworkCode: 'NIST80053', controlId: 'IR-05', confidence: 100 }, // Incident Monitoring
    { domainCode: 'INCIDENT_RESPONSE', frameworkCode: 'NIST80053', controlId: 'IR-06', confidence: 100 }, // Incident Reporting
    { domainCode: 'INCIDENT_RESPONSE', frameworkCode: 'NIST800171', controlId: '03.06.01', confidence: 100 }, // Incident Handling
    { domainCode: 'INCIDENT_RESPONSE', frameworkCode: 'NIST800171', controlId: '03.06.02', confidence: 100 }, // Incident Reporting
    { domainCode: 'INCIDENT_RESPONSE', frameworkCode: 'NISTCSF', controlId: 'RS.RP-1', confidence: 100 }, // Response plan execution
    { domainCode: 'INCIDENT_RESPONSE', frameworkCode: 'NISTCSF', controlId: 'RS.AN-1', confidence: 100 }, // Notifications from detection
    { domainCode: 'INCIDENT_RESPONSE', frameworkCode: 'NISTCSF', controlId: 'RS.MI-1', confidence: 100 }, // Incidents contained

    // BUSINESS_CONTINUITY mappings
    { domainCode: 'BUSINESS_CONTINUITY', frameworkCode: 'ISO27001', controlId: 'A.5.29', confidence: 100 }, // ICT continuity planning
    { domainCode: 'BUSINESS_CONTINUITY', frameworkCode: 'ISO27001', controlId: 'A.5.30', confidence: 100 }, // ICT readiness for BC
    { domainCode: 'BUSINESS_CONTINUITY', frameworkCode: 'ISO27001', controlId: 'A.8.13', confidence: 100 }, // Information backup
    { domainCode: 'BUSINESS_CONTINUITY', frameworkCode: 'NIST80053', controlId: 'CP-02', confidence: 100 }, // Contingency Plan
    { domainCode: 'BUSINESS_CONTINUITY', frameworkCode: 'NIST80053', controlId: 'CP-04', confidence: 100 }, // Contingency Plan Testing
    { domainCode: 'BUSINESS_CONTINUITY', frameworkCode: 'NIST80053', controlId: 'CP-09', confidence: 100 }, // System Backup
    { domainCode: 'BUSINESS_CONTINUITY', frameworkCode: 'NIST80053', controlId: 'CP-10', confidence: 100 }, // System Recovery
    { domainCode: 'BUSINESS_CONTINUITY', frameworkCode: 'NISTCSF', controlId: 'PR.IP-4', confidence: 100 }, // Backups conducted
    { domainCode: 'BUSINESS_CONTINUITY', frameworkCode: 'NISTCSF', controlId: 'PR.IP-9', confidence: 100 }, // Response/recovery plans
    { domainCode: 'BUSINESS_CONTINUITY', frameworkCode: 'NISTCSF', controlId: 'RC.RP-1', confidence: 100 }, // Recovery plan execution

    // PHYSICAL_SECURITY mappings
    { domainCode: 'PHYSICAL_SECURITY', frameworkCode: 'ISO27001', controlId: 'A.7.1', confidence: 100 }, // Physical security perimeters
    { domainCode: 'PHYSICAL_SECURITY', frameworkCode: 'ISO27001', controlId: 'A.7.2', confidence: 100 }, // Physical entry
    { domainCode: 'PHYSICAL_SECURITY', frameworkCode: 'ISO27001', controlId: 'A.7.3', confidence: 100 }, // Securing offices
    { domainCode: 'PHYSICAL_SECURITY', frameworkCode: 'ISO27001', controlId: 'A.7.4', confidence: 100 }, // Physical security monitoring
    { domainCode: 'PHYSICAL_SECURITY', frameworkCode: 'NIST80053', controlId: 'PE-02', confidence: 100 }, // Physical Access Authorizations
    { domainCode: 'PHYSICAL_SECURITY', frameworkCode: 'NIST80053', controlId: 'PE-03', confidence: 100 }, // Physical Access Control
    { domainCode: 'PHYSICAL_SECURITY', frameworkCode: 'NIST80053', controlId: 'PE-06', confidence: 100 }, // Monitoring Physical Access
    { domainCode: 'PHYSICAL_SECURITY', frameworkCode: 'NIST800171', controlId: '03.10.01', confidence: 100 }, // Physical Access Authorizations
    { domainCode: 'PHYSICAL_SECURITY', frameworkCode: 'NIST800171', controlId: '03.10.02', confidence: 100 }, // Physical Access Control
    { domainCode: 'PHYSICAL_SECURITY', frameworkCode: 'NISTCSF', controlId: 'PR.AC-2', confidence: 100 }, // Physical access to assets
    { domainCode: 'PHYSICAL_SECURITY', frameworkCode: 'NISTCSF', controlId: 'PR.IP-5', confidence: 100 }, // Physical operating environment

    // THIRD_PARTY_RISK mappings
    { domainCode: 'THIRD_PARTY_RISK', frameworkCode: 'ISO27001', controlId: 'A.5.19', confidence: 100 }, // Supplier relationships
    { domainCode: 'THIRD_PARTY_RISK', frameworkCode: 'ISO27001', controlId: 'A.5.20', confidence: 100 }, // Supplier agreements
    { domainCode: 'THIRD_PARTY_RISK', frameworkCode: 'ISO27001', controlId: 'A.5.21', confidence: 100 }, // ICT supply chain security
    { domainCode: 'THIRD_PARTY_RISK', frameworkCode: 'ISO27001', controlId: 'A.5.22', confidence: 100 }, // Supplier services
    { domainCode: 'THIRD_PARTY_RISK', frameworkCode: 'NIST80053', controlId: 'SR-01', confidence: 100 }, // Supply Chain Risk Management Policy
    { domainCode: 'THIRD_PARTY_RISK', frameworkCode: 'NIST80053', controlId: 'SR-03', confidence: 100 }, // Supply Chain Controls
    { domainCode: 'THIRD_PARTY_RISK', frameworkCode: 'NIST80053', controlId: 'SR-05', confidence: 100 }, // Acquisition Strategies
    { domainCode: 'THIRD_PARTY_RISK', frameworkCode: 'NISTCSF', controlId: 'ID.SC-1', confidence: 100 }, // Supply chain risk management
    { domainCode: 'THIRD_PARTY_RISK', frameworkCode: 'NISTCSF', controlId: 'ID.SC-2', confidence: 100 }, // Suppliers identified
    { domainCode: 'THIRD_PARTY_RISK', frameworkCode: 'NISTCSF', controlId: 'ID.SC-4', confidence: 100 }, // Supplier assessments

    // SECURITY_AWARENESS mappings
    { domainCode: 'SECURITY_AWARENESS', frameworkCode: 'ISO27001', controlId: 'A.6.3', confidence: 100 }, // Security awareness training
    { domainCode: 'SECURITY_AWARENESS', frameworkCode: 'ISO27001', controlId: 'A.6.8', confidence: 100 }, // Security event reporting
    { domainCode: 'SECURITY_AWARENESS', frameworkCode: 'NIST80053', controlId: 'IR-02', confidence: 100 }, // Incident Response Training
    { domainCode: 'SECURITY_AWARENESS', frameworkCode: 'NIST800171', controlId: '03.02.01', confidence: 100 }, // Literacy Training and Awareness
    { domainCode: 'SECURITY_AWARENESS', frameworkCode: 'NIST800171', controlId: '03.02.02', confidence: 100 }, // Role-Based Training
    { domainCode: 'SECURITY_AWARENESS', frameworkCode: 'NISTCSF', controlId: 'PR.AT-1', confidence: 100 }, // All users informed and trained
    { domainCode: 'SECURITY_AWARENESS', frameworkCode: 'NISTCSF', controlId: 'PR.AT-2', confidence: 100 }, // Privileged users understand roles

    // CHANGE_MANAGEMENT mappings
    { domainCode: 'CHANGE_MANAGEMENT', frameworkCode: 'ISO27001', controlId: 'A.8.9', confidence: 100 },  // Configuration management
    { domainCode: 'CHANGE_MANAGEMENT', frameworkCode: 'ISO27001', controlId: 'A.8.32', confidence: 100 }, // Change management
    { domainCode: 'CHANGE_MANAGEMENT', frameworkCode: 'ISO27001', controlId: 'A.8.8', confidence: 100 },  // Vulnerability management
    { domainCode: 'CHANGE_MANAGEMENT', frameworkCode: 'NIST80053', controlId: 'CM-02', confidence: 100 }, // Baseline Configuration
    { domainCode: 'CHANGE_MANAGEMENT', frameworkCode: 'NIST80053', controlId: 'CM-03', confidence: 100 }, // Configuration Change Control
    { domainCode: 'CHANGE_MANAGEMENT', frameworkCode: 'NIST80053', controlId: 'CM-06', confidence: 100 }, // Configuration Settings
    { domainCode: 'CHANGE_MANAGEMENT', frameworkCode: 'NIST800171', controlId: '03.04.01', confidence: 100 }, // Baseline Configuration
    { domainCode: 'CHANGE_MANAGEMENT', frameworkCode: 'NIST800171', controlId: '03.04.03', confidence: 100 }, // Configuration Change Control
    { domainCode: 'CHANGE_MANAGEMENT', frameworkCode: 'NIST800171', controlId: '03.04.04', confidence: 100 }, // Impact Analyses
    { domainCode: 'CHANGE_MANAGEMENT', frameworkCode: 'NISTCSF', controlId: 'PR.IP-1', confidence: 100 }, // Configuration management
    { domainCode: 'CHANGE_MANAGEMENT', frameworkCode: 'NISTCSF', controlId: 'PR.IP-3', confidence: 100 }, // Configuration change control
    { domainCode: 'CHANGE_MANAGEMENT', frameworkCode: 'NISTCSF', controlId: 'DE.CM-8', confidence: 100 }, // Vulnerability scans
  ];

  let mappingCount = 0;
  for (const mapping of controlMappings) {
    const domainId = domainMap.get(mapping.domainCode);
    if (!domainId) {
      console.warn(`⚠️ Domain not found: ${mapping.domainCode}`);
      continue;
    }

    await prisma.controlDomainMapping.upsert({
      where: {
        controlDomainId_frameworkCode_controlId: {
          controlDomainId: domainId,
          frameworkCode: mapping.frameworkCode,
          controlId: mapping.controlId,
        },
      },
      update: { confidence: mapping.confidence, updatedAt: new Date() },
      create: {
        id: randomUUID(),
        controlDomainId: domainId,
        frameworkCode: mapping.frameworkCode,
        controlId: mapping.controlId,
        confidence: mapping.confidence,
        updatedAt: new Date(),
      },
    });
    mappingCount++;
  }
  console.log(`✅ Created ${mappingCount} control domain mappings\n`);

  // Story 4.2: Create Risk Templates (AC7-AC21)
  console.log('Creating risk templates...');

  const riskTemplates = [
    // Cloud Infrastructure Template (AC7-AC9)
    {
      id: '550e8400-e29b-41d4-a716-446655440201',
      name: 'Cloud Infrastructure Risk Assessment',
      category: RiskTemplateCategory.CLOUD_INFRASTRUCTURE,
      description: 'Template for documenting risks related to cloud infrastructure, IaaS/PaaS services, and cloud security configurations.',
      prePopulatedDomains: ['DATA_PROTECTION', 'ACCESS_CONTROL', 'ENCRYPTION'],
      severityDefault: 'MEDIUM' as const,
      evidenceGuidance: `### Evidence Collection Guidance

**IAM Policies and Permissions:**
- Export IAM policy JSON from cloud console
- Screenshot of role assignments
- Service principal permission lists

**Security Group / Firewall Configurations:**
- Export security group rules
- Network ACL configurations
- Screenshot of public-facing services

**Encryption Settings:**
- Storage encryption status (at-rest)
- Transit encryption configurations
- Key management service settings

**Logging and Monitoring:**
- CloudTrail/Activity Log configurations
- Log retention settings
- Alert rule configurations`,
      affectedSystemsGuidance: 'List specific cloud resources: VMs, storage accounts, databases, network segments, container registries, serverless functions',
    },
    // Access Control Template (AC10-AC12)
    {
      id: '550e8400-e29b-41d4-a716-446655440202',
      name: 'Access Control Risk Assessment',
      category: RiskTemplateCategory.ACCESS_CONTROL,
      description: 'Template for documenting risks related to identity management, access control policies, and privileged access management.',
      prePopulatedDomains: ['ACCESS_CONTROL', 'AUTHENTICATION', 'LOGGING_MONITORING'],
      severityDefault: 'HIGH' as const,
      evidenceGuidance: `### Evidence Collection Guidance

**User Provisioning Logs:**
- User creation/modification audit logs
- Role assignment history
- Access request tickets and approvals

**MFA Configurations:**
- MFA enrollment status report
- MFA policy configurations
- Exceptions and bypass lists

**Privileged Account Inventory:**
- List of admin/privileged accounts
- Service account inventory
- Emergency/break-glass account procedures

**Access Review Reports:**
- Periodic access review documentation
- Recertification campaign results
- Orphaned account reports`,
      affectedSystemsGuidance: 'List identity providers, directory services, SSO systems, PAM solutions, and applications with access control findings',
    },
    // Data Security Template (AC13-AC15)
    {
      id: '550e8400-e29b-41d4-a716-446655440203',
      name: 'Data Security Risk Assessment',
      category: RiskTemplateCategory.DATA_SECURITY,
      description: 'Template for documenting risks related to data protection, classification, encryption, and data loss prevention.',
      prePopulatedDomains: ['DATA_PROTECTION', 'ENCRYPTION', 'LOGGING_MONITORING'],
      severityDefault: 'HIGH' as const,
      evidenceGuidance: `### Evidence Collection Guidance

**Data Classification Policies:**
- Data classification policy document
- Data handling procedures
- Labeling and marking standards

**Encryption Configurations:**
- Encryption at-rest configurations
- TLS/SSL certificate inventory
- Key management procedures

**Data Loss Prevention Settings:**
- DLP policy configurations
- DLP alert reports
- Exception handling documentation

**Backup Verification:**
- Backup schedule and retention policies
- Backup testing/restore logs
- Offsite backup configurations`,
      affectedSystemsGuidance: 'List databases, file shares, data lakes, backup systems, and any systems handling sensitive data',
    },
    // Network Security Template (AC16-AC18)
    {
      id: '550e8400-e29b-41d4-a716-446655440204',
      name: 'Network Security Risk Assessment',
      category: RiskTemplateCategory.NETWORK_SECURITY,
      description: 'Template for documenting risks related to network security, perimeter protection, and network segmentation.',
      prePopulatedDomains: ['NETWORK_SECURITY', 'LOGGING_MONITORING', 'CHANGE_MANAGEMENT'],
      severityDefault: 'MEDIUM' as const,
      evidenceGuidance: `### Evidence Collection Guidance

**Firewall Rules:**
- Firewall rule exports
- Rule change audit logs
- Rule review documentation

**Network Diagrams:**
- Current network topology diagrams
- Network segmentation documentation
- DMZ configurations

**IDS/IPS Configurations:**
- IDS/IPS policy configurations
- Alert tuning documentation
- False positive management procedures

**Segmentation Documentation:**
- VLAN configurations
- Microsegmentation policies
- Zero-trust implementation status`,
      affectedSystemsGuidance: 'List network devices, firewalls, switches, routers, load balancers, and affected network segments',
    },
    // Application Security Template (AC19-AC21)
    {
      id: '550e8400-e29b-41d4-a716-446655440205',
      name: 'Application Security Risk Assessment',
      category: RiskTemplateCategory.APPLICATION_SECURITY,
      description: 'Template for documenting risks related to application security, secure development practices, and code security.',
      prePopulatedDomains: ['CHANGE_MANAGEMENT', 'ACCESS_CONTROL', 'LOGGING_MONITORING'],
      severityDefault: 'MEDIUM' as const,
      evidenceGuidance: `### Evidence Collection Guidance

**SAST/DAST Scan Results:**
- Static analysis scan reports
- Dynamic analysis scan reports
- Vulnerability trending data

**Dependency Scan Reports:**
- Software composition analysis results
- Vulnerable dependency lists
- Remediation tracking

**Security Code Review Findings:**
- Code review reports
- Security review checklists
- Remediation verification

**Penetration Test Reports:**
- Application penetration test reports
- Remediation status tracking
- Retest results`,
      affectedSystemsGuidance: 'List application names, versions, repositories, deployment environments, and associated APIs',
    },
  ];

  for (const template of riskTemplates) {
    // Create template for Org A
    await prisma.riskTemplate.upsert({
      where: { id: template.id },
      update: {},
      create: {
        id: template.id,
        name: template.name,
        category: template.category,
        description: template.description,
        prePopulatedDomains: template.prePopulatedDomains,
        severityDefault: template.severityDefault,
        evidenceGuidance: template.evidenceGuidance,
        affectedSystemsGuidance: template.affectedSystemsGuidance,
        organizationId: orgA.id,
      },
    });

    // Create template for Org B (different IDs)
    const orgBTemplateId = template.id.replace('440201', '440301')
      .replace('440202', '440302')
      .replace('440203', '440303')
      .replace('440204', '440304')
      .replace('440205', '440305');

    await prisma.riskTemplate.upsert({
      where: { id: orgBTemplateId },
      update: {},
      create: {
        id: orgBTemplateId,
        name: template.name,
        category: template.category,
        description: template.description,
        prePopulatedDomains: template.prePopulatedDomains,
        severityDefault: template.severityDefault,
        evidenceGuidance: template.evidenceGuidance,
        affectedSystemsGuidance: template.affectedSystemsGuidance,
        organizationId: orgB.id,
      },
    });
  }
  console.log(`✅ Created ${riskTemplates.length * 2} risk templates (${riskTemplates.length} per organization)\n`);

  // Create Audit Logs
  console.log('Creating audit log entries...');
  await prisma.auditLog.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440091' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440091',
      organizationId: orgA.id,
      action: 'UPLOAD_EVIDENCE',
      entityType: 'Evidence',
      entityId: evidenceA1.id,
      userId: userA2.id,
      changes: {
        title: evidenceA1.title,
        uploadedBy: userA2.name,
      },
    },
  });

  await prisma.auditLog.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440092' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440092',
      organizationId: orgB.id,
      action: 'UPDATE_RISK_STATUS',
      entityType: 'Risk',
      entityId: riskB2.id,
      userId: userB2.id,
      changes: {
        status: { from: 'OPEN', to: 'REMEDIATED' },
        updatedBy: userB2.name,
      },
    },
  });
  console.log('✅ Created audit log entries\n');

  // Seed Maturity Frameworks
  console.log('Creating Maturity Frameworks...');
  const nistCsfFrameworkId = await seedNistCsf2Framework(prisma);
  console.log(`  ✅ NIST CSF 2.0 Maturity Framework (${nistCsfFrameworkId})`);

  const c2m2FrameworkId = await seedC2m2Framework(prisma);
  console.log(`  ✅ C2M2 Maturity Framework (${c2m2FrameworkId})`);

  const owaspSammFrameworkId = await seedOwaspSammFramework(prisma);
  console.log(`  ✅ OWASP SAMM Maturity Framework (${owaspSammFrameworkId})\n`);

  // Seed baseline Enterprise Risks for both organizations
  console.log('Seeding Enterprise Risks...');
  const erA = await seedEnterpriseRisks(prisma, orgA.id);
  const erB = await seedEnterpriseRisks(prisma, orgB.id);
  console.log(`  ✅ Enterprise Risks: ${erA.count} (Org A), ${erB.count} (Org B)\n`);

  // Seed demo data for all features (BUs, People, Strategy, Findings, etc.)
  await seedDemoData(prisma);

  // Distinct demo dataset for Globex (Org B) so the two companies differ.
  await seedGlobexDemoData(prisma);

  // Multi-Tenancy Epic 1 (Story 1.2): give every seeded user a membership row
  // mirroring their org + role, so the company switcher works out of the box.
  const membershipBackfill = await backfillMemberships(prisma);
  console.log(`✅ Backfilled ${membershipBackfill.created} organization membership(s)\n`);

  // Durable fix: advance identifier counters past the seeded rows so the next
  // create (finding/risk/assessment) doesn't collide on a re-issued identifier.
  await syncIdentifierSequences(prisma);
  console.log('✅ Synced identifier sequences\n');

  console.log('🎉 Database seed completed successfully!\n');
  console.log('Summary:');
  console.log(`  - 2 Organizations (Acme Corp, Globex Inc)`);
  console.log(`  - 4 Users (2 per org)`);
  console.log(`  - 4 Evidence records (2 per org)`);
  console.log(`  - 4 Risk records (2 per org)`);
  console.log(`  - 4 Framework records (NIST CSF 2.0, NIST 800-53r5, NIST 800-171, ISO 27001:2022)`);
  console.log(`  - ${nist80053Result.familyCount + nist80053Result.controlCount + nist800171Result.familyCount + nist800171Result.controlCount + iso27001Controls.length + nistcsfControls.length} Control records (across all frameworks)`);
  console.log(`  - 12 Control domains (simplified taxonomy)`);
  console.log(`  - ${mappingCount} Control domain mappings (OSCAL translation engine)`);
  console.log(`  - ${riskTemplates.length * 2} Risk templates (5 per organization)`);
  console.log(`  - 2 Audit log entries`);
  console.log(`  - 3 Maturity Frameworks (NIST CSF 2.0, C2M2, OWASP SAMM)`);
  console.log(`  - 1 Default 3×3 Risk Matrix (published)`);
  console.log(`  - 1 Risk-Assessment Questionnaire Template (12 questions, 1 unresolved demo ref)`);
  console.log(`  - 2 Risk Assessment Projects (1 fully completed: 12/12 answered, engagement wrapper, 5 findings, 2 risks, exploitation pathway, 4 action plans)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
