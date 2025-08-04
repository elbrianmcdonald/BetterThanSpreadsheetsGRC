using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using System.Text.RegularExpressions;

namespace CyberRiskApp.Services
{
    public class ReferenceDataService : IReferenceDataService
    {
        private readonly CyberRiskContext _context;
        private readonly UserManager<User> _userManager;
        private readonly ILogger<ReferenceDataService> _logger;
        private readonly ICacheService _cacheService;

        // Regex for input validation - alphanumeric, spaces, and common business characters
        private static readonly Regex ValueValidationRegex = new(@"^[a-zA-Z0-9\s\-\._\(\)\[\]&/]+$", RegexOptions.Compiled);

        public ReferenceDataService(
            CyberRiskContext context,
            UserManager<User> userManager,
            ILogger<ReferenceDataService> logger,
            ICacheService cacheService)
        {
            _context = context;
            _userManager = userManager;
            _logger = logger;
            _cacheService = cacheService;
        }

        public async Task<ReferenceDataSearchResult> SearchAsync(ReferenceDataCategory category, string searchTerm, string userId)
        {
            var result = new ReferenceDataSearchResult
            {
                SearchTerm = searchTerm ?? string.Empty,
                CanAddNew = await IsUserInGrcOrAdminRoleAsync(userId)
            };

            if (string.IsNullOrWhiteSpace(searchTerm))
            {
                // Return top 20 most used entries when no search term
                var topEntries = await _context.ReferenceDataEntries
                    .Where(r => r.Category == category && r.IsActive && !r.IsDeleted)
                    .OrderByDescending(r => r.UsageCount)
                    .ThenBy(r => r.Value)
                    .Take(20)
                    .Select(r => new ReferenceDataViewModel
                    {
                        Id = r.Id,
                        Value = r.Value,
                        Description = r.Description
                    })
                    .ToListAsync();

                result.Results = topEntries;
                return result;
            }

            // Search for matching entries
            var normalizedSearch = searchTerm.Trim().ToLower();
            var entries = await _context.ReferenceDataEntries
                .Where(r => r.Category == category && 
                           r.IsActive && 
                           !r.IsDeleted &&
                           (r.Value.ToLower().Contains(normalizedSearch) ||
                            r.Description.ToLower().Contains(normalizedSearch)))
                .OrderBy(r => r.Value.ToLower().StartsWith(normalizedSearch) ? 0 : 1) // Prioritize starts-with matches
                .ThenByDescending(r => r.UsageCount)
                .ThenBy(r => r.Value)
                .Take(10)
                .Select(r => new ReferenceDataViewModel
                {
                    Id = r.Id,
                    Value = r.Value,
                    Description = r.Description
                })
                .ToListAsync();

            result.Results = entries;
            return result;
        }

