using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("ThreatEvents")]
    public class ThreatEvent : IAuditableEntity
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Threat Event Title")]
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

        // TEF (Threat Event Frequency) Distribution
        [Required]
        [Display(Name = "TEF Minimum (per year)")]
        [Range(0, double.MaxValue, ErrorMessage = "TEF Minimum must be greater than or equal to 0")]
        public double TefMinimum { get; set; }

        [Required]
        [Display(Name = "TEF Maximum (per year)")]
        [Range(0, double.MaxValue, ErrorMessage = "TEF Maximum must be greater than or equal to 0")]
        public double TefMaximum { get; set; }

        [Display(Name = "TEF Most Likely (per year)")]
        public double TefMostLikely { get; set; } // Auto-calculated

        // Control associations (JSON arrays of control IDs)
        [Display(Name = "Preventative Controls")]
        public string PreventativeControls { get; set; } = "[]"; // JSON array

        [Display(Name = "Detective Controls")]
        public string DetectiveControls { get; set; } = "[]"; // JSON array

        [Display(Name = "Data Sources")]
        public string DataSources { get; set; } = "[]"; // JSON array

        // Linking to the next step in the attack chain
        [Display(Name = "Next Vulnerability")]
        public int? NextVulnerabilityId { get; set; }

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

        [ForeignKey("NextVulnerabilityId")]
        public virtual AttackStepVulnerability? NextVulnerability { get; set; }

        [ForeignKey("ThreatScenarioId")]
        public virtual ThreatScenario? ThreatScenario { get; set; }

        public virtual ICollection<AttackChain> AttackChains { get; set; } = new List<AttackChain>();
    }
}