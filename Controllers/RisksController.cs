using CyberRiskApp.Authorization;
using CyberRiskApp.Services;
using CyberRiskApp.ViewModels;
using CyberRiskApp.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using OfficeOpenXml;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireAnyRole)]
    public class RisksController : Controller
    {
        private readonly IRiskService _riskService;
        private readonly IExportService _exportService;
        private readonly IRiskLevelSettingsService _riskLevelSettingsService;

        public RisksController(IRiskService riskService, IExportService exportService, IRiskLevelSettingsService riskLevelSettingsService)
        {
            _riskService = riskService;
            _exportService = exportService;
            _riskLevelSettingsService = riskLevelSettingsService;
        }

        // GET: Risks
        public async Task<IActionResult> Index(RiskFilterViewModel? filter)
        {
            var allRisks = await _riskService.GetAllRisksAsync();
            var riskLevelSettings = await _riskLevelSettingsService.GetActiveSettingsAsync();
            
            // Apply filters
            var filteredRisks = allRisks.AsEnumerable();

            if (filter != null)
            {
                if (!string.IsNullOrEmpty(filter.RegisterId))
                    filteredRisks = filteredRisks.Where(r => r.RiskNumber.Contains(filter.RegisterId, StringComparison.OrdinalIgnoreCase));

                if (!string.IsNullOrEmpty(filter.Title))
                    filteredRisks = filteredRisks.Where(r => r.Title.Contains(filter.Title, StringComparison.OrdinalIgnoreCase));

                if (!string.IsNullOrEmpty(filter.ThreatScenario))
                    filteredRisks = filteredRisks.Where(r => r.ThreatScenario.Contains(filter.ThreatScenario, StringComparison.OrdinalIgnoreCase));

                if (filter.CIATriad.HasValue)
                    filteredRisks = filteredRisks.Where(r => r.CIATriad == filter.CIATriad.Value);

                if (!string.IsNullOrEmpty(filter.RiskStatement))
                    filteredRisks = filteredRisks.Where(r => r.Description.Contains(filter.RiskStatement, StringComparison.OrdinalIgnoreCase));

                if (!string.IsNullOrEmpty(filter.Organization))
                    filteredRisks = filteredRisks.Where(r => r.BusinessUnit.Contains(filter.Organization, StringComparison.OrdinalIgnoreCase));

                if (!string.IsNullOrEmpty(filter.Asset))
                    filteredRisks = filteredRisks.Where(r => r.Asset.Contains(filter.Asset, StringComparison.OrdinalIgnoreCase));

                if (!string.IsNullOrEmpty(filter.RiskOwner))
                    filteredRisks = filteredRisks.Where(r => r.Owner.Contains(filter.RiskOwner, StringComparison.OrdinalIgnoreCase));

                if (filter.Impact.HasValue)
                    filteredRisks = filteredRisks.Where(r => r.Impact == filter.Impact.Value);

                if (filter.Likelihood.HasValue)
                    filteredRisks = filteredRisks.Where(r => r.Likelihood == filter.Likelihood.Value);

                if (filter.Exposure.HasValue)
                    filteredRisks = filteredRisks.Where(r => r.Exposure == filter.Exposure.Value);

                if (filter.InherentRiskLevel.HasValue)
                    filteredRisks = filteredRisks.Where(r => r.InherentRiskLevel == filter.InherentRiskLevel.Value);

                if (filter.RiskTreatment.HasValue)
                    filteredRisks = filteredRisks.Where(r => r.Treatment == filter.RiskTreatment.Value);

                if (filter.ResidualRisk.HasValue)
                    filteredRisks = filteredRisks.Where(r => r.ResidualRiskLevel == filter.ResidualRisk.Value);

                if (!string.IsNullOrEmpty(filter.TreatmentPlan))
                    filteredRisks = filteredRisks.Where(r => r.TreatmentPlan.Contains(filter.TreatmentPlan, StringComparison.OrdinalIgnoreCase));

                if (!string.IsNullOrEmpty(filter.RiskAssessment))
                    filteredRisks = filteredRisks.Where(r => r.RiskAssessmentReference.Contains(filter.RiskAssessment, StringComparison.OrdinalIgnoreCase));

                if (filter.DateOpenedFrom.HasValue)
                    filteredRisks = filteredRisks.Where(r => r.OpenDate >= filter.DateOpenedFrom.Value);

                if (filter.DateOpenedTo.HasValue)
                    filteredRisks = filteredRisks.Where(r => r.OpenDate <= filter.DateOpenedTo.Value);

                if (filter.LastReviewedFrom.HasValue && filter.LastReviewedFrom.Value != DateTime.MinValue)
                    filteredRisks = filteredRisks.Where(r => r.NextReviewDate.HasValue && r.NextReviewDate.Value >= filter.LastReviewedFrom.Value);

                if (filter.LastReviewedTo.HasValue && filter.LastReviewedTo.Value != DateTime.MinValue)
                    filteredRisks = filteredRisks.Where(r => r.NextReviewDate.HasValue && r.NextReviewDate.Value <= filter.LastReviewedTo.Value);

                if (filter.Status.HasValue)
                    filteredRisks = filteredRisks.Where(r => r.Status == filter.Status.Value);
            }

            // Create view model with filter options
            var viewModel = new RiskFilterViewModel
            {
                FilteredRisks = filteredRisks.ToList(),
                TotalCount = allRisks.Count(),
                FilteredCount = filteredRisks.Count(),

                // Populate filter form values
                RegisterId = filter?.RegisterId,
                Title = filter?.Title,
                ThreatScenario = filter?.ThreatScenario,
                CIATriad = filter?.CIATriad,
                RiskStatement = filter?.RiskStatement,
                Organization = filter?.Organization,
                Asset = filter?.Asset,
                RiskOwner = filter?.RiskOwner,
                Impact = filter?.Impact,
                Likelihood = filter?.Likelihood,
                Exposure = filter?.Exposure,
                InherentRiskLevel = filter?.InherentRiskLevel,
                RiskTreatment = filter?.RiskTreatment,
                ResidualRisk = filter?.ResidualRisk,
                TreatmentPlan = filter?.TreatmentPlan,
                RiskAssessment = filter?.RiskAssessment,
                DateOpenedFrom = filter?.DateOpenedFrom,
                DateOpenedTo = filter?.DateOpenedTo,
                LastReviewedFrom = filter?.LastReviewedFrom,
                LastReviewedTo = filter?.LastReviewedTo,
                Status = filter?.Status,

                // Create select lists
                CIATriadOptions = new SelectList(Enum.GetValues<CIATriad>().Cast<CIATriad>()
                    .Select(v => new { Value = (int)v, Text = v.ToString() }), "Value", "Text"),
                ImpactOptions = new SelectList(Enum.GetValues<ImpactLevel>().Cast<ImpactLevel>()
                    .Select(v => new { Value = (int)v, Text = v.ToString() }), "Value", "Text"),
                LikelihoodOptions = new SelectList(Enum.GetValues<LikelihoodLevel>().Cast<LikelihoodLevel>()
                    .Select(v => new { Value = (int)v, Text = v.ToString() }), "Value", "Text"),
                ExposureOptions = new SelectList(Enum.GetValues<ExposureLevel>().Cast<ExposureLevel>()
                    .Select(v => new { Value = (int)v, Text = v.ToString() }), "Value", "Text"),
                InherentRiskLevelOptions = new SelectList(Enum.GetValues<RiskLevel>().Cast<RiskLevel>()
                    .Select(v => new { Value = (int)v, Text = v.ToString() }), "Value", "Text"),
                RiskTreatmentOptions = new SelectList(Enum.GetValues<TreatmentStrategy>().Cast<TreatmentStrategy>()
                    .Select(v => new { Value = (int)v, Text = v.ToString() }), "Value", "Text"),
                ResidualRiskOptions = new SelectList(Enum.GetValues<RiskLevel>().Cast<RiskLevel>()
                    .Select(v => new { Value = (int)v, Text = v.ToString() }), "Value", "Text"),
                StatusOptions = new SelectList(Enum.GetValues<RiskStatus>().Cast<RiskStatus>()
                    .Select(v => new { Value = (int)v, Text = v.ToString() }), "Value", "Text"),

                // Dynamic options from existing data
                OrganizationOptions = new SelectList(allRisks.Where(r => !string.IsNullOrEmpty(r.BusinessUnit))
                    .Select(r => r.BusinessUnit).Distinct().OrderBy(x => x)),
                RiskOwnerOptions = new SelectList(allRisks.Where(r => !string.IsNullOrEmpty(r.Owner))
                    .Select(r => r.Owner).Distinct().OrderBy(x => x)),
                AssetOptions = new SelectList(allRisks.Where(r => !string.IsNullOrEmpty(r.Asset))
                    .Select(r => r.Asset).Distinct().OrderBy(x => x)),

                // Risk level settings for heatmap calculation
                RiskLevelSettings = riskLevelSettings
            };

            return View(viewModel);
        }

        // GET: Risks/ExportToExcel
        public async Task<IActionResult> ExportToExcel()
        {
            try
            {
                var risks = await _riskService.GetAllRisksAsync();
                var excelData = await _exportService.ExportRisksToExcelAsync(risks);

                var fileName = $"Risk_Register_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";

                return File(excelData, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error exporting risks: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }

        // GET: Risks/Details/5
        public async Task<IActionResult> Details(int id)
        {
            var risk = await _riskService.GetRiskByIdAsync(id);
            if (risk == null)
                return NotFound();

            return View(risk);
        }

        // GET: Risks/Create
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Create()
        {
            var model = new Risk
            {
                OpenDate = DateTime.Today,
                NextReviewDate = DateTime.Today.AddMonths(3),
                Status = RiskStatus.Open,
                RiskNumber = await _riskService.GenerateNextRiskNumberAsync()
            };

            return View(model);
        }

        // POST: Risks/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Create(Risk risk)
        {
            // Remove audit fields from model validation since they're set automatically
            ModelState.Remove("CreatedBy");
            ModelState.Remove("UpdatedBy");
            
            if (ModelState.IsValid)
            {
                try
                {
                    risk.CreatedAt = DateTime.UtcNow;
                    risk.UpdatedAt = DateTime.UtcNow;
                    risk.Status = RiskStatus.Open;

                    if (string.IsNullOrEmpty(risk.RiskNumber))
                    {
                        risk.RiskNumber = await _riskService.GenerateNextRiskNumberAsync();
                    }

                    var createdRisk = await _riskService.CreateRiskAsync(risk);
                    TempData["Success"] = $"Risk {createdRisk.RiskNumber} created successfully.";
                    return RedirectToAction(nameof(Index));
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error creating risk: {ex.Message}";
                }
            }

            return View(risk);
        }

        // GET: Risks/Edit/5
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Edit(int id)
        {
            var risk = await _riskService.GetRiskByIdAsync(id);
            if (risk == null)
                return NotFound();

            return View(risk);
        }

        // POST: Risks/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Edit(int id, Risk risk)
        {
            if (id != risk.Id)
                return NotFound();

            if (ModelState.IsValid)
            {
                try
                {
                    risk.UpdatedAt = DateTime.UtcNow;
                    await _riskService.UpdateRiskAsync(risk);
                    TempData["Success"] = $"Risk {risk.RiskNumber} updated successfully.";
                    return RedirectToAction(nameof(Index));
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error updating risk: {ex.Message}";
                }
            }

            return View(risk);
        }

        // GET: Risks/Upload
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public IActionResult Upload()
        {
            var model = new RiskUploadViewModel();
            return View(model);
        }

        // POST: Risks/Upload
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Upload(RiskUploadViewModel model)
        {
            if (model.ExcelFile == null || model.ExcelFile.Length == 0)
            {
                ModelState.AddModelError("ExcelFile", "Please select an Excel file to upload.");
                return View(model);
            }

            try
            {
                var risks = await ParseRiskExcelFile(model.ExcelFile);

                if (risks.Count == 0)
                {
                    TempData["Warning"] = "No valid risks found in the Excel file. Please check the format.";
                    return View(model);
                }

                // Create risks in bulk
                var createdRisks = await _riskService.CreateRisksAsync(risks);

                model.SuccessfulUploads = createdRisks.Count;
                model.FailedUploads = risks.Count - createdRisks.Count;

                if (createdRisks.Count > 0)
                {
                    TempData["Success"] = $"Successfully uploaded {createdRisks.Count} risk(s) to the risk register.";
                }

                if (model.FailedUploads > 0)
                {
                    TempData["Warning"] = $"{model.FailedUploads} risk(s) failed to upload. Check the Excel format.";
                }

                return RedirectToAction(nameof(Index));
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error uploading risks: {ex.Message}";
                return View(model);
            }
        }

        // POST: Risks/CloseConfirmed
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> CloseConfirmed(int id, string remediationDetails)
        {
            try
            {
                var risk = await _riskService.GetRiskByIdAsync(id);
                if (risk == null)
                {
                    TempData["Error"] = "Risk not found.";
                    return RedirectToAction(nameof(Index));
                }

                if (risk.Status == RiskStatus.Closed)
                {
                    TempData["Warning"] = "Risk is already closed.";
                    return RedirectToAction(nameof(Index));
                }

                var currentUser = User?.Identity?.Name ?? "Unknown";
                var success = await _riskService.CloseRiskAsync(id, remediationDetails, currentUser);

                if (success)
                {
                    var isAdmin = User.IsInRole("Admin");
                    var message = isAdmin 
                        ? $"Risk {risk.RiskNumber} '{risk.Title}' has been closed successfully using admin override privileges."
                        : $"Risk {risk.RiskNumber} '{risk.Title}' has been closed successfully.";
                    TempData["Success"] = message;
                }
                else
                {
                    TempData["Error"] = "Failed to close risk. Please try again.";
                }
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error closing risk: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // Admin-only delete action
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            try
            {
                var risk = await _riskService.GetRiskByIdAsync(id);
                if (risk == null)
                {
                    TempData["Error"] = "Risk not found.";
                    return RedirectToAction(nameof(Index));
                }

                var riskNumber = risk.RiskNumber;
                var riskTitle = risk.Title;

                var success = await _riskService.DeleteRiskAsync(id);

                if (success)
                {
                    TempData["Success"] = $"Risk {riskNumber} '{riskTitle}' deleted successfully.";
                }
                else
                {
                    TempData["Error"] = "Failed to delete risk. Please try again.";
                }
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error deleting risk: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        #region Private Helper Methods for Excel Upload

        private async Task<List<Risk>> ParseRiskExcelFile(IFormFile excelFile)
        {
            var risks = new List<Risk>();

            using (var stream = new MemoryStream())
            {
                await excelFile.CopyToAsync(stream);
                stream.Position = 0;

                using (var package = new ExcelPackage(stream))
                {
                    var worksheet = package.Workbook.Worksheets.FirstOrDefault();
                    if (worksheet == null)
                    {
                        throw new Exception("No worksheet found in the Excel file.");
                    }

                    // Validate that we have data
                    if (worksheet.Dimension == null || worksheet.Dimension.Rows < 2)
                    {
                        throw new Exception("Excel file appears to be empty or has no data rows.");
                    }

                    // Expected columns:
                    // A: Title, B: Description, C: Asset, D: Business Unit, E: Threat Scenario, 
                    // F: ALE, G: Risk Level, H: Treatment Strategy, I: Owner

                    for (int row = 2; row <= worksheet.Dimension.Rows; row++)
                    {
                        try
                        {
                            var title = GetCellValue(worksheet, row, 1)?.Trim();
                            var description = GetCellValue(worksheet, row, 2)?.Trim() ?? "";
                            var asset = GetCellValue(worksheet, row, 3)?.Trim() ?? "";
                            var businessUnit = GetCellValue(worksheet, row, 4)?.Trim() ?? "";
                            var threatScenario = GetCellValue(worksheet, row, 5)?.Trim() ?? "";
                            var aleString = GetCellValue(worksheet, row, 6)?.Trim();
                            var riskLevelString = GetCellValue(worksheet, row, 7)?.Trim();
                            var treatmentString = GetCellValue(worksheet, row, 8)?.Trim();
                            var owner = GetCellValue(worksheet, row, 9)?.Trim();
                            if (string.IsNullOrEmpty(owner)) owner = "Unknown";

                            // Skip rows without a title
                            if (string.IsNullOrEmpty(title))
                                continue;

                            // Parse ALE
                            decimal ale = 0;
                            if (!string.IsNullOrEmpty(aleString))
                            {
                                // Remove currency symbols and parse
                                aleString = aleString.Replace("$", "").Replace(",", "");
                                if (!decimal.TryParse(aleString, out ale))
                                {
                                    ale = 0; // Default to 0 if parsing fails
                                }
                            }

                            // Parse Risk Level
                            RiskLevel riskLevel = RiskLevel.Low;
                            if (!string.IsNullOrEmpty(riskLevelString))
                            {
                                if (!Enum.TryParse<RiskLevel>(riskLevelString, true, out riskLevel))
                                {
                                    riskLevel = RiskLevel.Low; // Default to Low if parsing fails
                                }
                            }

                            // Parse Treatment Strategy
                            TreatmentStrategy treatment = TreatmentStrategy.Mitigate;
                            if (!string.IsNullOrEmpty(treatmentString))
                            {
                                if (!Enum.TryParse<TreatmentStrategy>(treatmentString, true, out treatment))
                                {
                                    treatment = TreatmentStrategy.Mitigate; // Default to Mitigate if parsing fails
                                }
                            }

                            // Generate risk number
                            var riskNumber = await _riskService.GenerateNextRiskNumberAsync();

                            var risk = new Risk
                            {
                                RiskNumber = riskNumber,
                                Title = title,
                                Description = description,
                                Asset = asset,
                                BusinessUnit = businessUnit,
                                ThreatScenario = threatScenario,
                                ALE = ale,
                                RiskLevel = riskLevel,
                                Treatment = treatment,
                                Owner = owner,
                                Status = RiskStatus.Open,
                                OpenDate = DateTime.Today,
                                NextReviewDate = DateTime.Today.AddMonths(3),
                                CreatedAt = DateTime.UtcNow,
                                UpdatedAt = DateTime.UtcNow
                            };

                            risks.Add(risk);
                        }
                        catch (Exception ex)
                        {
                            // Log the error but continue processing other rows
                            Console.WriteLine($"Error processing row {row}: {ex.Message}");
                        }
                    }
                }
            }

            return risks;
        }

        private string? GetCellValue(ExcelWorksheet worksheet, int row, int col)
        {
            var cell = worksheet.Cells[row, col];
            return cell?.Value?.ToString();
        }

        #endregion
    }
}