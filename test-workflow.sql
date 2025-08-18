-- Test the seamless risk assessment to risk backlog workflow
-- Insert a test risk assessment with risk scores

INSERT INTO "RiskAssessments" (
    "Title", 
    "Asset", 
    "Assessor", 
    "BusinessOwner", 
    "AssessmentType", 
    "QualitativeImpact", 
    "QualitativeLikelihood", 
    "QualitativeExposure", 
    "QualitativeRiskScore", 
    "Status", 
    "DateCompleted", 
    "CreatedAt", 
    "UpdatedAt", 
    "CreatedBy", 
    "UpdatedBy", 
    "RisksGenerated", 
    "GenerateRisksForRegister"
) VALUES (
    'Test Automatic Risk Generation', 
    'Test System', 
    'admin@cyberrisk.com', 
    'Test Business Owner', 
    1, -- Qualitative
    4.0, -- High Impact
    3.0, -- Medium Likelihood  
    2.0, -- Low Exposure
    24.0, -- 4 * 3 * 2 = 24 (High Risk)
    2, -- Completed
    NOW(), 
    NOW(), 
    NOW(), 
    'admin@cyberrisk.com', 
    'admin@cyberrisk.com', 
    false, -- Should be set to true automatically
    true
);

-- Check if assessment was created
SELECT "Id", "Title", "QualitativeRiskScore", "Status", "RisksGenerated" 
FROM "RiskAssessments" 
WHERE "Title" = 'Test Automatic Risk Generation';

-- This should show 0 initially since risks haven't been auto-generated yet
-- The RiskAssessmentService.AutoGenerateRisksForBacklogAsync should run when assessment is saved
SELECT COUNT(*) as "RiskBacklogEntries" 
FROM "RiskBacklogEntries" 
WHERE "RiskSource" = 3; -- RiskSource.RiskAssessment