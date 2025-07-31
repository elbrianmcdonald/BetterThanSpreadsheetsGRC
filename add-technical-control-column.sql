-- Add TechnicalControl column to Findings table
-- This adds the missing column that causes the dashboard error

-- Check if the column already exists before adding it
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Findings' 
        AND column_name = 'TechnicalControl'
    ) THEN
        ALTER TABLE "Findings" 
        ADD COLUMN "TechnicalControl" character varying(100) NOT NULL DEFAULT '';
        
        RAISE NOTICE 'TechnicalControl column added to Findings table';
    ELSE
        RAISE NOTICE 'TechnicalControl column already exists in Findings table';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'Findings' 
AND column_name = 'TechnicalControl';