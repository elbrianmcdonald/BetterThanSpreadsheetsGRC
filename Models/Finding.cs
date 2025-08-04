using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class Finding : IAuditableEntity
    {
        public int Id { get; set; }

        [NotMapped]
        public bool IsOverdue
        {
            get
            {
                // If already closed, not overdue
                if (Status == FindingStatus.Closed)
                    return false;

                // Check if past SLA date
                if (SlaDate.HasValue && DateTime.Today > SlaDate.Value)
                    return true;

                return false;
            }
        }

        [Display(Name = "Finding Number")]
        public string FindingNumber { get; set; } = string.Empty;

        [Required(ErrorMessage = "Title is required")]
        [StringLength(200, ErrorMessage = "Title cannot exceed 200 characters")]
        public string Title { get; set; } = string.Empty;

        [Required(ErrorMessage = "Details are required")]
        [StringLength(2000, ErrorMessage = "Details cannot exceed 2000 characters")]
        public string Details { get; set; } = string.Empty;

        [Required]
        public ImpactLevel Impact { get; set; } = ImpactLevel.Low;

        [Required]
        public LikelihoodLevel Likelihood { get; set; } = LikelihoodLevel.Unlikely;

        [Required]
        public ExposureLevel Exposure { get; set; } = ExposureLevel.SlightlyExposed;

        [Display(Name = "Risk Rating")]
        public RiskRating RiskRating { get; set; } = RiskRating.Low;

        public FindingStatus Status { get; set; } = FindingStatus.Open;

        [Required(ErrorMessage = "Owner is required")]
        [StringLength(100)]
        public string Owner { get; set; } = string.Empty;

        [StringLength(100)]
        public string Domain { get; set; } = string.Empty;

        [StringLength(100)]
        [Display(Name = "Business Unit")]
        public string BusinessUnit { get; set; } = string.Empty;

        [StringLength(100)]
        [Display(Name = "Business Owner")]
        public string BusinessOwner { get; set; } = string.Empty;

        [Display(Name = "Open Date")]
        [DataType(DataType.Date)]
        public DateTime OpenDate { get; set; }

        [Display(Name = "SLA Date")]
        [DataType(DataType.Date)]
        public DateTime? SlaDate { get; set; }

        [StringLength(100)]
        public string Asset { get; set; } = string.Empty;

        [StringLength(100)]
        [Display(Name = "Technical Control")]
        public string TechnicalControl { get; set; } = string.Empty;

        [StringLength(100)]
        [Display(Name = "Assigned To")]
        public string AssignedTo { get; set; } = string.Empty;

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

        // Navigation properties for relationships
        public virtual ICollection<Risk> RelatedRisks { get; set; } = new List<Risk>();
        public virtual ICollection<RiskAcceptanceRequest> AcceptanceRequests { get; set; } = new List<RiskAcceptanceRequest>();

        // Method to calculate risk rating based on impact, likelihood, and exposure
        public RiskRating CalculateRiskRating()
        {
            // Convert enum values to integers for calculation
            int impactScore = (int)Impact;
            int likelihoodScore = (int)Likelihood;
            int exposureScore = (int)Exposure;

            // Calculate average score
            double averageScore = (impactScore + likelihoodScore + exposureScore) / 3.0;

            // Map average score to risk rating
            return averageScore switch
            {
                >= 4.0 => RiskRating.Critical,
                >= 3.0 => RiskRating.High,
                >= 2.0 => RiskRating.Medium,
                _ => RiskRating.Low
            };
        }
    }
}