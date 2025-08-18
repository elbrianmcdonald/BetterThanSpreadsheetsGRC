using CyberRiskApp.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
    public class ImplementationMilestoneController : Controller
    {
        private readonly IStrategyPlanningService _strategyService;

        public ImplementationMilestoneController(IStrategyPlanningService strategyService)
        {
            _strategyService = strategyService;
        }

        // GET: ImplementationMilestone/Create?planId=5
        public async Task<IActionResult> Create(int planId)
        {
            var plan = await _strategyService.GetPlanByIdAsync(planId);
            if (plan == null)
            {
                return NotFound();
            }

            ViewBag.Plan = plan;

            var model = new ImplementationMilestone
            {
                StrategyPlanId = planId,
                TargetDate = plan.EndDate,
                Status = MilestoneStatus.Planned
            };

            return View(model);
        }

        // POST: ImplementationMilestone/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(ImplementationMilestone milestone)
        {
            // Remove navigation properties from validation
            ModelState.Remove("StrategyPlan");

            if (ModelState.IsValid)
            {
                try
                {
                    milestone.CreatedAt = DateTime.UtcNow;
                    milestone.UpdatedAt = DateTime.UtcNow;
                    
                    await _strategyService.CreateMilestoneAsync(milestone);
                    
                    // Handle AJAX requests
                    if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
                    {
                        return Json(new { success = true, message = "Implementation milestone created successfully." });
                    }
                    
                    TempData["Success"] = "Implementation milestone created successfully.";
                    return RedirectToAction("Details", "Strategy", new { id = milestone.StrategyPlanId });
                }
                catch (Exception ex)
                {
                    // Handle AJAX requests
                    if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
                    {
                        return Json(new { success = false, message = $"Error creating implementation milestone: {ex.Message}" });
                    }
                    
                    TempData["Error"] = $"Error creating implementation milestone: {ex.Message}";
                }
            }

            // Handle AJAX requests with validation errors
            if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
            {
                var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage);
                return Json(new { success = false, message = string.Join(", ", errors) });
            }

            // Reload data for view
            var plan = await _strategyService.GetPlanByIdAsync(milestone.StrategyPlanId);
            ViewBag.Plan = plan;

            return View(milestone);
        }

        // GET: ImplementationMilestone/Edit/5
        public async Task<IActionResult> Edit(int id)
        {
            var milestone = await _strategyService.GetMilestoneByIdAsync(id);
            if (milestone == null)
            {
                return NotFound();
            }

            return View(milestone);
        }

        // POST: ImplementationMilestone/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, ImplementationMilestone milestone)
        {
            if (id != milestone.Id)
            {
                return NotFound();
            }

            // Remove navigation properties from validation
            ModelState.Remove("StrategyPlan");

            if (ModelState.IsValid)
            {
                try
                {
                    milestone.UpdatedAt = DateTime.UtcNow;
                    await _strategyService.UpdateMilestoneAsync(milestone);
                    TempData["Success"] = "Implementation milestone updated successfully.";
                    return RedirectToAction("Details", "Strategy", new { id = milestone.StrategyPlanId });
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error updating implementation milestone: {ex.Message}";
                }
            }

            return View(milestone);
        }

        // POST: ImplementationMilestone/Delete/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var milestone = await _strategyService.GetMilestoneByIdAsync(id);
                if (milestone == null)
                {
                    TempData["Error"] = "Implementation milestone not found.";
                    return RedirectToAction("Index", "Strategy");
                }

                var planId = milestone.StrategyPlanId;
                await _strategyService.DeleteMilestoneAsync(id);
                TempData["Success"] = "Implementation milestone deleted successfully.";
                return RedirectToAction("Details", "Strategy", new { id = planId });
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error deleting implementation milestone: {ex.Message}";
                return RedirectToAction("Details", "Strategy", new { id });
            }
        }
    }
}