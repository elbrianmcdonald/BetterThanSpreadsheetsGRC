using CyberRiskApp.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireAnyRole)]
    public class ThirdPartiesController : Controller
    {
        private readonly IThirdPartyService _thirdPartyService;
        private readonly ILogger<ThirdPartiesController> _logger;

        public ThirdPartiesController(IThirdPartyService thirdPartyService, ILogger<ThirdPartiesController> logger)
        {
            _thirdPartyService = thirdPartyService;
            _logger = logger;
        }

        // GET: ThirdParties
        public async Task<IActionResult> Index(ThirdPartyFilterViewModel? filter)
        {
            var allThirdParties = await _thirdPartyService.GetAllThirdPartiesAsync();
            
            // Apply filters
            var filteredThirdParties = allThirdParties.AsEnumerable();

            if (filter != null)
            {
                if (!string.IsNullOrEmpty(filter.Name))
                    filteredThirdParties = filteredThirdParties.Where(tp => tp.Name.Contains(filter.Name, StringComparison.OrdinalIgnoreCase));

                if (!string.IsNullOrEmpty(filter.Organization))
                    filteredThirdParties = filteredThirdParties.Where(tp => tp.Organization.Contains(filter.Organization, StringComparison.OrdinalIgnoreCase));

                if (!string.IsNullOrEmpty(filter.RepresentativeEmail))
                    filteredThirdParties = filteredThirdParties.Where(tp => tp.RepresentativeEmail.Contains(filter.RepresentativeEmail, StringComparison.OrdinalIgnoreCase));

                if (filter.TPRAStatus.HasValue)
                    filteredThirdParties = filteredThirdParties.Where(tp => tp.TPRAStatus == filter.TPRAStatus.Value);

                if (filter.RiskLevel.HasValue)
                    filteredThirdParties = filteredThirdParties.Where(tp => tp.RiskLevel == filter.RiskLevel.Value);

                if (filter.BIARating.HasValue)
                    filteredThirdParties = filteredThirdParties.Where(tp => tp.BIARating == filter.BIARating.Value);
            }

            // Create view model with filter options
            var viewModel = new ThirdPartyFilterViewModel
            {
                FilteredThirdParties = filteredThirdParties.ToList(),
                TotalCount = allThirdParties.Count(),
                FilteredCount = filteredThirdParties.Count(),

                // Populate filter form values
                Name = filter?.Name,
                Organization = filter?.Organization,
                RepresentativeEmail = filter?.RepresentativeEmail,
                TPRAStatus = filter?.TPRAStatus,
                RiskLevel = filter?.RiskLevel,
                BIARating = filter?.BIARating,

                // Create select lists
                TPRAStatusOptions = new SelectList(Enum.GetValues<TPRAStatus>().Cast<TPRAStatus>()
                    .Select(v => new { Value = (int)v, Text = v.ToString() }), "Value", "Text"),
                RiskLevelOptions = new SelectList(Enum.GetValues<RiskLevel>().Cast<RiskLevel>()
                    .Select(v => new { Value = (int)v, Text = v.ToString() }), "Value", "Text"),
                BIARatingOptions = new SelectList(Enum.GetValues<BIARating>().Cast<BIARating>()
                    .Select(v => new { Value = (int)v, Text = v.ToString() }), "Value", "Text"),

                // Dynamic options from existing data
                OrganizationOptions = new SelectList(allThirdParties.Where(tp => !string.IsNullOrEmpty(tp.Organization))
                    .Select(tp => tp.Organization).Distinct().OrderBy(x => x))
            };

            return View(viewModel);
        }

        // GET: ThirdParties/Details/5
        public async Task<IActionResult> Details(int id)
        {
            var thirdParty = await _thirdPartyService.GetThirdPartyByIdAsync(id);
            if (thirdParty == null)
                return NotFound();

            return View(thirdParty);
        }

        // GET: ThirdParties/Create
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public IActionResult Create()
        {
            var model = new ThirdParty
            {
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            return View(model);
        }

        // POST: ThirdParties/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Create(ThirdParty thirdParty)
        {
            // Check for unique name
            if (!await _thirdPartyService.IsThirdPartyNameUniqueAsync(thirdParty.Name))
            {
                ModelState.AddModelError("Name", "A third party with this name already exists.");
            }

            if (ModelState.IsValid)
            {
                try
                {
                    thirdParty.CreatedBy = User.Identity?.Name;
                    thirdParty.UpdatedBy = User.Identity?.Name;

                    var createdThirdParty = await _thirdPartyService.CreateThirdPartyAsync(thirdParty);
                    TempData["Success"] = $"Third party '{createdThirdParty.Name}' created successfully.";
                    return RedirectToAction(nameof(Index));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error creating third party {Name}", thirdParty.Name);
                    TempData["Error"] = $"Error creating third party: {ex.Message}";
                }
            }

            return View(thirdParty);
        }

        // GET: ThirdParties/Edit/5
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Edit(int id)
        {
            var thirdParty = await _thirdPartyService.GetThirdPartyByIdAsync(id);
            if (thirdParty == null)
                return NotFound();

            return View(thirdParty);
        }

        // POST: ThirdParties/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Edit(int id, ThirdParty thirdParty)
        {
            if (id != thirdParty.Id)
                return NotFound();

            // Check for unique name (excluding current record)
            if (!await _thirdPartyService.IsThirdPartyNameUniqueAsync(thirdParty.Name, thirdParty.Id))
            {
                ModelState.AddModelError("Name", "A third party with this name already exists.");
            }

            if (ModelState.IsValid)
            {
                try
                {
                    thirdParty.UpdatedBy = User.Identity?.Name;
                    await _thirdPartyService.UpdateThirdPartyAsync(thirdParty);
                    TempData["Success"] = $"Third party '{thirdParty.Name}' updated successfully.";
                    return RedirectToAction(nameof(Index));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error updating third party with ID {Id}", thirdParty.Id);
                    TempData["Error"] = $"Error updating third party: {ex.Message}";
                }
            }

            return View(thirdParty);
        }

        // POST: ThirdParties/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            try
            {
                var thirdParty = await _thirdPartyService.GetThirdPartyByIdAsync(id);
                if (thirdParty == null)
                {
                    TempData["Error"] = "Third party not found.";
                    return RedirectToAction(nameof(Index));
                }

                var thirdPartyName = thirdParty.Name;
                var success = await _thirdPartyService.DeleteThirdPartyAsync(id);

                if (success)
                {
                    TempData["Success"] = $"Third party '{thirdPartyName}' deleted successfully.";
                }
                else
                {
                    TempData["Error"] = "Failed to delete third party. Please try again.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting third party with ID {Id}", id);
                TempData["Error"] = $"Error deleting third party: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // GET: ThirdParties/Export
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> ExportToExcel()
        {
            try
            {
                var thirdParties = await _thirdPartyService.GetAllThirdPartiesAsync();
                
                // TODO: Implement export service similar to other modules
                // var excelData = await _exportService.ExportThirdPartiesToExcelAsync(thirdParties);
                // var fileName = $"ThirdParty_Register_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";
                // return File(excelData, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
                
                TempData["Info"] = "Excel export functionality will be implemented in a future update.";
                return RedirectToAction(nameof(Index));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting third parties to Excel");
                TempData["Error"] = $"Error exporting third parties: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }
    }
}