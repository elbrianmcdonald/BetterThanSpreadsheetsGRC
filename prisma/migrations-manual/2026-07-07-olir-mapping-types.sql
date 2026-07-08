-- Manual migration (Story 25.1) — expand mapping-type enums to NIST OLIR semantics.
--
-- Runtime applies schema via `prisma db push`, which CANNOT drop enum values that
-- existing rows/defaults still reference. This transactional enum-swap does the value
-- rename + data transform in one shot, so a subsequent `db push` sees the schema as
-- "in sync" and does not try to re-alter the enum.
--
-- Value migration: COVERS→EQUIVALENT, EXCEEDS→SUPERSET_OF, PARTIAL→INTERSECTS.
-- One-shot: the RENAME TO "..._old" is the guard — re-running errors because "_old" exists.
--
-- Run:
--   docker exec -i betterthanspreadsheetsGRC-postgres \
--     psql -U postgres -d betterthanspreadsheetsGRC \
--     < prisma/migrations-manual/2026-07-07-olir-mapping-types.sql

BEGIN;

-- ===== StandardMappingType (OrgControlFrameworkMapping + StandardControlMapping) =====
ALTER TYPE "StandardMappingType" RENAME TO "StandardMappingType_old";
CREATE TYPE "StandardMappingType" AS ENUM ('EQUIVALENT', 'SUBSET_OF', 'SUPERSET_OF', 'INTERSECTS');

ALTER TABLE "OrgControlFrameworkMapping" ALTER COLUMN "mappingType" DROP DEFAULT;
ALTER TABLE "StandardControlMapping"     ALTER COLUMN "mappingType" DROP DEFAULT;

ALTER TABLE "OrgControlFrameworkMapping"
  ALTER COLUMN "mappingType" TYPE "StandardMappingType"
  USING (CASE "mappingType"::text
    WHEN 'COVERS'  THEN 'EQUIVALENT'
    WHEN 'EXCEEDS' THEN 'SUPERSET_OF'
    WHEN 'PARTIAL' THEN 'INTERSECTS'
  END::"StandardMappingType");

ALTER TABLE "StandardControlMapping"
  ALTER COLUMN "mappingType" TYPE "StandardMappingType"
  USING (CASE "mappingType"::text
    WHEN 'COVERS'  THEN 'EQUIVALENT'
    WHEN 'EXCEEDS' THEN 'SUPERSET_OF'
    WHEN 'PARTIAL' THEN 'INTERSECTS'
  END::"StandardMappingType");

ALTER TABLE "OrgControlFrameworkMapping" ALTER COLUMN "mappingType" SET DEFAULT 'EQUIVALENT';
ALTER TABLE "StandardControlMapping"     ALTER COLUMN "mappingType" SET DEFAULT 'EQUIVALENT';
DROP TYPE "StandardMappingType_old";

-- ===== FrameworkMappingType (FrameworkControlMapping) =====
ALTER TYPE "FrameworkMappingType" RENAME TO "FrameworkMappingType_old";
CREATE TYPE "FrameworkMappingType" AS ENUM ('EQUIVALENT', 'SUBSET_OF', 'SUPERSET_OF', 'INTERSECTS');

ALTER TABLE "FrameworkControlMapping" ALTER COLUMN "mappingType" DROP DEFAULT;
ALTER TABLE "FrameworkControlMapping"
  ALTER COLUMN "mappingType" TYPE "FrameworkMappingType"
  USING (CASE "mappingType"::text
    WHEN 'COVERS'  THEN 'EQUIVALENT'
    WHEN 'EXCEEDS' THEN 'SUPERSET_OF'
    WHEN 'PARTIAL' THEN 'INTERSECTS'
  END::"FrameworkMappingType");
ALTER TABLE "FrameworkControlMapping" ALTER COLUMN "mappingType" SET DEFAULT 'EQUIVALENT';
DROP TYPE "FrameworkMappingType_old";

COMMIT;
