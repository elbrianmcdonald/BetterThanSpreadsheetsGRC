using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CyberRiskApp.Data;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.Authorization;
using System.Text.Json;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
    public class AttackChainController : Controller
    {
        private readonly CyberRiskContext _context;
        private readonly IMitreAttackService _mitreService;
        private readonly IMitreImportService _mitreImportService;
        private readonly IRiskLevelSettingsService _riskLevelService;
        private readonly IRiskAssessmentThreatModelService _riskAssessmentThreatModelService;
        private readonly ILogger<AttackChainController> _logger;

        public AttackChainController(
            CyberRiskContext context, 
            IMitreAttackService mitreService,
            IMitreImportService mitreImportService,
            IRiskLevelSettingsService riskLevelService,
            IRiskAssessmentThreatModelService riskAssessmentThreatModelService,
            ILogger<AttackChainController> logger)
        {
            _context = context;
            _mitreService = mitreService;
            _mitreImportService = mitreImportService;
            _riskLevelService = riskLevelService;
            _riskAssessmentThreatModelService = riskAssessmentThreatModelService;
            _logger = logger;
        }

        // GET: AttackChain
        public async Task<IActionResult> Index()
        {
            var attackChains = await _context.AttackChains
                .Include(ac => ac.ThreatEvent)
                .Include(ac => ac.LossEvent)
                .Include(ac => ac.RiskAssessment)
                .Include(ac => ac.Environment)
                .OrderByDescending(ac => ac.CreatedAt)
                .ToListAsync();

            return View(attackChains);
        }

        // GET: AttackChain/AssessmentThreatModels
        // Display all assessment-specific threat models across all risk assessments
        public async Task<IActionResult> AssessmentThreatModels()
        {
            var assessmentThreatModels = await _riskAssessmentThreatModelService.GetAllThreatModelsAsync();
            return View(assessmentThreatModels);
        }

        // GET: AttackChain/CustomizeForAssessment
        // Find the assessment-specific threat model and redirect to edit it
        public async Task<IActionResult> CustomizeForAssessment(int assessmentId, int templateId)
        {
            try
            {
                // Find the assessment-specific threat model that matches the template
                var threatModels = await _riskAssessmentThreatModelService.GetThreatModelsForAssessmentAsync(assessmentId);
                var targetThreatModel = threatModels.FirstOrDefault(tm => tm.TemplateAttackChainId == templateId);

                if (targetThreatModel == null)
                {
                    TempData["Error"] = "Threat model not found for this assessment.";
                    return RedirectToAction("Details", "RiskAssessments", new { id = assessmentId });
                }

                // Redirect to edit the assessment-specific threat model
                return RedirectToAction(nameof(EditAssessmentThreatModel), new { threatModelId = targetThreatModel.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error finding threat model for customization. AssessmentId: {AssessmentId}, TemplateId: {TemplateId}", assessmentId, templateId);
                TempData["Error"] = "Error loading threat model for customization.";
                return RedirectToAction("Details", "RiskAssessments", new { id = assessmentId });
            }
        }

        // GET: AttackChain/Details/5
        public async Task<IActionResult> Details(int? id)
        {
            if (id == null) return NotFound();

            var attackChain = await _context.AttackChains
                .Include(ac => ac.ThreatEvent)
                    .ThenInclude(te => te.MitreTechnique)
                .Include(ac => ac.LossEvent)
                    .ThenInclude(le => le.MitreTechnique)
                .Include(ac => ac.AttackChainSteps)
                    .ThenInclude(acs => acs.Vulnerability)
                        .ThenInclude(v => v.MitreTechnique)
                .Include(ac => ac.RiskAssessment)
                .Include(ac => ac.Environment)
                .FirstOrDefaultAsync(ac => ac.Id == id);

            if (attackChain == null) return NotFound();

            return View(attackChain);
        }

        // GET: AttackChain/Create
        public async Task<IActionResult> Create()
        {
            return View();
        }

        // POST: AttackChain/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(AttackChain model, IFormCollection form)
        {
            try
            {
                // Create the attack chain
                var attackChain = new AttackChain
                {
                    Name = model.Name,
                    Description = model.Description,
                    AssetCategory = model.AssetCategory,
                    AttackVector = model.AttackVector,
                    Status = User.IsInRole("Admin") ? model.Status : AttackChainStatus.Draft,
                    CreatedBy = User.Identity?.Name ?? "Unknown",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedBy = User.Identity?.Name ?? "Unknown",
                    UpdatedAt = DateTime.UtcNow
                };

                // Create Threat Event
                var threatEvent = new ThreatEvent
                {
                    Title = form["ThreatEventTitle"].ToString(),
                    Description = form["ThreatEventDescription"].ToString(),
                    TefMinimum = double.TryParse(form["TefMinimum"].ToString(), out var tefMin) ? tefMin : 0.5,
                    TefMostLikely = double.TryParse(form["TefMostLikely"].ToString(), out var tefMost) ? tefMost : 1,
                    TefMaximum = double.TryParse(form["TefMaximum"].ToString(), out var tefMax) ? tefMax : 2,
                    CreatedBy = User.Identity?.Name ?? "Unknown",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedBy = User.Identity?.Name ?? "Unknown",
                    UpdatedAt = DateTime.UtcNow
                };
                _context.ThreatEvents.Add(threatEvent);
                attackChain.ThreatEvent = threatEvent;

                // Create Loss Event
                var lossEvent = new LossEvent
                {
                    Title = form["LossEventTitle"].ToString(),
                    Description = form["LossEventDescription"].ToString(),
                    PrimaryLossMinimum = double.TryParse(form["PrimaryLossMin"].ToString(), out var plMin) ? plMin : 50000,
                    PrimaryLossMostLikely = double.TryParse(form["PrimaryLossMostLikely"].ToString(), out var plMost) ? plMost : 100000,
                    PrimaryLossMaximum = double.TryParse(form["PrimaryLossMax"].ToString(), out var plMax) ? plMax : 200000,
                    SecondaryLossMinimum = double.TryParse(form["SecondaryLossMin"].ToString(), out var slMin) ? slMin : 10000,
                    SecondaryLossMostLikely = double.TryParse(form["SecondaryLossMostLikely"].ToString(), out var slMost) ? slMost : 25000,
                    SecondaryLossMaximum = double.TryParse(form["SecondaryLossMax"].ToString(), out var slMax) ? slMax : 50000,
                    CreatedBy = User.Identity?.Name ?? "Unknown",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedBy = User.Identity?.Name ?? "Unknown",
                    UpdatedAt = DateTime.UtcNow
                };
                _context.LossEvents.Add(lossEvent);
                attackChain.LossEvent = lossEvent;

                // Add attack chain
                _context.AttackChains.Add(attackChain);
                await _context.SaveChangesAsync();

                // Create Vulnerabilities
                var vulnTitles = form["VulnerabilityTitles[]"];
                var vulnDescriptions = form["VulnerabilityDescriptions[]"];
                var vulnMins = form["VulnMinimums[]"];
                var vulnMostLikelys = form["VulnMostLikelys[]"];
                var vulnMaxs = form["VulnMaximums[]"];

                for (int i = 0; i < vulnTitles.Count; i++)
                {
                    if (!string.IsNullOrWhiteSpace(vulnTitles[i]))
                    {
                        var vulnerability = new AttackStepVulnerability
                        {
                            Title = vulnTitles[i],
                            Description = vulnDescriptions[i],
                            VulnMinimum = double.TryParse(vulnMins[i], out var vMin) ? vMin / 100.0 : 0.3,
                            VulnMostLikely = double.TryParse(vulnMostLikelys[i], out var vMost) ? vMost / 100.0 : 0.5,
                            VulnMaximum = double.TryParse(vulnMaxs[i], out var vMax) ? vMax / 100.0 : 0.7,
                            StepOrder = i + 1,
                            CreatedBy = User.Identity?.Name ?? "Unknown",
                            CreatedAt = DateTime.UtcNow,
                            UpdatedBy = User.Identity?.Name ?? "Unknown",
                            UpdatedAt = DateTime.UtcNow
                        };
                        _context.AttackStepVulnerabilities.Add(vulnerability);

                        var step = new AttackChainStep
                        {
                            AttackChain = attackChain,
                            Vulnerability = vulnerability,
                            StepOrder = i + 1,
                            StepType = AttackChainStepType.VulnerabilityExploitation,
                            StepProbability = vulnerability.VulnMostLikely,
                            CumulativeProbability = vulnerability.VulnMostLikely
                        };
                        _context.AttackChainSteps.Add(step);
                    }
                }

                await _context.SaveChangesAsync();

                TempData["Success"] = "Threat model created successfully!";
                return RedirectToAction(nameof(Details), new { id = attackChain.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating attack chain");
                ModelState.AddModelError("", "An error occurred while creating the threat model.");
                return View(model);
            }
        }

        // GET: AttackChain/Edit/5
        public async Task<IActionResult> Edit(int? id)
        {
            if (id == null) return NotFound();

            var attackChain = await _context.AttackChains.FindAsync(id);
            if (attackChain == null) return NotFound();

            await PrepareViewData();
            return View(attackChain);
        }

        // POST: AttackChain/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, AttackChain attackChain)
        {
            if (id != attackChain.Id) return NotFound();

            if (ModelState.IsValid)
            {
                try
                {
                    attackChain.UpdatedBy = User.Identity?.Name ?? "Unknown";
                    attackChain.UpdatedAt = DateTime.UtcNow;

                    _context.Update(attackChain);
                    await _context.SaveChangesAsync();

                    TempData["Success"] = "Attack chain updated successfully.";
                    return RedirectToAction(nameof(Details), new { id = attackChain.Id });
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!AttackChainExists(attackChain.Id))
                        return NotFound();
                    throw;
                }
            }

            await PrepareViewData();
            return View(attackChain);
        }

        // GET: AttackChain/Delete/5
        public async Task<IActionResult> Delete(int? id)
        {
            if (id == null) return NotFound();

            var attackChain = await _context.AttackChains
                .Include(ac => ac.ThreatEvent)
                .Include(ac => ac.LossEvent)
                .FirstOrDefaultAsync(ac => ac.Id == id);

            if (attackChain == null) return NotFound();

            return View(attackChain);
        }

        // POST: AttackChain/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            var attackChain = await _context.AttackChains.FindAsync(id);
            if (attackChain != null)
            {
                _context.AttackChains.Remove(attackChain);
                await _context.SaveChangesAsync();
                TempData["Success"] = "Attack chain deleted successfully.";
            }

            return RedirectToAction(nameof(Index));
        }

        // GET: AttackChain/ManageSteps/5
        public async Task<IActionResult> ManageSteps(int? id)
        {
            if (id == null) return NotFound();

            var attackChain = await _context.AttackChains
                .Include(ac => ac.ThreatEvent)
                .Include(ac => ac.LossEvent)
                .Include(ac => ac.AttackChainSteps)
                    .ThenInclude(acs => acs.Vulnerability)
                        .ThenInclude(v => v.MitreTechnique)
                .FirstOrDefaultAsync(ac => ac.Id == id);

            if (attackChain == null) return NotFound();

            return View(attackChain);
        }

        // POST: AttackChain/CalculateRisk/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CalculateRisk(int id)
        {
            var attackChain = await _context.AttackChains
                .Include(ac => ac.ThreatEvent)
                .Include(ac => ac.LossEvent)
                .Include(ac => ac.AttackChainSteps)
                    .ThenInclude(acs => acs.Vulnerability)
                .FirstOrDefaultAsync(ac => ac.Id == id);

            if (attackChain == null) return NotFound();

            try
            {
                await CalculateAttackChainRisk(attackChain);
                await _context.SaveChangesAsync();

                TempData["Success"] = "Attack chain risk calculations updated successfully.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating attack chain risk for ID {Id}", id);
                TempData["Error"] = "Error calculating attack chain risk.";
            }

            return RedirectToAction(nameof(Details), new { id });
        }

        // GET: AttackChain/FlowchartDesigner
        public async Task<IActionResult> FlowchartDesigner(int? id, bool readOnly = false)
        {
            AttackChain attackChain = null;
            
            if (id.HasValue)
            {
                attackChain = await _context.AttackChains
                    .Include(ac => ac.ThreatEvent)
                    .Include(ac => ac.LossEvent)
                    .Include(ac => ac.AttackChainSteps)
                        .ThenInclude(acs => acs.Vulnerability)
                    .FirstOrDefaultAsync(ac => ac.Id == id);
                
                if (attackChain == null)
                    return NotFound();
            }
            
            // Load MITRE techniques for dropdowns
            var techniques = await _context.MitreTechniques
                .Select(mt => new { 
                    mt.Id, 
                    mt.TechniqueId, 
                    mt.Name, 
                    mt.Tactic,
                    Display = $"{mt.TechniqueId} - {mt.Name}"
                })
                .OrderBy(mt => mt.TechniqueId)
                .ToListAsync();
            
            ViewData["MitreTechniques"] = techniques;
            ViewData["ReadOnly"] = readOnly;
            
            // Load insurance settings from active risk level threshold
            var riskSettings = await _riskLevelService.GetActiveSettingsAsync();
            ViewData["InsuranceSettings"] = new
            {
                CoverageLimit = riskSettings.InsuranceCoverageLimit,
                Deductible = riskSettings.InsuranceDeductible,
                CoveragePercentage = riskSettings.InsuranceCoveragePercentage,
                EnabledByDefault = riskSettings.InsuranceEnabledByDefault
            };
            
            return View(attackChain);
        }

        // GET: AttackChain/FlowchartBuilder (Redirect to FlowchartDesigner)
        public IActionResult FlowchartBuilder(int? id)
        {
            // Redirect old FlowchartBuilder URLs to FlowchartDesigner
            if (id.HasValue)
            {
                return RedirectToAction("FlowchartDesigner", new { id = id.Value });
            }
            return RedirectToAction("FlowchartDesigner");
        }

        // POST: AttackChain/SaveFlowchartModel
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SaveFlowchartModel([FromBody] FlowchartModelData data)
        {
            return await SaveFlowchartModelInternal(data, true);
        }

        // POST: AttackChain/SaveFlowchartModelDebug (without antiforgery token for testing)
        [HttpPost]
        public async Task<IActionResult> SaveFlowchartModelDebug([FromBody] FlowchartModelData data)
        {
            return await SaveFlowchartModelInternal(data, false);
        }

        // POST: AttackChain/SaveSimpleModel (simple save that works like basic but handles more data)
        [HttpPost]
        public async Task<IActionResult> SaveSimpleModel([FromBody] FlowchartModelData data)
        {
            try
            {
                _logger.LogInformation($"SaveSimpleModel called with ID: {data?.Id}, Title: '{data?.Title}'");
                
                if (data == null)
                {
                    return Json(new { success = false, error = "No data received" });
                }

                if (string.IsNullOrWhiteSpace(data.Title))
                {
                    return Json(new { success = false, error = "Title is required" });
                }

                AttackChain attackChain;
                
                if (data.Id > 0)
                {
                    attackChain = await _context.AttackChains.FindAsync(data.Id);
                    if (attackChain == null)
                    {
                        // Create new if not found
                        attackChain = new AttackChain
                        {
                            CreatedBy = User.Identity?.Name ?? "Unknown",
                            CreatedAt = DateTime.UtcNow,
                            Status = AttackChainStatus.Draft
                        };
                        _context.AttackChains.Add(attackChain);
                    }
                }
                else
                {
                    attackChain = new AttackChain
                    {
                        CreatedBy = User.Identity?.Name ?? "Unknown",
                        CreatedAt = DateTime.UtcNow,
                        Status = AttackChainStatus.Draft
                    };
                    _context.AttackChains.Add(attackChain);
                }

                // Update basic properties
                attackChain.Name = data.Title;
                attackChain.Description = data.Description ?? "";
                attackChain.UpdatedBy = User.Identity?.Name ?? "Unknown";
                attackChain.UpdatedAt = DateTime.UtcNow;
                
                // Handle status change for admins
                if (User.IsInRole("Admin"))
                {
                    if (Enum.IsDefined(typeof(AttackChainStatus), data.Status))
                    {
                        attackChain.Status = (AttackChainStatus)data.Status;
                    }
                }

                // Ensure required foreign keys exist - create placeholder entities if needed
                if (attackChain.ThreatEventId == 0 || attackChain.ThreatEvent == null)
                {
                    var threatEvent = new ThreatEvent
                    {
                        Title = "Default Threat Event",
                        Description = "Auto-created for save",
                        CreatedBy = User.Identity?.Name ?? "Unknown",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedBy = User.Identity?.Name ?? "Unknown",
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.ThreatEvents.Add(threatEvent);
                    attackChain.ThreatEvent = threatEvent;
                }

                if (attackChain.LossEventId == 0 || attackChain.LossEvent == null)
                {
                    var lossEvent = new LossEvent
                    {
                        Title = "Default Loss Event",
                        Description = "Auto-created for save",
                        CreatedBy = User.Identity?.Name ?? "Unknown",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedBy = User.Identity?.Name ?? "Unknown",
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.LossEvents.Add(lossEvent);
                    attackChain.LossEvent = lossEvent;
                }

                await _context.SaveChangesAsync();
                
                return Json(new { success = true, id = attackChain.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SaveSimpleModel");
                return Json(new { success = false, error = ex.Message });
            }
        }

        // POST: AttackChain/SaveWithComponents (save with component data as form fields)
        [HttpPost]
        public async Task<IActionResult> SaveWithComponents(IFormCollection form)
        {
            try
            {
                _logger.LogInformation("SaveWithComponents called");
                
                // Get basic values from form
                var idStr = form["id"].ToString();
                var title = form["title"].ToString();
                var description = form["description"].ToString();
                var statusStr = form["status"].ToString();
                var componentsJson = form["componentsJson"].ToString();
                
                if (string.IsNullOrWhiteSpace(title))
                {
                    return Json(new { success = false, error = "Title is required" });
                }
                
                int id = 0;
                int.TryParse(idStr, out id);
                int status = 0;
                int.TryParse(statusStr, out status);
                
                AttackChain attackChain;
                
                if (id > 0)
                {
                    attackChain = await _context.AttackChains
                        .Include(ac => ac.ThreatEvent)
                        .Include(ac => ac.LossEvent)
                        .Include(ac => ac.AttackChainSteps)
                            .ThenInclude(acs => acs.Vulnerability)
                        .FirstOrDefaultAsync(ac => ac.Id == id);
                        
                    if (attackChain == null)
                    {
                        attackChain = new AttackChain
                        {
                            CreatedBy = User.Identity?.Name ?? "Unknown",
                            CreatedAt = DateTime.UtcNow,
                            Status = AttackChainStatus.Draft
                        };
                        _context.AttackChains.Add(attackChain);
                    }
                }
                else
                {
                    attackChain = new AttackChain
                    {
                        CreatedBy = User.Identity?.Name ?? "Unknown",
                        CreatedAt = DateTime.UtcNow,
                        Status = AttackChainStatus.Draft
                    };
                    _context.AttackChains.Add(attackChain);
                }
                
                // Update basic properties
                attackChain.Name = title;
                attackChain.Description = description;
                attackChain.UpdatedBy = User.Identity?.Name ?? "Unknown";
                attackChain.UpdatedAt = DateTime.UtcNow;
                
                // Handle status for admins
                if (User.IsInRole("Admin") && Enum.IsDefined(typeof(AttackChainStatus), status))
                {
                    attackChain.Status = (AttackChainStatus)status;
                }
                
                // Process components if provided
                if (!string.IsNullOrEmpty(componentsJson))
                {
                    try
                    {
                        var components = System.Text.Json.JsonSerializer.Deserialize<List<Dictionary<string, object>>>(componentsJson);
                        if (components != null && components.Any())
                        {
                            // Clear existing components if updating
                            if (attackChain.Id > 0)
                            {
                                // Remove existing steps
                                var existingSteps = await _context.AttackChainSteps
                                    .Where(acs => acs.AttackChainId == attackChain.Id)
                                    .ToListAsync();
                                _context.AttackChainSteps.RemoveRange(existingSteps);
                            }
                            
                            // Process each component
                            bool hasThreatEvent = false;
                            bool hasLossEvent = false;
                            
                            foreach (var component in components)
                            {
                                if (component.ContainsKey("type"))
                                {
                                    var type = component["type"].ToString();
                                    var componentTitle = component.ContainsKey("title") ? component["title"].ToString() : "Default";
                                    var componentDesc = component.ContainsKey("description") ? component["description"].ToString() : "";
                                    
                                    switch (type)
                                    {
                                        case "threat-event":
                                            if (attackChain.ThreatEvent != null)
                                            {
                                                attackChain.ThreatEvent.Title = componentTitle;
                                                attackChain.ThreatEvent.Description = componentDesc;
                                                attackChain.ThreatEvent.UpdatedBy = User.Identity?.Name ?? "Unknown";
                                                attackChain.ThreatEvent.UpdatedAt = DateTime.UtcNow;
                                            }
                                            else
                                            {
                                                var threatEvent = new ThreatEvent
                                                {
                                                    Title = componentTitle,
                                                    Description = componentDesc,
                                                    CreatedBy = User.Identity?.Name ?? "Unknown",
                                                    CreatedAt = DateTime.UtcNow,
                                                    UpdatedBy = User.Identity?.Name ?? "Unknown",
                                                    UpdatedAt = DateTime.UtcNow
                                                };
                                                _context.ThreatEvents.Add(threatEvent);
                                                attackChain.ThreatEvent = threatEvent;
                                            }
                                            hasThreatEvent = true;
                                            break;
                                            
                                        case "vulnerability":
                                            var vulnerability = new AttackStepVulnerability
                                            {
                                                Title = componentTitle,
                                                Description = componentDesc,
                                                StepOrder = 1,
                                                VulnMinimum = 0.3,
                                                VulnMostLikely = 0.5,
                                                VulnMaximum = 0.7,
                                                CreatedBy = User.Identity?.Name ?? "Unknown",
                                                CreatedAt = DateTime.UtcNow,
                                                UpdatedBy = User.Identity?.Name ?? "Unknown",
                                                UpdatedAt = DateTime.UtcNow
                                            };
                                            _context.AttackStepVulnerabilities.Add(vulnerability);
                                            
                                            var step = new AttackChainStep
                                            {
                                                AttackChain = attackChain,
                                                Vulnerability = vulnerability,
                                                StepOrder = 1,
                                                StepType = AttackChainStepType.VulnerabilityExploitation,
                                                StepProbability = 0.5,
                                                CumulativeProbability = 0.5
                                            };
                                            _context.AttackChainSteps.Add(step);
                                            break;
                                            
                                        case "loss-event":
                                            if (attackChain.LossEvent != null)
                                            {
                                                attackChain.LossEvent.Title = componentTitle;
                                                attackChain.LossEvent.Description = componentDesc;
                                                attackChain.LossEvent.UpdatedBy = User.Identity?.Name ?? "Unknown";
                                                attackChain.LossEvent.UpdatedAt = DateTime.UtcNow;
                                            }
                                            else
                                            {
                                                var lossEvent = new LossEvent
                                                {
                                                    Title = componentTitle,
                                                    Description = componentDesc,
                                                    CreatedBy = User.Identity?.Name ?? "Unknown",
                                                    CreatedAt = DateTime.UtcNow,
                                                    UpdatedBy = User.Identity?.Name ?? "Unknown",
                                                    UpdatedAt = DateTime.UtcNow
                                                };
                                                _context.LossEvents.Add(lossEvent);
                                                attackChain.LossEvent = lossEvent;
                                            }
                                            hasLossEvent = true;
                                            break;
                                    }
                                }
                            }
                            
                            // Ensure we have required events
                            if (!hasThreatEvent && attackChain.ThreatEvent == null)
                            {
                                var threatEvent = new ThreatEvent
                                {
                                    Title = "Default Threat Event",
                                    Description = "Auto-created",
                                    CreatedBy = User.Identity?.Name ?? "Unknown",
                                    CreatedAt = DateTime.UtcNow,
                                    UpdatedBy = User.Identity?.Name ?? "Unknown",
                                    UpdatedAt = DateTime.UtcNow
                                };
                                _context.ThreatEvents.Add(threatEvent);
                                attackChain.ThreatEvent = threatEvent;
                            }
                            
                            if (!hasLossEvent && attackChain.LossEvent == null)
                            {
                                var lossEvent = new LossEvent
                                {
                                    Title = "Default Loss Event",
                                    Description = "Auto-created",
                                    CreatedBy = User.Identity?.Name ?? "Unknown",
                                    CreatedAt = DateTime.UtcNow,
                                    UpdatedBy = User.Identity?.Name ?? "Unknown",
                                    UpdatedAt = DateTime.UtcNow
                                };
                                _context.LossEvents.Add(lossEvent);
                                attackChain.LossEvent = lossEvent;
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning($"Could not parse components JSON: {ex.Message}");
                    }
                }
                
                // Ensure required foreign keys exist if no components were processed
                if (attackChain.ThreatEventId == 0 || attackChain.ThreatEvent == null)
                {
                    var threatEvent = new ThreatEvent
                    {
                        Title = "Default Threat Event",
                        Description = "Auto-created",
                        CreatedBy = User.Identity?.Name ?? "Unknown",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedBy = User.Identity?.Name ?? "Unknown",
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.ThreatEvents.Add(threatEvent);
                    attackChain.ThreatEvent = threatEvent;
                }
                
                if (attackChain.LossEventId == 0 || attackChain.LossEvent == null)
                {
                    var lossEvent = new LossEvent
                    {
                        Title = "Default Loss Event",
                        Description = "Auto-created",
                        CreatedBy = User.Identity?.Name ?? "Unknown",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedBy = User.Identity?.Name ?? "Unknown",
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.LossEvents.Add(lossEvent);
                    attackChain.LossEvent = lossEvent;
                }
                
                await _context.SaveChangesAsync();
                
                return Json(new { success = true, id = attackChain.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SaveWithComponents");
                return Json(new { success = false, error = ex.Message });
            }
        }
        
        // POST: AttackChain/SaveFormData (form-based save that definitely works)
        [HttpPost]
        public async Task<IActionResult> SaveFormData(IFormCollection form)
        {
            try
            {
                _logger.LogInformation("SaveFormData called with form data");
                
                // Get values from form
                var idStr = form["id"].ToString();
                var title = form["title"].ToString();
                var description = form["description"].ToString();
                var statusStr = form["status"].ToString();
                
                if (string.IsNullOrWhiteSpace(title))
                {
                    return Json(new { success = false, error = "Title is required" });
                }
                
                int id = 0;
                int.TryParse(idStr, out id);
                int status = 0;
                int.TryParse(statusStr, out status);
                
                AttackChain attackChain;
                
                if (id > 0)
                {
                    attackChain = await _context.AttackChains.FindAsync(id);
                    if (attackChain == null)
                    {
                        attackChain = new AttackChain
                        {
                            CreatedBy = User.Identity?.Name ?? "Unknown",
                            CreatedAt = DateTime.UtcNow,
                            Status = AttackChainStatus.Draft
                        };
                        _context.AttackChains.Add(attackChain);
                    }
                }
                else
                {
                    attackChain = new AttackChain
                    {
                        CreatedBy = User.Identity?.Name ?? "Unknown",
                        CreatedAt = DateTime.UtcNow,
                        Status = AttackChainStatus.Draft
                    };
                    _context.AttackChains.Add(attackChain);
                }
                
                // Update properties
                attackChain.Name = title;
                attackChain.Description = description;
                attackChain.UpdatedBy = User.Identity?.Name ?? "Unknown";
                attackChain.UpdatedAt = DateTime.UtcNow;
                
                // Handle status for admins
                if (User.IsInRole("Admin") && Enum.IsDefined(typeof(AttackChainStatus), status))
                {
                    attackChain.Status = (AttackChainStatus)status;
                }
                
                // Ensure required foreign keys
                if (attackChain.ThreatEventId == 0 || attackChain.ThreatEvent == null)
                {
                    var threatEvent = new ThreatEvent
                    {
                        Title = "Default Threat Event",
                        Description = "Auto-created",
                        CreatedBy = User.Identity?.Name ?? "Unknown",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedBy = User.Identity?.Name ?? "Unknown",
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.ThreatEvents.Add(threatEvent);
                    attackChain.ThreatEvent = threatEvent;
                }
                
                if (attackChain.LossEventId == 0 || attackChain.LossEvent == null)
                {
                    var lossEvent = new LossEvent
                    {
                        Title = "Default Loss Event",
                        Description = "Auto-created",
                        CreatedBy = User.Identity?.Name ?? "Unknown",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedBy = User.Identity?.Name ?? "Unknown",
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.LossEvents.Add(lossEvent);
                    attackChain.LossEvent = lossEvent;
                }
                
                await _context.SaveChangesAsync();
                
                return Json(new { success = true, id = attackChain.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SaveFormData");
                return Json(new { success = false, error = ex.Message });
            }
        }
        
        // POST: AttackChain/SaveBasicModel (minimal model for testing)
        [HttpPost]
        public async Task<IActionResult> SaveBasicModel([FromBody] BasicFlowchartData data)
        {
            try
            {
                _logger.LogInformation($"SaveBasicModel called with ID: {data?.Id}, Title: '{data?.Title}'");
                
                if (data == null)
                {
                    return Json(new { success = false, error = "No data received" });
                }

                if (string.IsNullOrWhiteSpace(data.Title))
                {
                    return Json(new { success = false, error = "Title is required" });
                }

                // For basic save, we need to create minimal ThreatEvent and LossEvent since they are required
                ThreatEvent threatEvent = new ThreatEvent
                {
                    Title = "Default Threat Event",
                    Description = "Auto-created for basic save",
                    CreatedBy = User.Identity?.Name ?? "Unknown",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedBy = User.Identity?.Name ?? "Unknown",
                    UpdatedAt = DateTime.UtcNow
                };
                _context.ThreatEvents.Add(threatEvent);

                LossEvent lossEvent = new LossEvent
                {
                    Title = "Default Loss Event", 
                    Description = "Auto-created for basic save",
                    CreatedBy = User.Identity?.Name ?? "Unknown",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedBy = User.Identity?.Name ?? "Unknown",
                    UpdatedAt = DateTime.UtcNow
                };
                _context.LossEvents.Add(lossEvent);

                AttackChain attackChain;
                
                if (data.Id > 0)
                {
                    attackChain = await _context.AttackChains.FindAsync(data.Id);
                    if (attackChain == null)
                    {
                        attackChain = new AttackChain
                        {
                            ThreatEvent = threatEvent,
                            LossEvent = lossEvent,
                            CreatedBy = User.Identity?.Name ?? "Unknown",
                            CreatedAt = DateTime.UtcNow,
                            Status = AttackChainStatus.Draft
                        };
                        _context.AttackChains.Add(attackChain);
                    }
                    else
                    {
                        // For existing attack chain, don't overwrite existing ThreatEvent and LossEvent
                        // Just remove the ones we created since they're not needed
                        _context.ThreatEvents.Remove(threatEvent);
                        _context.LossEvents.Remove(lossEvent);
                    }
                }
                else
                {
                    attackChain = new AttackChain
                    {
                        ThreatEvent = threatEvent,
                        LossEvent = lossEvent,
                        CreatedBy = User.Identity?.Name ?? "Unknown",
                        CreatedAt = DateTime.UtcNow,
                        Status = AttackChainStatus.Draft
                    };
                    _context.AttackChains.Add(attackChain);
                }

                // Update basic properties only
                attackChain.Name = data.Title;
                attackChain.Description = data.Description ?? "";
                attackChain.UpdatedBy = User.Identity?.Name ?? "Unknown";
                attackChain.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                
                return Json(new { success = true, id = attackChain.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SaveBasicModel");
                return Json(new { success = false, error = ex.Message });
            }
        }

        private async Task<IActionResult> SaveFlowchartModelInternal(FlowchartModelData data, bool validateToken)
        {
            try
            {
                // Log the raw request data
                _logger.LogInformation($"SaveFlowchartModelInternal called - ValidateToken: {validateToken}");
                _logger.LogInformation($"User: {User.Identity?.Name}, IsAuthenticated: {User.Identity?.IsAuthenticated}, IsAdmin: {User.IsInRole("Admin")}");
                
                // Check if data is null
                if (data == null)
                {
                    _logger.LogError("FlowchartModelData is null");
                    return Json(new { success = false, error = "No data received" });
                }
                
                _logger.LogInformation($"Data: ID={data.Id}, Title='{data?.Title}', Description='{data?.Description}', Status={data.Status}, Components count={data.Components?.Count ?? 0}");
                
                // Validate required fields
                if (string.IsNullOrWhiteSpace(data.Title))
                {
                    _logger.LogError("Title is required but was null or empty");
                    return Json(new { success = false, error = "Title is required" });
                }
                
                AttackChain attackChain;
                
                if (data.Id > 0)
                {
                    // Update existing - first try to find it
                    attackChain = await _context.AttackChains
                        .Include(ac => ac.ThreatEvent)
                        .Include(ac => ac.LossEvent)
                        .Include(ac => ac.AttackChainSteps)
                            .ThenInclude(acs => acs.Vulnerability)
                        .FirstOrDefaultAsync(ac => ac.Id == data.Id);
                    
                    if (attackChain == null)
                    {
                        _logger.LogWarning($"Attack chain with ID {data.Id} not found. Creating new one instead.");
                        // If not found, create new instead of failing
                        attackChain = new AttackChain
                        {
                            CreatedBy = User.Identity?.Name ?? "Unknown",
                            CreatedAt = DateTime.UtcNow,
                            Status = AttackChainStatus.Draft
                        };
                        _context.AttackChains.Add(attackChain);
                    }
                    else
                    {
                        _logger.LogInformation($"Found existing attack chain with ID {data.Id} for update");
                    }
                }
                else
                {
                    // Create new
                    _logger.LogInformation("Creating new attack chain");
                    attackChain = new AttackChain
                    {
                        CreatedBy = User.Identity?.Name ?? "Unknown",
                        CreatedAt = DateTime.UtcNow,
                        Status = AttackChainStatus.Draft
                    };
                    _context.AttackChains.Add(attackChain);
                }
                
                // Update basic properties
                attackChain.Name = data.Title;
                attackChain.Description = data.Description;
                attackChain.UpdatedBy = User.Identity?.Name ?? "Unknown";
                attackChain.UpdatedAt = DateTime.UtcNow;
                
                // Only allow admins to change status
                if (User.IsInRole("Admin"))
                {
                    if (Enum.IsDefined(typeof(AttackChainStatus), data.Status))
                    {
                        var newStatus = (AttackChainStatus)data.Status;
                        if (attackChain.Status != newStatus)
                        {
                            var oldStatus = attackChain.Status;
                            attackChain.Status = newStatus;
                            _logger.LogInformation($"Admin {User.Identity?.Name} changed attack chain {attackChain.Id} status from {oldStatus} to {newStatus}");
                        }
                    }
                }
                else
                {
                    // For non-admins, ensure new models start as Draft
                    if (attackChain.Id == 0)
                    {
                        attackChain.Status = AttackChainStatus.Draft;
                    }
                    // Don't allow non-admins to change status of existing models
                }
                
                // Process components from flowchart
                _logger.LogInformation($"Processing {data.Components?.Count ?? 0} components");
                if (data.Components != null && data.Components.Any())
                {
                    await ProcessFlowchartComponents(attackChain, data.Components);
                }
                
                // Ensure we always have ThreatEvent and LossEvent (required foreign keys)
                if (attackChain.ThreatEvent == null)
                {
                    _logger.LogInformation("Creating placeholder ThreatEvent for foreign key constraint");
                    var threatEvent = new ThreatEvent
                    {
                        Title = "Default Threat Event",
                        Description = "Auto-created for save",
                        CreatedBy = User.Identity?.Name ?? "Unknown",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedBy = User.Identity?.Name ?? "Unknown",
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.ThreatEvents.Add(threatEvent);
                    attackChain.ThreatEvent = threatEvent;
                }
                
                if (attackChain.LossEvent == null)
                {
                    _logger.LogInformation("Creating placeholder LossEvent for foreign key constraint");
                    var lossEvent = new LossEvent
                    {
                        Title = "Default Loss Event",
                        Description = "Auto-created for save",
                        CreatedBy = User.Identity?.Name ?? "Unknown",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedBy = User.Identity?.Name ?? "Unknown",
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.LossEvents.Add(lossEvent);
                    attackChain.LossEvent = lossEvent;
                }
                
                _logger.LogInformation("Saving changes to database");
                await _context.SaveChangesAsync();
                
                _logger.LogInformation($"Successfully saved attack chain with ID: {attackChain.Id}");
                return Json(new { success = true, id = attackChain.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error saving flowchart model. Data ID: {data?.Id ?? 0}, Title: '{data?.Title ?? "null"}', Components: {data?.Components?.Count ?? 0}");
                _logger.LogError($"Exception Type: {ex.GetType().Name}");
                _logger.LogError($"Stack Trace: {ex.StackTrace}");
                return Json(new { success = false, error = "Error saving threat model: " + ex.Message, exceptionType = ex.GetType().Name });
            }
        }

        // GET: AttackChain/CheckMitreData
        [HttpGet]
        public async Task<IActionResult> CheckMitreData()
        {
            var techniques = await _context.MitreTechniques
                .Take(10)
                .Select(mt => new { 
                    mt.Id, 
                    mt.TechniqueId, 
                    mt.Name, 
                    mt.Tactic
                })
                .ToListAsync();
            
            return Json(new {
                count = await _context.MitreTechniques.CountAsync(),
                sample = techniques
            });
        }

        // API endpoint for threat model data
        [HttpGet]
        [Route("api/attackchains/threat-model/{id}")]
        public async Task<IActionResult> GetThreatModelData(int id)
        {
            try
            {
                // Get threat model info
                var threatModel = await _context.ThreatModels.FindAsync(id);
                if (threatModel == null)
                {
                    return Json(new { success = false, error = "Threat model not found" });
                }

                // Look for existing attack chains that might be associated with this threat model
                // Since AttackChain doesn't have ThreatModelId, we'll look for attack chains with similar names or descriptions
                var potentialChain = await _context.AttackChains
                    .Include(ac => ac.ThreatEvent)
                        .ThenInclude(te => te.MitreTechnique)
                    .Include(ac => ac.LossEvent)
                        .ThenInclude(le => le.MitreTechnique)
                    .Include(ac => ac.AttackChainSteps)
                        .ThenInclude(acs => acs.Vulnerability)
                            .ThenInclude(v => v.MitreTechnique)
                    .Where(ac => ac.Name.Contains(threatModel.Name) || 
                                ac.Description.Contains(threatModel.Description) ||
                                ac.Name == $"Threat Model: {threatModel.Name}")
                    .FirstOrDefaultAsync();

                if (potentialChain != null)
                {
                    // Return existing attack chain data
                    return Json(new {
                        success = true,
                        threatModelId = id,
                        attackChainId = potentialChain.Id,
                        name = threatModel.Name,
                        description = threatModel.Description,
                        components = BuildComponentsFromAttackChain(potentialChain)
                    });
                }

                // Return basic threat model info with empty components
                return Json(new {
                    success = true,
                    threatModelId = id,
                    attackChainId = (int?)null,
                    name = threatModel.Name,
                    description = threatModel.Description,
                    components = new List<object>() // Empty components for new threat model
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading threat model data for ID {Id}", id);
                return Json(new { success = false, error = "Error loading threat model data" });
            }
        }

        // GET: AttackChain/MitreDataManagement
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> MitreDataManagement()
        {
            try
            {
                ViewBag.CurrentTechniqueCount = await _mitreImportService.GetCurrentTechniqueCountAsync();
                ViewBag.FrameworkCounts = await _mitreImportService.GetFrameworkTechniqueCountsAsync();
                ViewBag.MitreVersion = await _mitreImportService.GetMitreVersionAsync();
                
                return View();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading MITRE data management page");
                TempData["Error"] = "Error loading MITRE data management page: " + ex.Message;
                return RedirectToAction(nameof(Index));
            }
        }

        // API: Get approved threat models for FAIR assessment
        [HttpGet]
        [Route("api/AttackChain/GetApprovedModels")]
        public async Task<IActionResult> GetApprovedModels()
        {
            try
            {
                var models = await _context.AttackChains
                    .Include(ac => ac.ThreatEvent)
                    .Include(ac => ac.LossEvent)
                    .Where(ac => ac.Status == AttackChainStatus.Approved || ac.Status == AttackChainStatus.Reviewed)
                    .Select(ac => new
                    {
                        id = ac.Id,
                        name = ac.Name,
                        description = ac.Description,
                        status = ac.Status.ToString(),
                        tef = ac.ThreatEvent != null ? ac.ThreatEvent.TefMostLikely : 1.0,
                        vulnerability = ac.ChainProbability,
                        aleMinimum = ac.ChainAleMinimum,
                        aleMaximum = ac.ChainAleMaximum,
                        aleMostLikely = ac.ChainAleMostLikely
                    })
                    .ToListAsync();

                return Json(models);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading approved threat models");
                return Json(new List<object>());
            }
        }

        // API: Get flowchart data for a threat model
        [HttpGet]
        [Route("api/AttackChain/GetFlowchartData/{id}")]
        public async Task<IActionResult> GetFlowchartData(int id)
        {
            try
            {
                var attackChain = await _context.AttackChains
                    .Include(ac => ac.ThreatEvent)
                        .ThenInclude(te => te.MitreTechnique)
                    .Include(ac => ac.LossEvent)
                        .ThenInclude(le => le.MitreTechnique)
                    .Include(ac => ac.AttackChainSteps)
                        .ThenInclude(acs => acs.Vulnerability)
                            .ThenInclude(v => v.MitreTechnique)
                    .FirstOrDefaultAsync(ac => ac.Id == id);

                if (attackChain == null)
                {
                    return NotFound();
                }

                var nodes = new List<object>();
                var links = new List<object>();

                // Add threat event node
                if (attackChain.ThreatEvent != null)
                {
                    nodes.Add(new
                    {
                        key = $"threat_{attackChain.ThreatEvent.Id}",
                        text = attackChain.ThreatEvent.Title,
                        color = "#ffc107",
                        stroke = "#ff9800"
                    });
                }

                // Add vulnerability nodes
                foreach (var step in attackChain.AttackChainSteps.Where(s => s.Vulnerability != null).OrderBy(s => s.StepOrder))
                {
                    nodes.Add(new
                    {
                        key = $"vuln_{step.VulnerabilityId}",
                        text = step.Vulnerability.Title,
                        color = "#17a2b8",
                        stroke = "#138496"
                    });

                    // Add link from previous node
                    if (step.StepOrder == 1 && attackChain.ThreatEvent != null)
                    {
                        links.Add(new
                        {
                            from = $"threat_{attackChain.ThreatEvent.Id}",
                            to = $"vuln_{step.VulnerabilityId}"
                        });
                    }
                    else if (step.StepOrder > 1)
                    {
                        var prevStep = attackChain.AttackChainSteps
                            .Where(s => s.StepOrder == step.StepOrder - 1 && s.Vulnerability != null)
                            .FirstOrDefault();
                        if (prevStep != null)
                        {
                            links.Add(new
                            {
                                from = $"vuln_{prevStep.VulnerabilityId}",
                                to = $"vuln_{step.VulnerabilityId}"
                            });
                        }
                    }
                }

                // Add loss event node
                if (attackChain.LossEvent != null)
                {
                    nodes.Add(new
                    {
                        key = $"loss_{attackChain.LossEvent.Id}",
                        text = attackChain.LossEvent.Title,
                        color = "#dc3545",
                        stroke = "#c82333"
                    });

                    // Link last vulnerability to loss event
                    var lastStep = attackChain.AttackChainSteps
                        .Where(s => s.Vulnerability != null)
                        .OrderByDescending(s => s.StepOrder)
                        .FirstOrDefault();
                    if (lastStep != null)
                    {
                        links.Add(new
                        {
                            from = $"vuln_{lastStep.VulnerabilityId}",
                            to = $"loss_{attackChain.LossEvent.Id}"
                        });
                    }
                }

                return Json(new { nodes, links });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading flowchart data for attack chain {Id}", id);
                return Json(new { nodes = new List<object>(), links = new List<object>() });
            }
        }

        // Helper methods

        private async Task PrepareViewData()
        {
            ViewData["ThreatEvents"] = await _context.ThreatEvents
                .Select(te => new { te.Id, te.Title })
                .ToListAsync();

            ViewData["LossEvents"] = await _context.LossEvents
                .Select(le => new { le.Id, le.Title })
                .ToListAsync();

            ViewData["RiskAssessments"] = await _context.RiskAssessments
                .Select(ra => new { ra.Id, ra.Title })
                .ToListAsync();

            ViewData["Environments"] = await _context.ThreatEnvironments
                .Select(te => new { te.Id, te.EnvironmentType })
                .ToListAsync();
        }

        private bool AttackChainExists(int id)
        {
            return _context.AttackChains.Any(ac => ac.Id == id);
        }

        private async Task ProcessFlowchartComponents(AttackChain attackChain, List<FlowchartComponent> components)
        {
            // Check if we have replacement threat-event and loss-event components
            bool hasThreatEvent = components.Any(c => c.Type == "threat-event");
            bool hasLossEvent = components.Any(c => c.Type == "loss-event");
            
            // Only clear existing components if this is an update (ID > 0) AND we have replacements
            if (attackChain.Id > 0)
            {
                // Only clear existing ThreatEvent if we have a replacement
                if (hasThreatEvent && attackChain.ThreatEvent != null)
                {
                    _context.ThreatEvents.Remove(attackChain.ThreatEvent);
                    attackChain.ThreatEvent = null;
                }
                
                // Only clear existing LossEvent if we have a replacement
                if (hasLossEvent && attackChain.LossEvent != null)
                {
                    _context.LossEvents.Remove(attackChain.LossEvent);
                    attackChain.LossEvent = null;
                }
                
                // Remove existing vulnerability steps
                var existingSteps = await _context.AttackChainSteps
                    .Where(acs => acs.AttackChainId == attackChain.Id)
                    .Include(acs => acs.Vulnerability)
                    .ToListAsync();
                
                foreach (var step in existingSteps)
                {
                    if (step.Vulnerability != null)
                    {
                        _context.AttackStepVulnerabilities.Remove(step.Vulnerability);
                    }
                    _context.AttackChainSteps.Remove(step);
                }
            }
            
            // Process new components
            foreach (var component in components)
            {
                switch (component.Type)
                {
                    case "threat-event":
                        var threatEvent = new ThreatEvent
                        {
                            Title = component.Title,
                            Description = component.Description,
                            TefMinimum = component.Properties?.TefMinimum ?? 0,
                            TefMostLikely = component.Properties?.TefMostLikely ?? 0,
                            TefMaximum = component.Properties?.TefMaximum ?? 0,
                            MitreTechniqueId = component.Properties?.MitreTechniqueId,
                            CreatedBy = User.Identity?.Name ?? "Unknown",
                            CreatedAt = DateTime.UtcNow,
                            UpdatedBy = User.Identity?.Name ?? "Unknown",
                            UpdatedAt = DateTime.UtcNow
                        };
                        _context.ThreatEvents.Add(threatEvent);
                        attackChain.ThreatEvent = threatEvent;
                        break;
                        
                    case "loss-event":
                        var lossEvent = new LossEvent
                        {
                            Title = component.Title,
                            Description = component.Description,
                            PrimaryLossMinimum = component.Properties?.PrimaryLossMinimum,
                            PrimaryLossMostLikely = component.Properties?.PrimaryLossMostLikely,
                            PrimaryLossMaximum = component.Properties?.PrimaryLossMaximum,
                            SecondaryLossMinimum = component.Properties?.SecondaryLossMinimum,
                            SecondaryLossMostLikely = component.Properties?.SecondaryLossMostLikely,
                            SecondaryLossMaximum = component.Properties?.SecondaryLossMaximum,
                            LossType = component.Properties?.LossType,
                            BusinessImpactCategory = component.Properties?.BusinessImpactCategory,
                            MitreTechniqueId = component.Properties?.MitreTechniqueId,
                            CreatedBy = User.Identity?.Name ?? "Unknown",
                            CreatedAt = DateTime.UtcNow,
                            UpdatedBy = User.Identity?.Name ?? "Unknown",
                            UpdatedAt = DateTime.UtcNow
                        };
                        _context.LossEvents.Add(lossEvent);
                        attackChain.LossEvent = lossEvent;
                        break;
                        
                    case "vulnerability":
                        var vulnerability = new AttackStepVulnerability
                        {
                            Title = component.Title,
                            Description = component.Description,
                            StepOrder = component.Properties?.StepOrder ?? 1,
                            VulnMinimum = component.Properties?.VulnMinimum ?? 0,
                            VulnMostLikely = component.Properties?.VulnMostLikely ?? 0,
                            VulnMaximum = component.Properties?.VulnMaximum ?? 0,
                            MitreTechniqueId = component.Properties?.MitreTechniqueId,
                            CreatedBy = User.Identity?.Name ?? "Unknown",
                            CreatedAt = DateTime.UtcNow,
                            UpdatedBy = User.Identity?.Name ?? "Unknown",
                            UpdatedAt = DateTime.UtcNow
                        };
                        _context.AttackStepVulnerabilities.Add(vulnerability);
                        
                        var attackChainStep = new AttackChainStep
                        {
                            AttackChain = attackChain,
                            Vulnerability = vulnerability,
                            StepOrder = component.Properties?.StepOrder ?? 1
                        };
                        _context.AttackChainSteps.Add(attackChainStep);
                        break;
                }
            }
        }

        private async Task CalculateAttackChainRisk(AttackChain attackChain)
        {
            // Calculate cumulative probability through the attack chain
            double cumulativeProbability = 1.0;

            // Start with TEF from threat event
            var threatEvent = attackChain.ThreatEvent;
            var tef = (threatEvent.TefMinimum + threatEvent.TefMaximum + threatEvent.TefMostLikely) / 3.0;

            // Multiply by each vulnerability's likelihood
            foreach (var step in attackChain.AttackChainSteps.OrderBy(s => s.StepOrder))
            {
                if (step.Vulnerability != null)
                {
                    var vulnLikelihood = (step.Vulnerability.VulnMinimum + step.Vulnerability.VulnMaximum + step.Vulnerability.VulnMostLikely) / 3.0;
                    cumulativeProbability *= vulnLikelihood;
                    step.StepProbability = vulnLikelihood;
                    step.CumulativeProbability = cumulativeProbability;
                }
            }

            // Calculate LEF (Loss Event Frequency)
            var lef = tef * cumulativeProbability;

            // Update loss event with calculated LEF
            var lossEvent = attackChain.LossEvent;
            lossEvent.LefMinimum = threatEvent.TefMinimum * cumulativeProbability * 0.8; // Conservative estimate
            lossEvent.LefMaximum = threatEvent.TefMaximum * cumulativeProbability * 1.2; // Optimistic estimate
            lossEvent.LefMostLikely = lef;

            // Calculate ALE if loss values are provided
            if (lossEvent.PrimaryLossMostLikely.HasValue)
            {
                var totalLoss = lossEvent.PrimaryLossMostLikely.Value + (lossEvent.SecondaryLossMostLikely ?? 0);
                lossEvent.AleMostLikely = lef * totalLoss;
                lossEvent.AleMinimum = lossEvent.LefMinimum * totalLoss;
                lossEvent.AleMaximum = lossEvent.LefMaximum * totalLoss;
            }

            // Update attack chain summary
            attackChain.ChainProbability = cumulativeProbability;
            attackChain.ChainAleMostLikely = lossEvent.AleMostLikely;
            attackChain.ChainAleMinimum = lossEvent.AleMinimum;
            attackChain.ChainAleMaximum = lossEvent.AleMaximum;

            attackChain.UpdatedAt = DateTime.UtcNow;
            attackChain.UpdatedBy = User.Identity?.Name ?? "System";
        }

        private List<object> BuildComponentsFromAttackChain(AttackChain attackChain)
        {
            var components = new List<object>();
            int order = 0;

            // Add threat event
            if (attackChain.ThreatEvent != null)
            {
                var te = attackChain.ThreatEvent;
                components.Add(new {
                    id = $"threat-event-{te.Id}",
                    type = "threat-event",
                    order = order++,
                    title = te.Title ?? "Threat Event",
                    description = te.Description ?? "",
                    properties = new {
                        mitreTechniqueId = te.MitreTechniqueId,
                        mitreDisplay = te.MitreTechnique?.Name ?? "Unknown",
                        tefMinimum = te.TefMinimum,
                        tefMostLikely = te.TefMostLikely,
                        tefMaximum = te.TefMaximum
                    }
                });
            }

            // Add vulnerabilities in order
            if (attackChain.AttackChainSteps != null)
            {
                foreach (var step in attackChain.AttackChainSteps.OrderBy(s => s.StepOrder))
                {
                    if (step.Vulnerability != null)
                    {
                        var v = step.Vulnerability;
                        components.Add(new {
                            id = $"vulnerability-{v.Id}",
                            type = "vulnerability",
                            order = order++,
                            title = v.Title ?? "Vulnerability",
                            description = v.Description ?? "",
                            properties = new {
                                mitreTechniqueId = v.MitreTechniqueId,
                                mitreDisplay = v.MitreTechnique?.Name ?? "Unknown",
                                vulnMinimum = v.VulnMinimum,
                                vulnMostLikely = v.VulnMostLikely,
                                vulnMaximum = v.VulnMaximum,
                                stepOrder = v.StepOrder
                            }
                        });
                    }
                }
            }

            // Add loss event
            if (attackChain.LossEvent != null)
            {
                var le = attackChain.LossEvent;
                components.Add(new {
                    id = $"loss-event-{le.Id}",
                    type = "loss-event",
                    order = order++,
                    title = le.Title ?? "Loss Event",
                    description = le.Description ?? "",
                    properties = new {
                        mitreTechniqueId = le.MitreTechniqueId,
                        mitreDisplay = le.MitreTechnique?.Name ?? "Unknown",
                        primaryLossMinimum = le.PrimaryLossMinimum,
                        primaryLossMostLikely = le.PrimaryLossMostLikely,
                        primaryLossMaximum = le.PrimaryLossMaximum,
                        secondaryLossMinimum = le.SecondaryLossMinimum,
                        secondaryLossMostLikely = le.SecondaryLossMostLikely,
                        secondaryLossMaximum = le.SecondaryLossMaximum,
                        lefMinimum = le.LefMinimum,
                        lefMostLikely = le.LefMostLikely,
                        lefMaximum = le.LefMaximum,
                        aleMostLikely = le.AleMostLikely,
                        lossType = le.LossType,
                        businessImpactCategory = le.BusinessImpactCategory
                    }
                });
            }

            return components;
        }

        // GET: AttackChain/EditAssessmentThreatModel/{threatModelId}
        // This allows editing assessment-specific threat models via the FlowchartDesigner
        public async Task<IActionResult> EditAssessmentThreatModel(int threatModelId, bool readOnly = false)
        {
            try
            {
                // Get the assessment-specific threat model
                var threatModel = await _riskAssessmentThreatModelService.GetThreatModelByIdAsync(threatModelId);
                if (threatModel == null)
                {
                    TempData["Error"] = "Threat model not found.";
                    return RedirectToAction("Index", "RiskAssessments");
                }

                // Create a temporary AttackChain-like structure for the FlowchartDesigner
                var attackChain = new AttackChain
                {
                    Id = 0, // This indicates it's assessment-specific, not a template
                    Name = threatModel.Title,
                    Description = threatModel.Description,
                    Status = threatModel.Status,
                    ChainAleMostLikely = (double)threatModel.ALEMostLikely,
                    ChainAleMinimum = (double)threatModel.ALEMinimum,
                    ChainAleMaximum = (double)threatModel.ALEMaximum
                };

                // Store the assessment threat model ID for saving later
                ViewBag.AssessmentThreatModelId = threatModelId;
                ViewBag.RiskAssessmentId = threatModel.RiskAssessmentId;
                ViewBag.IsAssessmentSpecific = true;
                ViewBag.ReadOnly = readOnly;

                // Get risk level settings for insurance configuration
                var riskSettings = await _riskLevelService.GetSettingsByIdAsync(1);
                ViewBag.InsuranceSettings = new {
                    CoverageLimit = riskSettings.InsuranceCoverageLimit,
                    Deductible = riskSettings.InsuranceDeductible,
                    CoveragePercentage = riskSettings.InsuranceCoveragePercentage,
                    EnabledByDefault = riskSettings.InsuranceEnabledByDefault
                };

                return View("FlowchartDesigner", attackChain);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading assessment threat model {ThreatModelId}", threatModelId);
                TempData["Error"] = "Error loading threat model for editing.";
                return RedirectToAction("Index", "RiskAssessments");
            }
        }

        // POST: AttackChain/SaveAssessmentThreatModel
        // Save updates to assessment-specific threat model
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SaveAssessmentThreatModel([FromBody] AssessmentThreatModelData data)
        {
            try
            {
                if (data == null || data.ThreatModelId <= 0)
                {
                    return Json(new { success = false, error = "Invalid threat model data" });
                }

                if (string.IsNullOrWhiteSpace(data.Title))
                {
                    return Json(new { success = false, error = "Title is required" });
                }

                // Extract JSON data from components
                var threatEventData = ExtractThreatEventData(data.Components);
                var vulnerabilitiesData = ExtractVulnerabilitiesData(data.Components);
                var lossEventData = ExtractLossEventData(data.Components);

                // Save using the RiskAssessmentThreatModelService
                var success = await _riskAssessmentThreatModelService.UpdateThreatModelAsync(
                    data.ThreatModelId,
                    threatEventData,
                    vulnerabilitiesData,
                    lossEventData,
                    User.Identity?.Name ?? "System"
                );

                if (success)
                {
                    return Json(new { success = true, threatModelId = data.ThreatModelId });
                }
                else
                {
                    return Json(new { success = false, error = "Failed to save threat model" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving assessment threat model");
                return Json(new { success = false, error = "Error saving threat model: " + ex.Message });
            }
        }

        // Helper methods for extracting JSON data from components
        private string ExtractThreatEventData(List<FlowchartComponent>? components)
        {
            var threatEvent = components?.FirstOrDefault(c => c.Type == "threat-event");
            if (threatEvent == null) return "{}";

            var data = new
            {
                title = threatEvent.Title,
                description = threatEvent.Description,
                tefMin = threatEvent.Properties?.TefMinimum ?? 0,
                tefMost = threatEvent.Properties?.TefMostLikely ?? 0,
                tefMax = threatEvent.Properties?.TefMaximum ?? 0,
                mitreTechniqueId = threatEvent.Properties?.MitreTechniqueId,
                protectiveControls = new string[0], // Placeholder for controls
                detectiveControls = new string[0]   // Placeholder for controls
            };

            return JsonSerializer.Serialize(data);
        }

        private string ExtractVulnerabilitiesData(List<FlowchartComponent>? components)
        {
            var vulnerabilities = components?.Where(c => c.Type == "vulnerability").ToList();
            if (vulnerabilities == null || !vulnerabilities.Any()) return "[]";

            var data = vulnerabilities.Select((v, index) => new
            {
                title = v.Title,
                description = v.Description,
                stepOrder = v.Properties?.StepOrder ?? (index + 1),
                vulnMin = v.Properties?.VulnMinimum ?? 0,
                vulnMost = v.Properties?.VulnMostLikely ?? 0,
                vulnMax = v.Properties?.VulnMaximum ?? 0,
                mitreTechniqueId = v.Properties?.MitreTechniqueId,
                protectiveControls = new string[0], // Placeholder for controls
                detectiveControls = new string[0]   // Placeholder for controls
            }).ToList();

            return JsonSerializer.Serialize(data);
        }

        private string ExtractLossEventData(List<FlowchartComponent>? components)
        {
            var lossEvent = components?.FirstOrDefault(c => c.Type == "loss-event");
            if (lossEvent == null) return "{}";

            var data = new
            {
                title = lossEvent.Title,
                description = lossEvent.Description,
                primaryLossMin = lossEvent.Properties?.PrimaryLossMinimum ?? 0,
                primaryLossMost = lossEvent.Properties?.PrimaryLossMostLikely ?? 0,
                primaryLossMax = lossEvent.Properties?.PrimaryLossMaximum ?? 0,
                secondaryLossMin = lossEvent.Properties?.SecondaryLossMinimum ?? 0,
                secondaryLossMost = lossEvent.Properties?.SecondaryLossMostLikely ?? 0,
                secondaryLossMax = lossEvent.Properties?.SecondaryLossMaximum ?? 0,
                lossType = lossEvent.Properties?.LossType,
                businessImpactCategory = lossEvent.Properties?.BusinessImpactCategory,
                mitreTechniqueId = lossEvent.Properties?.MitreTechniqueId,
                protectiveControls = new string[0], // Placeholder for controls
                detectiveControls = new string[0]   // Placeholder for controls
            };

            return JsonSerializer.Serialize(data);
        }

        // POST: AttackChain/SaveAssessmentThreatModel (Form-based version)
        // Save updates to assessment-specific threat model from FlowchartDesigner form
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SaveAssessmentThreatModel(
            int threatModelId, 
            string title, 
            string description, 
            string threatEventData, 
            string vulnerabilitiesData, 
            string lossEventData)
        {
            try
            {
                if (threatModelId <= 0)
                {
                    return Json(new { success = false, error = "Invalid threat model ID" });
                }

                if (string.IsNullOrWhiteSpace(title))
                {
                    return Json(new { success = false, error = "Title is required" });
                }

                // Save using the RiskAssessmentThreatModelService
                var success = await _riskAssessmentThreatModelService.UpdateThreatModelAsync(
                    threatModelId,
                    threatEventData ?? "{}",
                    vulnerabilitiesData ?? "[]",
                    lossEventData ?? "{}",
                    User.Identity?.Name ?? "System"
                );

                if (success)
                {
                    return Json(new { success = true, threatModelId = threatModelId });
                }
                else
                {
                    return Json(new { success = false, error = "Failed to save threat model" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving assessment threat model from form data");
                return Json(new { success = false, error = "Error saving threat model: " + ex.Message });
            }
        }
    }

    // Data model for assessment-specific threat model saving
    public class AssessmentThreatModelData
    {
        public int ThreatModelId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<FlowchartComponent>? Components { get; set; } = new List<FlowchartComponent>();
    }

    // Data models for flowchart
    public class FlowchartModelData
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int Status { get; set; } = 0; // Default to Draft
        public List<FlowchartComponent>? Components { get; set; } = new List<FlowchartComponent>();
        public List<FlowchartConnection>? Connections { get; set; } = new List<FlowchartConnection>();
    }

    public class FlowchartComponent
    {
        public string Id { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public double X { get; set; }
        public double Y { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public FlowchartComponentProperties? Properties { get; set; }
    }

    public class FlowchartComponentProperties
    {
        // Common properties
        public int? MitreTechniqueId { get; set; }
        
        // Threat Event properties
        public double? TefMinimum { get; set; }
        public double? TefMostLikely { get; set; }
        public double? TefMaximum { get; set; }
        
        // Vulnerability properties
        public int? StepOrder { get; set; }
        public double? VulnMinimum { get; set; }
        public double? VulnMostLikely { get; set; }
        public double? VulnMaximum { get; set; }
        
        // Loss Event properties
        public double? PrimaryLossMinimum { get; set; }
        public double? PrimaryLossMostLikely { get; set; }
        public double? PrimaryLossMaximum { get; set; }
        public double? SecondaryLossMinimum { get; set; }
        public double? SecondaryLossMostLikely { get; set; }
        public double? SecondaryLossMaximum { get; set; }
        public string? LossType { get; set; }
        public string? BusinessImpactCategory { get; set; }
        public double? AleMostLikely { get; set; }
    }

    public class FlowchartConnection
    {
        public string From { get; set; } = string.Empty;
        public string To { get; set; } = string.Empty;
    }

    // Simplified model for testing
    public class BasicFlowchartData
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
    }
}