using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Services;
using CyberRiskApp.Authorization;
using CyberRiskApp.Models;

namespace CyberRiskApp.Controllers.Api
{
    [Route("api/mitre")]
    [ApiController]
    [Authorize(Policy = PolicyConstants.RequireAnyRole)]
    public class MitreApiController : ControllerBase
    {
        private readonly IMitreAttackService _mitreService;
        private readonly IMitreImportService _mitreImportService;
        private readonly ILogger<MitreApiController> _logger;

        public MitreApiController(
            IMitreAttackService mitreService, 
            IMitreImportService mitreImportService,
            ILogger<MitreApiController> logger)
        {
            _mitreService = mitreService;
            _mitreImportService = mitreImportService;
            _logger = logger;
        }

        [HttpGet("techniques")]
        public async Task<IActionResult> GetTechniques()
        {
            try
            {
                var techniques = await _mitreService.GetTechniquesAsync();
                var results = techniques.Select(t => new
                {
                    id = t.Id,
                    value = $"{t.TechniqueId} - {t.Name}",
                    text = $"{t.TechniqueId} - {t.Name}",
                    techniqueId = t.TechniqueId,
                    name = t.Name,
                    tactic = t.Tactic,
                    description = t.Description
                }).ToList();

                return Ok(new { results });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting MITRE techniques");
                return StatusCode(500, new { error = "Error retrieving MITRE techniques" });
            }
        }

        [HttpGet("techniques/search")]
        public async Task<IActionResult> SearchTechniques([FromQuery] string q = "")
        {
            try
            {
                var techniques = await _mitreService.SearchTechniquesAsync(q);
                var results = techniques.Select(t => new
                {
                    id = t.Id,
                    value = $"{t.TechniqueId} - {t.Name}",
                    text = $"{t.TechniqueId} - {t.Name}",
                    techniqueId = t.TechniqueId,
                    name = t.Name,
                    tactic = t.Tactic,
                    description = t.Description
                }).ToList();

                return Ok(new { results });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching MITRE techniques with query: {Query}", q);
                return StatusCode(500, new { error = "Error searching MITRE techniques" });
            }
        }

        [HttpGet("tactics")]
        public async Task<IActionResult> GetTactics()
        {
            try
            {
                var tactics = await _mitreService.GetTacticsAsync();
                var results = tactics.Select(t => new
                {
                    value = t,
                    text = t
                }).ToList();

                return Ok(new { results });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting MITRE tactics");
                return StatusCode(500, new { error = "Error retrieving MITRE tactics" });
            }
        }

        [HttpGet("datasources")]
        public async Task<IActionResult> GetDataSources()
        {
            try
            {
                var dataSources = await _mitreService.GetDataSourcesAsync();
                var results = dataSources.Select(ds => new
                {
                    value = ds,
                    text = ds
                }).ToList();

                return Ok(new { results });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting MITRE data sources");
                return StatusCode(500, new { error = "Error retrieving MITRE data sources" });
            }
        }

        [HttpGet("technique/{techniqueId}")]
        public async Task<IActionResult> GetTechniqueById(string techniqueId)
        {
            try
            {
                var technique = await _mitreService.GetTechniqueByIdAsync(techniqueId);
                if (technique == null)
                {
                    return NotFound(new { error = $"Technique {techniqueId} not found" });
                }

                return Ok(new
                {
                    id = technique.Id,
                    techniqueId = technique.TechniqueId,
                    name = technique.Name,
                    tactic = technique.Tactic,
                    description = technique.Description,
                    platforms = technique.Platforms,
                    dataSources = technique.DataSources,
                    detection = technique.Detection,
                    mitigation = technique.Mitigation
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting MITRE technique: {TechniqueId}", techniqueId);
                return StatusCode(500, new { error = "Error retrieving MITRE technique" });
            }
        }

        // Import endpoints (Admin only)
        [HttpPost("import")]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> ImportMitreData([FromBody] ImportRequest request)
        {
            try
            {
                _logger.LogInformation("Starting MITRE ATT&CK data import requested by user: {User}", User.Identity?.Name);
                
                bool success;
                string frameworkName;
                
                if (request.FrameworkType.HasValue && Enum.IsDefined(typeof(MitreFrameworkType), request.FrameworkType.Value))
                {
                    var framework = (MitreFrameworkType)request.FrameworkType.Value;
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
                    return Ok(new 
                    { 
                        success = true, 
                        message = $"Successfully imported {newCount} MITRE ATT&CK techniques from {frameworkName}.",
                        techniqueCount = newCount
                    });
                }
                else
                {
                    return StatusCode(500, new 
                    { 
                        success = false, 
                        error = $"Failed to import MITRE ATT&CK data from {frameworkName}. Please check logs for details." 
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error importing MITRE ATT&CK data");
                return StatusCode(500, new { success = false, error = "Error importing MITRE ATT&CK data" });
            }
        }

        [HttpGet("status")]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> GetMitreStatus()
        {
            try
            {
                var techniqueCount = await _mitreImportService.GetCurrentTechniqueCountAsync();
                var enterpriseCount = await _mitreImportService.GetTechniqueCountByFrameworkAsync(MitreFrameworkType.Enterprise);
                var icsCount = await _mitreImportService.GetTechniqueCountByFrameworkAsync(MitreFrameworkType.ICS);
                var version = await _mitreImportService.GetMitreVersionAsync();
                var frameworkCounts = await _mitreImportService.GetFrameworkTechniqueCountsAsync();
                
                return Ok(new 
                { 
                    success = true,
                    techniqueCount = techniqueCount,
                    enterpriseCount = enterpriseCount,
                    icsCount = icsCount,
                    version = version,
                    frameworkCounts = frameworkCounts
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting MITRE status");
                return StatusCode(500, new { success = false, error = "Error retrieving MITRE status" });
            }
        }

        public class ImportRequest
        {
            public int? FrameworkType { get; set; }
        }
    }
}