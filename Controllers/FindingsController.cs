using CyberRiskApp.Models;
using CyberRiskApp.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Authorization;
using CyberRiskApp.Extensions;
using Microsoft.Extensions.Logging;

namespace CyberRiskApp.Controllers
{
    public class FindingsController : Controller
    {
        private readonly IFindingService _findingService;
        private readonly IRequestService _requestService;
        private readonly IExportService _exportService;
        private readonly ILogger<FindingsController> _logger;

        public FindingsController(IFindingService findingService, IRequestService requestService, IExportService exportService, ILogger<FindingsController> logger)
        {
            _findingService = findingService;
            _requestService = requestService;
            _exportService = exportService;
            _logger = logger;
        }

        // UPDATED: All users can view findings
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Index(string status = "open")
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

            return View(findings);
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
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public IActionResult Create()
        {
            return View();
        }

        // UPDATED: Only GRC and Admin can create findings
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Create(Finding finding)
        {
            // Remove audit fields from model validation since they're set automatically
            ModelState.Remove("CreatedBy");
            ModelState.Remove("UpdatedBy");
            
            if (ModelState.IsValid)
            {
                try
                {
                    // Auto-calculate risk rating based on impact, likelihood, and exposure
                    finding.RiskRating = finding.CalculateRiskRating();

                    await _findingService.CreateFindingAsync(finding);
                    TempData["Success"] = "Finding created successfully with auto-calculated risk rating.";
                    return RedirectToAction(nameof(Index));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error creating finding");
                    ModelState.AddModelError("", $"Error creating finding: {ex.Message}");
                }
            }
            else
            {
                // Log validation errors
                foreach (var modelError in ModelState.Values.SelectMany(v => v.Errors))
                {
                    _logger.LogWarning($"Validation error: {modelError.ErrorMessage}");
                }
            }

            return View(finding);
        }

        // UPDATED: Only GRC and Admin can edit findings
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
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
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Edit(int id, Finding finding)
        {
            if (id != finding.Id)
                return NotFound();

            if (ModelState.IsValid)
            {
                // Auto-calculate risk rating when editing
                finding.RiskRating = finding.CalculateRiskRating();

                await _findingService.UpdateFindingAsync(finding);
                TempData["Success"] = "Finding updated successfully with recalculated risk rating.";
                return RedirectToAction(nameof(Index));
            }

            return View(finding);
        }

        // UPDATED: Only Admin can delete findings
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            try
            {
                var finding = await _findingService.GetFindingByIdAsync(id);
                if (finding == null)
                {
                    TempData["Error"] = "Finding not found.";
                    return RedirectToAction(nameof(Index));
                }

                await _findingService.DeleteFindingAsync(id);
                TempData["Success"] = $"Finding #{finding.FindingNumber} - {finding.Title} deleted successfully.";
                return RedirectToAction(nameof(Index));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting finding with ID: {FindingId}", id);
                TempData["Error"] = $"Error deleting finding: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
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
    }

    // View Model for the risk acceptance request workflow
    public class RequestRiskAcceptanceViewModel
    {
        public Finding Finding { get; set; } = new Finding();
        public RiskAcceptanceRequest RiskAcceptanceRequest { get; set; } = new RiskAcceptanceRequest();
    }
}