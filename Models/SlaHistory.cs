using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class SlaHistory : IAuditableEntity
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public SlaType SlaType { get; set; }

        [Required]
        [StringLength(50)]
        public string ItemType { get; set; } = string.Empty; // "Finding", "RiskAssessment", "ComplianceAssessment", "MaturityAssessment", "Risk"

        [Required]
        public int ItemId { get; set; }

        [Required]
        [StringLength(200)]
        public string ItemDescription { get; set; } = string.Empty;

        [Required]
        public RiskLevel RiskLevel { get; set; }

        [Required]
        [StringLength(100)]
        public string AssignedTo { get; set; } = string.Empty;

        [StringLength(100)]
        public string AssignedToEmail { get; set; } = string.Empty;

        [Required]
        public DateTime SlaStartDate { get; set; }

        [Required]
        public DateTime SlaDeadline { get; set; }

        public DateTime? CompletedDate { get; set; }

        [Required]
        public int SlaHours { get; set; }

        [Required]
        public SlaComplianceStatus ComplianceStatus { get; set; }

        public TimeSpan? CompletionTime { get; set; } // Time taken to complete (CompletedDate - SlaStartDate)

        public TimeSpan? SlaVariance { get; set; } // Positive = completed early, Negative = completed late

        [StringLength(500)]
        public string Notes { get; set; } = string.Empty;

        // Audit and Concurrency Control Fields
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        
        [Required]
        [StringLength(100)]
        [Display(Name = "Created By")]
        [ScaffoldColumn(false)]
        public string CreatedBy { get; set; } = string.Empty;
        
        [Required]
        [StringLength(100)]
        [Display(Name = "Updated By")]
        [ScaffoldColumn(false)]
        public string UpdatedBy { get; set; } = string.Empty;
        
        [Timestamp]
        public byte[] RowVersion { get; set; } = Array.Empty<byte>();
    }
}