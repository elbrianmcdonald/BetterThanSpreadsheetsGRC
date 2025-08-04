using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("Attacks")]
    public class Attack
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Attack Name")]
        public string Name { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Attack Description")]
        public string Description { get; set; } = string.Empty;

        [Display(Name = "Kill Chain Phase")]
        public CyberKillChainPhase KillChainPhase { get; set; }

        [Display(Name = "Attack Vector")]
        public AttackVector AttackVector { get; set; }

        [Display(Name = "Attack Complexity")]
        public AttackComplexity AttackComplexity { get; set; }

        [Display(Name = "Threat Actor Type")]
        public ThreatActorType ThreatActorType { get; set; }

        [Display(Name = "Prerequisites")]
        public string? Prerequisites { get; set; }

        [Display(Name = "Attack Steps")]
        public string AttackSteps { get; set; } = string.Empty;

        // Kill Chain Phase-specific steps
        [Display(Name = "Reconnaissance Steps")]
        public string? ReconnaissanceSteps { get; set; }

        [Display(Name = "Weaponization Steps")]
        public string? WeaponizationSteps { get; set; }

        [Display(Name = "Delivery Steps")]
        public string? DeliverySteps { get; set; }

        [Display(Name = "Exploitation Steps")]
        public string? ExploitationSteps { get; set; }

        [Display(Name = "Installation Steps")]
        public string? InstallationSteps { get; set; }

        [Display(Name = "Command & Control Steps")]
        public string? CommandAndControlSteps { get; set; }

        [Display(Name = "Actions on Objectives Steps")]
        public string? ActionsOnObjectivesSteps { get; set; }

        [Display(Name = "Tools & Techniques")]
        public string? ToolsAndTechniques { get; set; }

        [Display(Name = "Indicators of Compromise")]
        public string? IndicatorsOfCompromise { get; set; }

        [Display(Name = "Impact")]
        public ImpactLevel Impact { get; set; }

        [Display(Name = "Likelihood")]
        public LikelihoodLevel Likelihood { get; set; }

        [Display(Name = "Risk Level")]
        public RiskLevel RiskLevel { get; set; }

        [Display(Name = "Existing Controls")]
        public string? ExistingControls { get; set; }

        [Display(Name = "Recommended Mitigations")]
        public string? RecommendedMitigations { get; set; }

        [Display(Name = "MITRE ATT&CK Technique")]
        [StringLength(50)]
        public string? MitreAttackTechnique { get; set; }

        [Display(Name = "MITRE ATT&CK Tactic")]
        [StringLength(100)]
        public string? MitreAttackTactic { get; set; }

        [Display(Name = "Detection Difficulty")]
        public AttackComplexity DetectionDifficulty { get; set; }

        [Display(Name = "Residual Risk")]
        public RiskLevel ResidualRisk { get; set; }

        [Display(Name = "Treatment Strategy")]
        public TreatmentStrategy TreatmentStrategy { get; set; }

        [Display(Name = "Notes")]
        public string? Notes { get; set; }

        [Display(Name = "Created Date")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Display(Name = "Updated Date")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Foreign Keys
        [Required]
        [Column("ThreatModelId")]
        public int ThreatModelId { get; set; }

        [Column("FindingId")]
        public int? FindingId { get; set; }

        [Column("RiskId")]
        public int? RiskId { get; set; }

        // Navigation properties
        [ForeignKey("ThreatModelId")]
        public virtual ThreatModel? ThreatModel { get; set; }

        [ForeignKey("FindingId")]
        public virtual Finding? LinkedFinding { get; set; }

        [ForeignKey("RiskId")]
        public virtual Risk? LinkedRisk { get; set; }
    }
}