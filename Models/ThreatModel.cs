using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("ThreatModels")]
    public class ThreatModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Threat Model Name")]
        public string Name { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Description")]
        public string Description { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        [Display(Name = "Asset/System")]
        public string Asset { get; set; } = string.Empty;

        [StringLength(100)]
        [Display(Name = "Business Unit")]
        public string BusinessUnit { get; set; } = string.Empty;

        [StringLength(100)]
        [Display(Name = "Asset Owner")]
        public string AssetOwner { get; set; } = string.Empty;

        [Display(Name = "Asset Value")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? AssetValue { get; set; }

        [Display(Name = "Status")]
        public ThreatModelStatus Status { get; set; } = ThreatModelStatus.Draft;

        [StringLength(100)]
        [Display(Name = "Created By")]
        public string CreatedBy { get; set; } = string.Empty;

        [StringLength(100)]
        [Display(Name = "Approved By")]
        public string? ApprovedBy { get; set; }

        [Display(Name = "Created Date")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Display(Name = "Updated Date")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [Display(Name = "Approved Date")]
        public DateTime? ApprovedAt { get; set; }

        [Display(Name = "Next Review Date")]
        [DataType(DataType.Date)]
        public DateTime? NextReviewDate { get; set; }

        [Display(Name = "Review Notes")]
        public string? ReviewNotes { get; set; }

        // Framework selection
        [Display(Name = "Framework")]
        public ThreatModelingFramework Framework { get; set; } = ThreatModelingFramework.Both;

        [Display(Name = "MITRE Framework Type")]
        public MitreFrameworkType MitreFrameworkType { get; set; } = MitreFrameworkType.Enterprise;

        [Display(Name = "Organization Name")]
        [StringLength(200)]
        public string OrganizationName { get; set; } = string.Empty;

        [Display(Name = "Industry")]
        [StringLength(100)]
        public string Industry { get; set; } = string.Empty;

        [Display(Name = "Scope")]
        public string Scope { get; set; } = string.Empty;

        // Navigation properties
        public virtual ICollection<Attack> Attacks { get; set; } = new List<Attack>();
        public virtual ICollection<AttackScenario> AttackScenarios { get; set; } = new List<AttackScenario>();

        // Risk Assessment linkage
        [Column("RiskAssessmentId")]
        public int? RiskAssessmentId { get; set; }

        [ForeignKey("RiskAssessmentId")]
        public virtual RiskAssessment? LinkedRiskAssessment { get; set; }
    }
}