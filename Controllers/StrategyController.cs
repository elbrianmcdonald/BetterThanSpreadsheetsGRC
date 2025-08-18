using CyberRiskApp.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
    public class StrategyController : Controller
    {
        private readonly IStrategyPlanningService _strategyService;
        private readonly IGovernanceService _governanceService;
        private readonly IMaturityService _maturityService;

        public StrategyController(IStrategyPlanningService strategyService, IGovernanceService governanceService, IMaturityService maturityService)
        {
            _strategyService = strategyService;
            _governanceService = governanceService;
            _maturityService = maturityService;
        }

        // GET: Strategy
        public async Task<IActionResult> Index()
        {
            var plans = await _strategyService.GetAllPlansAsync();
            
            ViewBag.ActivePlansCount = plans.Count(p => p.Status == StrategyPlanStatus.Active);
            ViewBag.InProgressCount = plans.SelectMany(p => p.Goals)
                .SelectMany(g => g.Capabilities)
                .Count(c => c.Status == CapabilityStatus.InProgress);
            ViewBag.CompletedPlansCount = plans.Count(p => p.Status == StrategyPlanStatus.Completed);
            
            return View(plans);
        }

        // GET: Strategy/Details/5
        public async Task<IActionResult> Details(int id)
        {
            var plan = await _strategyService.GetPlanByIdAsync(id);
            if (plan == null)
            {
                return NotFound();
            }

            ViewBag.DashboardData = await _strategyService.GetPlanDashboardDataAsync(id);
            return View(plan);
        }

        // GET: Strategy/Create
        public async Task<IActionResult> Create()
        {
            var organizations = await _governanceService.GetAllOrganizationsAsync();
            
            // Check if we have organizations
            if (organizations == null || !organizations.Any())
            {
                TempData["Warning"] = "No organizations found. Please create an organization first.";
                return RedirectToAction("Index");
            }
            
            ViewBag.Organizations = new SelectList(organizations, "Id", "Name");
            
            var assessments = await _maturityService.GetAllAssessmentsAsync();
            ViewBag.MaturityAssessments = new SelectList(assessments ?? new List<MaturityAssessment>(), "Id", "Title");

            var model = new StrategyPlan
            {
                StartDate = DateTime.UtcNow.Date,
                EndDate = DateTime.UtcNow.Date.AddYears(2),
                BusinessOrganizationId = 0 // Explicitly set to 0
            };

            return View(model);
        }

        // POST: Strategy/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(StrategyPlan plan, int? importFromAssessmentId)
        {
            // Remove the model state for Organization navigation property as it's not needed for creation
            ModelState.Remove("Organization");
            
            // Debug: Log the BusinessOrganizationId value
            if (plan.BusinessOrganizationId <= 0)
            {
                ModelState.AddModelError("BusinessOrganizationId", "Please select a valid organization");
            }
            
            // Log all model state errors for debugging
            if (!ModelState.IsValid)
            {
                var errors = ModelState
                    .Where(x => x.Value.Errors.Count > 0)
                    .Select(x => new { x.Key, x.Value.Errors })
                    .ToList();
                
                foreach (var error in errors)
                {
                    System.Diagnostics.Debug.WriteLine($"Field: {error.Key}, Errors: {string.Join(", ", error.Errors.Select(e => e.ErrorMessage))}");
                }
            }
            
            if (ModelState.IsValid)
            {
                try
                {
                    plan.CreatedBy = User.Identity?.Name ?? "Unknown";
                    plan.CreatedAt = DateTime.UtcNow;
                    plan.UpdatedAt = DateTime.UtcNow;
                    
                    StrategyPlan createdPlan;
                    if (importFromAssessmentId.HasValue)
                    {
                        createdPlan = await _strategyService.ImportFromMaturityAssessmentAsync(importFromAssessmentId.Value, plan);
                        TempData["Success"] = "Strategy plan created successfully with goals imported from maturity assessment.";
                    }
                    else
                    {
                        createdPlan = await _strategyService.CreatePlanAsync(plan);
                        TempData["Success"] = "Strategy plan created successfully.";
                    }
                    
                    return RedirectToAction(nameof(Details), new { id = createdPlan.Id });
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error creating strategy plan: {ex.Message}";
                }
            }

            // Reload dropdown data
            var organizations = await _governanceService.GetAllOrganizationsAsync();
            ViewBag.Organizations = new SelectList(organizations ?? new List<BusinessOrganization>(), "Id", "Name", plan.BusinessOrganizationId);
            
            var assessments = await _maturityService.GetAllAssessmentsAsync();
            ViewBag.MaturityAssessments = new SelectList(assessments ?? new List<MaturityAssessment>(), "Id", "Title");

            return View(plan);
        }

        // GET: Strategy/Edit/5
        public async Task<IActionResult> Edit(int id)
        {
            var plan = await _strategyService.GetPlanByIdAsync(id);
            if (plan == null)
            {
                return NotFound();
            }

            var organizations = await _governanceService.GetAllOrganizationsAsync();
            ViewBag.Organizations = new SelectList(organizations ?? new List<BusinessOrganization>(), "Id", "Name", plan.BusinessOrganizationId);

            return View(plan);
        }

        // POST: Strategy/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, StrategyPlan plan)
        {
            if (id != plan.Id)
            {
                return NotFound();
            }

            // Remove the model state for Organization navigation property
            ModelState.Remove("Organization");

            if (ModelState.IsValid)
            {
                try
                {
                    plan.UpdatedBy = User.Identity?.Name ?? "Unknown";
                    await _strategyService.UpdatePlanAsync(plan);
                    TempData["Success"] = "Strategy plan updated successfully.";
                    return RedirectToAction(nameof(Details), new { id });
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error updating strategy plan: {ex.Message}";
                }
            }

            var organizations = await _governanceService.GetAllOrganizationsAsync();
            ViewBag.Organizations = new SelectList(organizations ?? new List<BusinessOrganization>(), "Id", "Name", plan.BusinessOrganizationId);

            return View(plan);
        }

        // POST: Strategy/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            try
            {
                await _strategyService.DeletePlanAsync(id);
                TempData["Success"] = "Strategy plan deleted successfully.";
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error deleting strategy plan: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // GET: Strategy/Goals/5 (Plan ID)
        public async Task<IActionResult> Goals(int id)
        {
            var plan = await _strategyService.GetPlanByIdAsync(id);
            if (plan == null)
            {
                return NotFound();
            }

            var goals = await _strategyService.GetGoalsByPlanIdAsync(id);
            ViewBag.Plan = plan;
            return View(goals);
        }

        // GET: Strategy/Capabilities/5 (Plan ID)
        public async Task<IActionResult> Capabilities(int id)
        {
            var plan = await _strategyService.GetPlanByIdAsync(id);
            if (plan == null)
            {
                return NotFound();
            }

            var capabilities = await _strategyService.GetCapabilitiesByPlanIdAsync(id);
            ViewBag.Plan = plan;
            ViewBag.StatusBreakdown = await _strategyService.GetCapabilityStatusBreakdownAsync(id);
            ViewBag.TypeBreakdown = await _strategyService.GetCapabilityTypeBreakdownAsync(id);
            
            return View(capabilities);
        }

        // GET: Strategy/Roadmap/5 (Plan ID)
        public async Task<IActionResult> Roadmap(int id)
        {
            var plan = await _strategyService.GetPlanByIdAsync(id);
            if (plan == null)
            {
                return NotFound();
            }

            var milestones = await _strategyService.GetMilestonesByPlanIdAsync(id);
            var capabilities = await _strategyService.GetCapabilitiesByPlanIdAsync(id);
            
            ViewBag.Plan = plan;
            ViewBag.Capabilities = capabilities;
            
            return View(milestones);
        }

        // GET: Strategy/Progress/5 (Plan ID)
        public async Task<IActionResult> Progress(int id)
        {
            var plan = await _strategyService.GetPlanByIdAsync(id);
            if (plan == null)
            {
                return NotFound();
            }

            var dashboardData = await _strategyService.GetPlanDashboardDataAsync(id);
            var overdueCapabilities = await _strategyService.GetOverdueCapabilitiesAsync();
            var upcomingMilestones = await _strategyService.GetUpcomingMilestonesAsync(30);
            
            ViewBag.Plan = plan;
            ViewBag.DashboardData = dashboardData;
            ViewBag.OverdueCapabilities = overdueCapabilities.Where(c => c.StrategyGoal.StrategyPlanId == id);
            ViewBag.UpcomingMilestones = upcomingMilestones.Where(m => m.StrategyPlanId == id);
            
            return View();
        }

        // AJAX: Get plan summary data
        [HttpGet]
        public async Task<IActionResult> GetPlanSummary(int id)
        {
            try
            {
                var dashboardData = await _strategyService.GetPlanDashboardDataAsync(id);
                return Json(new { success = true, data = dashboardData });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        // AJAX: Get controls for a framework (compliance or maturity)
        [HttpGet]
        public async Task<IActionResult> GetControlsForFramework(int frameworkId)
        {
            try
            {
                // First, try to find the framework in compliance frameworks
                var complianceFramework = await _governanceService.GetFrameworkByIdAsync(frameworkId);
                if (complianceFramework != null)
                {
                    // It's a compliance framework
                    var complianceControls = await _governanceService.GetControlsByFrameworkIdAsync(frameworkId);
                    var complianceControlList = complianceControls.Select(c => new 
                    { 
                        id = c.Id, 
                        controlId = c.ControlId,
                        title = c.Title,
                        category = c.Category,
                        priority = c.Priority.ToString()
                    }).ToList();
                    
                    return Json(new { success = true, controls = complianceControlList });
                }

                // If not found in compliance frameworks, try maturity frameworks
                var maturityFramework = await _maturityService.GetFrameworkByIdAsync(frameworkId);
                if (maturityFramework != null)
                {
                    // It's a maturity framework
                    var maturityControls = await _maturityService.GetControlsByFrameworkIdAsync(frameworkId);
                    var maturityControlList = maturityControls.Select(c => new 
                    { 
                        id = c.Id, 
                        controlId = c.ControlId,
                        title = c.Title,
                        category = c.Function, // Use Function for maturity frameworks
                        priority = c.Priority.ToString()
                    }).ToList();
                    
                    return Json(new { success = true, controls = maturityControlList });
                }

                // Framework not found in either table
                return Json(new { success = false, message = "Framework not found" });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        // AJAX: Update plan status
        [HttpPost]
        public async Task<IActionResult> UpdatePlanStatus(int id, StrategyPlanStatus status)
        {
            try
            {
                var plan = await _strategyService.GetPlanByIdAsync(id);
                if (plan == null)
                    return Json(new { success = false, message = "Plan not found" });

                plan.Status = status;
                plan.UpdatedBy = User.Identity?.Name ?? "Unknown";
                
                await _strategyService.UpdatePlanAsync(plan);
                return Json(new { success = true });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }
    }
}