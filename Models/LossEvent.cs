using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("LossEvents")]
    public class LossEvent : IAuditableEntity
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Loss Event Title")]
        public string Title { get; set; } = string.Empty;

        [Required]
        [StringLength(500)]
        [Display(Name = "Description")]
        public string Description { get; set; } = string.Empty;

        [Display(Name = "MITRE ATT&CK Technique")]
        public int? MitreTechniqueId { get; set; }

        [Display(Name = "Custom Technique")]
        [StringLength(200)]
        public string? CustomTechnique { get; set; }

        // LEF (Loss Event Frequency) Distribution - calculated from TEF * Vuln chain
        [Display(Name = "LEF Minimum (per year)")]
        public double LefMinimum { get; set; } // Auto-calculated

        [Display(Name = "LEF Maximum (per year)")]
        public double LefMaximum { get; set; } // Auto-calculated

        [Display(Name = "LEF Most Likely (per year)")]
        public double LefMostLikely { get; set; } // Auto-calculated

        // Impact values (for FAIR analysis)
        [Display(Name = "Primary Loss Minimum ($)")]
        [Range(0, double.MaxValue, ErrorMessage = "Primary Loss Minimum must be greater than or equal to 0")]
        public double? PrimaryLossMinimum { get; set; }

        [Display(Name = "Primary Loss Maximum ($)")]
        [Range(0, double.MaxValue, ErrorMessage = "Primary Loss Maximum must be greater than or equal to 0")]
        public double? PrimaryLossMaximum { get; set; }

        [Display(Name = "Primary Loss Most Likely ($)")]
        public double? PrimaryLossMostLikely { get; set; } // Auto-calculated

        [Display(Name = "Secondary Loss Minimum ($)")]
        [Range(0, double.MaxValue, ErrorMessage = "Secondary Loss Minimum must be greater than or equal to 0")]
        public double? SecondaryLossMinimum { get; set; }

        [Display(Name = "Secondary Loss Maximum ($)")]
        [Range(0, double.MaxValue, ErrorMessage = "Secondary Loss Maximum must be greater than or equal to 0")]
        public double? SecondaryLossMaximum { get; set; }

        [Display(Name = "Secondary Loss Most Likely ($)")]
        public double? SecondaryLossMostLikely { get; set; } // Auto-calculated

        // Total Annual Loss Exposure (ALE)
        [Display(Name = "ALE Minimum ($)")]
        public double AleMinimum { get; set; } // Auto-calculated

        [Display(Name = "ALE Maximum ($)")]
        public double AleMaximum { get; set; } // Auto-calculated

        [Display(Name = "ALE Most Likely ($)")]
        public double AleMostLikely { get; set; } // Auto-calculated

        // Control associations (JSON arrays of control IDs)
        [Display(Name = "Preventative Controls")]
        public string PreventativeControls { get; set; } = "[]"; // JSON array

        [Display(Name = "Detective Controls")]
        public string DetectiveControls { get; set; } = "[]"; // JSON array

        [Display(Name = "Data Sources")]
        public string DataSources { get; set; } = "[]"; // JSON array

        // Loss categorization
        [Display(Name = "Loss Type")]
        [StringLength(100)]
        public string LossType { get; set; } = string.Empty; // Data Breach, Service Disruption, etc.

        [Display(Name = "Business Impact Category")]
        [StringLength(100)]
        public string BusinessImpactCategory { get; set; } = string.Empty; // Financial, Reputation, Regulatory, etc.

        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public string CreatedBy { get; set; } = string.Empty;
        public string UpdatedBy { get; set; } = string.Empty;
        
        [Timestamp]
        public byte[]? RowVersion { get; set; }

        // Threat Scenario relationship
        [Display(Name = "Threat Scenario")]
        public int? ThreatScenarioId { get; set; }

        // Navigation properties
        [ForeignKey("MitreTechniqueId")]
        public virtual MitreTechnique? MitreTechnique { get; set; }

        [ForeignKey("ThreatScenarioId")]
        public virtual ThreatScenario? ThreatScenario { get; set; }

        public virtual ICollection<AttackStepVulnerability> AttackStepVulnerabilities { get; set; } = new List<AttackStepVulnerability>();
        public virtual ICollection<AttackChain> AttackChains { get; set; } = new List<AttackChain>();
    }
}