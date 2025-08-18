using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.ViewModels;
using CyberRiskApp.Authorization;
using CyberRiskApp.Extensions;
using Microsoft.AspNetCore.Http.Features;

namespace CyberRiskApp.Controllers
{
    public class MaturityAssessmentsController : Controller
    {
        private readonly IMaturityService _maturityService;
        private readonly IGovernanceService _governanceService;

        public MaturityAssessmentsController(IMaturityService maturityService, IGovernanceService governanceService)
        {
            _maturityService = maturityService;
            _governanceService = governanceService;
        }

        // GET: MaturityAssessments - All users can view assessments, but create/edit restrictions apply
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Index()
        {
            var assessments = await _maturityService.GetAllAssessmentsAsync();
            ViewBag.CanPerformAssessments = User.CanUserPerformAssessments();
            return View(assessments);
        }

        // GET: MaturityAssessments/Details/5 - All users can view assessment details
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Details(int id)
        {
            var assessment = await _maturityService.GetAssessmentByIdAsync(id);
            if (assessment == null)
                return NotFound();

            var controlAssessments = await _maturityService.GetControlAssessmentsByAssessmentIdAsync(id);
            var overallScore = await _maturityService.CalculateOverallMaturityScoreAsync(id);

            var viewModel = new MaturityAssessmentDetailsViewModel
            {
                Assessment = assessment,
                ControlAssessments = controlAssessments,
                OverallScore = overallScore
            };

            // Get function/domain scores based on framework type
            if (assessment.Framework?.Type == FrameworkType.NISTCSF)
            {
                viewModel.FunctionScores = await _maturityService.GetMaturityScoresByFunctionAsync(id);
                viewModel.GapsByFunction = controlAssessments
                    .Where(ca => ca.CurrentMaturityLevel < ca.TargetMaturityLevel && ca.Control != null)
                    .GroupBy(ca => ca.Control.Function)
                    .ToDictionary(g => g.Key, g => g.ToList());
            }
            else if (assessment.Framework?.Type == FrameworkType.C2M2)
            {
                viewModel.DomainScores = await _maturityService.GetMaturityScoresByDomainAsync(id);
                viewModel.GapsByDomain = controlAssessments
                    .Where(ca => ca.CurrentMaturityLevel < ca.TargetMaturityLevel && ca.Control != null)
                    .GroupBy(ca => ca.Control.Function) // Function field stores Domain for C2M2
                    .ToDictionary(g => g.Key, g => g.ToList());
            }

            // Calculate maturity distributions
            viewModel.CurrentMaturityDistribution = controlAssessments
                .GroupBy(ca => ca.CurrentMaturityLevel)
                .ToDictionary(g => g.Key, g => g.Count());

            viewModel.TargetMaturityDistribution = controlAssessments
                .GroupBy(ca => ca.TargetMaturityLevel)
                .ToDictionary(g => g.Key, g => g.Count());

            // Calculate maturity distribution (for backward compatibility)
            viewModel.MaturityDistribution = controlAssessments
                .GroupBy(ca => ca.CurrentMaturityLevel)
                .ToDictionary(g => g.Key, g => g.Count());

            // Calculate gap analysis summary
            viewModel.ControlsNeedingImprovement = controlAssessments
                .Count(ca => ca.CurrentMaturityLevel < ca.TargetMaturityLevel);

            // FIXED: Use the single ProjectsRequired property (int)
            viewModel.ProjectsRequired = controlAssessments
                .Count(ca => ca.ProjectNeeded);

            viewModel.ProjectSizeDistribution = controlAssessments
                .Where(ca => ca.ProjectNeeded && ca.TShirtSize.HasValue)
                .GroupBy(ca => ca.TShirtSize!.Value)
                .ToDictionary(g => g.Key, g => g.Count());

            // Get high priority gaps and projects
            viewModel.HighPriorityGaps = controlAssessments
                .Where(ca => ca.CurrentMaturityLevel < ca.TargetMaturityLevel && ca.Control.Priority >= ControlPriority.High)
                .OrderByDescending(ca => ca.Control.Priority)
                .Take(10);

            // Set the projects list using the separate property
            viewModel.ProjectsRequiredList = controlAssessments
                .Where(ca => ca.ProjectNeeded)
                .OrderByDescending(ca => ca.TShirtSize);

            // Generate key recommendations
            viewModel.KeyRecommendations = GenerateKeyRecommendations(controlAssessments, assessment.Framework?.Type);

            ViewBag.CanPerformAssessments = User.CanUserPerformAssessments();
            return View(viewModel);
        }

