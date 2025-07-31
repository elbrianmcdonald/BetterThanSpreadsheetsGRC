-- FAIR Alignment Schema Changes
-- This script updates the RiskAssessments table to fully align with FAIR methodology

-- Add TEF distribution fields (replacing single TEF value)
ALTER TABLE "RiskAssessments" ADD COLUMN "ThreatEventFrequencyMin" decimal(18,6) NOT NULL DEFAULT 0;
ALTER TABLE "RiskAssessments" ADD COLUMN "ThreatEventFrequencyMax" decimal(18,6) NOT NULL DEFAULT 0;
ALTER TABLE "RiskAssessments" ADD COLUMN "ThreatEventFrequencyConfidence" decimal(5,2) NOT NULL DEFAULT 90;

-- Add Secondary Loss Categories
ALTER TABLE "RiskAssessments" ADD COLUMN "SecondaryResponseCostMin" decimal(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "RiskAssessments" ADD COLUMN "SecondaryResponseCostMostLikely" decimal(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "RiskAssessments" ADD COLUMN "SecondaryResponseCostMax" decimal(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "RiskAssessments" ADD COLUMN "SecondaryProductivityLossMin" decimal(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "RiskAssessments" ADD COLUMN "SecondaryProductivityLossMostLikely" decimal(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "RiskAssessments" ADD COLUMN "SecondaryProductivityLossMax" decimal(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "RiskAssessments" ADD COLUMN "ReputationDamageMin" decimal(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "RiskAssessments" ADD COLUMN "ReputationDamageMostLikely" decimal(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "RiskAssessments" ADD COLUMN "ReputationDamageMax" decimal(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "RiskAssessments" ADD COLUMN "CompetitiveAdvantageLossMin" decimal(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "RiskAssessments" ADD COLUMN "CompetitiveAdvantageLossMostLikely" decimal(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "RiskAssessments" ADD COLUMN "CompetitiveAdvantageLossMax" decimal(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "RiskAssessments" ADD COLUMN "ExternalStakeholderLossMin" decimal(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "RiskAssessments" ADD COLUMN "ExternalStakeholderLossMostLikely" decimal(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "RiskAssessments" ADD COLUMN "ExternalStakeholderLossMax" decimal(18,2) NOT NULL DEFAULT 0;

-- Add Secondary Loss Event Frequency
ALTER TABLE "RiskAssessments" ADD COLUMN "SecondaryLossEventFrequency" decimal(18,6);
ALTER TABLE "RiskAssessments" ADD COLUMN "SecondaryLossMagnitude" decimal(18,2);

-- Monte Carlo Simulation Results
ALTER TABLE "RiskAssessments" ADD COLUMN "SimulationIterations" integer NOT NULL DEFAULT 10000;
ALTER TABLE "RiskAssessments" ADD COLUMN "ALE_10th" decimal(18,2);
ALTER TABLE "RiskAssessments" ADD COLUMN "ALE_50th" decimal(18,2);
ALTER TABLE "RiskAssessments" ADD COLUMN "ALE_90th" decimal(18,2);
ALTER TABLE "RiskAssessments" ADD COLUMN "ALE_95th" decimal(18,2);
ALTER TABLE "RiskAssessments" ADD COLUMN "PrimaryLoss_10th" decimal(18,2);
ALTER TABLE "RiskAssessments" ADD COLUMN "PrimaryLoss_50th" decimal(18,2);
ALTER TABLE "RiskAssessments" ADD COLUMN "PrimaryLoss_90th" decimal(18,2);
ALTER TABLE "RiskAssessments" ADD COLUMN "PrimaryLoss_95th" decimal(18,2);

-- Confidence levels for all estimates
ALTER TABLE "RiskAssessments" ADD COLUMN "LossMagnitudeConfidence" decimal(5,2) NOT NULL DEFAULT 90;

-- Create Control Effectiveness table for Defense in Depth calculations
CREATE TABLE "RiskAssessmentControls" (
    "Id" SERIAL PRIMARY KEY,
    "RiskAssessmentId" integer NOT NULL,
    "ControlName" varchar(200) NOT NULL,
    "ControlType" varchar(50) NOT NULL, -- Preventive, Detective, Responsive
    "ControlEffectiveness" decimal(5,2) NOT NULL, -- 0-100%
    "ControlDescription" text,
    "ImplementationStatus" varchar(50) NOT NULL DEFAULT 'Implemented', -- Implemented, Planned, Not Implemented
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FK_RiskAssessmentControls_RiskAssessments" FOREIGN KEY ("RiskAssessmentId") 
        REFERENCES "RiskAssessments" ("Id") ON DELETE CASCADE
);

-- Add index for performance
CREATE INDEX "IX_RiskAssessmentControls_RiskAssessmentId" ON "RiskAssessmentControls" ("RiskAssessmentId");

-- Add calculated vulnerability field (will be computed based on controls)
ALTER TABLE "RiskAssessments" ADD COLUMN "CalculatedVulnerability" decimal(5,4);

-- Add fields for PERT distribution parameters
ALTER TABLE "RiskAssessments" ADD COLUMN "UsePerDistribution" boolean NOT NULL DEFAULT true;
ALTER TABLE "RiskAssessments" ADD COLUMN "DistributionType" varchar(20) NOT NULL DEFAULT 'PERT'; -- PERT, Normal, Lognormal, Uniform

-- Update existing records to have Min/Max values based on MostLikely
UPDATE "RiskAssessments" 
SET 
    "ThreatEventFrequencyMin" = "ThreatEventFrequency" * 0.5,
    "ThreatEventFrequencyMax" = "ThreatEventFrequency" * 2.0
WHERE "AssessmentType" = 1; -- FAIR assessments

-- Add comments for documentation
COMMENT ON COLUMN "RiskAssessments"."CalculatedVulnerability" IS 'Calculated as 1 - (Product of all control effectiveness percentages)';
COMMENT ON COLUMN "RiskAssessments"."ThreatEventFrequencyConfidence" IS 'Confidence level for TEF estimates (typically 90% or 95%)';
COMMENT ON COLUMN "RiskAssessments"."LossMagnitudeConfidence" IS 'Confidence level for loss magnitude estimates (typically 90% or 95%)';
COMMENT ON TABLE "RiskAssessmentControls" IS 'Stores individual controls for defense-in-depth vulnerability calculations';