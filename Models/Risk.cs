using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("Risks")]
    public class Risk : IAuditableEntity
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

        [Required]
        [StringLength(100)]
        [Display(Name = "Business Owner")]
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

        [Display(Name = "Next Review Date")]
        [DataType(DataType.Date)]
        public DateTime? NextReviewDate { get; set; }

        [Display(Name = "Last Review Date")]
        [DataType(DataType.Date)]
        public DateTime? LastReviewDate { get; set; }

        [Display(Name = "Risk Acceptance Date")]
        [DataType(DataType.Date)]
        public DateTime? AcceptanceDate { get; set; }

        [Display(Name = "Reviewed By")]
        [StringLength(100)]
        public string? ReviewedBy { get; set; }

        [Display(Name = "Date Closed")]
        [DataType(DataType.Date)]
        public DateTime? ClosedDate { get; set; }

        [Display(Name = "Remediation Details")]
        public string RemediationDetails { get; set; } = string.Empty;

        [Display(Name = "Closed By")]
        [StringLength(100)]
        public string ClosedBy { get; set; } = string.Empty;

        // Legacy fields for compatibility
        [Display(Name = "Annual Loss Expectancy")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ALE { get; set; }

        [Display(Name = "Risk Level")]
        public RiskLevel RiskLevel { get; set; }

        public RiskStatus Status { get; set; }

        // SLA-related computed properties
        [NotMapped]
        public bool IsReviewOverdue
        {
            get
            {
                if (Status != RiskStatus.Accepted || !NextReviewDate.HasValue)
                    return false;
                return DateTime.UtcNow > NextReviewDate.Value;
            }
        }

        [NotMapped]
        public TimeSpan? TimeUntilReview
        {
            get
            {
                if (!NextReviewDate.HasValue || Status != RiskStatus.Accepted)
                    return null;
                var timeSpan = NextReviewDate.Value - DateTime.UtcNow;
                return timeSpan.TotalSeconds > 0 ? timeSpan : null;
            }
        }

        [NotMapped]
        public TimeSpan? OverdueBy
        {
            get
            {
                if (!IsReviewOverdue || !NextReviewDate.HasValue)
                    return null;
                return DateTime.UtcNow - NextReviewDate.Value;
            }
        }

        // Audit and Concurrency Control Fields
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        
        [Required]
        [StringLength(100)]
        [Display(Name = "Created By")]
        [ScaffoldColumn(false)] // Hide from forms
        public string CreatedBy { get; set; } = string.Empty;
        
        [Required]
        [StringLength(100)]
        [Display(Name = "Updated By")]
        [ScaffoldColumn(false)] // Hide from forms
        public string UpdatedBy { get; set; } = string.Empty;
        
        [Timestamp]
        public byte[] RowVersion { get; set; } = Array.Empty<byte>();

        // Foreign Keys with explicit column names
        [Column("FindingId")]
        public int? FindingId { get; set; }

        [Column("RiskAssessmentId")]
        public int? RiskAssessmentId { get; set; }

        [Column("ThreatScenarioId")]
        public int? ThreatScenarioId { get; set; }

        // Navigation properties
        [ForeignKey("FindingId")]
        public virtual Finding? LinkedFinding { get; set; }

        [ForeignKey("RiskAssessmentId")]
        public virtual RiskAssessment? LinkedAssessment { get; set; }

        [ForeignKey("ThreatScenarioId")]
        public virtual ThreatScenario? LinkedThreatScenario { get; set; }
    }
}