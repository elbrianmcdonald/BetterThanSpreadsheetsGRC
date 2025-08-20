using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Repositories
{
    /// <summary>
    /// Repository implementation for Risk entities
    /// </summary>
    public class RiskRepository : Repository<Risk>, IRiskRepository
    {
        public RiskRepository(CyberRiskContext context) : base(context)
        {
        }

        // Risk-specific queries
        public async Task<IEnumerable<Risk>> GetRisksByLevelAsync(RiskLevel level)
        {
            return await _dbSet
                .Where(r => r.RiskLevel == level)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Risk>> GetRisksByStatusAsync(RiskStatus status)
        {
            return await _dbSet
                .Where(r => r.Status == status)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Risk>> GetRisksByBusinessUnitAsync(string businessUnit)
        {
            return await _dbSet
                .Where(r => r.BusinessUnit == businessUnit)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Risk>> GetRisksByAssetAsync(string asset)
        {
            return await _dbSet
                .Where(r => r.Asset == asset)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Risk>> GetRisksByOwnerAsync(string owner)
        {
            return await _dbSet
                .Where(r => r.Owner == owner)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Risk>> GetHighValueRisksAsync()
        {
            return await _dbSet
                .Where(r => r.RiskLevel >= RiskLevel.High)
                .OrderByDescending(r => r.RiskLevel)
                .ThenByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Risk>> GetCriticalRisksAsync()
        {
            return await _dbSet
                .Where(r => r.RiskLevel == RiskLevel.Critical)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        // Advanced risk queries
        public async Task<IEnumerable<Risk>> GetRecentRisksAsync(int count = 10)
        {
            return await _dbSet
                .OrderByDescending(r => r.CreatedAt)
                .Take(count)
                .ToListAsync();
        }

        public async Task<IEnumerable<Risk>> GetRisksWithFiltersAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? businessUnit = null,
            string? asset = null,
            string? owner = null,
            RiskLevel? minRiskLevel = null,
            RiskStatus? status = null,
            bool? showCriticalOnly = null)
        {
            var query = _dbSet.AsQueryable();

            if (startDate.HasValue)
                query = query.Where(r => r.CreatedAt >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(r => r.CreatedAt <= endDate.Value.AddDays(1));

            if (!string.IsNullOrEmpty(businessUnit))
                query = query.Where(r => r.BusinessUnit == businessUnit);

            if (!string.IsNullOrEmpty(asset))
                query = query.Where(r => r.Asset == asset);

            if (!string.IsNullOrEmpty(owner))
                query = query.Where(r => r.Owner == owner);

            if (minRiskLevel.HasValue)
                query = query.Where(r => r.RiskLevel >= minRiskLevel.Value);

            if (status.HasValue)
                query = query.Where(r => r.Status == status.Value);

            if (showCriticalOnly == true)
                query = query.Where(r => r.RiskLevel == RiskLevel.Critical);

            return await query
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        // Statistical queries
        public async Task<Dictionary<RiskLevel, int>> GetRisksCountByLevelAsync()
        {
            return await _dbSet
                .GroupBy(r => r.RiskLevel)
                .ToDictionaryAsync(g => g.Key, g => g.Count());
        }

        public async Task<Dictionary<RiskStatus, int>> GetRisksCountByStatusAsync()
        {
            return await _dbSet
                .GroupBy(r => r.Status)
                .ToDictionaryAsync(g => g.Key, g => g.Count());
        }

        public async Task<Dictionary<string, int>> GetRisksCountByBusinessUnitAsync()
        {
            return await _dbSet
                .Where(r => !string.IsNullOrEmpty(r.BusinessUnit))
                .GroupBy(r => r.BusinessUnit!)
                .ToDictionaryAsync(g => g.Key, g => g.Count());
        }

        public async Task<Dictionary<string, int>> GetRisksCountByAssetAsync()
        {
            return await _dbSet
                .Where(r => !string.IsNullOrEmpty(r.Asset))
                .GroupBy(r => r.Asset!)
                .ToDictionaryAsync(g => g.Key, g => g.Count());
        }

        public async Task<decimal> GetTotalALEAsync()
        {
            // Note: ALE functionality was removed - using qualitative risk assessment
            // Return 0 for backward compatibility
            return 0;
        }

        public async Task<Dictionary<RiskLevel, decimal>> GetALEByRiskLevelAsync()
        {
            // Note: ALE functionality was removed - using qualitative risk assessment
            // Return empty dictionary for backward compatibility
            var riskLevels = await GetRisksCountByLevelAsync();
            return riskLevels.ToDictionary(kvp => kvp.Key, kvp => 0m);
        }

        // Risk assessment operations
        public async Task<bool> UpdateRiskLevelAsync(int riskId, RiskLevel newLevel, string userId)
        {
            var risk = await GetByIdAsync(riskId);
            if (risk == null) return false;

            risk.RiskLevel = newLevel;
            await UpdateAsync(risk, userId);
            return true;
        }

        public async Task<bool> UpdateRiskStatusAsync(int riskId, RiskStatus newStatus, string userId)
        {
            var risk = await GetByIdAsync(riskId);
            if (risk == null) return false;

            risk.Status = newStatus;
            await UpdateAsync(risk, userId);
            return true;
        }

        public async Task<bool> AssignRiskOwnerAsync(int riskId, string owner, string userId)
        {
            var risk = await GetByIdAsync(riskId);
            if (risk == null) return false;

            risk.Owner = owner;
            await UpdateAsync(risk, userId);
            return true;
        }

        public async Task<bool> AcceptRiskAsync(int riskId, string acceptedBy, string justification, string userId)
        {
            var risk = await GetByIdAsync(riskId);
            if (risk == null) return false;

            risk.Status = RiskStatus.Accepted;
            // Note: Add acceptance fields if they exist in the model
            await UpdateAsync(risk, userId);
            return true;
        }

        public async Task<int> BulkUpdateStatusAsync(IEnumerable<int> riskIds, RiskStatus newStatus, string userId)
        {
            var risks = await _dbSet
                .Where(r => riskIds.Contains(r.Id))
                .ToListAsync();

            foreach (var risk in risks)
            {
                risk.Status = newStatus;
                risk.UpdatedAt = DateTime.UtcNow;
                risk.UpdatedBy = userId;
            }

            await _context.SaveChangesAsync();
            return risks.Count;
        }

        // Compliance and governance
        public async Task<IEnumerable<Risk>> GetRisksRequiringReviewAsync()
        {
            return await _dbSet
                .Where(r => r.Status == RiskStatus.UnderReview || 
                           r.RiskLevel >= RiskLevel.High)
                .OrderByDescending(r => r.RiskLevel)
                .ThenByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Risk>> GetAcceptedRisksAsync()
        {
            return await _dbSet
                .Where(r => r.Status == RiskStatus.Accepted)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Risk>> GetExpiredRisksAsync()
        {
            // Assuming there's a review date or expiration field
            // For now, return risks that are accepted but may need review
            return await _dbSet
                .Where(r => r.Status == RiskStatus.Accepted && 
                           r.CreatedAt < DateTime.UtcNow.AddMonths(-12))
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }
    }
}