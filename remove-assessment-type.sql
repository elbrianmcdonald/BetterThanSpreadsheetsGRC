-- SQL script to remove AssessmentType from Risk table
-- Run this against your PostgreSQL database

DO $$
BEGIN
    -- Remove AssessmentType column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Risks' AND column_name = 'AssessmentType') THEN
        ALTER TABLE "Risks" DROP COLUMN "AssessmentType";
        RAISE NOTICE 'Removed AssessmentType column from Risks table';
    END IF;

    RAISE NOTICE 'Assessment type removal completed successfully!';

END $$;