        // GET: MaturityAssessments/Create - Only GRC & Admin users can create assessments
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Create()
        {
            var viewModel = new MaturityAssessmentViewModel
            {
                AvailableFrameworks = await _maturityService.GetAllFrameworksAsync(),
                AvailableOrganizations = await _governanceService.GetAllOrganizationsAsync()
            };

            return View(viewModel);
        }

        // POST: MaturityAssessments/Create - Only GRC & Admin users can create assessments
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Create(MaturityAssessmentViewModel model)
        {
            // Remove audit fields from model validation since they're set automatically
            ModelState.Remove("Assessment.CreatedBy");
            ModelState.Remove("Assessment.UpdatedBy");
            
            if (ModelState.IsValid)
            {
                model.Assessment.Assessor = User.Identity?.Name ?? "Unknown";
                model.Assessment.Status = AssessmentStatus.Draft;
                model.Assessment.StartDate = DateTime.UtcNow;
                model.Assessment.CreatedAt = DateTime.UtcNow;
                model.Assessment.UpdatedAt = DateTime.UtcNow;

                var assessment = await _maturityService.CreateAssessmentAsync(model.Assessment);
                TempData["Success"] = "Maturity assessment created successfully.";
                return RedirectToAction("Details", new { id = assessment.Id });
            }

            // Reload dropdown data if validation fails 
            model.AvailableFrameworks = await _maturityService.GetAllFrameworksAsync();
            model.AvailableOrganizations = await _governanceService.GetAllOrganizationsAsync();
            return View(model);
        }

        // GET: MaturityAssessments/Edit/5 - Only GRC & Admin users can edit assessments
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Edit(int id)
        {
            var assessment = await _maturityService.GetAssessmentByIdAsync(id);
            if (assessment == null)
                return NotFound();

            var viewModel = new MaturityAssessmentViewModel
            {
                Assessment = assessment,
                AvailableFrameworks = await _maturityService.GetAllFrameworksAsync(),
                AvailableOrganizations = await _governanceService.GetAllOrganizationsAsync()
            };

            return View(viewModel);
        }

        // POST: MaturityAssessments/Edit/5 - Only GRC & Admin users can edit assessments
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Edit(int id, MaturityAssessmentViewModel model)
        {
            if (id != model.Assessment.Id)
                return NotFound();

            if (ModelState.IsValid)
            {
                model.Assessment.UpdatedAt = DateTime.UtcNow;
                await _maturityService.UpdateAssessmentAsync(model.Assessment);
                TempData["Success"] = "Assessment updated successfully.";
                return RedirectToAction("Details", new { id = model.Assessment.Id });
            }

            // Reload dropdown data if validation fails
            model.AvailableFrameworks = await _maturityService.GetAllFrameworksAsync();
            model.AvailableOrganizations = await _governanceService.GetAllOrganizationsAsync();
            return View(model);
        }

        // GET: MaturityAssessments/PerformBulk/5 - Single page assessment for all controls
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> PerformBulk(int id)
        {
            var assessment = await _maturityService.GetAssessmentByIdAsync(id);
            if (assessment == null)
                return NotFound();

            var controlAssessments = await _maturityService.GetControlAssessmentsByAssessmentIdAsync(id);
            var controlsList = controlAssessments.OrderBy(ca => ca.Control.Function).ThenBy(ca => ca.Control.ControlId).ToList();

            if (!controlsList.Any())
            {
                TempData["Warning"] = "No controls found for this assessment. Please ensure the framework has been properly uploaded.";
                return RedirectToAction("Details", new { id });
            }

            var completedControls = controlsList.Count(ca => ca.AssessmentDate.HasValue);

            // Get available maturity levels based on framework type
            var availableLevels = GetAvailableMaturityLevels(assessment.Framework?.Type ?? FrameworkType.Custom);

            var viewModel = new PerformMaturityAssessmentViewModel
            {
                Assessment = assessment,
                ControlAssessments = controlsList,
                TotalControls = controlsList.Count,
                CompletedControls = completedControls,
                ProgressPercentage = controlsList.Count > 0 ? (decimal)completedControls / controlsList.Count * 100 : 0,
                AvailableMaturityLevels = availableLevels
            };

            return View(viewModel);
        }

