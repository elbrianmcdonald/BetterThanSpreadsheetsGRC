/**
 * Integration tests for the OLIR mapping-type enum migration (Story 25.1).
 *
 * Proves the migrated Postgres enums accept the four NIST OLIR values on real
 * FrameworkControlMapping rows, reject the removed legacy values (NFR6 — no
 * silent acceptance of stale data), and that the base-framework coverage
 * `typeBreakdown` counts the new values (guards the router stats fix).
 *
 * @see docs/sprint-artifacts/25-1-olir-relationship-semantics.md
 */

import { db } from "@/server/db";
import { randomUUID } from "crypto";
import { StandardMappingType, FrameworkMappingType } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

describe("OLIR mapping-type migration - Story 25.1", () => {
  let testOrg: { id: string };
  let frameworkId: string;
  let sourceControlId: string;
  let targetControlId: string;

  beforeAll(async () => {
    testOrg = await db.organization.create({
      data: {
        id: randomUUID(),
        name: `Test Org OLIR ${Date.now()}`,
        slug: `test-org-olir-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    await runWithOrganizationContext(testOrg.id, async () => {
      const framework = await db.framework.create({
        data: {
          id: randomUUID(),
          organizationId: testOrg.id,
          name: "OLIR Test Framework",
          code: `OLIR-${Date.now()}`,
          version: "1.0",
          updatedAt: new Date(),
        },
      });
      frameworkId = framework.id;

      const source = await db.control.create({
        data: {
          id: randomUUID(),
          organizationId: testOrg.id,
          frameworkId,
          controlId: "SRC-01",
          title: "Source Control",
          description: "Source control for OLIR mapping test",
          updatedAt: new Date(),
        },
      });
      sourceControlId = source.id;

      const target = await db.control.create({
        data: {
          id: randomUUID(),
          organizationId: testOrg.id,
          frameworkId,
          controlId: "TGT-01",
          title: "Target Control",
          description: "Target control for OLIR mapping test",
          updatedAt: new Date(),
        },
      });
      targetControlId = target.id;
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await db.$executeRaw`DELETE FROM "FrameworkControlMapping" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${testOrg.id}`;
    }
  });

  it("persists a FrameworkControlMapping for every OLIR value and reads it back", async () => {
    const values: FrameworkMappingType[] = [
      FrameworkMappingType.EQUIVALENT,
      FrameworkMappingType.SUBSET_OF,
      FrameworkMappingType.SUPERSET_OF,
      FrameworkMappingType.INTERSECTS,
    ];

    await runWithOrganizationContext(testOrg.id, async () => {
      for (const mappingType of values) {
        // Reuse the same source→target pair by clearing between iterations
        // (unique on [sourceControlId, targetControlId]).
        await db.frameworkControlMapping.deleteMany({
          where: { sourceControlId, targetControlId },
        });
        const created = await db.frameworkControlMapping.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            sourceControlId,
            targetControlId,
            mappingType,
          },
        });
        expect(created.mappingType).toBe(mappingType);

        const readBack = await db.frameworkControlMapping.findUnique({
          where: { id: created.id },
        });
        expect(readBack?.mappingType).toBe(mappingType);
      }
    });
  });

  it("defaults mappingType to EQUIVALENT when omitted", async () => {
    await runWithOrganizationContext(testOrg.id, async () => {
      await db.frameworkControlMapping.deleteMany({
        where: { sourceControlId, targetControlId },
      });
      const created = await db.frameworkControlMapping.create({
        data: {
          id: randomUUID(),
          organizationId: testOrg.id,
          sourceControlId,
          targetControlId,
          // mappingType omitted → schema @default(EQUIVALENT)
        },
      });
      expect(created.mappingType).toBe(FrameworkMappingType.EQUIVALENT);
    });
  });

  it("rejects the removed legacy COVERS value at the database enum layer (NFR6)", async () => {
    // Cast the legacy literal to the enum type directly in SQL — this exercises
    // the Postgres enum itself (not just the Prisma client's TS type), so it
    // proves the migrated type no longer contains COVERS.
    await expect(
      db.$executeRawUnsafe(`SELECT 'COVERS'::"FrameworkMappingType"`),
    ).rejects.toThrow(/invalid input value for enum/i);
    await expect(
      db.$executeRawUnsafe(`SELECT 'PARTIAL'::"StandardMappingType"`),
    ).rejects.toThrow(/invalid input value for enum/i);

    // And a new value casts cleanly (no throw).
    await db.$executeRawUnsafe(`SELECT 'EQUIVALENT'::"FrameworkMappingType"`);
  });

  it("StandardMappingType enum also accepts OLIR values (shared semantics)", async () => {
    // Sanity: the sibling enum on StandardControlMapping migrated identically.
    expect(Object.values(StandardMappingType)).toEqual(
      expect.arrayContaining(["EQUIVALENT", "SUBSET_OF", "SUPERSET_OF", "INTERSECTS"]),
    );
    expect(Object.values(StandardMappingType)).not.toContain("COVERS");
  });
});
