using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("AttackScenarios")]
    public class AttackScenario
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ThreatModelId { get; set; }

        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        public string InitialAccess { get; set; } = string.Empty;

        public string Objective { get; set; } = string.Empty;

        public int EstimatedDurationHours { get; set; } = 0;

        public AttackComplexity Complexity { get; set; } = AttackComplexity.Low;

        public string ExistingControls { get; set; } = string.Empty;

        public string ControlGaps { get; set; } = string.Empty;

        public string RecommendedMitigations { get; set; } = string.Empty;

        public ScenarioStatus Status { get; set; } = ScenarioStatus.Draft;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("ThreatModelId")]
        public virtual ThreatModel? ThreatModel { get; set; }

        public virtual ICollection<AttackScenarioStep> Steps { get; set; } = new List<AttackScenarioStep>();
        public virtual ICollection<AttackPath> AttackPaths { get; set; } = new List<AttackPath>();
        public virtual ICollection<MitreTechnique> MitreTechniques { get; set; } = new List<MitreTechnique>();
        public virtual ICollection<ScenarioRecommendation> Recommendations { get; set; } = new List<ScenarioRecommendation>();
    }

    public enum ScenarioStatus
    {
        Draft,
        UnderReview,
        Approved,
        Archived
    }
}