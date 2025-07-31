using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    /// <summary>
    /// Junction table for many-to-many relationship between CapabilityRequirement and ComplianceControl
    /// </summary>
    [Table("CapabilityControlMappings")]
    public class CapabilityControlMapping
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [Display(Name = "Capability Requirement")]
        public int CapabilityRequirementId { get; set; }

        [Required]
        [Display(Name = "Compliance Control")]
        public int ComplianceControlId { get; set; }

        [StringLength(1000)]
        [Display(Name = "Implementation Notes")]
        public string? ImplementationNotes { get; set; }

        [Display(Name = "Implementation Status")]
        public CapabilityControlStatus Status { get; set; } = CapabilityControlStatus.Planned;

        [Display(Name = "Priority")]
        public MappingPriority Priority { get; set; } = MappingPriority.Medium;

        [Display(Name = "Effort Estimate (Hours)")]
        [Range(0, 10000)]
        public decimal? EstimatedHours { get; set; }

        [Display(Name = "Actual Hours")]
        [Range(0, 10000)]
        public decimal? ActualHours { get; set; }

        [Display(Name = "Start Date")]
        [DataType(DataType.Date)]
        public DateTime? StartDate { get; set; }

        [Display(Name = "Target Date")]
        [DataType(DataType.Date)]
        public DateTime? TargetDate { get; set; }

        [Display(Name = "Completion Date")]
        [DataType(DataType.Date)]
        public DateTime? CompletionDate { get; set; }

        [StringLength(100)]
        [Display(Name = "Assigned To")]
        public string? AssignedTo { get; set; }

        [StringLength(2000)]
        [Display(Name = "Notes")]
        public string? Notes { get; set; }

        [Display(Name = "Created At")]
        public DateTime CreatedAt { get; set; }

        [Display(Name = "Updated At")]
        public DateTime UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("CapabilityRequirementId")]
        public virtual CapabilityRequirement CapabilityRequirement { get; set; } = null!;

        [ForeignKey("ComplianceControlId")]
        public virtual ComplianceControl ComplianceControl { get; set; } = null!;

        // Calculated properties
        [NotMapped]
        public bool IsOverdue => TargetDate.HasValue && TargetDate.Value < DateTime.UtcNow && Status != CapabilityControlStatus.Completed;

        [NotMapped]
        public int DaysUntilTarget => TargetDate.HasValue ? (TargetDate.Value - DateTime.UtcNow).Days : 0;

        [NotMapped]
        public bool IsCompleted => Status == CapabilityControlStatus.Completed;

        [NotMapped]
        public decimal? HoursVariance => ActualHours.HasValue && EstimatedHours.HasValue 
            ? ActualHours.Value - EstimatedHours.Value 
            : null;

        [NotMapped]
        public string StatusColor => Status switch
        {
            CapabilityControlStatus.Completed => "success",
            CapabilityControlStatus.InProgress => "primary",
            CapabilityControlStatus.OnHold => "warning",
            CapabilityControlStatus.Cancelled => "danger",
            _ => "secondary"
        };

        [NotMapped]
        public string PriorityColor => Priority switch
        {
            MappingPriority.Critical => "danger",
            MappingPriority.High => "warning",
            MappingPriority.Medium => "info",
            MappingPriority.Low => "success",
            _ => "secondary"
        };
    }

    public enum CapabilityControlStatus
    {
        [Display(Name = "Planned")]
        Planned = 1,

        [Display(Name = "In Progress")]
        InProgress = 2,

        [Display(Name = "On Hold")]
        OnHold = 3,

        [Display(Name = "Completed")]
        Completed = 4,

        [Display(Name = "Cancelled")]
        Cancelled = 5
    }

    public enum MappingPriority
    {
        [Display(Name = "Low")]
        Low = 1,

        [Display(Name = "Medium")]
        Medium = 2,

        [Display(Name = "High")]
        High = 3,

        [Display(Name = "Critical")]
        Critical = 4
    }
}