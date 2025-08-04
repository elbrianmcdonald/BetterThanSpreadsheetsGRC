using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("MitreTechniques")]
    public class MitreTechnique
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(20)]
        public string TechniqueId { get; set; } = string.Empty; // T1234, T1234.001

        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string Tactic { get; set; } = string.Empty; // Initial Access, Execution, etc.

        [Required]
        public MitreFrameworkType FrameworkType { get; set; } = MitreFrameworkType.Enterprise;

        public int? ParentTechniqueId { get; set; } // For sub-techniques

        public string Platforms { get; set; } = string.Empty; // Windows, Linux, macOS, etc.

        public string DataSources { get; set; } = string.Empty;

        public string Detection { get; set; } = string.Empty;

        public string Mitigation { get; set; } = string.Empty;

        public string Examples { get; set; } = string.Empty;

        public string Version { get; set; } = "13.0"; // ATT&CK version

        public bool IsSubTechnique { get; set; } = false;

        public bool IsDeprecated { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public virtual ICollection<TechniqueEnvironmentMapping> EnvironmentMappings { get; set; } = new List<TechniqueEnvironmentMapping>();
        public virtual ICollection<AttackScenario> AttackScenarios { get; set; } = new List<AttackScenario>();
        public virtual ICollection<MitreTechnique> SubTechniques { get; set; } = new List<MitreTechnique>();
        
        [ForeignKey("ParentTechniqueId")]
        public virtual MitreTechnique? ParentTechnique { get; set; }
    }
}