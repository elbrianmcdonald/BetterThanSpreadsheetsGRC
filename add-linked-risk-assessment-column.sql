-- Add LinkedRiskAssessmentId column to RiskAcceptanceRequests table
-- This allows linking risk assessments to risk acceptance requests for better traceability

ALTER TABLE "RiskAcceptanceRequests" 
ADD COLUMN "LinkedRiskAssessmentId" integer NULL;

-- Add foreign key constraint to RiskAssessments table (shortened constraint name)
ALTER TABLE "RiskAcceptanceRequests" 
ADD CONSTRAINT "FK_RiskAcceptance_RiskAssessment_LinkedId" 
FOREIGN KEY ("LinkedRiskAssessmentId") 
REFERENCES "RiskAssessments" ("Id") 
ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX "IX_RiskAcceptanceRequests_LinkedRiskAssessmentId" 
ON "RiskAcceptanceRequests" ("LinkedRiskAssessmentId");

-- Verify the column was added successfully
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'RiskAcceptanceRequests' 
AND column_name = 'LinkedRiskAssessmentId';