using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Data;
using CyberRiskApp.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Identity;

namespace CyberRiskApp.Controllers
{
    public class FindingClosureController : Controller
    {
        private readonly CyberRiskContext _context;
        private readonly UserManager<User> _userManager;

        public FindingClosureController(CyberRiskContext context, UserManager<User> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        // GET: FindingClosure - All users can view closure requests
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Index()
        {
            var requests = await _context.FindingClosureRequests
                .Include(r => r.LinkedFinding)
                .Include(r => r.AssignedToUser)
                .Include(r => r.AssignedByUser)
                .OrderByDescending(r => r.RequestDate)
                .ToListAsync();

            return View(requests);
        }

        // GET: FindingClosure/Create - All users can create closure requests
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Create(int? findingId = null)
        {
            try
            {
                var openFindings = await _context.Findings
                    .Where(f => f.Status == FindingStatus.Open)
                    .OrderBy(f => f.FindingNumber)
                    .ToListAsync();

                Console.WriteLine($"Found {openFindings.Count} open findings");

                ViewBag.FindingId = new SelectList(
                    openFindings.Select(f => new {
                        Value = f.Id,
                        Text = $"{f.FindingNumber} - {f.Title}"
                    }),
                    "Value",
                    "Text",
                    findingId);

                var model = new FindingClosureRequest();
                if (findingId.HasValue)
                {
                    model.FindingId = findingId.Value;
                }

                return View(model);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in Create GET: {ex.Message}");
                return View(new FindingClosureRequest());
            }
        }

        // POST: FindingClosure/Create - All users can submit closure requests
        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(FindingClosureRequest request)
        {
            try
            {
                Console.WriteLine("=== Closure Request Submission ===");
                Console.WriteLine($"FindingId: {request.FindingId}");
                Console.WriteLine($"Justification: {request.ClosureJustification}");
                Console.WriteLine($"ModelState.IsValid: {ModelState.IsValid}");

                if (!ModelState.IsValid)
                {
                    Console.WriteLine("Model validation errors:");
                    foreach (var error in ModelState)
                    {
                        if (error.Value.Errors.Count > 0)
                        {
                            Console.WriteLine($"  {error.Key}: {string.Join(", ", error.Value.Errors.Select(e => e.ErrorMessage))}");
                        }
                    }
                }

                if (ModelState.IsValid)
                {
                    var currentUser = await _userManager.GetUserAsync(User);
                    request.Requester = currentUser?.FullName ?? User.Identity?.Name ?? "Current User";
                    request.RequestDate = DateTime.Today;
                    request.Status = RequestStatus.Pending;

                    Console.WriteLine($"Saving request - Requester: {request.Requester}, Date: {request.RequestDate}");

                    _context.FindingClosureRequests.Add(request);
                    await _context.SaveChangesAsync();

                    Console.WriteLine("Request saved successfully!");

                    TempData["Success"] = "Closure request submitted successfully.";
                    return RedirectToAction(nameof(Index));
                }

                // Reload the dropdown for the view
                var openFindings = await _context.Findings
                    .Where(f => f.Status == FindingStatus.Open)
                    .OrderBy(f => f.FindingNumber)
                    .ToListAsync();

                ViewBag.FindingId = new SelectList(
                    openFindings.Select(f => new
                    {
                        Value = f.Id,
                        Text = $"{f.FindingNumber} - {f.Title}"
                    }),
                    "Value",
                    "Text",
                    request.FindingId);

                return View(request);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in Create POST: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");

                ModelState.AddModelError("", $"An error occurred: {ex.Message}");

                // Reload dropdown
                var openFindings = await _context.Findings
                    .Where(f => f.Status == FindingStatus.Open)
                    .ToListAsync();

                ViewBag.FindingId = new SelectList(
                    openFindings.Select(f => new
                    {
                        Value = f.Id,
                        Text = $"{f.FindingNumber} - {f.Title}"
                    }),
                    "Value",
                    "Text");

                return View(request);
            }
        }

        // GET: FindingClosure/Details/5 - All users can view details
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Details(int id)
        {
            var request = await _context.FindingClosureRequests
                .Include(r => r.LinkedFinding)
                .Include(r => r.AssignedToUser)
                .Include(r => r.AssignedByUser)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
                return NotFound();

            return View(request);
        }

        // GET: FindingClosure/Review/5 - Only GRC and Admin can review
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Review(int id)
        {
            var request = await _context.FindingClosureRequests
                .Include(r => r.LinkedFinding)
                .Include(r => r.AssignedToUser)
                .Include(r => r.AssignedByUser)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
                return NotFound();

            // Allow review of both old Pending status and new PendingApproval status
            if (request.Status != RequestStatus.Pending && request.Status != RequestStatus.PendingApproval)
            {
                TempData["Error"] = "Only pending requests can be reviewed.";
                return RedirectToAction(nameof(Details), new { id });
            }

            return View(request);
        }

        // GET: FindingClosure/Complete/5 - Complete assigned finding closure request
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Complete(int id)
        {
            var request = await _context.FindingClosureRequests
                .Include(r => r.LinkedFinding)
                .Include(r => r.AssignedToUser)
                .Include(r => r.AssignedByUser)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
                return NotFound();

            // Check if request is assigned and in progress, or if user is admin (can override)
            var currentUser = await _userManager.GetUserAsync(User);
            var currentUserId = currentUser?.Id ?? "Unknown";
            var isAdmin = User.IsInRole("Admin");
            
            if (request.Status != RequestStatus.InProgress && !isAdmin)
            {
                TempData["Error"] = "Only in-progress requests can be completed.";
                return RedirectToAction(nameof(Details), new { id });
            }

            if (!isAdmin && request.AssignedToUserId != currentUserId)
            {
                TempData["Error"] = "You can only complete requests assigned to you.";
                return RedirectToAction(nameof(Details), new { id });
            }

            return View(request);
        }

        // POST: FindingClosure/Complete/5 - Complete assigned finding closure request
        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CompleteConfirmed(int id, string reviewComments = "")
        {
            try
            {
                var request = await _context.FindingClosureRequests
                    .Include(r => r.LinkedFinding)
                    .FirstOrDefaultAsync(r => r.Id == id);

                if (request == null)
                    return NotFound();

                var currentUser = await _userManager.GetUserAsync(User);
                var currentUserId = currentUser?.Id ?? "Unknown";
                var currentUserName = User?.Identity?.Name ?? "Unknown";
                var isAdmin = User.IsInRole("Admin");

                // Admin override or assigned user completing
                if (!isAdmin && request.AssignedToUserId != currentUserId)
                {
                    TempData["Error"] = "You can only complete requests assigned to you.";
                    return RedirectToAction(nameof(Details), new { id });
                }

                // Update the closure request
                request.Status = RequestStatus.Completed;
                request.ReviewedBy = currentUser?.FullName ?? currentUserName;
                request.ReviewDate = DateTime.UtcNow;
                request.CompletedDate = DateTime.UtcNow;
                request.ReviewComments = reviewComments;
                request.UpdatedAt = DateTime.UtcNow;

                // Close the finding
                if (request.LinkedFinding != null)
                {
                    request.LinkedFinding.Status = FindingStatus.Closed;
                    request.LinkedFinding.UpdatedAt = DateTime.UtcNow;
                    request.LinkedFinding.UpdatedBy = currentUserName;
                }

                await _context.SaveChangesAsync();

                var message = isAdmin 
                    ? $"Finding closure request completed using admin override. Finding {request.LinkedFinding?.FindingNumber} has been closed."
                    : $"Finding closure request completed. Finding {request.LinkedFinding?.FindingNumber} has been closed.";

                TempData["Success"] = message;
                return RedirectToAction(nameof(Index));
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"An error occurred while completing the request: {ex.Message}";
                return RedirectToAction(nameof(Details), new { id });
            }
        }

        // POST: FindingClosure/Approve/5 - Only GRC and Admin can approve (legacy workflow)
        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Approve(int id, string reviewComments = "")
        {
            try
            {
                var request = await _context.FindingClosureRequests
                    .Include(r => r.LinkedFinding)
                    .FirstOrDefaultAsync(r => r.Id == id);

                if (request == null)
                    return NotFound();

                // Handle both old and new workflow statuses
                if (request.Status != RequestStatus.Pending && request.Status != RequestStatus.PendingApproval)
                {
                    TempData["Error"] = "Only pending requests can be approved.";
                    return RedirectToAction(nameof(Details), new { id });
                }

                // Update the closure request
                request.Status = RequestStatus.Approved;
                var currentUser = await _userManager.GetUserAsync(User);
                request.ReviewedBy = currentUser?.FullName ?? User.Identity?.Name ?? "Current User";
                request.ReviewDate = DateTime.UtcNow;
                request.ReviewComments = reviewComments;
                request.UpdatedAt = DateTime.UtcNow;

                // Close the finding
                if (request.LinkedFinding != null)
                {
                    request.LinkedFinding.Status = FindingStatus.Closed;
                    request.LinkedFinding.UpdatedAt = DateTime.UtcNow;
                    request.LinkedFinding.UpdatedBy = User.Identity?.Name ?? "Current User";
                }

                await _context.SaveChangesAsync();

                TempData["Success"] = $"Closure request approved and finding {request.LinkedFinding?.FindingNumber} has been closed.";
                return RedirectToAction(nameof(Index));
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"An error occurred while approving the request: {ex.Message}";
                return RedirectToAction(nameof(Details), new { id });
            }
        }

        // POST: FindingClosure/Reject/5 - Only GRC and Admin can reject
        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Reject(int id, string reviewComments = "")
        {
            try
            {
                var request = await _context.FindingClosureRequests
                    .FirstOrDefaultAsync(r => r.Id == id);

                if (request == null)
                    return NotFound();

                // Handle both old and new workflow statuses  
                if (request.Status != RequestStatus.Pending && request.Status != RequestStatus.PendingApproval)
                {
                    TempData["Error"] = "Only pending requests can be rejected.";
                    return RedirectToAction(nameof(Details), new { id });
                }

                request.Status = RequestStatus.Rejected;
                var currentUser = await _userManager.GetUserAsync(User);
                request.ReviewedBy = currentUser?.FullName ?? User.Identity?.Name ?? "Current User";
                request.ReviewDate = DateTime.UtcNow;
                request.ReviewComments = reviewComments;

                await _context.SaveChangesAsync();

                TempData["Success"] = "Closure request has been rejected.";
                return RedirectToAction(nameof(Index));
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"An error occurred while rejecting the request: {ex.Message}";
                return RedirectToAction(nameof(Details), new { id });
            }
        }
    }
}