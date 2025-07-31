using System.ComponentModel.DataAnnotations;

namespace CyberRiskApp.Models
{
    public class FindingClosureRequest
    {
        public int Id { get; set; }

        [Required]
        [Display(Name = "Linked Finding")]
        public int FindingId { get; set; }

        [StringLength(100)]
        public string Requester { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Closure Justification")]
        [StringLength(2000)]
        public string ClosureJustification { get; set; } = string.Empty;

        [Display(Name = "Evidence Links")]
        [StringLength(2000)]
        public string EvidenceLinks { get; set; } = string.Empty;

        [Display(Name = "Additional Notes")]
        [StringLength(1000)]
        public string AdditionalNotes { get; set; } = string.Empty;

        [Display(Name = "Request Date")]
        [DataType(DataType.Date)]
        public DateTime RequestDate { get; set; }

        [Display(Name = "Requested Closure Date")]
        [DataType(DataType.Date)]
        public DateTime? RequestedClosureDate { get; set; }

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

        [Display(Name = "Reviewed By")]
        [StringLength(100)]
        public string ReviewedBy { get; set; } = string.Empty;

        [Display(Name = "Review Date")]
        [DataType(DataType.Date)]
        public DateTime? ReviewDate { get; set; }

        [Display(Name = "Review Comments")]
        [StringLength(1000)]
        public string ReviewComments { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        // Navigation properties
        public virtual Finding? LinkedFinding { get; set; }
        public virtual User? AssignedToUser { get; set; }
        public virtual User? AssignedByUser { get; set; }
    }
}