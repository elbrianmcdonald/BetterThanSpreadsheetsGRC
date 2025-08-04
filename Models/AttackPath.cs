using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("AttackPaths")]
    public class AttackPath
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int AttackScenarioId { get; set; }

        [Required]
        public int SourceEnvironmentId { get; set; }

        [Required]
        public int TargetEnvironmentId { get; set; }

        [Required]
        [StringLength(200)]
        public string PathName { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        public string AttackVector { get; set; } = string.Empty;

        public string Prerequisites { get; set; } = string.Empty;

        public AttackComplexity Complexity { get; set; } = AttackComplexity.Medium;

        public bool RequiresInsiderAccess { get; set; } = false;

        public bool RequiresPhysicalAccess { get; set; } = false;

        public int EstimatedTimeMinutes { get; set; } = 0;

        public string ExploitedVulnerabilities { get; set; } = string.Empty;

        public string RequiredTools { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("AttackScenarioId")]
        public virtual AttackScenario? AttackScenario { get; set; }

        [ForeignKey("SourceEnvironmentId")]
        public virtual ThreatEnvironment? SourceEnvironment { get; set; }

        [ForeignKey("TargetEnvironmentId")]
        public virtual ThreatEnvironment? TargetEnvironment { get; set; }
    }
}