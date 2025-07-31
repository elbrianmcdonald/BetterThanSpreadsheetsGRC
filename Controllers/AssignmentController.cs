using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.Authorization;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireAdminRole)]
    public class AssignmentController : Controller
    {
        private readonly IRequestService _requestService;

        public AssignmentController(IRequestService requestService)
        {
            _requestService = requestService;
        }

        // GET: Assignment
        public async Task<IActionResult> Index()
        {
            var unassignedAssessmentRequests = await _requestService.GetUnassignedAssessmentRequestsAsync();
            var unassignedAcceptanceRequests = await _requestService.GetUnassignedAcceptanceRequestsAsync();
            var unassignedClosureRequests = await _requestService.GetUnassignedClosureRequestsAsync();
            var allUsers = await _requestService.GetGRCUsersAsync();

            ViewBag.UnassignedAssessmentRequests = unassignedAssessmentRequests;
            ViewBag.UnassignedAcceptanceRequests = unassignedAcceptanceRequests;
            ViewBag.UnassignedClosureRequests = unassignedClosureRequests;
            ViewBag.GRCUsers = allUsers;

            return View();
        }

        // GET: Assignment/Assign/5
        public async Task<IActionResult> Assign(int id)
        {
            var request = await _requestService.GetAssessmentRequestByIdAsync(id);
            if (request == null)
                return NotFound();

            var users = await _requestService.GetGRCUsersAsync();
            ViewBag.Users = new SelectList(users, "Id", "FullName");

            return View(request);
        }

        // POST: Assignment/Assign/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Assign(int id, string assignedToUserId, string? notes, decimal? estimatedHours)
        {
            try
            {
                var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(currentUserId))
                {
                    TempData["Error"] = "Unable to identify current user.";
                    return RedirectToAction("Index");
                }

                await _requestService.AssignAssessmentRequestAsync(id, assignedToUserId, currentUserId, notes, estimatedHours);

                TempData["Success"] = "Request assigned successfully.";
                return RedirectToAction("Index");
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error assigning request: {ex.Message}";
                return RedirectToAction("Assign", new { id });
            }
        }

        // GET: Assignment/AssignAcceptance/5
        public async Task<IActionResult> AssignAcceptance(int id)
        {
            var request = await _requestService.GetAcceptanceRequestByIdAsync(id);
            if (request == null)
                return NotFound();

            var users = await _requestService.GetGRCUsersAsync();
            ViewBag.Users = new SelectList(users, "Id", "FullName");

            return View(request);
        }

        // POST: Assignment/AssignAcceptance/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> AssignAcceptance(int id, string assignedToUserId, string? notes)
        {
            try
            {
                var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(currentUserId))
                {
                    TempData["Error"] = "Unable to identify current user.";
                    return RedirectToAction("Index");
                }

                await _requestService.AssignAcceptanceRequestAsync(id, assignedToUserId, currentUserId, notes);

                TempData["Success"] = "Risk acceptance request assigned successfully.";
                return RedirectToAction("Index");
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error assigning request: {ex.Message}";
                return RedirectToAction("AssignAcceptance", new { id });
            }
        }

        // GET: Assignment/AssignClosure/5
        public async Task<IActionResult> AssignClosure(int id)
        {
            var request = await _requestService.GetClosureRequestByIdAsync(id);
            if (request == null)
                return NotFound();

            var users = await _requestService.GetGRCUsersAsync();
            ViewBag.Users = new SelectList(users, "Id", "FullName");

            return View(request);
        }

        // POST: Assignment/AssignClosure/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> AssignClosure(int id, string assignedToUserId, string? notes)
        {
            try
            {
                var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(currentUserId))
                {
                    TempData["Error"] = "Unable to identify current user.";
                    return RedirectToAction("Index");
                }

                await _requestService.AssignClosureRequestAsync(id, assignedToUserId, currentUserId, notes);

                TempData["Success"] = "Finding closure request assigned successfully.";
                return RedirectToAction("Index");
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error assigning request: {ex.Message}";
                return RedirectToAction("AssignClosure", new { id });
            }
        }
    }
}