using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("CapabilityRequirements")]
    public class CapabilityRequirement
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [Display(Name = "Strategy Goal")]
        public int StrategyGoalId { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Capability Name")]
        public string CapabilityName { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Capability Type")]
        public CapabilityType CapabilityType { get; set; }

        [StringLength(1000)]
        [Display(Name = "Description")]
        public string? Description { get; set; }

        [Display(Name = "Priority")]
        public CapabilityPriority Priority { get; set; } = CapabilityPriority.Medium;

        [Display(Name = "Estimated Effort (Person-Months)")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal? EstimatedEffortMonths { get; set; }

        [Display(Name = "Estimated Cost")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? EstimatedCost { get; set; }

        [Display(Name = "Actual Cost")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? ActualCost { get; set; }

        [StringLength(500)]
        [Display(Name = "Dependencies")]
        public string? Dependencies { get; set; }

        [Display(Name = "Status")]
        public CapabilityStatus Status { get; set; } = CapabilityStatus.Planned;

        [Display(Name = "Progress Percentage")]
        [Range(0, 100)]
        public int ProgressPercentage { get; set; } = 0;

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

        [StringLength(1000)]
        [Display(Name = "Notes")]
        public string? Notes { get; set; }

        [Display(Name = "Created At")]
        public DateTime CreatedAt { get; set; }

        [Display(Name = "Updated At")]
        public DateTime UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("StrategyGoalId")]
        public virtual StrategyGoal StrategyGoal { get; set; } = null!;
        
        public virtual ICollection<CapabilityControlMapping> ControlMappings { get; set; } = new List<CapabilityControlMapping>();

        // Calculated properties
        [NotMapped]
        public int DaysUntilTarget => TargetDate.HasValue ? (TargetDate.Value - DateTime.UtcNow).Days : 0;

        [NotMapped]
        public bool IsOverdue => TargetDate.HasValue && TargetDate.Value < DateTime.UtcNow && Status != CapabilityStatus.Completed;

        [NotMapped]
        public decimal CostVariance => (ActualCost ?? 0) - (EstimatedCost ?? 0);

        [NotMapped]
        public string StatusColor => Status switch
        {
            CapabilityStatus.Completed => "success",
            CapabilityStatus.InProgress => "primary",
            CapabilityStatus.OnHold => "warning",
            CapabilityStatus.Cancelled => "danger",
            _ => "secondary"
        };

        [NotMapped]
        public string PriorityColor => Priority switch
        {
            CapabilityPriority.Critical => "danger",
            CapabilityPriority.High => "warning",
            CapabilityPriority.Medium => "info",
            CapabilityPriority.Low => "success",
            _ => "secondary"
        };
    }

    public enum CapabilityType
    {
        [Display(Name = "Process")]
        Process = 1,

        [Display(Name = "Technology")]
        Technology = 2,

        [Display(Name = "People")]
        People = 3,

        [Display(Name = "Governance")]
        Governance = 4,

        [Display(Name = "Infrastructure")]
        Infrastructure = 5,

        [Display(Name = "Training")]
        Training = 6
    }

    public enum CapabilityPriority
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

    public enum CapabilityStatus
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
}