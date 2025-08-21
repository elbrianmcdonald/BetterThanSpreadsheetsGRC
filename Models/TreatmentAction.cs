using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("TreatmentActions")]
    public class TreatmentAction : IAuditableEntity
    {
        public int Id { get; set; }

        [Required]
        public int ScenarioRiskId { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Action Description")]
        public string ActionDescription { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        [Display(Name = "Assigned To")]
        public string AssignedTo { get; set; } = string.Empty;

        [StringLength(100)]
        [Display(Name = "Assigned Team/Department")]
        public string AssignedTeam { get; set; } = string.Empty;

        [Display(Name = "Expected Completion Date")]
        [DataType(DataType.Date)]
        public DateTime? ExpectedCompletionDate { get; set; }

        [Display(Name = "Actual Completion Date")]
        [DataType(DataType.Date)]
        public DateTime? ActualCompletionDate { get; set; }

        [Display(Name = "Action Status")]
        public TreatmentActionStatus Status { get; set; } = TreatmentActionStatus.NotStarted;

        [Display(Name = "Priority Level")]
        public TreatmentActionPriority Priority { get; set; } = TreatmentActionPriority.Medium;

        [Display(Name = "Progress Notes")]
        public string ProgressNotes { get; set; } = string.Empty;

        [Display(Name = "Estimated Effort (Hours)")]
        public int? EstimatedEffortHours { get; set; }

        [Display(Name = "Actual Effort (Hours)")]
        public int? ActualEffortHours { get; set; }

        // Audit and Concurrency Control Fields
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

        // Navigation properties
        [ForeignKey("ScenarioRiskId")]
        public virtual ScenarioRisk ScenarioRisk { get; set; } = null!;

        // Computed properties
        [NotMapped]
        public bool IsOverdue
        {
            get
            {
                if (!ExpectedCompletionDate.HasValue || 
                    Status == TreatmentActionStatus.Completed || 
                    Status == TreatmentActionStatus.Cancelled)
                    return false;
                return DateTime.UtcNow.Date > ExpectedCompletionDate.Value.Date;
            }
        }

        [NotMapped]
        public int DaysUntilDue
        {
            get
            {
                if (!ExpectedCompletionDate.HasValue)
                    return int.MaxValue;
                return (ExpectedCompletionDate.Value.Date - DateTime.UtcNow.Date).Days;
            }
        }

        [NotMapped]
        public string StatusBadgeClass
        {
            get
            {
                return Status switch
                {
                    TreatmentActionStatus.NotStarted => "bg-secondary",
                    TreatmentActionStatus.InProgress => "bg-primary",
                    TreatmentActionStatus.OnHold => "bg-warning",
                    TreatmentActionStatus.Blocked => "bg-danger",
                    TreatmentActionStatus.Completed => "bg-success",
                    TreatmentActionStatus.Cancelled => "bg-dark",
                    _ => "bg-secondary"
                };
            }
        }

        [NotMapped]
        public string PriorityBadgeClass
        {
            get
            {
                return Priority switch
                {
                    TreatmentActionPriority.Critical => "bg-danger",
                    TreatmentActionPriority.High => "bg-warning",
                    TreatmentActionPriority.Medium => "bg-info",
                    TreatmentActionPriority.Low => "bg-secondary",
                    _ => "bg-info"
                };
            }
        }
    }

    public enum TreatmentActionStatus
    {
        [Display(Name = "Not Started")]
        NotStarted = 0,
        
        [Display(Name = "In Progress")]
        InProgress = 1,
        
        [Display(Name = "On Hold")]
        OnHold = 2,
        
        [Display(Name = "Blocked")]
        Blocked = 3,
        
        [Display(Name = "Completed")]
        Completed = 4,
        
        [Display(Name = "Cancelled")]
        Cancelled = 5
    }

    public enum TreatmentActionPriority
    {
        [Display(Name = "Low")]
        Low = 0,
        
        [Display(Name = "Medium")]
        Medium = 1,
        
        [Display(Name = "High")]
        High = 2,
        
        [Display(Name = "Critical")]
        Critical = 3
    }
}