/**
 * Seed Maturity Frameworks
 *
 * This script seeds maturity framework data (NIST CSF 2.0, C2M2).
 * Can be run independently of the main seed.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedNistCsf2Framework } from './seeds/nist-csf-2';
import { seedC2m2Framework } from './seeds/c2m2';
import { seedOwaspSammFramework } from './seeds/owasp-samm';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding Maturity Frameworks...\n');

  // Seed NIST CSF 2.0
  const nistCsfId = await seedNistCsf2Framework(prisma);
  console.log(`✅ NIST CSF 2.0 Framework seeded (${nistCsfId})\n`);

  // Seed C2M2
  const c2m2Id = await seedC2m2Framework(prisma);
  console.log(`✅ C2M2 Framework seeded (${c2m2Id})\n`);

  // Seed OWASP SAMM
  const sammId = await seedOwaspSammFramework(prisma);
  console.log(`✅ OWASP SAMM Framework seeded (${sammId})\n`);

  console.log('🎉 Maturity framework seeding completed!\n');
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
