using CyberRiskApp.Models;
using CyberRiskApp.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Authorization;
using CyberRiskApp.Extensions;
using CyberRiskApp.Filters;
using Microsoft.Extensions.Logging;
using OfficeOpenXml;

namespace CyberRiskApp.Controllers
{
    public class FindingsController : BaseController
    {
        private readonly IFindingService _findingService;
        private readonly IRequestService _requestService;
        private readonly IExportService _exportService;
        private readonly IRiskMatrixService _riskMatrixService;
        private readonly IRiskBacklogService _riskBacklogService;

        public FindingsController(
            IFindingService findingService, 
            IRequestService requestService, 
            IExportService exportService, 
            IRiskMatrixService riskMatrixService, 
            IRiskBacklogService riskBacklogService, 
            ILogger<FindingsController> logger) : base(logger)
        {
            _findingService = findingService;
            _requestService = requestService;
            _exportService = exportService;
            _riskMatrixService = riskMatrixService;
            _riskBacklogService = riskBacklogService;
        }

        // UPDATED: All users can view findings
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Index(string status = "open")
        {
            return await ExecuteWithErrorHandling(
                async () =>
                {
                    FindingStatus? filterStatus = status.ToLower() switch
                    {
                        "open" => FindingStatus.Open,
                        "closed" => FindingStatus.Closed,
                        "accepted" => FindingStatus.RiskAccepted,
                        "all" => null,
                        _ => FindingStatus.Open
                    };

                    var findings = await _findingService.GetFindingsAsync(filterStatus);

                    ViewBag.CurrentFilter = status;
                    ViewBag.OpenCount = (await _findingService.GetOpenFindingsAsync()).Count();
                    ViewBag.ClosedCount = (await _findingService.GetClosedFindingsAsync()).Count();
                    ViewBag.AllCount = (await _findingService.GetAllFindingsAsync()).Count();
                    ViewBag.CanManageFindings = User.CanUserPerformAssessments(); // Show/hide create/edit buttons

                    return findings;
                },
                findings => View(findings),
                "loading findings list"
            );
        }

