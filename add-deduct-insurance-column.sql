-- Add DeductCybersecurityInsurance column to RiskAssessments table
-- This adds the checkbox for FAIR assessments to deduct cybersecurity insurance

-- Check if the column already exists before adding it
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'RiskAssessments' 
        AND column_name = 'DeductCybersecurityInsurance'
    ) THEN
        ALTER TABLE "RiskAssessments" 
        ADD COLUMN "DeductCybersecurityInsurance" boolean NOT NULL DEFAULT false;
        
        RAISE NOTICE 'DeductCybersecurityInsurance column added to RiskAssessments table';
    ELSE
        RAISE NOTICE 'DeductCybersecurityInsurance column already exists in RiskAssessments table';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'RiskAssessments' 
AND column_name = 'DeductCybersecurityInsurance';