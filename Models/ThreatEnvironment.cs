using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("Environments")]
    public class ThreatEnvironment
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ThreatModelId { get; set; }

        [Required]
        [StringLength(50)]
        public string EnvironmentType { get; set; } = string.Empty; // CrownJewels, Azure, Corporate, Remote, Plant, OT

        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        public bool IsEnabled { get; set; } = true;

        public AccessType AccessType { get; set; } = AccessType.Internal;

        public bool IsSegmented { get; set; } = false;

        public string NetworkDetails { get; set; } = string.Empty;

        public string SecurityControls { get; set; } = string.Empty;

        public int Priority { get; set; } = 0; // For ordering

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("ThreatModelId")]
        public virtual ThreatModel? ThreatModel { get; set; }

        public virtual ICollection<TechniqueEnvironmentMapping> TechniqueMappings { get; set; } = new List<TechniqueEnvironmentMapping>();
        public virtual ICollection<AttackPath> SourcePaths { get; set; } = new List<AttackPath>();
        public virtual ICollection<AttackPath> TargetPaths { get; set; } = new List<AttackPath>();
    }

    public enum AccessType
    {
        Internal,
        External,
        Both
    }
}