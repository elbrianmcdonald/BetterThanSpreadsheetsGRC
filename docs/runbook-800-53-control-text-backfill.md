# Deployment Runbook — NIST SP 800-53 control text backfill

The 800-53 seed came from NIST's CPRT **baselines** workbook, which carries no
control text: every control's `description` was a verbatim copy of its own title
and its `guidance` was `NULL`. The branch that fixed this imports the real
statement and Discussion from NIST's official OSCAL catalog for all 1,216
controls (20 families + 324 base controls + 872 enhancements).

**Deploying the new image alone changes nothing on an existing database.** The
seed is guarded by a control count (`prisma/seed.ts`: `if (existing80053 === 0)`),
so an environment that already has the 800-53 controls will not be re-seeded — by
design, because re-seeding would have to delete controls, and
`ControlAssessmentScore.control` is `onDelete: Cascade` (every live control score
would go with them).

`prisma/migrations-manual/2026-07-13-backfill-800-53-control-text.sql` is
therefore the **only** path by which an existing database gets the real text.
Run it once per environment. A freshly seeded database (created from current
`master`) already has the text — skip it there.

## ⚠ One-way door

The script `UPDATE`s in place, matched on (`Framework.code = 'NIST80053'`,
`Control.controlId`), for **every organization's** copy of the framework. For each
800-53 control it:

- **overwrites `description`** with NIST's statement, and
- **overwrites `guidance`** with NIST's Discussion — which is `NULL` for the 202
  controls NIST gives no Discussion for.

If an org hand-edited the description or guidance of an 800-53 control, **those
edits are destroyed and there is no undo.** The pre-run backup is the only way
back. (Org-authored `testInstructions` and `acceptanceCriteria` are *not* touched;
neither is any control score, finding, or mapping.)

## Procedure

1. **Back up the database.** This is the rollback path.
   ```
   pg_dump "$DATABASE_URL" -Fc -f pre-800-53-text-backfill.dump
   ```
2. **Run the script.** It is a single `BEGIN…COMMIT`; any error rolls the whole
   thing back.
   ```
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
     -f prisma/migrations-manual/2026-07-13-backfill-800-53-control-text.sql
   ```
   Local docker (the DB name is mixed-case — pass it plain):
   ```
   docker compose exec -T postgres \
     psql -U postgres -d betterthanspreadsheetsGRC -v ON_ERROR_STOP=1 \
     < prisma/migrations-manual/2026-07-13-backfill-800-53-control-text.sql
   ```
   The script sets `client_encoding = 'UTF8'` itself: NIST's prose carries
   typographic apostrophes and em-dashes, which a cp1252 console would mojibake.

   On a database with **no** 800-53 framework the script is a no-op and prints
   `NOTICE: No NIST 800-53 framework in this database — nothing to backfill.`
   That is not an error. It only raises if the framework **is** present and no
   row was updated — which would mean the control-id mapping is broken.

3. **Verify** (below). No app restart is needed: the text is read per request.

## Verification

```sql
-- 1,216 controls, 1,014 of them with a Discussion.
SELECT count(*) AS controls,
       count(c."guidance") AS with_guidance
FROM "Control" c JOIN "Framework" f ON f.id = c."frameworkId"
WHERE f.code = 'NIST80053';
-- expect: controls = 1216, with_guidance = 1014

-- No description is still a copy of its own title (the bug this fixes).
SELECT count(*) AS description_equals_title
FROM "Control" c JOIN "Framework" f ON f.id = c."frameworkId"
WHERE f.code = 'NIST80053' AND c."description" = c."title" AND c."controlId" LIKE '%-%';
-- expect 0

-- Control scores are untouched.
SELECT count(*) FROM "ControlAssessmentScore" s
JOIN "Control" c ON c.id = s."controlId"
JOIN "Framework" f ON f.id = c."frameworkId"
WHERE f.code = 'NIST80053';
-- expect: unchanged from before the run (1503 in the demo dataset)
```

Then open a NIST 800-53 compliance assessment → Controls tab → any control's
**Control Details**: it must show NIST's lettered statement (a., b., c. …) on
separate lines, and **Guidance** must show the Discussion.

## Regenerating the script

Do not hand-edit the SQL. It is generated:

```
python scripts/extract-800-53-oscal.py <path-to-NIST_SP-800-53_rev5_catalog.json>
```

which rewrites both `prisma/seeds/data/nist-800-53-r5-text.json` (seed input for a
fresh database) and the migrations-manual SQL (existing databases). Change the
generator, then regenerate.

## Rollback

Restore the dump from step 1. There is no forward undo — the previous
`description` values are overwritten in place.
