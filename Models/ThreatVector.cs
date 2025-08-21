using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class ThreatVector : IAuditableEntity
    {
        public int Id { get; set; }

        [Required]
        public int ThreatScenarioId { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Threat Vector Name")]
        public string Name { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Description")]
        public string Description { get; set; } = string.Empty;

        [StringLength(100)]
        [Display(Name = "MITRE ATT&CK Technique")]
        public string MitreTechnique { get; set; } = string.Empty;

        // Audit and Concurrency Control Fields
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        
        [Required]
        [StringLength(100)]
        [Display(Name = "Created By")]
        public string CreatedBy { get; set; } = string.Empty;
        
        [Required]
        [StringLength(100)]
        [Display(Name = "Updated By")]
        public string UpdatedBy { get; set; } = string.Empty;
        
        [Timestamp]
        public byte[]? RowVersion { get; set; }

        // Navigation properties
        [ForeignKey("ThreatScenarioId")]
        public virtual ThreatScenario ThreatScenario { get; set; } = null!;

        // Control relationships
        public virtual ICollection<ThreatVectorControl> Controls { get; set; } = new List<ThreatVectorControl>();
    }
}