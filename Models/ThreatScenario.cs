using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class ThreatScenario : IAuditableEntity
    {
        public int Id { get; set; }

        [Required]
        public int RiskAssessmentId { get; set; }

        [Display(Name = "Threat Scenario Description")]
        public string Description { get; set; } = string.Empty;

        [Display(Name = "Likelihood Level")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal? QualitativeLikelihood { get; set; }

        [Display(Name = "Impact Level")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal? QualitativeImpact { get; set; }

        [Display(Name = "Exposure Level")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal? QualitativeExposure { get; set; }

        // Calculated Qualitative Risk Score for this scenario
        [Display(Name = "Risk Score")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal? QualitativeRiskScore { get; set; }

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

        // Collection of identified risks for this threat scenario
        public virtual ICollection<Risk> IdentifiedRisks { get; set; } = new List<Risk>();

        // Collection of threat events for threat modeling
        public virtual ICollection<ThreatEvent> ThreatEvents { get; set; } = new List<ThreatEvent>();

        // Collection of loss events for threat modeling
        public virtual ICollection<LossEvent> LossEvents { get; set; } = new List<LossEvent>();

        // Method to calculate risk level for this scenario
        public string CalculateRiskLevel()
        {
            if (QualitativeRiskScore.HasValue)
            {
                return QualitativeRiskScore.Value switch
                {
                    >= 16 => "Critical",
                    >= 10 => "High",
                    >= 4 => "Medium",
                    _ => "Low"
                };
            }

            return "Unknown";
        }

        // Method to calculate risk score based on likelihood, impact, and exposure
        public void CalculateRiskScore()
        {
            if (QualitativeLikelihood.HasValue && QualitativeImpact.HasValue && QualitativeExposure.HasValue)
            {
                // Use decimal values directly from RiskMatrixLevel system
                var likelihood = QualitativeLikelihood.Value;
                var impact = QualitativeImpact.Value;
                var exposureMultiplier = QualitativeExposure.Value;
                
                QualitativeRiskScore = (likelihood * impact) * exposureMultiplier;
            }
            else
            {
                QualitativeRiskScore = null;
            }
        }
    }
}