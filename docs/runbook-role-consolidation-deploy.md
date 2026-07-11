# Deployment Runbook — Role Consolidation (8 → 4 roles)

The role-consolidation code (Epics 1–3, merged to `master` in `b6f87ab`) removes
`User.role`, `User.isPlatformAdmin`, and `OrganizationMembership.role`, adds
`User.platformRole`, and shrinks the `UserRole` enum from 8 values to 4.

The runtime applies schema with `prisma db push --accept-data-loss`
(`docker-entrypoint.sh`). **If you deploy the new image without first migrating the
data, db push drops the legacy role columns before anything reads them — every user's
authority is lost and staff/Business-User separation is gone.** The migration below
transforms the production database to the target shape *first*, so the deploy's
db push then reports "The database is already in sync with the Prisma schema."

Do this **once per environment that still has the old schema.** A freshly seeded
database (created from current `master`) is already on the new schema — skip it.

## What the migration does

`prisma/migrations-manual/2026-07-11-role-consolidation.sql` (single transaction):

1. Drops `OrganizationMembership.role` (Business User is now derived from membership *existence*).
2. Swaps the `UserRole` enum 8 → 4, mapping `User.role` values via the authority table below.
3. Adds `User.platformRole` and populates it for staff (`isPlatformAdmin=true` ⇒ ADMINISTRATOR; otherwise the mapped staff role; Business Users stay NULL).
4. Backfills a membership for any Business User missing one (idempotent, `ON CONFLICT DO NOTHING`).
5. Deletes memberships for staff (staff reach all orgs via `platformRole` and hold no membership).
6. Drops `User.role` and `User.isPlatformAdmin`.

Authority mapping (`src/lib/auth/roles.ts` `LEGACY_ROLE_MAP`):

| Legacy role | New | Axis |
|---|---|---|
| ORG_ADMIN | ADMINISTRATOR | staff (`platformRole`) |
| GRC_MANAGER, CISO | MANAGER | staff |
| GRC_ANALYST, SECURITY_ENGINEER | ANALYST | staff |
| IT_STAKEHOLDER, BUSINESS_STAKEHOLDER, AUDITOR | BUSINESS_USER | org-bound (membership) |
| *any role* + `isPlatformAdmin=true` | ADMINISTRATOR | staff (override) |

## Procedure

1. **Back up the database.** The migration drops columns — a backup is the rollback path.
   ```
   pg_dump "$DATABASE_URL" -Fc -f pre-role-consolidation.dump
   ```
2. **Stop the app** (or scale to 0) so the old image cannot write role data mid-migration.
3. **Run the migration** against the still-old-schema database. It is a single
   `BEGIN…COMMIT`; any error rolls the whole thing back (`-v ON_ERROR_STOP=1`).
   ```
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
     -f prisma/migrations-manual/2026-07-11-role-consolidation.sql
   ```
   Local docker (DB name is mixed-case — pass it plain):
   ```
   docker exec -i betterthanspreadsheetsGRC-postgres \
     psql -U postgres -d betterthanspreadsheetsGRC \
     < prisma/migrations-manual/2026-07-11-role-consolidation.sql
   ```
4. **Deploy the new image.** The entrypoint's `db push` should log *already in sync*
   (proof the hand-migration matches the schema). If it instead reports drops/alters,
   stop — the DB was not at the expected old shape; investigate before proceeding.
5. **Verify** (below), then bring the app back up.

## Verification

```sql
-- No user should be orphaned: every user is either staff (platformRole set) OR has a membership.
SELECT count(*) AS orphaned_users
FROM "User" u
WHERE u."platformRole" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "OrganizationMembership" m WHERE m."userId" = u.id);
-- expect 0

-- Staff hold no membership (invariant).
SELECT count(*) AS staff_with_membership
FROM "User" u JOIN "OrganizationMembership" m ON m."userId" = u.id
WHERE u."platformRole" IS NOT NULL;
-- expect 0

-- Enum is the four new values; legacy columns are gone.
SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder)
FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'UserRole';
-- expect: ADMINISTRATOR,MANAGER,ANALYST,BUSINESS_USER
```

Spot-check that a known admin can still administer and a known Business User is read-only.

## Rollback

Restore the pre-migration dump from step 1 and redeploy the previous image. There is no
forward "undo" — the legacy columns are dropped, so the backup is the only way back.

## Validation performed

This script was run against a synthetic pre-consolidation fixture (one user per legacy
role + an `isPlatformAdmin`-override case + pre-existing memberships) in a scratch
database: all nine users mapped exactly as specified, staff memberships were removed,
Business-User memberships preserved, and a re-run failed and rolled back cleanly with
data intact (the `ALTER TYPE … RENAME` is the one-shot guard).
