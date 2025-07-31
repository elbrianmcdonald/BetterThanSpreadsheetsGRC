using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("StrategyGoals")]
    public class StrategyGoal
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [Display(Name = "Strategy Plan")]
        public int StrategyPlanId { get; set; }

        [Required]
        [Display(Name = "Maturity Framework")]
        public int MaturityFrameworkId { get; set; }

        [Required]
        [StringLength(100)]
        [Display(Name = "Function/Domain")]
        public string FunctionDomain { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Current Maturity Level")]
        public int CurrentMaturityLevel { get; set; }

        [Required]
        [Display(Name = "Target Maturity Level")]
        public int TargetMaturityLevel { get; set; }

        [Required]
        [Display(Name = "Target Date")]
        [DataType(DataType.Date)]
        public DateTime TargetDate { get; set; }

        [Display(Name = "Priority")]
        public GoalPriority Priority { get; set; } = GoalPriority.Medium;

        [StringLength(500)]
        [Display(Name = "Notes")]
        public string? Notes { get; set; }

        [Display(Name = "Status")]
        public GoalStatus Status { get; set; } = GoalStatus.Planned;

        [Display(Name = "Completion Date")]
        [DataType(DataType.Date)]
        public DateTime? CompletionDate { get; set; }

        [Display(Name = "Created At")]
        public DateTime CreatedAt { get; set; }

        [Display(Name = "Updated At")]
        public DateTime UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("StrategyPlanId")]
        public virtual StrategyPlan StrategyPlan { get; set; } = null!;

        [ForeignKey("MaturityFrameworkId")]
        public virtual MaturityFramework MaturityFramework { get; set; } = null!;

        public virtual ICollection<CapabilityRequirement> Capabilities { get; set; } = new List<CapabilityRequirement>();

        // Calculated properties
        [NotMapped]
        public int MaturityGap => TargetMaturityLevel - CurrentMaturityLevel;

        [NotMapped]
        public int DaysUntilTarget => (TargetDate - DateTime.UtcNow).Days;

        [NotMapped]
        public bool IsOverdue => TargetDate < DateTime.UtcNow && Status != GoalStatus.Completed;

        [NotMapped]
        public decimal ProgressPercentage
        {
            get
            {
                if (!Capabilities.Any()) return 0;
                var completedCount = Capabilities.Count(c => c.Status == CapabilityStatus.Completed);
                return Capabilities.Count > 0 ? (decimal)completedCount / Capabilities.Count * 100 : 0;
            }
        }
    }

    public enum GoalPriority
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

    public enum GoalStatus
    {
        [Display(Name = "Planned")]
        Planned = 1,

        [Display(Name = "In Progress")]
        InProgress = 2,

        [Display(Name = "On Track")]
        OnTrack = 3,

        [Display(Name = "At Risk")]
        AtRisk = 4,

        [Display(Name = "Delayed")]
        Delayed = 5,

        [Display(Name = "Completed")]
        Completed = 6
    }
}