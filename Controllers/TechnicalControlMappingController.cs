using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Services;
using CyberRiskApp.Models;
using CyberRiskApp.Authorization;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
    public class TechnicalControlMappingController : Controller
    {
        private readonly ITechnicalControlMappingService _mappingService;
        private readonly IReferenceDataService _referenceDataService;
        private readonly ILogger<TechnicalControlMappingController> _logger;

        public TechnicalControlMappingController(
            ITechnicalControlMappingService mappingService,
            IReferenceDataService referenceDataService,
            ILogger<TechnicalControlMappingController> logger)
        {
            _mappingService = mappingService;
            _referenceDataService = referenceDataService;
            _logger = logger;
        }

        // GET: TechnicalControlMapping
        public async Task<IActionResult> Index(string? searchTerm, string? framework)
        {
            try
            {
                var mappings = await _mappingService.SearchMappingsAsync(searchTerm ?? string.Empty, framework);
                var analytics = await _mappingService.GetMappingAnalyticsAsync();

                ViewBag.SearchTerm = searchTerm;
                ViewBag.Framework = framework;
                ViewBag.Analytics = analytics;

                return View(mappings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading technical control mappings index");
                TempData["Error"] = "An error occurred while loading the technical control mappings.";
                return RedirectToAction("Index", "Dashboard");
            }
        }

        // GET: TechnicalControlMapping/Details/{technicalControlId}
        public async Task<IActionResult> Details(int technicalControlId)
        {
            try
            {
                var mapping = await _mappingService.GetTechnicalControlMappingsAsync(technicalControlId);
                
                if (string.IsNullOrEmpty(mapping.TechnicalControlName))
                {
                    TempData["Error"] = "Technical control not found.";
                    return RedirectToAction("Index");
                }

                return View(mapping);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading technical control mapping details for {TechnicalControlId}", technicalControlId);
                TempData["Error"] = "An error occurred while loading the technical control mapping details.";
                return RedirectToAction("Index");
            }
        }

        // GET: TechnicalControlMapping/Create/{technicalControlId}
        public async Task<IActionResult> Create(int technicalControlId)
        {
            try
            {
                var technicalControl = await _referenceDataService.GetByIdAsync(technicalControlId);
                if (technicalControl?.Category != ReferenceDataCategory.TechnicalControl)
                {
                    TempData["Error"] = "Technical control not found.";
                    return RedirectToAction("Index");
                }

                var availableControls = await _mappingService.GetAvailableComplianceControlsAsync(technicalControlId);

                ViewBag.TechnicalControl = technicalControl;
                ViewBag.AvailableControls = availableControls;

                return View();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading create mapping page for technical control {TechnicalControlId}", technicalControlId);
                TempData["Error"] = "An error occurred while loading the create mapping page.";
                return RedirectToAction("Index");
            }
        }

        // GET: TechnicalControlMapping/Edit/{mappingId}
        public async Task<IActionResult> Edit(int mappingId)
        {
            try
            {
                // This would require getting the specific mapping details
                // For now, redirect to the Details view which has inline editing capabilities
                TempData["Info"] = "Use the technical control details page to edit mappings.";
                return RedirectToAction("Index");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading edit mapping page for {MappingId}", mappingId);
                TempData["Error"] = "An error occurred while loading the edit mapping page.";
                return RedirectToAction("Index");
            }
        }

        // GET: TechnicalControlMapping/Analytics
        public async Task<IActionResult> Analytics()
        {
            try
            {
                var analytics = await _mappingService.GetMappingAnalyticsAsync();
                var unmappedTechnical = await _mappingService.GetUnmappedTechnicalControlsAsync();
                var unmappedCompliance = await _mappingService.GetUnmappedComplianceControlsAsync();

                ViewBag.UnmappedTechnicalControls = unmappedTechnical;
                ViewBag.UnmappedComplianceControls = unmappedCompliance;

                return View(analytics);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading technical control mapping analytics");
                TempData["Error"] = "An error occurred while loading the mapping analytics.";
                return RedirectToAction("Index");
            }
        }

        // GET: TechnicalControlMapping/SelectTechnicalControl
        public async Task<IActionResult> SelectTechnicalControl()
        {
            try
            {
                var technicalControls = await _referenceDataService.GetByCategoryAsync(ReferenceDataCategory.TechnicalControl);
                var mappedControls = await _mappingService.GetTechnicalControlsWithMappingsAsync();
                var unmappedControls = await _mappingService.GetUnmappedTechnicalControlsAsync();

                ViewBag.MappedControls = mappedControls;
                ViewBag.UnmappedControls = unmappedControls;

                return View(technicalControls);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading technical control selection page");
                TempData["Error"] = "An error occurred while loading the technical control selection page.";
                return RedirectToAction("Index");
            }
        }

        // GET: TechnicalControlMapping/BulkCreate/{technicalControlId}
        public async Task<IActionResult> BulkCreate(int technicalControlId)
        {
            try
            {
                var technicalControl = await _referenceDataService.GetByIdAsync(technicalControlId);
                if (technicalControl?.Category != ReferenceDataCategory.TechnicalControl)
                {
                    TempData["Error"] = "Technical control not found.";
                    return RedirectToAction("SelectTechnicalControl");
                }

                var availableControls = await _mappingService.GetAvailableComplianceControlsAsync(technicalControlId);
                var existingMappings = await _mappingService.GetMappedComplianceControlsAsync(technicalControlId);

                ViewBag.TechnicalControl = technicalControl;
                ViewBag.AvailableControls = availableControls;
                ViewBag.ExistingMappings = existingMappings;

                return View();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading bulk create page for technical control {TechnicalControlId}", technicalControlId);
                TempData["Error"] = "An error occurred while loading the bulk create page.";
                return RedirectToAction("SelectTechnicalControl");
            }
        }

        // GET: TechnicalControlMapping/Export
        public async Task<IActionResult> Export()
        {
            try
            {
                var data = await _mappingService.GetMappingExportDataAsync();
                
                // For now, return JSON data. In a full implementation, this would generate Excel/CSV
                return Json(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting technical control mappings");
                TempData["Error"] = "An error occurred while exporting the mappings.";
                return RedirectToAction("Index");
            }
        }

        // GET: TechnicalControlMapping/ComplianceControlSearch
        public async Task<IActionResult> ComplianceControlSearch(string? searchTerm, string? framework)
        {
            try
            {
                var controls = await _mappingService.SearchComplianceControlsAsync(searchTerm ?? string.Empty, framework);
                return PartialView("_ComplianceControlSearchResults", controls);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching compliance controls");
                return PartialView("_ComplianceControlSearchResults", new List<ComplianceControlInfo>());
            }
        }
    }
}