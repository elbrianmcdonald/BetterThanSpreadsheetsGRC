/**
 * Organization Service
 *
 * Handles organization assignment logic for user authentication.
 * Assigns users to organizations based on their email domain.
 * Story 7.8.4: Seeds default assessment type and risk matrix for new organizations.
 */

import { randomUUID } from "crypto";
import { type PrismaClient } from "@prisma/client";
import { seedOrganizationDefaults } from "@/lib/matrix/seedDefaults";

/**
 * Get or Create Organization from Email
 *
 * Extracts the domain from the user's email and assigns them to the corresponding organization.
 * If the organization doesn't exist, it creates a new one automatically.
 *
 * @param email - User's email address (e.g., "user@company.com")
 * @param db - Prisma client instance
 * @returns Organization ID for the user
 * @throws Error if email format is invalid
 *
 * @example
 * const orgId = await getOrCreateOrganizationFromEmail("john@acme.com", db);
 * // Returns the organization ID for "acme.com" domain
 */
export async function getOrCreateOrganizationFromEmail(
  email: string,
  db: PrismaClient
): Promise<string> {
  // Extract domain from email
  const domain = email.split("@")[1];

  if (!domain) {
    throw new Error(`Invalid email format: ${email}`);
  }

  // Generate slug from domain (lowercase, replace dots with hyphens)
  const slug = domain.toLowerCase().replace(/\./g, "-");

  // Find existing organization by slug (domain)
  let organization = await db.organization.findUnique({
    where: { slug: slug },
  });

  // Auto-create organization if doesn't exist
  if (!organization) {
    organization = await db.organization.create({
      data: {
        id: randomUUID(),
        name: domain, // Use domain as organization name
        slug: slug,   // Use slug for unique domain matching
        active: true,
        updatedAt: new Date(),
      },
    });

    console.log(`[AUTH] Created new organization: ${domain} (ID: ${organization.id}, slug: ${slug})`);

    // Story 7.8.4 AC3: Seed default assessment type and risk matrix for new organizations
    try {
      const seedResult = await seedOrganizationDefaults(db, organization.id);
      if (seedResult.success) {
        console.log(`[AUTH] Seeded defaults for organization: ${domain}`);
      } else {
        console.error(`[AUTH] Failed to seed defaults for organization: ${domain}`, seedResult.error);
        // Note: We don't fail the org creation if seeding fails - org can be used without defaults
      }
    } catch (seedError) {
      console.error(`[AUTH] Error seeding defaults for organization: ${domain}`, seedError);
      // Non-fatal: organization is still created and usable
    }
  }

  return organization.id;
}
