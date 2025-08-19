using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.ViewModels;
using CyberRiskApp.Authorization;
using CyberRiskApp.Extensions;
using CyberRiskApp.Filters;
using Microsoft.Extensions.Logging;

namespace CyberRiskApp.Controllers
{
    public class ComplianceAssessmentsController : BaseController
    {
        private readonly IGovernanceService _governanceService;

        public ComplianceAssessmentsController(IGovernanceService governanceService, ILogger<ComplianceAssessmentsController> logger) : base(logger)
        {
            _governanceService = governanceService;
        }

        // UPDATED: All users can view compliance assessments
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Index()
        {
            return await ExecuteWithErrorHandling(
                async () =>
                {
                    var assessments = await _governanceService.GetAllAssessmentsAsync();
                    ViewBag.CanPerformAssessments = User.CanUserPerformAssessments();
                    return assessments;
                },
                assessments => View(assessments),
                "loading compliance assessments"
            );
        }

        // UPDATED: All users can view assessment details
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Details(int id)
        {
            var assessment = await _governanceService.GetAssessmentByIdAsync(id);
            if (assessment == null)
                return NotFound();

            return View(assessment);
        }

        // Only GRC and Admin can create assessments
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Create(int? frameworkId = null, int? organizationId = null)
        {
            try
            {
                Console.WriteLine("=== Create GET Action ===");

                var frameworks = await _governanceService.GetAllFrameworksAsync();
                var organizations = await _governanceService.GetAllOrganizationsAsync();

                Console.WriteLine($"Frameworks loaded: {frameworks.Count()}");
                Console.WriteLine($"Organizations loaded: {organizations.Count()}");

                var model = new ComplianceAssessmentViewModel
                {
                    Assessment = new ComplianceAssessment
                    {
                        StartDate = DateTime.UtcNow,
                        Status = AssessmentStatus.Draft,
                        ComplianceFrameworkId = frameworkId ?? 0,
                        BusinessOrganizationId = organizationId ?? 0
                    },
                    Frameworks = frameworks.ToList(),
                    Organizations = organizations.ToList()
                };

                Console.WriteLine($"Model created - FrameworkId: {model.Assessment.ComplianceFrameworkId}");
                Console.WriteLine($"Model created - OrganizationId: {model.Assessment.BusinessOrganizationId}");

                return View(model);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in Create GET: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                TempData["Error"] = $"Error loading create form: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }

        // Only GRC and Admin can create assessments
        [HttpPost]
        [ValidateAntiForgeryToken]
        [RemoveAuditFields]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Create(ComplianceAssessmentViewModel model)
        {
            if (ModelState.IsValid)
            {
                return await ExecuteWithErrorHandling(
                    async () =>
                    {
                        model.Assessment.Assessor = User.GetUserId();
                        model.Assessment.CreatedAt = DateTime.UtcNow;

                        var createdAssessment = await _governanceService.CreateAssessmentAsync(model.Assessment);
                        return createdAssessment;
                    },
                    createdAssessment =>
                    {
                        TempData["Success"] = "Compliance assessment created successfully.";
                        return RedirectToAction(nameof(Details), new { id = createdAssessment.Id });
                    },
                    "creating compliance assessment"
                );
            }

            // Reload data for the view
            model.Frameworks = (await _governanceService.GetAllFrameworksAsync()).ToList();
            model.Organizations = (await _governanceService.GetAllOrganizationsAsync()).ToList();

            return View(model);
        }

        // Only GRC and Admin can edit assessments
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Edit(int id)
        {
            var assessment = await _governanceService.GetAssessmentByIdAsync(id);
            if (assessment == null)
                return NotFound();

            var model = new ComplianceAssessmentViewModel
            {
                Assessment = assessment,
                Frameworks = (await _governanceService.GetAllFrameworksAsync()).ToList(),
                Organizations = (await _governanceService.GetAllOrganizationsAsync()).ToList()
            };

            return View(model);
        }

        // Only GRC and Admin can edit assessments
        [HttpPost]
        [ValidateAntiForgeryToken]
        [RemoveAuditFields]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Edit(int id, ComplianceAssessmentViewModel model)
        {
            if (id != model.Assessment.Id)
                return NotFound();

            if (ModelState.IsValid)
            {
                return await ExecuteWithErrorHandling(
                    async () =>
                    {
                        await _governanceService.UpdateAssessmentAsync(model.Assessment);
                        return model.Assessment;
                    },
                    _ =>
                    {
                        TempData["Success"] = "Compliance assessment updated successfully.";
                        return RedirectToAction(nameof(Details), new { id });
                    },
                    "updating compliance assessment"
                );
            }

            // Reload data for the view
            model.Frameworks = (await _governanceService.GetAllFrameworksAsync()).ToList();
            model.Organizations = (await _governanceService.GetAllOrganizationsAsync()).ToList();

            return View(model);
        }

        // Only GRC and Admin can delete assessments
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Delete(int id)
        {
            return await ExecuteWithErrorHandling(
                async () =>
                {
                    var success = await _governanceService.DeleteAssessmentAsync(id);
                    if (!success)
                    {
                        throw new InvalidOperationException("Assessment not found or could not be deleted.");
                    }
                    return success;
                },
                _ =>
                {
                    TempData["Success"] = "Compliance assessment deleted successfully.";
                    return RedirectToAction(nameof(Index));
                },
                "deleting compliance assessment",
                nameof(Index)
            );
        }

        // UPDATED: All users can view bulk assessment view
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> BulkView(int id)
        {
            var assessment = await _governanceService.GetAssessmentByIdAsync(id);
            if (assessment == null)
                return NotFound();

            return View(assessment);
        }

        // Only users who can perform assessments can update control assessments
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> UpdateControlAssessment(int id, [FromBody] Dictionary<string, object> data)
        {
            if (!User.CanUserPerformAssessments())
            {
                return Json(new { success = false, message = "You don't have permission to perform assessments." });
            }

            try
            {
                var controlAssessment = await _governanceService.GetControlAssessmentByIdAsync(id);
                if (controlAssessment == null)
                {
                    return Json(new { success = false, message = "Control assessment not found." });
                }

                // Update fields from the data dictionary
                if (data.ContainsKey("Status"))
                {
                    var statusValue = data["Status"]?.ToString();
                    if (!string.IsNullOrEmpty(statusValue) && Enum.TryParse<ComplianceStatus>(statusValue, out var status))
                    {
                        controlAssessment.Status = status;
                    }
                }

                if (data.ContainsKey("Ownership"))
                {
                    controlAssessment.Ownership = data["Ownership"]?.ToString();
                }

                if (data.ContainsKey("ProjectedComplianceDate"))
                {
                    var dateValue = data["ProjectedComplianceDate"]?.ToString();
                    if (!string.IsNullOrEmpty(dateValue) && DateTime.TryParse(dateValue, out var parsedDate))
                    {
                        controlAssessment.ProjectedComplianceDate = parsedDate;
                    }
                }

                if (data.ContainsKey("ProjectNeeded"))
                {
                    var projectNeededValue = data["ProjectNeeded"]?.ToString();
                    if (!string.IsNullOrEmpty(projectNeededValue) && bool.TryParse(projectNeededValue, out var projectNeeded))
                    {
                        controlAssessment.ProjectNeeded = projectNeeded;
                    }
                }

                if (data.ContainsKey("TShirtSize"))
                {
                    var tShirtSizeValue = data["TShirtSize"]?.ToString();
                    if (!string.IsNullOrEmpty(tShirtSizeValue) && Enum.TryParse<TShirtSize>(tShirtSizeValue, out var tShirtSize))
                    {
                        controlAssessment.TShirtSize = tShirtSize;
                    }
                }

                if (data.ContainsKey("ProjectNumber"))
                {
                    controlAssessment.ProjectNumber = data["ProjectNumber"]?.ToString();
                }

                if (data.ContainsKey("GapNotes"))
                {
                    controlAssessment.GapNotes = data["GapNotes"]?.ToString();
                }

                if (data.ContainsKey("EvidenceOfCompliance"))
                {
                    controlAssessment.EvidenceOfCompliance = data["EvidenceOfCompliance"]?.ToString();
                }

                controlAssessment.AssessedBy = User.GetUserId();
                controlAssessment.AssessmentDate = DateTime.UtcNow;

                await _governanceService.UpdateControlAssessmentAsync(controlAssessment);

                return Json(new { success = true });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = $"Error updating control assessment: {ex.Message}" });
            }
        }

