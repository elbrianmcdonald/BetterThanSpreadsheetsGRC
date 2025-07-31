using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("RiskMatrixLevels")]
    public class RiskMatrixLevel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int RiskMatrixId { get; set; }

        [Required]
        [Display(Name = "Level Type")]
        public RiskMatrixLevelType LevelType { get; set; }

        [Required]
        [Display(Name = "Level Value")]
        public int LevelValue { get; set; } // 1, 2, 3, 4, 5

        [Required]
        [StringLength(50)]
        [Display(Name = "Level Name")]
        public string LevelName { get; set; } = string.Empty;

        [StringLength(200)]
        [Display(Name = "Description")]
        public string? Description { get; set; }

        [StringLength(20)]
        [Display(Name = "Color Code")]
        public string? ColorCode { get; set; } // Hex color for UI display

        [Column(TypeName = "decimal(5,2)")]
        [Display(Name = "Multiplier")]
        public decimal? Multiplier { get; set; } // For exposure calculations

        // Navigation property
        [ForeignKey("RiskMatrixId")]
        public virtual RiskMatrix RiskMatrix { get; set; } = null!;
    }

    public enum RiskMatrixLevelType
    {
        [Display(Name = "Impact")]
        Impact = 1,

        [Display(Name = "Likelihood")]
        Likelihood = 2,

        [Display(Name = "Exposure")]
        Exposure = 3
    }
}