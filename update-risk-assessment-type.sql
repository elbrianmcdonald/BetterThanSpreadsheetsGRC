-- SQL script to remove LossScenario and add AssessmentType to Risk table
-- Run this against your PostgreSQL database

DO $$
BEGIN
    -- Add AssessmentType column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Risks' AND column_name = 'AssessmentType') THEN
        ALTER TABLE "Risks" ADD COLUMN "AssessmentType" integer NOT NULL DEFAULT 1;
        RAISE NOTICE 'Added AssessmentType column to Risks table';
    END IF;

    -- Remove LossScenario column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Risks' AND column_name = 'LossScenario') THEN
        ALTER TABLE "Risks" DROP COLUMN "LossScenario";
        RAISE NOTICE 'Removed LossScenario column from Risks table';
    END IF;

    -- Add comment for AssessmentType column
    COMMENT ON COLUMN "Risks"."AssessmentType" IS 'Assessment Type (1=FAIR, 2=Qualitative)';

    RAISE NOTICE 'Risk assessment type update completed successfully!';

END $$;