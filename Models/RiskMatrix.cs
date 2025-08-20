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

        // Validation method
        public bool AreThresholdsValid()
        {
            return QualitativeCriticalThreshold >= QualitativeHighThreshold &&
                   QualitativeHighThreshold >= QualitativeMediumThreshold &&
                   QualitativeMediumThreshold > 0;
        }
    }

    public enum RiskMatrixType
    {
        [Display(Name = "Impact × Likelihood")]
        ImpactLikelihood = 1,

        [Display(Name = "Impact × Likelihood × Exposure")]
        ImpactLikelihoodExposure = 2
    }
}