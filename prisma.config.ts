import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';
export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    // Enables `prisma db seed` (and equivalents) to invoke our seed script
    // directly. Mirrors the package.json `db:seed` script.
    seed: 'tsx prisma/seed.ts',
  },
});