using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Services;
using CyberRiskApp.Models;

namespace CyberRiskApp.Controllers.Api
{
    [Route("api/threatmodeling")]
    [ApiController]
    [Authorize]
    public class ThreatModelingApiController : ControllerBase
    {
        private readonly IThreatModelingService _threatModelingService;

        public ThreatModelingApiController(IThreatModelingService threatModelingService)
        {
            _threatModelingService = threatModelingService;
        }

        // GET: api/threatmodeling/mitretechniques
        [HttpGet("mitretechniques")]
        public async Task<IActionResult> GetMitreTechniques(string? tactic = null)
        {
            try
            {
                var techniques = string.IsNullOrEmpty(tactic)
                    ? await _threatModelingService.GetAllMitreTechniquesAsync()
                    : await _threatModelingService.GetMitreTechniquesByTacticAsync(tactic);

                var result = techniques.Select(t => new
                {
                    id = t.TechniqueId,
                    name = t.Name,
                    tactic = t.Tactic,
                    description = t.Description,
                    platforms = t.Platforms,
                    dataSource = t.DataSources
                });

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to load MITRE techniques", details = ex.Message });
            }
        }

        // GET: api/threatmodeling/killchainactivities
        [HttpGet("killchainactivities")]
        public async Task<IActionResult> GetKillChainActivities(string? phase = null)
        {
            try
            {
                IEnumerable<KillChainActivity> activities;

                if (!string.IsNullOrEmpty(phase))
                {
                    if (Enum.TryParse<CyberKillChainPhase>(phase, true, out var killChainPhase))
                    {
                        activities = await _threatModelingService.GetKillChainActivitiesByPhaseAsync(killChainPhase);
                    }
                    else
                    {
                        return BadRequest(new { error = "Invalid kill chain phase" });
                    }
                }
                else
                {
                    activities = await _threatModelingService.GetAllKillChainActivitiesAsync();
                }

                var result = activities.Select(a => new
                {
                    id = a.Id,
                    name = a.Name,
                    description = a.Description,
                    phase = a.Phase.ToString(),
                    environmentType = a.EnvironmentType,
                    techniques = a.Techniques,
                    tools = a.Tools,
                    complexity = a.Complexity.ToString(),
                    estimatedTimeMinutes = a.EstimatedTimeMinutes
                });

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to load kill chain activities", details = ex.Message });
            }
        }

