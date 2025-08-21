using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class ScenarioRisk : IAuditableEntity
    {
        public int Id { get; set; }

        [Required]
        public int ThreatScenarioId { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Risk Name")]
        public string RiskName { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Risk Description")]
        public string RiskDescription { get; set; } = string.Empty;

        // Current Risk Ratings (before treatment)
        [Display(Name = "Current Impact Level")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal? CurrentImpact { get; set; }

        [Display(Name = "Current Likelihood Level")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal? CurrentLikelihood { get; set; }

        [Display(Name = "Current Exposure Level")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal? CurrentExposure { get; set; }

        // Calculated Current Risk Score
        [Display(Name = "Current Risk Score")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal? CurrentRiskScore { get; set; }

        [StringLength(50)]
        [Display(Name = "Current Risk Level")]
        public string CurrentRiskLevel { get; set; } = string.Empty;

        [Display(Name = "Current Risk Above Appetite")]
        public bool IsCurrentRiskAboveAppetite { get; set; }

        // Residual Risk Ratings (after treatment)
        [Display(Name = "Residual Impact Level")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal? ResidualImpact { get; set; }

        [Display(Name = "Residual Likelihood Level")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal? ResidualLikelihood { get; set; }

        [Display(Name = "Residual Exposure Level")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal? ResidualExposure { get; set; }

        // Calculated Residual Risk Score
        [Display(Name = "Residual Risk Score")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal? ResidualRiskScore { get; set; }

        [StringLength(50)]
        [Display(Name = "Residual Risk Level")]
        public string ResidualRiskLevel { get; set; } = string.Empty;

        [Display(Name = "Residual Risk Above Appetite")]
        public bool IsResidualRiskAboveAppetite { get; set; }

        // Risk Treatment Plan
        [Display(Name = "Risk Treatment Plan")]
        public string RiskTreatmentPlan { get; set; } = string.Empty;

        [Display(Name = "Expected Treatment Completion Date")]
        [DataType(DataType.Date)]
        public DateTime? ExpectedCompletionDate { get; set; }

        [Display(Name = "Treatment Plan Status")]
        public TreatmentPlanStatus TreatmentPlanStatus { get; set; } = TreatmentPlanStatus.NotStarted;

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
        
        public virtual ICollection<TreatmentAction> TreatmentActions { get; set; } = new List<TreatmentAction>();

        // Computed properties
        [NotMapped]
        public bool IsTreatmentOverdue
        {
            get
            {
                if (!ExpectedCompletionDate.HasValue || 
                    TreatmentPlanStatus == TreatmentPlanStatus.Completed)
                    return false;
                return DateTime.UtcNow.Date > ExpectedCompletionDate.Value.Date;
            }
        }

        [NotMapped]
        public bool IsTreatmentPastSla
        {
            get
            {
                if (!ExpectedCompletionDate.HasValue || !CurrentRiskScore.HasValue)
                    return false;

                // Get SLA based on current risk level
                var slaHours = GetSlaHoursForRiskLevel(CurrentRiskLevel);
                var slaDeadline = CreatedAt.AddHours(slaHours);
                
                return ExpectedCompletionDate.Value > slaDeadline;
            }
        }

        // Methods for risk calculation
        public void CalculateCurrentRisk()
        {
            if (CurrentImpact.HasValue && CurrentLikelihood.HasValue && CurrentExposure.HasValue)
            {
                CurrentRiskScore = (CurrentLikelihood.Value * CurrentImpact.Value) * CurrentExposure.Value;
                CurrentRiskLevel = GetRiskLevelFromScore(CurrentRiskScore.Value);
            }
            else
            {
                CurrentRiskScore = null;
                CurrentRiskLevel = "Unknown";
            }
        }

        public void CalculateResidualRisk()
        {
            if (ResidualImpact.HasValue && ResidualLikelihood.HasValue && ResidualExposure.HasValue)
            {
                ResidualRiskScore = (ResidualLikelihood.Value * ResidualImpact.Value) * ResidualExposure.Value;
                ResidualRiskLevel = GetRiskLevelFromScore(ResidualRiskScore.Value);
            }
            else
            {
                ResidualRiskScore = null;
                ResidualRiskLevel = "Unknown";
            }
        }

        private string GetRiskLevelFromScore(decimal score)
        {
            return score switch
            {
                >= 16 => "Critical",
                >= 10 => "High",
                >= 4 => "Medium",
                _ => "Low"
            };
        }

        private int GetSlaHoursForRiskLevel(string riskLevel)
        {
            return riskLevel?.ToLower() switch
            {
                "critical" => 4,    // 4 hours
                "high" => 24,       // 24 hours
                "medium" => 168,    // 7 days
                "low" => 720,       // 30 days
                _ => 168            // Default 7 days
            };
        }
    }

    public enum TreatmentPlanStatus
    {
        [Display(Name = "Not Started")]
        NotStarted = 0,
        
        [Display(Name = "In Progress")]
        InProgress = 1,
        
        [Display(Name = "On Hold")]
        OnHold = 2,
        
        [Display(Name = "Completed")]
        Completed = 3,
        
        [Display(Name = "Cancelled")]
        Cancelled = 4
    }
}