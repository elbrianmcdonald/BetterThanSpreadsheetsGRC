-- Add RiskAppetiteThreshold column to RiskLevelSettings table
-- This adds the risk appetite threshold field for CISO dashboard

-- Check if the column already exists before adding it
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'RiskLevelSettings' 
        AND column_name = 'RiskAppetiteThreshold'
    ) THEN
        ALTER TABLE "RiskLevelSettings" 
        ADD COLUMN "RiskAppetiteThreshold" numeric(5,2) NOT NULL DEFAULT 6.0;
        
        RAISE NOTICE 'RiskAppetiteThreshold column added to RiskLevelSettings table';
    ELSE
        RAISE NOTICE 'RiskAppetiteThreshold column already exists in RiskLevelSettings table';
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
AND column_name = 'RiskAppetiteThreshold';