using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class DomainService : IDomainService
    {
        private readonly CyberRiskContext _context;
        private readonly ILogger<DomainService> _logger;

        public DomainService(CyberRiskContext context, ILogger<DomainService> logger)
        {
            _context = context;
            _logger = logger;
        }

        // Application Domain Management
        public async Task<ApplicationDomain?> GetPrimaryDomainAsync()
        {
            return await _context.ApplicationDomains
                .Where(d => d.IsPrimary && d.IsActive)
                .FirstOrDefaultAsync();
        }

        public async Task<IEnumerable<ApplicationDomain>> GetAllDomainsAsync()
        {
            return await _context.ApplicationDomains
                .Include(d => d.Aliases)
                .OrderByDescending(d => d.IsPrimary)
                .ThenBy(d => d.DomainName)
                .ToListAsync();
        }

        public async Task<ApplicationDomain?> GetDomainByIdAsync(int id)
        {
            return await _context.ApplicationDomains
                .Include(d => d.Aliases)
                .FirstOrDefaultAsync(d => d.Id == id);
        }

        public async Task<ApplicationDomain?> GetDomainByNameAsync(string domainName)
        {
            return await _context.ApplicationDomains
                .Include(d => d.Aliases)
                .FirstOrDefaultAsync(d => d.DomainName.ToLower() == domainName.ToLower());
        }

        public async Task<ApplicationDomain> CreateDomainAsync(ApplicationDomain domain)
        {
            domain.CreatedAt = DateTime.UtcNow;
            
            // If this is set as primary, ensure no other domain is primary
            if (domain.IsPrimary)
            {
                await ClearPrimaryDomainAsync();
            }

            _context.ApplicationDomains.Add(domain);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation($"Created application domain: {domain.DomainName}");
            return domain;
        }

        public async Task<ApplicationDomain> UpdateDomainAsync(ApplicationDomain domain)
        {
            domain.UpdatedAt = DateTime.UtcNow;
            
            // If this is being set as primary, ensure no other domain is primary
            if (domain.IsPrimary)
            {
                await ClearPrimaryDomainAsync(domain.Id);
            }

            _context.ApplicationDomains.Update(domain);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation($"Updated application domain: {domain.DomainName}");
            return domain;
        }

        public async Task<bool> DeleteDomainAsync(int id)
        {
            var domain = await _context.ApplicationDomains.FindAsync(id);
            if (domain == null) return false;

            // Don't allow deleting the primary domain if it's the only one
            if (domain.IsPrimary)
            {
                var otherDomains = await _context.ApplicationDomains
                    .Where(d => d.Id != id && d.IsActive)
                    .CountAsync();
                
                if (otherDomains == 0)
                {
                    _logger.LogWarning($"Cannot delete primary domain {domain.DomainName} - it's the only active domain");
                    return false;
                }
            }

            _context.ApplicationDomains.Remove(domain);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation($"Deleted application domain: {domain.DomainName}");
            return true;
        }

        public async Task<bool> SetPrimaryDomainAsync(int domainId)
        {
            var domain = await _context.ApplicationDomains.FindAsync(domainId);
            if (domain == null || !domain.IsActive) return false;

            await ClearPrimaryDomainAsync();
            
            domain.IsPrimary = true;
            domain.UpdatedAt = DateTime.UtcNow;
            
            await _context.SaveChangesAsync();
            
            _logger.LogInformation($"Set primary domain to: {domain.DomainName}");
            return true;
        }

        // Domain Aliases Management
        public async Task<IEnumerable<DomainAlias>> GetDomainAliasesAsync(int domainId)
        {
            return await _context.DomainAliases
                .Where(a => a.ApplicationDomainId == domainId)
                .OrderBy(a => a.AliasName)
                .ToListAsync();
        }

        public async Task<DomainAlias?> GetAliasAsync(int aliasId)
        {
            return await _context.DomainAliases
                .Include(a => a.ApplicationDomain)
                .FirstOrDefaultAsync(a => a.Id == aliasId);
        }

        public async Task<DomainAlias> CreateAliasAsync(DomainAlias alias)
        {
            alias.CreatedAt = DateTime.UtcNow;
            
            _context.DomainAliases.Add(alias);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation($"Created domain alias: {alias.AliasName}");
            return alias;
        }

        public async Task<DomainAlias> UpdateAliasAsync(DomainAlias alias)
        {
            alias.UpdatedAt = DateTime.UtcNow;
            
            _context.DomainAliases.Update(alias);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation($"Updated domain alias: {alias.AliasName}");
            return alias;
        }

        public async Task<bool> DeleteAliasAsync(int aliasId)
        {
            var alias = await _context.DomainAliases.FindAsync(aliasId);
            if (alias == null) return false;

            _context.DomainAliases.Remove(alias);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation($"Deleted domain alias: {alias.AliasName}");
            return true;
        }

        // Domain Access Logging
        public async Task LogDomainAccessAsync(string requestedDomain, string? clientIP, string? userAgent, 
                                              string? requestPath, string? requestMethod, int responseCode, 
                                              bool wasRedirected = false, string? redirectedTo = null, 
                                              string? matchedDomainName = null)
        {
            var log = new DomainAccessLog
            {
                RequestedDomain = requestedDomain,
                ClientIP = clientIP,
                UserAgent = userAgent,
                RequestPath = requestPath,
                RequestMethod = requestMethod,
                AccessTime = DateTime.UtcNow,
                ResponseCode = responseCode,
                WasRedirected = wasRedirected,
                RedirectedTo = redirectedTo,
                MatchedDomainName = matchedDomainName
            };

            _context.DomainAccessLogs.Add(log);
            await _context.SaveChangesAsync();
        }

        public async Task<IEnumerable<DomainAccessLog>> GetAccessLogsAsync(DateTime? startDate = null, DateTime? endDate = null, 
                                                                          string? domain = null, int? limit = 1000)
        {
            var query = _context.DomainAccessLogs.AsQueryable();

            if (startDate.HasValue)
                query = query.Where(l => l.AccessTime >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(l => l.AccessTime <= endDate.Value);

            if (!string.IsNullOrEmpty(domain))
                query = query.Where(l => l.RequestedDomain.Contains(domain) || 
                                        (l.MatchedDomainName != null && l.MatchedDomainName.Contains(domain)));

            query = query.OrderByDescending(l => l.AccessTime);

            if (limit.HasValue)
                query = query.Take(limit.Value);

            return await query.ToListAsync();
        }

        public async Task CleanupOldAccessLogsAsync(int retentionDays = 90)
        {
            var cutoffDate = DateTime.UtcNow.AddDays(-retentionDays);
            var oldLogs = await _context.DomainAccessLogs
                .Where(l => l.AccessTime < cutoffDate)
                .ToListAsync();

            if (oldLogs.Any())
            {
                _context.DomainAccessLogs.RemoveRange(oldLogs);
                await _context.SaveChangesAsync();
                
                _logger.LogInformation($"Cleaned up {oldLogs.Count} old domain access logs");
            }
        }

        // Domain Statistics and Analytics
        public async Task<DomainStatistics> GetDomainStatisticsAsync(DateTime? startDate = null, DateTime? endDate = null)
        {
            var query = _context.DomainAccessLogs.AsQueryable();

            if (startDate.HasValue)
                query = query.Where(l => l.AccessTime >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(l => l.AccessTime <= endDate.Value);

            var totalDomains = await _context.ApplicationDomains.CountAsync();
            var activeDomains = await _context.ApplicationDomains.Where(d => d.IsActive).CountAsync();
            var totalAliases = await _context.DomainAliases.Where(a => a.IsActive).CountAsync();
            var primaryDomain = await GetPrimaryDomainAsync();

            var logs = await query.ToListAsync();
            var totalRequests = logs.Count;
            var httpsRequests = logs.Count(l => l.RequestPath?.StartsWith("https://") == true);
            var redirectedRequests = logs.Count(l => l.WasRedirected);

            var topDomains = logs
                .GroupBy(l => l.RequestedDomain)
                .OrderByDescending(g => g.Count())
                .Take(10)
                .Select(g => g.Key)
                .ToList();

            var requestsByDomain = logs
                .GroupBy(l => l.RequestedDomain)
                .ToDictionary(g => g.Key, g => g.Count());

            return new DomainStatistics
            {
                TotalDomains = totalDomains,
                ActiveDomains = activeDomains,
                TotalAliases = totalAliases,
                PrimaryDomain = primaryDomain?.DomainName,
                TotalRequests = totalRequests,
                HttpsRequests = httpsRequests,
                RedirectedRequests = redirectedRequests,
                TopDomains = topDomains,
                RequestsByDomain = requestsByDomain
            };
        }

        public async Task<IEnumerable<string>> GetTopAccessedDomainsAsync(int count = 10, DateTime? startDate = null, DateTime? endDate = null)
        {
            var query = _context.DomainAccessLogs.AsQueryable();

            if (startDate.HasValue)
                query = query.Where(l => l.AccessTime >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(l => l.AccessTime <= endDate.Value);

            return await query
                .GroupBy(l => l.RequestedDomain)
                .OrderByDescending(g => g.Count())
                .Take(count)
                .Select(g => g.Key)
                .ToListAsync();
        }

        // Domain Configuration and Validation
        public async Task<bool> IsDomainConfiguredAsync(string domainName)
        {
            return await _context.ApplicationDomains
                .AnyAsync(d => d.DomainName.ToLower() == domainName.ToLower() && d.IsActive) ||
                   await _context.DomainAliases
                .AnyAsync(a => a.AliasName.ToLower() == domainName.ToLower() && a.IsActive);
        }

        public async Task<bool> ValidateDomainConfigurationAsync(ApplicationDomain domain)
        {
            // Check for duplicate domain names
            var existingDomain = await _context.ApplicationDomains
                .AnyAsync(d => d.DomainName.ToLower() == domain.DomainName.ToLower() && d.Id != domain.Id);
            
            if (existingDomain)
                return false;

            // Check for conflicting aliases
            var conflictingAlias = await _context.DomainAliases
                .AnyAsync(a => a.AliasName.ToLower() == domain.DomainName.ToLower());
            
            return !conflictingAlias;
        }

        public async Task<ApplicationDomain?> ResolveDomainRequestAsync(string requestedDomain)
        {
            // First check for exact domain match
            var domain = await _context.ApplicationDomains
                .FirstOrDefaultAsync(d => d.DomainName.ToLower() == requestedDomain.ToLower() && d.IsActive);
            
            if (domain != null)
                return domain;

            // Check for alias match
            var alias = await _context.DomainAliases
                .Include(a => a.ApplicationDomain)
                .FirstOrDefaultAsync(a => a.AliasName.ToLower() == requestedDomain.ToLower() && a.IsActive);
            
            return alias?.ApplicationDomain;
        }

        // Dashboard and Health
        public async Task<Dictionary<string, object>> GetDomainDashboardDataAsync()
        {
            var stats = await GetDomainStatisticsAsync();
            var primaryDomain = await GetPrimaryDomainAsync();
            var recentLogs = await GetAccessLogsAsync(limit: 10);

            return new Dictionary<string, object>
            {
                ["Statistics"] = stats,
                ["PrimaryDomain"] = primaryDomain,
                ["RecentAccessLogs"] = recentLogs,
                ["IsHealthy"] = await CheckDomainHealthAsync()
            };
        }

        public async Task<bool> CheckDomainHealthAsync()
        {
            // Check if we have at least one active domain
            var activeDomains = await _context.ApplicationDomains
                .Where(d => d.IsActive)
                .CountAsync();
            
            if (activeDomains == 0)
                return false;

            // Check if we have a primary domain
            var primaryDomain = await GetPrimaryDomainAsync();
            
            return primaryDomain != null;
        }

        // Helper Methods
        private async Task ClearPrimaryDomainAsync(int? excludeId = null)
        {
            var currentPrimary = await _context.ApplicationDomains
                .Where(d => d.IsPrimary && (excludeId == null || d.Id != excludeId))
                .ToListAsync();

            foreach (var domain in currentPrimary)
            {
                domain.IsPrimary = false;
                domain.UpdatedAt = DateTime.UtcNow;
            }

            if (currentPrimary.Any())
                await _context.SaveChangesAsync();
        }
    }
}