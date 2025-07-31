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

        // Navigation properties
        public virtual ICollection<RiskMatrixLevel> Levels { get; set; } = new List<RiskMatrixLevel>();
        public virtual ICollection<RiskMatrixCell> MatrixCells { get; set; } = new List<RiskMatrixCell>();
    }

    public enum RiskMatrixType
    {
        [Display(Name = "Impact × Likelihood")]
        ImpactLikelihood = 1,

        [Display(Name = "Impact × Likelihood × Exposure")]
        ImpactLikelihoodExposure = 2
    }
}