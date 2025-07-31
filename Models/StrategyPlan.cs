using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("StrategyPlans")]
    public class StrategyPlan
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Plan Name")]
        public string PlanName { get; set; } = string.Empty;

        [StringLength(1000)]
        [Display(Name = "Description")]
        public string? Description { get; set; }

        [Required(ErrorMessage = "Please select an organization")]
        [Display(Name = "Organization")]
        public int BusinessOrganizationId { get; set; }

        [Required]
        [Display(Name = "Start Date")]
        [DataType(DataType.Date)]
        public DateTime StartDate { get; set; }

        [Required]
        [Display(Name = "End Date")]
        [DataType(DataType.Date)]
        public DateTime EndDate { get; set; }

        [Display(Name = "Status")]
        public StrategyPlanStatus Status { get; set; } = StrategyPlanStatus.Draft;

        [Display(Name = "Total Budget")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? TotalBudget { get; set; }

        [Display(Name = "Spent Budget")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? SpentBudget { get; set; }

        [Display(Name = "Created By")]
        [StringLength(100)]
        public string CreatedBy { get; set; } = string.Empty;

        [Display(Name = "Updated By")]
        [StringLength(100)]
        public string? UpdatedBy { get; set; }

        [Display(Name = "Created At")]
        public DateTime CreatedAt { get; set; }

        [Display(Name = "Updated At")]
        public DateTime UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("BusinessOrganizationId")]
        public virtual BusinessOrganization? Organization { get; set; }

        public virtual ICollection<StrategyGoal> Goals { get; set; } = new List<StrategyGoal>();
        public virtual ICollection<ImplementationMilestone> Milestones { get; set; } = new List<ImplementationMilestone>();

        // Calculated properties
        [NotMapped]
        public decimal RemainingBudget => (TotalBudget ?? 0) - (SpentBudget ?? 0);

        [NotMapped]
        public int TotalDays => (EndDate - StartDate).Days;

        [NotMapped]
        public int DaysRemaining => (EndDate - DateTime.UtcNow).Days;

        [NotMapped]
        public decimal OverallProgressPercentage
        {
            get
            {
                if (!Goals.Any()) return 0;
                var totalCapabilities = Goals.SelectMany(g => g.Capabilities).Count();
                if (totalCapabilities == 0) return 0;
                var completedCapabilities = Goals.SelectMany(g => g.Capabilities).Count(c => c.Status == CapabilityStatus.Completed);
                return totalCapabilities > 0 ? (decimal)completedCapabilities / totalCapabilities * 100 : 0;
            }
        }
    }

    public enum StrategyPlanStatus
    {
        [Display(Name = "Draft")]
        Draft = 1,

        [Display(Name = "Active")]
        Active = 2,

        [Display(Name = "On Hold")]
        OnHold = 3,

        [Display(Name = "Completed")]
        Completed = 4,

        [Display(Name = "Cancelled")]
        Cancelled = 5
    }
}