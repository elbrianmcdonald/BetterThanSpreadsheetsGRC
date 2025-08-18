using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Rendering;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.ViewModels;
using CyberRiskApp.Authorization;

namespace CyberRiskApp.Controllers
{
    // REMOVED: [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)] - controller level authorization
    public class RequestsController : Controller
    {
        private readonly IRequestService _requestService;
        private readonly IFindingService _findingService;
        private readonly IUserService _userService;
        private readonly IExportService _exportService;

        public RequestsController(IRequestService requestService, IFindingService findingService, IUserService userService, IExportService exportService)
        {
            _requestService = requestService;
            _findingService = findingService;
            _userService = userService;
            _exportService = exportService;
        }

        // UPDATED: All users can view all requests
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Index()
        {
            var model = new RequestsViewModel
            {
                AssessmentRequests = await _requestService.GetAllAssessmentRequestsAsync(),
                AcceptanceRequests = await _requestService.GetAllAcceptanceRequestsAsync()
            };

            return View(model);
        }

        // UPDATED: All users can export acceptance requests
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> ExportAcceptanceToExcel()
        {
            try
            {
                var acceptanceRequests = await _requestService.GetAllAcceptanceRequestsAsync();
                var excelData = await _exportService.ExportAcceptanceRequestsToExcelAsync(acceptanceRequests);

                var fileName = $"Risk_Acceptance_Register_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";

                return File(excelData, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error exporting acceptance requests: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }

        // UPDATED: All users can view request details
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Details(int id)
        {
            var request = await _requestService.GetAssessmentRequestByIdAsync(id);
            if (request == null)
                return NotFound();

            return View(request);
        }

        // UPDATED: Only GRC and Admin can edit requests
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Edit(int id)
        {
            var request = await _requestService.GetAssessmentRequestByIdAsync(id);
            if (request == null)
                return NotFound();

            return View(request);
        }

        // UPDATED: Only GRC and Admin can edit requests
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Edit(int id, AssessmentRequest request)
        {
            if (id != request.Id)
                return NotFound();

            if (ModelState.IsValid)
            {
                try
                {
                    await _requestService.UpdateAssessmentRequestAsync(request);
                    TempData["Success"] = "Assessment request updated successfully.";
                    return RedirectToAction(nameof(Index));
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error updating request: {ex.Message}";
                }
            }

            return View(request);
        }

        // UPDATED: Only GRC and Admin can delete requests
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            try
            {
                await _requestService.DeleteAssessmentRequestAsync(id);
                TempData["Success"] = "Assessment request deleted successfully.";
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error deleting request: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // UPDATED: Only GRC and Admin can create assessment requests
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public IActionResult Create()
        {
            var model = new AssessmentRequest
            {
                RequestDate = DateTime.Today,
                Status = RequestStatus.Pending
            };
            return View(model);
        }

        // UPDATED: Only GRC and Admin can create assessment requests
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Create(AssessmentRequest request)
        {
            if (ModelState.IsValid)
            {
                try
                {
                    // Set default values
                    request.RequesterName = User.Identity?.Name ?? request.RequesterName ?? "Unknown User";
                    request.RequestDate = DateTime.Today;
                    request.Status = RequestStatus.Pending;
                    request.CreatedAt = DateTime.UtcNow;
                    request.UpdatedAt = DateTime.UtcNow;

                    await _requestService.CreateAssessmentRequestAsync(request);
                    TempData["Success"] = "Assessment request created successfully.";
                    return RedirectToAction(nameof(Index));
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error creating request: {ex.Message}";
                }
            }

            return View(request);
        }

        // UPDATED: Only GRC and Admin can perform assignment
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Assignment()
        {
            try
            {
                var unassignedRequests = await _requestService.GetUnassignedAssessmentRequestsAsync();
                var grcUsers = await _requestService.GetGRCUsersAsync();

                // Create a simple view model inline
                var model = new
                {
                    UnassignedRequests = unassignedRequests,
                    AvailableUsers = grcUsers.Select(u => new SelectListItem
                    {
                        Value = u.Id,
                        Text = $"{u.Email} ({u.Role})"
                    }).ToList()
                };

                return View(model);
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error loading assignment page: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }

        // UPDATED: Only GRC and Admin can assign requests
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Assign(int requestId, string assignedToUserId, string notes, decimal? estimatedHours)
        {
            try
            {
                var assignedByUserId = User.Identity?.Name ?? "Unknown";
                await _requestService.AssignAssessmentRequestAsync(requestId, assignedToUserId, assignedByUserId, notes, estimatedHours);

                TempData["Success"] = "Request assigned successfully.";
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error assigning request: {ex.Message}";
            }

            return RedirectToAction(nameof(Assignment));
        }

        // UPDATED: All users can start their assigned work
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Start(int requestId)
        {
            try
            {
                var userId = User.Identity?.Name ?? "System";
                await _requestService.StartAssessmentRequestAsync(requestId, userId);

                TempData["Success"] = "Assessment started successfully.";
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error starting assessment: {ex.Message}";
            }

            return RedirectToAction(nameof(MyAssignments));
        }

        // UPDATED: All users can complete their assigned work
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Complete(int requestId, decimal? actualHours, string notes)
        {
            try
            {
                var userId = User.Identity?.Name ?? "System";
                await _requestService.CompleteAssessmentRequestAsync(requestId, userId, actualHours, notes);

                TempData["Success"] = "Assessment completed successfully.";
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error completing assessment: {ex.Message}";
            }

            return RedirectToAction(nameof(MyAssignments));
        }

        // UPDATED: All users can view their assignments
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> MyAssignments()
        {
            try
            {
                var userId = User.Identity?.Name ?? "System";
                var myRequests = await _requestService.GetAssignedRequestsForUserAsync(userId);

                return View(myRequests);
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error loading assignments: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }

        // All users can create risk acceptance requests (already correct)
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> CreateAcceptance()
        {
            try
            {
                var openFindings = await _requestService.GetOpenFindingsAsync();
                var openRisks = await _requestService.GetOpenRisksAsync();

                ViewBag.OpenFindings = openFindings.Select(f => new SelectListItem
                {
                    Value = f.Id.ToString(),
                    Text = $"{f.FindingNumber} - {f.Title}"
                }).ToList();

                ViewBag.OpenRisks = openRisks.Select(r => new SelectListItem
                {
                    Value = r.Id.ToString(),
                    Text = $"{r.RiskNumber} - {r.Title}"
                }).ToList();

                return View();
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error loading page: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }

        // All users can create risk acceptance requests (already correct)
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> CreateAcceptance(RiskAcceptanceRequest request)
        {
            // Custom validation to ensure only one of FindingId or RiskId is provided
            if (request.FindingId.HasValue && request.RiskId.HasValue)
            {
                ModelState.AddModelError("", "Please select either a Finding OR a Risk, not both.");
            }

            if (ModelState.IsValid)
            {
                try
                {
                    // Set additional properties
                    request.Requester = User.Identity?.Name ?? "Unknown";
                    request.RequestDate = DateTime.Today;
                    request.Status = RequestStatus.PendingApproval;

                    var result = await _requestService.CreateAcceptanceRequestAsync(request);

                    TempData["Success"] = "Risk acceptance request created successfully.";
                    return RedirectToAction(nameof(Index));
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error creating request: {ex.Message}";

                    // Reload the dropdowns if there's an error
                    var openFindings = await _requestService.GetOpenFindingsAsync();
                    var openRisks = await _requestService.GetOpenRisksAsync();
                    
                    ViewBag.OpenFindings = openFindings.Select(f => new SelectListItem
                    {
                        Value = f.Id.ToString(),
                        Text = $"{f.FindingNumber} - {f.Title}"
                    }).ToList();

                    ViewBag.OpenRisks = openRisks.Select(r => new SelectListItem
                    {
                        Value = r.Id.ToString(),
                        Text = $"{r.RiskNumber} - {r.Title}"
                    }).ToList();

                    return View(request);
                }
            }

            // Reload the dropdowns if validation fails
            var openFindingsForError = await _requestService.GetOpenFindingsAsync();
            var openRisksForError = await _requestService.GetOpenRisksAsync();
            
            ViewBag.OpenFindings = openFindingsForError.Select(f => new SelectListItem
            {
                Value = f.Id.ToString(),
                Text = $"{f.FindingNumber} - {f.Title}"
            }).ToList();

            ViewBag.OpenRisks = openRisksForError.Select(r => new SelectListItem
            {
                Value = r.Id.ToString(),
                Text = $"{r.RiskNumber} - {r.Title}"
            }).ToList();

            return View(request);
        }

        // UPDATED: All users can view acceptance request details
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> AcceptanceDetails(int id)
        {
            var request = await _requestService.GetAcceptanceRequestByIdAsync(id);
            if (request == null)
                return NotFound();

            return View(request);
        }

        // UPDATED: Only GRC and Admin can review acceptance requests
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> ReviewAcceptance(int id)
        {
            var request = await _requestService.GetAcceptanceRequestByIdAsync(id);
            if (request == null)
                return NotFound();

            if (request.Status != RequestStatus.PendingApproval)
            {
                TempData["Error"] = "Only pending requests can be reviewed.";
                return RedirectToAction(nameof(AcceptanceDetails), new { id });
            }

            return View(request);
        }

        // UPDATED: Only GRC and Admin can review acceptance requests
        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ReviewAcceptance(int id, RequestStatus decision, string reviewComments,
            string riskSummary, string currentCompensatingControls,
            RiskRating? currentRiskLevelWithControls, string treatmentPlan, string proposedCompensatingControls,
            RiskRating? futureRiskLevelWithMitigations, string cisoRecommendation, int? linkedRiskAssessmentId)
        {
            var request = await _requestService.GetAcceptanceRequestByIdAsync(id);
            if (request == null)
                return NotFound();

            if (request.Status != RequestStatus.PendingApproval)
            {
                TempData["Error"] = "Only pending requests can be reviewed.";
                return RedirectToAction(nameof(AcceptanceDetails), new { id });
            }

            try
            {
                // Update basic review fields
                request.Status = decision;
                request.ReviewDate = DateTime.Today;
                request.ReviewedBy = User.Identity?.Name ?? "Unknown";
                request.ReviewComments = reviewComments ?? "";

                // Update GRC analysis fields
                request.RiskSummary = riskSummary ?? "";
                request.CurrentCompensatingControls = currentCompensatingControls ?? "";
                request.CurrentRiskLevelWithControls = currentRiskLevelWithControls;
                request.TreatmentPlan = treatmentPlan ?? "";
                request.ProposedCompensatingControls = proposedCompensatingControls ?? "";
                request.FutureRiskLevelWithMitigations = futureRiskLevelWithMitigations;
                request.CISORecommendation = cisoRecommendation ?? "";
                
                // Handle linked risk assessment
                if (linkedRiskAssessmentId.HasValue && linkedRiskAssessmentId.Value > 0)
                {
                    request.LinkedRiskAssessmentId = linkedRiskAssessmentId.Value;
                }

                await _requestService.UpdateAcceptanceRequestAsync(request);

                var statusText = decision == RequestStatus.Approved ? "approved" : "rejected";
                TempData["Success"] = $"Risk acceptance request has been {statusText} successfully.";

                return RedirectToAction(nameof(AcceptanceDetails), new { id });
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error reviewing request: {ex.Message}";
                return RedirectToAction(nameof(ReviewAcceptance), new { id });
            }
        }

        // UPDATED: Only Admin can delete acceptance requests
        [HttpPost, ActionName("DeleteAcceptanceConfirmed")]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> DeleteAcceptanceConfirmed(int id)
        {
            try
            {
                var request = await _requestService.GetAcceptanceRequestByIdAsync(id);
                if (request == null)
                {
                    TempData["Error"] = "Risk acceptance request not found.";
                    return RedirectToAction(nameof(Index));
                }

                var success = await _requestService.DeleteAcceptanceRequestAsync(id);
                if (success)
                {
                    TempData["Success"] = $"Risk acceptance request #{request.Id} - '{request.Description}' deleted successfully.";
                }
                else
                {
                    TempData["Error"] = "Failed to delete risk acceptance request.";
                }

                return RedirectToAction(nameof(Index));
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error deleting risk acceptance request: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }
    }
}