using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Repositories
{
    /// <summary>
    /// Repository implementation for Finding entities
    /// </summary>
    public class FindingRepository : Repository<Finding>, IFindingRepository
    {
        public FindingRepository(CyberRiskContext context) : base(context)
        {
        }

        // Finding-specific queries
        public async Task<IEnumerable<Finding>> GetFindingsByStatusAsync(FindingStatus status)
        {
            return await _dbSet
                .Where(f => f.Status == status)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Finding>> GetFindingsByDomainAsync(string domain)
        {
            return await _dbSet
                .Where(f => f.Domain == domain)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Finding>> GetFindingsByAssetAsync(string asset)
        {
            return await _dbSet
                .Where(f => f.Asset == asset)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Finding>> GetFindingsByBusinessUnitAsync(string businessUnit)
        {
            return await _dbSet
                .Where(f => f.BusinessUnit == businessUnit)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Finding>> GetFindingsByAssigneeAsync(string assignedTo)
        {
            return await _dbSet
                .Where(f => f.AssignedTo == assignedTo)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Finding>> GetFindingsByRiskRatingAsync(RiskRating riskRating)
        {
            return await _dbSet
                .Where(f => f.RiskRating == riskRating)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Finding>> GetOverdueFindingsAsync()
        {
            return await _dbSet
                .Where(f => f.IsOverdue)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();
        }

        // Advanced finding queries
        public async Task<IEnumerable<Finding>> GetRecentFindingsAsync(int count = 10)
        {
            return await _dbSet
                .OrderByDescending(f => f.CreatedAt)
                .Take(count)
                .ToListAsync();
        }

        public async Task<IEnumerable<Finding>> GetCriticalFindingsAsync()
        {
            return await _dbSet
                .Where(f => f.RiskRating == RiskRating.Critical)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Finding>> GetFindingsWithFiltersAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? businessUnit = null,
            string? domain = null,
            string? asset = null,
            string? assignedTo = null,
            RiskRating? minRiskRating = null,
            FindingStatus? status = null,
            bool? showOverdueOnly = null)
        {
            var query = _dbSet.AsQueryable();

            if (startDate.HasValue)
                query = query.Where(f => f.CreatedAt >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(f => f.CreatedAt <= endDate.Value.AddDays(1));

            if (!string.IsNullOrEmpty(businessUnit))
                query = query.Where(f => f.BusinessUnit == businessUnit);

            if (!string.IsNullOrEmpty(domain))
                query = query.Where(f => f.Domain == domain);

            if (!string.IsNullOrEmpty(asset))
                query = query.Where(f => f.Asset == asset);

            if (!string.IsNullOrEmpty(assignedTo))
                query = query.Where(f => f.AssignedTo == assignedTo);

            if (minRiskRating.HasValue)
                query = query.Where(f => f.RiskRating >= minRiskRating.Value);

            if (status.HasValue)
                query = query.Where(f => f.Status == status.Value);

            if (showOverdueOnly == true)
                query = query.Where(f => f.IsOverdue);

            return await query
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();
        }

        // Statistical queries
        public async Task<Dictionary<FindingStatus, int>> GetFindingsCountByStatusAsync()
        {
            return await _dbSet
                .GroupBy(f => f.Status)
                .ToDictionaryAsync(g => g.Key, g => g.Count());
        }

        public async Task<Dictionary<RiskRating, int>> GetFindingsCountByRiskRatingAsync()
        {
            return await _dbSet
                .GroupBy(f => f.RiskRating)
                .ToDictionaryAsync(g => g.Key, g => g.Count());
        }

        public async Task<Dictionary<string, int>> GetFindingsCountByDomainAsync()
        {
            return await _dbSet
                .Where(f => !string.IsNullOrEmpty(f.Domain))
                .GroupBy(f => f.Domain!)
                .ToDictionaryAsync(g => g.Key, g => g.Count());
        }

        public async Task<Dictionary<string, int>> GetFindingsCountByAssetAsync()
        {
            return await _dbSet
                .Where(f => !string.IsNullOrEmpty(f.Asset))
                .GroupBy(f => f.Asset!)
                .ToDictionaryAsync(g => g.Key, g => g.Count());
        }

        // Business logic operations
        public async Task<bool> UpdateFindingStatusAsync(int findingId, FindingStatus newStatus, string userId)
        {
            var finding = await GetByIdAsync(findingId);
            if (finding == null) return false;

            finding.Status = newStatus;
            await UpdateAsync(finding, userId);
            return true;
        }

        public async Task<bool> AssignFindingAsync(int findingId, string assignedTo, string userId)
        {
            var finding = await GetByIdAsync(findingId);
            if (finding == null) return false;

            finding.AssignedTo = assignedTo;
            await UpdateAsync(finding, userId);
            return true;
        }

        public async Task<bool> UpdateRiskRatingAsync(int findingId, RiskRating newRating, string userId)
        {
            var finding = await GetByIdAsync(findingId);
            if (finding == null) return false;

            finding.RiskRating = newRating;
            await UpdateAsync(finding, userId);
            return true;
        }

        public async Task<int> BulkUpdateStatusAsync(IEnumerable<int> findingIds, FindingStatus newStatus, string userId)
        {
            var findings = await _dbSet
                .Where(f => findingIds.Contains(f.Id))
                .ToListAsync();

            foreach (var finding in findings)
            {
                finding.Status = newStatus;
                finding.UpdatedAt = DateTime.UtcNow;
                finding.UpdatedBy = userId;
            }

            await _context.SaveChangesAsync();
            return findings.Count;
        }
    }
}