using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class AssessmentRequest
    {
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        [Display(Name = "Requester Name")]
        public string RequesterName { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string Department { get; set; } = string.Empty;

        [EmailAddress]
        [Display(Name = "Contact Email")]
        public string ContactEmail { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Assessment Scope")]
        public string Scope { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Business Justification")]
        public string Justification { get; set; } = string.Empty;

        [Required]
        public Priority Priority { get; set; }

        [Display(Name = "Requested Timeline")]
        [DataType(DataType.Date)]
        public DateTime? RequestedTimeline { get; set; }

        [Display(Name = "Request Date")]
        [DataType(DataType.Date)]
        public DateTime RequestDate { get; set; }

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

        [Display(Name = "Estimated Hours")]
        public decimal? EstimatedHours { get; set; }

        [Display(Name = "Actual Hours")]
        public decimal? ActualHours { get; set; }

        // Legacy fields
        [Display(Name = "Assigned To (Legacy)")]
        public string AssignedTo { get; set; } = string.Empty;

        public string Notes { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        // Navigation Properties
        [ForeignKey("AssignedToUserId")]
        public virtual User? AssignedToUser { get; set; }

        [ForeignKey("AssignedByUserId")]
        public virtual User? AssignedByUser { get; set; }

        // ADD THIS COMPUTED PROPERTY:
        [NotMapped]
        public bool IsOverdue
        {
            get
            {
                // If already completed, not overdue
                if (Status == RequestStatus.Completed)
                    return false;

                // Check if past requested timeline
                if (RequestedTimeline.HasValue && DateTime.Today > RequestedTimeline.Value)
                    return true;

                // If no specific timeline, use SLA (e.g., 30 days from request date)
                var slaDate = RequestDate.AddDays(30);
                return DateTime.Today > slaDate;
            }
        }
    }
}