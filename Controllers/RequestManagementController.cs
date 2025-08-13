using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.Authorization;
using CyberRiskApp.Data;
using CyberRiskApp.ViewModels;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireAdminRole)]
    public class RequestManagementController : Controller
    {
        private readonly IRequestService _requestService;
        private readonly UserManager<User> _userManager;
        private readonly CyberRiskContext _context;
        private readonly ILogger<RequestManagementController> _logger;

        public RequestManagementController(
            IRequestService requestService,
            UserManager<User> userManager,
            CyberRiskContext context,
            ILogger<RequestManagementController> logger)
        {
            _requestService = requestService;
            _userManager = userManager;
            _context = context;
            _logger = logger;
        }

        // GET: RequestManagement
        public async Task<IActionResult> Index()
        {
            var viewModel = new RequestManagementViewModel
            {
                AssessmentRequests = await _requestService.GetAllAssessmentRequestsAsync(),
                RiskAcceptanceRequests = await _requestService.GetAllAcceptanceRequestsAsync(),
                FindingClosureRequests = await _requestService.GetAllClosureRequestsAsync(),
                AvailableAssignees = await GetAvailableAssignees()
            };

            return View(viewModel);
        }

        // POST: RequestManagement/AssignAssessment
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> AssignAssessment(int requestId, string assigneeId)
        {
            try
            {
                var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(currentUserId))
                {
                    return Json(new { success = false, message = "Unable to identify current user." });
                }

                var request = await _context.AssessmentRequests.FindAsync(requestId);
                if (request == null)
                {
                    return Json(new { success = false, message = "Request not found." });
                }

                // Check if assignee is valid
                var assignee = await _userManager.FindByIdAsync(assigneeId);
                if (assignee == null)
                {
                    return Json(new { success = false, message = "Invalid assignee." });
                }

                // Verify assignee has appropriate role (Admin or GRCUser)
                var roles = await _userManager.GetRolesAsync(assignee);
                if (!roles.Contains("Admin") && !roles.Contains("GRCUser"))
                {
                    return Json(new { success = false, message = "Assignee must be an Admin or GRC User." });
                }

                // Update assignment
                request.AssignedToUserId = assigneeId;
                request.AssignedToUser = assignee;
                request.AssignedByUserId = currentUserId;
                request.AssignmentDate = DateTime.UtcNow;
                request.Status = RequestStatus.Pending;

                await _context.SaveChangesAsync();

                _logger.LogInformation($"Assessment request {requestId} assigned to {assignee.UserName} by {User.Identity.Name}");

                return Json(new { 
                    success = true, 
                    message = $"Request successfully assigned to {assignee.FirstName} {assignee.LastName}",
                    assigneeName = $"{assignee.FirstName} {assignee.LastName}",
                    assignmentDate = request.AssignmentDate?.ToString("MM/dd/yyyy")
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error assigning assessment request {requestId}");
                return Json(new { success = false, message = "An error occurred while assigning the request." });
            }
        }

        // POST: RequestManagement/AssignRiskAcceptance
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> AssignRiskAcceptance(int requestId, string assigneeId)
        {
            try
            {
                var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(currentUserId))
                {
                    return Json(new { success = false, message = "Unable to identify current user." });
                }

                var request = await _context.RiskAcceptanceRequests
                    .Include(r => r.LinkedRisk)
                    .Include(r => r.LinkedFinding)
                    .FirstOrDefaultAsync(r => r.Id == requestId);
                    
                if (request == null)
                {
                    return Json(new { success = false, message = "Request not found." });
                }

                // Check if assignee is valid
                var assignee = await _userManager.FindByIdAsync(assigneeId);
                if (assignee == null)
                {
                    return Json(new { success = false, message = "Invalid assignee." });
                }

                // Verify assignee has appropriate role (Admin or GRCUser)
                var roles = await _userManager.GetRolesAsync(assignee);
                if (!roles.Contains("Admin") && !roles.Contains("GRCUser"))
                {
                    return Json(new { success = false, message = "Assignee must be an Admin or GRC User." });
                }

                // Update assignment
                request.AssignedToUserId = assigneeId;
                request.AssignedToUser = assignee;
                request.AssignedByUserId = currentUserId;
                request.AssignmentDate = DateTime.UtcNow;
                request.Status = RequestStatus.InProgress;

                await _context.SaveChangesAsync();

                _logger.LogInformation($"Risk acceptance request {requestId} assigned to {assignee.UserName} by {User.Identity.Name}");

                return Json(new { 
                    success = true, 
                    message = $"Request successfully assigned to {assignee.FirstName} {assignee.LastName}",
                    assigneeName = $"{assignee.FirstName} {assignee.LastName}",
                    assignmentDate = request.AssignmentDate?.ToString("MM/dd/yyyy")
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error assigning risk acceptance request {requestId}");
                return Json(new { success = false, message = "An error occurred while assigning the request." });
            }
        }

        // POST: RequestManagement/AssignFindingClosure
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> AssignFindingClosure(int requestId, string assigneeId)
        {
            try
            {
                var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(currentUserId))
                {
                    return Json(new { success = false, message = "Unable to identify current user." });
                }

                var request = await _context.FindingClosureRequests
                    .Include(r => r.LinkedFinding)
                    .FirstOrDefaultAsync(r => r.Id == requestId);
                    
                if (request == null)
                {
                    return Json(new { success = false, message = "Request not found." });
                }

                // Check if assignee is valid
                var assignee = await _userManager.FindByIdAsync(assigneeId);
                if (assignee == null)
                {
                    return Json(new { success = false, message = "Invalid assignee." });
                }

                // Verify assignee has appropriate role (Admin or GRCUser)
                var roles = await _userManager.GetRolesAsync(assignee);
                if (!roles.Contains("Admin") && !roles.Contains("GRCUser"))
                {
                    return Json(new { success = false, message = "Assignee must be an Admin or GRC User." });
                }

                // Update assignment
                request.AssignedToUserId = assigneeId;
                request.AssignedToUser = assignee;
                request.AssignedByUserId = currentUserId;
                request.AssignmentDate = DateTime.UtcNow;
                request.Status = RequestStatus.InProgress;

                await _context.SaveChangesAsync();

                _logger.LogInformation($"Finding closure request {requestId} assigned to {assignee.UserName} by {User.Identity.Name}");

                return Json(new { 
                    success = true, 
                    message = $"Request successfully assigned to {assignee.FirstName} {assignee.LastName}",
                    assigneeName = $"{assignee.FirstName} {assignee.LastName}",
                    assignmentDate = request.AssignmentDate?.ToString("MM/dd/yyyy")
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error assigning finding closure request {requestId}");
                return Json(new { success = false, message = "An error occurred while assigning the request." });
            }
        }

        // POST: RequestManagement/UnassignRequest
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UnassignRequest(int requestId, string requestType)
        {
            try
            {
                switch (requestType.ToLower())
                {
                    case "assessment":
                        var assessmentRequest = await _context.AssessmentRequests.FindAsync(requestId);
                        if (assessmentRequest != null)
                        {
                            assessmentRequest.AssignedToUserId = null;
                            assessmentRequest.AssignedToUser = null;
                            assessmentRequest.AssignedByUserId = null;
                            assessmentRequest.AssignmentDate = null;
                            assessmentRequest.Status = RequestStatus.Pending;
                        }
                        break;

                    case "acceptance":
                        var acceptanceRequest = await _context.RiskAcceptanceRequests.FindAsync(requestId);
                        if (acceptanceRequest != null)
                        {
                            acceptanceRequest.AssignedToUserId = null;
                            acceptanceRequest.AssignedToUser = null;
                            acceptanceRequest.AssignedByUserId = null;
                            acceptanceRequest.AssignmentDate = null;
                            acceptanceRequest.Status = RequestStatus.PendingApproval;
                        }
                        break;

                    case "closure":
                        var closureRequest = await _context.FindingClosureRequests.FindAsync(requestId);
                        if (closureRequest != null)
                        {
                            closureRequest.AssignedToUserId = null;
                            closureRequest.AssignedToUser = null;
                            closureRequest.AssignedByUserId = null;
                            closureRequest.AssignmentDate = null;
                            closureRequest.Status = RequestStatus.PendingApproval;
                        }
                        break;

                    default:
                        return Json(new { success = false, message = "Invalid request type." });
                }

                await _context.SaveChangesAsync();
                return Json(new { success = true, message = "Assignment removed successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error unassigning request {requestId} of type {requestType}");
                return Json(new { success = false, message = "An error occurred while removing the assignment." });
            }
        }

        private async Task<List<User>> GetAvailableAssignees()
        {
            var admins = await _userManager.GetUsersInRoleAsync("Admin");
            var grcUsers = await _userManager.GetUsersInRoleAsync("GRCUser");
            
            var assignees = admins.Union(grcUsers)
                .Where(u => u.IsActive)
                .OrderBy(u => u.FirstName)
                .ThenBy(u => u.LastName)
                .Distinct()
                .ToList();

            return assignees;
        }
    }
}