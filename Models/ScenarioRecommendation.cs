using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("ScenarioRecommendations")]
    public class ScenarioRecommendation
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int AttackScenarioId { get; set; }

        [Required]
        [StringLength(200)]
        public string Title { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        [Required]
        public RecommendationType Type { get; set; }

        public RecommendationPriority Priority { get; set; } = RecommendationPriority.Medium;

        public string Implementation { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,2)")]
        public decimal? EstimatedCost { get; set; }

        public int EstimatedEffortHours { get; set; } = 0;

        public int RiskReductionPercentage { get; set; } = 0;

        public string Prerequisites { get; set; } = string.Empty;

        public string Dependencies { get; set; } = string.Empty;

        public string ComplianceAlignment { get; set; } = string.Empty; // Which compliance controls this helps with

        public RecommendationStatus Status { get; set; } = RecommendationStatus.Proposed;

        public string Owner { get; set; } = string.Empty;

        public DateTime? TargetCompletionDate { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("AttackScenarioId")]
        public virtual AttackScenario? AttackScenario { get; set; }
    }

    public enum RecommendationType
    {
        Preventive,
        Detective,
        Corrective,
        Compensating,
        Administrative,
        Technical,
        Physical
    }

    public enum RecommendationPriority
    {
        Critical,
        High,
        Medium,
        Low
    }

    public enum RecommendationStatus
    {
        Proposed,
        Approved,
        InProgress,
        Implemented,
        Rejected,
        Deferred
    }
}