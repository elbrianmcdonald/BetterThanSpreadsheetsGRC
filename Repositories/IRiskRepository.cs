using CyberRiskApp.Models;
using System.Linq.Expressions;

namespace CyberRiskApp.Repositories
{
    /// <summary>
    /// Repository interface for Risk entities with domain-specific operations
    /// </summary>
    public interface IRiskRepository : IRepository<Risk>
    {
        // Risk-specific queries
        Task<IEnumerable<Risk>> GetRisksByLevelAsync(RiskLevel level);
        Task<IEnumerable<Risk>> GetRisksByStatusAsync(RiskStatus status);
        Task<IEnumerable<Risk>> GetRisksByBusinessUnitAsync(string businessUnit);
        Task<IEnumerable<Risk>> GetRisksByAssetAsync(string asset);
        Task<IEnumerable<Risk>> GetRisksByOwnerAsync(string owner);
        Task<IEnumerable<Risk>> GetHighValueRisksAsync();
        Task<IEnumerable<Risk>> GetCriticalRisksAsync();
        
        // Advanced risk queries
        Task<IEnumerable<Risk>> GetRecentRisksAsync(int count = 10);
        Task<IEnumerable<Risk>> GetRisksWithFiltersAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? businessUnit = null,
            string? asset = null,
            string? owner = null,
            RiskLevel? minRiskLevel = null,
            RiskStatus? status = null,
            bool? showCriticalOnly = null);
        
        // Statistical queries
        Task<Dictionary<RiskLevel, int>> GetRisksCountByLevelAsync();
        Task<Dictionary<RiskStatus, int>> GetRisksCountByStatusAsync();
        Task<Dictionary<string, int>> GetRisksCountByBusinessUnitAsync();
        Task<Dictionary<string, int>> GetRisksCountByAssetAsync();
        Task<decimal> GetTotalALEAsync();
        Task<Dictionary<RiskLevel, decimal>> GetALEByRiskLevelAsync();
        
        // Risk assessment operations
        Task<bool> UpdateRiskLevelAsync(int riskId, RiskLevel newLevel, string userId);
        Task<bool> UpdateRiskStatusAsync(int riskId, RiskStatus newStatus, string userId);
        Task<bool> AssignRiskOwnerAsync(int riskId, string owner, string userId);
        Task<bool> AcceptRiskAsync(int riskId, string acceptedBy, string justification, string userId);
        Task<int> BulkUpdateStatusAsync(IEnumerable<int> riskIds, RiskStatus newStatus, string userId);
        
        // Compliance and governance
        Task<IEnumerable<Risk>> GetRisksRequiringReviewAsync();
        Task<IEnumerable<Risk>> GetAcceptedRisksAsync();
        Task<IEnumerable<Risk>> GetExpiredRisksAsync();
    }
}