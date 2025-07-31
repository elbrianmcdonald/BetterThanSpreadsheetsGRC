using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("ImplementationMilestones")]
    public class ImplementationMilestone
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [Display(Name = "Strategy Plan")]
        public int StrategyPlanId { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Milestone Name")]
        public string MilestoneName { get; set; } = string.Empty;

        [StringLength(1000)]
        [Display(Name = "Description")]
        public string? Description { get; set; }

        [Required]
        [Display(Name = "Target Date")]
        [DataType(DataType.Date)]
        public DateTime TargetDate { get; set; }

        [Display(Name = "Completion Date")]
        [DataType(DataType.Date)]
        public DateTime? CompletionDate { get; set; }

        [Display(Name = "Status")]
        public MilestoneStatus Status { get; set; } = MilestoneStatus.Planned;

        [StringLength(1000)]
        [Display(Name = "Success Criteria")]
        public string? SuccessCriteria { get; set; }

        [StringLength(500)]
        [Display(Name = "Related Capabilities")]
        public string? RelatedCapabilityIds { get; set; } // Comma-separated capability IDs

        [Display(Name = "Sort Order")]
        public int SortOrder { get; set; }

        [StringLength(1000)]
        [Display(Name = "Notes")]
        public string? Notes { get; set; }

        [Display(Name = "Created At")]
        public DateTime CreatedAt { get; set; }

        [Display(Name = "Updated At")]
        public DateTime UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("StrategyPlanId")]
        public virtual StrategyPlan StrategyPlan { get; set; } = null!;

        // Calculated properties
        [NotMapped]
        public int DaysUntilTarget => (TargetDate - DateTime.UtcNow).Days;

        [NotMapped]
        public bool IsOverdue => TargetDate < DateTime.UtcNow && Status != MilestoneStatus.Completed;

        [NotMapped]
        public bool IsCompleted => Status == MilestoneStatus.Completed;

        [NotMapped]
        public string StatusColor => Status switch
        {
            MilestoneStatus.Completed => "success",
            MilestoneStatus.InProgress => "primary",
            MilestoneStatus.AtRisk => "warning",
            MilestoneStatus.Delayed => "danger",
            _ => "secondary"
        };

        [NotMapped]
        public List<int> RelatedCapabilities
        {
            get
            {
                if (string.IsNullOrEmpty(RelatedCapabilityIds))
                    return new List<int>();
                
                return RelatedCapabilityIds
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(id => int.TryParse(id.Trim(), out var result) ? result : 0)
                    .Where(id => id > 0)
                    .ToList();
            }
            set
            {
                RelatedCapabilityIds = value?.Any() == true 
                    ? string.Join(",", value) 
                    : null;
            }
        }
    }

    public enum MilestoneStatus
    {
        [Display(Name = "Planned")]
        Planned = 1,

        [Display(Name = "In Progress")]
        InProgress = 2,

        [Display(Name = "At Risk")]
        AtRisk = 3,

        [Display(Name = "Delayed")]
        Delayed = 4,

        [Display(Name = "Completed")]
        Completed = 5
    }
}