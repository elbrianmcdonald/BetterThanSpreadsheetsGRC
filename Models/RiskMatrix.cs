using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("RiskMatrices")]
    public class RiskMatrix
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        [Display(Name = "Matrix Name")]
        public string Name { get; set; } = string.Empty;

        [StringLength(500)]
        [Display(Name = "Description")]
        public string? Description { get; set; }

        [Required]
        [Display(Name = "Matrix Size")]
        public int MatrixSize { get; set; } // 3, 4, or 5

        [Required]
        [Display(Name = "Matrix Type")]
        public RiskMatrixType MatrixType { get; set; }

        [Display(Name = "Is Default")]
        public bool IsDefault { get; set; }

        [Display(Name = "Is Active")]
        public bool IsActive { get; set; } = true;

        [Display(Name = "Created By")]
        [StringLength(100)]
        public string CreatedBy { get; set; } = string.Empty;

        [Display(Name = "Created At")]
        public DateTime CreatedAt { get; set; }

        [Display(Name = "Updated At")]
        public DateTime UpdatedAt { get; set; }

        // Risk Level Thresholds (for qualitative assessments)
        [Display(Name = "Medium Risk Threshold")]
        [Range(0, 100, ErrorMessage = "Must be between 0 and 100")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal QualitativeMediumThreshold { get; set; } = 4.0m;

        [Display(Name = "High Risk Threshold")]
        [Range(0, 100, ErrorMessage = "Must be between 0 and 100")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal QualitativeHighThreshold { get; set; } = 10.0m;

        [Display(Name = "Critical Risk Threshold")]
        [Range(0, 100, ErrorMessage = "Must be between 0 and 100")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal QualitativeCriticalThreshold { get; set; } = 16.0m;

        [Display(Name = "Risk Appetite Threshold")]
        [Range(0, 100, ErrorMessage = "Must be between 0 and 100")]
        [Column(TypeName = "decimal(5,2)")]
        public decimal RiskAppetiteThreshold { get; set; } = 6.0m;

        // REMEDIATION SLAs (in hours) - tied to risk levels for addressing findings
        [Display(Name = "Critical Risk Remediation SLA (Hours)")]
        [Range(1, 8760, ErrorMessage = "Must be between 1 and 8760 hours (1 year)")]
        public int CriticalRiskSlaHours { get; set; } = 4; // 4 hours for Critical

        [Display(Name = "High Risk Remediation SLA (Hours)")]
        [Range(1, 8760, ErrorMessage = "Must be between 1 and 8760 hours (1 year)")]
        public int HighRiskSlaHours { get; set; } = 24; // 24 hours for High

        [Display(Name = "Medium Risk Remediation SLA (Hours)")]
        [Range(1, 8760, ErrorMessage = "Must be between 1 and 8760 hours (1 year)")]
        public int MediumRiskSlaHours { get; set; } = 168; // 7 days for Medium

        [Display(Name = "Low Risk Remediation SLA (Hours)")]
        [Range(1, 8760, ErrorMessage = "Must be between 1 and 8760 hours (1 year)")]
        public int LowRiskSlaHours { get; set; } = 720; // 30 days for Low

        // RISK ACCEPTANCE REVIEW SLAs (in hours) - how often accepted risks need reassessment
        [Display(Name = "Critical Risk Review SLA (Hours)")]
        [Range(1, 8760, ErrorMessage = "Must be between 1 and 8760 hours (1 year)")]
        public int CriticalRiskReviewSlaHours { get; set; } = 720; // 30 days for Critical

        [Display(Name = "High Risk Review SLA (Hours)")]
        [Range(1, 8760, ErrorMessage = "Must be between 1 and 8760 hours (1 year)")]
        public int HighRiskReviewSlaHours { get; set; } = 2160; // 90 days for High

        [Display(Name = "Medium Risk Review SLA (Hours)")]
        [Range(1, 8760, ErrorMessage = "Must be between 1 and 8760 hours (1 year)")]
        public int MediumRiskReviewSlaHours { get; set; } = 4380; // 6 months for Medium

        [Display(Name = "Low Risk Review SLA (Hours)")]
        [Range(1, 8760, ErrorMessage = "Must be between 1 and 8760 hours (1 year)")]
        public int LowRiskReviewSlaHours { get; set; } = 8760; // 12 months for Low

        // RISK ASSESSMENT SLAs (in hours) - time limits for completing assessments
        [Display(Name = "Risk Assessment Completion SLA (Hours)")]
        [Range(1, 8760, ErrorMessage = "Must be between 1 and 8760 hours (1 year)")]
        public int RiskAssessmentSlaHours { get; set; } = 168; // 7 days to complete assessment

        [Display(Name = "Compliance Assessment Completion SLA (Hours)")]
        [Range(1, 8760, ErrorMessage = "Must be between 1 and 8760 hours (1 year)")]
        public int ComplianceAssessmentSlaHours { get; set; } = 336; // 14 days to complete compliance assessment

        [Display(Name = "Maturity Assessment Completion SLA (Hours)")]
        [Range(1, 8760, ErrorMessage = "Must be between 1 and 8760 hours (1 year)")]
        public int MaturityAssessmentSlaHours { get; set; } = 504; // 21 days to complete maturity assessment

        // APPROVAL PROCESS SLAs (in hours) - time limits for approval workflows
        [Display(Name = "Assessment Approval SLA (Hours)")]
        [Range(1, 8760, ErrorMessage = "Must be between 1 and 8760 hours (1 year)")]
        public int AssessmentApprovalSlaHours { get; set; } = 72; // 3 days for assessment approval

        [Display(Name = "Risk Acceptance Approval SLA (Hours)")]
        [Range(1, 8760, ErrorMessage = "Must be between 1 and 8760 hours (1 year)")]
        public int RiskAcceptanceApprovalSlaHours { get; set; } = 120; // 5 days for risk acceptance approval

        [Display(Name = "Exception Request Approval SLA (Hours)")]
        [Range(1, 8760, ErrorMessage = "Must be between 1 and 8760 hours (1 year)")]
        public int ExceptionRequestApprovalSlaHours { get; set; } = 168; // 7 days for exception request approval

        // Navigation properties
        public virtual ICollection<RiskMatrixLevel> Levels { get; set; } = new List<RiskMatrixLevel>();
        public virtual ICollection<RiskMatrixCell> MatrixCells { get; set; } = new List<RiskMatrixCell>();

        // Helper methods for risk level calculation
        public RiskLevel GetRiskLevel(decimal score)
        {
            if (score >= QualitativeCriticalThreshold) return RiskLevel.Critical;
            if (score >= QualitativeHighThreshold) return RiskLevel.High;
            if (score >= QualitativeMediumThreshold) return RiskLevel.Medium;
            return RiskLevel.Low;
        }

        public bool IsWithinRiskAppetite(decimal score)
        {
            return score <= RiskAppetiteThreshold;
        }

        public string GetRiskAppetiteStatus(decimal score)
        {
            return IsWithinRiskAppetite(score) ? "Within Appetite" : "Above Appetite";
        }

        // Get threshold ranges as strings for display
        public string GetCriticalRange() => QualitativeCriticalThreshold.ToString("F1");
        public string GetHighRange() => $"{QualitativeHighThreshold:F1} - {QualitativeCriticalThreshold - 0.1m:F1}";
        public string GetMediumRange() => $"{QualitativeMediumThreshold:F1} - {QualitativeHighThreshold - 0.1m:F1}";
        public string GetLowRange() => $"0.0 - {QualitativeMediumThreshold - 0.1m:F1}";

        // REMEDIATION SLA Helper Methods
        public int GetRemediationSlaHoursForRiskLevel(RiskLevel riskLevel)
        {
            return riskLevel switch
            {
                RiskLevel.Critical => CriticalRiskSlaHours,
                RiskLevel.High => HighRiskSlaHours,
                RiskLevel.Medium => MediumRiskSlaHours,
                RiskLevel.Low => LowRiskSlaHours,
                _ => LowRiskSlaHours
            };
        }

        public int GetRemediationSlaHoursForScore(decimal score)
        {
            var riskLevel = GetRiskLevel(score);
            return GetRemediationSlaHoursForRiskLevel(riskLevel);
        }

        // RISK ACCEPTANCE REVIEW SLA Helper Methods
        public int GetReviewSlaHoursForRiskLevel(RiskLevel riskLevel)
        {
            return riskLevel switch
            {
                RiskLevel.Critical => CriticalRiskReviewSlaHours,
                RiskLevel.High => HighRiskReviewSlaHours,
                RiskLevel.Medium => MediumRiskReviewSlaHours,
                RiskLevel.Low => LowRiskReviewSlaHours,
                _ => LowRiskReviewSlaHours
            };
        }

        public int GetReviewSlaHoursForScore(decimal score)
        {
            var riskLevel = GetRiskLevel(score);
            return GetReviewSlaHoursForRiskLevel(riskLevel);
        }

        // ASSESSMENT SLA Helper Methods
        public int GetAssessmentSlaHours(SlaAssessmentType assessmentType)
        {
            return assessmentType switch
            {
                SlaAssessmentType.Risk => RiskAssessmentSlaHours,
                SlaAssessmentType.Compliance => ComplianceAssessmentSlaHours,
                SlaAssessmentType.Maturity => MaturityAssessmentSlaHours,
                _ => RiskAssessmentSlaHours
            };
        }

        // APPROVAL PROCESS SLA Helper Methods
        public int GetApprovalSlaHours(SlaApprovalType approvalType)
        {
            return approvalType switch
            {
                SlaApprovalType.AssessmentApproval => AssessmentApprovalSlaHours,
                SlaApprovalType.RiskAcceptanceApproval => RiskAcceptanceApprovalSlaHours,
                SlaApprovalType.FindingClosureApproval => ExceptionRequestApprovalSlaHours,
                _ => AssessmentApprovalSlaHours
            };
        }

        // GENERIC SLA CALCULATION METHODS
        public DateTime CalculateSlaDeadline(DateTime fromDate, SlaType slaType, RiskLevel? riskLevel = null, SlaAssessmentType? assessmentType = null, SlaApprovalType? approvalType = null)
        {
            int slaHours = slaType switch
            {
                SlaType.Remediation => riskLevel.HasValue ? GetRemediationSlaHoursForRiskLevel(riskLevel.Value) : LowRiskSlaHours,
                SlaType.Review => riskLevel.HasValue ? GetReviewSlaHoursForRiskLevel(riskLevel.Value) : LowRiskReviewSlaHours,
                SlaType.Assessment => assessmentType.HasValue ? GetAssessmentSlaHours(assessmentType.Value) : RiskAssessmentSlaHours,
                SlaType.Approval => approvalType.HasValue ? GetApprovalSlaHours(approvalType.Value) : AssessmentApprovalSlaHours,
                _ => 168 // Default to 7 days
            };
            
            return fromDate.AddHours(slaHours);
        }

        public string GetSlaDisplayText(SlaType slaType, RiskLevel? riskLevel = null, SlaAssessmentType? assessmentType = null, SlaApprovalType? approvalType = null)
        {
            int hours = slaType switch
            {
                SlaType.Remediation => riskLevel.HasValue ? GetRemediationSlaHoursForRiskLevel(riskLevel.Value) : LowRiskSlaHours,
                SlaType.Review => riskLevel.HasValue ? GetReviewSlaHoursForRiskLevel(riskLevel.Value) : LowRiskReviewSlaHours,
                SlaType.Assessment => assessmentType.HasValue ? GetAssessmentSlaHours(assessmentType.Value) : RiskAssessmentSlaHours,
                SlaType.Approval => approvalType.HasValue ? GetApprovalSlaHours(approvalType.Value) : AssessmentApprovalSlaHours,
                _ => 168
            };
            
            return FormatSlaHours(hours);
        }

        public bool IsSlaBreached(DateTime createdDate, SlaType slaType, DateTime? resolvedDate = null, RiskLevel? riskLevel = null, SlaAssessmentType? assessmentType = null, SlaApprovalType? approvalType = null)
        {
            var deadline = CalculateSlaDeadline(createdDate, slaType, riskLevel, assessmentType, approvalType);
            var checkDate = resolvedDate ?? DateTime.UtcNow;
            return checkDate > deadline;
        }

        private string FormatSlaHours(int hours)
        {
            return hours switch
            {
                < 24 => $"{hours} hours",
                < 168 => $"{hours / 24} days",
                < 720 => $"{hours / 168} weeks",
                _ => $"{Math.Round(hours / 720.0, 1)} months"
            };
        }

        // LEGACY METHODS (for backward compatibility)
        [Obsolete("Use GetRemediationSlaHoursForRiskLevel instead")]
        public int GetSlaHoursForRiskLevel(RiskLevel riskLevel) => GetRemediationSlaHoursForRiskLevel(riskLevel);

        [Obsolete("Use GetRemediationSlaHoursForScore instead")]
        public int GetSlaHoursForScore(decimal score) => GetRemediationSlaHoursForScore(score);

        [Obsolete("Use CalculateSlaDeadline with SlaType.Remediation instead")]
        public DateTime CalculateSlaDeadline(DateTime fromDate, RiskLevel riskLevel) => CalculateSlaDeadline(fromDate, SlaType.Remediation, riskLevel);

        [Obsolete("Use CalculateSlaDeadline with SlaType.Remediation instead")]
        public DateTime CalculateSlaDeadline(DateTime fromDate, decimal score)
        {
            var riskLevel = GetRiskLevel(score);
            return CalculateSlaDeadline(fromDate, SlaType.Remediation, riskLevel);
        }

        [Obsolete("Use GetSlaDisplayText with SlaType.Remediation instead")]
        public string GetSlaDisplayText(RiskLevel riskLevel) => GetSlaDisplayText(SlaType.Remediation, riskLevel);

        [Obsolete("Use IsSlaBreached with SlaType.Remediation instead")]
        public bool IsSlaBreached(DateTime createdDate, RiskLevel riskLevel, DateTime? resolvedDate = null) => IsSlaBreached(createdDate, SlaType.Remediation, resolvedDate, riskLevel);

        // Validation method
        public bool AreThresholdsValid()
        {
            return QualitativeCriticalThreshold >= QualitativeHighThreshold &&
                   QualitativeHighThreshold >= QualitativeMediumThreshold &&
                   QualitativeMediumThreshold > 0;
        }

        public bool AreRemediationSlaHoursValid()
        {
            return CriticalRiskSlaHours > 0 && CriticalRiskSlaHours <= HighRiskSlaHours &&
                   HighRiskSlaHours <= MediumRiskSlaHours &&
                   MediumRiskSlaHours <= LowRiskSlaHours;
        }

        public bool AreReviewSlaHoursValid()
        {
            return CriticalRiskReviewSlaHours > 0 && CriticalRiskReviewSlaHours <= HighRiskReviewSlaHours &&
                   HighRiskReviewSlaHours <= MediumRiskReviewSlaHours &&
                   MediumRiskReviewSlaHours <= LowRiskReviewSlaHours;
        }

        public bool AreAssessmentSlaHoursValid()
        {
            return RiskAssessmentSlaHours > 0 && ComplianceAssessmentSlaHours > 0 && MaturityAssessmentSlaHours > 0;
        }

        public bool AreApprovalSlaHoursValid()
        {
            return AssessmentApprovalSlaHours > 0 && RiskAcceptanceApprovalSlaHours > 0 && ExceptionRequestApprovalSlaHours > 0;
        }

        public bool AreAllSlaHoursValid()
        {
            return AreRemediationSlaHoursValid() && AreReviewSlaHoursValid() && 
                   AreAssessmentSlaHoursValid() && AreApprovalSlaHoursValid();
        }

        // Legacy method for backward compatibility
        [Obsolete("Use AreRemediationSlaHoursValid instead")]
        public bool AreSlaHoursValid() => AreRemediationSlaHoursValid();
    }

    public enum RiskMatrixType
    {
        [Display(Name = "Impact × Likelihood")]
        ImpactLikelihood = 1,

        [Display(Name = "Impact × Likelihood × Exposure")]
        ImpactLikelihoodExposure = 2
    }

}