using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;

namespace CyberRiskApp.Services
{
    public class TechnicalControlMappingService : ITechnicalControlMappingService
    {
        private readonly CyberRiskContext _context;
        private readonly UserManager<User> _userManager;
        private readonly ILogger<TechnicalControlMappingService> _logger;

        public TechnicalControlMappingService(
            CyberRiskContext context,
            UserManager<User> userManager,
            ILogger<TechnicalControlMappingService> logger)
        {
            _context = context;
            _userManager = userManager;
            _logger = logger;
        }

        public async Task<TechnicalControlMappingViewModel> GetTechnicalControlMappingsAsync(int technicalControlId)
        {
            var technicalControl = await _context.ReferenceDataEntries
                .Where(r => r.Id == technicalControlId && r.Category == ReferenceDataCategory.TechnicalControl && r.IsActive && !r.IsDeleted)
                .FirstOrDefaultAsync();

            if (technicalControl == null)
            {
                return new TechnicalControlMappingViewModel();
            }

            var mappedControls = await GetMappedComplianceControlsAsync(technicalControlId);
            var availableControls = await GetAvailableComplianceControlsAsync(technicalControlId);

            return new TechnicalControlMappingViewModel
            {
                TechnicalControlId = technicalControl.Id,
                TechnicalControlName = technicalControl.Value,
                TechnicalControlDescription = technicalControl.Description,
                MappedControls = mappedControls.ToList(),
                AvailableControls = availableControls.ToList()
            };
        }

        public async Task<IEnumerable<TechnicalControlMappingViewModel>> GetAllTechnicalControlMappingsAsync()
        {
            var technicalControls = await _context.ReferenceDataEntries
                .Where(r => r.Category == ReferenceDataCategory.TechnicalControl && r.IsActive && !r.IsDeleted)
                .OrderBy(r => r.Value)
                .ToListAsync();

            var results = new List<TechnicalControlMappingViewModel>();

            foreach (var control in technicalControls)
            {
                var mappedControls = await GetMappedComplianceControlsAsync(control.Id);
                results.Add(new TechnicalControlMappingViewModel
                {
                    TechnicalControlId = control.Id,
                    TechnicalControlName = control.Value,
                    TechnicalControlDescription = control.Description,
                    MappedControls = mappedControls.ToList(),
                    AvailableControls = new List<ComplianceControlInfo>() // Not needed for list view
                });
            }

            return results;
        }

        public async Task<TechnicalControlComplianceMapping> CreateMappingAsync(int technicalControlId, int complianceControlId, string rationale, string implementationNotes, string userId)
        {
            // Validate the mapping doesn't already exist
            var existingMapping = await _context.TechnicalControlComplianceMappings
                .Where(m => m.TechnicalControlId == technicalControlId && m.ComplianceControlId == complianceControlId && m.IsActive)
                .FirstOrDefaultAsync();

            if (existingMapping != null)
            {
                throw new InvalidOperationException("A mapping between this technical control and compliance control already exists.");
            }

            // Validate that both controls exist
            var technicalControlExists = await _context.ReferenceDataEntries
                .AnyAsync(r => r.Id == technicalControlId && r.Category == ReferenceDataCategory.TechnicalControl && r.IsActive && !r.IsDeleted);

            var complianceControlExists = await _context.ComplianceControls
                .AnyAsync(c => c.Id == complianceControlId);

            if (!technicalControlExists)
            {
                throw new ArgumentException("Technical control not found.");
            }

            if (!complianceControlExists)
            {
                throw new ArgumentException("Compliance control not found.");
            }

            var mapping = new TechnicalControlComplianceMapping
            {
                TechnicalControlId = technicalControlId,
                ComplianceControlId = complianceControlId,
                MappingRationale = rationale ?? string.Empty,
                ImplementationNotes = implementationNotes ?? string.Empty,
                IsActive = true,
                CreatedBy = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.TechnicalControlComplianceMappings.Add(mapping);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Technical control mapping created: TC:{TechnicalControlId} -> CC:{ComplianceControlId} by user {UserId}", 
                technicalControlId, complianceControlId, userId);

            return mapping;
        }

        public async Task<TechnicalControlComplianceMapping> UpdateMappingAsync(int mappingId, string rationale, string implementationNotes, string userId)
        {
            var mapping = await _context.TechnicalControlComplianceMappings
                .FirstOrDefaultAsync(m => m.Id == mappingId);

            if (mapping == null)
            {
                throw new ArgumentException("Mapping not found.");
            }

            mapping.MappingRationale = rationale ?? string.Empty;
            mapping.ImplementationNotes = implementationNotes ?? string.Empty;
            mapping.ModifiedBy = userId;
            mapping.ModifiedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Technical control mapping updated: {MappingId} by user {UserId}", mappingId, userId);

            return mapping;
        }

