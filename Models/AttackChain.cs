using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("AttackChains")]
    public class AttackChain : IAuditableEntity
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Attack Chain Name")]
        public string Name { get; set; } = string.Empty;

        [StringLength(1000)]
        [Display(Name = "Description")]
        public string Description { get; set; } = string.Empty;

        // Starting point of the attack chain
        [Required]
        [Display(Name = "Initial Threat Event")]
        public int ThreatEventId { get; set; }

        // Ending point of the attack chain
        [Required]
        [Display(Name = "Final Loss Event")]
        public int LossEventId { get; set; }

        // Attack chain metadata
        [Display(Name = "Risk Assessment")]
        public int? RiskAssessmentId { get; set; }

        [Display(Name = "Environment")]
        public int? EnvironmentId { get; set; }

        [Display(Name = "Asset Category")]
        [StringLength(100)]
        public string? AssetCategory { get; set; }

        [Display(Name = "Attack Vector")]
        [StringLength(100)]
        public string? AttackVector { get; set; } // Network, Physical, Human, etc.

        // Overall chain calculations
        [Display(Name = "Chain Probability")]
        public double ChainProbability { get; set; } // Combined probability of entire chain

        [Display(Name = "Chain ALE Minimum")]
        public double ChainAleMinimum { get; set; }

        [Display(Name = "Chain ALE Maximum")]
        public double ChainAleMaximum { get; set; }

        [Display(Name = "Chain ALE Most Likely")]
        public double ChainAleMostLikely { get; set; }

        // Status and workflow
        [Display(Name = "Status")]
        public AttackChainStatus Status { get; set; } = AttackChainStatus.Draft;

        [Display(Name = "Reviewed By")]
        [StringLength(100)]
        public string? ReviewedBy { get; set; }

        [Display(Name = "Review Date")]
        public DateTime? ReviewedAt { get; set; }

        [Display(Name = "Approved By")]
        [StringLength(100)]
        public string? ApprovedBy { get; set; }

        [Display(Name = "Approval Date")]
        public DateTime? ApprovedAt { get; set; }

        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public string CreatedBy { get; set; } = string.Empty;
        public string UpdatedBy { get; set; } = string.Empty;
        
        [Timestamp]
        public byte[]? RowVersion { get; set; }

        // Navigation properties
        [ForeignKey("ThreatEventId")]
        public virtual ThreatEvent ThreatEvent { get; set; } = null!;

        [ForeignKey("LossEventId")]
        public virtual LossEvent LossEvent { get; set; } = null!;

        [ForeignKey("RiskAssessmentId")]
        public virtual RiskAssessment? RiskAssessment { get; set; }

        [ForeignKey("EnvironmentId")]
        public virtual ThreatEnvironment? Environment { get; set; }

        public virtual ICollection<AttackChainStep> AttackChainSteps { get; set; } = new List<AttackChainStep>();
    }

    [Table("AttackChainSteps")]
    public class AttackChainStep
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [Display(Name = "Attack Chain")]
        public int AttackChainId { get; set; }

        [Display(Name = "Step Order")]
        public int StepOrder { get; set; }

        [Display(Name = "Step Type")]
        public AttackChainStepType StepType { get; set; }

        // Reference to either a vulnerability or the loss event
        [Display(Name = "Vulnerability")]
        public int? VulnerabilityId { get; set; }

        [Display(Name = "Is Final Step")]
        public bool IsFinalStep { get; set; } = false;

        // Step-specific calculations
        [Display(Name = "Step Probability")]
        public double StepProbability { get; set; }

        [Display(Name = "Cumulative Probability")]
        public double CumulativeProbability { get; set; } // Probability up to this step

        // Navigation properties
        [ForeignKey("AttackChainId")]
        public virtual AttackChain AttackChain { get; set; } = null!;

        [ForeignKey("VulnerabilityId")]
        public virtual AttackStepVulnerability? Vulnerability { get; set; }
    }

    public enum AttackChainStatus
    {
        Draft,
        UnderReview,
        Reviewed,
        Approved,
        Archived
    }

    public enum AttackChainStepType
    {
        InitialThreatEvent,
        VulnerabilityExploitation,
        LossEvent
    }
}