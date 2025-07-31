using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IReferenceDataService
    {
        // Search and retrieve methods
        Task<ReferenceDataSearchResult> SearchAsync(ReferenceDataCategory category, string searchTerm, string userId);
        Task<IEnumerable<ReferenceDataViewModel>> GetByCategoryAsync(ReferenceDataCategory category);
        Task<IEnumerable<ReferenceDataEntry>> GetEntriesByCategoryAsync(ReferenceDataCategory category, bool includeInactive = false);
        Task<ReferenceDataEntry?> GetByIdAsync(int id);
        
        // Create and update methods (GRC/Admin only)
        Task<ReferenceDataEntry> CreateAsync(CreateReferenceDataViewModel model, string userId);
        Task<ReferenceDataEntry> UpdateAsync(int id, string value, string description, string userId);
        Task<bool> DeleteAsync(int id, string userId);
        Task SetActiveStatusAsync(int id, bool isActive, string userId);
        
        // Bulk operations for initial data migration
        Task<int> BulkCreateAsync(ReferenceDataCategory category, IEnumerable<string> values, string userId);
        
        // Usage tracking
        Task IncrementUsageAsync(int id);
        Task IncrementUsageAsync(ReferenceDataCategory category, string value);
        
        // Management methods (Admin only)
        Task<IEnumerable<ReferenceDataEntry>> GetAllAsync(ReferenceDataCategory? category = null, bool includeInactive = false);
        Task<Dictionary<ReferenceDataCategory, int>> GetCategoryCountsAsync();
        Task<IEnumerable<ReferenceDataEntry>> GetUnusedEntriesAsync(int daysSinceLastUse = 90);
        
        // Data migration helpers
        Task<int> MigrateExistingDataAsync();
        Task<Dictionary<string, List<string>>> ExtractUniqueValuesFromExistingDataAsync();
        
        // Validation
        Task<bool> IsValueUniqueAsync(ReferenceDataCategory category, string value, int? excludeId = null);
        bool IsValueValid(string value);
    }
}