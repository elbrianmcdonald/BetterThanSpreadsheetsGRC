-- Script to fix existing Finding Closure Requests that are in limbo
-- This addresses issues where existing requests don't work with the new assignment system

-- 1. First, let's see what finding closure requests exist and their current state
SELECT 
    fcr.Id,
    fcr.FindingId,
    fcr.Requester,
    fcr.Status,
    fcr.AssignedToUserId,
    fcr.RequestDate,
    f.FindingNumber,
    f.Title as FindingTitle
FROM FindingClosureRequests fcr
LEFT JOIN Findings f ON fcr.FindingId = f.Id
ORDER BY fcr.RequestDate DESC;

-- 2. Find requests that might be in limbo (no assigned user but status suggests they should be assigned)
SELECT 
    fcr.Id,
    fcr.Status,
    fcr.AssignedToUserId,
    fcr.Requester,
    fcr.RequestDate
FROM FindingClosureRequests fcr
WHERE fcr.Status IN (2, 3) -- InProgress or Completed statuses  
  AND fcr.AssignedToUserId IS NULL;

-- 3. Fix requests that are in progress but have no assignee - reset them to pending
UPDATE FindingClosureRequests 
SET Status = 1, -- PendingApproval
    AssignedToUserId = NULL,
    AssignedByUserId = NULL,
    AssignmentDate = NULL,
    StartedDate = NULL
WHERE Status IN (2, 3) -- InProgress or Completed
  AND AssignedToUserId IS NULL;

-- 4. Ensure all requests have proper CreatedAt/UpdatedAt timestamps
UPDATE FindingClosureRequests 
SET CreatedAt = RequestDate,
    UpdatedAt = RequestDate
WHERE CreatedAt IS NULL OR UpdatedAt IS NULL;

-- 5. Check for orphaned requests (finding closure requests pointing to non-existent findings)
SELECT 
    fcr.Id,
    fcr.FindingId,
    fcr.Requester,
    'Orphaned - Finding does not exist' as Issue
FROM FindingClosureRequests fcr
LEFT JOIN Findings f ON fcr.FindingId = f.Id
WHERE f.Id IS NULL;

-- 6. Optional: Clean up orphaned requests (uncomment to execute)
-- DELETE FROM FindingClosureRequests 
-- WHERE Id IN (
--     SELECT fcr.Id
--     FROM FindingClosureRequests fcr
--     LEFT JOIN Findings f ON fcr.FindingId = f.Id
--     WHERE f.Id IS NULL
-- );

-- 7. Verify the fixes
SELECT 
    'Total Requests' as Category,
    COUNT(*) as Count
FROM FindingClosureRequests
UNION ALL
SELECT 
    'Pending Requests' as Category,
    COUNT(*) as Count
FROM FindingClosureRequests
WHERE Status = 1
UNION ALL
SELECT 
    'In Progress (Assigned)' as Category,
    COUNT(*) as Count
FROM FindingClosureRequests
WHERE Status = 2 AND AssignedToUserId IS NOT NULL
UNION ALL
SELECT 
    'Completed' as Category,
    COUNT(*) as Count
FROM FindingClosureRequests
WHERE Status = 3
UNION ALL
SELECT 
    'Problematic (In Progress but Unassigned)' as Category,
    COUNT(*) as Count
FROM FindingClosureRequests
WHERE Status = 2 AND AssignedToUserId IS NULL;