        public async Task<IEnumerable<ReferenceDataViewModel>> GetByCategoryAsync(ReferenceDataCategory category)
        {
            return await _context.ReferenceDataEntries
                .Where(r => r.Category == category && r.IsActive && !r.IsDeleted)
                .OrderBy(r => r.Value)
                .Select(r => new ReferenceDataViewModel
                {
                    Id = r.Id,
                    Value = r.Value,
                    Description = r.Description
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<ReferenceDataEntry>> GetEntriesByCategoryAsync(ReferenceDataCategory category, bool includeInactive = false)
        {
            var query = _context.ReferenceDataEntries
                .Where(r => r.Category == category && !r.IsDeleted);
            
            if (!includeInactive)
            {
                query = query.Where(r => r.IsActive);
            }
            
            return await query
                .OrderBy(r => r.Value)
                .ToListAsync();
        }

        public async Task<ReferenceDataEntry?> GetByIdAsync(int id)
        {
            return await _context.ReferenceDataEntries
                .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);
        }

        public async Task<ReferenceDataEntry> CreateAsync(CreateReferenceDataViewModel model, string userId)
        {
            // Validate input
            if (!IsValueValid(model.Value))
            {
                throw new ArgumentException("Value contains invalid characters");
            }

            // Check for duplicates (case-insensitive)
            var exists = await IsValueUniqueAsync(model.Category, model.Value);
            if (!exists)
            {
                throw new InvalidOperationException($"An entry with value '{model.Value}' already exists in {model.Category}");
            }

            var entry = new ReferenceDataEntry
            {
                Category = model.Category,
                Value = model.Value.Trim(),
                Description = model.Description?.Trim() ?? string.Empty,
                CreatedBy = userId,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };

            _context.ReferenceDataEntries.Add(entry);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Created reference data entry {Id} for {Category}: {Value}", 
                entry.Id, entry.Category, entry.Value);

            return entry;
        }

        public async Task<ReferenceDataEntry> UpdateAsync(int id, string value, string description, string userId)
        {
            var entry = await GetByIdAsync(id);
            if (entry == null)
            {
                throw new InvalidOperationException("Reference data entry not found");
            }

            // Validate input
            if (!IsValueValid(value))
            {
                throw new ArgumentException("Value contains invalid characters");
            }

            // Check for duplicates if value changed
            if (entry.Value != value.Trim())
            {
                var isUnique = await IsValueUniqueAsync(entry.Category, value, id);
                if (!isUnique)
                {
                    throw new InvalidOperationException($"An entry with value '{value}' already exists in {entry.Category}");
                }
            }

            entry.Value = value.Trim();
            entry.Description = description?.Trim() ?? string.Empty;
            entry.ModifiedBy = userId;
            entry.ModifiedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated reference data entry {Id}", id);

            return entry;
        }

        public async Task<bool> DeleteAsync(int id, string userId)
        {
            var entry = await GetByIdAsync(id);
            if (entry == null)
            {
                return false;
            }

            // Soft delete to maintain referential integrity
            entry.IsDeleted = true;
            entry.DeletedBy = userId;
            entry.DeletedAt = DateTime.UtcNow;
            entry.IsActive = false;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Soft deleted reference data entry {Id}", id);

            return true;
        }

        public async Task<int> BulkCreateAsync(ReferenceDataCategory category, IEnumerable<string> values, string userId)
        {
            var created = 0;
            var normalizedValues = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // Get existing values
            var existingValues = await _context.ReferenceDataEntries
                .Where(r => r.Category == category && !r.IsDeleted)
                .Select(r => r.Value.ToLower())
                .ToListAsync();

            normalizedValues.UnionWith(existingValues);

            foreach (var value in values.Where(v => !string.IsNullOrWhiteSpace(v)))
            {
                var trimmedValue = value.Trim();
                
                // Skip if invalid or already exists
                if (!IsValueValid(trimmedValue) || normalizedValues.Contains(trimmedValue.ToLower()))
                {
                    continue;
                }

                var entry = new ReferenceDataEntry
                {
                    Category = category,
                    Value = trimmedValue,
                    Description = string.Empty,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow,
                    IsActive = true
                };

                _context.ReferenceDataEntries.Add(entry);
                normalizedValues.Add(trimmedValue.ToLower());
                created++;
            }

            if (created > 0)
            {
                await _context.SaveChangesAsync();
                _logger.LogInformation("Bulk created {Count} reference data entries for {Category}", created, category);
            }

            return created;
        }

        public async Task IncrementUsageAsync(int id)
        {
            var entry = await GetByIdAsync(id);
            if (entry != null)
            {
                entry.UsageCount++;
                entry.LastUsedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }

        public async Task IncrementUsageAsync(ReferenceDataCategory category, string value)
        {
            var entry = await _context.ReferenceDataEntries
                .FirstOrDefaultAsync(r => r.Category == category && 
                                         r.Value == value && 
                                         !r.IsDeleted);
            if (entry != null)
            {
                entry.UsageCount++;
                entry.LastUsedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<ReferenceDataEntry>> GetAllAsync(ReferenceDataCategory? category = null, bool includeInactive = false)
        {
            var query = _context.ReferenceDataEntries.AsQueryable();

            if (category.HasValue)
            {
                query = query.Where(r => r.Category == category.Value);
            }

            if (!includeInactive)
            {
                query = query.Where(r => r.IsActive);
            }

            query = query.Where(r => !r.IsDeleted);

            return await query
                .OrderBy(r => r.Category)
                .ThenBy(r => r.Value)
                .ToListAsync();
        }

        public async Task<Dictionary<ReferenceDataCategory, int>> GetCategoryCountsAsync()
        {
            var counts = await _context.ReferenceDataEntries
                .Where(r => r.IsActive && !r.IsDeleted)
                .GroupBy(r => r.Category)
                .Select(g => new { Category = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Category, x => x.Count);

            // Ensure all categories are represented
            foreach (ReferenceDataCategory category in Enum.GetValues(typeof(ReferenceDataCategory)))
            {
                if (!counts.ContainsKey(category))
                {
                    counts[category] = 0;
                }
            }

            return counts;
        }

        public async Task<IEnumerable<ReferenceDataEntry>> GetUnusedEntriesAsync(int daysSinceLastUse = 90)
        {
            var cutoffDate = DateTime.UtcNow.AddDays(-daysSinceLastUse);

            return await _context.ReferenceDataEntries
                .Where(r => !r.IsDeleted && 
                           (r.UsageCount == 0 || 
                            (r.LastUsedAt.HasValue && r.LastUsedAt.Value < cutoffDate)))
                .OrderBy(r => r.Category)
                .ThenBy(r => r.Value)
                .ToListAsync();
        }

        public async Task<Dictionary<string, List<string>>> ExtractUniqueValuesFromExistingDataAsync()
        {
            var result = new Dictionary<string, List<string>>();

            // Extract unique assets
            var assets = await _context.Risks
                .Where(r => !string.IsNullOrEmpty(r.Asset))
                .Select(r => r.Asset)
                .Union(_context.Findings
                    .Where(f => !string.IsNullOrEmpty(f.Asset))
                    .Select(f => f.Asset))
                .Union(_context.RiskAssessments
                    .Where(ra => !string.IsNullOrEmpty(ra.Asset))
                    .Select(ra => ra.Asset))
                .Distinct()
                .OrderBy(a => a)
                .ToListAsync();

            result["Assets"] = assets;

            // Extract unique business owners
            var businessOwners = await _context.Risks
                .Where(r => !string.IsNullOrEmpty(r.Owner))
                .Select(r => r.Owner)
                .Union(_context.Findings
                    .Where(f => !string.IsNullOrEmpty(f.BusinessOwner))
                    .Select(f => f.BusinessOwner))
                .Distinct()
                .OrderBy(bo => bo)
                .ToListAsync();

            result["BusinessOwners"] = businessOwners;

            // Extract unique business units
            var businessUnits = await _context.Risks
                .Where(r => !string.IsNullOrEmpty(r.BusinessUnit))
                .Select(r => r.BusinessUnit)
                .Union(_context.Findings
                    .Where(f => !string.IsNullOrEmpty(f.BusinessUnit))
                    .Select(f => f.BusinessUnit))
                .Union(_context.RiskAssessments
                    .Where(ra => !string.IsNullOrEmpty(ra.BusinessUnit))
                    .Select(ra => ra.BusinessUnit))
                .Distinct()
                .OrderBy(bu => bu)
                .ToListAsync();

            result["BusinessUnits"] = businessUnits;

            // Extract unique technical controls (only from RiskAssessments)
            var technicalControls = await _context.RiskAssessments
                .Where(ra => !string.IsNullOrEmpty(ra.TechnicalControlsInPlace))
                .Select(ra => ra.TechnicalControlsInPlace)
                .Distinct()
                .OrderBy(tc => tc)
                .ToListAsync();

            result["TechnicalControls"] = technicalControls;

            return result;
        }

        public async Task<int> MigrateExistingDataAsync()
        {
            var migrated = 0;

            try
            {
                var existingData = await ExtractUniqueValuesFromExistingDataAsync();

                // Migrate assets
                if (existingData.ContainsKey("Assets"))
                {
                    migrated += await BulkCreateAsync(ReferenceDataCategory.Asset, existingData["Assets"], "System Migration");
                }

                // Migrate business owners
                if (existingData.ContainsKey("BusinessOwners"))
                {
                    migrated += await BulkCreateAsync(ReferenceDataCategory.BusinessOwner, existingData["BusinessOwners"], "System Migration");
                }

                // Migrate business units
                if (existingData.ContainsKey("BusinessUnits"))
                {
                    migrated += await BulkCreateAsync(ReferenceDataCategory.BusinessUnit, existingData["BusinessUnits"], "System Migration");
                }

                // Migrate technical controls
                if (existingData.ContainsKey("TechnicalControls"))
                {
                    migrated += await BulkCreateAsync(ReferenceDataCategory.TechnicalControl, existingData["TechnicalControls"], "System Migration");
                }

                _logger.LogInformation("Successfully migrated {Count} reference data entries", migrated);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during reference data migration");
                throw;
            }

            return migrated;
        }

        public async Task<bool> IsValueUniqueAsync(ReferenceDataCategory category, string value, int? excludeId = null)
        {
            var normalizedValue = value.Trim().ToLower();

            var query = _context.ReferenceDataEntries
                .Where(r => r.Category == category && 
                           r.Value.ToLower() == normalizedValue && 
                           !r.IsDeleted);

            if (excludeId.HasValue)
            {
                query = query.Where(r => r.Id != excludeId.Value);
            }

            return !await query.AnyAsync();
        }

        public bool IsValueValid(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return false;

            if (value.Length > 200)
                return false;

            // Check against regex pattern
            return ValueValidationRegex.IsMatch(value);
        }

        public async Task SetActiveStatusAsync(int id, bool isActive, string userId)
        {
            var entry = await GetByIdAsync(id);
            if (entry == null)
            {
                throw new InvalidOperationException("Reference data entry not found");
            }

            if (!await IsUserInGrcOrAdminRoleAsync(userId))
            {
                throw new UnauthorizedAccessException("Only GRC users and Admins can modify reference data");
            }

            entry.IsActive = isActive;
            entry.ModifiedBy = userId;
            entry.ModifiedAt = DateTime.UtcNow;
            
            await _context.SaveChangesAsync();
            _logger.LogInformation("Updated active status for reference data entry {Id} to {IsActive}", id, isActive);
        }

        private async Task<bool> IsUserInGrcOrAdminRoleAsync(string userId)
        {
            if (string.IsNullOrEmpty(userId))
                return false;

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
                return false;

            var roles = await _userManager.GetRolesAsync(user);
            return roles.Contains("Admin") || roles.Contains("GRCUser");
        }
    }
}