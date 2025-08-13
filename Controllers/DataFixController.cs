using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CyberRiskApp.Data;
using CyberRiskApp.Models;
using CyberRiskApp.Authorization;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireAdminRole)]
    public class DataFixController : Controller
    {
        private readonly CyberRiskContext _context;
        private readonly ILogger<DataFixController> _logger;

        public DataFixController(CyberRiskContext context, ILogger<DataFixController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: DataFix
        public IActionResult Index()
        {
            return View();
        }

        // POST: DataFix/FixFindingClosureRequests
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> FixFindingClosureRequests()
        {
            try
            {
                var results = new List<string>();

                // 1. Find problematic requests
                var problematicRequests = await _context.FindingClosureRequests
                    .Where(fcr => (fcr.Status == RequestStatus.InProgress || fcr.Status == RequestStatus.Completed) 
                                  && fcr.AssignedToUserId == null)
                    .ToListAsync();

                results.Add($"Found {problematicRequests.Count} problematic finding closure requests");

                // 2. Reset them to pending status
                foreach (var request in problematicRequests)
                {
                    request.Status = RequestStatus.PendingApproval;
                    request.AssignedToUserId = null;
                    request.AssignedByUserId = null;
                    request.AssignmentDate = null;
                    request.StartedDate = null;
                    request.UpdatedAt = DateTime.UtcNow;

                    _logger.LogInformation($"Reset finding closure request {request.Id} to pending status");
                }

                // 3. Fix missing timestamps
                var requestsWithoutTimestamps = await _context.FindingClosureRequests
                    .Where(fcr => fcr.CreatedAt == default || fcr.UpdatedAt == default)
                    .ToListAsync();

                foreach (var request in requestsWithoutTimestamps)
                {
                    if (request.CreatedAt == default)
                        request.CreatedAt = request.RequestDate;
                    if (request.UpdatedAt == default)
                        request.UpdatedAt = request.RequestDate;
                }

                results.Add($"Fixed timestamps for {requestsWithoutTimestamps.Count} requests");

                // 4. Check for orphaned requests
                var orphanedRequests = await _context.FindingClosureRequests
                    .Include(fcr => fcr.LinkedFinding)
                    .Where(fcr => fcr.LinkedFinding == null)
                    .ToListAsync();

                results.Add($"Found {orphanedRequests.Count} orphaned requests (linked to non-existent findings)");

                // 5. Save all changes
                var changeCount = await _context.SaveChangesAsync();
                results.Add($"Saved {changeCount} changes to the database");

                // 6. Generate summary
                var summary = await GetFindingClosureRequestSummary();
                results.AddRange(summary);

                TempData["Success"] = string.Join("<br/>", results);
                return RedirectToAction("Index");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fixing finding closure requests");
                TempData["Error"] = $"Error fixing requests: {ex.Message}";
                return RedirectToAction("Index");
            }
        }

        // POST: DataFix/FixRiskAcceptanceRequests  
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> FixRiskAcceptanceRequests()
        {
            try
            {
                var results = new List<string>();

                // Similar fixes for Risk Acceptance Requests
                var problematicRequests = await _context.RiskAcceptanceRequests
                    .Where(rar => (rar.Status == RequestStatus.InProgress || rar.Status == RequestStatus.Completed)
                                  && rar.AssignedToUserId == null)
                    .ToListAsync();

                results.Add($"Found {problematicRequests.Count} problematic risk acceptance requests");

                foreach (var request in problematicRequests)
                {
                    request.Status = RequestStatus.PendingApproval;
                    request.AssignedToUserId = null;
                    request.AssignedByUserId = null;
                    request.AssignmentDate = null;
                    request.UpdatedAt = DateTime.UtcNow;
                }

                var changeCount = await _context.SaveChangesAsync();
                results.Add($"Fixed {changeCount} risk acceptance requests");

                TempData["Success"] = string.Join("<br/>", results);
                return RedirectToAction("Index");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fixing risk acceptance requests");
                TempData["Error"] = $"Error fixing requests: {ex.Message}";
                return RedirectToAction("Index");
            }
        }

        // POST: DataFix/FixAssessmentRequests
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> FixAssessmentRequests()
        {
            try
            {
                var results = new List<string>();

                var problematicRequests = await _context.AssessmentRequests
                    .Where(ar => (ar.Status == RequestStatus.InProgress || ar.Status == RequestStatus.Completed)
                                 && ar.AssignedToUserId == null)
                    .ToListAsync();

                results.Add($"Found {problematicRequests.Count} problematic assessment requests");

                foreach (var request in problematicRequests)
                {
                    request.Status = RequestStatus.Pending;
                    request.AssignedToUserId = null;
                    request.AssignedByUserId = null;
                    request.AssignmentDate = null;
                    request.StartedDate = null;
                    request.UpdatedAt = DateTime.UtcNow;
                }

                var changeCount = await _context.SaveChangesAsync();
                results.Add($"Fixed {changeCount} assessment requests");

                TempData["Success"] = string.Join("<br/>", results);
                return RedirectToAction("Index");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fixing assessment requests");
                TempData["Error"] = $"Error fixing requests: {ex.Message}";
                return RedirectToAction("Index");
            }
        }

        // GET: DataFix/CheckRequestStatus
        public async Task<IActionResult> CheckRequestStatus()
        {
            var results = new
            {
                FindingClosureRequests = await GetFindingClosureRequestSummary(),
                RiskAcceptanceRequests = await GetRiskAcceptanceRequestSummary(),
                AssessmentRequests = await GetAssessmentRequestSummary()
            };

            return Json(results);
        }

        private async Task<List<string>> GetFindingClosureRequestSummary()
        {
            var summary = new List<string>();

            var total = await _context.FindingClosureRequests.CountAsync();
            var pending = await _context.FindingClosureRequests.CountAsync(fcr => fcr.Status == RequestStatus.PendingApproval);
            var inProgress = await _context.FindingClosureRequests.CountAsync(fcr => fcr.Status == RequestStatus.InProgress && fcr.AssignedToUserId != null);
            var completed = await _context.FindingClosureRequests.CountAsync(fcr => fcr.Status == RequestStatus.Completed);
            var problematic = await _context.FindingClosureRequests.CountAsync(fcr => fcr.Status == RequestStatus.InProgress && fcr.AssignedToUserId == null);

            summary.Add($"Finding Closure Requests Summary:");
            summary.Add($"  - Total: {total}");
            summary.Add($"  - Pending: {pending}");
            summary.Add($"  - In Progress (Assigned): {inProgress}");
            summary.Add($"  - Completed: {completed}");
            summary.Add($"  - Problematic (In Progress but Unassigned): {problematic}");

            return summary;
        }

        private async Task<List<string>> GetRiskAcceptanceRequestSummary()
        {
            var summary = new List<string>();

            var total = await _context.RiskAcceptanceRequests.CountAsync();
            var pending = await _context.RiskAcceptanceRequests.CountAsync(rar => rar.Status == RequestStatus.PendingApproval);
            var inProgress = await _context.RiskAcceptanceRequests.CountAsync(rar => rar.Status == RequestStatus.InProgress && rar.AssignedToUserId != null);
            var completed = await _context.RiskAcceptanceRequests.CountAsync(rar => rar.Status == RequestStatus.Completed);
            var problematic = await _context.RiskAcceptanceRequests.CountAsync(rar => rar.Status == RequestStatus.InProgress && rar.AssignedToUserId == null);

            summary.Add($"Risk Acceptance Requests Summary:");
            summary.Add($"  - Total: {total}");
            summary.Add($"  - Pending: {pending}");
            summary.Add($"  - In Progress (Assigned): {inProgress}");
            summary.Add($"  - Completed: {completed}");
            summary.Add($"  - Problematic: {problematic}");

            return summary;
        }

        private async Task<List<string>> GetAssessmentRequestSummary()
        {
            var summary = new List<string>();

            var total = await _context.AssessmentRequests.CountAsync();
            var pending = await _context.AssessmentRequests.CountAsync(ar => ar.Status == RequestStatus.Pending);
            var inProgress = await _context.AssessmentRequests.CountAsync(ar => ar.Status == RequestStatus.InProgress && ar.AssignedToUserId != null);
            var completed = await _context.AssessmentRequests.CountAsync(ar => ar.Status == RequestStatus.Completed);
            var problematic = await _context.AssessmentRequests.CountAsync(ar => ar.Status == RequestStatus.InProgress && ar.AssignedToUserId == null);

            summary.Add($"Assessment Requests Summary:");
            summary.Add($"  - Total: {total}");
            summary.Add($"  - Pending: {pending}");
            summary.Add($"  - In Progress (Assigned): {inProgress}");
            summary.Add($"  - Completed: {completed}");
            summary.Add($"  - Problematic: {problematic}");

            return summary;
        }
    }
}