        // POST: MaturityAssessments/PerformBulk - Save all control assessments at once
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> PerformBulk(int id, IFormCollection formData)
        {
            try
            {
                Console.WriteLine($"=== PerformBulk Started ===");
                Console.WriteLine($"Assessment ID: {id}");
                Console.WriteLine($"Form keys count: {formData.Keys.Count}");

                // Get the assessment
                var assessment = await _maturityService.GetAssessmentByIdAsync(id);
                if (assessment == null)
                {
                    Console.WriteLine($"Assessment {id} not found");
                    return NotFound();
                }

                // Check for action parameter to determine if user wants to complete the assessment
                var action = formData["action"].ToString();
                Console.WriteLine($"Action parameter: '{action}'");

                // Get the framework to access controls
                var framework = await _maturityService.GetFrameworkByIdAsync(assessment.MaturityFrameworkId);
                if (framework == null)
                {
                    Console.WriteLine($"Framework {assessment.MaturityFrameworkId} not found");
                    return NotFound();
                }

                var controlAssessments = new List<MaturityControlAssessment>();
                var updatedCount = 0;
                var errorCount = 0;
                var controlsWithErrors = new List<string>();

                // Process form data in chunks to avoid memory issues
                foreach (var key in formData.Keys)
                {
                    try
                    {
                        if (key.StartsWith("control_") && key.EndsWith("_maturityLevel"))
                        {
                            // Extract control identifier from key: control_{controlId}_maturityLevel
                            var parts = key.Split('_');
                            if (parts.Length >= 3 && int.TryParse(parts[1], out int controlId))
                            {
                                var maturityLevelStr = formData[key].FirstOrDefault();
                                var priorityKey = $"control_{controlId}_priority";
                                var priorityStr = formData[priorityKey].FirstOrDefault();

                                Console.WriteLine($"Processing control {controlId}: Level={maturityLevelStr}, Priority={priorityStr}");

                                // Validate and parse values
                                if (Enum.TryParse<MaturityLevel>(maturityLevelStr, out var maturityLevel) &&
                                    Enum.TryParse<ControlPriority>(priorityStr, out var priority))
                                {
                                    // Find the corresponding framework control
                                    var frameworkControl = framework.Controls.FirstOrDefault(c => c.Id == controlId);
                                    if (frameworkControl != null)
                                    {
                                        // Create or update control assessment
                                        var controlAssessment = new MaturityControlAssessment
                                        {
                                            MaturityAssessmentId = id,
                                            MaturityControlId = controlId,
                                            CurrentMaturityLevel = maturityLevel,
                                            TargetMaturityLevel = maturityLevel, // Default target to current
                                            AssessmentDate = DateTime.UtcNow,
                                            Evidence = string.Empty,
                                            GapNotes = string.Empty,
                                            RecommendedActions = string.Empty,
                                            AssessedBy = User.Identity?.Name ?? "Unknown",
                                            UpdatedAt = DateTime.UtcNow,
                                            CreatedAt = DateTime.UtcNow
                                        };

                                        controlAssessments.Add(controlAssessment);
                                        updatedCount++;

                                        // Process in batches to avoid memory issues
                                        if (controlAssessments.Count >= 50)
                                        {
                                            await _maturityService.BulkUpdateControlAssessmentsAsync(controlAssessments);
                                            Console.WriteLine($"Processed batch of {controlAssessments.Count} controls");
                                            controlAssessments.Clear();
                                        }
                                    }
                                    else
                                    {
                                        Console.WriteLine($"Framework control {controlId} not found");
                                        controlsWithErrors.Add($"Control {controlId}: Not found in framework");
                                        errorCount++;
                                    }
                                }
                                else
                                {
                                    Console.WriteLine($"Invalid values for control {controlId}: Level={maturityLevelStr}, Priority={priorityStr}");
                                    controlsWithErrors.Add($"Control {controlId}: Invalid maturity level or priority");
                                    errorCount++;
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error processing key {key}: {ex.Message}");
                        controlsWithErrors.Add($"Key {key}: {ex.Message}");
                        errorCount++;
                        // Continue processing other controls
                    }
                }

                // Process remaining controls
                if (controlAssessments.Count > 0)
                {
                    await _maturityService.BulkUpdateControlAssessmentsAsync(controlAssessments);
                    Console.WriteLine($"Processed final batch of {controlAssessments.Count} controls");
                }

                Console.WriteLine($"=== PerformBulk Completed: {updatedCount} controls updated, {errorCount} errors ===");

                // Update assessment status based on action and success
                if (updatedCount > 0)
                {
                    if (action == "complete")
                    {
                        assessment.Status = AssessmentStatus.Completed;
                        assessment.CompletedDate = DateTime.UtcNow;
                        assessment.UpdatedAt = DateTime.UtcNow;
                        
                        // Recalculate overall maturity score
                        await _maturityService.CalculateOverallMaturityScoreAsync(id);
                        
                        await _maturityService.UpdateAssessmentAsync(assessment);
                        
                        TempData["Success"] = errorCount > 0 
                            ? $"Assessment completed with {updatedCount} controls updated, but {errorCount} controls had errors."
                            : $"Assessment completed successfully! Updated {updatedCount} controls.";
                    }
                    else
                    {
                        assessment.Status = AssessmentStatus.InProgress;
                        assessment.UpdatedAt = DateTime.UtcNow;
                        
                        // Recalculate overall maturity score
                        await _maturityService.CalculateOverallMaturityScoreAsync(id);
                        
                        await _maturityService.UpdateAssessmentAsync(assessment);
                        
                        TempData["Success"] = errorCount > 0 
                            ? $"Assessment saved with {updatedCount} controls updated, but {errorCount} controls had errors."
                            : $"Assessment saved successfully! Updated {updatedCount} controls.";
                    }
                }
                else
                {
                    TempData["Warning"] = "No controls were updated. Please check your assessment data.";
                }

                // Add error details if any
                if (controlsWithErrors.Any())
                {
                    TempData["ErrorDetails"] = string.Join("; ", controlsWithErrors);
                }

                // Check if this is an AJAX request
                if (Request.Headers.ContainsKey("X-Requested-With") && 
                    Request.Headers["X-Requested-With"] == "XMLHttpRequest")
                {
                    // Return JSON for AJAX requests
                    return Json(new { 
                        success = true, 
                        message = TempData["Success"]?.ToString() ?? TempData["Warning"]?.ToString(),
                        controlsUpdated = updatedCount,
                        errors = errorCount,
                        redirectUrl = Url.Action("Details", new { id })
                    });
                }
                else
                {
                    // Redirect to details page for regular form submissions
                    return RedirectToAction("Details", new { id });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Critical error in PerformBulk: {ex}");
                
                TempData["Error"] = $"An error occurred while processing the bulk update: {ex.Message}";
                
                // Check if this is an AJAX request
                if (Request.Headers.ContainsKey("X-Requested-With") && 
                    Request.Headers["X-Requested-With"] == "XMLHttpRequest")
                {
                    return Json(new { 
                        success = false, 
                        message = "An error occurred while processing the bulk update", 
                        error = ex.Message 
                    });
                }
                else
                {
                    return RedirectToAction("PerformBulk", new { id });
                }
            }
        }

        // GET: MaturityAssessments/Perform/5 - Single control assessment (step-by-step)
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Perform(int id, int? controlIndex)
        {
            var assessment = await _maturityService.GetAssessmentByIdAsync(id);
            if (assessment == null)
                return NotFound();

            var controlAssessments = await _maturityService.GetControlAssessmentsByAssessmentIdAsync(id);
            var controlsList = controlAssessments.OrderBy(ca => ca.Control.ControlId).ToList();

            if (!controlsList.Any())
            {
                TempData["Warning"] = "No controls found for this assessment. Please ensure the framework has been properly uploaded.";
                return RedirectToAction("Details", new { id });
            }

            var currentIndex = controlIndex ?? 0;
            if (currentIndex >= controlsList.Count)
                currentIndex = controlsList.Count - 1;
            if (currentIndex < 0)
                currentIndex = 0;

            var currentControl = controlsList[currentIndex];
            var completedControls = controlsList.Count(ca => ca.AssessmentDate.HasValue);

            // Get available maturity levels based on framework type
            var availableLevels = GetAvailableMaturityLevels(assessment.Framework?.Type ?? FrameworkType.Custom);

            var viewModel = new PerformMaturityAssessmentViewModel
            {
                Assessment = assessment,
                ControlAssessments = controlsList,
                CurrentControl = currentControl,
                CurrentControlIndex = currentIndex,
                TotalControls = controlsList.Count,
                CompletedControls = completedControls,
                ProgressPercentage = controlsList.Count > 0 ? (decimal)completedControls / controlsList.Count * 100 : 0,
                AvailableMaturityLevels = availableLevels
            };

            return View(viewModel);
        }

        // POST: MaturityAssessments/UpdateControl - Only GRC & Admin users can update control assessments
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> UpdateControl(MaturityControlAssessment controlAssessment, int assessmentId, int controlIndex)
        {
            try
            {
                controlAssessment.AssessedBy = User.Identity?.Name ?? "Unknown";
                controlAssessment.AssessmentDate = DateTime.UtcNow;
                controlAssessment.UpdatedAt = DateTime.UtcNow;

                await _maturityService.UpdateControlAssessmentAsync(controlAssessment);

                // Recalculate overall assessment score
                await _maturityService.CalculateOverallMaturityScoreAsync(assessmentId);

                TempData["Success"] = "Control assessment updated successfully.";

                // Navigate to next control or completion
                var nextIndex = controlIndex + 1;
                var totalControls = await _maturityService.GetControlAssessmentsByAssessmentIdAsync(assessmentId);

                if (nextIndex >= totalControls.Count())
                {
                    // Assessment complete
                    return RedirectToAction("Details", new { id = assessmentId });
                }
                else
                {
                    // Continue to next control
                    return RedirectToAction("Perform", new { id = assessmentId, controlIndex = nextIndex });
                }
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error updating control assessment: {ex.Message}";
                return RedirectToAction("Perform", new { id = assessmentId, controlIndex });
            }
        }

        // POST: MaturityAssessments/UpdateControlPriority - Update individual control priority
        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> UpdateControlPriority(int controlId, ControlPriority priority)
        {
            try
            {
                var success = await _maturityService.UpdateControlPriorityAsync(controlId, priority);
                if (success)
                {
                    return Json(new { success = true, message = "Priority updated successfully." });
                }
                else
                {
                    return Json(new { success = false, message = "Control not found." });
                }
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = $"Error updating priority: {ex.Message}" });
            }
        }

        // POST: MaturityAssessments/UpdateTargetLevel - Update individual control target level
        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> UpdateTargetLevel(int controlAssessmentId, MaturityLevel targetLevel)
        {
            try
            {
                var controlAssessment = await _maturityService.GetControlAssessmentByIdAsync(controlAssessmentId);
                if (controlAssessment == null)
                {
                    return Json(new { success = false, message = "Control assessment not found." });
                }

                controlAssessment.TargetMaturityLevel = targetLevel;
                controlAssessment.UpdatedAt = DateTime.UtcNow;

                await _maturityService.UpdateControlAssessmentAsync(controlAssessment);

                return Json(new { success = true, message = "Target level updated successfully." });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = $"Error updating target level: {ex.Message}" });
            }
        }

