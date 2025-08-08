using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class RiskLevelSettings
    {
        public int Id { get; set; }

        [Display(Name = "Settings Name")]
        [StringLength(100)]
        public string Name { get; set; } = "Default Risk Level Thresholds";

        [Display(Name = "Description")]
        [StringLength(500)]
        public string Description { get; set; } = "Default risk level threshold configuration";

        // FAIR Assessment Thresholds (for ALE values)
        [Display(Name = "FAIR Critical Threshold")]
        [Range(0, double.MaxValue, ErrorMessage = "Must be a positive number")]
        public decimal FairCriticalThreshold { get; set; } = 1000000; // $1M+

        [Display(Name = "FAIR High Threshold")]
        [Range(0, double.MaxValue, ErrorMessage = "Must be a positive number")]
        public decimal FairHighThreshold { get; set; } = 100000; // $100K+

        [Display(Name = "FAIR Medium Threshold")]
        [Range(0, double.MaxValue, ErrorMessage = "Must be a positive number")]
        public decimal FairMediumThreshold { get; set; } = 10000; // $10K+

        // Qualitative Assessment Thresholds (for risk scores)
        [Display(Name = "Qualitative Critical Threshold")]
        [Range(0, 16, ErrorMessage = "Must be between 0 and 16")]
        public decimal QualitativeCriticalThreshold { get; set; } = 16; // Exactly 16

        [Display(Name = "Qualitative High Threshold")]
        [Range(0, 16, ErrorMessage = "Must be between 0 and 16")]
        public decimal QualitativeHighThreshold { get; set; } = 10; // 10.0+

        [Display(Name = "Qualitative Medium Threshold")]
        [Range(0, 16, ErrorMessage = "Must be between 0 and 16")]
        public decimal QualitativeMediumThreshold { get; set; } = 4; // 4.0+

        // Risk Appetite Thresholds (defines what's acceptable)
        [Display(Name = "Qualitative Risk Appetite Threshold")]
        [Range(0, 16, ErrorMessage = "Must be between 0 and 16")]
        public decimal RiskAppetiteThreshold { get; set; } = 6; // Qualitative risks above this level are above appetite

        [Display(Name = "FAIR Risk Appetite Threshold")]
        [Range(0, double.MaxValue, ErrorMessage = "Must be a positive number")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal FairRiskAppetiteThreshold { get; set; } = 50000; // FAIR ALE above this amount is above appetite

        // Cybersecurity Insurance Settings (for FAIR assessments)
        [Display(Name = "Cybersecurity Insurance Amount (Legacy)")]
        [Range(0, double.MaxValue, ErrorMessage = "Must be a positive number")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal CybersecurityInsuranceAmount { get; set; } = 0; // Amount to deduct from ALE when insurance is applied

        [Display(Name = "Insurance Coverage Limit")]
        [Range(0, double.MaxValue, ErrorMessage = "Must be a positive number")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal InsuranceCoverageLimit { get; set; } = 1000000; // $1M default coverage limit

        [Display(Name = "Insurance Deductible")]
        [Range(0, double.MaxValue, ErrorMessage = "Must be a positive number")]
        [Column(TypeName = "decimal(18,2)")]
        public decimal InsuranceDeductible { get; set; } = 25000; // $25K default deductible

        [Display(Name = "Insurance Coverage Percentage")]
        [Range(0, 100, ErrorMessage = "Must be between 0 and 100")]
        public decimal InsuranceCoveragePercentage { get; set; } = 80; // 80% default coverage

        [Display(Name = "Insurance Enabled by Default")]
        public bool InsuranceEnabledByDefault { get; set; } = false; // Whether insurance is enabled by default in threat models

        // Metadata
        [Display(Name = "Is Active")]
        public bool IsActive { get; set; } = true;

        [Display(Name = "Created By")]
        public string CreatedBy { get; set; } = string.Empty;

        [Display(Name = "Created Date")]
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        [Display(Name = "Last Modified By")]
        public string LastModifiedBy { get; set; } = string.Empty;

        [Display(Name = "Last Modified Date")]
        public DateTime LastModifiedDate { get; set; } = DateTime.UtcNow;

        // Helper method to get risk level for FAIR assessments
        public string GetFairRiskLevel(decimal ale)
        {
            if (ale >= FairCriticalThreshold) return "Critical";
            if (ale >= FairHighThreshold) return "High";
            if (ale >= FairMediumThreshold) return "Medium";
            return "Low";
        }

        // Helper method to get risk level for Qualitative assessments
        public string GetQualitativeRiskLevel(decimal riskScore)
        {
            // Handle exact match for critical (usually 16)
            if (riskScore >= QualitativeCriticalThreshold) return "Critical";
            if (riskScore >= QualitativeHighThreshold) return "High";
            if (riskScore >= QualitativeMediumThreshold) return "Medium";
            return "Low";
        }

        // Helper method to check if FAIR assessment is within risk appetite
        public bool IsFairWithinRiskAppetite(decimal ale)
        {
            return ale <= FairRiskAppetiteThreshold;
        }

        // Helper method to check if Qualitative assessment is within risk appetite
        public bool IsQualitativeWithinRiskAppetite(decimal riskScore)
        {
            return riskScore <= RiskAppetiteThreshold;
        }

        // Helper method to get risk appetite status for FAIR assessments
        public string GetFairRiskAppetiteStatus(decimal ale)
        {
            return IsFairWithinRiskAppetite(ale) ? "Within Appetite" : "Above Appetite";
        }

        // Helper method to get risk appetite status for Qualitative assessments
        public string GetQualitativeRiskAppetiteStatus(decimal riskScore)
        {
            return IsQualitativeWithinRiskAppetite(riskScore) ? "Within Appetite" : "Above Appetite";
        }

        // Validation method
        public bool IsValid()
        {
            // Ensure thresholds are in logical order (descending)
            return FairCriticalThreshold >= FairHighThreshold &&
                   FairHighThreshold >= FairMediumThreshold &&
                   QualitativeCriticalThreshold >= QualitativeHighThreshold &&
                   QualitativeHighThreshold >= QualitativeMediumThreshold;
        }

        // Get threshold ranges as strings for display
        public string GetFairCriticalRange() => $"${FairCriticalThreshold:N0}+";
        public string GetFairHighRange() => $"${FairHighThreshold:N0} - ${FairCriticalThreshold - 1:N0}";
        public string GetFairMediumRange() => $"${FairMediumThreshold:N0} - ${FairHighThreshold - 1:N0}";
        public string GetFairLowRange() => $"$0 - ${FairMediumThreshold - 1:N0}";

        public string GetQualitativeCriticalRange() => QualitativeCriticalThreshold.ToString("F1");
        public string GetQualitativeHighRange() => $"{QualitativeHighThreshold:F1} - {QualitativeCriticalThreshold - 0.1m:F1}";
        public string GetQualitativeMediumRange() => $"{QualitativeMediumThreshold:F1} - {QualitativeHighThreshold - 0.1m:F1}";
        public string GetQualitativeLowRange() => $"0.0 - {QualitativeMediumThreshold - 0.1m:F1}";
    }
}