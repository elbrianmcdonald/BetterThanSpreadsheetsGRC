using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Services;
using CyberRiskApp.Models;
using CyberRiskApp.Authorization;
using CyberRiskApp.ViewModels;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireAdminRole)]
    public class ReferenceDataManagementController : Controller
    {
        private readonly IReferenceDataService _referenceDataService;
        private readonly ILogger<ReferenceDataManagementController> _logger;

        public ReferenceDataManagementController(
            IReferenceDataService referenceDataService,
            ILogger<ReferenceDataManagementController> logger)
        {
            _referenceDataService = referenceDataService;
            _logger = logger;
        }

        // GET: ReferenceDataManagement
        public async Task<IActionResult> Index()
        {
            try
            {
                var counts = await _referenceDataService.GetCategoryCountsAsync();
                var unusedEntries = await _referenceDataService.GetUnusedEntriesAsync();

                var viewModel = new ReferenceDataManagementViewModel
                {
                    CategoryCounts = counts,
                    UnusedEntriesCount = unusedEntries.Count(),
                    Categories = Enum.GetValues<ReferenceDataCategory>()
                        .Select(c => new CategoryViewModel
                        {
                            Id = (int)c,
                            Name = c.ToString(),
                            DisplayName = GetCategoryDisplayName(c),
                            Count = counts.GetValueOrDefault(c, 0)
                        })
                        .ToList()
                };

                return View(viewModel);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading reference data management page");
                TempData["Error"] = "An error occurred while loading the reference data management page.";
                return RedirectToAction("Index", "Dashboard");
            }
        }

        // GET: ReferenceDataManagement/Category/1
        public async Task<IActionResult> Category(ReferenceDataCategory category, int page = 1, int pageSize = 50, string? search = null)
        {
            try
            {
                var entries = await _referenceDataService.GetEntriesByCategoryAsync(category, true);
                
                // Apply search filter
                if (!string.IsNullOrEmpty(search))
                {
                    entries = entries.Where(e => e.Value.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                                                (e.Description?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false));
                }

                // Apply pagination
                var totalItems = entries.Count();
                var pagedEntries = entries
                    .OrderBy(e => e.Value)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();

                var viewModel = new CategoryManagementViewModel
                {
                    Category = category,
                    CategoryDisplayName = GetCategoryDisplayName(category),
                    Entries = pagedEntries,
                    CurrentPage = page,
                    PageSize = pageSize,
                    TotalItems = totalItems,
                    TotalPages = (int)Math.Ceiling((double)totalItems / pageSize),
                    SearchTerm = search
                };

                return View(viewModel);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading category {Category}", category);
                TempData["Error"] = $"An error occurred while loading {GetCategoryDisplayName(category)} data.";
                return RedirectToAction("Index");
            }
        }

        // GET: ReferenceDataManagement/Create/1
        public IActionResult Create(ReferenceDataCategory category)
        {
            var viewModel = new ViewModels.CreateReferenceDataViewModel
            {
                Category = category,
                CategoryDisplayName = GetCategoryDisplayName(category)
            };

            return View(viewModel);
        }

        // POST: ReferenceDataManagement/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(ViewModels.CreateReferenceDataViewModel model)
        {
            if (!ModelState.IsValid)
            {
                model.CategoryDisplayName = GetCategoryDisplayName(model.Category);
                return View(model);
            }

            try
            {
                var userId = User.Identity?.Name ?? "Unknown";
                var serviceModel = new Models.CreateReferenceDataViewModel
                {
                    Category = model.Category,
                    Value = model.Value,
                    Description = model.Description
                };
                await _referenceDataService.CreateAsync(serviceModel, userId);
                
                TempData["Success"] = $"{GetCategoryDisplayName(model.Category)} entry '{model.Value}' created successfully.";
                return RedirectToAction("Category", new { category = model.Category });
            }
            catch (InvalidOperationException ex)
            {
                ModelState.AddModelError("Value", ex.Message);
                model.CategoryDisplayName = GetCategoryDisplayName(model.Category);
                return View(model);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating reference data entry");
                TempData["Error"] = "An error occurred while creating the entry.";
                model.CategoryDisplayName = GetCategoryDisplayName(model.Category);
                return View(model);
            }
        }

        // GET: ReferenceDataManagement/Edit/5
        public async Task<IActionResult> Edit(int id)
        {
            try
            {
                var entry = await _referenceDataService.GetByIdAsync(id);
                if (entry == null)
                {
                    TempData["Error"] = "Reference data entry not found.";
                    return RedirectToAction("Index");
                }

                var viewModel = new ViewModels.EditReferenceDataViewModel
                {
                    Id = entry.Id,
                    Category = entry.Category,
                    CategoryDisplayName = GetCategoryDisplayName(entry.Category),
                    Value = entry.Value,
                    Description = entry.Description,
                    IsActive = entry.IsActive,
                    UsageCount = entry.UsageCount,
                    CreatedBy = entry.CreatedBy,
                    CreatedAt = entry.CreatedAt,
                    UpdatedBy = entry.ModifiedBy,
                    UpdatedAt = entry.ModifiedAt
                };

                return View(viewModel);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading reference data entry {Id}", id);
                TempData["Error"] = "An error occurred while loading the entry.";
                return RedirectToAction("Index");
            }
        }

        // POST: ReferenceDataManagement/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, ViewModels.EditReferenceDataViewModel model)
        {
            if (id != model.Id)
            {
                TempData["Error"] = "Invalid request.";
                return RedirectToAction("Index");
            }

            if (!ModelState.IsValid)
            {
                model.CategoryDisplayName = GetCategoryDisplayName(model.Category);
                return View(model);
            }

            try
            {
                var userId = User.Identity?.Name ?? "Unknown";
                await _referenceDataService.UpdateAsync(id, model.Value, model.Description ?? string.Empty, userId);
                
                // Update active status if changed
                if (model.IsActive != null)
                {
                    await _referenceDataService.SetActiveStatusAsync(id, model.IsActive.Value, userId);
                }

                TempData["Success"] = $"{GetCategoryDisplayName(model.Category)} entry updated successfully.";
                return RedirectToAction("Category", new { category = model.Category });
            }
            catch (InvalidOperationException ex)
            {
                ModelState.AddModelError("Value", ex.Message);
                model.CategoryDisplayName = GetCategoryDisplayName(model.Category);
                return View(model);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating reference data entry {Id}", id);
                TempData["Error"] = "An error occurred while updating the entry.";
                model.CategoryDisplayName = GetCategoryDisplayName(model.Category);
                return View(model);
            }
        }

        // POST: ReferenceDataManagement/Delete/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id, ReferenceDataCategory category)
        {
            try
            {
                var userId = User.Identity?.Name ?? "Unknown";
                var result = await _referenceDataService.DeleteAsync(id, userId);
                
                if (result)
                {
                    TempData["Success"] = $"{GetCategoryDisplayName(category)} entry deleted successfully.";
                }
                else
                {
                    TempData["Error"] = "Entry not found or could not be deleted.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting reference data entry {Id}", id);
                TempData["Error"] = "An error occurred while deleting the entry.";
            }

            return RedirectToAction("Category", new { category });
        }

        // POST: ReferenceDataManagement/ToggleActive/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ToggleActive(int id, ReferenceDataCategory category)
        {
            try
            {
                var entry = await _referenceDataService.GetByIdAsync(id);
                if (entry == null)
                {
                    TempData["Error"] = "Entry not found.";
                    return RedirectToAction("Category", new { category });
                }

                var userId = User.Identity?.Name ?? "Unknown";
                await _referenceDataService.SetActiveStatusAsync(id, !entry.IsActive, userId);
                
                var status = !entry.IsActive ? "activated" : "deactivated";
                TempData["Success"] = $"Entry '{entry.Value}' {status} successfully.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error toggling active status for entry {Id}", id);
                TempData["Error"] = "An error occurred while updating the entry status.";
            }

            return RedirectToAction("Category", new { category });
        }

        // POST: ReferenceDataManagement/MigrateData
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> MigrateData()
        {
            try
            {
                var count = await _referenceDataService.MigrateExistingDataAsync();
                TempData["Success"] = $"Successfully migrated {count} reference data entries from existing records.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error migrating existing data");
                TempData["Error"] = "An error occurred while migrating existing data.";
            }

            return RedirectToAction("Index");
        }

        // GET: ReferenceDataManagement/UnusedEntries
        public async Task<IActionResult> UnusedEntries()
        {
            try
            {
                var unusedEntries = await _referenceDataService.GetUnusedEntriesAsync();
                
                var viewModel = new UnusedEntriesViewModel
                {
                    Entries = unusedEntries.OrderBy(e => e.Category).ThenBy(e => e.Value).ToList()
                };

                return View(viewModel);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading unused entries");
                TempData["Error"] = "An error occurred while loading unused entries.";
                return RedirectToAction("Index");
            }
        }

        private static string GetCategoryDisplayName(ReferenceDataCategory category)
        {
            return category switch
            {
                ReferenceDataCategory.Asset => "Assets",
                ReferenceDataCategory.BusinessOwner => "Business Owners",
                ReferenceDataCategory.BusinessUnit => "Business Units",
                ReferenceDataCategory.TechnicalControl => "Technical Controls",
                ReferenceDataCategory.SecurityControlName => "Security Control Names",
                _ => category.ToString()
            };
        }
    }
}