using CyberRiskApp.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
    public class RiskLevelSettingsController : Controller
    {
        private readonly IRiskLevelSettingsService _settingsService;

        public RiskLevelSettingsController(IRiskLevelSettingsService settingsService)
        {
            _settingsService = settingsService;
        }

        // GET: RiskLevelSettings
        public async Task<IActionResult> Index()
        {
            var settings = await _settingsService.GetAllSettingsAsync();
            return View(settings);
        }

        // GET: RiskLevelSettings/Details/5
        public async Task<IActionResult> Details(int id)
        {
            var settings = await _settingsService.GetSettingsByIdAsync(id);
            if (settings == null)
                return NotFound();

            return View(settings);
        }

        // GET: RiskLevelSettings/Current
        public async Task<IActionResult> Current()
        {
            var settings = await _settingsService.GetActiveSettingsAsync();
            return View("Details", settings);
        }

        // GET: RiskLevelSettings/Edit/5
        public async Task<IActionResult> Edit(int? id)
        {
            RiskLevelSettings settings;

            if (id.HasValue)
            {
                settings = await _settingsService.GetSettingsByIdAsync(id.Value);
                if (settings == null)
                    return NotFound();
            }
            else
            {
                // Create new settings based on current active settings
                var currentSettings = await _settingsService.GetActiveSettingsAsync();
                settings = new RiskLevelSettings
                {
                    Name = $"Custom Settings - {DateTime.Now:yyyy-MM-dd HH:mm}",
                    Description = "Custom risk level threshold configuration",
                    FairCriticalThreshold = currentSettings.FairCriticalThreshold,
                    FairHighThreshold = currentSettings.FairHighThreshold,
                    FairMediumThreshold = currentSettings.FairMediumThreshold,
                    QualitativeCriticalThreshold = currentSettings.QualitativeCriticalThreshold,
                    QualitativeHighThreshold = currentSettings.QualitativeHighThreshold,
                    QualitativeMediumThreshold = currentSettings.QualitativeMediumThreshold,
                    RiskAppetiteThreshold = currentSettings.RiskAppetiteThreshold,
                    CybersecurityInsuranceAmount = currentSettings.CybersecurityInsuranceAmount,
                    CreatedBy = User.Identity?.Name ?? "Unknown User",
                    LastModifiedBy = User.Identity?.Name ?? "Unknown User"
                };
            }

            return View(settings);
        }

        // POST: RiskLevelSettings/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, RiskLevelSettings settings)
        {
            if (id != settings.Id && id != 0)
            {
                return NotFound();
            }

            try
            {
                // Set user information
                settings.LastModifiedBy = User.Identity?.Name ?? "Unknown User";
                if (settings.Id == 0)
                {
                    settings.CreatedBy = User.Identity?.Name ?? "Unknown User";
                }

                // Validate thresholds
                if (!settings.IsValid())
                {
                    ModelState.AddModelError("", "Invalid threshold configuration. Ensure Critical >= High >= Medium for both assessment types.");
                    return View(settings);
                }

                // Additional validation
                if (settings.FairCriticalThreshold <= 0 || settings.FairHighThreshold <= 0 || settings.FairMediumThreshold <= 0)
                {
                    ModelState.AddModelError("", "FAIR thresholds must be greater than 0.");
                    return View(settings);
                }

                if (settings.QualitativeCriticalThreshold <= 0 || settings.QualitativeHighThreshold <= 0 || settings.QualitativeMediumThreshold <= 0)
                {
                    ModelState.AddModelError("", "Qualitative thresholds must be greater than 0.");
                    return View(settings);
                }

                if (settings.RiskAppetiteThreshold < 0 || settings.RiskAppetiteThreshold > 16)
                {
                    ModelState.AddModelError("", "Risk Appetite Threshold must be between 0 and 16.");
                    return View(settings);
                }

                if (settings.CybersecurityInsuranceAmount < 0)
                {
                    ModelState.AddModelError("", "Cybersecurity Insurance Amount must be a positive number.");
                    return View(settings);
                }

                if (!ModelState.IsValid)
                {
                    return View(settings);
                }

                await _settingsService.UpdateSettingsAsync(settings);

                TempData["Success"] = "Risk level settings updated successfully! Changes will take effect immediately for new assessments.";
                return RedirectToAction(nameof(Current));
            }
            catch (ArgumentException ex)
            {
                ModelState.AddModelError("", ex.Message);
                return View(settings);
            }
            catch (InvalidOperationException ex)
            {
                // Detailed error for Entity Framework issues
                ModelState.AddModelError("", ex.Message);
                TempData["Error"] = $"Database error updating settings: {ex.Message}";
                return View(settings);
            }
            catch (Exception ex)
            {
                // Generic error handler
                var errorMessage = $"Error updating settings: {ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMessage += $" Details: {ex.InnerException.Message}";
                }
                ModelState.AddModelError("", errorMessage);
                TempData["Error"] = errorMessage;
                return View(settings);
            }
        }

        // GET: RiskLevelSettings/Create
        public async Task<IActionResult> Create()
        {
            return await Edit(null);
        }

        // POST: RiskLevelSettings/ResetToDefault
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ResetToDefault()
        {
            try
            {
                var defaultSettings = new RiskLevelSettings
                {
                    Name = $"Reset to Default - {DateTime.Now:yyyy-MM-dd HH:mm}",
                    Description = "Default risk level threshold configuration (reset)",
                    CreatedBy = User.Identity?.Name ?? "Unknown User",
                    LastModifiedBy = User.Identity?.Name ?? "Unknown User"
                };

                await _settingsService.UpdateSettingsAsync(defaultSettings);

                TempData["Success"] = "Risk level settings have been reset to default values.";
                return RedirectToAction(nameof(Current));
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error resetting settings: {ex.Message}";
                return RedirectToAction(nameof(Current));
            }
        }

        // GET: RiskLevelSettings/GetThresholds (for AJAX)
        [HttpGet]
        public async Task<IActionResult> GetThresholds()
        {
            var thresholds = await _settingsService.GetSettingsForJavaScriptAsync();
            return Json(thresholds);
        }

        // GET: RiskLevelSettings/GetInsuranceAmount (for AJAX)
        [HttpGet]
        public async Task<IActionResult> GetInsuranceAmount()
        {
            try
            {
                var settings = await _settingsService.GetActiveSettingsAsync();
                return Json(new { 
                    amount = settings?.CybersecurityInsuranceAmount ?? 0,
                    formatted = (settings?.CybersecurityInsuranceAmount ?? 0).ToString("C")
                });
            }
            catch (Exception ex)
            {
                return Json(new { 
                    amount = 0,
                    formatted = "$0.00",
                    error = "Unable to load insurance amount"
                });
            }
        }

        // GET: RiskLevelSettings/Preview (for testing thresholds)
        public async Task<IActionResult> Preview(decimal fairCritical = 1000000, decimal fairHigh = 100000, decimal fairMedium = 10000,
                                               decimal qualCritical = 16, decimal qualHigh = 10, decimal qualMedium = 4)
        {
            var previewSettings = new RiskLevelSettings
            {
                FairCriticalThreshold = fairCritical,
                FairHighThreshold = fairHigh,
                FairMediumThreshold = fairMedium,
                QualitativeCriticalThreshold = qualCritical,
                QualitativeHighThreshold = qualHigh,
                QualitativeMediumThreshold = qualMedium
            };

            // Generate sample data for preview
            var sampleData = new
            {
                Fair = new[]
                {
                    new { ALE = 2000000m, Level = previewSettings.GetFairRiskLevel(2000000m) },
                    new { ALE = 500000m, Level = previewSettings.GetFairRiskLevel(500000m) },
                    new { ALE = 50000m, Level = previewSettings.GetFairRiskLevel(50000m) },
                    new { ALE = 5000m, Level = previewSettings.GetFairRiskLevel(5000m) }
                },
                Qualitative = new[]
                {
                    new { Score = 16m, Level = previewSettings.GetQualitativeRiskLevel(16m) },
                    new { Score = 12m, Level = previewSettings.GetQualitativeRiskLevel(12m) },
                    new { Score = 8m, Level = previewSettings.GetQualitativeRiskLevel(8m) },
                    new { Score = 3m, Level = previewSettings.GetQualitativeRiskLevel(3m) }
                }
            };

            return Json(sampleData);
        }

        // GET: RiskLevelSettings/GetActiveSettings (API endpoint for AJAX)
        [HttpGet]
        public async Task<IActionResult> GetActiveSettings()
        {
            try
            {
                var settings = await _settingsService.GetActiveSettingsAsync();
                if (settings == null)
                {
                    return NotFound();
                }
                
                return Json(settings);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // POST: RiskLevelSettings/UpdateSettings (API endpoint for AJAX)
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateSettings([FromBody] RiskLevelSettingsUpdateModel model)
        {
            try
            {
                var currentSettings = await _settingsService.GetActiveSettingsAsync();
                if (currentSettings == null)
                {
                    return Json(new { success = false, message = "No active settings found." });
                }

                // Update only the qualitative thresholds and risk appetite
                currentSettings.QualitativeMediumThreshold = model.QualitativeMediumThreshold;
                currentSettings.QualitativeHighThreshold = model.QualitativeHighThreshold;
                currentSettings.QualitativeCriticalThreshold = model.QualitativeCriticalThreshold;
                currentSettings.RiskAppetiteThreshold = model.RiskAppetiteThreshold;
                currentSettings.LastModifiedBy = User.Identity?.Name ?? "System";
                currentSettings.LastModifiedDate = DateTime.UtcNow;

                await _settingsService.UpdateSettingsAsync(currentSettings);

                return Json(new { success = true, message = "Risk level settings updated successfully!" });
            }
            catch (ArgumentException ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "An error occurred while updating settings: " + ex.Message });
            }
        }
    }

    // DTO for updating risk level settings via AJAX
    public class RiskLevelSettingsUpdateModel
    {
        public decimal QualitativeMediumThreshold { get; set; }
        public decimal QualitativeHighThreshold { get; set; }
        public decimal QualitativeCriticalThreshold { get; set; }
        public decimal RiskAppetiteThreshold { get; set; }
    }
}