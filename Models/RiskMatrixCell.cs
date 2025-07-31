using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("RiskMatrixCells")]
    public class RiskMatrixCell
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int RiskMatrixId { get; set; }

        [Required]
        [Display(Name = "Impact Level")]
        public int ImpactLevel { get; set; }

        [Required]
        [Display(Name = "Likelihood Level")]
        public int LikelihoodLevel { get; set; }

        [Display(Name = "Exposure Level")]
        public int? ExposureLevel { get; set; } // Null for 2D matrices

        [Required]
        [Display(Name = "Risk Level")]
        public RiskLevel ResultingRiskLevel { get; set; }

        [StringLength(20)]
        [Display(Name = "Cell Color")]
        public string? CellColor { get; set; } // Hex color for the cell

        [Column(TypeName = "decimal(10,2)")]
        [Display(Name = "Risk Score")]
        public decimal RiskScore { get; set; } // Calculated score

        // Navigation property
        [ForeignKey("RiskMatrixId")]
        public virtual RiskMatrix RiskMatrix { get; set; } = null!;
    }
}