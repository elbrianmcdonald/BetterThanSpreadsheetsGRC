using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class RiskLevelSettingsService : IRiskLevelSettingsService
    {
        private readonly CyberRiskContext _context;
        private RiskLevelSettings? _cachedSettings;
        private DateTime _cacheExpiry = DateTime.MinValue;
        private readonly TimeSpan _cacheTimeout = TimeSpan.FromMinutes(5);

        public RiskLevelSettingsService(CyberRiskContext context)
        {
            _context = context;
        }

        public async Task<RiskLevelSettings> GetActiveSettingsAsync()
        {
            // Check cache first
            if (_cachedSettings != null && DateTime.UtcNow < _cacheExpiry)
            {
                return _cachedSettings;
            }

            try
            {
                var settings = await _context.RiskLevelSettings
                    .Where(s => s.IsActive)
                    .OrderByDescending(s => s.CreatedDate)
                    .FirstOrDefaultAsync();

                if (settings == null)
                {
                    // Create default settings if none exist
                    settings = await CreateDefaultSettingsAsync();
                }

                // Update cache
                _cachedSettings = settings;
                _cacheExpiry = DateTime.UtcNow.Add(_cacheTimeout);

                return settings;
            }
            catch
            {
                // Return default settings if database error
                return new RiskLevelSettings();
            }
        }

        public async Task<RiskLevelSettings> UpdateSettingsAsync(RiskLevelSettings settings)
        {
            try
            {
                // Validate settings
                if (!settings.IsValid())
                {
                    throw new ArgumentException("Invalid threshold configuration. Ensure Critical >= High >= Medium.");
                }

                // Clear any existing tracking to prevent conflicts
                _context.ChangeTracker.Clear();

                // Set inactive all current active settings
                var currentActive = await _context.RiskLevelSettings
                    .Where(s => s.IsActive)
                    .ToListAsync();

                foreach (var current in currentActive)
                {
                    current.IsActive = false;
                }

                // Set metadata
                settings.LastModifiedDate = DateTime.UtcNow;
                settings.IsActive = true;

                if (settings.Id == 0)
                {
                    // New settings
                    settings.CreatedDate = DateTime.UtcNow;
                    _context.RiskLevelSettings.Add(settings);
                }
                else
                {
                    // Update existing - check if already tracked
                    var trackedEntity = _context.RiskLevelSettings.Local
                        .FirstOrDefault(e => e.Id == settings.Id);
                    
                    if (trackedEntity != null)
                    {
                        // Update the tracked entity properties instead of attaching a new one
                        trackedEntity.Name = settings.Name;
                        trackedEntity.Description = settings.Description;
                        trackedEntity.FairCriticalThreshold = settings.FairCriticalThreshold;
                        trackedEntity.FairHighThreshold = settings.FairHighThreshold;
                        trackedEntity.FairMediumThreshold = settings.FairMediumThreshold;
                        trackedEntity.QualitativeCriticalThreshold = settings.QualitativeCriticalThreshold;
                        trackedEntity.QualitativeHighThreshold = settings.QualitativeHighThreshold;
                        trackedEntity.QualitativeMediumThreshold = settings.QualitativeMediumThreshold;
                        trackedEntity.RiskAppetiteThreshold = settings.RiskAppetiteThreshold;
                        trackedEntity.CybersecurityInsuranceAmount = settings.CybersecurityInsuranceAmount;
                        trackedEntity.LastModifiedBy = settings.LastModifiedBy;
                        trackedEntity.LastModifiedDate = settings.LastModifiedDate;
                        trackedEntity.IsActive = settings.IsActive;
                        
                        // Entity is already tracked and will be updated automatically
                    }
                    else
                    {
                        // Not tracked, safe to attach
                        _context.RiskLevelSettings.Attach(settings);
                        _context.Entry(settings).State = EntityState.Modified;
                    }
                }

                await _context.SaveChangesAsync();

                // Clear cache
                _cachedSettings = null;
                _cacheExpiry = DateTime.MinValue;

                return settings;
            }
            catch (Exception ex)
            {
                // Provide more detailed error information
                var errorMessage = $"Failed to update risk level settings. Error: {ex.Message}";
                
                // Log additional context for debugging
                if (ex.InnerException != null)
                {
                    errorMessage += $" Inner Exception: {ex.InnerException.Message}";
                }

                // Clear change tracker to reset state
                _context.ChangeTracker.Clear();
                
                throw new InvalidOperationException(errorMessage, ex);
            }
        }

        public async Task<RiskLevelSettings> CreateDefaultSettingsAsync()
        {
            var defaultSettings = new RiskLevelSettings
            {
                Name = "Default Risk Level Thresholds",
                Description = "Default system configuration for risk level thresholds",
                CreatedBy = "System",
                LastModifiedBy = "System",
                IsActive = true
            };

            _context.RiskLevelSettings.Add(defaultSettings);
            await _context.SaveChangesAsync();

            return defaultSettings;
        }

        public async Task<IEnumerable<RiskLevelSettings>> GetAllSettingsAsync()
        {
            try
            {
                return await _context.RiskLevelSettings
                    .OrderByDescending(s => s.CreatedDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<RiskLevelSettings>();
            }
        }

        public async Task<RiskLevelSettings?> GetSettingsByIdAsync(int id)
        {
            try
            {
                return await _context.RiskLevelSettings.FindAsync(id);
            }
            catch
            {
                return null;
            }
        }

        public string GetRiskLevel(AssessmentType assessmentType, decimal value)
        {
            var settings = GetActiveSettingsAsync().GetAwaiter().GetResult();

            return assessmentType switch
            {
                AssessmentType.FAIR => settings.GetFairRiskLevel(value),
                AssessmentType.Qualitative => settings.GetQualitativeRiskLevel(value),
                _ => "Unknown"
            };
        }

        public string GetFairRiskLevel(decimal ale)
        {
            var settings = GetActiveSettingsAsync().GetAwaiter().GetResult();
            return settings.GetFairRiskLevel(ale);
        }

        public string GetQualitativeRiskLevel(decimal riskScore)
        {
            var settings = GetActiveSettingsAsync().GetAwaiter().GetResult();
            return settings.GetQualitativeRiskLevel(riskScore);
        }

        public async Task<object> GetSettingsForJavaScriptAsync()
        {
            var settings = await GetActiveSettingsAsync();

            return new
            {
                fair = new
                {
                    critical = settings.FairCriticalThreshold,
                    high = settings.FairHighThreshold,
                    medium = settings.FairMediumThreshold
                },
                qualitative = new
                {
                    critical = settings.QualitativeCriticalThreshold,
                    high = settings.QualitativeHighThreshold,
                    medium = settings.QualitativeMediumThreshold
                },
                riskAppetite = settings.RiskAppetiteThreshold,
                cybersecurityInsurance = settings.CybersecurityInsuranceAmount
            };
        }

        public async Task<decimal> GetRiskAppetiteThresholdAsync()
        {
            var settings = await GetActiveSettingsAsync();
            return settings.RiskAppetiteThreshold;
        }

        public async Task<bool> IsRiskAboveAppetiteAsync(decimal riskScore, AssessmentType assessmentType)
        {
            var settings = await GetActiveSettingsAsync();
            
            // For qualitative assessments, compare directly to risk appetite threshold
            if (assessmentType == AssessmentType.Qualitative)
            {
                return riskScore > settings.RiskAppetiteThreshold;
            }
            
            // For FAIR assessments, convert ALE to risk level then compare
            if (assessmentType == AssessmentType.FAIR)
            {
                var riskLevel = settings.GetFairRiskLevel(riskScore);
                var riskLevelScore = riskLevel switch
                {
                    "Critical" => 16,
                    "High" => 10,
                    "Medium" => 4,
                    "Low" => 1,
                    _ => 0
                };
                return riskLevelScore > settings.RiskAppetiteThreshold;
            }
            
            return false;
        }
    }
}