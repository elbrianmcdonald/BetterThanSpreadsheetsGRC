using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace CyberRiskApp.Services
{
    public class RiskBacklogService : IRiskBacklogService
    {
        private readonly CyberRiskContext _context;
        private readonly ILogger<RiskBacklogService> _logger;
        private readonly IRiskService _riskService;

        public RiskBacklogService(CyberRiskContext context, ILogger<RiskBacklogService> logger, IRiskService riskService)
        {
            _context = context;
            _logger = logger;
            _riskService = riskService;
        }

        public async Task<RiskBacklogEntry> CreateBacklogEntryAsync(int? riskId, RiskBacklogAction actionType, string description, string justification, string requesterId)
        {
            var backlogEntry = new RiskBacklogEntry
            {
                BacklogNumber = await GenerateBacklogNumberAsync(),
                RiskId = riskId,
                ActionType = actionType,
                Status = RiskBacklogStatus.Unassigned,
                Priority = GetDefaultPriority(actionType),
                RequestDescription = description,
                RequestJustification = justification,
                RequesterUserId = requesterId,
                DueDate = CalculateDueDate(actionType),
                RiskSource = DetermineRiskSource(riskId),
                AnalystComments = string.Empty,
                ManagerComments = string.Empty,
                RejectionReason = string.Empty,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CreatedBy = requesterId,
                UpdatedBy = requesterId
                // Note: RowVersion is excluded - let EF Core/PostgreSQL handle it automatically
            };

            // Debug: Log the values we're trying to save
            _logger.LogInformation("🔍 DEBUGGING CreateBacklogEntry - BacklogNumber: {BacklogNumber}, RequesterId: {RequesterId}, ActionType: {ActionType}", 
                backlogEntry.BacklogNumber, requesterId, actionType);
            _logger.LogInformation("🔍 DEBUGGING CreateBacklogEntry - AnalystComments: '{AnalystComments}', ManagerComments: '{ManagerComments}', RejectionReason: '{RejectionReason}'",
                backlogEntry.AnalystComments, backlogEntry.ManagerComments, backlogEntry.RejectionReason);

            _context.RiskBacklogEntries.Add(backlogEntry);
            
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError("💥 DETAILED ERROR: {Message}", ex.Message);
                if (ex.InnerException != null)
                {
                    _logger.LogError("💥 INNER EXCEPTION: {InnerMessage}", ex.InnerException.Message);
                    if (ex.InnerException.InnerException != null)
                    {
                        _logger.LogError("💥 DEEPEST EXCEPTION: {DeepestMessage}", ex.InnerException.InnerException.Message);
                    }
                }
                throw;
            }

            // Log initial activity - handle errors gracefully
            try
            {
                await LogActivityAsync(backlogEntry.Id, "Created", "", backlogEntry.Status.ToString(), $"Backlog entry created for {actionType}", requesterId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to log activity for backlog entry {BacklogNumber}", backlogEntry.BacklogNumber);
                // Continue execution - activity logging is not critical
            }

            _logger.LogInformation("Created backlog entry {BacklogNumber} for action {ActionType}", backlogEntry.BacklogNumber, actionType);
            return backlogEntry;
        }

        public async Task<RiskBacklogEntry> CreateFindingBacklogEntryAsync(
            string title, string details, string source, 
            ImpactLevel impact, LikelihoodLevel likelihood, ExposureLevel exposure,
            string asset, string businessUnit, string businessOwner, string domain, string technicalControl,
            string requesterId)
        {
            var backlogEntry = new RiskBacklogEntry
            {
                BacklogNumber = await GenerateBacklogNumberAsync(),
                ActionType = RiskBacklogAction.NewFinding,
                Status = RiskBacklogStatus.Unassigned,
                Priority = GetDefaultPriority(RiskBacklogAction.NewFinding),
                RequestDescription = $"New finding: {title}",
                RequestJustification = "Finding requires review before being added to the register",
                RequesterUserId = requesterId,
                DueDate = CalculateDueDate(RiskBacklogAction.NewFinding),
                
                // Finding-specific fields
                FindingTitle = title,
                FindingDetails = details,
                FindingSource = source,
                Impact = impact,
                Likelihood = likelihood,
                Exposure = exposure,
                Asset = asset,
                BusinessUnit = businessUnit,
                BusinessOwner = businessOwner,
                Domain = domain,
                TechnicalControl = technicalControl,
                
                // Calculate risk rating for the finding
                RiskRating = CalculateFindingRiskRating(impact, likelihood, exposure),
                
                // Audit fields
                AnalystComments = string.Empty,
                ManagerComments = string.Empty,
                RejectionReason = string.Empty,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CreatedBy = requesterId,
                UpdatedBy = requesterId
            };

            _logger.LogInformation("🔍 DEBUGGING CreateFindingBacklogEntry - BacklogNumber: {BacklogNumber}, Title: {Title}, RequesterId: {RequesterId}", 
                backlogEntry.BacklogNumber, title, requesterId);

            _context.RiskBacklogEntries.Add(backlogEntry);
            
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError("💥 DETAILED ERROR: {Message}", ex.Message);
                if (ex.InnerException != null)
                {
                    _logger.LogError("💥 INNER EXCEPTION: {InnerMessage}", ex.InnerException.Message);
                    if (ex.InnerException.InnerException != null)
                    {
                        _logger.LogError("💥 DEEPEST EXCEPTION: {DeepestMessage}", ex.InnerException.InnerException.Message);
                    }
                }
                throw;
            }

            // Log initial activity
            try
            {
                await LogActivityAsync(backlogEntry.Id, "Created", "", backlogEntry.Status.ToString(), $"Finding backlog entry created: {title}", requesterId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to log activity for finding backlog entry {BacklogNumber}", backlogEntry.BacklogNumber);
            }

            _logger.LogInformation("Created finding backlog entry {BacklogNumber} for finding: {Title}", backlogEntry.BacklogNumber, title);
            return backlogEntry;
        }

        public async Task<RiskBacklogEntry?> GetBacklogEntryByIdAsync(int id)
        {
            return await _context.RiskBacklogEntries
                .Include(b => b.Risk)
                    .ThenInclude(r => r.LinkedAssessment)
                .Include(b => b.Risk)
                    .ThenInclude(r => r.LinkedFinding)
                .Include(b => b.Finding)
                .Include(b => b.Comments)
                .Include(b => b.Activities)
                .FirstOrDefaultAsync(b => b.Id == id);
        }

        public async Task<RiskBacklogEntry> AssignToAnalystAsync(int backlogId, string analystId, string assignedBy)
        {
            _logger.LogInformation("AssignToAnalystAsync called: BacklogId={BacklogId}, AnalystId={AnalystId}, AssignedBy={AssignedBy}", 
                backlogId, analystId, assignedBy);

            try
            {
                _logger.LogInformation("Fetching backlog entry with ID: {BacklogId}", backlogId);
                var entry = await GetBacklogEntryByIdAsync(backlogId);
                
                if (entry == null)
                {
                    _logger.LogError("Backlog entry with ID {BacklogId} not found in database", backlogId);
                    throw new ArgumentException($"Backlog entry with ID {backlogId} not found");
                }

                _logger.LogInformation("Found backlog entry {BacklogNumber}, current status: {Status}, current analyst: {CurrentAnalyst}, current manager: {CurrentManager}", 
                    entry.BacklogNumber, entry.Status, entry.AssignedToAnalyst ?? "None", entry.AssignedToManager ?? "None");

                var oldAssignee = entry.GetCurrentAssignee();
                _logger.LogInformation("Current assignee: {OldAssignee}, assigning to analyst: {AnalystId}", oldAssignee, analystId);

                // Update the entry
                entry.AssignedToAnalyst = analystId;
                entry.AssignedToManager = null;
                entry.Status = RiskBacklogStatus.AssignedToAnalyst;
                entry.AssignedDate = DateTime.UtcNow;
                entry.UpdatedAt = DateTime.UtcNow;
                entry.UpdatedBy = assignedBy;

                // Create activity log entry (consolidated approach to avoid double SaveChanges)
                var activity = new RiskBacklogActivity
                {
                    BacklogEntryId = backlogId,
                    ActivityType = "Assignment",
                    FromValue = oldAssignee,
                    ToValue = analystId,
                    Description = "Assigned to analyst",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedBy = assignedBy,
                    UpdatedBy = assignedBy
                };

                _context.RiskBacklogActivities.Add(activity);

                _logger.LogInformation("Updated entry properties and created activity log, saving all changes to database...");
                
                await _context.SaveChangesAsync();
                
                _logger.LogInformation("Successfully completed assignment of backlog {BacklogId} to analyst {AnalystId}", backlogId, analystId);
                return entry;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in AssignToAnalystAsync for BacklogId={BacklogId}, AnalystId={AnalystId}: {Message} | StackTrace: {StackTrace}", 
                    backlogId, analystId, ex.Message, ex.StackTrace);
                throw;
            }
        }

        public async Task<RiskBacklogEntry> AssignToManagerAsync(int backlogId, string managerId, string assignedBy)
        {
            var entry = await GetBacklogEntryByIdAsync(backlogId);
            if (entry == null) throw new ArgumentException("Backlog entry not found");

            var oldAssignee = entry.GetCurrentAssignee();
            entry.AssignedToManager = managerId;
            entry.Status = RiskBacklogStatus.AssignedToManager;
            entry.AssignedDate = DateTime.UtcNow;
            entry.UpdatedAt = DateTime.UtcNow;
            entry.UpdatedBy = assignedBy;

            await _context.SaveChangesAsync();
            await LogActivityAsync(backlogId, "Assignment", oldAssignee, managerId, "Assigned to manager", assignedBy);

            return entry;
        }

        public async Task<RiskBacklogEntry> AnalystApproveAsync(int backlogId, string comments, string analystId)
        {
            var entry = await GetBacklogEntryByIdAsync(backlogId);
            if (entry == null) throw new ArgumentException("Backlog entry not found");

            entry.AnalystComments = comments;
            entry.Status = RiskBacklogStatus.AssignedToManager;
            entry.UpdatedAt = DateTime.UtcNow;
            entry.UpdatedBy = analystId;

            // Auto-assign to a manager if needed (can be enhanced with assignment logic)
            if (string.IsNullOrEmpty(entry.AssignedToManager))
            {
                // TODO: Implement manager assignment logic
                _logger.LogWarning("No manager assigned for backlog entry {BacklogNumber}", entry.BacklogNumber);
            }

            await _context.SaveChangesAsync();
            await LogActivityAsync(backlogId, "AnalystApproval", "AssignedToAnalyst", "AssignedToManager", "Approved by analyst", analystId);

            return entry;
        }

        public async Task<RiskBacklogEntry> AnalystRejectAsync(int backlogId, string reason, string analystId)
        {
            var entry = await GetBacklogEntryByIdAsync(backlogId);
            if (entry == null) throw new ArgumentException("Backlog entry not found");

            entry.RejectionReason = reason;
            entry.AnalystComments = $"Rejected: {reason}";
            entry.Status = RiskBacklogStatus.Rejected;
            entry.CompletedDate = DateTime.UtcNow;
            entry.UpdatedAt = DateTime.UtcNow;
            entry.UpdatedBy = analystId;

            await _context.SaveChangesAsync();
            await LogActivityAsync(backlogId, "AnalystRejection", "AssignedToAnalyst", "Rejected", $"Rejected by analyst: {reason}", analystId);

            return entry;
        }

        public async Task<RiskBacklogEntry> ManagerApproveAsync(int backlogId, string comments, string managerId)
        {
            var entry = await GetBacklogEntryByIdAsync(backlogId);
            if (entry == null) throw new ArgumentException("Backlog entry not found");

            entry.ManagerComments = comments;
            entry.Status = RiskBacklogStatus.Approved;
            entry.CompletedDate = DateTime.UtcNow;
            entry.UpdatedAt = DateTime.UtcNow;
            entry.UpdatedBy = managerId;

            // Handle risk/finding creation/update based on action type
            if (entry.ActionType == RiskBacklogAction.NewRisk)
            {
                if (entry.Risk != null)
                {
                    // Existing risk - just update status to Open
                    entry.Risk.Status = RiskStatus.Open;
                    _context.Risks.Update(entry.Risk);
                }
                else
                {
                    // NEW RISK - Create from backlog data upon approval
                    try
                    {
                        var newRisk = await CreateRiskFromBacklogEntryAsync(entry, managerId);
                        entry.RiskId = newRisk.Id;
                        entry.Risk = newRisk;
                        
                        _logger.LogInformation("Created new risk {RiskNumber} from approved backlog entry {BacklogNumber}", 
                            newRisk.RiskNumber, entry.BacklogNumber);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to create risk from backlog entry {BacklogNumber}", entry.BacklogNumber);
                        throw new InvalidOperationException($"Failed to create risk from backlog entry: {ex.Message}", ex);
                    }
                }
            }
            else if (entry.ActionType == RiskBacklogAction.NewFinding)
            {
                // NEW FINDING - Create finding entity upon approval
                try
                {
                    var newFinding = await CreateFindingFromBacklogEntryAsync(entry, managerId);
                    entry.FindingId = newFinding.Id;
                    entry.Finding = newFinding;
                    
                    _logger.LogInformation("Created new finding {FindingId} from approved backlog entry {BacklogNumber}", 
                        newFinding.Id, entry.BacklogNumber);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create finding from backlog entry {BacklogNumber}", entry.BacklogNumber);
                    throw new InvalidOperationException($"Failed to create finding from backlog entry: {ex.Message}", ex);
                }
            }

            await _context.SaveChangesAsync();
            await LogActivityAsync(backlogId, "ManagerApproval", "AssignedToManager", "Approved", "Approved by manager", managerId);

            return entry;
        }

        public async Task<RiskBacklogEntry> ManagerRejectAsync(int backlogId, string reason, string managerId)
        {
            var entry = await GetBacklogEntryByIdAsync(backlogId);
            if (entry == null) throw new ArgumentException("Backlog entry not found");

            entry.RejectionReason = reason;
            entry.ManagerComments = $"Rejected: {reason}";
            entry.Status = RiskBacklogStatus.Rejected;
            entry.CompletedDate = DateTime.UtcNow;
            entry.UpdatedAt = DateTime.UtcNow;
            entry.UpdatedBy = managerId;

            await _context.SaveChangesAsync();
            await LogActivityAsync(backlogId, "ManagerRejection", "AssignedToManager", "Rejected", $"Rejected by manager: {reason}", managerId);

            return entry;
        }

        public async Task<RiskBacklogEntry> EscalateAsync(int backlogId, string reason, string userId)
        {
            var entry = await GetBacklogEntryByIdAsync(backlogId);
            if (entry == null) throw new ArgumentException("Backlog entry not found");

            var oldStatus = entry.Status;
            entry.Status = RiskBacklogStatus.Escalated;
            entry.Priority = BacklogPriority.Critical;
            entry.UpdatedAt = DateTime.UtcNow;
            entry.UpdatedBy = userId;

            await _context.SaveChangesAsync();
            await LogActivityAsync(backlogId, "Escalation", oldStatus.ToString(), "Escalated", $"Escalated: {reason}", userId);

            return entry;
        }

        public async Task<RiskBacklogEntry> SetPriorityAsync(int backlogId, BacklogPriority priority, string userId)
        {
            var entry = await GetBacklogEntryByIdAsync(backlogId);
            if (entry == null) throw new ArgumentException("Backlog entry not found");

            var oldPriority = entry.Priority;
            entry.Priority = priority;
            entry.UpdatedAt = DateTime.UtcNow;
            entry.UpdatedBy = userId;

            await _context.SaveChangesAsync();
            await LogActivityAsync(backlogId, "PriorityChange", oldPriority.ToString(), priority.ToString(), "Priority updated", userId);

            return entry;
        }

        public async Task<RiskBacklogComment> AddCommentAsync(int backlogId, string comment, string commentType, bool isInternal, string userId)
        {
            var backlogComment = new RiskBacklogComment
            {
                BacklogEntryId = backlogId,
                Comment = comment,
                CommentType = commentType,
                IsInternal = isInternal,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CreatedBy = userId,
                UpdatedBy = userId
            };

            _context.RiskBacklogComments.Add(backlogComment);
            await _context.SaveChangesAsync();

            await LogActivityAsync(backlogId, "Comment", "", commentType, $"Comment added: {comment.Substring(0, Math.Min(50, comment.Length))}...", userId);

            return backlogComment;
        }

        public async Task<List<RiskBacklogComment>> GetCommentsAsync(int backlogId, bool includeInternal = false)
        {
            var query = _context.RiskBacklogComments
                .Where(c => c.BacklogEntryId == backlogId);

            if (!includeInternal)
            {
                query = query.Where(c => !c.IsInternal);
            }

            return await query.OrderBy(c => c.CreatedAt).ToListAsync();
        }

        public async Task LogActivityAsync(int backlogId, string activityType, string fromValue, string toValue, string description, string userId)
        {
            var activity = new RiskBacklogActivity
            {
                BacklogEntryId = backlogId,
                ActivityType = activityType,
                FromValue = fromValue,
                ToValue = toValue,
                Description = description,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CreatedBy = userId,
                UpdatedBy = userId
            };

            _context.RiskBacklogActivities.Add(activity);
            await _context.SaveChangesAsync();
        }

        public async Task<List<RiskBacklogActivity>> GetActivitiesAsync(int backlogId)
        {
            return await _context.RiskBacklogActivities
                .Where(a => a.BacklogEntryId == backlogId)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<RiskBacklogEntry>> GetBacklogForAnalystAsync(string analystId)
        {
            return await _context.RiskBacklogEntries
                .Include(b => b.Risk)
                .Include(b => b.Finding)
                .Where(b => b.AssignedToAnalyst == analystId && b.Status == RiskBacklogStatus.AssignedToAnalyst)
                .OrderBy(b => b.DueDate)
                .ThenByDescending(b => b.Priority)
                .ToListAsync();
        }

        public async Task<List<RiskBacklogEntry>> GetBacklogForManagerAsync(string managerId)
        {
            var results = await _context.RiskBacklogEntries
                .Include(b => b.Risk)
                .Include(b => b.Finding)
                .Where(b => b.AssignedToManager == managerId && b.Status == RiskBacklogStatus.AssignedToManager)
                .OrderBy(b => b.DueDate)
                .ThenByDescending(b => b.Priority)
                .ToListAsync();
                
            _logger.LogInformation("🔍 DEBUG GetBacklogForManagerAsync: managerId='{ManagerId}', found {Count} entries", managerId, results.Count);
            return results;
        }

        public async Task<List<RiskBacklogEntry>> GetUnassignedBacklogAsync()
        {
            return await _context.RiskBacklogEntries
                .Include(b => b.Risk)
                .Include(b => b.Finding)
                .Where(b => b.Status == RiskBacklogStatus.Unassigned)
                .OrderByDescending(b => b.Priority)
                .ThenBy(b => b.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<RiskBacklogEntry>> GetSLABreachedBacklogAsync()
        {
            return await _context.RiskBacklogEntries
                .Include(b => b.Risk)
                .Where(b => b.IsSLABreached && b.Status != RiskBacklogStatus.Approved && b.Status != RiskBacklogStatus.Rejected)
                .OrderByDescending(b => b.Priority)
                .ThenBy(b => b.DueDate)
                .ToListAsync();
        }

        public async Task<List<RiskBacklogEntry>> GetBacklogByStatusAsync(RiskBacklogStatus status)
        {
            return await _context.RiskBacklogEntries
                .Include(b => b.Risk)
                .Where(b => b.Status == status)
                .OrderByDescending(b => b.Priority)
                .ThenBy(b => b.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<RiskBacklogEntry>> GetBacklogByActionTypeAsync(RiskBacklogAction actionType)
        {
            return await _context.RiskBacklogEntries
                .Include(b => b.Risk)
                .Where(b => b.ActionType == actionType)
                .OrderByDescending(b => b.Priority)
                .ThenBy(b => b.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<RiskBacklogEntry>> GetAllBacklogEntriesAsync(string? filterBy = null, string? filterValue = null)
        {
            var query = _context.RiskBacklogEntries
                .Include(b => b.Risk)
                    .ThenInclude(r => r.LinkedAssessment)
                .Include(b => b.Risk)
                    .ThenInclude(r => r.LinkedFinding)
                .Include(b => b.Finding)
                .AsQueryable();

            if (!string.IsNullOrEmpty(filterBy) && !string.IsNullOrEmpty(filterValue))
            {
                switch (filterBy.ToLower())
                {
                    case "status":
                        if (Enum.TryParse<RiskBacklogStatus>(filterValue, out var status))
                            query = query.Where(b => b.Status == status);
                        break;
                    case "action":
                        if (Enum.TryParse<RiskBacklogAction>(filterValue, out var action))
                            query = query.Where(b => b.ActionType == action);
                        break;
                    case "priority":
                        if (Enum.TryParse<BacklogPriority>(filterValue, out var priority))
                            query = query.Where(b => b.Priority == priority);
                        break;
                    case "assignee":
                        query = query.Where(b => b.AssignedToAnalyst == filterValue || b.AssignedToManager == filterValue);
                        break;
                }
            }

            return await query
                .OrderByDescending(b => b.Priority)
                .ThenBy(b => b.DueDate)
                .ThenByDescending(b => b.CreatedAt)
                .ToListAsync();
        }

        public async Task<int> BulkAssignToAnalystAsync(List<int> backlogIds, string analystId, string assignedBy)
        {
            var entries = await _context.RiskBacklogEntries
                .Where(b => backlogIds.Contains(b.Id) && b.Status == RiskBacklogStatus.Unassigned)
                .ToListAsync();

            foreach (var entry in entries)
            {
                entry.AssignedToAnalyst = analystId;
                entry.Status = RiskBacklogStatus.AssignedToAnalyst;
                entry.AssignedDate = DateTime.UtcNow;
                entry.UpdatedAt = DateTime.UtcNow;
                entry.UpdatedBy = assignedBy;
            }

            await _context.SaveChangesAsync();

            // Log activities
            foreach (var entry in entries)
            {
                await LogActivityAsync(entry.Id, "BulkAssignment", "Unassigned", analystId, "Bulk assigned to analyst", assignedBy);
            }

            return entries.Count;
        }

        public async Task<int> BulkAssignToManagerAsync(List<int> backlogIds, string managerId, string assignedBy)
        {
            var entries = await _context.RiskBacklogEntries
                .Where(b => backlogIds.Contains(b.Id) && (b.Status == RiskBacklogStatus.Unassigned || b.Status == RiskBacklogStatus.AssignedToAnalyst))
                .ToListAsync();

            foreach (var entry in entries)
            {
                entry.AssignedToManager = managerId;
                entry.Status = RiskBacklogStatus.AssignedToManager;
                entry.AssignedDate = DateTime.UtcNow;
                entry.UpdatedAt = DateTime.UtcNow;
                entry.UpdatedBy = assignedBy;
            }

            await _context.SaveChangesAsync();

            // Log activities
            foreach (var entry in entries)
            {
                await LogActivityAsync(entry.Id, "BulkAssignment", entry.GetCurrentAssignee(), managerId, "Bulk assigned to manager", assignedBy);
            }

            return entries.Count;
        }

        public async Task<int> BulkApproveByManagerAsync(List<int> backlogIds, string comments, string managerId)
        {
            var entries = await _context.RiskBacklogEntries
                .Include(b => b.Risk)
                .Where(b => backlogIds.Contains(b.Id) && b.Status == RiskBacklogStatus.AssignedToManager)
                .ToListAsync();

            foreach (var entry in entries)
            {
                entry.ManagerComments = comments;
                entry.Status = RiskBacklogStatus.Approved;
                entry.CompletedDate = DateTime.UtcNow;
                entry.UpdatedAt = DateTime.UtcNow;
                entry.UpdatedBy = managerId;

                // If this is a new risk, update the risk status to Open
                if (entry.ActionType == RiskBacklogAction.NewRisk && entry.Risk != null)
                {
                    entry.Risk.Status = RiskStatus.Open;
                }
            }

            await _context.SaveChangesAsync();

            // Log activities
            foreach (var entry in entries)
            {
                await LogActivityAsync(entry.Id, "BulkApproval", "AssignedToManager", "Approved", "Bulk approved by manager", managerId);
            }

            return entries.Count;
        }

        public async Task<int> BulkSetPriorityAsync(List<int> backlogIds, BacklogPriority priority, string userId)
        {
            var entries = await _context.RiskBacklogEntries
                .Where(b => backlogIds.Contains(b.Id))
                .ToListAsync();

            foreach (var entry in entries)
            {
                entry.Priority = priority;
                entry.UpdatedAt = DateTime.UtcNow;
                entry.UpdatedBy = userId;
            }

            await _context.SaveChangesAsync();

            // Log activities
            foreach (var entry in entries)
            {
                await LogActivityAsync(entry.Id, "BulkPriorityChange", "", priority.ToString(), "Bulk priority update", userId);
            }

            return entries.Count;
        }

        public async Task UpdateSLAStatusAsync()
        {
            var entries = await _context.RiskBacklogEntries
                .Where(b => b.DueDate.HasValue && b.DueDate.Value < DateTime.UtcNow && 
                           !b.IsSLABreached && 
                           b.Status != RiskBacklogStatus.Approved && 
                           b.Status != RiskBacklogStatus.Rejected)
                .ToListAsync();

            foreach (var entry in entries)
            {
                entry.IsSLABreached = true;
                entry.UpdatedAt = DateTime.UtcNow;
                entry.UpdatedBy = "System";
            }

            if (entries.Any())
            {
                await _context.SaveChangesAsync();
                _logger.LogInformation("Updated SLA status for {Count} backlog entries", entries.Count);
            }
        }

        public async Task<List<RiskBacklogEntry>> GetDueBacklogEntriesAsync(int daysAhead = 3)
        {
            var cutoffDate = DateTime.UtcNow.AddDays(daysAhead);
            return await _context.RiskBacklogEntries
                .Include(b => b.Risk)
                .Where(b => b.DueDate.HasValue && 
                           b.DueDate.Value <= cutoffDate && 
                           b.Status != RiskBacklogStatus.Approved && 
                           b.Status != RiskBacklogStatus.Rejected)
                .OrderBy(b => b.DueDate)
                .ToListAsync();
        }

        public async Task<List<RiskBacklogEntry>> GetOverdueBacklogEntriesAsync()
        {
            return await _context.RiskBacklogEntries
                .Include(b => b.Risk)
                .Where(b => b.DueDate.HasValue && 
                           b.DueDate.Value < DateTime.UtcNow && 
                           b.Status != RiskBacklogStatus.Approved && 
                           b.Status != RiskBacklogStatus.Rejected)
                .OrderBy(b => b.DueDate)
                .ToListAsync();
        }

        public async Task<List<RiskBacklogEntry>> GetCompletedThisWeekBacklogEntriesAsync()
        {
            var startOfWeek = DateTime.UtcNow.Date.AddDays(-(int)DateTime.UtcNow.DayOfWeek);
            var endOfWeek = startOfWeek.AddDays(7);

            return await _context.RiskBacklogEntries
                .Include(b => b.Risk)
                .Where(b => b.CompletedDate.HasValue &&
                           b.CompletedDate.Value >= startOfWeek &&
                           b.CompletedDate.Value < endOfWeek &&
                           (b.Status == RiskBacklogStatus.Approved || b.Status == RiskBacklogStatus.Rejected))
                .OrderByDescending(b => b.CompletedDate)
                .ToListAsync();
        }


        public async Task<List<RiskBacklogEntry>> GetBacklogForUserAsync(string userId, string role)
        {
            _logger.LogInformation("🔍 DEBUG GetBacklogForUserAsync: userId='{UserId}', role='{Role}'", userId, role);
            
            if (role.Contains("Analyst"))
            {
                _logger.LogInformation("🔍 DEBUG: Using GetBacklogForAnalystAsync for role '{Role}'", role);
                return await GetBacklogForAnalystAsync(userId);
            }
            else if (role.Contains("Manager") || role.Contains("Admin"))
            {
                _logger.LogInformation("🔍 DEBUG: Using GetBacklogForManagerAsync for role '{Role}'", role);
                return await GetBacklogForManagerAsync(userId);
            }
            else
            {
                _logger.LogInformation("🔍 DEBUG: Using GetAllBacklogEntriesAsync for role '{Role}'", role);
                return await GetAllBacklogEntriesAsync();
            }
        }

        public async Task<string> GenerateBacklogNumberAsync()
        {
            var year = DateTime.UtcNow.Year;
            var maxRetries = 10;
            
            for (int attempt = 0; attempt < maxRetries; attempt++)
            {
                var count = await _context.RiskBacklogEntries.CountAsync();
                var candidateNumber = $"RBL-{year}-{(count + 1 + attempt):D5}";
                
                var exists = await _context.RiskBacklogEntries
                    .AnyAsync(b => b.BacklogNumber == candidateNumber);
                    
                if (!exists) return candidateNumber;
            }
            
            throw new InvalidOperationException("Unable to generate unique backlog number after retries");
        }

        public async Task<RiskBacklogEntry> CreateBacklogForRiskAcceptanceAsync(int riskId, string justification, string requesterId)
        {
            return await CreateBacklogEntryAsync(riskId, RiskBacklogAction.RiskAcceptance, 
                $"Risk acceptance request for Risk ID {riskId}", justification, requesterId);
        }

        public async Task<RiskBacklogEntry> CreateBacklogForRiskExtensionAsync(int riskId, DateTime newDueDate, string justification, string requesterId)
        {
            return await CreateBacklogEntryAsync(riskId, RiskBacklogAction.RiskExtension, 
                $"Risk extension request for Risk ID {riskId} - New due date: {newDueDate:yyyy-MM-dd}", justification, requesterId);
        }

        public async Task<RiskBacklogEntry> CreateBacklogForRiskReviewAsync(int riskId, string reviewReason, string requesterId)
        {
            return await CreateBacklogEntryAsync(riskId, RiskBacklogAction.RiskReview, 
                $"Risk review request for Risk ID {riskId}", reviewReason, requesterId);
        }

        public async Task<bool> CanUserAccessBacklogEntryAsync(int backlogId, string userId, string role)
        {
            var entry = await _context.RiskBacklogEntries.FindAsync(backlogId);
            if (entry == null) return false;

            // Admins can access everything
            if (role.Contains("Admin")) return true;

            // Users can access entries they requested
            if (entry.RequesterUserId == userId) return true;

            // Analysts can access entries assigned to them
            if (role.Contains("Analyst") && entry.AssignedToAnalyst == userId) return true;

            // Managers can access entries assigned to them
            if (role.Contains("Manager") && entry.AssignedToManager == userId) return true;

            return false;
        }

        public async Task<bool> CanUserApproveBacklogEntryAsync(int backlogId, string userId, string role)
        {
            var entry = await _context.RiskBacklogEntries.FindAsync(backlogId);
            if (entry == null) return false;

            // Analysts can approve entries assigned to them that are in the correct status
            if (role.Contains("Analyst") && entry.AssignedToAnalyst == userId && entry.Status == RiskBacklogStatus.AssignedToAnalyst)
                return true;

            // Managers can approve entries assigned to them that are in the correct status
            if (role.Contains("Manager") && entry.AssignedToManager == userId && entry.Status == RiskBacklogStatus.AssignedToManager)
                return true;

            return false;
        }

        private BacklogPriority GetDefaultPriority(RiskBacklogAction actionType)
        {
            return actionType switch
            {
                RiskBacklogAction.NewRisk => BacklogPriority.Medium,
                RiskBacklogAction.RiskAcceptance => BacklogPriority.High,
                RiskBacklogAction.RiskExtension => BacklogPriority.Low,
                RiskBacklogAction.RiskReview => BacklogPriority.Medium,
                RiskBacklogAction.RiskReassessment => BacklogPriority.High,
                RiskBacklogAction.NewFinding => BacklogPriority.Medium,
                RiskBacklogAction.FindingReview => BacklogPriority.Medium,
                RiskBacklogAction.FindingClosure => BacklogPriority.Low,
                _ => BacklogPriority.Medium
            };
        }

        private DateTime CalculateDueDate(RiskBacklogAction actionType)
        {
            var baseDays = actionType switch
            {
                RiskBacklogAction.NewRisk => 5, // 5 business days
                RiskBacklogAction.RiskAcceptance => 3,
                RiskBacklogAction.RiskExtension => 2,
                RiskBacklogAction.RiskReview => 7,
                RiskBacklogAction.RiskReassessment => 10,
                RiskBacklogAction.NewFinding => 3, // 3 business days for new findings
                RiskBacklogAction.FindingReview => 5,
                RiskBacklogAction.FindingClosure => 2,
                _ => 5
            };

            return DateTime.UtcNow.AddDays(baseDays);
        }

        private RiskSource? DetermineRiskSource(int? riskId)
        {
            if (riskId == null) return null;

            var risk = _context.Risks
                .Include(r => r.LinkedAssessment)
                .Include(r => r.LinkedFinding)
                .FirstOrDefault(r => r.Id == riskId);

            if (risk?.LinkedAssessment != null) return RiskSource.RiskAssessment;
            if (risk?.LinkedFinding != null) return RiskSource.FindingAcceptance;
            return RiskSource.ManualImport;
        }

        private RiskRating CalculateFindingRiskRating(ImpactLevel impact, LikelihoodLevel likelihood, ExposureLevel exposure)
        {
            // Convert enum values to integers for calculation
            int impactScore = (int)impact;
            int likelihoodScore = (int)likelihood;
            int exposureScore = (int)exposure;

            // Calculate average score
            double averageScore = (impactScore + likelihoodScore + exposureScore) / 3.0;

            // Map average score to risk rating
            return averageScore switch
            {
                >= 4.0 => RiskRating.Critical,
                >= 3.0 => RiskRating.High,
                >= 2.0 => RiskRating.Medium,
                _ => RiskRating.Low
            };
        }

        // Admin Methods Implementation
        public async Task<List<RiskBacklogEntry>> GetOrphanedEntriesAsync()
        {
            return await _context.RiskBacklogEntries
                .Include(b => b.Risk)
                .Where(b => b.RiskId == null)
                .OrderByDescending(b => b.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<RiskBacklogEntry>> GetStuckEntriesAsync()
        {
            var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);
            return await _context.RiskBacklogEntries
                .Include(b => b.Risk)
                .Where(b => (b.Status == RiskBacklogStatus.AssignedToAnalyst || b.Status == RiskBacklogStatus.AssignedToManager) 
                           && b.AssignedDate.HasValue 
                           && b.AssignedDate.Value < sevenDaysAgo)
                .OrderBy(b => b.AssignedDate)
                .ToListAsync();
        }

        public async Task<int> GetRecentErrorsCountAsync()
        {
            // Count orphaned entries created in the last 24 hours as a proxy for errors
            var twentyFourHoursAgo = DateTime.UtcNow.AddHours(-24);
            
            return await _context.RiskBacklogEntries
                .Where(b => b.CreatedAt > twentyFourHoursAgo && b.RiskId == null)
                .CountAsync();
        }

        public async Task<int> GetTotalEntriesCountAsync()
        {
            return await _context.RiskBacklogEntries.CountAsync();
        }

        /// <summary>
        /// Optimized statistics calculation using grouped queries to minimize database round trips
        /// </summary>
        public async Task<BacklogStatistics> GetBacklogStatisticsAsync(string? userId = null, string? role = null)
        {
            var query = _context.RiskBacklogEntries.AsQueryable();
            
            // Apply role-based filtering if needed
            if (!string.IsNullOrEmpty(role) && !role.Contains("Admin"))
            {
                if (role.Contains("Manager") && !string.IsNullOrEmpty(userId))
                {
                    query = query.Where(b => b.AssignedToManager == userId || b.CreatedBy == userId);
                }
                else if (role.Contains("Analyst") && !string.IsNullOrEmpty(userId))
                {
                    query = query.Where(b => b.AssignedToAnalyst == userId || b.CreatedBy == userId);
                }
            }

            // Single query to get all the data we need
            var entries = await query.ToListAsync();

            // Calculate statistics from the in-memory collection
            var now = DateTime.UtcNow;
            var weekStart = now.AddDays(-(int)now.DayOfWeek);
            
            var stats = new BacklogStatistics
            {
                // Basic counts
                TotalEntries = entries.Count,
                Unassigned = entries.Count(e => e.Status == RiskBacklogStatus.Unassigned),
                AssignedToAnalyst = entries.Count(e => e.Status == RiskBacklogStatus.AssignedToAnalyst),
                AssignedToManager = entries.Count(e => e.Status == RiskBacklogStatus.AssignedToManager),
                
                // SLA and completion metrics
                OverdueSLA = entries.Count(e => e.DueDate.HasValue && e.DueDate.Value < now && 
                                               e.Status != RiskBacklogStatus.Approved && 
                                               e.Status != RiskBacklogStatus.Rejected),
                CompletedThisWeek = entries.Count(e => (e.Status == RiskBacklogStatus.Approved || 
                                                       e.Status == RiskBacklogStatus.Rejected) && 
                                                       e.UpdatedAt >= weekStart),
                CompletedThisMonth = entries.Count(e => (e.Status == RiskBacklogStatus.Approved || 
                                                        e.Status == RiskBacklogStatus.Rejected) && 
                                                        e.UpdatedAt >= now.AddDays(-30)),
                RejectedThisMonth = entries.Count(e => e.Status == RiskBacklogStatus.Rejected && 
                                                      e.UpdatedAt >= now.AddDays(-30)),
                
                // Finding vs Risk breakdown
                TotalFindings = entries.Count(e => e.IsFindingWorkflow()),
                TotalRisks = entries.Count(e => e.IsRiskWorkflow()),
                UnassignedFindings = entries.Count(e => e.IsFindingWorkflow() && 
                                                       e.Status == RiskBacklogStatus.Unassigned),
                UnassignedRisks = entries.Count(e => e.IsRiskWorkflow() && 
                                                   e.Status == RiskBacklogStatus.Unassigned),
                CompletedFindingsThisWeek = entries.Count(e => e.IsFindingWorkflow() && 
                                                             (e.Status == RiskBacklogStatus.Approved || 
                                                              e.Status == RiskBacklogStatus.Rejected) && 
                                                             e.UpdatedAt >= weekStart),
                CompletedRisksThisWeek = entries.Count(e => e.IsRiskWorkflow() && 
                                                          (e.Status == RiskBacklogStatus.Approved || 
                                                           e.Status == RiskBacklogStatus.Rejected) && 
                                                          e.UpdatedAt >= weekStart),

                // Action type breakdown
                ActionTypeCounts = entries.GroupBy(e => e.ActionType)
                                         .ToDictionary(g => g.Key, g => g.Count()),
                
                // Priority breakdown
                PriorityCounts = entries.GroupBy(e => e.Priority)
                                       .ToDictionary(g => g.Key, g => g.Count()),
                
                // Performance metrics (calculated from completed entries)
                AvgAnalystProcessingDays = CalculateAverageProcessingDays(entries, RiskBacklogStatus.AssignedToAnalyst),
                AvgManagerProcessingDays = CalculateAverageProcessingDays(entries, RiskBacklogStatus.AssignedToManager),
                SLAComplianceRate = CalculateSLAComplianceRate(entries),
                
                // Top assignees (for workload balancing)
                TopAnalysts = entries.Where(e => !string.IsNullOrEmpty(e.AssignedToAnalyst))
                                    .GroupBy(e => e.AssignedToAnalyst!)
                                    .OrderByDescending(g => g.Count())
                                    .Take(5)
                                    .ToDictionary(g => g.Key, g => g.Count()),
                                    
                TopManagers = entries.Where(e => !string.IsNullOrEmpty(e.AssignedToManager))
                                    .GroupBy(e => e.AssignedToManager!)
                                    .OrderByDescending(g => g.Count())
                                    .Take(5)
                                    .ToDictionary(g => g.Key, g => g.Count())
            };

            return stats;
        }

        private static double CalculateAverageProcessingDays(List<RiskBacklogEntry> entries, RiskBacklogStatus status)
        {
            var relevantEntries = entries.Where(e => e.Status == RiskBacklogStatus.Approved && 
                                                    e.AssignedDate.HasValue).ToList();
            
            if (!relevantEntries.Any()) return 0;
            
            var totalDays = relevantEntries.Sum(e => (e.UpdatedAt - e.AssignedDate!.Value).TotalDays);
            return totalDays / relevantEntries.Count;
        }

        private static double CalculateSLAComplianceRate(List<RiskBacklogEntry> entries)
        {
            var entriesWithSLA = entries.Where(e => e.DueDate.HasValue).ToList();
            if (!entriesWithSLA.Any()) return 100.0;
            
            var compliantEntries = entriesWithSLA.Count(e => 
                e.Status == RiskBacklogStatus.Approved && e.UpdatedAt <= e.DueDate!.Value);
                
            return (compliantEntries / (double)entriesWithSLA.Count) * 100.0;
        }

        /// <summary>
        /// Creates a Risk entity from the serialized risk data stored in a backlog entry's RequestDescription
        /// </summary>
        private async Task<Risk> CreateRiskFromBacklogEntryAsync(RiskBacklogEntry entry, string approverId)
        {
            if (string.IsNullOrEmpty(entry.RequestDescription))
            {
                throw new InvalidOperationException("Backlog entry does not contain risk data");
            }

            try
            {
                // Deserialize the risk data from JSON
                var riskData = JsonSerializer.Deserialize<JsonElement>(entry.RequestDescription);
                
                // Create the Risk object from deserialized data
                var risk = new Risk
                {
                    Title = GetStringProperty(riskData, "Title") ?? "Risk from Backlog Entry",
                    Description = GetStringProperty(riskData, "Description") ?? "",
                    ThreatScenario = GetStringProperty(riskData, "ThreatScenario") ?? "",
                    Asset = GetStringProperty(riskData, "Asset") ?? "",
                    BusinessUnit = GetStringProperty(riskData, "BusinessUnit") ?? "",
                    Owner = GetStringProperty(riskData, "Owner") ?? approverId,
                    
                    // Map assessment/scenario IDs if they exist
                    RiskAssessmentId = GetIntProperty(riskData, "RiskAssessmentId"),
                    ThreatScenarioId = GetIntProperty(riskData, "ThreatScenarioId"),
                    
                    // Set risk properties from deserialized data
                    Impact = GetEnumProperty<ImpactLevel>(riskData, "Impact", ImpactLevel.Medium),
                    Likelihood = GetEnumProperty<LikelihoodLevel>(riskData, "Likelihood", LikelihoodLevel.Possible),
                    Exposure = GetEnumProperty<ExposureLevel>(riskData, "Exposure", ExposureLevel.ModeratelyExposed),
                    InherentRiskLevel = GetEnumProperty<RiskLevel>(riskData, "InherentRiskLevel", RiskLevel.Medium),
                    RiskLevel = GetEnumProperty<RiskLevel>(riskData, "RiskLevel", RiskLevel.Medium),
                    
                    // Set status to Open since it's approved
                    Status = RiskStatus.Open,
                    OpenDate = DateTime.UtcNow,
                    NextReviewDate = DateTime.Today.AddMonths(6), // Default 6-month review cycle
                    Treatment = TreatmentStrategy.Mitigate, // Default treatment
                    
                    // Audit fields
                    CreatedBy = approverId,
                    UpdatedBy = approverId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                // Generate risk number and create the risk
                risk.RiskNumber = await _riskService.GenerateNextRiskNumberAsync();
                var createdRisk = await _riskService.CreateRiskAsync(risk);
                
                return createdRisk;
            }
            catch (JsonException ex)
            {
                throw new InvalidOperationException($"Failed to parse risk data from backlog entry: {ex.Message}", ex);
            }
        }
        
        // Helper methods for safe property extraction from JSON
        private string? GetStringProperty(JsonElement jsonElement, string propertyName)
        {
            if (jsonElement.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String)
            {
                return property.GetString();
            }
            return null;
        }
        
        private int? GetIntProperty(JsonElement jsonElement, string propertyName)
        {
            if (jsonElement.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.Number)
            {
                return property.GetInt32();
            }
            return null;
        }
        
        private T GetEnumProperty<T>(JsonElement jsonElement, string propertyName, T defaultValue) where T : struct, Enum
        {
            if (jsonElement.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.Number)
            {
                var intValue = property.GetInt32();
                if (Enum.IsDefined(typeof(T), intValue))
                {
                    return (T)Enum.ToObject(typeof(T), intValue);
                }
            }
            return defaultValue;
        }

        /// <summary>
        /// Creates a Finding entity from a finding backlog entry
        /// </summary>
        private async Task<Finding> CreateFindingFromBacklogEntryAsync(RiskBacklogEntry entry, string approverId)
        {
            if (!entry.IsFindingWorkflow())
            {
                throw new InvalidOperationException("Backlog entry is not a finding workflow entry");
            }

            try
            {
                // Create the Finding object from backlog entry data
                var finding = new Finding
                {
                    Title = entry.FindingTitle ?? "Finding from Backlog Entry",
                    Details = entry.FindingDetails ?? "",
                    Asset = entry.Asset ?? "",
                    BusinessUnit = entry.BusinessUnit ?? "",
                    BusinessOwner = entry.BusinessOwner ?? approverId,
                    Domain = entry.Domain ?? "",
                    TechnicalControl = entry.TechnicalControl ?? "",
                    Owner = entry.BusinessOwner ?? approverId,
                    
                    // Risk assessment fields
                    Impact = entry.Impact ?? ImpactLevel.Medium,
                    Likelihood = entry.Likelihood ?? LikelihoodLevel.Possible,
                    Exposure = entry.Exposure ?? ExposureLevel.ModeratelyExposed,
                    RiskRating = entry.RiskRating ?? RiskRating.Medium,
                    
                    // Set status to Open since it's approved
                    Status = FindingStatus.Open,
                    OpenDate = DateTime.UtcNow,
                    SlaDate = DateTime.UtcNow.AddDays(30), // Default 30-day remediation period
                    
                    // Audit fields
                    CreatedBy = approverId,
                    UpdatedBy = approverId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.Findings.Add(finding);
                await _context.SaveChangesAsync();
                
                return finding;
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Failed to create finding from backlog entry: {ex.Message}", ex);
            }
        }

        // New methods for re-assignment functionality
        public async Task<RiskBacklogEntry> UnassignEntryAsync(int backlogId, string userId)
        {
            _logger.LogInformation("UnassignEntryAsync called: BacklogId={BacklogId}, UserId={UserId}", backlogId, userId);

            try
            {
                _logger.LogInformation("Fetching backlog entry with ID: {BacklogId}", backlogId);
                var entry = await _context.RiskBacklogEntries
                    .Include(e => e.Risk)
                    .FirstOrDefaultAsync(e => e.Id == backlogId);

                if (entry == null)
                {
                    _logger.LogError("Backlog entry with ID {BacklogId} not found in database", backlogId);
                    throw new ArgumentException($"Backlog entry with ID {backlogId} not found", nameof(backlogId));
                }

                _logger.LogInformation("Found backlog entry {BacklogNumber}, current status: {Status}, current analyst: {CurrentAnalyst}, current manager: {CurrentManager}", 
                    entry.BacklogNumber, entry.Status, entry.AssignedToAnalyst ?? "None", entry.AssignedToManager ?? "None");

                // Store previous state for logging
                var previousStatus = entry.Status;
                var previousAssignee = entry.GetCurrentAssignee();
                _logger.LogInformation("Previous status: {PreviousStatus}, Previous assignee: {PreviousAssignee}", previousStatus, previousAssignee);

                // Reset to unassigned state
                entry.Status = RiskBacklogStatus.Unassigned;
                entry.UpdatedAt = DateTime.UtcNow;
                entry.UpdatedBy = userId;
                entry.AssignedToAnalyst = null;
                entry.AssignedToManager = null;
                entry.AssignedDate = null;

                _logger.LogInformation("Updated entry to unassigned state, logging activity...");

                // Log the activity
                await LogActivityAsync(backlogId, "Unassigned", $"From: {previousAssignee}", "Unassigned", $"Entry unassigned by {userId}", userId);

                _logger.LogInformation("Activity logged, saving changes to database...");
                await _context.SaveChangesAsync();
                
                _logger.LogInformation("Successfully unassigned backlog entry {BacklogId}", backlogId);
                return entry;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in UnassignEntryAsync for BacklogId={BacklogId}: {Message} | StackTrace: {StackTrace}", 
                    backlogId, ex.Message, ex.StackTrace);
                throw;
            }
        }

    }
}