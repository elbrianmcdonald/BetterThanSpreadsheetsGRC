using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IRiskBacklogService
    {
        // Backlog Entry Management
        Task<RiskBacklogEntry> CreateBacklogEntryAsync(int? riskId, RiskBacklogAction actionType, string description, string justification, string requesterId);
        
        // Finding Backlog Management
        Task<RiskBacklogEntry> CreateFindingBacklogEntryAsync(
            string title, string details, string source, 
            ImpactLevel impact, LikelihoodLevel likelihood, ExposureLevel exposure,
            string asset, string businessUnit, string businessOwner, string domain, string technicalControl,
            string requesterId);
        Task<RiskBacklogEntry?> GetBacklogEntryByIdAsync(int id);
        Task<RiskBacklogEntry> AssignToAnalystAsync(int backlogId, string analystId, string assignedBy);
        Task<RiskBacklogEntry> AssignToManagerAsync(int backlogId, string managerId, string assignedBy);
        Task<RiskBacklogEntry> SetPriorityAsync(int backlogId, BacklogPriority priority, string userId);
        
        // Workflow Actions
        Task<RiskBacklogEntry> AnalystApproveAsync(int backlogId, string comments, string analystId);
        Task<RiskBacklogEntry> AnalystRejectAsync(int backlogId, string reason, string analystId);
        Task<RiskBacklogEntry> ManagerApproveAsync(int backlogId, string comments, string managerId);
        Task<RiskBacklogEntry> ManagerRejectAsync(int backlogId, string reason, string managerId);
        Task<RiskBacklogEntry> EscalateAsync(int backlogId, string reason, string userId);
        Task<RiskBacklogEntry> UnassignEntryAsync(int backlogId, string userId);
        
        // Comment Management
        Task<RiskBacklogComment> AddCommentAsync(int backlogId, string comment, string commentType, bool isInternal, string userId);
        Task<List<RiskBacklogComment>> GetCommentsAsync(int backlogId, bool includeInternal = false);
        
        // Activity Tracking
        Task LogActivityAsync(int backlogId, string activityType, string fromValue, string toValue, string description, string userId);
        Task<List<RiskBacklogActivity>> GetActivitiesAsync(int backlogId);
        
        // Query Methods
        Task<List<RiskBacklogEntry>> GetBacklogForAnalystAsync(string analystId);
        Task<List<RiskBacklogEntry>> GetBacklogForManagerAsync(string managerId);
        Task<List<RiskBacklogEntry>> GetUnassignedBacklogAsync();
        Task<List<RiskBacklogEntry>> GetSLABreachedBacklogAsync();
        Task<List<RiskBacklogEntry>> GetBacklogByStatusAsync(RiskBacklogStatus status);
        Task<List<RiskBacklogEntry>> GetBacklogByActionTypeAsync(RiskBacklogAction actionType);
        Task<List<RiskBacklogEntry>> GetAllBacklogEntriesAsync(string? filterBy = null, string? filterValue = null);
        
        // Bulk Operations
        Task<int> BulkAssignToAnalystAsync(List<int> backlogIds, string analystId, string assignedBy);
        Task<int> BulkAssignToManagerAsync(List<int> backlogIds, string managerId, string assignedBy);
        Task<int> BulkApproveByManagerAsync(List<int> backlogIds, string comments, string managerId);
        Task<int> BulkSetPriorityAsync(List<int> backlogIds, BacklogPriority priority, string userId);
        
        // SLA Management
        Task UpdateSLAStatusAsync();
        Task<List<RiskBacklogEntry>> GetDueBacklogEntriesAsync(int daysAhead = 3);
        Task<List<RiskBacklogEntry>> GetOverdueBacklogEntriesAsync();
        Task<List<RiskBacklogEntry>> GetCompletedThisWeekBacklogEntriesAsync();
        
        // Statistics and Reporting
        Task<BacklogStatistics> GetBacklogStatisticsAsync(string? userId = null, string? role = null);
        Task<List<RiskBacklogEntry>> GetBacklogForUserAsync(string userId, string role);
        
        // Number Generation
        Task<string> GenerateBacklogNumberAsync();
        
        // Risk Management Integration
        Task<RiskBacklogEntry> CreateBacklogForRiskAcceptanceAsync(int riskId, string justification, string requesterId);
        Task<RiskBacklogEntry> CreateBacklogForRiskExtensionAsync(int riskId, DateTime newDueDate, string justification, string requesterId);
        Task<RiskBacklogEntry> CreateBacklogForRiskReviewAsync(int riskId, string reviewReason, string requesterId);
        
        // Validation
        Task<bool> CanUserAccessBacklogEntryAsync(int backlogId, string userId, string role);
        Task<bool> CanUserApproveBacklogEntryAsync(int backlogId, string userId, string role);
        
        // Admin Methods
        Task<List<RiskBacklogEntry>> GetOrphanedEntriesAsync();
        Task<List<RiskBacklogEntry>> GetStuckEntriesAsync();
        Task<int> GetRecentErrorsCountAsync();
        Task<int> GetTotalEntriesCountAsync();
    }
}