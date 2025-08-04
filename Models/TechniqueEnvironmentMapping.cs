using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("TechniqueEnvironmentMappings")]
    public class TechniqueEnvironmentMapping
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int MitreTechniqueId { get; set; }

        [Required]
        public int EnvironmentId { get; set; }

        public bool IsApplicable { get; set; } = true;

        public string EnvironmentSpecificNotes { get; set; } = string.Empty;

        public string CustomImplementation { get; set; } = string.Empty;

        public AttackComplexity ImplementationDifficulty { get; set; } = AttackComplexity.Medium;

        public string DetectionMethods { get; set; } = string.Empty;

        public string PreventionMethods { get; set; } = string.Empty;

        public int RiskScore { get; set; } = 0; // 0-100

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("MitreTechniqueId")]
        public virtual MitreTechnique? MitreTechnique { get; set; }

        [ForeignKey("EnvironmentId")]
        public virtual ThreatEnvironment? Environment { get; set; }
    }
}