        public async Task<bool> DeleteMappingAsync(int mappingId, string userId)
        {
            var mapping = await _context.TechnicalControlComplianceMappings
                .FirstOrDefaultAsync(m => m.Id == mappingId);

            if (mapping == null)
            {
                return false;
            }

            _context.TechnicalControlComplianceMappings.Remove(mapping);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Technical control mapping deleted: {MappingId} by user {UserId}", mappingId, userId);

            return true;
        }

        public async Task<bool> SetMappingActiveStatusAsync(int mappingId, bool isActive, string userId)
        {
            var mapping = await _context.TechnicalControlComplianceMappings
                .FirstOrDefaultAsync(m => m.Id == mappingId);

            if (mapping == null)
            {
                return false;
            }

            mapping.IsActive = isActive;
            mapping.ModifiedBy = userId;
            mapping.ModifiedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Technical control mapping status changed: {MappingId} -> {IsActive} by user {UserId}", 
                mappingId, isActive, userId);

            return true;
        }

        public async Task<IEnumerable<ComplianceControlInfo>> GetAvailableComplianceControlsAsync(int? excludeTechnicalControlId = null)
        {
            IQueryable<ComplianceControl> query = _context.ComplianceControls
                .Include(c => c.Framework);

            if (excludeTechnicalControlId.HasValue)
            {
                // Exclude controls that are already mapped to this technical control
                var mappedControlIds = await _context.TechnicalControlComplianceMappings
                    .Where(m => m.TechnicalControlId == excludeTechnicalControlId.Value && m.IsActive)
                    .Select(m => m.ComplianceControlId)
                    .ToListAsync();

                query = query.Where(c => !mappedControlIds.Contains(c.Id));
            }

            return await query
                .OrderBy(c => c.Framework.Name)
                .ThenBy(c => c.ControlId)
                .Select(c => new ComplianceControlInfo
                {
                    Id = c.Id,
                    ControlId = c.ControlId,
                    Title = c.Title,
                    Framework = c.Framework.Name,
                    Category = c.Category
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<ComplianceControlMappingInfo>> GetMappedComplianceControlsAsync(int technicalControlId)
        {
            return await _context.TechnicalControlComplianceMappings
                .Where(m => m.TechnicalControlId == technicalControlId && m.IsActive)
                .Include(m => m.ComplianceControl)
                .ThenInclude(c => c.Framework)
                .Select(m => new ComplianceControlMappingInfo
                {
                    MappingId = m.Id,
                    ComplianceControlId = m.ComplianceControlId,
                    ControlId = m.ComplianceControl.ControlId,
                    Title = m.ComplianceControl.Title,
                    Framework = m.ComplianceControl.Framework.Name,
                    MappingRationale = m.MappingRationale,
                    ImplementationNotes = m.ImplementationNotes
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<ReferenceDataViewModel>> GetTechnicalControlsWithMappingsAsync()
        {
            var controlsWithMappings = await _context.TechnicalControlComplianceMappings
                .Where(m => m.IsActive)
                .Select(m => m.TechnicalControlId)
                .Distinct()
                .ToListAsync();

            return await _context.ReferenceDataEntries
                .Where(r => r.Category == ReferenceDataCategory.TechnicalControl 
                    && r.IsActive && !r.IsDeleted 
                    && controlsWithMappings.Contains(r.Id))
                .Select(r => new ReferenceDataViewModel
                {
                    Id = r.Id,
                    Value = r.Value,
                    Description = r.Description
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<ReferenceDataViewModel>> GetUnmappedTechnicalControlsAsync()
        {
            var controlsWithMappings = await _context.TechnicalControlComplianceMappings
                .Where(m => m.IsActive)
                .Select(m => m.TechnicalControlId)
                .Distinct()
                .ToListAsync();

            return await _context.ReferenceDataEntries
                .Where(r => r.Category == ReferenceDataCategory.TechnicalControl 
                    && r.IsActive && !r.IsDeleted 
                    && !controlsWithMappings.Contains(r.Id))
                .Select(r => new ReferenceDataViewModel
                {
                    Id = r.Id,
                    Value = r.Value,
                    Description = r.Description
                })
                .ToListAsync();
        }

        public async Task<Dictionary<int, List<int>>> GetComplianceControlTechnicalMappingsAsync()
        {
            var mappings = await _context.TechnicalControlComplianceMappings
                .Where(m => m.IsActive)
                .GroupBy(m => m.ComplianceControlId)
                .ToDictionaryAsync(
                    g => g.Key,
                    g => g.Select(m => m.TechnicalControlId).ToList()
                );

            return mappings;
        }

        public async Task<IEnumerable<ComplianceControlInfo>> GetUnmappedComplianceControlsAsync()
        {
            var mappedControlIds = await _context.TechnicalControlComplianceMappings
                .Where(m => m.IsActive)
                .Select(m => m.ComplianceControlId)
                .Distinct()
                .ToListAsync();

            return await _context.ComplianceControls
                .Include(c => c.Framework)
                .Where(c => !mappedControlIds.Contains(c.Id))
                .OrderBy(c => c.Framework.Name)
                .ThenBy(c => c.ControlId)
                .Select(c => new ComplianceControlInfo
                {
                    Id = c.Id,
                    ControlId = c.ControlId,
                    Title = c.Title,
                    Framework = c.Framework.Name,
                    Category = c.Category
                })
                .ToListAsync();
        }

        public async Task<Dictionary<string, int>> GetMappingCoverageByFrameworkAsync()
        {
            return await _context.TechnicalControlComplianceMappings
                .Where(m => m.IsActive)
                .Include(m => m.ComplianceControl)
                .ThenInclude(c => c.Framework)
                .GroupBy(m => m.ComplianceControl.Framework.Name)
                .ToDictionaryAsync(
                    g => g.Key,
                    g => g.Select(m => m.ComplianceControlId).Distinct().Count()
                );
        }

        public async Task<int> BulkCreateMappingsAsync(int technicalControlId, IEnumerable<int> complianceControlIds, string rationale, string implementationNotes, string userId)
        {
            var existingMappings = await _context.TechnicalControlComplianceMappings
                .Where(m => m.TechnicalControlId == technicalControlId && m.IsActive)
                .Select(m => m.ComplianceControlId)
                .ToListAsync();

            var newMappings = new List<TechnicalControlComplianceMapping>();

            foreach (var complianceControlId in complianceControlIds)
            {
                if (!existingMappings.Contains(complianceControlId))
                {
                    newMappings.Add(new TechnicalControlComplianceMapping
                    {
                        TechnicalControlId = technicalControlId,
                        ComplianceControlId = complianceControlId,
                        MappingRationale = rationale ?? string.Empty,
                        ImplementationNotes = implementationNotes ?? string.Empty,
                        IsActive = true,
                        CreatedBy = userId,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            if (newMappings.Any())
            {
                _context.TechnicalControlComplianceMappings.AddRange(newMappings);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Bulk created {Count} technical control mappings for TC:{TechnicalControlId} by user {UserId}", 
                    newMappings.Count, technicalControlId, userId);
            }

            return newMappings.Count;
        }

        public async Task<int> BulkDeleteMappingsAsync(int technicalControlId, IEnumerable<int> complianceControlIds, string userId)
        {
            var mappingsToDelete = await _context.TechnicalControlComplianceMappings
                .Where(m => m.TechnicalControlId == technicalControlId && complianceControlIds.Contains(m.ComplianceControlId))
                .ToListAsync();

            if (mappingsToDelete.Any())
            {
                _context.TechnicalControlComplianceMappings.RemoveRange(mappingsToDelete);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Bulk deleted {Count} technical control mappings for TC:{TechnicalControlId} by user {UserId}", 
                    mappingsToDelete.Count, technicalControlId, userId);
            }

            return mappingsToDelete.Count;
        }

        public async Task<bool> IsMappingValidAsync(int technicalControlId, int complianceControlId)
        {
            var technicalControlExists = await _context.ReferenceDataEntries
                .AnyAsync(r => r.Id == technicalControlId && r.Category == ReferenceDataCategory.TechnicalControl && r.IsActive && !r.IsDeleted);

            var complianceControlExists = await _context.ComplianceControls
                .AnyAsync(c => c.Id == complianceControlId);

            return technicalControlExists && complianceControlExists;
        }

        public async Task<bool> MappingExistsAsync(int technicalControlId, int complianceControlId)
        {
            return await _context.TechnicalControlComplianceMappings
                .AnyAsync(m => m.TechnicalControlId == technicalControlId && m.ComplianceControlId == complianceControlId && m.IsActive);
        }

        public async Task<IEnumerable<TechnicalControlMappingViewModel>> SearchMappingsAsync(string searchTerm, string framework = null)
        {
            var query = _context.ReferenceDataEntries
                .Where(r => r.Category == ReferenceDataCategory.TechnicalControl && r.IsActive && !r.IsDeleted);

            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                query = query.Where(r => r.Value.Contains(searchTerm) || r.Description.Contains(searchTerm));
            }

            var technicalControls = await query.ToListAsync();
            var results = new List<TechnicalControlMappingViewModel>();

            foreach (var control in technicalControls)
            {
                var mappingsQuery = _context.TechnicalControlComplianceMappings
                    .Where(m => m.TechnicalControlId == control.Id && m.IsActive);

                if (!string.IsNullOrWhiteSpace(framework))
                {
                    mappingsQuery = mappingsQuery.Where(m => m.ComplianceControl.Framework.Name.Contains(framework));
                }

                mappingsQuery = mappingsQuery
                    .Include(m => m.ComplianceControl)
                    .ThenInclude(c => c.Framework);

                var mappedControls = await mappingsQuery
                    .Select(m => new ComplianceControlMappingInfo
                    {
                        MappingId = m.Id,
                        ComplianceControlId = m.ComplianceControlId,
                        ControlId = m.ComplianceControl.ControlId,
                        Title = m.ComplianceControl.Title,
                        Framework = m.ComplianceControl.Framework.Name,
                        MappingRationale = m.MappingRationale,
                        ImplementationNotes = m.ImplementationNotes
                    })
                    .ToListAsync();

                if (mappedControls.Any() || string.IsNullOrWhiteSpace(framework))
                {
                    results.Add(new TechnicalControlMappingViewModel
                    {
                        TechnicalControlId = control.Id,
                        TechnicalControlName = control.Value,
                        TechnicalControlDescription = control.Description,
                        MappedControls = mappedControls,
                        AvailableControls = new List<ComplianceControlInfo>()
                    });
                }
            }

            return results;
        }

        public async Task<IEnumerable<ComplianceControlInfo>> SearchComplianceControlsAsync(string searchTerm, string framework = null)
        {
            var query = _context.ComplianceControls
                .Include(c => c.Framework)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                query = query.Where(c => c.ControlId.Contains(searchTerm) || c.Title.Contains(searchTerm) || c.Description.Contains(searchTerm));
            }

            if (!string.IsNullOrWhiteSpace(framework))
            {
                query = query.Where(c => c.Framework.Name.Contains(framework));
            }

            return await query
                .OrderBy(c => c.Framework.Name)
                .ThenBy(c => c.ControlId)
                .Select(c => new ComplianceControlInfo
                {
                    Id = c.Id,
                    ControlId = c.ControlId,
                    Title = c.Title,
                    Framework = c.Framework.Name,
                    Category = c.Category
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<object>> GetMappingExportDataAsync()
        {
            return await _context.TechnicalControlComplianceMappings
                .Where(m => m.IsActive)
                .Include(m => m.TechnicalControl)
                .Include(m => m.ComplianceControl)
                .ThenInclude(c => c.Framework)
                .Select(m => new
                {
                    TechnicalControlName = m.TechnicalControl.Value,
                    TechnicalControlDescription = m.TechnicalControl.Description,
                    ComplianceFramework = m.ComplianceControl.Framework.Name,
                    ComplianceControlId = m.ComplianceControl.ControlId,
                    ComplianceControlTitle = m.ComplianceControl.Title,
                    ComplianceControlCategory = m.ComplianceControl.Category,
                    MappingRationale = m.MappingRationale,
                    ImplementationNotes = m.ImplementationNotes,
                    CreatedBy = m.CreatedBy,
                    CreatedAt = m.CreatedAt,
                    ModifiedBy = m.ModifiedBy,
                    ModifiedAt = m.ModifiedAt
                })
                .ToListAsync();
        }

        public async Task<Dictionary<string, object>> GetMappingAnalyticsAsync()
        {
            var totalTechnicalControls = await _context.ReferenceDataEntries
                .CountAsync(r => r.Category == ReferenceDataCategory.TechnicalControl && r.IsActive && !r.IsDeleted);

            var mappedTechnicalControls = await _context.TechnicalControlComplianceMappings
                .Where(m => m.IsActive)
                .Select(m => m.TechnicalControlId)
                .Distinct()
                .CountAsync();

            var totalComplianceControls = await _context.ComplianceControls.CountAsync();

            var mappedComplianceControls = await _context.TechnicalControlComplianceMappings
                .Where(m => m.IsActive)
                .Select(m => m.ComplianceControlId)
                .Distinct()
                .CountAsync();

            var totalMappings = await _context.TechnicalControlComplianceMappings
                .CountAsync(m => m.IsActive);

            var frameworkCoverage = await GetMappingCoverageByFrameworkAsync();

            return new Dictionary<string, object>
            {
                {"TotalTechnicalControls", totalTechnicalControls},
                {"MappedTechnicalControls", mappedTechnicalControls},
                {"UnmappedTechnicalControls", totalTechnicalControls - mappedTechnicalControls},
                {"TechnicalControlMappingPercentage", totalTechnicalControls > 0 ? (double)mappedTechnicalControls / totalTechnicalControls * 100 : 0},
                {"TotalComplianceControls", totalComplianceControls},
                {"MappedComplianceControls", mappedComplianceControls},
                {"UnmappedComplianceControls", totalComplianceControls - mappedComplianceControls},
                {"ComplianceControlMappingPercentage", totalComplianceControls > 0 ? (double)mappedComplianceControls / totalComplianceControls * 100 : 0},
                {"TotalMappings", totalMappings},
                {"FrameworkCoverage", frameworkCoverage}
            };
        }
    }
}