        // POST: api/threatmodeling/killchainactivities
        [HttpPost("killchainactivities")]
        public async Task<IActionResult> CreateKillChainActivity([FromBody] CreateKillChainActivityRequest request)
        {
            try
            {
                if (!Enum.TryParse<CyberKillChainPhase>(request.Phase, true, out var phase))
                {
                    return BadRequest(new { error = "Invalid kill chain phase" });
                }

                if (!Enum.TryParse<AttackComplexity>(request.Complexity, true, out var complexity))
                {
                    return BadRequest(new { error = "Invalid complexity level" });
                }

                var activity = new KillChainActivity
                {
                    Name = request.Name,
                    Description = request.Description,
                    Phase = phase,
                    EnvironmentType = request.EnvironmentType,
                    Techniques = request.Techniques ?? "",
                    Tools = request.Tools ?? "",
                    Prerequisites = request.Prerequisites ?? "",
                    ExpectedOutcome = request.ExpectedOutcome ?? "",
                    EstimatedTimeMinutes = request.EstimatedTimeMinutes,
                    Complexity = complexity,
                    RequiresUserInteraction = request.RequiresUserInteraction,
                    IsCustom = true
                };

                var createdActivity = await _threatModelingService.CreateKillChainActivityAsync(activity);

                return Ok(new { success = true, activity = new {
                    id = createdActivity.Id,
                    name = createdActivity.Name,
                    description = createdActivity.Description,
                    phase = createdActivity.Phase.ToString(),
                    environmentType = createdActivity.EnvironmentType
                }});
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = "Failed to create kill chain activity", details = ex.Message });
            }
        }

        // GET: api/threatmodeling/killchainactivities/{id}
        [HttpGet("killchainactivities/{id}")]
        public async Task<IActionResult> GetKillChainActivityById(int id)
        {
            try
            {
                // We need to get the activity from the context directly since the service doesn't have a GetById method
                var activity = await _threatModelingService.GetAllKillChainActivitiesAsync();
                var foundActivity = activity.FirstOrDefault(a => a.Id == id);

                if (foundActivity == null)
                {
                    return NotFound(new { error = "Kill chain activity not found" });
                }

                return Ok(new
                {
                    id = foundActivity.Id,
                    name = foundActivity.Name,
                    description = foundActivity.Description,
                    phase = foundActivity.Phase.ToString(),
                    environmentType = foundActivity.EnvironmentType,
                    techniques = foundActivity.Techniques,
                    tools = foundActivity.Tools,
                    prerequisites = foundActivity.Prerequisites,
                    expectedOutcome = foundActivity.ExpectedOutcome,
                    estimatedTimeMinutes = foundActivity.EstimatedTimeMinutes,
                    complexity = foundActivity.Complexity.ToString(),
                    requiresUserInteraction = foundActivity.RequiresUserInteraction,
                    indicators = foundActivity.Indicators
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to load kill chain activity", details = ex.Message });
            }
        }

        // POST: api/threatmodeling/savescenario
        [HttpPost("savescenario")]
        public async Task<IActionResult> SaveScenario([FromBody] SaveScenarioRequest request)
        {
            try
            {
                AttackScenario scenario;

                if (request.Id > 0)
                {
                    // Update existing scenario
                    scenario = await _threatModelingService.GetAttackScenarioByIdAsync(request.Id);
                    if (scenario == null)
                    {
                        return NotFound(new { error = "Scenario not found" });
                    }

                    scenario.Name = request.Name;
                    scenario.Description = request.Description;
                    scenario.InitialAccess = request.ThreatActor ?? "";
                    
                    scenario = await _threatModelingService.UpdateAttackScenarioAsync(scenario);
                }
                else
                {
                    // Create new scenario
                    scenario = new AttackScenario
                    {
                        ThreatModelId = request.ThreatModelId,
                        Name = request.Name,
                        Description = request.Description,
                        InitialAccess = request.ThreatActor ?? "",
                        Status = ScenarioStatus.Draft
                    };

                    scenario = await _threatModelingService.CreateAttackScenarioAsync(scenario);
                }

                // Save scenario steps
                if (request.Techniques != null && request.Techniques.Any())
                {
                    // Clear existing steps
                    var existingSteps = await _threatModelingService.GetAttackScenarioByIdAsync(scenario.Id);
                    if (existingSteps?.Steps != null)
                    {
                        foreach (var step in existingSteps.Steps.ToList())
                        {
                            await _threatModelingService.DeleteScenarioStepAsync(step.Id);
                        }
                    }

                    // Add new steps
                    int stepNumber = 1;
                    foreach (var technique in request.Techniques)
                    {
                        var step = new AttackScenarioStep
                        {
                            AttackScenarioId = scenario.Id,
                            StepNumber = stepNumber++,
                            Name = technique.Name,
                            Description = $"{technique.Type}: {technique.Name}"
                        };

                        // Set kill chain phase
                        if (Enum.TryParse<CyberKillChainPhase>(technique.Phase, true, out var phase))
                        {
                            step.KillChainPhase = phase;
                        }

                        // Set either MITRE technique or Kill Chain activity
                        if (technique.Type == "mitre" && technique.Id != null && !technique.Id.StartsWith("KC-"))
                        {
                            var mitreTechnique = await _threatModelingService.GetMitreTechniqueByTechniqueIdAsync(technique.Id);
                            if (mitreTechnique != null)
                            {
                                step.MitreTechniqueId = mitreTechnique.Id;
                            }
                        }
                        else if (technique.Type == "killchain" && technique.Id != null && technique.Id.StartsWith("KC-"))
                        {
                            if (int.TryParse(technique.Id.Substring(3), out var activityId))
                            {
                                step.KillChainActivityId = activityId;
                            }
                        }

                        await _threatModelingService.AddScenarioStepAsync(step);
                    }
                }

                return Ok(new { success = true, scenarioId = scenario.Id });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = "Failed to save scenario", details = ex.Message });
            }
        }

        // GET: api/threatmodeling/techniques/{id}
        [HttpGet("techniques/{id}")]
        public async Task<IActionResult> GetTechniqueDetails(string id)
        {
            try
            {
                var technique = await _threatModelingService.GetMitreTechniqueByTechniqueIdAsync(id);
                if (technique == null)
                {
                    return NotFound(new { error = "Technique not found" });
                }

                return Ok(new
                {
                    id = technique.TechniqueId,
                    name = technique.Name,
                    description = technique.Description,
                    tactic = technique.Tactic,
                    platforms = technique.Platforms,
                    dataSources = technique.DataSources,
                    mitigation = technique.Mitigation,
                    detection = technique.Detection,
                    examples = technique.Examples,
                    isSubTechnique = technique.IsSubTechnique,
                    parentTechniqueId = technique.ParentTechniqueId
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to load technique details", details = ex.Message });
            }
        }

        // GET: api/threatmodeling/GetAttackScenarioSteps/{scenarioId}
        [HttpGet("GetAttackScenarioSteps/{scenarioId}")]
        public async Task<IActionResult> GetAttackScenarioSteps(int scenarioId)
        {
            try
            {
                var scenario = await _threatModelingService.GetAttackScenarioByIdAsync(scenarioId);
                if (scenario == null)
                {
                    return NotFound(new { error = "Attack scenario not found" });
                }

                var stepsList = scenario.Steps?.OrderBy(s => s.StepNumber).ToList();
                
                if (stepsList == null || !stepsList.Any())
                {
                    return Ok(new List<object>());
                }

                var steps = stepsList.Select(step => new
                {
                    id = step.Id,
                    stepNumber = step.StepNumber,
                    name = step.Name,
                    description = step.Description,
                    killChainPhase = step.KillChainPhase.ToString(),
                    detectionMethods = step.DetectionMethods,
                    mitreTechnique = step.MitreTechnique != null ? new
                    {
                        id = step.MitreTechnique.Id,
                        techniqueId = step.MitreTechnique.TechniqueId,
                        name = step.MitreTechnique.Name,
                        description = step.MitreTechnique.Description,
                        tactic = step.MitreTechnique.Tactic
                    } : null,
                    killChainActivity = step.KillChainActivity != null ? new
                    {
                        id = step.KillChainActivity.Id,
                        name = step.KillChainActivity.Name,
                        description = step.KillChainActivity.Description,
                        phase = step.KillChainActivity.Phase.ToString(),
                        complexity = step.KillChainActivity.Complexity.ToString(),
                        environmentType = step.KillChainActivity.EnvironmentType
                    } : null
                }).ToList();

                return Ok(steps);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to load attack scenario steps", details = ex.Message });
            }
        }
    }

    public class SaveScenarioRequest
    {
        public int Id { get; set; }
        public int ThreatModelId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? ThreatActor { get; set; }
        public List<TechniqueData>? Techniques { get; set; }
    }

    public class TechniqueData
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Tactic { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Phase { get; set; } = string.Empty;
    }

    public class CreateKillChainActivityRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Phase { get; set; } = string.Empty;
        public string EnvironmentType { get; set; } = string.Empty;
        public string? Techniques { get; set; }
        public string? Tools { get; set; }
        public string? Prerequisites { get; set; }
        public string? ExpectedOutcome { get; set; }
        public int EstimatedTimeMinutes { get; set; } = 30;
        public string Complexity { get; set; } = "Low";
        public bool RequiresUserInteraction { get; set; } = false;
    }
}