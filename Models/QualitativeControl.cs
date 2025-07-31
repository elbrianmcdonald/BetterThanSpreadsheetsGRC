using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class QualitativeControl
    {
        public int Id { get; set; }

        [Required]
        public int RiskAssessmentId { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Control Name")]
        public string ControlName { get; set; } = string.Empty;

        [Required]
        [StringLength(50)]
        [Display(Name = "Control Type")]
        public string ControlType { get; set; } = "Preventive"; // Preventive, Detective, Responsive

        [Display(Name = "Control Description")]
        public string? ControlDescription { get; set; }

        [Required]
        [StringLength(50)]
        [Display(Name = "Implementation Status")]
        public string ImplementationStatus { get; set; } = "Implemented"; // Implemented, Planned, Not Implemented

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        // Navigation property - nullable to avoid validation issues during model binding
        [ForeignKey("RiskAssessmentId")]
        public virtual RiskAssessment? RiskAssessment { get; set; }
    }
}