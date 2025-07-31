using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.Authorization;
using CyberRiskApp.ViewModels;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
    public class MyWorkController : Controller
    {
        private readonly IRequestService _requestService;

        public MyWorkController(IRequestService requestService)
        {
            _requestService = requestService;
        }

        // GET: MyWork
        public async Task<IActionResult> Index()
        {
            var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(currentUserId))
            {
                TempData["Error"] = "Unable to identify current user.";
                return RedirectToAction("Index", "Dashboard");
            }

            var viewModel = new MyWorkViewModel
            {
                AssignedAssessmentRequests = await _requestService.GetAssignedRequestsForUserAsync(currentUserId),
                AssignedAcceptanceRequests = await _requestService.GetAssignedAcceptanceRequestsForUserAsync(currentUserId),
                AssignedClosureRequests = await _requestService.GetAssignedClosureRequestsForUserAsync(currentUserId)
            };

            return View(viewModel);
        }

        // POST: MyWork/Start/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Start(int id)
        {
            try
            {
                var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(currentUserId))
                {
                    TempData["Error"] = "Unable to identify current user.";
                    return RedirectToAction("Index");
                }

                await _requestService.StartAssessmentRequestAsync(id, currentUserId);
                TempData["Success"] = "Work started successfully!";
            }
            catch (UnauthorizedAccessException)
            {
                TempData["Error"] = "You are not authorized to start this request.";
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error starting request: {ex.Message}";
            }

            return RedirectToAction("Index");
        }

        // GET: MyWork/Complete/5
        public async Task<IActionResult> Complete(int id)
        {
            var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(currentUserId))
            {
                TempData["Error"] = "Unable to identify current user.";
                return RedirectToAction("Index");
            }

            var request = await _requestService.GetAssessmentRequestByIdAsync(id);
            if (request == null)
                return NotFound();

            if (request.AssignedToUserId != currentUserId)
            {
                TempData["Error"] = "You are not authorized to complete this request.";
                return RedirectToAction("Index");
            }

            return View(request);
        }

        // POST: MyWork/Complete/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Complete(int id, decimal actualHours, string? notes)
        {
            try
            {
                var currentUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(currentUserId))
                {
                    TempData["Error"] = "Unable to identify current user.";
                    return RedirectToAction("Index");
                }

                await _requestService.CompleteAssessmentRequestAsync(id, currentUserId, actualHours, notes);

                TempData["Success"] = "Work completed successfully!";
                return RedirectToAction("Index");
            }
            catch (UnauthorizedAccessException)
            {
                TempData["Error"] = "You are not authorized to complete this request.";
                return RedirectToAction("Index");
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error completing request: {ex.Message}";
                return RedirectToAction("Complete", new { id });
            }
        }
    }
}