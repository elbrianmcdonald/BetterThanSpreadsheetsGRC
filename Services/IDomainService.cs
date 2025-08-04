using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IDomainService
    {
        // Application Domain Management
        Task<ApplicationDomain?> GetPrimaryDomainAsync();
        Task<IEnumerable<ApplicationDomain>> GetAllDomainsAsync();
        Task<ApplicationDomain?> GetDomainByIdAsync(int id);
        Task<ApplicationDomain?> GetDomainByNameAsync(string domainName);
        Task<ApplicationDomain> CreateDomainAsync(ApplicationDomain domain);
        Task<ApplicationDomain> UpdateDomainAsync(ApplicationDomain domain);
        Task<bool> DeleteDomainAsync(int id);
        Task<bool> SetPrimaryDomainAsync(int domainId);

        // Domain Aliases Management
        Task<IEnumerable<DomainAlias>> GetDomainAliasesAsync(int domainId);
        Task<DomainAlias?> GetAliasAsync(int aliasId);
        Task<DomainAlias> CreateAliasAsync(DomainAlias alias);
        Task<DomainAlias> UpdateAliasAsync(DomainAlias alias);
        Task<bool> DeleteAliasAsync(int aliasId);

        // Domain Access Logging
        Task LogDomainAccessAsync(string requestedDomain, string? clientIP, string? userAgent, 
                                 string? requestPath, string? requestMethod, int responseCode, 
                                 bool wasRedirected = false, string? redirectedTo = null, 
                                 string? matchedDomainName = null);
        Task<IEnumerable<DomainAccessLog>> GetAccessLogsAsync(DateTime? startDate = null, DateTime? endDate = null, 
                                                             string? domain = null, int? limit = 1000);
        Task CleanupOldAccessLogsAsync(int retentionDays = 90);

        // Domain Statistics and Analytics
        Task<DomainStatistics> GetDomainStatisticsAsync(DateTime? startDate = null, DateTime? endDate = null);
        Task<IEnumerable<string>> GetTopAccessedDomainsAsync(int count = 10, DateTime? startDate = null, DateTime? endDate = null);

        // Domain Configuration and Validation
        Task<bool> IsDomainConfiguredAsync(string domainName);
        Task<bool> ValidateDomainConfigurationAsync(ApplicationDomain domain);
        Task<ApplicationDomain?> ResolveDomainRequestAsync(string requestedDomain);

        // Dashboard and Health
        Task<Dictionary<string, object>> GetDomainDashboardDataAsync();
        Task<bool> CheckDomainHealthAsync();
    }
}