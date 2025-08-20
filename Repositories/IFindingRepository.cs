using CyberRiskApp.Models;
using System.Linq.Expressions;

namespace CyberRiskApp.Repositories
{
    /// <summary>
    /// Repository interface for Finding entities with domain-specific operations
    /// </summary>
    public interface IFindingRepository : IRepository<Finding>
    {
        // Finding-specific queries
        Task<IEnumerable<Finding>> GetFindingsByStatusAsync(FindingStatus status);
        Task<IEnumerable<Finding>> GetFindingsByDomainAsync(string domain);
        Task<IEnumerable<Finding>> GetFindingsByAssetAsync(string asset);
        Task<IEnumerable<Finding>> GetFindingsByBusinessUnitAsync(string businessUnit);
        Task<IEnumerable<Finding>> GetFindingsByAssigneeAsync(string assignedTo);
        Task<IEnumerable<Finding>> GetFindingsByRiskRatingAsync(RiskRating riskRating);
        Task<IEnumerable<Finding>> GetOverdueFindingsAsync();
        
        // Advanced finding queries
        Task<IEnumerable<Finding>> GetRecentFindingsAsync(int count = 10);
        Task<IEnumerable<Finding>> GetCriticalFindingsAsync();
        Task<IEnumerable<Finding>> GetFindingsWithFiltersAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? businessUnit = null,
            string? domain = null,
            string? asset = null,
            string? assignedTo = null,
            RiskRating? minRiskRating = null,
            FindingStatus? status = null,
            bool? showOverdueOnly = null);
        
        // Statistical queries
        Task<Dictionary<FindingStatus, int>> GetFindingsCountByStatusAsync();
        Task<Dictionary<RiskRating, int>> GetFindingsCountByRiskRatingAsync();
        Task<Dictionary<string, int>> GetFindingsCountByDomainAsync();
        Task<Dictionary<string, int>> GetFindingsCountByAssetAsync();
        
        // Business logic operations
        Task<bool> UpdateFindingStatusAsync(int findingId, FindingStatus newStatus, string userId);
        Task<bool> AssignFindingAsync(int findingId, string assignedTo, string userId);
        Task<bool> UpdateRiskRatingAsync(int findingId, RiskRating newRating, string userId);
        Task<int> BulkUpdateStatusAsync(IEnumerable<int> findingIds, FindingStatus newStatus, string userId);
    }
}