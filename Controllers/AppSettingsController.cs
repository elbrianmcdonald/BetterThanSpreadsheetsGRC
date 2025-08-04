using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Services;
using CyberRiskApp.Models;
using CyberRiskApp.Authorization;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireAdminRole)]
    public class AppSettingsController : Controller
    {
        private readonly IAppSettingsService _appSettingsService;
        private readonly ILogger<AppSettingsController> _logger;

        public AppSettingsController(IAppSettingsService appSettingsService, ILogger<AppSettingsController> logger)
        {
            _appSettingsService = appSettingsService;
            _logger = logger;
        }

        // GET: AppSettings
        public async Task<IActionResult> Index()
        {
            try
            {
                var settings = await _appSettingsService.GetOrCreateAppSettingsAsync();
                return View(settings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading app settings");
                TempData["Error"] = "Error loading settings: " + ex.Message;
                return View(new AppSettings());
            }
        }

        // POST: AppSettings
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Index(AppSettings settings)
        {
            try
            {
                if (ModelState.IsValid)
                {
                    settings.UpdatedBy = User.Identity?.Name ?? "Unknown";
                    await _appSettingsService.UpdateAppSettingsAsync(settings);
                    TempData["Success"] = $"Application domain updated to '{settings.DomainName}' successfully.";
                    return RedirectToAction(nameof(Index));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating app settings");
                TempData["Error"] = "Error updating settings: " + ex.Message;
            }

            return View(settings);
        }
    }
}