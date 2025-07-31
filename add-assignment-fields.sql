-- Add assignment fields to RiskAcceptanceRequests and FindingClosureRequests tables
-- These fields enable administrators to assign requests to GRC users

DO $$ 
BEGIN
    -- RiskAcceptanceRequests Assignment Fields
    
    -- Add AssignedToUserId column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'AssignedToUserId') THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD COLUMN "AssignedToUserId" text;
    END IF;
    
    -- Add AssignedByUserId column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'AssignedByUserId') THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD COLUMN "AssignedByUserId" text;
    END IF;
    
    -- Add AssignmentDate column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'AssignmentDate') THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD COLUMN "AssignmentDate" timestamp with time zone;
    END IF;
    
    -- Add AssignmentNotes column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'AssignmentNotes') THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD COLUMN "AssignmentNotes" text NOT NULL DEFAULT '';
    END IF;
    
    -- Add StartedDate column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'StartedDate') THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD COLUMN "StartedDate" timestamp with time zone;
    END IF;
    
    -- Add CompletedDate column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'CompletedDate') THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD COLUMN "CompletedDate" timestamp with time zone;
    END IF;
    
    -- FindingClosureRequests Assignment Fields
    
    -- Add AssignedToUserId column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'FindingClosureRequests' AND column_name = 'AssignedToUserId') THEN
        ALTER TABLE "FindingClosureRequests" ADD COLUMN "AssignedToUserId" text;
    END IF;
    
    -- Add AssignedByUserId column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'FindingClosureRequests' AND column_name = 'AssignedByUserId') THEN
        ALTER TABLE "FindingClosureRequests" ADD COLUMN "AssignedByUserId" text;
    END IF;
    
    -- Add AssignmentDate column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'FindingClosureRequests' AND column_name = 'AssignmentDate') THEN
        ALTER TABLE "FindingClosureRequests" ADD COLUMN "AssignmentDate" timestamp with time zone;
    END IF;
    
    -- Add AssignmentNotes column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'FindingClosureRequests' AND column_name = 'AssignmentNotes') THEN
        ALTER TABLE "FindingClosureRequests" ADD COLUMN "AssignmentNotes" text NOT NULL DEFAULT '';
    END IF;
    
    -- Add StartedDate column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'FindingClosureRequests' AND column_name = 'StartedDate') THEN
        ALTER TABLE "FindingClosureRequests" ADD COLUMN "StartedDate" timestamp with time zone;
    END IF;
    
    -- Add CompletedDate column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'FindingClosureRequests' AND column_name = 'CompletedDate') THEN
        ALTER TABLE "FindingClosureRequests" ADD COLUMN "CompletedDate" timestamp with time zone;
    END IF;
    
    -- Add foreign key constraints for RiskAcceptanceRequests
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'RiskAcceptanceRequests' 
        AND constraint_name = 'FK_RiskAcceptanceRequests_AspNetUsers_AssignedToUserId'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD CONSTRAINT "FK_RiskAcceptanceRequests_AspNetUsers_AssignedToUserId" 
        FOREIGN KEY ("AssignedToUserId") REFERENCES "AspNetUsers" ("Id") ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'RiskAcceptanceRequests' 
        AND constraint_name = 'FK_RiskAcceptanceRequests_AspNetUsers_AssignedByUserId'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE "RiskAcceptanceRequests" ADD CONSTRAINT "FK_RiskAcceptanceRequests_AspNetUsers_AssignedByUserId" 
        FOREIGN KEY ("AssignedByUserId") REFERENCES "AspNetUsers" ("Id") ON DELETE SET NULL;
    END IF;
    
    -- Add foreign key constraints for FindingClosureRequests
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'FindingClosureRequests' 
        AND constraint_name = 'FK_FindingClosureRequests_AspNetUsers_AssignedToUserId'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE "FindingClosureRequests" ADD CONSTRAINT "FK_FindingClosureRequests_AspNetUsers_AssignedToUserId" 
        FOREIGN KEY ("AssignedToUserId") REFERENCES "AspNetUsers" ("Id") ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'FindingClosureRequests' 
        AND constraint_name = 'FK_FindingClosureRequests_AspNetUsers_AssignedByUserId'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE "FindingClosureRequests" ADD CONSTRAINT "FK_FindingClosureRequests_AspNetUsers_AssignedByUserId" 
        FOREIGN KEY ("AssignedByUserId") REFERENCES "AspNetUsers" ("Id") ON DELETE SET NULL;
    END IF;
    
END $$;

-- Verify the columns were added
SELECT 'RiskAcceptanceRequests' as table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'RiskAcceptanceRequests' 
AND column_name IN ('AssignedToUserId', 'AssignedByUserId', 'AssignmentDate', 'AssignmentNotes', 'StartedDate', 'CompletedDate')
UNION ALL
SELECT 'FindingClosureRequests' as table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'FindingClosureRequests' 
AND column_name IN ('AssignedToUserId', 'AssignedByUserId', 'AssignmentDate', 'AssignmentNotes', 'StartedDate', 'CompletedDate')
ORDER BY table_name, column_name;