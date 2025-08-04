using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Rendering;
using CyberRiskApp.Models;
using CyberRiskApp.Models.DTOs;
using CyberRiskApp.Services;
using CyberRiskApp.Authorization;
using Microsoft.Extensions.Logging;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
    public class ThreatModelingController : Controller
    {
        private readonly IThreatModelingService _threatModelingService;
        private readonly IMitreImportService _mitreImportService;
        private readonly ILogger<ThreatModelingController> _logger;

        public ThreatModelingController(IThreatModelingService threatModelingService, IMitreImportService mitreImportService, ILogger<ThreatModelingController> logger)
        {
            _threatModelingService = threatModelingService;
            _mitreImportService = mitreImportService;
            _logger = logger;
        }

        // GET: ThreatModeling
        public async Task<IActionResult> Index()
        {
            try
            {
                var threatModels = await _threatModelingService.GetAllThreatModelsAsync();
                return View(threatModels);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading threat models");
                TempData["Error"] = "Error loading threat models: " + ex.Message;
                return View(new List<ThreatModel>());
            }
        }

        // GET: ThreatModeling/Details/5
        public async Task<IActionResult> Details(int id)
        {
            var threatModel = await _threatModelingService.GetThreatModelByIdAsync(id);
            if (threatModel == null)
                return NotFound();

            // Get analytics data for the threat model
            ViewBag.AttackCountByPhase = await _threatModelingService.GetAttackCountByKillChainPhaseAsync(id);
            ViewBag.AttackCountByRisk = await _threatModelingService.GetAttackCountByRiskLevelAsync(id);
            ViewBag.AttackCountByActor = await _threatModelingService.GetAttackCountByThreatActorAsync(id);
            ViewBag.AttackCountByVector = await _threatModelingService.GetAttackCountByVectorAsync(id);
            
            // Get enhanced threat modeling data
            ViewBag.Scenarios = await _threatModelingService.GetAttackScenariosByThreatModelIdAsync(id);

            return View(threatModel);
        }

        // GET: ThreatModeling/Create
        public IActionResult Create()
        {
            PopulateDropdowns();
            var model = new ThreatModel
            {
                Status = ThreatModelStatus.Draft,
                CreatedBy = User.Identity?.Name ?? "Unknown"
            };
            return View(model);
        }

        // POST: ThreatModeling/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(ThreatModel threatModel)
        {
            // Only validate the fields we're actually using in the form
            ModelState.Remove("Asset"); // Remove validation for Asset since we'll set it manually
            
            if (ModelState.IsValid)
            {
                try
                {
                    // Set required values for fields not included in the simplified form
                    threatModel.CreatedBy = User.Identity?.Name ?? "Unknown";
                    threatModel.Asset = string.IsNullOrEmpty(threatModel.Asset) ? "TBD" : threatModel.Asset;
                    threatModel.BusinessUnit = threatModel.BusinessUnit ?? "";
                    threatModel.AssetOwner = threatModel.AssetOwner ?? "";
                    threatModel.CreatedAt = DateTime.UtcNow;
                    threatModel.UpdatedAt = DateTime.UtcNow;
                    
                    await _threatModelingService.CreateThreatModelAsync(threatModel);
                    
                    TempData["Success"] = "Threat model created successfully.";
                    return RedirectToAction(nameof(Details), new { id = threatModel.Id });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error creating threat model");
                    TempData["Error"] = "Error creating threat model: " + ex.Message;
                }
            }

            PopulateDropdowns();
            return View(threatModel);
        }

        // GET: ThreatModeling/Edit/5
        public async Task<IActionResult> Edit(int id)
        {
            var threatModel = await _threatModelingService.GetThreatModelByIdAsync(id);
            if (threatModel == null)
                return NotFound();

            PopulateDropdowns();
            return View(threatModel);
        }

        // POST: ThreatModeling/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, ThreatModel threatModel)
        {
            if (id != threatModel.Id)
                return NotFound();

            if (ModelState.IsValid)
            {
                try
                {
                    await _threatModelingService.UpdateThreatModelAsync(threatModel);
                    TempData["Success"] = "Threat model updated successfully.";
                    return RedirectToAction(nameof(Details), new { id = threatModel.Id });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error updating threat model");
                    TempData["Error"] = "Error updating threat model: " + ex.Message;
                }
            }

            PopulateDropdowns();
            return View(threatModel);
        }

        // POST: ThreatModeling/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            try
            {
                var threatModel = await _threatModelingService.GetThreatModelByIdAsync(id);
                if (threatModel == null)
                {
                    TempData["Error"] = "Threat model not found.";
                    return RedirectToAction(nameof(Index));
                }

                var success = await _threatModelingService.DeleteThreatModelAsync(id);
                if (success)
                {
                    TempData["Success"] = $"Threat model '{threatModel.Name}' deleted successfully.";
                }
                else
                {
                    TempData["Error"] = "Failed to delete threat model.";
                }

                return RedirectToAction(nameof(Index));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting threat model with ID: {Id}", id);
                TempData["Error"] = $"Error deleting threat model: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }

        // GET: ThreatModeling/CreateAttack/5
        public async Task<IActionResult> CreateAttack(int threatModelId)
        {
            var threatModel = await _threatModelingService.GetThreatModelByIdAsync(threatModelId);
            if (threatModel == null)
                return NotFound();

            await PopulateAttackDropdownsAsync();
            
            var attack = new Attack
            {
                ThreatModelId = threatModelId,
                KillChainPhase = CyberKillChainPhase.Reconnaissance,
                AttackVector = AttackVector.Network,
                AttackComplexity = AttackComplexity.Medium,
                ThreatActorType = ThreatActorType.Cybercriminal,
                Impact = ImpactLevel.Medium,
                Likelihood = LikelihoodLevel.Possible,
                RiskLevel = RiskLevel.Medium,
                DetectionDifficulty = AttackComplexity.Medium,
                ResidualRisk = RiskLevel.Low,
                TreatmentStrategy = TreatmentStrategy.Mitigate
            };

            ViewBag.ThreatModelName = threatModel.Name;
            return View(attack);
        }

        // POST: ThreatModeling/CreateAttack
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateAttack(Attack attack)
        {
            if (ModelState.IsValid)
            {
                try
                {
                    await _threatModelingService.CreateAttackAsync(attack);
                    TempData["Success"] = "Attack scenario created successfully.";
                    return RedirectToAction(nameof(Details), new { id = attack.ThreatModelId });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error creating attack");
                    TempData["Error"] = "Error creating attack: " + ex.Message;
                }
            }

            await PopulateAttackDropdownsAsync();
            var threatModel = await _threatModelingService.GetThreatModelByIdAsync(attack.ThreatModelId);
            ViewBag.ThreatModelName = threatModel?.Name ?? "Unknown";
            return View(attack);
        }

        // GET: ThreatModeling/EditAttack/5
        public async Task<IActionResult> EditAttack(int id)
        {
            var attack = await _threatModelingService.GetAttackByIdAsync(id);
            if (attack == null)
                return NotFound();

            await PopulateAttackDropdownsAsync();
            ViewBag.ThreatModelName = attack.ThreatModel?.Name ?? "Unknown";
            return View(attack);
        }

        // POST: ThreatModeling/EditAttack/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> EditAttack(int id, Attack attack)
        {
            if (id != attack.Id)
                return NotFound();

            if (ModelState.IsValid)
            {
                try
                {
                    await _threatModelingService.UpdateAttackAsync(attack);
                    TempData["Success"] = "Attack scenario updated successfully.";
                    return RedirectToAction(nameof(Details), new { id = attack.ThreatModelId });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error updating attack");
                    TempData["Error"] = "Error updating attack: " + ex.Message;
                }
            }

            await PopulateAttackDropdownsAsync();
            var threatModel = await _threatModelingService.GetThreatModelByIdAsync(attack.ThreatModelId);
            ViewBag.ThreatModelName = threatModel?.Name ?? "Unknown";
            return View(attack);
        }

        // POST: ThreatModeling/DeleteAttack/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> DeleteAttack(int id)
        {
            try
            {
                var attack = await _threatModelingService.GetAttackByIdAsync(id);
                if (attack == null)
                {
                    TempData["Error"] = "Attack not found.";
                    return RedirectToAction(nameof(Index));
                }

                var threatModelId = attack.ThreatModelId;
                var success = await _threatModelingService.DeleteAttackAsync(id);
                
                if (success)
                {
                    TempData["Success"] = $"Attack scenario '{attack.Name}' deleted successfully.";
                }
                else
                {
                    TempData["Error"] = "Failed to delete attack scenario.";
                }

                return RedirectToAction(nameof(Details), new { id = threatModelId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting attack with ID: {Id}", id);
                TempData["Error"] = $"Error deleting attack: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }

        // GET: ThreatModeling/Analytics
        public async Task<IActionResult> Analytics()
        {
            try
            {
                ViewBag.OverallAttackCountByPhase = await _threatModelingService.GetAttackCountByKillChainPhaseAsync();
                ViewBag.OverallAttackCountByRisk = await _threatModelingService.GetAttackCountByRiskLevelAsync();
                ViewBag.OverallAttackCountByActor = await _threatModelingService.GetAttackCountByThreatActorAsync();
                ViewBag.OverallAttackCountByVector = await _threatModelingService.GetAttackCountByVectorAsync();
                
                var highRiskAttacks = await _threatModelingService.GetHighRiskAttacksAsync();
                var activeThreatModels = await _threatModelingService.GetActiveThreatModelsAsync();
                var attacksRequiringMitigation = await _threatModelingService.GetAttacksRequiringMitigationAsync();

                ViewBag.HighRiskAttacks = highRiskAttacks;
                ViewBag.ActiveThreatModels = activeThreatModels;
                ViewBag.AttacksRequiringMitigation = attacksRequiringMitigation;

                return View();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading analytics");
                TempData["Error"] = "Error loading analytics: " + ex.Message;
                return View();
            }
        }

        // POST: ThreatModeling/UpdateStatus/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateStatus(int id, ThreatModelStatus status, string? notes)
        {
            try
            {
                var success = await _threatModelingService.UpdateThreatModelStatusAsync(id, status, notes);
                if (success)
                {
                    TempData["Success"] = $"Threat model status updated to {status}.";
                }
                else
                {
                    TempData["Error"] = "Failed to update threat model status.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating threat model status");
                TempData["Error"] = "Error updating status: " + ex.Message;
            }

            return RedirectToAction(nameof(Details), new { id });
        }

        private void PopulateDropdowns()
        {
            ViewBag.ThreatModelStatuses = Enum.GetValues<ThreatModelStatus>()
                .Select(s => new SelectListItem { Value = ((int)s).ToString(), Text = s.ToString() })
                .ToList();
                
            ViewBag.Frameworks = Enum.GetValues<ThreatModelingFramework>()
                .Select(f => new SelectListItem { Value = ((int)f).ToString(), Text = f.ToString() })
                .ToList();
        }

        private async Task PopulateAttackDropdownsAsync()
        {
            // Populate kill chain phases
            ViewBag.KillChainPhases = Enum.GetValues<CyberKillChainPhase>()
                .Select(p => new SelectListItem { Value = ((int)p).ToString(), Text = p.ToString() })
                .ToList();

            // Populate attack vectors
            ViewBag.AttackVectors = Enum.GetValues<AttackVector>()
                .Select(v => new SelectListItem { Value = ((int)v).ToString(), Text = v.ToString().Replace("_", " ") })
                .ToList();

            // Populate attack complexity
            ViewBag.AttackComplexities = Enum.GetValues<AttackComplexity>()
                .Select(c => new SelectListItem { Value = ((int)c).ToString(), Text = c.ToString() })
                .ToList();

            // Populate threat actor types
            ViewBag.ThreatActorTypes = Enum.GetValues<ThreatActorType>()
                .Select(t => new SelectListItem { Value = ((int)t).ToString(), Text = t.ToString().Replace("_", " ") })
                .ToList();

            // Populate impact levels
            ViewBag.ImpactLevels = Enum.GetValues<ImpactLevel>()
                .Select(i => new SelectListItem { Value = ((int)i).ToString(), Text = i.ToString() })
                .ToList();

            // Populate likelihood levels
            ViewBag.LikelihoodLevels = Enum.GetValues<LikelihoodLevel>()
                .Select(l => new SelectListItem { Value = ((int)l).ToString(), Text = l.ToString() })
                .ToList();

            // Populate risk levels
            ViewBag.RiskLevels = Enum.GetValues<RiskLevel>()
                .Select(r => new SelectListItem { Value = ((int)r).ToString(), Text = r.ToString() })
                .ToList();

            // Populate treatment strategies
            ViewBag.TreatmentStrategies = Enum.GetValues<TreatmentStrategy>()
                .Select(t => new SelectListItem { Value = ((int)t).ToString(), Text = t.ToString() })
                .ToList();

            // Populate available findings and risks for linking
            try
            {
                var findings = await _threatModelingService.GetAvailableFindingsAsync();
                ViewBag.AvailableFindings = findings?.Select(f => new SelectListItem
                {
                    Value = f.Id.ToString(),
                    Text = $"{f.FindingNumber} - {f.Title}"
                }).ToList() ?? new List<SelectListItem>();

                var risks = await _threatModelingService.GetAvailableRisksAsync();
                ViewBag.AvailableRisks = risks?.Select(r => new SelectListItem
                {
                    Value = r.Id.ToString(),
                    Text = $"{r.RiskNumber} - {r.Title}"
                }).ToList() ?? new List<SelectListItem>();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error loading available findings and risks for dropdowns");
                ViewBag.AvailableFindings = new List<SelectListItem>();
                ViewBag.AvailableRisks = new List<SelectListItem>();
            }
        }
        
        
        // Attack Scenario Management
        
        // GET: ThreatModeling/Scenarios/5
        public async Task<IActionResult> Scenarios(int id)
        {
            var threatModel = await _threatModelingService.GetThreatModelByIdAsync(id);
            if (threatModel == null)
                return NotFound();
                
            var scenarios = await _threatModelingService.GetAttackScenariosByThreatModelIdAsync(id);
            ViewBag.ThreatModel = threatModel;
            
            return View(scenarios);
        }
        
        // GET: ThreatModeling/CreateScenario/5 - Redirect to visual scenario builder
        public IActionResult CreateScenario(int id)
        {
            // Redirect to the visual scenario builder for creating new scenarios
            return RedirectToAction(nameof(ScenarioBuilder), new { id = id });
        }
        
        // POST: ThreatModeling/CreateScenario
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateScenario(AttackScenario scenario)
        {
            // Ensure valid enum values
            if (scenario.Complexity == 0)
                scenario.Complexity = AttackComplexity.Low;

            if (ModelState.IsValid)
            {
                try
                {
                    // Ensure ID is 0 for creation (let database auto-generate)
                    scenario.Id = 0;
                    scenario.CreatedAt = DateTime.UtcNow;
                    scenario.UpdatedAt = DateTime.UtcNow;
                    
                    await _threatModelingService.CreateAttackScenarioAsync(scenario);
                    TempData["Success"] = "Attack scenario created successfully.";
                    return RedirectToAction(nameof(ScenarioDetails), new { id = scenario.Id });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error creating attack scenario");
                    TempData["Error"] = "Error creating attack scenario: " + ex.Message;
                }
            }
            
            var threatModel = await _threatModelingService.GetThreatModelByIdAsync(scenario.ThreatModelId);
            ViewBag.ThreatModel = threatModel;
            PopulateScenarioDropdowns();
            
            return View(scenario);
        }
        
        // GET: ThreatModeling/ScenarioDetails/5
        public async Task<IActionResult> ScenarioDetails(int id)
        {
            var scenario = await _threatModelingService.GetAttackScenarioByIdAsync(id);
            if (scenario == null)
                return NotFound();
                
            ViewBag.KillChainFlow = await _threatModelingService.GetKillChainFlowAsync(id);
            
            return View(scenario);
        }
        
        // POST: ThreatModeling/DeleteScenario/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteScenario(int id)
        {
            try
            {
                var scenario = await _threatModelingService.GetAttackScenarioByIdAsync(id);
                if (scenario == null)
                    return NotFound();
                
                var threatModelId = scenario.ThreatModelId;
                
                var success = await _threatModelingService.DeleteAttackScenarioAsync(id);
                if (success)
                {
                    TempData["Success"] = "Attack scenario deleted successfully.";
                }
                else
                {
                    TempData["Error"] = "Failed to delete attack scenario. It may be referenced by other data.";
                }
                
                return RedirectToAction(nameof(Scenarios), new { id = threatModelId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting attack scenario {ScenarioId}", id);
                TempData["Error"] = "Error deleting attack scenario: " + ex.Message;
                return RedirectToAction(nameof(Index));
            }
        }
        
        // GET: ThreatModeling/ScenarioBuilder/5 - Combined attack scenario creation and visual builder
        public async Task<IActionResult> ScenarioBuilder(int id, int? scenarioId = null)
        {
            var threatModel = await _threatModelingService.GetThreatModelByIdAsync(id);
            if (threatModel == null)
                return NotFound();

            AttackScenario scenario;
            
            if (scenarioId.HasValue)
            {
                // Edit existing scenario
                scenario = await _threatModelingService.GetAttackScenarioByIdAsync(scenarioId.Value);
                if (scenario == null || scenario.ThreatModelId != id)
                    return NotFound();
            }
            else
            {
                // Create new scenario
                scenario = new AttackScenario
                {
                    ThreatModelId = id,
                    Status = ScenarioStatus.Draft,
                    Name = "New Attack Scenario",
                    Description = "Describe the attack scenario..."
                };
            }
            
            // Convert MITRE techniques to DTOs to avoid circular references
            var allTechniques = await _threatModelingService.GetAllMitreTechniquesAsync();
            var techniqueDtos = allTechniques.Select(MitreTechniqueDto.FromMitreTechnique).ToList();
            
            // Load Kill Chain activities
            var killChainActivities = await _threatModelingService.GetAllKillChainActivitiesAsync();
            
            ViewBag.ThreatModel = threatModel;
            ViewBag.Techniques = techniqueDtos;
            ViewBag.KillChainActivities = killChainActivities;
            
            return View(scenario);
        }
        
        // MITRE ATT&CK Technique Management
        
        // GET: ThreatModeling/Techniques
        public async Task<IActionResult> Techniques(string? search, string? tactic)
        {
            IEnumerable<MitreTechnique> techniques;
            
            if (!string.IsNullOrEmpty(search))
            {
                techniques = await _threatModelingService.SearchMitreTechniquesAsync(search);
            }
            else if (!string.IsNullOrEmpty(tactic))
            {
                techniques = await _threatModelingService.GetMitreTechniquesByTacticAsync(tactic);
            }
            else
            {
                techniques = await _threatModelingService.GetAllMitreTechniquesAsync();
            }
            
            ViewBag.Tactics = new[]
            {
                "Initial Access", "Execution", "Persistence", "Privilege Escalation",
                "Defense Evasion", "Credential Access", "Discovery", "Lateral Movement",
                "Collection", "Command and Control", "Exfiltration", "Impact"
            };
            
            return View(techniques);
        }
        
        
        // GET: ThreatModeling/GetMitreTechniqueById
        public async Task<IActionResult> GetMitreTechniqueById(int id)
        {
            try
            {
                var technique = await _threatModelingService.GetMitreTechniqueByIdAsync(id);
                if (technique == null)
                    return NotFound();
                    
                return Json(technique);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting MITRE technique by ID");
                return NotFound();
            }
        }
        
        // GET: ThreatModeling/GetAllThreatModels
        public async Task<IActionResult> GetAllThreatModels()
        {
            try
            {
                var threatModels = await _threatModelingService.GetAllThreatModelsAsync();
                return Json(threatModels.Select(tm => new { id = tm.Id, name = tm.Name }));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all threat models");
                return Json(new List<object>());
            }
        }
        
        // GET: ThreatModeling/LockheedTechniqueMapper/5
        public async Task<IActionResult> LockheedTechniqueMapper(int id)
        {
            var threatModel = await _threatModelingService.GetThreatModelByIdAsync(id);
            if (threatModel == null)
                return NotFound();
                
            var killChainActivities = await _threatModelingService.GetAllKillChainActivitiesAsync();
            ViewBag.ThreatModel = threatModel;
            ViewBag.KillChainActivities = killChainActivities;
            
            return View(killChainActivities);
        }
        
        
        // Custom Kill Chain Activity Management
        
        // POST: ThreatModeling/CreateKillChainActivity
        [HttpPost]
        public async Task<IActionResult> CreateKillChainActivity([FromBody] KillChainActivity activity)
        {
            try
            {
                activity.IsCustom = true;
                activity.CreatedAt = DateTime.UtcNow;
                activity.UpdatedAt = DateTime.UtcNow;
                
                var result = await _threatModelingService.CreateKillChainActivityAsync(activity);
                return Json(new { success = true, activity = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating custom kill chain activity");
                return Json(new { success = false, error = ex.Message });
            }
        }
        
        // GET: ThreatModeling/GetKillChainActivities
        public async Task<IActionResult> GetKillChainActivities(string? phase = null)
        {
            try
            {
                IEnumerable<KillChainActivity> activities;
                
                if (!string.IsNullOrEmpty(phase))
                {
                    if (Enum.TryParse<CyberKillChainPhase>(phase, out var killChainPhase))
                    {
                        activities = await _threatModelingService.GetKillChainActivitiesByPhaseAsync(killChainPhase);
                    }
                    else
                    {
                        activities = new List<KillChainActivity>();
                    }
                }
                else
                {
                    activities = await _threatModelingService.GetAllKillChainActivitiesAsync();
                }
                
                return Json(activities);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting kill chain activities");
                return Json(new List<KillChainActivity>());
            }
        }
        
        // PUT: ThreatModeling/UpdateKillChainActivity
        [HttpPut]
        public async Task<IActionResult> UpdateKillChainActivity([FromBody] KillChainActivity activity)
        {
            try
            {
                var result = await _threatModelingService.UpdateKillChainActivityAsync(activity);
                return Json(new { success = true, activity = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating kill chain activity");
                return Json(new { success = false, error = ex.Message });
            }
        }
        
        // DELETE: ThreatModeling/DeleteKillChainActivity/5
        [HttpDelete]
        public async Task<IActionResult> DeleteKillChainActivity(int id)
        {
            try
            {
                var success = await _threatModelingService.DeleteKillChainActivityAsync(id);
                return Json(new { success });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting kill chain activity");
                return Json(new { success = false, error = ex.Message });
            }
        }
        
        // Analytics Actions
        
        
        // GET: ThreatModeling/CriticalPaths/5
        public async Task<IActionResult> CriticalPaths(int id)
        {
            var threatModel = await _threatModelingService.GetThreatModelByIdAsync(id);
            if (threatModel == null)
                return NotFound();
                
            var criticalPaths = await _threatModelingService.GetCriticalAttackPathsAsync(id);
            ViewBag.ThreatModel = threatModel;
            
            return View(criticalPaths);
        }
        
        // GET: ThreatModeling/TechniqueMapper/5
        public async Task<IActionResult> TechniqueMapper(int id)
        {
            var threatModel = await _threatModelingService.GetThreatModelByIdAsync(id);
            if (threatModel == null)
                return NotFound();
                
            var techniques = await _threatModelingService.GetAllMitreTechniquesAsync();
            ViewBag.ThreatModel = threatModel;
            
            return View(techniques);
        }
        
        // POST: ThreatModeling/DuplicateScenario
        [HttpPost]
        public async Task<IActionResult> DuplicateScenario(int id)
        {
            try
            {
                var originalScenario = await _threatModelingService.GetAttackScenarioByIdAsync(id);
                if (originalScenario == null)
                    return Json(new { success = false, error = "Scenario not found" });
                
                // Create a duplicate with modified name
                var duplicateScenario = new AttackScenario
                {
                    ThreatModelId = originalScenario.ThreatModelId,
                    Name = $"{originalScenario.Name} (Copy)",
                    Description = originalScenario.Description,
                    InitialAccess = originalScenario.InitialAccess,
                    Objective = originalScenario.Objective,
                    EstimatedDurationHours = originalScenario.EstimatedDurationHours,
                    Complexity = originalScenario.Complexity,
                    ExistingControls = originalScenario.ExistingControls,
                    ControlGaps = originalScenario.ControlGaps,
                    RecommendedMitigations = originalScenario.RecommendedMitigations,
                    Status = ScenarioStatus.Draft
                };
                
                await _threatModelingService.CreateAttackScenarioAsync(duplicateScenario);
                return Json(new { success = true, id = duplicateScenario.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error duplicating scenario");
                return Json(new { success = false, error = ex.Message });
            }
        }
        
        
        private void PopulateScenarioDropdowns()
        {
            ViewBag.ThreatActorTypes = Enum.GetValues<ThreatActorType>()
                .Select(t => new SelectListItem { Value = ((int)t).ToString(), Text = t.ToString().Replace("_", " ") })
                .ToList();
                
            ViewBag.AttackComplexities = Enum.GetValues<AttackComplexity>()
                .Select(c => new SelectListItem { Value = ((int)c).ToString(), Text = c.ToString() })
                .ToList();
                
            ViewBag.ScenarioStatuses = Enum.GetValues<ScenarioStatus>()
                .Select(s => new SelectListItem { Value = ((int)s).ToString(), Text = s.ToString() })
                .ToList();
        }
        
        // MITRE ATT&CK Data Import Actions
        
        // GET: ThreatModeling/MitreImport
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> MitreImport()
        {
            try
            {
                ViewBag.CurrentTechniqueCount = await _mitreImportService.GetCurrentTechniqueCountAsync();
                ViewBag.FrameworkCounts = await _mitreImportService.GetFrameworkTechniqueCountsAsync();
                ViewBag.MitreVersion = await _mitreImportService.GetMitreVersionAsync();
                
                // Populate framework types for dropdown
                ViewBag.FrameworkTypes = Enum.GetValues<MitreFrameworkType>()
                    .Select(f => new SelectListItem 
                    { 
                        Value = ((int)f).ToString(), 
                        Text = f.ToString() 
                    })
                    .ToList();
                    
                return View();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading MITRE import page");
                TempData["Error"] = "Error loading MITRE import page: " + ex.Message;
                return RedirectToAction(nameof(Index));
            }
        }
        
        // POST: ThreatModeling/ImportMitreData
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> ImportMitreData(int? frameworkType)
        {
            try
            {
                _logger.LogInformation("Starting MITRE ATT&CK data import requested by user: {User}", User.Identity?.Name);
                
                bool success;
                string frameworkName;
                
                if (frameworkType.HasValue && Enum.IsDefined(typeof(MitreFrameworkType), frameworkType.Value))
                {
                    var framework = (MitreFrameworkType)frameworkType.Value;
                    success = await _mitreImportService.ImportMitreDataAsync(framework);
                    frameworkName = framework.ToString();
                }
                else
                {
                    success = await _mitreImportService.ImportAllFrameworksAsync();
                    frameworkName = "All Frameworks";
                }
                
                if (success)
                {
                    var newCount = await _mitreImportService.GetCurrentTechniqueCountAsync();
                    TempData["Success"] = $"Successfully imported {newCount} MITRE ATT&CK techniques from {frameworkName}.";
                }
                else
                {
                    TempData["Error"] = $"Failed to import MITRE ATT&CK data for {frameworkName}. Please check the logs for details.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error importing MITRE ATT&CK data");
                TempData["Error"] = "Error importing MITRE ATT&CK data: " + ex.Message;
            }
            
            return RedirectToAction(nameof(MitreImport));
        }
        
        // GET: ThreatModeling/GetMitreStatus
        [HttpGet]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> GetMitreStatus()
        {
            try
            {
                var techniqueCount = await _mitreImportService.GetCurrentTechniqueCountAsync();
                var enterpriseCount = await _mitreImportService.GetTechniqueCountByFrameworkAsync(MitreFrameworkType.Enterprise);
                var icsCount = await _mitreImportService.GetTechniqueCountByFrameworkAsync(MitreFrameworkType.ICS);
                var version = await _mitreImportService.GetMitreVersionAsync();
                
                return Json(new { 
                    success = true, 
                    techniqueCount = techniqueCount,
                    enterpriseCount = enterpriseCount,
                    icsCount = icsCount,
                    version = version
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting MITRE status");
                return Json(new { success = false, error = ex.Message });
            }
        }
    }
}