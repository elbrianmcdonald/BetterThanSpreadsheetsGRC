-- Add missing columns to RiskAssessments table
ALTER TABLE "RiskAssessments" 
ADD COLUMN IF NOT EXISTS "GenerateRisksForRegister" boolean NOT NULL DEFAULT false;

ALTER TABLE "RiskAssessments" 
ADD COLUMN IF NOT EXISTS "RisksGenerated" boolean NOT NULL DEFAULT false;

ALTER TABLE "RiskAssessments" 
ADD COLUMN IF NOT EXISTS "RisksGeneratedDate" timestamp with time zone NULL;