-- Add new columns to RiskAcceptanceRequests table for enhanced workflow
-- These columns support the 2-step GRC analysis process

-- Step 1: Check if columns already exist to avoid errors
DO $$ 
BEGIN
    -- Add RiskSummary column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'RiskSummary') THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD COLUMN "RiskSummary" character varying(2000) NOT NULL DEFAULT '';
    END IF;
    
    -- Add CurrentCompensatingControls column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'CurrentCompensatingControls') THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD COLUMN "CurrentCompensatingControls" character varying(1000) NOT NULL DEFAULT '';
    END IF;
    
    -- Add CurrentRiskLevelWithControls column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'CurrentRiskLevelWithControls') THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD COLUMN "CurrentRiskLevelWithControls" integer;
    END IF;
    
    -- Add TreatmentPlan column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'TreatmentPlan') THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD COLUMN "TreatmentPlan" character varying(2000) NOT NULL DEFAULT '';
    END IF;
    
    -- Add ProposedCompensatingControls column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'ProposedCompensatingControls') THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD COLUMN "ProposedCompensatingControls" character varying(1000) NOT NULL DEFAULT '';
    END IF;
    
    -- Add FutureRiskLevelWithMitigations column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'FutureRiskLevelWithMitigations') THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD COLUMN "FutureRiskLevelWithMitigations" integer;
    END IF;
    
    -- Add CISORecommendation column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'CISORecommendation') THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD COLUMN "CISORecommendation" character varying(2000) NOT NULL DEFAULT '';
    END IF;
    
    -- Rename Justification to BusinessNeed if it exists and BusinessNeed doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'Justification') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'BusinessNeed') THEN
        ALTER TABLE "RiskAcceptanceRequests" RENAME COLUMN "Justification" TO "BusinessNeed";
    END IF;
    
    -- Drop CurrentInherentRiskRating column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'CurrentInherentRiskRating') THEN
        ALTER TABLE "RiskAcceptanceRequests" DROP COLUMN "CurrentInherentRiskRating";
    END IF;
    
    -- Drop FutureResidualRisk column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'FutureResidualRisk') THEN
        ALTER TABLE "RiskAcceptanceRequests" DROP COLUMN "FutureResidualRisk";
    END IF;
    
    -- Add RiskId column for linking to Risk Register
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'RiskId') THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD COLUMN "RiskId" integer;
    END IF;
    
    -- Add foreign key constraint for RiskId
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_table_usage WHERE table_name = 'RiskAcceptanceRequests' AND constraint_name = 'FK_RiskAcceptanceRequests_Risks_RiskId') THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD CONSTRAINT "FK_RiskAcceptanceRequests_Risks_RiskId" 
        FOREIGN KEY ("RiskId") REFERENCES "Risks" ("Id") ON DELETE SET NULL;
    END IF;
    
END $$;

-- Verify the columns were added
SELECT column_name, data_type, character_maximum_length, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'RiskAcceptanceRequests' 
ORDER BY ordinal_position;