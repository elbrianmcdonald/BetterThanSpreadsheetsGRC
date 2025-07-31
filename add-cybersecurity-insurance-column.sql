-- Add CybersecurityInsuranceAmount column to RiskLevelSettings table
-- This adds the cybersecurity insurance amount for FAIR assessment deductions

-- Check if the column already exists before adding it
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'RiskLevelSettings' 
        AND column_name = 'CybersecurityInsuranceAmount'
    ) THEN
        ALTER TABLE "RiskLevelSettings" 
        ADD COLUMN "CybersecurityInsuranceAmount" numeric(18,2) NOT NULL DEFAULT 0.0;
        
        RAISE NOTICE 'CybersecurityInsuranceAmount column added to RiskLevelSettings table';
    ELSE
        RAISE NOTICE 'CybersecurityInsuranceAmount column already exists in RiskLevelSettings table';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    numeric_precision,
    numeric_scale,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'RiskLevelSettings' 
AND column_name = 'CybersecurityInsuranceAmount';