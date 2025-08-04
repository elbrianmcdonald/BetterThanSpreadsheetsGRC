using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("KillChainActivities")]
    public class KillChainActivity
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        [Required]
        public CyberKillChainPhase Phase { get; set; }

        [StringLength(50)]
        public string EnvironmentType { get; set; } = string.Empty; // Optional environment context

        public string Techniques { get; set; } = string.Empty; // Specific techniques used

        public string Tools { get; set; } = string.Empty;

        public string Indicators { get; set; } = string.Empty;

        public string Prerequisites { get; set; } = string.Empty;

        public string ExpectedOutcome { get; set; } = string.Empty;

        public int EstimatedTimeMinutes { get; set; } = 0;

        public AttackComplexity Complexity { get; set; } = AttackComplexity.Low;

        public bool RequiresUserInteraction { get; set; } = false;

        public bool IsCustom { get; set; } = false; // User-defined vs predefined

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public virtual ICollection<AttackScenarioStep> ScenarioSteps { get; set; } = new List<AttackScenarioStep>();
    }
}