        // Only users who can perform assessments can update all control assessments
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> UpdateAllControlAssessments([FromBody] List<Dictionary<string, object>> updates)
        {
            if (!User.CanUserPerformAssessments())
            {
                return Json(new { success = false, message = "You don't have permission to perform assessments." });
            }

            try
            {
                foreach (var update in updates)
                {
                    if (!update.ContainsKey("id"))
                        continue;

                    if (!int.TryParse(update["id"]?.ToString(), out var id))
                        continue;

                    var controlAssessment = await _governanceService.GetControlAssessmentByIdAsync(id);
                    if (controlAssessment == null)
                        continue;

                    // Update fields from the data dictionary
                    if (update.ContainsKey("Status"))
                    {
                        var statusValue = update["Status"]?.ToString();
                        if (!string.IsNullOrEmpty(statusValue) && Enum.TryParse<ComplianceStatus>(statusValue, out var status))
                        {
                            controlAssessment.Status = status;
                        }
                    }

                    if (update.ContainsKey("Ownership"))
                    {
                        controlAssessment.Ownership = update["Ownership"]?.ToString();
                    }

                    if (update.ContainsKey("ProjectedComplianceDate"))
                    {
                        var dateValue = update["ProjectedComplianceDate"]?.ToString();
                        if (!string.IsNullOrEmpty(dateValue) && DateTime.TryParse(dateValue, out var parsedDate))
                        {
                            controlAssessment.ProjectedComplianceDate = parsedDate;
                        }
                    }

                    if (update.ContainsKey("ProjectNeeded"))
                    {
                        var projectNeededValue = update["ProjectNeeded"]?.ToString();
                        if (!string.IsNullOrEmpty(projectNeededValue) && bool.TryParse(projectNeededValue, out var projectNeeded))
                        {
                            controlAssessment.ProjectNeeded = projectNeeded;
                        }
                    }

                    if (update.ContainsKey("TShirtSize"))
                    {
                        var tShirtSizeValue = update["TShirtSize"]?.ToString();
                        if (!string.IsNullOrEmpty(tShirtSizeValue) && Enum.TryParse<TShirtSize>(tShirtSizeValue, out var tShirtSize))
                        {
                            controlAssessment.TShirtSize = tShirtSize;
                        }
                    }

                    if (update.ContainsKey("ProjectNumber"))
                    {
                        controlAssessment.ProjectNumber = update["ProjectNumber"]?.ToString();
                    }

                    if (update.ContainsKey("GapNotes"))
                    {
                        controlAssessment.GapNotes = update["GapNotes"]?.ToString();
                    }

                    if (update.ContainsKey("EvidenceOfCompliance"))
                    {
                        controlAssessment.EvidenceOfCompliance = update["EvidenceOfCompliance"]?.ToString();
                    }

                    controlAssessment.AssessedBy = User.GetUserId();
                    controlAssessment.AssessmentDate = DateTime.UtcNow;

                    await _governanceService.UpdateControlAssessmentAsync(controlAssessment);
                }

                return Json(new { success = true });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = $"Error updating control assessments: {ex.Message}" });
            }
        }

        // Only users who can perform assessments can update selected control assessments
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> UpdateSelectedControlAssessments([FromBody] List<ControlAssessmentUpdate> updates)
        {
            if (!User.CanUserPerformAssessments())
            {
                return Json(new { success = false, message = "You don't have permission to perform assessments." });
            }

            try
            {
                foreach (var update in updates)
                {
                    if (update.Id <= 0)
                        continue;

                    var controlAssessment = await _governanceService.GetControlAssessmentByIdAsync(update.Id);
                    if (controlAssessment == null)
                        continue;

                    // Update fields from the update model
                    if (!string.IsNullOrEmpty(update.Status) && Enum.TryParse<ComplianceStatus>(update.Status, out var status))
                    {
                        controlAssessment.Status = status;
                    }

                    if (!string.IsNullOrEmpty(update.Ownership))
                    {
                        controlAssessment.Ownership = update.Ownership;
                    }

                    if (update.ProjectedComplianceDate.HasValue)
                    {
                        controlAssessment.ProjectedComplianceDate = update.ProjectedComplianceDate.Value;
                    }
                    else if (!string.IsNullOrEmpty(update.ProjectedComplianceDateString))
                    {
                        if (DateTime.TryParse(update.ProjectedComplianceDateString, out var parsedDate))
                        {
                            controlAssessment.ProjectedComplianceDate = parsedDate;
                        }
                    }

                    controlAssessment.ProjectNeeded = update.ProjectNeeded;

                    if (!string.IsNullOrEmpty(update.TShirtSize) && Enum.TryParse<TShirtSize>(update.TShirtSize, out var tShirtSize))
                    {
                        controlAssessment.TShirtSize = tShirtSize;
                    }

                    if (!string.IsNullOrEmpty(update.ProjectNumber))
                    {
                        controlAssessment.ProjectNumber = update.ProjectNumber;
                    }

                    if (!string.IsNullOrEmpty(update.GapNotes))
                    {
                        controlAssessment.GapNotes = update.GapNotes;
                    }

                    if (!string.IsNullOrEmpty(update.EvidenceOfCompliance))
                    {
                        controlAssessment.EvidenceOfCompliance = update.EvidenceOfCompliance;
                    }

                    controlAssessment.AssessedBy = User.GetUserId();
                    controlAssessment.AssessmentDate = DateTime.UtcNow;

                    await _governanceService.UpdateControlAssessmentAsync(controlAssessment);
                }

                return Json(new { success = true });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = $"Error updating selected control assessments: {ex.Message}" });
            }
        }

        // Export functionality
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> ExportToExcel(int id)
        {
            var assessment = await _governanceService.GetAssessmentByIdAsync(id);
            if (assessment == null)
                return NotFound();

            // Simple CSV export as a basic implementation
            var csv = new System.Text.StringBuilder();
            csv.AppendLine("Control ID,Title,Category,Status,Owner,Project Needed,Gap Notes,Evidence");

            foreach (var ca in assessment.ControlAssessments.OrderBy(ca => ca.Control.ControlId))
            {
                csv.AppendLine($"\"{ca.Control.ControlId}\",\"{ca.Control.Title}\",\"{ca.Control.Category}\",\"{ca.Status}\",\"{ca.Ownership ?? ""}\",\"{ca.ProjectNeeded}\",\"{ca.GapNotes?.Replace("\"", "\"\"") ?? ""}\",\"{ca.EvidenceOfCompliance?.Replace("\"", "\"\"") ?? ""}\"");
            }

            var fileName = $"ComplianceAssessment_{assessment.Title}_{DateTime.UtcNow:yyyyMMdd}.csv";
            var bytes = System.Text.Encoding.UTF8.GetBytes(csv.ToString());
            
            return File(bytes, "text/csv", fileName);
        }

        // Assessment workflow actions - only for users who can perform assessments
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> StartAssessment(int id)
        {
            if (!User.CanUserPerformAssessments())
            {
                TempData["Error"] = "You don't have permission to perform assessments.";
                return RedirectToAction(nameof(Details), new { id });
            }

            try
            {
                var assessment = await _governanceService.GetAssessmentByIdAsync(id);
                if (assessment == null)
                    return NotFound();

                assessment.Status = AssessmentStatus.InProgress;
                await _governanceService.UpdateAssessmentAsync(assessment);

                TempData["Success"] = "Assessment started successfully.";
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error starting assessment: {ex.Message}";
            }

            return RedirectToAction(nameof(Details), new { id });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> CompleteAssessment(int id)
        {
            if (!User.CanUserPerformAssessments())
            {
                TempData["Error"] = "You don't have permission to perform assessments.";
                return RedirectToAction(nameof(Details), new { id });
            }

            try
            {
                var assessment = await _governanceService.GetAssessmentByIdAsync(id);
                if (assessment == null)
                    return NotFound();

                assessment.Status = AssessmentStatus.Completed;
                assessment.CompletedDate = DateTime.UtcNow;
                await _governanceService.UpdateAssessmentAsync(assessment);

                TempData["Success"] = "Assessment completed successfully.";
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error completing assessment: {ex.Message}";
            }

            return RedirectToAction(nameof(Details), new { id });
        }
    }
}