        // UPDATED: All users can export findings
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> ExportToExcel(string status = "all")
        {
            try
            {
                // Get findings based on status filter
                FindingStatus? filterStatus = status.ToLower() switch
                {
                    "open" => FindingStatus.Open,
                    "closed" => FindingStatus.Closed,
                    "accepted" => FindingStatus.RiskAccepted,
                    "all" => null,
                    _ => null
                };

                var findings = await _findingService.GetFindingsAsync(filterStatus);
                var excelData = await _exportService.ExportFindingsToExcelAsync(findings);

                var fileName = $"Findings_Register_{status}_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";

                return File(excelData, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error exporting findings: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }

        // UPDATED: All users can view finding details
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Details(int id)
        {
            var finding = await _findingService.GetFindingByIdAsync(id);
            if (finding == null)
                return NotFound();

            return View(finding);
        }

        // UPDATED: Only GRC and Admin can create findings
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public IActionResult Create()
        {
            return View();
        }

        // UPDATED: Only GRC and Admin can create findings
        [HttpPost]
        [ValidateAntiForgeryToken]
        [RemoveAuditFields]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Create(Finding finding)
        {
            
            if (ModelState.IsValid)
            {
                try
                {
                    // NEW WORKFLOW: Route finding through backlog for approval before creating in register
                    var userId = User.GetUserId();
                    
                    var backlogEntry = await _riskBacklogService.CreateFindingBacklogEntryAsync(
                        title: finding.Title,
                        details: finding.Details,
                        source: "Manual Creation", // Could be made configurable
                        impact: finding.Impact,
                        likelihood: finding.Likelihood,
                        exposure: finding.Exposure,
                        asset: finding.Asset ?? "",
                        businessUnit: finding.BusinessUnit ?? "",
                        businessOwner: finding.BusinessOwner ?? "",
                        domain: finding.Domain ?? "",
                        technicalControl: finding.TechnicalControl ?? "",
                        requesterId: userId
                    );

                    TempData["Success"] = $"Finding submitted for approval as backlog entry {backlogEntry.BacklogNumber}. It will be added to the findings register once approved.";
                    return RedirectToAction("Index", "RiskBacklog");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error creating finding");
                    ModelState.AddModelError("", $"Error creating finding: {ex.Message}");
                }
            }

            return View(finding);
        }

        // UPDATED: Only GRC and Admin can edit findings
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Edit(int id)
        {
            var finding = await _findingService.GetFindingByIdAsync(id);
            if (finding == null)
                return NotFound();

            return View(finding);
        }

        // UPDATED: Only GRC and Admin can edit findings
        [HttpPost]
        [ValidateAntiForgeryToken]
        [RemoveAuditFields]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Edit(int id, Finding finding)
        {
            if (id != finding.Id)
                return NotFound();

            if (ModelState.IsValid)
            {
                return await ExecuteWithErrorHandling(
                    async () =>
                    {
                        // Get the default risk matrix and calculate risk rating using it
                        var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
                        if (defaultMatrix != null)
                        {
                            // Convert enum values to integers for the risk matrix calculation
                            int impactLevel = (int)finding.Impact;
                            int likelihoodLevel = (int)finding.Likelihood;
                            int? exposureLevel = defaultMatrix.MatrixType == RiskMatrixType.ImpactLikelihoodExposure 
                                ? (int)finding.Exposure 
                                : null;

                            var riskLevel = await _riskMatrixService.CalculateRiskLevelAsync(
                                defaultMatrix.Id, impactLevel, likelihoodLevel, exposureLevel);

                            // Convert RiskLevel back to RiskRating
                            finding.RiskRating = riskLevel switch
                            {
                                RiskLevel.Low => RiskRating.Low,
                                RiskLevel.Medium => RiskRating.Medium,
                                RiskLevel.High => RiskRating.High,
                                RiskLevel.Critical => RiskRating.Critical,
                                _ => RiskRating.Medium
                            };
                        }
                        else
                        {
                            // Fallback to original calculation if no matrix is configured
                            finding.RiskRating = finding.CalculateRiskRating();
                        }

                        await _findingService.UpdateFindingAsync(finding);
                        return finding;
                    },
                    _ =>
                    {
                        TempData["Success"] = "Finding updated successfully with risk rating calculated using configured matrix.";
                        return RedirectToAction(nameof(Index));
                    },
                    "updating finding"
                );
            }

            return View(finding);
        }

        // API endpoint for real-time risk calculation during finding creation
        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> CalculateRisk([FromBody] RiskCalculationRequest request)
        {
            try
            {
                var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
                if (defaultMatrix == null)
                {
                    return Json(new { success = false, error = "No default risk matrix configured" });
                }

                // Validate input ranges
                if (request.Impact < 1 || request.Impact > defaultMatrix.MatrixSize ||
                    request.Likelihood < 1 || request.Likelihood > defaultMatrix.MatrixSize)
                {
                    return Json(new { success = false, error = "Invalid impact or likelihood level" });
                }

                int? exposureLevel = null;
                if (defaultMatrix.MatrixType == RiskMatrixType.ImpactLikelihoodExposure)
                {
                    if (request.Exposure < 1 || request.Exposure > defaultMatrix.MatrixSize)
                    {
                        return Json(new { success = false, error = "Invalid exposure level" });
                    }
                    exposureLevel = request.Exposure;
                }

                var riskLevel = await _riskMatrixService.CalculateRiskLevelAsync(
                    defaultMatrix.Id, request.Impact, request.Likelihood, exposureLevel);

                var riskScore = await _riskMatrixService.CalculateRiskScoreAsync(
                    defaultMatrix.Id, request.Impact, request.Likelihood, exposureLevel);

                // Get the level names from the matrix configuration
                var levels = await _riskMatrixService.GetLevelsByMatrixIdAsync(defaultMatrix.Id);
                var impactLevels = levels.Where(l => l.LevelType == RiskMatrixLevelType.Impact).OrderBy(l => l.LevelValue).ToList();
                var likelihoodLevels = levels.Where(l => l.LevelType == RiskMatrixLevelType.Likelihood).OrderBy(l => l.LevelValue).ToList();
                var exposureLevels = levels.Where(l => l.LevelType == RiskMatrixLevelType.Exposure).OrderBy(l => l.LevelValue).ToList();

                var impactName = impactLevels.ElementAtOrDefault(request.Impact - 1)?.LevelName ?? "Unknown";
                var likelihoodName = likelihoodLevels.ElementAtOrDefault(request.Likelihood - 1)?.LevelName ?? "Unknown";
                var exposureName = exposureLevel.HasValue 
                    ? (exposureLevels.ElementAtOrDefault(exposureLevel.Value - 1)?.LevelName ?? "Unknown")
                    : null;

                return Json(new
                {
                    success = true,
                    riskLevel = riskLevel.ToString(),
                    riskScore = Math.Round(riskScore, 2),
                    impactName,
                    likelihoodName,
                    exposureName,
                    matrixType = defaultMatrix.MatrixType.ToString()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating risk");
                return Json(new { success = false, error = "Error calculating risk" });
            }
        }

        // UPDATED: Only Admin can delete findings
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            return await ExecuteWithErrorHandling(
                async () =>
                {
                    var finding = await _findingService.GetFindingByIdAsync(id);
                    if (finding == null)
                    {
                        throw new InvalidOperationException("Finding not found.");
                    }

                    await _findingService.DeleteFindingAsync(id);
                    return finding;
                },
                finding =>
                {
                    TempData["Success"] = $"Finding #{finding.FindingNumber} - {finding.Title} deleted successfully.";
                    return RedirectToAction(nameof(Index));
                },
                "deleting finding",
                nameof(Index)
            );
        }

        // UPDATED: All users can request risk acceptance (but only view the form)
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> RequestRiskAcceptance(int id)
        {
            Console.WriteLine($"=== GET RequestRiskAcceptance called with ID: {id} ===");

            var finding = await _findingService.GetFindingByIdAsync(id);
            if (finding == null)
            {
                Console.WriteLine($"=== Finding with ID {id} not found ===");
                return NotFound();
            }

            Console.WriteLine($"=== Found finding: {finding.Title}, Status: {finding.Status} ===");

            // Only allow for open findings
            if (finding.Status != FindingStatus.Open)
            {
                TempData["Error"] = "Risk acceptance can only be requested for open findings.";
                return RedirectToAction(nameof(Details), new { id });
            }

            // Create a simple model with the finding and a new risk acceptance request
            var model = new RequestRiskAcceptanceViewModel
            {
                Finding = finding,
                RiskAcceptanceRequest = new RiskAcceptanceRequest
                {
                    FindingId = finding.Id,
                    Description = $"Risk acceptance requested for Finding #{finding.FindingNumber}: {finding.Title}"
                }
            };

            Console.WriteLine($"=== Returning view with model ===");
            return View(model);
        }

        // UPDATED: All users can submit risk acceptance requests
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> RequestRiskAcceptance(int id, string description, string justification)
        {
            Console.WriteLine($"=== POST RequestRiskAcceptance called with ID: {id} ===");
            Console.WriteLine($"=== Description: {description} ===");
            Console.WriteLine($"=== Justification: {justification} ===");

            var finding = await _findingService.GetFindingByIdAsync(id);
            if (finding == null)
            {
                Console.WriteLine($"=== Finding with ID {id} not found ===");
                return NotFound();
            }

            if (finding.Status != FindingStatus.Open)
            {
                TempData["Error"] = "Risk acceptance can only be requested for open findings.";
                return RedirectToAction(nameof(Details), new { id });
            }

            try
            {
                var request = new RiskAcceptanceRequest
                {
                    FindingId = id,
                    Description = description,
                    BusinessNeed = justification,
                    Requester = User.Identity?.Name ?? "Unknown User",
                    RequestDate = DateTime.Today,
                    Status = RequestStatus.PendingApproval
                };

                Console.WriteLine($"=== Creating request with requester: {request.Requester} ===");

                var createdRequest = await _requestService.CreateAcceptanceRequestAsync(request);

                Console.WriteLine($"=== Request created with ID: {createdRequest.Id} ===");

                TempData["Success"] = "Risk acceptance request submitted successfully.";
                return RedirectToAction("Index", "Requests");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"=== Error creating request: {ex.Message} ===");
                TempData["Error"] = $"Error submitting risk acceptance request: {ex.Message}";
                return RedirectToAction(nameof(Details), new { id });
            }
        }

        // API endpoint to get open findings for linking to risk assessments
        [HttpGet]
        [Route("api/findings/open")]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> GetOpenFindings()
        {
            try
            {
                var findings = await _findingService.GetFindingsAsync();
                var openFindings = findings
                    .Where(f => f.Status == FindingStatus.Open)
                    .Select(f => new
                    {
                        id = f.Id,
                        title = f.Title,
                        findingNumber = f.FindingNumber,
                        domain = f.Domain,
                        riskRating = f.RiskRating.ToString(),
                        owner = f.Owner,
                        asset = f.Asset
                    })
                    .ToList();

                return Json(openFindings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving open findings");
                return Json(new List<object>());
            }
        }

        // API: Get active findings for FAIR assessment
        [HttpGet]
        [Route("api/Findings/GetActiveFindings")]
        public async Task<IActionResult> GetActiveFindings()
        {
            try
            {
                var findings = await _findingService.GetFindingsAsync();
                var activeFindings = findings
                    .Where(f => f.Status == FindingStatus.Open)
                    .Select(f => new
                    {
                        id = f.Id,
                        title = f.Title,
                        description = f.Details,
                        severity = f.RiskRating.ToString(),
                        findingNumber = f.FindingNumber,
                        domain = f.Domain,
                        owner = f.Owner,
                        asset = f.Asset
                    })
                    .ToList();

                return Json(activeFindings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving active findings");
                return Json(new List<object>());
            }
        }

        // Excel Upload functionality - Only GRC and Admin can upload
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public IActionResult UploadFindings()
        {
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> UploadFindings(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                TempData["Error"] = "Please select a valid Excel file.";
                return View();
            }

            if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            {
                TempData["Error"] = "Please upload an Excel file (.xlsx format only).";
                return View();
            }

            try
            {
                using var stream = file.OpenReadStream();
                var findings = await ProcessExcelFile(stream);
                
                if (!findings.Any())
                {
                    TempData["Warning"] = "No valid findings were found in the Excel file.";
                    return View();
                }

                // Get the default risk matrix for calculations
                var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
                
                var successCount = 0;
                var errorCount = 0;
                var errors = new List<string>();

                var userId = User.Identity?.Name ?? "Unknown";
                
                foreach (var finding in findings)
                {
                    try
                    {
                        // NEW WORKFLOW: Route finding through backlog for approval before creating in register
                        var backlogEntry = await _riskBacklogService.CreateFindingBacklogEntryAsync(
                            title: finding.Title,
                            details: finding.Details,
                            source: "Excel Upload",
                            impact: finding.Impact,
                            likelihood: finding.Likelihood,
                            exposure: finding.Exposure,
                            asset: finding.Asset ?? "",
                            businessUnit: finding.BusinessUnit ?? "",
                            businessOwner: finding.BusinessOwner ?? "",
                            domain: finding.Domain ?? "",
                            technicalControl: finding.TechnicalControl ?? "",
                            requesterId: userId
                        );
                        
                        successCount++;
                    }
                    catch (Exception ex)
                    {
                        errorCount++;
                        errors.Add($"Row {errorCount + successCount}: {ex.Message}");
                        _logger.LogError(ex, "Error processing finding from Excel upload");
                    }
                }

                var message = $"Upload completed: {successCount} findings submitted for approval in the backlog";
                if (errorCount > 0)
                {
                    message += $", {errorCount} errors occurred.";
                    TempData["Warning"] = message;
                    TempData["Errors"] = errors;
                }
                else
                {
                    TempData["Success"] = message + ". They will be added to the findings register once approved.";
                }

                return RedirectToAction("Index", "RiskBacklog");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Excel file upload");
                TempData["Error"] = $"Error processing Excel file: {ex.Message}";
                return View();
            }
        }

        private async Task<List<Finding>> ProcessExcelFile(Stream stream)
        {
            var findings = new List<Finding>();
            
            using (var package = new OfficeOpenXml.ExcelPackage(stream))
            {
                var worksheet = package.Workbook.Worksheets.FirstOrDefault();
                if (worksheet == null)
                {
                    throw new InvalidOperationException("No worksheet found in the Excel file.");
                }

                var rowCount = worksheet.Dimension?.Rows ?? 0;
                if (rowCount <= 1)
                {
                    throw new InvalidOperationException("Excel file appears to be empty or contains only headers.");
                }

                // Process each row (skip header row)
                for (int row = 2; row <= rowCount; row++)
                {
                    try
                    {
                        var title = worksheet.Cells[row, 1].Value?.ToString()?.Trim();
                        var details = worksheet.Cells[row, 2].Value?.ToString()?.Trim();
                        var impactText = worksheet.Cells[row, 3].Value?.ToString()?.Trim();
                        var likelihoodText = worksheet.Cells[row, 4].Value?.ToString()?.Trim();
                        var exposureText = worksheet.Cells[row, 5].Value?.ToString()?.Trim();
                        var owner = worksheet.Cells[row, 6].Value?.ToString()?.Trim();
                        var domain = worksheet.Cells[row, 7].Value?.ToString()?.Trim();
                        var businessUnit = worksheet.Cells[row, 8].Value?.ToString()?.Trim();
                        var businessOwner = worksheet.Cells[row, 9].Value?.ToString()?.Trim();
                        var asset = worksheet.Cells[row, 10].Value?.ToString()?.Trim();
                        var technicalControl = worksheet.Cells[row, 11].Value?.ToString()?.Trim();
                        var assignedTo = worksheet.Cells[row, 12].Value?.ToString()?.Trim();
                        var slaDateText = worksheet.Cells[row, 13].Value?.ToString()?.Trim();

                        // Skip empty rows
                        if (string.IsNullOrEmpty(title) && string.IsNullOrEmpty(details))
                            continue;

                        // Validate required fields
                        if (string.IsNullOrEmpty(title))
                            throw new InvalidOperationException($"Title is required (Row {row})");
                        if (string.IsNullOrEmpty(details))
                            throw new InvalidOperationException($"Details are required (Row {row})");
                        if (string.IsNullOrEmpty(owner))
                            throw new InvalidOperationException($"Owner is required (Row {row})");

                        // Parse enums
                        var impact = ParseImpactLevel(impactText);
                        var likelihood = ParseLikelihoodLevel(likelihoodText);
                        var exposure = ParseExposureLevel(exposureText);

                        // Parse SLA date
                        DateTime? slaDate = null;
                        if (!string.IsNullOrEmpty(slaDateText))
                        {
                            if (DateTime.TryParse(slaDateText, out var parsedDate))
                                slaDate = parsedDate;
                        }

                        var finding = new Finding
                        {
                            Title = title,
                            Details = details,
                            Impact = impact,
                            Likelihood = likelihood,
                            Exposure = exposure,
                            Owner = owner ?? string.Empty,
                            Domain = domain ?? string.Empty,
                            BusinessUnit = businessUnit ?? string.Empty,
                            BusinessOwner = businessOwner ?? string.Empty,
                            Asset = asset ?? string.Empty,
                            TechnicalControl = technicalControl ?? string.Empty,
                            AssignedTo = assignedTo ?? string.Empty,
                            SlaDate = slaDate,
                            OpenDate = DateTime.Today,
                            Status = FindingStatus.Open
                        };

                        findings.Add(finding);
                    }
                    catch (Exception ex)
                    {
                        throw new InvalidOperationException($"Error processing row {row}: {ex.Message}");
                    }
                }
            }

            return findings;
        }

        private ImpactLevel ParseImpactLevel(string value)
        {
            if (string.IsNullOrEmpty(value))
                return ImpactLevel.Low;

            return value.ToLower().Trim() switch
            {
                "critical" or "4" => ImpactLevel.Critical,
                "high" or "3" => ImpactLevel.High,
                "medium" or "2" => ImpactLevel.Medium,
                "low" or "1" => ImpactLevel.Low,
                _ => throw new ArgumentException($"Invalid impact level: {value}")
            };
        }

        private LikelihoodLevel ParseLikelihoodLevel(string value)
        {
            if (string.IsNullOrEmpty(value))
                return LikelihoodLevel.Unlikely;

            return value.ToLower().Trim() switch
            {
                "almost certain" or "almostcertain" or "4" => LikelihoodLevel.AlmostCertain,
                "likely" or "3" => LikelihoodLevel.Likely,
                "possible" or "2" => LikelihoodLevel.Possible,
                "unlikely" or "1" => LikelihoodLevel.Unlikely,
                _ => throw new ArgumentException($"Invalid likelihood level: {value}")
            };
        }

        private ExposureLevel ParseExposureLevel(string value)
        {
            if (string.IsNullOrEmpty(value))
                return ExposureLevel.SlightlyExposed;

            return value.ToLower().Trim() switch
            {
                "highly exposed" or "highlyexposed" or "4" => ExposureLevel.HighlyExposed,
                "moderately exposed" or "moderatelyexposed" or "3" => ExposureLevel.ModeratelyExposed,
                "exposed" or "2" => ExposureLevel.Exposed,
                "slightly exposed" or "slightlyexposed" or "1" => ExposureLevel.SlightlyExposed,
                _ => throw new ArgumentException($"Invalid exposure level: {value}")
            };
        }
    }

    // Request model for risk calculation API
    public class RiskCalculationRequest
    {
        public int Impact { get; set; }
        public int Likelihood { get; set; }
        public int Exposure { get; set; }
    }

    // View Model for the risk acceptance request workflow
    public class RequestRiskAcceptanceViewModel
    {
        public Finding Finding { get; set; } = new Finding();
        public RiskAcceptanceRequest RiskAcceptanceRequest { get; set; } = new RiskAcceptanceRequest();
    }
}