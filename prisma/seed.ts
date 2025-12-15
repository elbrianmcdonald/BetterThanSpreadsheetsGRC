import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

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
      role: 'ORG_ADMIN',
      organizationId: orgA.id,
      emailVerified: new Date(),
    },
  });

  const userA2 = await prisma.user.upsert({
    where: { email: 'analyst@acme-corp.com' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440012',
      email: 'analyst@acme-corp.com',
      name: 'Bob Analyst',
      role: 'GRC_ANALYST',
      organizationId: orgA.id,
      emailVerified: new Date(),
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
      role: 'ORG_ADMIN',
      organizationId: orgB.id,
      emailVerified: new Date(),
    },
  });

  const userB2 = await prisma.user.upsert({
    where: { email: 'engineer@globex-inc.com' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440022',
      email: 'engineer@globex-inc.com',
      name: 'David Engineer',
      role: 'SECURITY_ENGINEER',
      organizationId: orgB.id,
      emailVerified: new Date(),
    },
  });
  console.log(`✅ Created ${userB1.name} and ${userB2.name}\n`);

  // Create Evidence records for Organization A
  console.log('Creating evidence records for Organization A...');
  const evidenceA1 = await prisma.evidence.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440031',
      organizationId: orgA.id,
      title: 'SOC 2 Audit Report 2024',
      description: 'Annual SOC 2 Type II audit report',
      filePath: '/uploads/acme-corp/soc2-2024.pdf',
      fileSize: 2548736,
      fileType: 'application/pdf',
      uploadedBy: userA2.id,
    },
  });

  const evidenceA2 = await prisma.evidence.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440032',
      organizationId: orgA.id,
      title: 'Penetration Test Results',
      description: 'Q4 2024 penetration testing report',
      filePath: '/uploads/acme-corp/pentest-q4.pdf',
      fileSize: 1024000,
      fileType: 'application/pdf',
      uploadedBy: userA2.id,
    },
  });
  console.log(`✅ Created ${evidenceA1.title} and ${evidenceA2.title}\n`);

  // Create Evidence records for Organization B
  console.log('Creating evidence records for Organization B...');
  const evidenceB1 = await prisma.evidence.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440041',
      organizationId: orgB.id,
      title: 'ISO 27001 Certificate',
      description: 'Current ISO 27001:2013 certification',
      filePath: '/uploads/globex-inc/iso27001-cert.pdf',
      fileSize: 512000,
      fileType: 'application/pdf',
      uploadedBy: userB2.id,
    },
  });

  const evidenceB2 = await prisma.evidence.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440042',
      organizationId: orgB.id,
      title: 'Incident Response Plan',
      description: 'Updated incident response procedures',
      filePath: '/uploads/globex-inc/ir-plan.docx',
      fileSize: 256000,
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      uploadedBy: userB2.id,
    },
  });
  console.log(`✅ Created ${evidenceB1.title} and ${evidenceB2.title}\n`);

  // Create Risk records for Organization A
  console.log('Creating risk records for Organization A...');
  const riskA1 = await prisma.risk.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440051',
      organizationId: orgA.id,
      title: 'Unpatched SQL Server 2019',
      description: 'Production SQL Server missing critical security patches',
      severity: 'HIGH',
      status: 'OPEN',
    },
  });

  const riskA2 = await prisma.risk.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440052',
      organizationId: orgA.id,
      title: 'Missing MFA on Admin Accounts',
      description: 'Administrative accounts do not have MFA enabled',
      severity: 'MEDIUM',
      status: 'OPEN',
    },
  });
  console.log(`✅ Created ${riskA1.title} and ${riskA2.title}\n`);

  // Create Risk records for Organization B
  console.log('Creating risk records for Organization B...');
  const riskB1 = await prisma.risk.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440061',
      organizationId: orgB.id,
      title: 'Weak Password Policy',
      description: 'Password complexity requirements do not meet NIST standards',
      severity: 'MEDIUM',
      status: 'OPEN',
    },
  });

  const riskB2 = await prisma.risk.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440062',
      organizationId: orgB.id,
      title: 'Unsegmented Network',
      description: 'Flat network architecture increases blast radius',
      severity: 'HIGH',
      status: 'REMEDIATED',
    },
  });
  console.log(`✅ Created ${riskB1.title} and ${riskB2.title}\n`);

  // Create Framework records
  console.log('Creating framework records...');
  const frameworkA = await prisma.framework.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440071',
      organizationId: orgA.id,
      name: 'SOC 2 Type II',
      identifier: 'SOC2',
      version: '2017',
      isActive: true,
      activatedAt: new Date('2024-01-01'),
    },
  });

  const frameworkB = await prisma.framework.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440081',
      organizationId: orgB.id,
      name: 'ISO/IEC 27001',
      identifier: 'ISO27001',
      version: '2013',
      isActive: true,
      activatedAt: new Date('2024-03-15'),
    },
  });
  console.log(`✅ Created ${frameworkA.name} for Org A and ${frameworkB.name} for Org B\n`);

  // Create Audit Logs
  console.log('Creating audit log entries...');
  await prisma.auditLog.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440091',
      organizationId: orgA.id,
      action: 'CREATE',
      entityType: 'Evidence',
      entityId: evidenceA1.id,
      userId: userA2.id,
      changes: {
        title: evidenceA1.title,
        uploadedBy: userA2.name,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440092',
      organizationId: orgB.id,
      action: 'UPDATE',
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

  console.log('🎉 Database seed completed successfully!\n');
  console.log('Summary:');
  console.log(`  - 2 Organizations (Acme Corp, Globex Inc)`);
  console.log(`  - 4 Users (2 per org)`);
  console.log(`  - 4 Evidence records (2 per org)`);
  console.log(`  - 4 Risk records (2 per org)`);
  console.log(`  - 2 Framework records (1 per org)`);
  console.log(`  - 2 Audit log entries`);
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
