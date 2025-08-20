using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class ThreatScenario : IAuditableEntity
    {
        public int Id { get; set; }

        [Required]
        public int RiskAssessmentId { get; set; }

        [Required]
        [StringLength(50)]
        [Display(Name = "Scenario ID")]
        public string ScenarioId { get; set; } = string.Empty;

        [Required]
        [StringLength(200)]
        [Display(Name = "Scenario Name")]
        public string ScenarioName { get; set; } = string.Empty;

        [Display(Name = "Threat Scenario Description")]
        public string Description { get; set; } = string.Empty;

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
        public byte[] RowVersion { get; set; } = new byte[] { 0, 0, 0, 0, 0, 0, 0, 1 };

        // Navigation properties
        [ForeignKey("RiskAssessmentId")]
        public virtual RiskAssessment RiskAssessment { get; set; } = null!;

        // One-to-one relationship with threat vector
        public virtual ThreatVector? ThreatVector { get; set; }

        // One-to-many relationship with threat actor steps
        public virtual ICollection<ThreatActorStep> ThreatActorSteps { get; set; } = new List<ThreatActorStep>();

        // One-to-one relationship with threat actor objective
        public virtual ThreatActorObjective? ThreatActorObjective { get; set; }

        // One-to-many relationship with scenario risks
        public virtual ICollection<ScenarioRisk> ScenarioRisks { get; set; } = new List<ScenarioRisk>();

        // Collection of identified risks for this threat scenario (legacy)
        public virtual ICollection<Risk> IdentifiedRisks { get; set; } = new List<Risk>();

        // Collection of threat events for threat modeling (legacy)
        public virtual ICollection<ThreatEvent> ThreatEvents { get; set; } = new List<ThreatEvent>();

        // Collection of loss events for threat modeling (legacy)
        public virtual ICollection<LossEvent> LossEvents { get; set; } = new List<LossEvent>();

        // Method to calculate overall risk level for this scenario based on highest individual risk
        public string CalculateOverallRiskLevel()
        {
            if (ScenarioRisks?.Any() == true)
            {
                var riskScores = ScenarioRisks
                    .Where(r => r.CurrentRiskScore.HasValue)
                    .Select(r => r.CurrentRiskScore!.Value)
                    .ToList();

                if (riskScores.Any())
                {
                    var maxRiskScore = riskScores.Max();
                    return maxRiskScore switch
                    {
                        >= 16 => "Critical",
                        >= 10 => "High",
                        >= 4 => "Medium",
                        _ => "Low"
                    };
                }
            }

            return "Unknown";
        }

        // Method to calculate overall risk score for this scenario (highest individual risk)
        public decimal? CalculateOverallRiskScore()
        {
            if (ScenarioRisks?.Any() == true)
            {
                var riskScores = ScenarioRisks
                    .Where(r => r.CurrentRiskScore.HasValue)
                    .Select(r => r.CurrentRiskScore!.Value)
                    .ToList();

                if (riskScores.Any())
                {
                    return riskScores.Max();
                }
            }

            return null;
        }

        // Method to get count of risks by level
        public Dictionary<string, int> GetRiskCountsByLevel()
        {
            var counts = new Dictionary<string, int>
            {
                ["Critical"] = 0,
                ["High"] = 0,
                ["Medium"] = 0,
                ["Low"] = 0
            };

            if (ScenarioRisks?.Any() == true)
            {
                foreach (var risk in ScenarioRisks.Where(r => !string.IsNullOrEmpty(r.CurrentRiskLevel)))
                {
                    if (counts.ContainsKey(risk.CurrentRiskLevel))
                    {
                        counts[risk.CurrentRiskLevel]++;
                    }
                }
            }

            return counts;
        }
    }
}