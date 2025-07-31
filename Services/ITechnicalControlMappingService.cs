using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface ITechnicalControlMappingService
    {
        // Technical Control Mapping Management
        Task<TechnicalControlMappingViewModel> GetTechnicalControlMappingsAsync(int technicalControlId);
        Task<IEnumerable<TechnicalControlMappingViewModel>> GetAllTechnicalControlMappingsAsync();
        Task<TechnicalControlComplianceMapping> CreateMappingAsync(int technicalControlId, int complianceControlId, string rationale, string implementationNotes, string userId);
        Task<TechnicalControlComplianceMapping> UpdateMappingAsync(int mappingId, string rationale, string implementationNotes, string userId);
        Task<bool> DeleteMappingAsync(int mappingId, string userId);
        Task<bool> SetMappingActiveStatusAsync(int mappingId, bool isActive, string userId);

        // Query Methods
        Task<IEnumerable<ComplianceControlInfo>> GetAvailableComplianceControlsAsync(int? excludeTechnicalControlId = null);
        Task<IEnumerable<ComplianceControlMappingInfo>> GetMappedComplianceControlsAsync(int technicalControlId);
        Task<IEnumerable<ReferenceDataViewModel>> GetTechnicalControlsWithMappingsAsync();
        Task<IEnumerable<ReferenceDataViewModel>> GetUnmappedTechnicalControlsAsync();

        // Compliance Control Coverage Analysis
        Task<Dictionary<int, List<int>>> GetComplianceControlTechnicalMappingsAsync();
        Task<IEnumerable<ComplianceControlInfo>> GetUnmappedComplianceControlsAsync();
        Task<Dictionary<string, int>> GetMappingCoverageByFrameworkAsync();

        // Bulk Operations
        Task<int> BulkCreateMappingsAsync(int technicalControlId, IEnumerable<int> complianceControlIds, string rationale, string implementationNotes, string userId);
        Task<int> BulkDeleteMappingsAsync(int technicalControlId, IEnumerable<int> complianceControlIds, string userId);

        // Validation
        Task<bool> IsMappingValidAsync(int technicalControlId, int complianceControlId);
        Task<bool> MappingExistsAsync(int technicalControlId, int complianceControlId);

        // Search and Filtering
        Task<IEnumerable<TechnicalControlMappingViewModel>> SearchMappingsAsync(string searchTerm, string framework = null);
        Task<IEnumerable<ComplianceControlInfo>> SearchComplianceControlsAsync(string searchTerm, string framework = null);

        // Export Methods
        Task<IEnumerable<object>> GetMappingExportDataAsync();
        Task<Dictionary<string, object>> GetMappingAnalyticsAsync();
    }
}