using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    /// <summary>
    /// Represents a threat model instance specific to a risk assessment.
    /// This is a copy of a template AttackChain that can be customized for the specific assessment.
    /// </summary>
    public class RiskAssessmentThreatModel : IAuditableEntity
    {
        public int Id { get; set; }

        [Required]
        [Display(Name = "Risk Assessment")]
        public int RiskAssessmentId { get; set; }

        [Required]
        [Display(Name = "Template Source")]
        public int TemplateAttackChainId { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Threat Model Title")]
        public string Title { get; set; } = string.Empty;

        [Display(Name = "Description")]
        public string Description { get; set; } = string.Empty;

        [Display(Name = "Status")]
        public AttackChainStatus Status { get; set; } = AttackChainStatus.Draft;

        // Threat Event Data (JSON serialized)
        [Column(TypeName = "jsonb")]
        public string ThreatEventData { get; set; } = "{}";

        // Vulnerabilities Data (JSON serialized)
        [Column(TypeName = "jsonb")]
        public string VulnerabilitiesData { get; set; } = "[]";

        // Loss Event Data (JSON serialized)
        [Column(TypeName = "jsonb")]
        public string LossEventData { get; set; } = "{}";

        // ALE Calculation Results
        [Column(TypeName = "decimal(18,2)")]
        public decimal ALEMinimum { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ALEMostLikely { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ALEMaximum { get; set; }

        [Column(TypeName = "decimal(8,4)")]
        public decimal LEFValue { get; set; }

        // Navigation properties
        public virtual RiskAssessment RiskAssessment { get; set; } = null!;
        public virtual AttackChain TemplateAttackChain { get; set; } = null!;

        // Audit fields
        [StringLength(100)]
        public string CreatedBy { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }

        [StringLength(100)]
        public string UpdatedBy { get; set; } = string.Empty;

        public DateTime UpdatedAt { get; set; }

        public byte[]? RowVersion { get; set; }

        // Additional properties for backwards compatibility
        [StringLength(100)]
        public string? ModifiedBy 
        { 
            get => UpdatedBy; 
            set => UpdatedBy = value ?? string.Empty; 
        }

        public DateTime? ModifiedAt 
        { 
            get => UpdatedAt == default ? null : UpdatedAt; 
            set => UpdatedAt = value ?? DateTime.UtcNow; 
        }
    }
}