        // POST: MaturityAssessments/BulkUpdatePriority - Update multiple control priorities
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> BulkUpdatePriority(int assessmentId, List<int> controlIds, ControlPriority priority)
        {
            try
            {
                int updatedCount = 0;
                foreach (var controlId in controlIds)
                {
                    var success = await _maturityService.UpdateControlPriorityAsync(controlId, priority);
                    if (success) updatedCount++;
                }

                TempData["Success"] = $"Updated priority for {updatedCount} controls to {priority}.";
                return RedirectToAction("Details", new { id = assessmentId });
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error updating priorities: {ex.Message}";
                return RedirectToAction("Details", new { id = assessmentId });
            }
        }

        // POST: MaturityAssessments/BulkUpdateTargetLevel - Update multiple control target levels
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> BulkUpdateTargetLevel(int assessmentId, List<int> controlAssessmentIds, MaturityLevel targetLevel)
        {
            try
            {
                int updatedCount = 0;
                foreach (var controlAssessmentId in controlAssessmentIds)
                {
                    var controlAssessment = await _maturityService.GetControlAssessmentByIdAsync(controlAssessmentId);
                    if (controlAssessment != null)
                    {
                        controlAssessment.TargetMaturityLevel = targetLevel;
                        controlAssessment.UpdatedAt = DateTime.UtcNow;
                        await _maturityService.UpdateControlAssessmentAsync(controlAssessment);
                        updatedCount++;
                    }
                }

                TempData["Success"] = $"Updated target level for {updatedCount} controls to {targetLevel}.";
                return RedirectToAction("Details", new { id = assessmentId });
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error updating target levels: {ex.Message}";
                return RedirectToAction("Details", new { id = assessmentId });
            }
        }

