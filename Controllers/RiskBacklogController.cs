using CyberRiskApp.Authorization;
using CyberRiskApp.Extensions;
using CyberRiskApp.Filters;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = "RequireAnyRole")] // Allow IT users view access
    public partial class RiskBacklogController : BaseController
    {
        private readonly IRiskBacklogService _backlogService;
        private readonly IUserService _userService;

        public RiskBacklogController(
            IRiskBacklogService backlogService, 
            IUserService userService, 
            ILogger<RiskBacklogController> logger) : base(logger)
        {
            _backlogService = backlogService;
            _userService = userService;
        }

        // Dashboard - Main entry point
        public async Task<IActionResult> Index(string? filter = null, string? status = null, string? action = null, string? priority = null)
        {
            return await ExecuteWithErrorHandling(
                async () =>
                {
                    // Use extension methods to simplify user identity extraction
                    var userId = User.GetUserId();
                    var roleString = User.GetUserRolesForService();
                    
                    // Use base controller role checking
                    var isManager = IsManager;

                    // Get statistics using the optimized method
                    var statistics = await _backlogService.GetBacklogStatisticsAsync(userId, roleString);

                    // Get user's assigned backlog
                    var myBacklog = await _backlogService.GetBacklogForUserAsync(userId, roleString);

                    // Get unassigned entries (managers only)
                    var unassignedEntries = isManager ? await _backlogService.GetUnassignedBacklogAsync() : new List<RiskBacklogEntry>();

                // Get all entries with filters
                List<RiskBacklogEntry> allEntries;
                if (!string.IsNullOrEmpty(status))
                {
                    if (Enum.TryParse<RiskBacklogStatus>(status, out var statusEnum))
                        allEntries = await _backlogService.GetBacklogByStatusAsync(statusEnum);
                    else
                        allEntries = await _backlogService.GetAllBacklogEntriesAsync();
                }
                else if (!string.IsNullOrEmpty(action))
                {
                    if (Enum.TryParse<RiskBacklogAction>(action, out var actionEnum))
                        allEntries = await _backlogService.GetBacklogByActionTypeAsync(actionEnum);
                    else
                        allEntries = await _backlogService.GetAllBacklogEntriesAsync();
                }
                else if (!string.IsNullOrEmpty(filter))
                {
                    switch (filter.ToLower())
                    {
                        case "overdue":
                            allEntries = await _backlogService.GetOverdueBacklogEntriesAsync();
                            break;
                        case "completed-this-week":
                            allEntries = await _backlogService.GetCompletedThisWeekBacklogEntriesAsync();
                            break;
                        case "findings":
                            // Filter for finding workflows only
                            allEntries = (await _backlogService.GetAllBacklogEntriesAsync())
                                .Where(e => e.IsFindingWorkflow())
                                .ToList();
                            break;
                        case "risks":
                            // Filter for risk workflows only
                            allEntries = (await _backlogService.GetAllBacklogEntriesAsync())
                                .Where(e => e.IsRiskWorkflow())
                                .ToList();
                            break;
                        case "all":
                        default:
                            allEntries = await _backlogService.GetAllBacklogEntriesAsync();
                            break;
                    }
                }
                else
                {
                    allEntries = await _backlogService.GetAllBacklogEntriesAsync();
                }

                    // Get all users for assignment dropdowns 
                    var allUsers = isManager ? await _userService.GetAllUsersAsync() : new List<User>();

                    // IT users get view-only access - no assign/approve capabilities
                    var isITUser = User.IsInRole("ITUser");
                    
                    var viewModel = new BacklogDashboardViewModel
                    {
                        Statistics = statistics,
                        MyBacklogEntries = myBacklog,
                        UnassignedEntries = unassignedEntries,
                        AllEntries = allEntries,
                        CanAssign = isManager && !isITUser, // IT users cannot assign
                        CanApprove = IsAnalyst && !isITUser, // IT users cannot approve
                        AvailableAnalysts = allUsers,
                        AvailableManagers = allUsers,
                        CurrentFilter = filter ?? "all"
                    };

                    // Pass filter info to view for highlighting active metric cards
                    ViewBag.CurrentFilter = filter;
                    ViewBag.CurrentStatus = status;
                    ViewBag.CurrentAction = action;

                    // Add admin data to ViewBag if user is admin
                    if (IsAdmin) // Use base controller property
                    {
                        var orphanedEntries = await _backlogService.GetOrphanedEntriesAsync();
                        var stuckEntries = await _backlogService.GetStuckEntriesAsync();
                        var recentErrors = await _backlogService.GetRecentErrorsCountAsync();
                        var totalEntries = await _backlogService.GetTotalEntriesCountAsync();
                        
                        ViewBag.OrphanedCount = orphanedEntries.Count;
                        ViewBag.StuckCount = stuckEntries.Count;
                        ViewBag.RecentErrors = recentErrors;
                        
                        // Calculate system health score
                        var problemEntries = orphanedEntries.Count + stuckEntries.Count + recentErrors;
                        var healthScore = totalEntries > 0 ? Math.Max(0, 100 - (problemEntries * 100 / totalEntries)) : 100;
                        ViewBag.SystemHealth = Math.Min(100, healthScore);
                    }

                    return viewModel;
                },
                viewModel => View(viewModel),
                "loading backlog dashboard"
            );
        }

        // Entry Details
        public async Task<IActionResult> Details(int id)
        {
            try
            {
                var entry = await _backlogService.GetBacklogEntryByIdAsync(id);
                if (entry == null)
                    return NotFound();

                var userId = User.Identity?.Name ?? "";
                var userRoles = string.Join(",", User.Claims.Where(c => c.Type == "role" || c.Type == System.Security.Claims.ClaimTypes.Role).Select(c => c.Value));

                if (!await _backlogService.CanUserAccessBacklogEntryAsync(id, userId, userRoles))
                {
                    return Forbid();
                }

                var comments = await _backlogService.GetCommentsAsync(id, User.IsInRole("Admin") || User.IsInRole("GRCManager"));
                var activities = await _backlogService.GetActivitiesAsync(id);

                // IT users get view-only access - no approve/assign/comment capabilities
                var isITUser = User.IsInRole("ITUser");
                
                var viewModel = new BacklogDetailsViewModel
                {
                    Entry = entry,
                    Comments = comments,
                    Activities = activities,
                    CanApprove = !isITUser && await _backlogService.CanUserApproveBacklogEntryAsync(id, userId, userRoles),
                    CanAssign = !isITUser && (User.IsInRole("GRCManager") || User.IsInRole("Admin")),
                    CanComment = !isITUser // IT users cannot comment
                };

                return View(viewModel);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading backlog entry details for ID {Id}", id);
                return NotFound();
            }
        }

        // Assignment Actions
        [HttpPost]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> AssignToAnalyst(int backlogId, string analystId)
        {
            try
            {
                await _backlogService.AssignToAnalystAsync(backlogId, analystId, User.Identity?.Name ?? "");
                TempData["Success"] = "Successfully assigned to analyst.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning backlog entry {BacklogId} to analyst {AnalystId}", backlogId, analystId);
                TempData["Error"] = "Error assigning to analyst.";
            }
            
            return RedirectToAction(nameof(Details), new { id = backlogId });
        }

        [HttpPost]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> AssignToManager(int backlogId, string managerId)
        {
            try
            {
                await _backlogService.AssignToManagerAsync(backlogId, managerId, User.Identity?.Name ?? "");
                TempData["Success"] = "Successfully assigned to manager.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning backlog entry {BacklogId} to manager {ManagerId}", backlogId, managerId);
                TempData["Error"] = "Error assigning to manager.";
            }
            
            return RedirectToAction(nameof(Details), new { id = backlogId });
        }

        // Workflow Actions
        [HttpPost]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> AnalystApprove(int backlogId, string comments)
        {
            try
            {
                var userId = User.Identity?.Name ?? "";
                var userRoles = string.Join(",", User.Claims.Where(c => c.Type == "role" || c.Type == System.Security.Claims.ClaimTypes.Role).Select(c => c.Value));

                if (!await _backlogService.CanUserApproveBacklogEntryAsync(backlogId, userId, userRoles))
                {
                    return Forbid();
                }

                await _backlogService.AnalystApproveAsync(backlogId, comments, userId);
                TempData["Success"] = "Entry approved and forwarded to manager.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error approving backlog entry {BacklogId}", backlogId);
                TempData["Error"] = "Error approving entry.";
            }

            return RedirectToAction(nameof(Details), new { id = backlogId });
        }

        [HttpPost]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> AnalystReject(int backlogId, string reason)
        {
            try
            {
                var userId = User.Identity?.Name ?? "";
                var userRoles = string.Join(",", User.Claims.Where(c => c.Type == "role" || c.Type == System.Security.Claims.ClaimTypes.Role).Select(c => c.Value));

                if (!await _backlogService.CanUserApproveBacklogEntryAsync(backlogId, userId, userRoles))
                {
                    return Forbid();
                }

                await _backlogService.AnalystRejectAsync(backlogId, reason, userId);
                TempData["Success"] = "Entry rejected.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error rejecting backlog entry {BacklogId}", backlogId);
                TempData["Error"] = "Error rejecting entry.";
            }

            return RedirectToAction(nameof(Details), new { id = backlogId });
        }

        [HttpPost]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> ManagerApprove(int backlogId, string comments)
        {
            return await ExecuteWithSuccessMessage(
                async () => 
                {
                    var userId = User.GetUserId(); // Use extension method
                    return await _backlogService.ManagerApproveAsync(backlogId, comments, userId);
                },
                entry => "Entry approved and processed.",
                "approving backlog entry as manager",
                nameof(Details),
                new { id = backlogId }
            );
        }

        [HttpPost]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> ManagerReject(int backlogId, string reason)
        {
            try
            {
                var userId = User.Identity?.Name ?? "";
                await _backlogService.ManagerRejectAsync(backlogId, reason, userId);
                TempData["Success"] = "Entry rejected.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error rejecting backlog entry {BacklogId} as manager", backlogId);
                TempData["Error"] = "Error rejecting entry.";
            }

            return RedirectToAction(nameof(Details), new { id = backlogId });
        }

        [HttpPost]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> Escalate(int backlogId, string reason)
        {
            try
            {
                var userId = User.Identity?.Name ?? "";
                await _backlogService.EscalateAsync(backlogId, reason, userId);
                TempData["Warning"] = "Entry escalated.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error escalating backlog entry {BacklogId}", backlogId);
                TempData["Error"] = "Error escalating entry.";
            }

            return RedirectToAction(nameof(Details), new { id = backlogId });
        }

        [HttpPost]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> SetPriority(int backlogId, BacklogPriority priority)
        {
            try
            {
                var userId = User.Identity?.Name ?? "";
                await _backlogService.SetPriorityAsync(backlogId, priority, userId);
                TempData["Success"] = "Priority updated.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting priority for backlog entry {BacklogId}", backlogId);
                TempData["Error"] = "Error updating priority.";
            }

            return RedirectToAction(nameof(Details), new { id = backlogId });
        }

        [HttpPost]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> AddComment(int backlogId, string comment, bool isInternal = false)
        {
            try
            {
                var userId = User.Identity?.Name ?? "";
                var commentType = User.IsInRole("GRCManager") ? "Manager" : 
                                 User.IsInRole("GRCAnalyst") ? "Analyst" : "User";

                await _backlogService.AddCommentAsync(backlogId, comment, commentType, isInternal, userId);
                TempData["Success"] = "Comment added.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding comment to backlog entry {BacklogId}", backlogId);
                TempData["Error"] = "Error adding comment.";
            }

            return RedirectToAction(nameof(Details), new { id = backlogId });
        }

        // API Endpoints for bulk operations
        [HttpPost]
        [Route("api/backlog/bulk-assign-analyst")]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> BulkAssignAnalyst([FromBody] BulkAssignRequest request)
        {
            try
            {
                var count = await _backlogService.BulkAssignToAnalystAsync(request.BacklogIds, request.AssigneeId, User.Identity?.Name ?? "");
                return Json(new { success = true, assignedCount = count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error bulk assigning to analyst");
                return Json(new { success = false, error = "Error performing bulk assignment" });
            }
        }

        [HttpPost]
        [Route("api/backlog/bulk-assign-manager")]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> BulkAssignManager([FromBody] BulkAssignRequest request)
        {
            try
            {
                var count = await _backlogService.BulkAssignToManagerAsync(request.BacklogIds, request.AssigneeId, User.Identity?.Name ?? "");
                return Json(new { success = true, assignedCount = count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error bulk assigning to manager");
                return Json(new { success = false, error = "Error performing bulk assignment" });
            }
        }

        [HttpPost]
        [Route("api/backlog/bulk-approve")]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> BulkApprove([FromBody] BulkApproveRequest request)
        {
            try
            {
                var count = await _backlogService.BulkApproveByManagerAsync(request.BacklogIds, request.Comments, User.Identity?.Name ?? "");
                return Json(new { success = true, approvedCount = count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error bulk approving entries");
                return Json(new { success = false, error = "Error performing bulk approval" });
            }
        }

        [HttpPost]
        [Route("api/backlog/bulk-priority")]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> BulkSetPriority([FromBody] BulkPriorityRequest request)
        {
            try
            {
                var count = await _backlogService.BulkSetPriorityAsync(request.BacklogIds, request.Priority, User.Identity?.Name ?? "");
                return Json(new { success = true, updatedCount = count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error bulk setting priority");
                return Json(new { success = false, error = "Error updating priorities" });
            }
        }

        // Reports
        [HttpGet]
        public async Task<IActionResult> Reports()
        {
            try
            {
                var statistics = await _backlogService.GetBacklogStatisticsAsync();
                var overdueEntries = await _backlogService.GetOverdueBacklogEntriesAsync();
                var dueEntries = await _backlogService.GetDueBacklogEntriesAsync(7);

                var viewModel = new BacklogReportsViewModel
                {
                    Statistics = statistics,
                    OverdueEntries = overdueEntries,
                    DueEntries = dueEntries
                };

                return View(viewModel);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading backlog reports");
                TempData["Error"] = "Error loading reports.";
                return RedirectToAction(nameof(Index));
            }
        }

        // Admin-only methods
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AdminWorkflow()
        {
            try
            {
                var model = new AdminWorkflowViewModel
                {
                    UnassignedEntries = await _backlogService.GetBacklogByStatusAsync(RiskBacklogStatus.Unassigned),
                    AnalystEntries = await _backlogService.GetBacklogByStatusAsync(RiskBacklogStatus.AssignedToAnalyst),
                    ManagerEntries = await _backlogService.GetBacklogByStatusAsync(RiskBacklogStatus.AssignedToManager),
                    ApprovedEntries = await _backlogService.GetBacklogByStatusAsync(RiskBacklogStatus.Approved),
                    RejectedEntries = await _backlogService.GetBacklogByStatusAsync(RiskBacklogStatus.Rejected),
                    EscalatedEntries = await _backlogService.GetBacklogByStatusAsync(RiskBacklogStatus.Escalated),
                    
                    TotalEntries = await _backlogService.GetTotalEntriesCountAsync(),
                    OrphanedEntries = await _backlogService.GetOrphanedEntriesAsync(),
                    StuckEntries = await _backlogService.GetStuckEntriesAsync(),
                    RecentErrorsCount = await _backlogService.GetRecentErrorsCountAsync()
                };

                return View(model);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading admin workflow");
                TempData["Error"] = "Error loading admin workflow.";
                return RedirectToAction(nameof(Index));
            }
        }

        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> SystemHealth()
        {
            try
            {
                var model = new SystemHealthViewModel
                {
                    TotalBacklogEntries = await _backlogService.GetTotalEntriesCountAsync(),
                    OrphanedEntriesCount = (await _backlogService.GetOrphanedEntriesAsync()).Count,
                    StuckEntriesCount = (await _backlogService.GetStuckEntriesAsync()).Count,
                    RecentErrorsCount = await _backlogService.GetRecentErrorsCountAsync(),
                    
                    BacklogByStatus = new Dictionary<string, int>
                    {
                        ["Unassigned"] = (await _backlogService.GetBacklogByStatusAsync(RiskBacklogStatus.Unassigned)).Count,
                        ["AssignedToAnalyst"] = (await _backlogService.GetBacklogByStatusAsync(RiskBacklogStatus.AssignedToAnalyst)).Count,
                        ["AssignedToManager"] = (await _backlogService.GetBacklogByStatusAsync(RiskBacklogStatus.AssignedToManager)).Count,
                        ["Approved"] = (await _backlogService.GetBacklogByStatusAsync(RiskBacklogStatus.Approved)).Count,
                        ["Rejected"] = (await _backlogService.GetBacklogByStatusAsync(RiskBacklogStatus.Rejected)).Count,
                        ["Escalated"] = (await _backlogService.GetBacklogByStatusAsync(RiskBacklogStatus.Escalated)).Count
                    }
                };

                return View(model);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading system health");
                TempData["Error"] = "Error loading system health.";
                return RedirectToAction(nameof(Index));
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<IActionResult> TestBacklogCreation(int riskId)
        {
            try
            {
                var backlogEntry = await _backlogService.CreateBacklogEntryAsync(
                    riskId: riskId,
                    actionType: RiskBacklogAction.NewRisk,
                    description: "Admin test entry",
                    justification: "Testing backlog creation functionality",
                    requesterId: User.Identity?.Name ?? "Admin"
                );

                return Json(new { success = true, backlogNumber = backlogEntry.BacklogNumber, message = $"Created test backlog entry {backlogEntry.BacklogNumber}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating test backlog entry for risk {RiskId}", riskId);
                return Json(new { success = false, error = ex.Message });
            }
        }

        // Finding Creation Action
        [HttpPost]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> CreateFindingBacklogEntry([FromBody] CreateFindingRequest request)
        {
            try
            {
                var userId = User.Identity?.Name ?? "";
                var backlogEntry = await _backlogService.CreateFindingBacklogEntryAsync(
                    request.Title,
                    request.Details,
                    request.Source,
                    request.Impact,
                    request.Likelihood,
                    request.Exposure,
                    request.Asset,
                    request.BusinessUnit,
                    request.BusinessOwner,
                    request.Domain,
                    request.TechnicalControl,
                    userId
                );

                return Json(new { 
                    success = true, 
                    backlogNumber = backlogEntry.BacklogNumber, 
                    message = $"Finding backlog entry {backlogEntry.BacklogNumber} created successfully" 
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating finding backlog entry");
                return Json(new { success = false, error = ex.Message });
            }
        }

        // New Re-assignment Actions
        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireGRCManagerOrAdmin)]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ReassignToAnalyst(int backlogId, string analystId)
        {
            var userId = User.Identity?.Name ?? "Unknown";
            _logger.LogInformation("ReassignToAnalyst called: BacklogId={BacklogId}, AnalystId={AnalystId}, UserId={UserId}", 
                backlogId, analystId, userId);

            try
            {
                // Validate inputs
                if (backlogId <= 0)
                {
                    _logger.LogWarning("Invalid backlogId: {BacklogId}", backlogId);
                    TempData["Error"] = "Invalid backlog entry ID.";
                    return RedirectToAction(nameof(Index));
                }

                if (string.IsNullOrEmpty(analystId))
                {
                    _logger.LogWarning("Empty analystId provided for backlog {BacklogId}", backlogId);
                    TempData["Error"] = "Please select an analyst.";
                    return RedirectToAction(nameof(Index));
                }

                _logger.LogInformation("Fetching backlog entry {BacklogId}", backlogId);
                
                // Get the current backlog entry to check permissions
                var entry = await _backlogService.GetBacklogEntryByIdAsync(backlogId);
                if (entry == null)
                {
                    _logger.LogWarning("Backlog entry {BacklogId} not found", backlogId);
                    TempData["Error"] = "Backlog entry not found.";
                    return RedirectToAction(nameof(Index));
                }

                _logger.LogInformation("Found backlog entry {BacklogId}, current status: {Status}, current assignee: {Assignee}", 
                    backlogId, entry.Status, entry.GetCurrentAssignee());

                // Check if user can reassign
                var userRoles = string.Join(",", User.Claims.Where(c => c.Type == System.Security.Claims.ClaimTypes.Role).Select(c => c.Value));
                _logger.LogInformation("User {UserId} has roles: {Roles}", userId, userRoles);
                
                if (!User.IsInRole("Admin") && !User.IsInRole("GRCManager"))
                {
                    _logger.LogWarning("User {UserId} does not have permission to reassign entries", userId);
                    TempData["Error"] = "You do not have permission to reassign entries.";
                    return Forbid();
                }

                _logger.LogInformation("Starting reassignment of backlog {BacklogId} to analyst {AnalystId}", backlogId, analystId);

                // Perform reassignment
                await _backlogService.AssignToAnalystAsync(backlogId, analystId, userId);
                
                _logger.LogInformation("Successfully reassigned backlog {BacklogId} to analyst {AnalystId}", backlogId, analystId);
                TempData["Success"] = "Entry successfully reassigned to analyst.";
            }
            catch (ArgumentException argEx)
            {
                _logger.LogError(argEx, "Argument error reassigning backlog entry {BacklogId} to analyst {AnalystId}: {Message}", 
                    backlogId, analystId, argEx.Message);
                TempData["Error"] = $"Error reassigning entry: {argEx.Message}";
            }
            catch (InvalidOperationException invEx)
            {
                _logger.LogError(invEx, "Invalid operation error reassigning backlog entry {BacklogId} to analyst {AnalystId}: {Message}", 
                    backlogId, analystId, invEx.Message);
                TempData["Error"] = $"Error reassigning entry: {invEx.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error reassigning backlog entry {BacklogId} to analyst {AnalystId}: {Message} | StackTrace: {StackTrace}", 
                    backlogId, analystId, ex.Message, ex.StackTrace);
                TempData["Error"] = $"Error reassigning entry: {ex.Message}";
            }

            _logger.LogInformation("ReassignToAnalyst completed, redirecting to Index");
            return RedirectToAction(nameof(Index));
        }

        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireGRCManagerOrAdmin)]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UnassignEntry(int backlogId)
        {
            var userId = User.Identity?.Name ?? "Unknown";
            _logger.LogInformation("UnassignEntry called: BacklogId={BacklogId}, UserId={UserId}", backlogId, userId);

            try
            {
                // Validate inputs
                if (backlogId <= 0)
                {
                    _logger.LogWarning("Invalid backlogId: {BacklogId}", backlogId);
                    TempData["Error"] = "Invalid backlog entry ID.";
                    return RedirectToAction(nameof(Index));
                }

                _logger.LogInformation("Fetching backlog entry {BacklogId}", backlogId);
                
                // Get the current backlog entry to check permissions
                var entry = await _backlogService.GetBacklogEntryByIdAsync(backlogId);
                if (entry == null)
                {
                    _logger.LogWarning("Backlog entry {BacklogId} not found", backlogId);
                    TempData["Error"] = "Backlog entry not found.";
                    return RedirectToAction(nameof(Index));
                }

                _logger.LogInformation("Found backlog entry {BacklogId}, current status: {Status}, current assignee: {Assignee}", 
                    backlogId, entry.Status, entry.GetCurrentAssignee());

                // Check if user can unassign
                var userRoles = string.Join(",", User.Claims.Where(c => c.Type == System.Security.Claims.ClaimTypes.Role).Select(c => c.Value));
                _logger.LogInformation("User {UserId} has roles: {Roles}", userId, userRoles);
                
                if (!User.IsInRole("Admin") && !User.IsInRole("GRCManager"))
                {
                    _logger.LogWarning("User {UserId} does not have permission to unassign entries", userId);
                    TempData["Error"] = "You do not have permission to unassign entries.";
                    return Forbid();
                }

                _logger.LogInformation("Starting unassignment of backlog {BacklogId}", backlogId);

                // Perform unassignment - set back to unassigned status
                await _backlogService.UnassignEntryAsync(backlogId, userId);
                
                _logger.LogInformation("Successfully unassigned backlog {BacklogId}", backlogId);
                TempData["Success"] = "Entry unassigned and returned to backlog.";
            }
            catch (ArgumentException argEx)
            {
                _logger.LogError(argEx, "Argument error unassigning backlog entry {BacklogId}: {Message}", 
                    backlogId, argEx.Message);
                TempData["Error"] = $"Error unassigning entry: {argEx.Message}";
            }
            catch (InvalidOperationException invEx)
            {
                _logger.LogError(invEx, "Invalid operation error unassigning backlog entry {BacklogId}: {Message}", 
                    backlogId, invEx.Message);
                TempData["Error"] = $"Error unassigning entry: {invEx.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error unassigning backlog entry {BacklogId}: {Message} | StackTrace: {StackTrace}", 
                    backlogId, ex.Message, ex.StackTrace);
                TempData["Error"] = $"Error unassigning entry: {ex.Message}";
            }

            _logger.LogInformation("UnassignEntry completed, redirecting to Index");
            return RedirectToAction(nameof(Index));
        }

        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireGRCManagerOrAdmin)]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateStatus(int backlogId, string status, string reason = "")
        {
            var userId = User.Identity?.Name ?? "Unknown";
            _logger.LogInformation("UpdateStatus called: BacklogId={BacklogId}, Status={Status}, Reason={Reason}, UserId={UserId}", 
                backlogId, status, reason, userId);

            try
            {
                // Validate inputs
                if (backlogId <= 0)
                {
                    _logger.LogWarning("Invalid backlogId: {BacklogId}", backlogId);
                    TempData["Error"] = "Invalid backlog entry ID.";
                    return RedirectToAction(nameof(Index));
                }

                if (string.IsNullOrEmpty(status))
                {
                    _logger.LogWarning("Empty status provided for backlog {BacklogId}", backlogId);
                    TempData["Error"] = "Please select a status.";
                    return RedirectToAction(nameof(Index));
                }

                _logger.LogInformation("Fetching backlog entry {BacklogId}", backlogId);
                
                // Get the current backlog entry to check permissions
                var entry = await _backlogService.GetBacklogEntryByIdAsync(backlogId);
                if (entry == null)
                {
                    _logger.LogWarning("Backlog entry {BacklogId} not found", backlogId);
                    TempData["Error"] = "Backlog entry not found.";
                    return RedirectToAction(nameof(Index));
                }

                _logger.LogInformation("Found backlog entry {BacklogId}, current status: {CurrentStatus}, target status: {TargetStatus}", 
                    backlogId, entry.Status, status);

                // Check if user can update status
                var userRoles = string.Join(",", User.Claims.Where(c => c.Type == System.Security.Claims.ClaimTypes.Role).Select(c => c.Value));
                _logger.LogInformation("User {UserId} has roles: {Roles}", userId, userRoles);
                
                if (!User.IsInRole("Admin") && !User.IsInRole("GRCManager"))
                {
                    _logger.LogWarning("User {UserId} does not have permission to update entry status", userId);
                    TempData["Error"] = "You do not have permission to update entry status.";
                    return Forbid();
                }

                _logger.LogInformation("Parsing status value: {Status}", status);

                // Parse and update status
                if (Enum.TryParse<RiskBacklogStatus>(status, out var statusEnum))
                {
                    _logger.LogInformation("Successfully parsed status to enum: {StatusEnum}", statusEnum);
                    
                    if (statusEnum == RiskBacklogStatus.Approved)
                    {
                        _logger.LogInformation("Approving backlog {BacklogId} with reason: {Reason}", backlogId, reason);
                        await _backlogService.ManagerApproveAsync(backlogId, reason, userId);
                        _logger.LogInformation("Successfully approved backlog {BacklogId}", backlogId);
                        TempData["Success"] = "Entry approved.";
                    }
                    else if (statusEnum == RiskBacklogStatus.Rejected)
                    {
                        _logger.LogInformation("Rejecting backlog {BacklogId} with reason: {Reason}", backlogId, reason);
                        await _backlogService.ManagerRejectAsync(backlogId, reason, userId);
                        _logger.LogInformation("Successfully rejected backlog {BacklogId}", backlogId);
                        TempData["Success"] = "Entry rejected.";
                    }
                    else
                    {
                        _logger.LogWarning("Invalid status update requested: {StatusEnum} for backlog {BacklogId}", statusEnum, backlogId);
                        TempData["Error"] = "Invalid status update.";
                    }
                }
                else
                {
                    _logger.LogWarning("Failed to parse status value: {Status} for backlog {BacklogId}", status, backlogId);
                    TempData["Error"] = "Invalid status value.";
                }
            }
            catch (ArgumentException argEx)
            {
                _logger.LogError(argEx, "Argument error updating status for backlog entry {BacklogId} to {Status}: {Message}", 
                    backlogId, status, argEx.Message);
                TempData["Error"] = $"Error updating entry status: {argEx.Message}";
            }
            catch (InvalidOperationException invEx)
            {
                _logger.LogError(invEx, "Invalid operation error updating status for backlog entry {BacklogId} to {Status}: {Message}", 
                    backlogId, status, invEx.Message);
                TempData["Error"] = $"Error updating entry status: {invEx.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error updating status for backlog entry {BacklogId} to {Status}: {Message} | StackTrace: {StackTrace}", 
                    backlogId, status, ex.Message, ex.StackTrace);
                TempData["Error"] = $"Error updating entry status: {ex.Message}";
            }

            _logger.LogInformation("UpdateStatus completed, redirecting to Index");
            return RedirectToAction(nameof(Index));
        }
    }

    // Request models for API endpoints
    public class BulkAssignRequest
    {
        public List<int> BacklogIds { get; set; } = new();
        public string AssigneeId { get; set; } = string.Empty;
    }

    public class BulkApproveRequest
    {
        public List<int> BacklogIds { get; set; } = new();
        public string Comments { get; set; } = string.Empty;
    }

    public class BulkPriorityRequest
    {
        public List<int> BacklogIds { get; set; } = new();
        public BacklogPriority Priority { get; set; }
    }

    public class CreateFindingRequest
    {
        public string Title { get; set; } = string.Empty;
        public string Details { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty;
        public ImpactLevel Impact { get; set; }
        public LikelihoodLevel Likelihood { get; set; }
        public ExposureLevel Exposure { get; set; }
        public string Asset { get; set; } = string.Empty;
        public string BusinessUnit { get; set; } = string.Empty;
        public string BusinessOwner { get; set; } = string.Empty;
        public string Domain { get; set; } = string.Empty;
        public string TechnicalControl { get; set; } = string.Empty;
    }

    // API endpoints for enhanced SLA tracking
    public partial class RiskBacklogController
    {
        // API endpoint for SLA Status Breakdown
        [HttpGet]
        [Route("RiskBacklog/GetSLAStatusBreakdown")]
        public async Task<IActionResult> GetSLAStatusBreakdown()
        {
            try
            {
                var breakdown = await _backlogService.GetSLAStatusBreakdownAsync();
                return Json(new { success = true, breakdown = breakdown });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting SLA status breakdown");
                return Json(new { success = false, error = "Failed to load SLA status breakdown" });
            }
        }

        // API endpoint for escalation candidates count
        [HttpGet]
        [Route("RiskBacklog/GetEscalationCandidatesCount")]
        public async Task<IActionResult> GetEscalationCandidatesCount()
        {
            try
            {
                var count = await _backlogService.GetEscalationCandidatesCountAsync();
                return Json(new { success = true, count = count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting escalation candidates count");
                return Json(new { success = false, error = "Failed to get escalation count" });
            }
        }

        // API endpoint for entries requiring escalation
        [HttpGet]
        [Route("RiskBacklog/GetEntriesRequiringEscalation")]
        public async Task<IActionResult> GetEntriesRequiringEscalation()
        {
            try
            {
                var entries = await _backlogService.GetEntriesRequiringEscalationAsync();
                var result = entries.Select(e => new
                {
                    id = e.Id,
                    backlogNumber = e.BacklogNumber,
                    priority = e.Priority.ToString(),
                    actionType = e.ActionType.ToString(),
                    daysOld = e.GetDaysOld(),
                    daysOverdue = e.GetDaysOverdue(),
                    escalationReason = e.GetEscalationReason(),
                    slaStatus = e.GetSLAStatus()
                }).ToList();

                return Json(new { success = true, entries = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting entries requiring escalation");
                return Json(new { success = false, error = "Failed to get escalation entries" });
            }
        }

        // Risk Assessment Approval Actions
        [HttpPost]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> ApproveRiskAssessment(int entryId)
        {
            try
            {
                var userId = User.Identity?.Name ?? "";
                var userRoles = string.Join(",", User.Claims.Where(c => c.Type == "role" || c.Type == System.Security.Claims.ClaimTypes.Role).Select(c => c.Value));

                // Check permissions
                if (!await _backlogService.CanUserApproveBacklogEntryAsync(entryId, userId, userRoles))
                {
                    return Json(new { success = false, error = "You do not have permission to approve this entry." });
                }

                // Get the entry to validate it's a risk assessment review
                var entry = await _backlogService.GetBacklogEntryByIdAsync(entryId);
                if (entry == null)
                {
                    return Json(new { success = false, error = "Entry not found." });
                }

                if (entry.ActionType != RiskBacklogAction.RiskReassessment)
                {
                    return Json(new { success = false, error = "This entry is not a risk reassessment." });
                }

                // Approve the risk assessment
                await _backlogService.ManagerApproveAsync(entryId, "Risk assessment approved", userId);
                
                return Json(new { success = true, message = "Risk assessment approved successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error approving risk assessment for entry {EntryId}", entryId);
                return Json(new { success = false, error = "Error approving risk assessment." });
            }
        }

        [HttpPost]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> ApproveAndAddToRegister(int entryId)
        {
            try
            {
                var userId = User.Identity?.Name ?? "";
                var userRoles = string.Join(",", User.Claims.Where(c => c.Type == "role" || c.Type == System.Security.Claims.ClaimTypes.Role).Select(c => c.Value));

                // Check permissions
                if (!await _backlogService.CanUserApproveBacklogEntryAsync(entryId, userId, userRoles))
                {
                    return Json(new { success = false, error = "You do not have permission to approve this entry." });
                }

                // Get the entry to validate it's a risk review
                var entry = await _backlogService.GetBacklogEntryByIdAsync(entryId);
                if (entry == null)
                {
                    return Json(new { success = false, error = "Entry not found." });
                }

                if (entry.ActionType != RiskBacklogAction.RiskReview)
                {
                    return Json(new { success = false, error = "This entry is not a risk review." });
                }

                // Approve and add to risk register
                await _backlogService.ManagerApproveAsync(entryId, "Risk approved and added to register", userId);
                
                return Json(new { success = true, message = "Risk approved and added to register successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error approving and adding risk to register for entry {EntryId}", entryId);
                return Json(new { success = false, error = "Error approving and adding risk to register." });
            }
        }

        [HttpPost]
        [Authorize(Policy = "RequireGRCAnalystOrAbove")]
        public async Task<IActionResult> RejectEntry(int entryId, string reason)
        {
            try
            {
                var userId = User.Identity?.Name ?? "";
                var userRoles = string.Join(",", User.Claims.Where(c => c.Type == "role" || c.Type == System.Security.Claims.ClaimTypes.Role).Select(c => c.Value));

                // Check permissions
                if (!await _backlogService.CanUserApproveBacklogEntryAsync(entryId, userId, userRoles))
                {
                    return Json(new { success = false, error = "You do not have permission to reject this entry." });
                }

                if (string.IsNullOrWhiteSpace(reason))
                {
                    return Json(new { success = false, error = "Rejection reason is required." });
                }

                // Reject the entry
                await _backlogService.ManagerRejectAsync(entryId, reason, userId);
                
                return Json(new { success = true, message = "Entry rejected successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error rejecting entry {EntryId} with reason: {Reason}", entryId, reason);
                return Json(new { success = false, error = "Error rejecting entry." });
            }
        }

        // TEMPORARY: Clear all backlog entries for fresh start
        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> ClearAllEntries()
        {
            try
            {
                await _backlogService.ClearAllBacklogEntriesAsync();
                TempData["Success"] = "All backlog entries have been cleared successfully.";
                return RedirectToAction(nameof(Index));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error clearing all backlog entries");
                TempData["Error"] = "Error clearing backlog entries.";
                return RedirectToAction(nameof(Index));
            }
        }
    }
}