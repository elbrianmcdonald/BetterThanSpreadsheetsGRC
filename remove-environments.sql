-- Remove environment references from threat modeling
-- This script removes environment-related tables and columns

-- First, remove foreign key constraints
DO $$ 
BEGIN
    -- Drop foreign key constraint on AttackScenarioSteps.EnvironmentId if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name LIKE '%AttackScenarioSteps_EnvironmentId%') THEN
        ALTER TABLE "AttackScenarioSteps" DROP CONSTRAINT IF EXISTS "FK_AttackScenarioSteps_Environments_EnvironmentId";
    END IF;
    
    -- Drop foreign key constraint on AttackPaths if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name LIKE '%AttackPaths_SourceEnvironmentId%') THEN
        ALTER TABLE "AttackPaths" DROP CONSTRAINT IF EXISTS "FK_AttackPaths_Environments_SourceEnvironmentId";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name LIKE '%AttackPaths_TargetEnvironmentId%') THEN
        ALTER TABLE "AttackPaths" DROP CONSTRAINT IF EXISTS "FK_AttackPaths_Environments_TargetEnvironmentId";
    END IF;
END $$;

-- Remove EnvironmentId column from AttackScenarioSteps
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'AttackScenarioSteps' AND column_name = 'EnvironmentId') THEN
        ALTER TABLE "AttackScenarioSteps" DROP COLUMN "EnvironmentId";
    END IF;
END $$;

-- Rename DetectionOpportunities to DetectionMethods in AttackScenarioSteps
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'AttackScenarioSteps' AND column_name = 'DetectionOpportunities') THEN
        ALTER TABLE "AttackScenarioSteps" RENAME COLUMN "DetectionOpportunities" TO "DetectionMethods";
    END IF;
END $$;

-- Make EnvironmentType optional in KillChainActivities
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'KillChainActivities' AND column_name = 'EnvironmentType' AND is_nullable = 'NO') THEN
        ALTER TABLE "KillChainActivities" ALTER COLUMN "EnvironmentType" DROP NOT NULL;
    END IF;
END $$;

-- Drop environment-related tables if they exist
DROP TABLE IF EXISTS "TechniqueEnvironmentMappings";
DROP TABLE IF EXISTS "Environments";

PRINT 'Environment references removed from threat modeling successfully.';