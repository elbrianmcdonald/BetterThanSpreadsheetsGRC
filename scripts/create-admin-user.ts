/**
 * Create Admin User Script
 *
 * Creates a test admin user with known credentials for local development.
 *
 * Usage: npx tsx scripts/create-admin-user.ts
 */

import { db } from '../src/server/db';
import { hashPassword } from '../src/server/services/auth/passwordService';

async function createAdminUser() {
  try {
    console.log('[CREATE-ADMIN] Starting admin user creation...');

    // Create or get test organization
    let org = await db.organization.findUnique({
      where: { slug: 'test-org' },
    });

    if (!org) {
      console.log('[CREATE-ADMIN] Creating test organization...');
      const { randomUUID } = await import('crypto');
      org = await db.organization.create({
        data: {
          id: randomUUID(),
          name: 'Test Organization',
          slug: 'test-org',
          active: true,
          updatedAt: new Date(),
        },
      });
      console.log(`[CREATE-ADMIN] Created organization: ${org.name} (${org.id})`);
    } else {
      console.log(`[CREATE-ADMIN] Using existing organization: ${org.name} (${org.id})`);
    }

    // Check if admin user already exists
    const existingAdmin = await db.user.findUnique({
      where: { email: 'admin@test.com' },
    });

    if (existingAdmin) {
      console.log('[CREATE-ADMIN] Admin user already exists: admin@test.com');
      console.log('[CREATE-ADMIN] Password: AdminTest123!');
      return;
    }

    // Create admin user with known password
    const testPassword = 'AdminTest123!';
    const hashedPassword = await hashPassword(testPassword);

    const { randomUUID } = await import('crypto');
    const adminUser = await db.user.create({
      data: {
        id: randomUUID(),
        name: 'Test Admin',
        email: 'admin@test.com',
        platformRole: 'ADMINISTRATOR',
        hashedPassword,
        organizationId: org.id,
        updatedAt: new Date(),
      },
    });

    console.log('[CREATE-ADMIN] ✅ Admin user created successfully!');
    console.log(`[CREATE-ADMIN] Email: ${adminUser.email}`);
    console.log(`[CREATE-ADMIN] Password: ${testPassword}`);
    console.log(`[CREATE-ADMIN] Role: ${adminUser.platformRole}`);
    console.log(`[CREATE-ADMIN] Organization: ${org.name}`);
    console.log('\n[CREATE-ADMIN] You can now sign in at http://localhost:3000/login');
  } catch (error) {
    console.error('[CREATE-ADMIN] Error creating admin user:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// Run if executed directly
import { fileURLToPath } from 'url';

const isMainModule = process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  createAdminUser()
    .then(() => {
      console.log('[CREATE-ADMIN] Setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[CREATE-ADMIN] Setup failed:', error);
      process.exit(1);
    });
}