        // POST: MaturityAssessments/Delete/5 - Only GRC & Admin users can delete assessments
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _maturityService.DeleteAssessmentAsync(id);
            if (result)
            {
                TempData["Success"] = "Assessment deleted successfully.";
            }
            else
            {
                TempData["Error"] = "Assessment not found or could not be deleted.";
            }

            return RedirectToAction(nameof(Index));
        }

        // Private helper methods

        private IEnumerable<MaturityLevel> GetAvailableMaturityLevels(FrameworkType frameworkType)
        {
            if (frameworkType == FrameworkType.NISTCSF)
            {
                // NIST CSF uses levels 0-4
                return new[] { MaturityLevel.NotImplemented, MaturityLevel.Initial, MaturityLevel.Developing, MaturityLevel.Defined, MaturityLevel.Managed };
            }
            else if (frameworkType == FrameworkType.C2M2)
            {
                // C2M2 uses levels 1-3
                return new[] { MaturityLevel.Initial, MaturityLevel.Developing, MaturityLevel.Defined };
            }
            else
            {
                // Default to all levels
                return Enum.GetValues<MaturityLevel>();
            }
        }

        private IEnumerable<string> GenerateKeyRecommendations(IEnumerable<MaturityControlAssessment> controlAssessments, FrameworkType? frameworkType)
        {
            var recommendations = new List<string>();
            var gaps = controlAssessments.Where(ca => ca.CurrentMaturityLevel < ca.TargetMaturityLevel).ToList();

            if (gaps.Count == 0)
            {
                recommendations.Add("Congratulations! All controls are at or above their target maturity levels.");
                return recommendations;
            }

            // General recommendations
            recommendations.Add($"Focus on closing {gaps.Count} identified maturity gaps across the framework.");

            var projectsNeeded = gaps.Count(g => g.ProjectNeeded);
            if (projectsNeeded > 0)
            {
                recommendations.Add($"Initiate {projectsNeeded} improvement projects to address maturity gaps.");
            }

            // Framework-specific recommendations
            if (frameworkType == FrameworkType.NISTCSF)
            {
                var functionGaps = gaps.GroupBy(g => g.Control.Function).OrderByDescending(g => g.Count()).Take(3);
                foreach (var functionGroup in functionGaps)
                {
                    recommendations.Add($"Prioritize improvements in the {functionGroup.Key} function ({functionGroup.Count()} gaps identified).");
                }
            }
            else if (frameworkType == FrameworkType.C2M2)
            {
                var domainGaps = gaps.GroupBy(g => g.Control.Function).OrderByDescending(g => g.Count()).Take(3);
                foreach (var domainGroup in domainGaps)
                {
                    recommendations.Add($"Prioritize improvements in the {domainGroup.Key} domain ({domainGroup.Count()} gaps identified).");
                }
            }

            return recommendations;
        }

