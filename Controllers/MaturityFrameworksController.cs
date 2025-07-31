using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.ViewModels;
using CyberRiskApp.Authorization;
using OfficeOpenXml;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
    public class MaturityFrameworksController : Controller
    {
        private readonly IMaturityService _maturityService;

        public MaturityFrameworksController(IMaturityService maturityService)
        {
            _maturityService = maturityService;
        }

        // GET: MaturityFrameworks
        public async Task<IActionResult> Index()
        {
            var frameworks = await _maturityService.GetAllFrameworksAsync();
            return View(frameworks);
        }

        // GET: MaturityFrameworks/Details/5
        public async Task<IActionResult> Details(int id)
        {
            var framework = await _maturityService.GetFrameworkByIdAsync(id);
            if (framework == null)
                return NotFound();

            return View(framework);
        }

        // GET: MaturityFrameworks/Create
        public IActionResult Create()
        {
            return View();
        }

        // POST: MaturityFrameworks/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(MaturityFramework framework)
        {
            if (ModelState.IsValid)
            {
                framework.UploadedBy = User.Identity?.Name ?? "Unknown";
                framework.Status = FrameworkStatus.Draft;

                await _maturityService.CreateFrameworkAsync(framework);
                TempData["Success"] = "Maturity framework created successfully.";
                return RedirectToAction(nameof(Index));
            }

            return View(framework);
        }

        // GET: MaturityFrameworks/Upload
        public IActionResult Upload()
        {
            var model = new MaturityFrameworkUploadViewModel();
            return View(model);
        }

        // POST: MaturityFrameworks/Upload - ENHANCED for C2M2 v2.1
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Upload(MaturityFrameworkUploadViewModel model)
        {
            if (model.ExcelFile == null || model.ExcelFile.Length == 0)
            {
                ModelState.AddModelError("ExcelFile", "Please select an Excel file to upload.");
                return View(model);
            }

            try
            {
                // Create the framework first
                var framework = new MaturityFramework
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
                framework = await _maturityService.CreateFrameworkAsync(framework);

                // Parse Excel file and create controls
                var controls = await ParseExcelFile(model.ExcelFile, framework.Id, framework.Type);

                if (controls.Count == 0)
                {
                    TempData["Warning"] = "No valid controls found in the Excel file. Please check the format.";
                }
                else
                {
                    // Add controls to the framework
                    await _maturityService.AddControlsToFrameworkAsync(framework.Id, controls);
                    TempData["Success"] = $"Maturity framework uploaded successfully with {controls.Count} controls.";
                }

                return RedirectToAction("Details", new { id = framework.Id });
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error uploading framework: {ex.Message}";
                return View(model);
            }
        }

        // GET: MaturityFrameworks/Edit/5
        public async Task<IActionResult> Edit(int id)
        {
            var framework = await _maturityService.GetFrameworkByIdAsync(id);
            if (framework == null)
                return NotFound();

            return View(framework);
        }

        // POST: MaturityFrameworks/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, MaturityFramework framework)
        {
            if (id != framework.Id)
                return NotFound();

            if (ModelState.IsValid)
            {
                await _maturityService.UpdateFrameworkAsync(framework);
                TempData["Success"] = "Framework updated successfully.";
                return RedirectToAction(nameof(Index));
            }

            return View(framework);
        }

        // NEW: Update Control Priority - AJAX endpoint
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateControlPriority(int controlId, ControlPriority priority)
        {
            try
            {
                var success = await _maturityService.UpdateControlPriorityAsync(controlId, priority);
                if (success)
                {
                    return Json(new { success = true, message = "Priority updated successfully" });
                }
                else
                {
                    return Json(new { success = false, message = "Control not found" });
                }
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        // NEW: Bulk Update Control Priorities
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> BulkUpdatePriorities(int frameworkId, Dictionary<int, ControlPriority> priorities)
        {
            try
            {
                var updated = await _maturityService.BulkUpdateControlPrioritiesAsync(frameworkId, priorities);
                TempData["Success"] = $"Updated priorities for {updated} controls.";
                return RedirectToAction("Details", new { id = frameworkId });
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error updating priorities: {ex.Message}";
                return RedirectToAction("Details", new { id = frameworkId });
            }
        }

        // POST: MaturityFrameworks/Delete/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _maturityService.DeleteFrameworkAsync(id);
            if (result)
            {
                TempData["Success"] = "Framework deleted successfully.";
            }
            else
            {
                TempData["Error"] = "Framework not found or could not be deleted.";
            }

            return RedirectToAction(nameof(Index));
        }

        // ENHANCED: Parse Excel files with improved C2M2 v2.1 support
        private async Task<List<MaturityControl>> ParseExcelFile(IFormFile excelFile, int frameworkId, FrameworkType frameworkType)
        {
            var controls = new List<MaturityControl>();

            using (var stream = new MemoryStream())
            {
                await excelFile.CopyToAsync(stream);
                using (var package = new ExcelPackage(stream))
                {
                    if (package.Workbook.Worksheets.Count == 0)
                    {
                        throw new Exception("Excel file contains no worksheets.");
                    }

                    var worksheet = package.Workbook.Worksheets[0];

                    if (worksheet.Dimension == null || worksheet.Dimension.Rows < 2)
                    {
                        throw new Exception("Excel file appears to be empty or has no data rows.");
                    }

                    // Parse based on framework type
                    if (frameworkType == FrameworkType.NISTCSF)
                    {
                        controls = ParseNISTCSFExcel(worksheet, frameworkId);
                    }
                    else if (frameworkType == FrameworkType.C2M2)
                    {
                        controls = ParseC2M2Excel(worksheet, frameworkId);
                    }
                    else
                    {
                        throw new Exception("Unsupported framework type for maturity assessment.");
                    }
                }
            }

            return controls;
        }

        // ENHANCED: Parse NIST CSF Excel format
        private List<MaturityControl> ParseNISTCSFExcel(OfficeOpenXml.ExcelWorksheet worksheet, int frameworkId)
        {
            var controls = new List<MaturityControl>();

            // Expected columns: Function, Category, Subcategory, Title, Implementation Examples
            for (int row = 2; row <= worksheet.Dimension.Rows; row++)
            {
                try
                {
                    var function = worksheet.Cells[row, 1].Value?.ToString()?.Trim();
                    var category = worksheet.Cells[row, 2].Value?.ToString()?.Trim();
                    var subcategory = worksheet.Cells[row, 3].Value?.ToString()?.Trim();
                    var title = worksheet.Cells[row, 4].Value?.ToString()?.Trim();
                    var implementationExamples = worksheet.Cells[row, 5].Value?.ToString()?.Trim();

                    // Skip empty rows
                    if (string.IsNullOrEmpty(function) && string.IsNullOrEmpty(subcategory))
                    {
                        continue;
                    }

                    // Validate required fields for NIST CSF
                    if (string.IsNullOrEmpty(function))
                    {
                        throw new Exception($"Row {row}: Function is required for NIST CSF.");
                    }

                    if (string.IsNullOrEmpty(subcategory))
                    {
                        throw new Exception($"Row {row}: Subcategory is required for NIST CSF.");
                    }

                    var control = new MaturityControl
                    {
                        ControlId = subcategory,
                        Title = title ?? $"{category} - {subcategory}",
                        Description = implementationExamples ?? string.Empty,
                        Function = function,
                        Category = category ?? string.Empty,
                        Subcategory = subcategory,
                        ImplementationGuidance = implementationExamples ?? string.Empty,
                        HelpText = string.Empty, // Not used for NIST CSF
                        Priority = DeterminePriorityFromFunction(function), // Smart priority assignment
                        MaturityFrameworkId = frameworkId
                    };

                    controls.Add(control);
                }
                catch (Exception ex)
                {
                    throw new Exception($"Error processing row {row}: {ex.Message}");
                }
            }

            return controls;
        }

        // ENHANCED: Parse C2M2 v2.1 Excel format with improved error handling and smart prioritization
        private List<MaturityControl> ParseC2M2Excel(OfficeOpenXml.ExcelWorksheet worksheet, int frameworkId)
        {
            var controls = new List<MaturityControl>();

            // Expected columns: Domain, MIL, Practice, Practice Text, Help Text
            for (int row = 2; row <= worksheet.Dimension.Rows; row++)
            {
                try
                {
                    var domain = worksheet.Cells[row, 1].Value?.ToString()?.Trim();
                    var mil = worksheet.Cells[row, 2].Value?.ToString()?.Trim();
                    var practice = worksheet.Cells[row, 3].Value?.ToString()?.Trim();
                    var practiceText = worksheet.Cells[row, 4].Value?.ToString()?.Trim();
                    var helpText = worksheet.Cells[row, 5].Value?.ToString()?.Trim();

                    // Skip empty rows
                    if (string.IsNullOrEmpty(domain) && string.IsNullOrEmpty(practice))
                    {
                        continue;
                    }

                    // Validate required fields for C2M2
                    if (string.IsNullOrEmpty(domain))
                    {
                        throw new Exception($"Row {row}: Domain is required for C2M2.");
                    }

                    if (string.IsNullOrEmpty(practice))
                    {
                        throw new Exception($"Row {row}: Practice is required for C2M2.");
                    }

                    var control = new MaturityControl
                    {
                        ControlId = practice,
                        Title = $"{domain} - {practice}",
                        Description = practiceText ?? string.Empty,
                        Function = domain,
                        Category = mil ?? string.Empty,
                        Subcategory = practice,
                        ImplementationGuidance = practiceText ?? string.Empty,
                        HelpText = helpText ?? string.Empty,
                        Priority = DeterminePriorityFromC2M2Domain(domain, mil), // Smart priority based on domain and MIL
                        MaturityFrameworkId = frameworkId
                    };

                    controls.Add(control);
                }
                catch (Exception ex)
                {
                    throw new Exception($"Error processing row {row}: {ex.Message}");
                }
            }

            return controls;
        }

        // NEW: Smart priority assignment for NIST CSF functions
        private ControlPriority DeterminePriorityFromFunction(string function)
        {
            return function?.ToUpper() switch
            {
                "IDENTIFY" => ControlPriority.High,      // Foundational
                "PROTECT" => ControlPriority.Critical,   // Core security
                "DETECT" => ControlPriority.High,        // Essential for awareness
                "RESPOND" => ControlPriority.Medium,     // Important for incidents
                "RECOVER" => ControlPriority.Medium,     // Business continuity
                _ => ControlPriority.Medium
            };
        }

        // NEW: Smart priority assignment for C2M2 domains with MIL consideration
        private ControlPriority DeterminePriorityFromC2M2Domain(string domain, string mil)
        {
            // Base priority by domain (critical operational areas)
            var basePriority = domain?.ToUpper() switch
            {
                "ASSET" => ControlPriority.Critical,        // Asset management is fundamental
                "ACCESS" => ControlPriority.Critical,       // Access control is critical
                "THREAT" => ControlPriority.High,           // Threat awareness is important
                "RISK" => ControlPriority.High,             // Risk management is essential
                "SITUATION" => ControlPriority.High,        // Situational awareness
                "RESPONSE" => ControlPriority.Medium,       // Incident response
                "ARCHITECTURE" => ControlPriority.Medium,   // System architecture
                "WORKFORCE" => ControlPriority.Medium,      // Personnel security
                "THIRD-PARTIES" => ControlPriority.Medium,  // Vendor management
                "PROGRAM" => ControlPriority.Low,           // Program management
                _ => ControlPriority.Medium
            };

            // Adjust priority based on MIL level (higher MIL = higher maturity requirement)
            if (int.TryParse(mil, out var milLevel))
            {
                return milLevel switch
                {
                    1 => basePriority, // Keep base priority for foundational practices
                    2 => basePriority == ControlPriority.Low ? ControlPriority.Medium : basePriority,
                    3 => basePriority == ControlPriority.Low ? ControlPriority.High :
                         basePriority == ControlPriority.Medium ? ControlPriority.High : basePriority,
                    _ => basePriority
                };
            }

            return basePriority;
        }
    }
}