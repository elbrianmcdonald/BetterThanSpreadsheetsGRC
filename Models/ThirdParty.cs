using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class ThirdParty
    {
        public int Id { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Third Party Name")]
        public string Name { get; set; } = string.Empty;

        [StringLength(1000)]
        [Display(Name = "Description")]
        public string? Description { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Organization")]
        public string Organization { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [StringLength(250)]
        [Display(Name = "Representative Email")]
        public string RepresentativeEmail { get; set; } = string.Empty;

        [Required]
        [Display(Name = "TPRA Status")]
        public TPRAStatus TPRAStatus { get; set; }

        [Required]
        [Display(Name = "Risk Level")]
        public RiskLevel RiskLevel { get; set; }

        [Required]
        [Display(Name = "BIA Rating")]
        public BIARating BIARating { get; set; }

        [StringLength(500)]
        [Display(Name = "TPRA Hyperlink")]
        [Url]
        public string? TPRAHyperlink { get; set; }

        // Audit fields
        [Display(Name = "Created At")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Display(Name = "Updated At")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [StringLength(100)]
        [Display(Name = "Created By")]
        public string? CreatedBy { get; set; }

        [StringLength(100)]
        [Display(Name = "Updated By")]
        public string? UpdatedBy { get; set; }
    }

    public enum TPRAStatus
    {
        [Display(Name = "Not Started")]
        NotStarted = 0,
        
        [Display(Name = "In Progress")]
        InProgress = 1,
        
        [Display(Name = "Under Review")]
        UnderReview = 2,
        
        [Display(Name = "Completed")]
        Completed = 3,
        
        [Display(Name = "Expired")]
        Expired = 4,
        
        [Display(Name = "Exempted")]
        Exempted = 5
    }

    public enum BIARating
    {
        [Display(Name = "Critical")]
        Critical = 4,
        
        [Display(Name = "High")]
        High = 3,
        
        [Display(Name = "Medium")]
        Medium = 2,
        
        [Display(Name = "Low")]
        Low = 1,
        
        [Display(Name = "Very Low")]
        VeryLow = 0
    }
}