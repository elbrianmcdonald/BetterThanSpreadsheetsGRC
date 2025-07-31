using CyberRiskApp.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
    public class StrategyGoalController : Controller
    {
        private readonly IStrategyPlanningService _strategyService;
        private readonly IMaturityService _maturityService;

        public StrategyGoalController(IStrategyPlanningService strategyService, IMaturityService maturityService)
        {
            _strategyService = strategyService;
            _maturityService = maturityService;
        }

        // GET: StrategyGoal/Details/5
        public async Task<IActionResult> Details(int id)
        {
            var goal = await _strategyService.GetGoalByIdAsync(id);
            if (goal == null)
            {
                return NotFound();
            }

            return View(goal);
        }

        // GET: StrategyGoal/Create?planId=5
        public async Task<IActionResult> Create(int planId)
        {
            var plan = await _strategyService.GetPlanByIdAsync(planId);
            if (plan == null)
            {
                return NotFound();
            }

            var frameworks = await _maturityService.GetAllFrameworksAsync();
            ViewBag.Frameworks = new SelectList(frameworks ?? new List<MaturityFramework>(), "Id", "Name");
            ViewBag.Plan = plan;

            var model = new StrategyGoal
            {
                StrategyPlanId = planId,
                TargetDate = plan.EndDate,
                Priority = GoalPriority.Medium,
                CurrentMaturityLevel = (int)MaturityLevel.NotImplemented,
                TargetMaturityLevel = (int)MaturityLevel.Initial
            };

            return View(model);
        }

        // POST: StrategyGoal/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(StrategyGoal goal)
        {
            // Remove navigation properties from validation
            ModelState.Remove("StrategyPlan");
            ModelState.Remove("MaturityFramework");
            ModelState.Remove("Capabilities");

            if (ModelState.IsValid)
            {
                try
                {
                    goal.CreatedAt = DateTime.UtcNow;
                    goal.UpdatedAt = DateTime.UtcNow;
                    
                    await _strategyService.CreateGoalAsync(goal);
                    TempData["Success"] = "Strategy goal created successfully.";
                    return RedirectToAction("Details", "Strategy", new { id = goal.StrategyPlanId });
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error creating strategy goal: {ex.Message}";
                }
            }

            // Reload data for view
            var plan = await _strategyService.GetPlanByIdAsync(goal.StrategyPlanId);
            var frameworks = await _maturityService.GetAllFrameworksAsync();
            ViewBag.Frameworks = new SelectList(frameworks ?? new List<MaturityFramework>(), "Id", "Name", goal.MaturityFrameworkId);
            ViewBag.Plan = plan;

            return View(goal);
        }

        // GET: StrategyGoal/Edit/5
        public async Task<IActionResult> Edit(int id)
        {
            var goal = await _strategyService.GetGoalByIdAsync(id);
            if (goal == null)
            {
                return NotFound();
            }

            var frameworks = await _maturityService.GetAllFrameworksAsync();
            ViewBag.Frameworks = new SelectList(frameworks ?? new List<MaturityFramework>(), "Id", "Name", goal.MaturityFrameworkId);

            return View(goal);
        }

        // POST: StrategyGoal/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, StrategyGoal goal)
        {
            if (id != goal.Id)
            {
                return NotFound();
            }

            // Remove navigation properties from validation
            ModelState.Remove("StrategyPlan");
            ModelState.Remove("MaturityFramework");
            ModelState.Remove("Capabilities");

            if (ModelState.IsValid)
            {
                try
                {
                    goal.UpdatedAt = DateTime.UtcNow;
                    await _strategyService.UpdateGoalAsync(goal);
                    TempData["Success"] = "Strategy goal updated successfully.";
                    return RedirectToAction("Details", new { id });
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error updating strategy goal: {ex.Message}";
                }
            }

            var frameworks = await _maturityService.GetAllFrameworksAsync();
            ViewBag.Frameworks = new SelectList(frameworks ?? new List<MaturityFramework>(), "Id", "Name", goal.MaturityFrameworkId);

            return View(goal);
        }

        // POST: StrategyGoal/Delete/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var goal = await _strategyService.GetGoalByIdAsync(id);
                if (goal == null)
                {
                    TempData["Error"] = "Strategy goal not found.";
                    return RedirectToAction("Index", "Strategy");
                }

                var planId = goal.StrategyPlanId;
                await _strategyService.DeleteGoalAsync(id);
                TempData["Success"] = "Strategy goal deleted successfully.";
                return RedirectToAction("Details", "Strategy", new { id = planId });
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error deleting strategy goal: {ex.Message}";
                return RedirectToAction("Details", new { id });
            }
        }
    }
}