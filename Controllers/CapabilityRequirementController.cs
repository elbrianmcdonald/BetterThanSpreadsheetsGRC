using CyberRiskApp.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
    public class CapabilityRequirementController : Controller
    {
        private readonly IStrategyPlanningService _strategyService;

        public CapabilityRequirementController(IStrategyPlanningService strategyService)
        {
            _strategyService = strategyService;
        }

        // GET: CapabilityRequirement/Details/5
        public async Task<IActionResult> Details(int id)
        {
            var capability = await _strategyService.GetCapabilityByIdAsync(id);
            if (capability == null)
            {
                return NotFound();
            }

            return View(capability);
        }

        // GET: CapabilityRequirement/Create?goalId=5
        public async Task<IActionResult> Create(int goalId)
        {
            var goal = await _strategyService.GetGoalByIdAsync(goalId);
            if (goal == null)
            {
                return NotFound();
            }

            ViewBag.Goal = goal;

            var model = new CapabilityRequirement
            {
                StrategyGoalId = goalId,
                TargetDate = goal.TargetDate,
                Priority = CapabilityPriority.Medium,
                Status = CapabilityStatus.Planned,
                CapabilityType = CapabilityType.Process
            };

            return View(model);
        }

        // POST: CapabilityRequirement/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(CapabilityRequirement capability, int[] selectedControlIds)
        {
            // Remove navigation properties from validation
            ModelState.Remove("StrategyGoal");
            ModelState.Remove("Milestones");
            ModelState.Remove("ControlMappings");

            if (ModelState.IsValid)
            {
                try
                {
                    capability.CreatedAt = DateTime.UtcNow;
                    capability.UpdatedAt = DateTime.UtcNow;
                    
                    await _strategyService.CreateCapabilityWithControlsAsync(capability, selectedControlIds ?? new int[0]);
                    
                    // Handle AJAX requests
                    if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
                    {
                        return Json(new { success = true, message = "Capability requirement created successfully." });
                    }
                    
                    TempData["Success"] = "Capability requirement created successfully.";
                    return RedirectToAction("Details", "StrategyGoal", new { id = capability.StrategyGoalId });
                }
                catch (Exception ex)
                {
                    // Handle AJAX requests
                    if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
                    {
                        return Json(new { success = false, message = $"Error creating capability requirement: {ex.Message}" });
                    }
                    
                    TempData["Error"] = $"Error creating capability requirement: {ex.Message}";
                }
            }

            // Handle AJAX requests with validation errors
            if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
            {
                var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage);
                return Json(new { success = false, message = string.Join(", ", errors) });
            }

            // Reload data for view
            var goal = await _strategyService.GetGoalByIdAsync(capability.StrategyGoalId);
            ViewBag.Goal = goal;

            return View(capability);
        }

        // GET: CapabilityRequirement/Edit/5
        public async Task<IActionResult> Edit(int id)
        {
            var capability = await _strategyService.GetCapabilityByIdAsync(id);
            if (capability == null)
            {
                return NotFound();
            }

            return View(capability);
        }

        // POST: CapabilityRequirement/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, CapabilityRequirement capability)
        {
            if (id != capability.Id)
            {
                return NotFound();
            }

            // Remove navigation properties from validation
            ModelState.Remove("StrategyGoal");
            ModelState.Remove("Milestones");

            if (ModelState.IsValid)
            {
                try
                {
                    capability.UpdatedAt = DateTime.UtcNow;
                    await _strategyService.UpdateCapabilityAsync(capability);
                    TempData["Success"] = "Capability requirement updated successfully.";
                    return RedirectToAction("Details", new { id });
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error updating capability requirement: {ex.Message}";
                }
            }

            return View(capability);
        }

        // POST: CapabilityRequirement/Delete/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var capability = await _strategyService.GetCapabilityByIdAsync(id);
                if (capability == null)
                {
                    TempData["Error"] = "Capability requirement not found.";
                    return RedirectToAction("Index", "Strategy");
                }

                var goalId = capability.StrategyGoalId;
                await _strategyService.DeleteCapabilityAsync(id);
                TempData["Success"] = "Capability requirement deleted successfully.";
                return RedirectToAction("Details", "StrategyGoal", new { id = goalId });
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error deleting capability requirement: {ex.Message}";
                return RedirectToAction("Details", new { id });
            }
        }
    }
}