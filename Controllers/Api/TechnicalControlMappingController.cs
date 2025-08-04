using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Services;
using CyberRiskApp.Models;
using CyberRiskApp.Authorization;
using System.Security.Claims;
using System.ComponentModel.DataAnnotations;

namespace CyberRiskApp.Controllers.Api
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
    public class TechnicalControlMappingController : ControllerBase
    {
        private readonly ITechnicalControlMappingService _mappingService;
        private readonly ILogger<TechnicalControlMappingController> _logger;

        public TechnicalControlMappingController(
            ITechnicalControlMappingService mappingService,
            ILogger<TechnicalControlMappingController> logger)
        {
            _mappingService = mappingService;
            _logger = logger;
        }

        // GET: api/technicalcontrolmapping/{technicalControlId}
        [HttpGet("{technicalControlId}")]
        public async Task<IActionResult> GetMappings(int technicalControlId)
        {
            try
            {
                var mapping = await _mappingService.GetTechnicalControlMappingsAsync(technicalControlId);
                return Ok(mapping);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving mappings for technical control {TechnicalControlId}", technicalControlId);
                return StatusCode(500, new { error = "An error occurred while retrieving technical control mappings" });
            }
        }

        // GET: api/technicalcontrolmapping
        [HttpGet]
        public async Task<IActionResult> GetAllMappings()
        {
            try
            {
                var mappings = await _mappingService.GetAllTechnicalControlMappingsAsync();
                return Ok(mappings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all technical control mappings");
                return StatusCode(500, new { error = "An error occurred while retrieving technical control mappings" });
            }
        }

        // GET: api/technicalcontrolmapping/available-controls
        [HttpGet("available-controls")]
        public async Task<IActionResult> GetAvailableComplianceControls([FromQuery] int? excludeTechnicalControlId = null)
        {
            try
            {
                var controls = await _mappingService.GetAvailableComplianceControlsAsync(excludeTechnicalControlId);
                return Ok(controls);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving available compliance controls");
                return StatusCode(500, new { error = "An error occurred while retrieving available compliance controls" });
            }
        }

        // GET: api/technicalcontrolmapping/search
        [HttpGet("search")]
        public async Task<IActionResult> SearchMappings([FromQuery] string? searchTerm, [FromQuery] string? framework)
        {
            try
            {
                var mappings = await _mappingService.SearchMappingsAsync(searchTerm ?? string.Empty, framework);
                return Ok(mappings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching technical control mappings");
                return StatusCode(500, new { error = "An error occurred while searching technical control mappings" });
            }
        }

        // GET: api/technicalcontrolmapping/search-compliance-controls
        [HttpGet("search-compliance-controls")]
        public async Task<IActionResult> SearchComplianceControls([FromQuery] string? searchTerm, [FromQuery] string? framework)
        {
            try
            {
                var controls = await _mappingService.SearchComplianceControlsAsync(searchTerm ?? string.Empty, framework);
                return Ok(controls);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching compliance controls");
                return StatusCode(500, new { error = "An error occurred while searching compliance controls" });
            }
        }

        // GET: api/technicalcontrolmapping/analytics
        [HttpGet("analytics")]
        public async Task<IActionResult> GetAnalytics()
        {
            try
            {
                var analytics = await _mappingService.GetMappingAnalyticsAsync();
                return Ok(analytics);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving mapping analytics");
                return StatusCode(500, new { error = "An error occurred while retrieving mapping analytics" });
            }
        }

        // GET: api/technicalcontrolmapping/unmapped-technical-controls
        [HttpGet("unmapped-technical-controls")]
        public async Task<IActionResult> GetUnmappedTechnicalControls()
        {
            try
            {
                var controls = await _mappingService.GetUnmappedTechnicalControlsAsync();
                return Ok(controls);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving unmapped technical controls");
                return StatusCode(500, new { error = "An error occurred while retrieving unmapped technical controls" });
            }
        }

        // GET: api/technicalcontrolmapping/unmapped-compliance-controls
        [HttpGet("unmapped-compliance-controls")]
        public async Task<IActionResult> GetUnmappedComplianceControls()
        {
            try
            {
                var controls = await _mappingService.GetUnmappedComplianceControlsAsync();
                return Ok(controls);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving unmapped compliance controls");
                return StatusCode(500, new { error = "An error occurred while retrieving unmapped compliance controls" });
            }
        }

        // POST: api/technicalcontrolmapping
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateMapping([FromBody] CreateMappingViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var userId = User.Identity?.Name ?? "Unknown";
                var mapping = await _mappingService.CreateMappingAsync(
                    model.TechnicalControlId,
                    model.ComplianceControlId,
                    model.MappingRationale ?? string.Empty,
                    model.ImplementationNotes ?? string.Empty,
                    userId);

                return Ok(new
                {
                    id = mapping.Id,
                    technicalControlId = mapping.TechnicalControlId,
                    complianceControlId = mapping.ComplianceControlId,
                    mappingRationale = mapping.MappingRationale,
                    implementationNotes = mapping.ImplementationNotes,
                    isActive = mapping.IsActive,
                    createdAt = mapping.CreatedAt
                });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { error = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating technical control mapping");
                return StatusCode(500, new { error = "An error occurred while creating the technical control mapping" });
            }
        }

        // PUT: api/technicalcontrolmapping/{mappingId}
        [HttpPut("{mappingId}")]
        public async Task<IActionResult> UpdateMapping(int mappingId, [FromBody] UpdateMappingViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var userId = User.Identity?.Name ?? "Unknown";
                var mapping = await _mappingService.UpdateMappingAsync(
                    mappingId,
                    model.MappingRationale ?? string.Empty,
                    model.ImplementationNotes ?? string.Empty,
                    userId);

                return Ok(new
                {
                    id = mapping.Id,
                    mappingRationale = mapping.MappingRationale,
                    implementationNotes = mapping.ImplementationNotes,
                    modifiedAt = mapping.ModifiedAt
                });
            }
            catch (ArgumentException ex)
            {
                return NotFound(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating technical control mapping {MappingId}", mappingId);
                return StatusCode(500, new { error = "An error occurred while updating the technical control mapping" });
            }
        }

        // DELETE: api/technicalcontrolmapping/{mappingId}
        [HttpDelete("{mappingId}")]
        public async Task<IActionResult> DeleteMapping(int mappingId)
        {
            try
            {
                var userId = User.Identity?.Name ?? "Unknown";
                var result = await _mappingService.DeleteMappingAsync(mappingId, userId);

                if (!result)
                {
                    return NotFound(new { error = "Technical control mapping not found" });
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting technical control mapping {MappingId}", mappingId);
                return StatusCode(500, new { error = "An error occurred while deleting the technical control mapping" });
            }
        }

        // POST: api/technicalcontrolmapping/bulk
        [HttpPost("bulk")]
        public async Task<IActionResult> BulkCreateMappings([FromBody] BulkCreateMappingViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var userId = User.Identity?.Name ?? "Unknown";
                var count = await _mappingService.BulkCreateMappingsAsync(
                    model.TechnicalControlId,
                    model.ComplianceControlIds,
                    model.MappingRationale ?? string.Empty,
                    model.ImplementationNotes ?? string.Empty,
                    userId);

                return Ok(new { message = $"Successfully created {count} technical control mappings", count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error bulk creating technical control mappings");
                return StatusCode(500, new { error = "An error occurred while creating technical control mappings" });
            }
        }

        // DELETE: api/technicalcontrolmapping/bulk
        [HttpDelete("bulk")]
        public async Task<IActionResult> BulkDeleteMappings([FromBody] BulkDeleteMappingViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var userId = User.Identity?.Name ?? "Unknown";
                var count = await _mappingService.BulkDeleteMappingsAsync(
                    model.TechnicalControlId,
                    model.ComplianceControlIds,
                    userId);

                return Ok(new { message = $"Successfully deleted {count} technical control mappings", count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error bulk deleting technical control mappings");
                return StatusCode(500, new { error = "An error occurred while deleting technical control mappings" });
            }
        }

        // POST: api/technicalcontrolmapping/{mappingId}/toggle-status
        [HttpPost("{mappingId}/toggle-status")]
        public async Task<IActionResult> ToggleMappingStatus(int mappingId, [FromBody] ToggleStatusViewModel model)
        {
            try
            {
                var userId = User.Identity?.Name ?? "Unknown";
                var result = await _mappingService.SetMappingActiveStatusAsync(mappingId, model.IsActive, userId);

                if (!result)
                {
                    return NotFound(new { error = "Technical control mapping not found" });
                }

                return Ok(new { message = $"Mapping status updated to {(model.IsActive ? "active" : "inactive")}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error toggling mapping status for {MappingId}", mappingId);
                return StatusCode(500, new { error = "An error occurred while updating the mapping status" });
            }
        }

        // GET: api/technicalcontrolmapping/export
        [HttpGet("export")]
        public async Task<IActionResult> ExportMappings()
        {
            try
            {
                var data = await _mappingService.GetMappingExportDataAsync();
                return Ok(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting technical control mappings");
                return StatusCode(500, new { error = "An error occurred while exporting technical control mappings" });
            }
        }
    }

    // View models for API operations
    public class CreateMappingViewModel
    {
        [Required]
        public int TechnicalControlId { get; set; }

        [Required]
        public int ComplianceControlId { get; set; }

        [StringLength(1000)]
        public string? MappingRationale { get; set; }

        [StringLength(500)]
        public string? ImplementationNotes { get; set; }
    }

    public class UpdateMappingViewModel
    {
        [StringLength(1000)]
        public string? MappingRationale { get; set; }

        [StringLength(500)]
        public string? ImplementationNotes { get; set; }
    }

    public class BulkCreateMappingViewModel
    {
        [Required]
        public int TechnicalControlId { get; set; }

        [Required]
        [MinLength(1, ErrorMessage = "At least one compliance control must be selected")]
        public IEnumerable<int> ComplianceControlIds { get; set; } = new List<int>();

        [StringLength(1000)]
        public string? MappingRationale { get; set; }

        [StringLength(500)]
        public string? ImplementationNotes { get; set; }
    }

    public class BulkDeleteMappingViewModel
    {
        [Required]
        public int TechnicalControlId { get; set; }

        [Required]
        [MinLength(1, ErrorMessage = "At least one compliance control must be selected")]
        public IEnumerable<int> ComplianceControlIds { get; set; } = new List<int>();
    }

    public class ToggleStatusViewModel
    {
        [Required]
        public bool IsActive { get; set; }
    }
}