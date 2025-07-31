using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class RiskAssessment
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

        [Required]
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

        // NEW: Assessment Type field
        [Required]
        [Display(Name = "Assessment Type")]
        public AssessmentType AssessmentType { get; set; } = AssessmentType.FAIR;

        // ADDED: Optional link to a Finding
        [Display(Name = "Related Finding")]
        public int? FindingId { get; set; }

        // ===== FAIR Analysis properties (for quantitative assessments) =====

        // FAIR Analysis properties - Threat
        [Display(Name = "Threat Community")]
        public string ThreatCommunity { get; set; } = string.Empty;

        [Display(Name = "Threat Action")]
        public string ThreatAction { get; set; } = string.Empty;

        [Display(Name = "Threat Event Frequency (Most Likely)")]
        [Column(TypeName = "decimal(18,6)")]
        public decimal ThreatEventFrequency { get; set; }

        [Display(Name = "Threat Event Frequency (Minimum)")]
        [Column(TypeName = "decimal(18,6)")]
        public decimal ThreatEventFrequencyMin { get; set; }

        [Display(Name = "Threat Event Frequency (Maximum)")]
        [Column(TypeName = "decimal(18,6)")]
        public decimal ThreatEventFrequencyMax { get; set; }

        [Display(Name = "TEF Confidence Level (%)")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal ThreatEventFrequencyConfidence { get; set; } = 90;

        [Display(Name = "Contact Frequency (%)")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal ContactFrequency { get; set; }

        [Display(Name = "Action Success (%)")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal ActionSuccess { get; set; }

        // Loss Event Frequency (calculated)
        [Display(Name = "Loss Event Frequency")]
        [Column(TypeName = "decimal(18,6)")]
        public decimal? LossEventFrequency { get; set; }

        // Loss Magnitude - Primary Loss Categories
        [Display(Name = "Productivity Loss - Minimum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ProductivityLossMin { get; set; }

        [Display(Name = "Productivity Loss - Most Likely")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ProductivityLossMostLikely { get; set; }

        [Display(Name = "Productivity Loss - Maximum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ProductivityLossMax { get; set; }

        [Display(Name = "Response Costs - Minimum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ResponseCostsMin { get; set; }

        [Display(Name = "Response Costs - Most Likely")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ResponseCostsMostLikely { get; set; }

        [Display(Name = "Response Costs - Maximum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ResponseCostsMax { get; set; }

        [Display(Name = "Replacement Cost - Minimum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ReplacementCostMin { get; set; }

        [Display(Name = "Replacement Cost - Most Likely")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ReplacementCostMostLikely { get; set; }

        [Display(Name = "Replacement Cost - Maximum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ReplacementCostMax { get; set; }

        [Display(Name = "Fines/Penalties - Minimum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal FinesMin { get; set; }

        [Display(Name = "Fines/Penalties - Most Likely")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal FinesMostLikely { get; set; }

        [Display(Name = "Fines/Penalties - Maximum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal FinesMax { get; set; }

        // Calculated Loss Magnitude
        [Display(Name = "Primary Loss Magnitude")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? PrimaryLossMagnitude { get; set; }

        // Secondary Loss Analysis Toggle
        [Display(Name = "Include Secondary Loss Analysis")]
        public bool IncludeSecondaryLoss { get; set; } = false;

        // Secondary Loss Categories
        [Display(Name = "Secondary Response Cost - Minimum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal SecondaryResponseCostMin { get; set; }

        [Display(Name = "Secondary Response Cost - Most Likely")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal SecondaryResponseCostMostLikely { get; set; }

        [Display(Name = "Secondary Response Cost - Maximum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal SecondaryResponseCostMax { get; set; }

        [Display(Name = "Secondary Productivity Loss - Minimum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal SecondaryProductivityLossMin { get; set; }

        [Display(Name = "Secondary Productivity Loss - Most Likely")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal SecondaryProductivityLossMostLikely { get; set; }

        [Display(Name = "Secondary Productivity Loss - Maximum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal SecondaryProductivityLossMax { get; set; }

        [Display(Name = "Reputation Damage - Minimum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ReputationDamageMin { get; set; }

        [Display(Name = "Reputation Damage - Most Likely")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ReputationDamageMostLikely { get; set; }

        [Display(Name = "Reputation Damage - Maximum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ReputationDamageMax { get; set; }

        [Display(Name = "Competitive Advantage Loss - Minimum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal CompetitiveAdvantageLossMin { get; set; }

        [Display(Name = "Competitive Advantage Loss - Most Likely")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal CompetitiveAdvantageLossMostLikely { get; set; }

        [Display(Name = "Competitive Advantage Loss - Maximum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal CompetitiveAdvantageLossMax { get; set; }

        [Display(Name = "External Stakeholder Loss - Minimum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ExternalStakeholderLossMin { get; set; }

        [Display(Name = "External Stakeholder Loss - Most Likely")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ExternalStakeholderLossMostLikely { get; set; }

        [Display(Name = "External Stakeholder Loss - Maximum")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal ExternalStakeholderLossMax { get; set; }

        // Secondary Loss Event Frequency and Magnitude
        [Display(Name = "Secondary Loss Event Frequency")]
        [Column(TypeName = "decimal(18,6)")]
        public decimal? SecondaryLossEventFrequency { get; set; }

        [Display(Name = "Secondary Loss Magnitude")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? SecondaryLossMagnitude { get; set; }

        // FAIR Final Result
        [Display(Name = "Annual Loss Expectancy")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? AnnualLossExpectancy { get; set; }

        // Monte Carlo Simulation Results
        [Display(Name = "Simulation Iterations")]
        public int SimulationIterations { get; set; } = 10000;

        [Display(Name = "ALE 10th Percentile")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? ALE_10th { get; set; }

        [Display(Name = "ALE 50th Percentile (Median)")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? ALE_50th { get; set; }

        [Display(Name = "ALE 90th Percentile")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? ALE_90th { get; set; }

        [Display(Name = "ALE 95th Percentile")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? ALE_95th { get; set; }

        [Display(Name = "Primary Loss 10th Percentile")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? PrimaryLoss_10th { get; set; }

        [Display(Name = "Primary Loss 50th Percentile")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? PrimaryLoss_50th { get; set; }

        [Display(Name = "Primary Loss 90th Percentile")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? PrimaryLoss_90th { get; set; }

        [Display(Name = "Primary Loss 95th Percentile")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal? PrimaryLoss_95th { get; set; }

        // Distribution Settings
        [Display(Name = "Use PERT Distribution")]
        public bool UsePerDistribution { get; set; } = true;

        [Display(Name = "Distribution Type")]
        [StringLength(20)]
        public string DistributionType { get; set; } = "PERT";

        [Display(Name = "Loss Magnitude Confidence (%)")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal LossMagnitudeConfidence { get; set; } = 90;

        // Defense in Depth Vulnerability
        [Display(Name = "Calculated Vulnerability")]
        [Column(TypeName = "decimal(5,4)")]
        public decimal? CalculatedVulnerability { get; set; }

        // Cybersecurity Insurance Deduction
        [Display(Name = "Deduct Cybersecurity Insurance")]
        public bool DeductCybersecurityInsurance { get; set; } = false;

        // ===== Qualitative Analysis properties (for qualitative assessments) =====

        [Display(Name = "Likelihood Level")]
        public LikelihoodLevel? QualitativeLikelihood { get; set; }

        [Display(Name = "Impact Level")]
        public ImpactLevel? QualitativeImpact { get; set; }

        [Display(Name = "Exposure Level")]
        public ExposureLevel? QualitativeExposure { get; set; }

        // Calculated Qualitative Risk Score
        [Display(Name = "Risk Score")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal? QualitativeRiskScore { get; set; }

        // Common metadata fields
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        // ADDED: Navigation property for the linked finding
        [ForeignKey("FindingId")]
        public virtual Finding? LinkedFinding { get; set; }

        // Navigation property for the risk matrix
        [ForeignKey("RiskMatrixId")]
        public virtual RiskMatrix? RiskMatrix { get; set; }

        // Collection for risks that might be created from this assessment
        public virtual ICollection<Risk> IdentifiedRisks { get; set; } = new List<Risk>();

        // Collection for control effectiveness (Defense in Depth) - FAIR assessments
        public virtual ICollection<RiskAssessmentControl> Controls { get; set; } = new List<RiskAssessmentControl>();

        // Collection for qualitative controls (no effectiveness calculation)
        public virtual ICollection<QualitativeControl> QualitativeControls { get; set; } = new List<QualitativeControl>();

        // Method to calculate risk level from ALE or qualitative score
        public string CalculateRiskLevel()
        {
            if (AssessmentType == AssessmentType.FAIR && AnnualLossExpectancy.HasValue)
            {
                return AnnualLossExpectancy.Value switch
                {
                    >= 100000 => "Critical",
                    >= 50000 => "High",
                    >= 10000 => "Medium",
                    _ => "Low"
                };
            }
            else if (AssessmentType == AssessmentType.Qualitative && QualitativeRiskScore.HasValue)
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
    }
}