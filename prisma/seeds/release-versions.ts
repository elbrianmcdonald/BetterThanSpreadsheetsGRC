import type { PrismaClient } from '@prisma/client';

export const RELEASE_VERSION_BASELINES: Array<{
  version: string;
  title?: string;
  notes: string;
}> = [
  {
    version: '1.0',
    title: 'Initial Release',
    notes: '## 1.0\n\nFirst tracked release. Subsequent versions appear here as the platform evolves.',
  },
];

export async function seedReleaseVersions(prisma: PrismaClient): Promise<{ count: number }> {
  for (const entry of RELEASE_VERSION_BASELINES) {
    await prisma.releaseVersion.upsert({
      where: { version: entry.version },
      update: {},
      create: {
        version: entry.version,
        title: entry.title ?? null,
        notes: entry.notes,
      },
    });
  }
  return { count: RELEASE_VERSION_BASELINES.length };
}
