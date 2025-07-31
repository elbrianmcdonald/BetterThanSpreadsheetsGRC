using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("Risks")]
    public class Risk
    {
        [Key]
        public int Id { get; set; }

        [Display(Name = "Register ID")]
        public string RiskNumber { get; set; } = string.Empty;

        [StringLength(200)]
        public string Title { get; set; } = string.Empty;

        [Display(Name = "Threat Scenario")]
        public string ThreatScenario { get; set; } = string.Empty;

        [Display(Name = "CIA Triad")]
        public CIATriad CIATriad { get; set; }

        [Display(Name = "Risk Statement")]
        public string Description { get; set; } = string.Empty;

        [StringLength(100)]
        [Display(Name = "Organization")]
        public string BusinessUnit { get; set; } = string.Empty;

        [StringLength(200)]
        public string Asset { get; set; } = string.Empty;

        [StringLength(100)]
        [Display(Name = "Risk Owner")]
        public string Owner { get; set; } = string.Empty;

        [Display(Name = "Impact")]
        public ImpactLevel Impact { get; set; }

        [Display(Name = "Likelihood")]
        public LikelihoodLevel Likelihood { get; set; }

        [Display(Name = "Exposure")]
        public ExposureLevel Exposure { get; set; }

        [Display(Name = "Inherent Risk Level")]
        public RiskLevel InherentRiskLevel { get; set; }

        [Display(Name = "Risk Treatment")]
        public TreatmentStrategy Treatment { get; set; }

        [Display(Name = "Residual Risk")]
        public RiskLevel ResidualRiskLevel { get; set; }

        [Display(Name = "Treatment Plan")]
        public string TreatmentPlan { get; set; } = string.Empty;

        [Display(Name = "Risk Assessment")]
        public string RiskAssessmentReference { get; set; } = string.Empty;

        [Display(Name = "Date Opened")]
        [DataType(DataType.Date)]
        public DateTime OpenDate { get; set; }

        [Display(Name = "Last Reviewed")]
        [DataType(DataType.Date)]
        public DateTime? NextReviewDate { get; set; }

        // Legacy fields for compatibility
        [Display(Name = "Annual Loss Expectancy")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ALE { get; set; }

        [Display(Name = "Risk Level")]
        public RiskLevel RiskLevel { get; set; }

        public RiskStatus Status { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        // Foreign Keys with explicit column names
        [Column("FindingId")]
        public int? FindingId { get; set; }

        [Column("RiskAssessmentId")]
        public int? RiskAssessmentId { get; set; }

        // Navigation properties
        [ForeignKey("FindingId")]
        public virtual Finding? LinkedFinding { get; set; }

        [ForeignKey("RiskAssessmentId")]
        public virtual RiskAssessment? LinkedAssessment { get; set; }
    }
}