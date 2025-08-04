using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("AttackScenarioSteps")]
    public class AttackScenarioStep
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int AttackScenarioId { get; set; }

        [Required]
        public int StepNumber { get; set; }

        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        [Required]
        public CyberKillChainPhase KillChainPhase { get; set; }

        public int? MitreTechniqueId { get; set; }

        public int? KillChainActivityId { get; set; }

        public string CustomTechnique { get; set; } = string.Empty; // For user-defined techniques

        public string Tools { get; set; } = string.Empty;

        public string Commands { get; set; } = string.Empty;

        public string ExpectedOutcome { get; set; } = string.Empty;

        public string DetectionMethods { get; set; } = string.Empty;

        public string PreventionMeasures { get; set; } = string.Empty;

        public int EstimatedTimeMinutes { get; set; } = 0;

        public AttackComplexity Complexity { get; set; } = AttackComplexity.Low;

        public bool RequiresPrivilegeEscalation { get; set; } = false;

        public bool LeavesForensicEvidence { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("AttackScenarioId")]
        public virtual AttackScenario? AttackScenario { get; set; }

        [ForeignKey("MitreTechniqueId")]
        public virtual MitreTechnique? MitreTechnique { get; set; }

        [ForeignKey("KillChainActivityId")]
        public virtual KillChainActivity? KillChainActivity { get; set; }
    }
}