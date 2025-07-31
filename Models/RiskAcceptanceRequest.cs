using System.ComponentModel.DataAnnotations;

namespace CyberRiskApp.Models
{
    public class RiskAcceptanceRequest
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Risk description is required")]
        [Display(Name = "What Needs to be Accepted")]
        public string Description { get; set; } = string.Empty;

        [Required(ErrorMessage = "Business need is required")]
        [Display(Name = "Business Need")]
        public string BusinessNeed { get; set; } = string.Empty;

        // REMOVED [Required] attribute since this is set by the controller
        [StringLength(100)]
        public string Requester { get; set; } = string.Empty;

        [Display(Name = "Request Date")]
        [DataType(DataType.Date)]
        public DateTime RequestDate { get; set; }

        [Display(Name = "Review Date")]
        [DataType(DataType.Date)]
        public DateTime? ReviewDate { get; set; }

        [StringLength(100)]
        [Display(Name = "Reviewed By")]
        public string ReviewedBy { get; set; } = string.Empty;

        [StringLength(1000)]
        [Display(Name = "Review Comments")]
        public string ReviewComments { get; set; } = string.Empty;

        // GRC Team Fields (Step 2)
        [StringLength(2000)]
        [Display(Name = "Summary of Risk")]
        public string RiskSummary { get; set; } = string.Empty;

        [StringLength(1000)]
        [Display(Name = "Current Compensating Controls")]
        public string CurrentCompensatingControls { get; set; } = string.Empty;

        [Display(Name = "Risk Level with Current Compensating Controls")]
        public RiskRating? CurrentRiskLevelWithControls { get; set; }

        [StringLength(2000)]
        [Display(Name = "Treatment Plan")]
        public string TreatmentPlan { get; set; } = string.Empty;

        [StringLength(1000)]
        [Display(Name = "Proposed Compensating Controls")]
        public string ProposedCompensatingControls { get; set; } = string.Empty;

        [Display(Name = "Risk Level When All Mitigations Are in Place")]
        public RiskRating? FutureRiskLevelWithMitigations { get; set; }

        [StringLength(2000)]
        [Display(Name = "Recommendation from CISO Office Assessor")]
        public string CISORecommendation { get; set; } = string.Empty;

        public RequestStatus Status { get; set; }

        // Assignment fields
        [Display(Name = "Assigned To")]
        public string? AssignedToUserId { get; set; }

        [Display(Name = "Assigned By")]
        public string? AssignedByUserId { get; set; }

        [Display(Name = "Assignment Date")]
        [DataType(DataType.DateTime)]
        public DateTime? AssignmentDate { get; set; }

        [Display(Name = "Assignment Notes")]
        public string AssignmentNotes { get; set; } = string.Empty;

        // Time tracking fields
        [Display(Name = "Started Date")]
        [DataType(DataType.DateTime)]
        public DateTime? StartedDate { get; set; }

        [Display(Name = "Completed Date")]
        [DataType(DataType.DateTime)]
        public DateTime? CompletedDate { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        // Foreign Keys - optional, can be linked to either Finding OR Risk
        public int? FindingId { get; set; }
        public int? RiskId { get; set; }
        
        // Optional link to a risk assessment that analyzes this risk
        public int? LinkedRiskAssessmentId { get; set; }

        // Navigation properties
        public virtual Finding? LinkedFinding { get; set; }
        public virtual Risk? LinkedRisk { get; set; }
        public virtual RiskAssessment? LinkedRiskAssessment { get; set; }
        public virtual User? AssignedToUser { get; set; }
        public virtual User? AssignedByUser { get; set; }
    }
}