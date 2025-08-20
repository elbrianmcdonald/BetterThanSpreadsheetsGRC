using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.ViewModels;
using CyberRiskApp.Authorization;
using OfficeOpenXml;
using System.Text.RegularExpressions;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
    public class FrameworksController : Controller
    {
        private readonly IGovernanceService _governanceService;

        public FrameworksController(IGovernanceService governanceService)
        {
            _governanceService = governanceService;
        }

        // GET: Frameworks
        public async Task<IActionResult> Index()
        {
            var frameworks = await _governanceService.GetAllFrameworksAsync();
            return View(frameworks);
        }

        // GET: Frameworks/Details/5
        public async Task<IActionResult> Details(int id)
        {
            var framework = await _governanceService.GetFrameworkByIdAsync(id);
            if (framework == null)
                return NotFound();

            return View(framework);
        }

        // GET: Frameworks/Create
        public IActionResult Create()
        {
            var model = new ComplianceFramework();
            return View(model);
        }

        // POST: Frameworks/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(ComplianceFramework framework)
        {
            if (ModelState.IsValid)
            {
                framework.UploadedBy = User.Identity?.Name ?? "Unknown";
                framework.Status = FrameworkStatus.Draft;

                await _governanceService.CreateFrameworkAsync(framework);
                TempData["Success"] = "Compliance framework created successfully.";
                return RedirectToAction(nameof(Index));
            }

            return View(framework);
        }

        // GET: Frameworks/Upload
        public IActionResult Upload()
        {
            var model = new FrameworkUploadViewModel();
            return View(model);
        }

        // POST: Frameworks/Upload
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Upload(FrameworkUploadViewModel model)
        {
            if (model.ExcelFile == null || model.ExcelFile.Length == 0)
            {
                ModelState.AddModelError("ExcelFile", "Please select an Excel file to upload.");
                return View(model);
            }

            try
            {
                // Create the framework first
                var framework = new ComplianceFramework
                {
                    Name = model.Framework.Name,
                    Version = model.Framework.Version,
                    Description = model.Framework.Description,
                    Type = model.Framework.Type,
                    Status = FrameworkStatus.Draft,
                    UploadedBy = User.Identity?.Name ?? "Unknown",
                    UploadedDate = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                // Save framework to get the ID
                framework = await _governanceService.CreateFrameworkAsync(framework);

                // Parse Excel file based on framework type
                List<ComplianceControl> controls;

                if (framework.Type == FrameworkType.NIST)
                {
                    controls = await ParseNISTExcelFile(model.ExcelFile, framework.Id);
                }
                else
                {
                    controls = await ParseGenericExcelFile(model.ExcelFile, framework.Id);
                }

                if (controls.Count == 0)
                {
                    TempData["Warning"] = "No valid controls found in the Excel file. Please check the format.";
                }
                else
                {
                    // Add controls to the framework
                    await AddControlsToFramework(framework.Id, controls);
                    TempData["Success"] = $"Framework uploaded successfully with {controls.Count} controls.";
                }

                return RedirectToAction("Details", new { id = framework.Id });
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error uploading framework: {ex.Message}";
                return View(model);
            }
        }

        // GET: Frameworks/Edit/5
        public async Task<IActionResult> Edit(int id)
        {
            var framework = await _governanceService.GetFrameworkByIdAsync(id);
            if (framework == null)
                return NotFound();

            return View(framework);
        }

        // POST: Frameworks/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, ComplianceFramework framework)
        {
            if (id != framework.Id)
                return NotFound();

            if (ModelState.IsValid)
            {
                await _governanceService.UpdateFrameworkAsync(framework);
                TempData["Success"] = "Framework updated successfully.";
                return RedirectToAction(nameof(Index));
            }

            return View(framework);
        }

        // DELETE: Frameworks/Delete/5
        public async Task<IActionResult> Delete(int id)
        {
            var framework = await _governanceService.GetFrameworkByIdAsync(id);
            if (framework == null)
                return NotFound();

            return View(framework);
        }

        // POST: Frameworks/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            await _governanceService.DeleteFrameworkAsync(id);
            TempData["Success"] = "Framework deleted successfully.";
            return RedirectToAction(nameof(Index));
        }

        // AJAX: Update Control Priority
        [HttpPost]
        public async Task<IActionResult> UpdateControlPriority([FromBody] UpdatePriorityRequest request)
        {
            try
            {
                // Validate priority value
                if (!Enum.IsDefined(typeof(ControlPriority), request.Priority))
                {
                    return Json(new { success = false, message = "Invalid priority value." });
                }

                var controlPriority = (ControlPriority)request.Priority;
                var success = await _governanceService.UpdateControlPriorityAsync(request.ControlId, controlPriority);

                if (success)
                {
                    return Json(new { success = true, message = "Priority updated successfully." });
                }
                else
                {
                    return Json(new { success = false, message = "Control not found." });
                }
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = $"Error updating priority: {ex.Message}" });
            }
        }

        // ENHANCED: Parse NIST 800-53 Excel files with proper structure recognition
        private async Task<List<ComplianceControl>> ParseNISTExcelFile(IFormFile excelFile, int frameworkId)
        {
            var controls = new List<ComplianceControl>();

            using (var stream = new MemoryStream())
            {
                await excelFile.CopyToAsync(stream);
                using (var package = new ExcelPackage(stream))
                {
                    var worksheet = package.Workbook.Worksheets[0];

                    if (worksheet.Dimension == null || worksheet.Dimension.Rows < 2)
                    {
                        throw new Exception("Excel file appears to be empty or has no data rows.");
                    }

                    var rowCount = worksheet.Dimension.Rows;

                    for (int row = 2; row <= rowCount; row++) // Skip header row
                    {
                        try
                        {
                            var controlId = worksheet.Cells[row, 1].Value?.ToString()?.Trim() ?? "";
                            var controlName = worksheet.Cells[row, 2].Value?.ToString()?.Trim() ?? "";
                            var controlText = worksheet.Cells[row, 3].Value?.ToString()?.Trim() ?? "";
                            var supplementalGuidance = worksheet.Cells[row, 4].Value?.ToString()?.Trim() ?? "";

                            if (string.IsNullOrEmpty(controlId) || string.IsNullOrEmpty(controlName))
                                continue;

                            // Determine control family and category
                            var (family, isEnhancement, baseControlId) = ParseNISTControlId(controlId);

                            // Set priority based on control family and type
                            var priority = DetermineNISTPriority(family, isEnhancement);

                            // Clean up text formatting (remove escape characters)
                            controlText = CleanNISTText(controlText);
                            supplementalGuidance = CleanNISTText(supplementalGuidance);

                            var control = new ComplianceControl
                            {
                                ComplianceFrameworkId = frameworkId,
                                ControlId = controlId,
                                Title = controlName,
                                ControlText = controlText,
                                SupplementalGuidance = supplementalGuidance,
                                Description = CombineNISTDescriptions(controlText, supplementalGuidance),
                                Category = GetNISTFamilyName(family),
                                Priority = priority
                            };

                            controls.Add(control);
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"Error processing NIST control at row {row}: {ex.Message}");
                            continue;
                        }
                    }
                }
            }

            return controls;
        }

        // ENHANCED: Generic parser for other framework types
        private async Task<List<ComplianceControl>> ParseGenericExcelFile(IFormFile excelFile, int frameworkId)
        {
            var controls = new List<ComplianceControl>();

            using (var stream = new MemoryStream())
            {
                await excelFile.CopyToAsync(stream);
                using (var package = new ExcelPackage(stream))
                {
                    var worksheet = package.Workbook.Worksheets[0];

                    if (worksheet.Dimension == null || worksheet.Dimension.Rows < 2)
                    {
                        throw new Exception("Excel file appears to be empty or has no data rows.");
                    }

                    var rowCount = worksheet.Dimension.Rows;

                    for (int row = 2; row <= rowCount; row++) // Skip header row
                    {
                        try
                        {
                            var controlId = worksheet.Cells[row, 1].Value?.ToString()?.Trim() ?? "";
                            var title = worksheet.Cells[row, 2].Value?.ToString()?.Trim() ?? "";
                            var description = worksheet.Cells[row, 3].Value?.ToString()?.Trim() ?? "";
                            var category = worksheet.Cells[row, 4].Value?.ToString()?.Trim() ?? "";

                            if (string.IsNullOrEmpty(controlId) || string.IsNullOrEmpty(title))
                                continue;

                            var control = new ComplianceControl
                            {
                                ComplianceFrameworkId = frameworkId,
                                ControlId = controlId,
                                Title = title,
                                Description = description,
                                Category = category,
                                Priority = ControlPriority.Medium
                            };

                            controls.Add(control);
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"Error processing generic control at row {row}: {ex.Message}");
                            continue;
                        }
                    }
                }
            }

            return controls;
        }

        // NIST-specific helper methods
        private (string family, bool isEnhancement, string baseControlId) ParseNISTControlId(string controlId)
        {
            // Extract family (e.g., "AC" from "AC-1" or "AC-2(1)")
            var familyMatch = Regex.Match(controlId, @"^([A-Z]+)");
            var family = familyMatch.Success ? familyMatch.Groups[1].Value : "Unknown";

            // Check if it's an enhancement (contains parentheses)
            var isEnhancement = controlId.Contains('(');

            // Extract base control ID if it's an enhancement
            var baseControlId = controlId;
            if (isEnhancement)
            {
                var baseMatch = Regex.Match(controlId, @"^([A-Z]+-\d+)");
                baseControlId = baseMatch.Success ? baseMatch.Groups[1].Value : controlId;
            }

            return (family, isEnhancement, baseControlId);
        }

        private ControlPriority DetermineNISTPriority(string family, bool isEnhancement)
        {
            // High priority families (core security controls)
            var highPriorityFamilies = new[] { "AC", "IA", "SC", "SI", "AU" };

            if (highPriorityFamilies.Contains(family))
            {
                return isEnhancement ? ControlPriority.Medium : ControlPriority.High;
            }

            // Medium priority families
            var mediumPriorityFamilies = new[] { "CM", "CP", "IR", "RA", "CA" };

            if (mediumPriorityFamilies.Contains(family))
            {
                return ControlPriority.Medium;
            }

            // Everything else is low priority
            return isEnhancement ? ControlPriority.Low : ControlPriority.Medium;
        }

        private string GetNISTFamilyName(string familyCode)
        {
            var familyNames = new Dictionary<string, string>
            {
                { "AC", "Access Control" },
                { "AT", "Awareness and Training" },
                { "AU", "Audit and Accountability" },
                { "CA", "Assessment, Authorization, and Monitoring" },
                { "CM", "Configuration Management" },
                { "CP", "Contingency Planning" },
                { "IA", "Identification and Authentication" },
                { "IR", "Incident Response" },
                { "MA", "Maintenance" },
                { "MP", "Media Protection" },
                { "PE", "Physical and Environmental Protection" },
                { "PL", "Planning" },
                { "PS", "Personnel Security" },
                { "RA", "Risk Assessment" },
                { "SA", "System and Services Acquisition" },
                { "SC", "System and Communications Protection" },
                { "SI", "System and Information Integrity" },
                { "SR", "Supply Chain Risk Management" }
            };

            return familyNames.ContainsKey(familyCode) ? familyNames[familyCode] : familyCode;
        }

        private string CleanNISTText(string text)
        {
            if (string.IsNullOrEmpty(text))
                return string.Empty;

            return text
                .Replace("\\r\\n", "\n")
                .Replace("\\n", "\n")
                .Replace("\\t", "\t")
                .Trim();
        }

        private string CombineNISTDescriptions(string controlText, string supplementalGuidance)
        {
            var combined = new List<string>();

            if (!string.IsNullOrEmpty(controlText))
            {
                combined.Add($"**Control Requirements:**\n{controlText}");
            }

            if (!string.IsNullOrEmpty(supplementalGuidance))
            {
                combined.Add($"**Supplemental Guidance:**\n{supplementalGuidance}");
            }

            return string.Join("\n\n", combined);
        }

        private async Task AddControlsToFramework(int frameworkId, List<ComplianceControl> controls)
        {
            await _governanceService.AddControlsToFrameworkAsync(frameworkId, controls);
        }

        // GET: Frameworks/ComplianceAnalytics/5
        public async Task<IActionResult> ComplianceAnalytics(int id)
        {
            var framework = await _governanceService.GetFrameworkByIdAsync(id);
            if (framework == null)
                return NotFound();

            var metrics = await _governanceService.GetFrameworkComplianceMetricsAsync(id);
            var trendData = await _governanceService.GetComplianceTrendDataAsync(id, 12);
            var controlDetails = await _governanceService.GetControlComplianceDetailsAsync(id);

            var viewModel = new FrameworkComplianceAnalyticsViewModel
            {
                Framework = framework,
                Metrics = metrics,
                TrendData = trendData,
                ControlDetails = controlDetails,
                // Filter options
                StatusFilterOptions = Enum.GetValues<ComplianceStatus>()
                    .Where(s => s != ComplianceStatus.NotApplicable)
                    .Select(s => new { Value = (int)s, Text = GetComplianceStatusDisplayName(s) })
                    .ToList(),
                // Group controls by category for better organization
                ControlsByCategory = controlDetails
                    .GroupBy(c => c.Category)
                    .OrderBy(g => g.Key)
                    .ToDictionary(g => g.Key, g => g.OrderBy(c => c.ControlNumber).ToList())
            };

            return View(viewModel);
        }

        // AJAX endpoint for filtered control compliance details
        [HttpGet]
        public async Task<IActionResult> GetControlComplianceDetails(int frameworkId, ComplianceStatus? status = null, string? category = null)
        {
            var controlDetails = await _governanceService.GetControlComplianceDetailsAsync(frameworkId, status);
            
            if (!string.IsNullOrEmpty(category))
            {
                controlDetails = controlDetails.Where(c => c.Category.Equals(category, StringComparison.OrdinalIgnoreCase)).ToList();
            }

            return PartialView("_ControlComplianceDetailsPartial", controlDetails);
        }

        // GET: Frameworks/TrendAnalysis/5
        public async Task<IActionResult> TrendAnalysis(int id, int months = 24)
        {
            var framework = await _governanceService.GetFrameworkByIdAsync(id);
            if (framework == null)
                return NotFound();

            var trendAnalysis = await _governanceService.GetComplianceTrendAnalysisAsync(id, months);
            var forecast = await _governanceService.GetComplianceForecastAsync(id, 6);
            var velocity = await _governanceService.GetComplianceVelocityAsync(id);
            var milestones = await _governanceService.GetComplianceMilestonesAsync(id);
            var maturity = await _governanceService.GetComplianceMaturityProgressionAsync(id);

            var viewModel = new ComplianceTrendAnalysisViewModel
            {
                Framework = framework,
                TrendAnalysis = trendAnalysis,
                Forecast = forecast,
                Velocity = velocity,
                Milestones = milestones,
                MaturityProgression = maturity,
                // Chart data for visualization
                HistoricalChartLabels = string.Join(",", trendAnalysis.TrendData.Select(t => $"\"{t.Date:MMM yyyy}\"")),
                HistoricalChartData = string.Join(",", trendAnalysis.TrendData.Select(t => t.CompliancePercentage.ToString("F1"))),
                ForecastChartLabels = string.Join(",", forecast.Select(f => $"\"{f.Date:MMM yyyy}\"")),
                ForecastChartData = string.Join(",", forecast.Select(f => f.PredictedCompliance.ToString("F1"))),
                ForecastUpperBound = string.Join(",", forecast.Select(f => f.UpperBound.ToString("F1"))),
                ForecastLowerBound = string.Join(",", forecast.Select(f => f.LowerBound.ToString("F1"))),
                VelocityChartLabels = string.Join(",", velocity.VelocityHistory.Select(v => $"\"{v.Date:MMM yyyy}\"")),
                VelocityChartData = string.Join(",", velocity.VelocityHistory.Select(v => v.Velocity.ToString("F1")))
            };

            return View(viewModel);
        }

        // AJAX endpoint for trend data with custom date ranges
        [HttpGet]
        public async Task<IActionResult> GetTrendData(int frameworkId, DateTime? startDate = null, DateTime? endDate = null)
        {
            try
            {
                var months = startDate.HasValue && endDate.HasValue 
                    ? ((endDate.Value.Year - startDate.Value.Year) * 12) + endDate.Value.Month - startDate.Value.Month 
                    : 12;
                
                var trendAnalysis = await _governanceService.GetComplianceTrendAnalysisAsync(frameworkId, Math.Max(months, 3));
                
                return Json(new
                {
                    success = true,
                    trendData = trendAnalysis.TrendData.Select(t => new
                    {
                        date = t.Date.ToString("yyyy-MM-dd"),
                        compliance = t.CompliancePercentage,
                        assessor = t.Assessor
                    }),
                    analysis = new
                    {
                        currentCompliance = trendAnalysis.CurrentCompliance,
                        averageCompliance = trendAnalysis.AverageCompliance,
                        trendDirection = trendAnalysis.OverallTrend,
                        slope = trendAnalysis.TrendSlope,
                        variance = trendAnalysis.ComplianceVariance
                    }
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, error = ex.Message });
            }
        }

        private string GetComplianceStatusDisplayName(ComplianceStatus status)
        {
            return status switch
            {
                ComplianceStatus.FullyCompliant => "Fully Compliant",
                ComplianceStatus.MajorlyCompliant => "Majorly Compliant",
                ComplianceStatus.PartiallyCompliant => "Partially Compliant",
                ComplianceStatus.NonCompliant => "Non-Compliant",
                ComplianceStatus.NotApplicable => "Not Applicable",
                _ => status.ToString()
            };
        }
    }

    // Request model for AJAX priority updates
    public class UpdatePriorityRequest
    {
        public int ControlId { get; set; }
        public int Priority { get; set; }
    }
}