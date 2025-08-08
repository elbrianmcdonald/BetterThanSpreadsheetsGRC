using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class RiskAssessment : IAuditableEntity
    {
        public int Id { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Assessment Title")]
        public string Title { get; set; } = string.Empty;

        [Required]
        [StringLength(200)]
        [Display(Name = "Primary Asset")]
        public string Asset { get; set; } = string.Empty;

        // ADDED: Business Unit field
        [StringLength(100)]
        [Display(Name = "Business Unit")]
        public string BusinessUnit { get; set; } = string.Empty;

        // Business Owner field
        [StringLength(100)]
        [Display(Name = "Business Owner")]
        public string BusinessOwner { get; set; } = string.Empty;

        // NEW: Technical Controls in Place field
        [Display(Name = "Technical Controls in Place")]
        public string TechnicalControlsInPlace { get; set; } = string.Empty;

        [Display(Name = "Description")]
        public string Description { get; set; } = string.Empty;

        [Display(Name = "Threat Scenario")]
        public string ThreatScenario { get; set; } = string.Empty;

        [Display(Name = "CIA Triad Impact")]
        public CIATriad? CIATriad { get; set; }

        [Display(Name = "Risk Matrix")]
        public int? RiskMatrixId { get; set; }

        [Display(Name = "Assessment Status")]
        public AssessmentStatus Status { get; set; }

        [Display(Name = "Date Completed")]
        [DataType(DataType.Date)]
        public DateTime? DateCompleted { get; set; }

        [Display(Name = "Assessor")]
        public string Assessor { get; set; } = string.Empty;

        // Assessment Type field - only qualitative assessments supported
        [Required]
        [Display(Name = "Assessment Type")]
        public AssessmentType AssessmentType { get; set; } = AssessmentType.Qualitative;

        // ADDED: Optional link to a Finding
        [Display(Name = "Related Finding")]
        public int? FindingId { get; set; }






        // ===== Qualitative Analysis properties (for qualitative assessments) =====

        [Display(Name = "Likelihood Level")]
        public LikelihoodLevel? QualitativeLikelihood { get; set; }

        [Display(Name = "Impact Level")]
        public ImpactLevel? QualitativeImpact { get; set; }

        [Display(Name = "Exposure Level")]
        [Column(TypeName = "decimal(3,2)")]
        public decimal? QualitativeExposure { get; set; }

        // Calculated Qualitative Risk Score
        [Display(Name = "Risk Score")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal? QualitativeRiskScore { get; set; }

        // Audit and Concurrency Control Fields
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        
        [Required]
        [StringLength(100)]
        [Display(Name = "Created By")]
        [ScaffoldColumn(false)] // Hide from forms
        public string CreatedBy { get; set; } = string.Empty;
        
        [Required]
        [StringLength(100)]
        [Display(Name = "Updated By")]
        [ScaffoldColumn(false)] // Hide from forms
        public string UpdatedBy { get; set; } = string.Empty;
        
        [Timestamp]
        public byte[] RowVersion { get; set; } = Array.Empty<byte>();

        // ADDED: Navigation property for the linked finding
        [ForeignKey("FindingId")]
        public virtual Finding? LinkedFinding { get; set; }

        // Navigation property for the risk matrix
        [ForeignKey("RiskMatrixId")]
        public virtual RiskMatrix? RiskMatrix { get; set; }

        // Collection for risks that might be created from this assessment
        public virtual ICollection<Risk> IdentifiedRisks { get; set; } = new List<Risk>();

        // Collection for qualitative controls (no effectiveness calculation)
        public virtual ICollection<QualitativeControl> QualitativeControls { get; set; } = new List<QualitativeControl>();

        // Collection for threat models linked to this risk assessment
        public virtual ICollection<ThreatModel> LinkedThreatModels { get; set; } = new List<ThreatModel>();

        // Collection for assessment-specific threat model copies
        public virtual ICollection<RiskAssessmentThreatModel> ThreatModels { get; set; } = new List<RiskAssessmentThreatModel>();

        // Collection for threat scenarios (new scenario-based qualitative approach)
        public virtual ICollection<ThreatScenario> ThreatScenarios { get; set; } = new List<ThreatScenario>();

        // Method to calculate risk level from qualitative score
        public string CalculateRiskLevel()
        {
            // Check if we have threat scenarios (new approach)
            if (ThreatScenarios?.Any() == true)
            {
                // Calculate overall risk as the highest scenario risk
                var scenarioRiskScores = ThreatScenarios
                    .Where(ts => ts.QualitativeRiskScore.HasValue)
                    .Select(ts => ts.QualitativeRiskScore!.Value)
                    .ToList();
                
                if (scenarioRiskScores.Any())
                {
                    var maxRiskScore = scenarioRiskScores.Max();
                    return maxRiskScore switch
                    {
                        >= 16 => "Critical",
                        >= 10 => "High",
                        >= 4 => "Medium",
                        _ => "Low"
                    };
                }
            }
            // Fallback to legacy assessment-level qualitative score
            else if (QualitativeRiskScore.HasValue)
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

        // Method to calculate overall qualitative risk score from all threat scenarios
        public decimal? CalculateOverallQualitativeRiskScore()
        {
            if (ThreatScenarios?.Any() == true)
            {
                var scenarioRiskScores = ThreatScenarios
                    .Where(ts => ts.QualitativeRiskScore.HasValue)
                    .Select(ts => ts.QualitativeRiskScore!.Value)
                    .ToList();
                
                if (scenarioRiskScores.Any())
                {
                    // Return the average risk score across all scenarios
                    return scenarioRiskScores.Average();
                }
            }

            // Fallback to legacy assessment-level score
            return QualitativeRiskScore;
        }
    }
}