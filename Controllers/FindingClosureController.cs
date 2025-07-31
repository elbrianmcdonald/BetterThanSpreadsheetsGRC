using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Data;
using CyberRiskApp.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace CyberRiskApp.Controllers
{
    public class FindingClosureController : Controller
    {
        private readonly CyberRiskContext _context;

        public FindingClosureController(CyberRiskContext context)
        {
            _context = context;
        }

        // GET: FindingClosure - All users can view closure requests
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Index()
        {
            var requests = await _context.FindingClosureRequests
                .Include(r => r.LinkedFinding)
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
                    request.Requester = User.Identity?.Name ?? "Current User";
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
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
                return NotFound();

            return View(request);
        }

        // GET: FindingClosure/Review/5 - Only GRC and Admin can review
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Review(int id)
        {
            var request = await _context.FindingClosureRequests
                .Include(r => r.LinkedFinding)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
                return NotFound();

            if (request.Status != RequestStatus.Pending)
            {
                TempData["Error"] = "Only pending requests can be reviewed.";
                return RedirectToAction(nameof(Details), new { id });
            }

            return View(request);
        }

        // POST: FindingClosure/Approve/5 - Only GRC and Admin can approve
        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
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

                if (request.Status != RequestStatus.Pending)
                {
                    TempData["Error"] = "Only pending requests can be approved.";
                    return RedirectToAction(nameof(Details), new { id });
                }

                // Update the closure request
                request.Status = RequestStatus.Approved;
                request.ReviewedBy = User.Identity?.Name ?? "Current User";
                request.ReviewDate = DateTime.Today;
                request.ReviewComments = reviewComments;

                // Close the finding
                if (request.LinkedFinding != null)
                {
                    request.LinkedFinding.Status = FindingStatus.Closed;
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
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Reject(int id, string reviewComments = "")
        {
            try
            {
                var request = await _context.FindingClosureRequests
                    .FirstOrDefaultAsync(r => r.Id == id);

                if (request == null)
                    return NotFound();

                if (request.Status != RequestStatus.Pending)
                {
                    TempData["Error"] = "Only pending requests can be rejected.";
                    return RedirectToAction(nameof(Details), new { id });
                }

                request.Status = RequestStatus.Rejected;
                request.ReviewedBy = User.Identity?.Name ?? "Current User";
                request.ReviewDate = DateTime.Today;
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