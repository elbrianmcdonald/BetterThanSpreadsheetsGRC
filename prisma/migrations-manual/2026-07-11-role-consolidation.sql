-- Manual migration (Role Consolidation, Epics 1-3) — collapse the 8-value UserRole
-- model into 4, moving stored authority onto User.platformRole and encoding the
-- read-only Business User as OrganizationMembership *existence*.
--
-- WHY THIS IS A HAND-WRITTEN MIGRATION, NOT db push:
-- Runtime applies schema via `prisma db push --accept-data-loss` (docker-entrypoint.sh).
-- If the new code deployed first, db push would DROP User.role / User.isPlatformAdmin /
-- OrganizationMembership.role (and their data) BEFORE anything could read them, and it
-- cannot shrink an in-use enum. This script transforms a prod DB from the OLD shape to
-- the NEW shape in one transaction, so the subsequent db push sees "already in sync".
--
-- PRECONDITION: run against a database still at the pre-consolidation schema, i.e.
--   * UserRole enum = {ORG_ADMIN,GRC_MANAGER,GRC_ANALYST,SECURITY_ENGINEER,CISO,
--                      IT_STAKEHOLDER,BUSINESS_STAKEHOLDER,AUDITOR}
--   * User.role UserRole NOT NULL, User.isPlatformAdmin Boolean, no User.platformRole
--   * OrganizationMembership.role UserRole NOT NULL
-- ONE-SHOT: the `ALTER TYPE ... RENAME TO "UserRole_old"` is the guard — a re-run
-- fails and the BEGIN/COMMIT rolls the whole thing back, so it is safe to retry.
--
-- Authority mapping (docs/epics-role-consolidation.md, src/lib/auth/roles.ts LEGACY_ROLE_MAP):
--   ORG_ADMIN            -> ADMINISTRATOR   (staff)
--   GRC_MANAGER, CISO    -> MANAGER         (staff)
--   GRC_ANALYST, SECURITY_ENGINEER -> ANALYST (staff)
--   IT_STAKEHOLDER, BUSINESS_STAKEHOLDER, AUDITOR -> BUSINESS_USER (org-bound)
--   isPlatformAdmin = true -> ADMINISTRATOR (overrides role; the "one admin" decision)
--
-- Two axes after migration:
--   * Staff  (ANALYST/MANAGER/ADMINISTRATOR) -> stored on User.platformRole, all-org
--     reach, and hold NO membership.
--   * Business User -> platformRole NULL, org-bound via a (role-less) OrganizationMembership.
--
-- Run (local docker — DB name is mixed-case, pass it plain):
--   docker exec -i betterthanspreadsheetsGRC-postgres \
--     psql -U postgres -d betterthanspreadsheetsGRC \
--     < prisma/migrations-manual/2026-07-11-role-consolidation.sql
-- Production: pipe the same file to psql against the prod connection string, e.g.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations-manual/2026-07-11-role-consolidation.sql

BEGIN;

-- ── Step 1: the read-only Business User is derived from membership EXISTENCE; the
--    stored membership role is meaningless in the new model. Drop it first so it plays
--    no part in the enum swap and does not block the Step 4 backfill insert. ──
ALTER TABLE "OrganizationMembership" DROP COLUMN IF EXISTS "role";

-- ── Step 2: swap the UserRole enum 8 -> 4, converting the one column we still read
--    (User.role) so nothing references an old value when we DROP the old type. ──
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('ADMINISTRATOR', 'MANAGER', 'ANALYST', 'BUSINESS_USER');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole"
  USING (CASE "role"::text
    WHEN 'ORG_ADMIN'            THEN 'ADMINISTRATOR'
    WHEN 'GRC_MANAGER'          THEN 'MANAGER'
    WHEN 'CISO'                 THEN 'MANAGER'
    WHEN 'GRC_ANALYST'          THEN 'ANALYST'
    WHEN 'SECURITY_ENGINEER'    THEN 'ANALYST'
    WHEN 'IT_STAKEHOLDER'       THEN 'BUSINESS_USER'
    WHEN 'BUSINESS_STAKEHOLDER' THEN 'BUSINESS_USER'
    WHEN 'AUDITOR'              THEN 'BUSINESS_USER'
  END::"UserRole");

DROP TYPE "UserRole_old";

-- ── Step 3: add User.platformRole and populate staff authority from the (now 4-valued)
--    role, with isPlatformAdmin forcing ADMINISTRATOR. Business Users stay NULL. ──
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "platformRole" "UserRole";

UPDATE "User" SET "platformRole" =
  CASE
    WHEN "isPlatformAdmin" = true                        THEN 'ADMINISTRATOR'::"UserRole"
    WHEN "role" IN ('ADMINISTRATOR','MANAGER','ANALYST') THEN "role"
    ELSE NULL
  END;

-- ── Step 4: every Business User (platformRole IS NULL) needs a membership for their
--    home org. The multi-tenancy backfill usually created one already; fill any gaps. ──
INSERT INTO "OrganizationMembership" ("id", "userId", "organizationId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", u."organizationId", now(), now()
FROM "User" u
WHERE u."platformRole" IS NULL
ON CONFLICT ("userId", "organizationId") DO NOTHING;

-- ── Step 5: staff reach every org via platformRole and hold NO membership. Remove the
--    memberships the multi-tenancy backfill created for users who are now staff, so the
--    "staff == no membership" invariant holds (matches organization.updateMemberRole). ──
DELETE FROM "OrganizationMembership" m
USING "User" u
WHERE m."userId" = u."id" AND u."platformRole" IS NOT NULL;

-- ── Step 6: drop the legacy User columns — their information now lives in platformRole
--    (and, for Business Users, in membership existence). After this the DB matches the
--    new Prisma schema exactly, so the deploy's db push reports "already in sync". ──
ALTER TABLE "User" DROP COLUMN IF EXISTS "role";
ALTER TABLE "User" DROP COLUMN IF EXISTS "isPlatformAdmin";

COMMIT;
