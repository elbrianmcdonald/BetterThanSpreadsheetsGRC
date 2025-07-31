-- SQL script to update Risk table with new fields for enhanced Risk Register
-- Run this against your PostgreSQL database

DO $$
BEGIN
    -- Add LossScenario column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Risks' AND column_name = 'LossScenario') THEN
        ALTER TABLE "Risks" ADD COLUMN "LossScenario" integer NOT NULL DEFAULT 1;
        RAISE NOTICE 'Added LossScenario column to Risks table';
    END IF;

    -- Add CIATriad column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Risks' AND column_name = 'CIATriad') THEN
        ALTER TABLE "Risks" ADD COLUMN "CIATriad" integer NOT NULL DEFAULT 1;
        RAISE NOTICE 'Added CIATriad column to Risks table';
    END IF;

    -- Add Impact column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Risks' AND column_name = 'Impact') THEN
        ALTER TABLE "Risks" ADD COLUMN "Impact" integer NOT NULL DEFAULT 1;
        RAISE NOTICE 'Added Impact column to Risks table';
    END IF;

    -- Add Likelihood column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Risks' AND column_name = 'Likelihood') THEN
        ALTER TABLE "Risks" ADD COLUMN "Likelihood" integer NOT NULL DEFAULT 1;
        RAISE NOTICE 'Added Likelihood column to Risks table';
    END IF;

    -- Add Exposure column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Risks' AND column_name = 'Exposure') THEN
        ALTER TABLE "Risks" ADD COLUMN "Exposure" integer NOT NULL DEFAULT 1;
        RAISE NOTICE 'Added Exposure column to Risks table';
    END IF;

    -- Add InherentRiskLevel column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Risks' AND column_name = 'InherentRiskLevel') THEN
        ALTER TABLE "Risks" ADD COLUMN "InherentRiskLevel" integer NOT NULL DEFAULT 1;
        RAISE NOTICE 'Added InherentRiskLevel column to Risks table';
    END IF;

    -- Add ResidualRiskLevel column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Risks' AND column_name = 'ResidualRiskLevel') THEN
        ALTER TABLE "Risks" ADD COLUMN "ResidualRiskLevel" integer NOT NULL DEFAULT 1;
        RAISE NOTICE 'Added ResidualRiskLevel column to Risks table';
    END IF;

    -- Add TreatmentPlan column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Risks' AND column_name = 'TreatmentPlan') THEN
        ALTER TABLE "Risks" ADD COLUMN "TreatmentPlan" text DEFAULT '';
        RAISE NOTICE 'Added TreatmentPlan column to Risks table';
    END IF;

    -- Add RiskAssessmentReference column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Risks' AND column_name = 'RiskAssessmentReference') THEN
        ALTER TABLE "Risks" ADD COLUMN "RiskAssessmentReference" varchar(255) DEFAULT '';
        RAISE NOTICE 'Added RiskAssessmentReference column to Risks table';
    END IF;

    -- Update display name for existing columns by adding comments
    COMMENT ON COLUMN "Risks"."RiskNumber" IS 'Register ID';
    COMMENT ON COLUMN "Risks"."ThreatScenario" IS 'Threat Scenario';
    COMMENT ON COLUMN "Risks"."Description" IS 'Risk Statement';
    COMMENT ON COLUMN "Risks"."BusinessUnit" IS 'Organization';
    COMMENT ON COLUMN "Risks"."Owner" IS 'Risk Owner';
    COMMENT ON COLUMN "Risks"."Treatment" IS 'Risk Treatment';
    COMMENT ON COLUMN "Risks"."OpenDate" IS 'Date Opened';
    COMMENT ON COLUMN "Risks"."NextReviewDate" IS 'Last Reviewed';

    RAISE NOTICE 'Risk register fields update completed successfully!';

END $$;