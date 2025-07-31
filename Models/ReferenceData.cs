using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public enum ReferenceDataCategory
    {
        Asset = 1,
        BusinessOwner = 2,
        BusinessUnit = 3,
        TechnicalControl = 4,
        SecurityControlName = 5
    }

    public class ReferenceDataEntry
    {
        public int Id { get; set; }

        [Required]
        public ReferenceDataCategory Category { get; set; }

        [Required]
        [StringLength(200)]
        public string Value { get; set; } = string.Empty;

        [StringLength(500)]
        public string Description { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        [StringLength(100)]
        public string CreatedBy { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }

        [StringLength(100)]
        public string? ModifiedBy { get; set; }

        public DateTime? ModifiedAt { get; set; }

        // Track usage for analytics and cleanup
        public int UsageCount { get; set; } = 0;

        public DateTime? LastUsedAt { get; set; }

        // For soft delete functionality
        public bool IsDeleted { get; set; } = false;

        public DateTime? DeletedAt { get; set; }

        [StringLength(100)]
        public string? DeletedBy { get; set; }
    }

    // ViewModel for API responses
    public class ReferenceDataViewModel
    {
        public int Id { get; set; }
        public string Value { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Label => string.IsNullOrEmpty(Description) ? Value : $"{Value} - {Description}";
    }

    // ViewModel for creating new entries
    public class CreateReferenceDataViewModel
    {
        [Required]
        public ReferenceDataCategory Category { get; set; }

        [Required]
        [StringLength(200)]
        [RegularExpression(@"^[a-zA-Z0-9\s\-\._\(\)\[\]&/]+$", ErrorMessage = "Value contains invalid characters")]
        public string Value { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }
    }

    // ViewModel for search results
    public class ReferenceDataSearchResult
    {
        public List<ReferenceDataViewModel> Results { get; set; } = new List<ReferenceDataViewModel>();
        public bool CanAddNew { get; set; }
        public string SearchTerm { get; set; } = string.Empty;
    }

    // NEW: Model for technical control to compliance control mapping
    public class TechnicalControlComplianceMapping
    {
        public int Id { get; set; }

        [Required]
        public int TechnicalControlId { get; set; }

        [Required]
        public int ComplianceControlId { get; set; }

        [StringLength(1000)]
        public string MappingRationale { get; set; } = string.Empty;

        [StringLength(500)]
        public string ImplementationNotes { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        [StringLength(100)]
        public string CreatedBy { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }

        [StringLength(100)]
        public string? ModifiedBy { get; set; }

        public DateTime? ModifiedAt { get; set; }

        // Navigation properties
        public virtual ReferenceDataEntry TechnicalControl { get; set; } = null!;
        public virtual ComplianceControl ComplianceControl { get; set; } = null!;
    }

    // ViewModel for managing technical control mappings
    public class TechnicalControlMappingViewModel
    {
        public int TechnicalControlId { get; set; }
        public string TechnicalControlName { get; set; } = string.Empty;
        public string TechnicalControlDescription { get; set; } = string.Empty;
        public List<ComplianceControlMappingInfo> MappedControls { get; set; } = new List<ComplianceControlMappingInfo>();
        public List<ComplianceControlInfo> AvailableControls { get; set; } = new List<ComplianceControlInfo>();
    }

    public class ComplianceControlMappingInfo
    {
        public int MappingId { get; set; }
        public int ComplianceControlId { get; set; }
        public string ControlId { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Framework { get; set; } = string.Empty;
        public string MappingRationale { get; set; } = string.Empty;
        public string ImplementationNotes { get; set; } = string.Empty;
    }

    public class ComplianceControlInfo
    {
        public int Id { get; set; }
        public string ControlId { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Framework { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
    }
}