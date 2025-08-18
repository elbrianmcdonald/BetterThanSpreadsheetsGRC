using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("RiskBacklogEntries")]
    public class RiskBacklogEntry : IAuditableEntity
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(50)]
        [Display(Name = "Backlog Number")]
        public string BacklogNumber { get; set; } = string.Empty; // AUTO-GENERATED: RBL-YYYY-XXXXX

        // Risk Reference
        [Display(Name = "Risk ID")]
        public int? RiskId { get; set; }

        [ForeignKey("RiskId")]
        public virtual Risk? Risk { get; set; }

        // Backlog Metadata
        [Required]
        [Display(Name = "Action Type")]
        public RiskBacklogAction ActionType { get; set; }

        [Required]
        [Display(Name = "Status")]
        public RiskBacklogStatus Status { get; set; } = RiskBacklogStatus.Unassigned;

        [Required]
        [Display(Name = "Priority")]
        public BacklogPriority Priority { get; set; } = BacklogPriority.Medium;

        // Assignment
        [StringLength(100)]
        [Display(Name = "Assigned to Analyst")]
        public string? AssignedToAnalyst { get; set; }

        [StringLength(100)]
        [Display(Name = "Assigned to Manager")]
        public string? AssignedToManager { get; set; }

        [Display(Name = "Assigned Date")]
        public DateTime? AssignedDate { get; set; }

        // Request Details
        [Required]
        [Display(Name = "Request Description")]
        public string RequestDescription { get; set; } = string.Empty;

        [Display(Name = "Request Justification")]
        public string RequestJustification { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        [Display(Name = "Requester")]
        public string RequesterUserId { get; set; } = string.Empty;

        // SLA Tracking
        [Display(Name = "Due Date")]
        public DateTime? DueDate { get; set; }

        [Display(Name = "Completed Date")]
        public DateTime? CompletedDate { get; set; }

        [Display(Name = "SLA Breached")]
        public bool IsSLABreached { get; set; } = false;

        // Decision & Comments
        [Display(Name = "Analyst Comments")]
        public string AnalystComments { get; set; } = string.Empty;

        [Display(Name = "Manager Comments")]
        public string ManagerComments { get; set; } = string.Empty;

        [Display(Name = "Rejection Reason")]
        public string RejectionReason { get; set; } = string.Empty;

        // Risk Source for tracking
        [Display(Name = "Risk Source")]
        public RiskSource? RiskSource { get; set; }

        // Audit Trail
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        [Required]
        [StringLength(100)]
        [Display(Name = "Created By")]
        public string CreatedBy { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        [Display(Name = "Updated By")]
        public string UpdatedBy { get; set; } = string.Empty;

        [Timestamp]
        public byte[]? RowVersion { get; set; }

        // Navigation Properties
        public virtual ICollection<RiskBacklogComment> Comments { get; set; } = new List<RiskBacklogComment>();
        public virtual ICollection<RiskBacklogActivity> Activities { get; set; } = new List<RiskBacklogActivity>();

        // Helper method to get current assignee
        public string GetCurrentAssignee()
        {
            return Status switch
            {
                RiskBacklogStatus.AssignedToAnalyst => AssignedToAnalyst ?? "Unassigned",
                RiskBacklogStatus.AssignedToManager => AssignedToManager ?? "Unassigned",
                _ => "Unassigned"
            };
        }

        // Helper method to check if overdue
        public bool IsOverdue()
        {
            return DueDate.HasValue && DueDate.Value < DateTime.UtcNow && Status != RiskBacklogStatus.Approved && Status != RiskBacklogStatus.Rejected;
        }
    }
}