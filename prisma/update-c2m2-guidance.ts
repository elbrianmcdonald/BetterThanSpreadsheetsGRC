/**
 * Script to update C2M2 practice guidance text to full length
 * Run with: npx tsx prisma/update-c2m2-guidance.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';
import { C2M2_PRACTICES } from "./seeds/c2m2";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Updating C2M2 guidance text...");

  // Find the C2M2 framework
  const framework = await prisma.maturityFramework.findFirst({
    where: {
      type: "C2M2",
      version: "2.1",
    },
  });

  if (!framework) {
    console.error("C2M2 framework not found!");
    return;
  }

  console.log(`Found framework: ${framework.name} (${framework.id})`);

  let updatedCount = 0;
  for (const practice of C2M2_PRACTICES) {
    const result = await prisma.maturityQuestion.updateMany({
      where: {
        frameworkId: framework.id,
        practiceCode: practice.code,
      },
      data: {
        guidanceText: practice.guidance || null,
      },
    });
    if (result.count > 0) {
      updatedCount++;
    }
  }

  console.log(`Updated ${updatedCount} practices with full guidance text`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