        // GET: MaturityAssessments/BulkView/5 - All users can view bulk assessment view
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> BulkView(int id)
        {
            var assessment = await _maturityService.GetAssessmentByIdAsync(id);
            if (assessment == null)
                return NotFound();

            var controlAssessments = await _maturityService.GetControlAssessmentsByAssessmentIdAsync(id);
            var framework = await _maturityService.GetFrameworkByIdAsync(assessment.MaturityFrameworkId);

            var viewModel = new PerformMaturityAssessmentViewModel
            {
                Assessment = assessment,
                ControlAssessments = controlAssessments,
                TotalControls = controlAssessments.Count(),
                CompletedControls = controlAssessments.Count(ca => ca.AssessmentDate.HasValue)
            };

            viewModel.ProgressPercentage = viewModel.TotalControls > 0 
                ? (decimal)viewModel.CompletedControls / viewModel.TotalControls * 100 
                : 0;

            // Set available maturity levels based on framework
            viewModel.AvailableMaturityLevels = GetAvailableMaturityLevels(framework?.Type ?? FrameworkType.NISTCSF);

            return View(viewModel);
        }

        // POST: Update selected control assessments via AJAX
        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> UpdateSelectedControlAssessments([FromBody] List<MaturityControlAssessmentUpdate> updates)
        {
            if (!User.CanUserPerformAssessments())
            {
                return Json(new { success = false, message = "You don't have permission to perform assessments." });
            }

            try
            {
                var controlAssessments = new List<MaturityControlAssessment>();

                foreach (var update in updates)
                {
                    if (update.Id <= 0)
                        continue;

                    var controlAssessment = await _maturityService.GetControlAssessmentByIdAsync(update.Id);
                    if (controlAssessment == null)
                        continue;

                    // Update maturity levels
                    if (!string.IsNullOrEmpty(update.CurrentMaturityLevel) && 
                        Enum.TryParse<MaturityLevel>(update.CurrentMaturityLevel, out var currentLevel))
                    {
                        controlAssessment.CurrentMaturityLevel = currentLevel;
                    }

                    if (!string.IsNullOrEmpty(update.TargetMaturityLevel) && 
                        Enum.TryParse<MaturityLevel>(update.TargetMaturityLevel, out var targetLevel))
                    {
                        controlAssessment.TargetMaturityLevel = targetLevel;
                    }

                    // Update assessment details
                    if (!string.IsNullOrEmpty(update.Ownership))
                    {
                        controlAssessment.Ownership = update.Ownership;
                    }

                    if (update.TargetCompletionDate.HasValue)
                    {
                        controlAssessment.TargetCompletionDate = update.TargetCompletionDate.Value;
                    }
                    else if (update.TargetCompletionDate == null && !string.IsNullOrEmpty(update.TargetCompletionDateString))
                    {
                        if (DateTime.TryParse(update.TargetCompletionDateString, out var parsedDate))
                        {
                            controlAssessment.TargetCompletionDate = parsedDate;
                        }
                    }

                    controlAssessment.ProjectNeeded = update.ProjectNeeded;

                    if (!string.IsNullOrEmpty(update.TShirtSize) && 
                        Enum.TryParse<TShirtSize>(update.TShirtSize, out var tShirtSize))
                    {
                        controlAssessment.TShirtSize = tShirtSize;
                    }

                    if (!string.IsNullOrEmpty(update.ProjectNumber))
                    {
                        controlAssessment.ProjectNumber = update.ProjectNumber;
                    }

                    if (!string.IsNullOrEmpty(update.Evidence))
                    {
                        controlAssessment.Evidence = update.Evidence;
                    }

                    if (!string.IsNullOrEmpty(update.GapNotes))
                    {
                        controlAssessment.GapNotes = update.GapNotes;
                    }

                    if (!string.IsNullOrEmpty(update.RecommendedActions))
                    {
                        controlAssessment.RecommendedActions = update.RecommendedActions;
                    }

                    // Set assessment tracking fields
                    controlAssessment.AssessedBy = User.Identity?.Name ?? "Current User";
                    controlAssessment.AssessmentDate = DateTime.UtcNow;

                    controlAssessments.Add(controlAssessment);
                }

                // Bulk update all control assessments
                if (controlAssessments.Any())
                {
                    await _maturityService.BulkUpdateControlAssessmentsAsync(controlAssessments);

                    // Update overall assessment score
                    var assessmentId = controlAssessments.First().MaturityAssessmentId;
                    var overallScore = await _maturityService.CalculateOverallMaturityScoreAsync(assessmentId);
                    
                    var assessment = await _maturityService.GetAssessmentByIdAsync(assessmentId);
                    if (assessment != null)
                    {
                        assessment.OverallMaturityScore = overallScore;
                        await _maturityService.UpdateAssessmentAsync(assessment);
                    }
                }

                return Json(new { success = true });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = $"Error updating selected control assessments: {ex.Message}" });
            }
        }
    }
}