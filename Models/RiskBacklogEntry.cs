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

        // Finding-related fields (for finding workflow entries)
        [Display(Name = "Finding ID")]
        public int? FindingId { get; set; }

        [ForeignKey("FindingId")]
        public virtual Finding? Finding { get; set; }

        // Finding-specific fields (used when ActionType is NewFinding, FindingReview, or FindingClosure)
        [StringLength(200)]
        [Display(Name = "Finding Title")]
        public string? FindingTitle { get; set; }

        [StringLength(2000)]
        [Display(Name = "Finding Details")]
        public string? FindingDetails { get; set; }

        [StringLength(100)]
        [Display(Name = "Finding Source")]
        public string? FindingSource { get; set; } // e.g., "Security Assessment", "Audit", "Penetration Test"

        [Display(Name = "Impact Level")]
        public ImpactLevel? Impact { get; set; }

        [Display(Name = "Likelihood Level")]
        public LikelihoodLevel? Likelihood { get; set; }

        [Display(Name = "Exposure Level")]
        public ExposureLevel? Exposure { get; set; }

        [Display(Name = "Risk Rating")]
        public RiskRating? RiskRating { get; set; }

        [StringLength(100)]
        [Display(Name = "Asset")]
        public string? Asset { get; set; }

        [StringLength(100)]
        [Display(Name = "Business Unit")]
        public string? BusinessUnit { get; set; }

        [StringLength(100)]
        [Display(Name = "Business Owner")]
        public string? BusinessOwner { get; set; }

        [StringLength(100)]
        [Display(Name = "Domain")]
        public string? Domain { get; set; }

        [StringLength(100)]
        [Display(Name = "Technical Control")]
        public string? TechnicalControl { get; set; }

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

        // Helper methods
        public bool IsFindingWorkflow()
        {
            return ActionType == RiskBacklogAction.NewFinding || 
                   ActionType == RiskBacklogAction.FindingReview || 
                   ActionType == RiskBacklogAction.FindingClosure;
        }

        public bool IsRiskWorkflow()
        {
            return ActionType == RiskBacklogAction.NewRisk || 
                   ActionType == RiskBacklogAction.RiskAcceptance || 
                   ActionType == RiskBacklogAction.RiskExtension || 
                   ActionType == RiskBacklogAction.RiskReview || 
                   ActionType == RiskBacklogAction.RiskReassessment ||
                   ActionType == RiskBacklogAction.RiskClosure;
        }

        public string GetTitle()
        {
            return IsFindingWorkflow() ? (FindingTitle ?? "Unnamed Finding") 
                                      : (Risk?.Title ?? "Unnamed Risk");
        }

        public string GetDescription()
        {
            return IsFindingWorkflow() ? (FindingDetails ?? RequestDescription) 
                                      : (Risk?.Description ?? RequestDescription);
        }

        public RiskRating? GetRiskRating()
        {
            return IsFindingWorkflow() ? RiskRating 
                                      : Risk?.RiskLevel switch
                                      {
                                          RiskLevel.Low => Models.RiskRating.Low,
                                          RiskLevel.Medium => Models.RiskRating.Medium,
                                          RiskLevel.High => Models.RiskRating.High,
                                          RiskLevel.Critical => Models.RiskRating.Critical,
                                          _ => null
                                      };
        }

        public RiskRating CalculateFindingRiskRating()
        {
            if (!IsFindingWorkflow() || !Impact.HasValue || !Likelihood.HasValue || !Exposure.HasValue)
                return Models.RiskRating.Low;

            // Convert enum values to integers for calculation
            int impactScore = (int)Impact.Value;
            int likelihoodScore = (int)Likelihood.Value;
            int exposureScore = (int)Exposure.Value;

            // Calculate average score
            double averageScore = (impactScore + likelihoodScore + exposureScore) / 3.0;

            // Map average score to risk rating
            return averageScore switch
            {
                >= 4.0 => Models.RiskRating.Critical,
                >= 3.0 => Models.RiskRating.High,
                >= 2.0 => Models.RiskRating.Medium,
                _ => Models.RiskRating.Low
            };
        }

        public string GetCurrentAssignee()
        {
            return Status switch
            {
                RiskBacklogStatus.AssignedToAnalyst => AssignedToAnalyst ?? "Unassigned",
                RiskBacklogStatus.AssignedToManager => AssignedToManager ?? "Unassigned",
                _ => "Unassigned"
            };
        }

        public bool IsOverdue()
        {
            return DueDate.HasValue && DueDate.Value < DateTime.UtcNow && Status != RiskBacklogStatus.Approved && Status != RiskBacklogStatus.Rejected;
        }

        // New display helper methods for enhanced UI
        public string GetTypeIcon()
        {
            return IsFindingWorkflow() ? "🔍" : "⚠️";
        }

        public string GetTypeBadgeClass()
        {
            return IsFindingWorkflow() ? "badge-finding" : "badge-risk";
        }

        public string GetRowClass()
        {
            return IsFindingWorkflow() ? "backlog-finding-row" : "backlog-risk-row";
        }

        public string GetTypeDisplayName()
        {
            return ActionType switch
            {
                RiskBacklogAction.NewFinding => "📋 New Finding Review",
                RiskBacklogAction.FindingReview => "🔍 Finding Review",
                RiskBacklogAction.FindingClosure => "✅ Finding Closure",
                RiskBacklogAction.NewRisk => "⚠️ New Risk Assessment",
                RiskBacklogAction.RiskAcceptance => "✅ Risk Acceptance",
                RiskBacklogAction.RiskExtension => "⏱️ Risk Extension",
                RiskBacklogAction.RiskReview => "🔄 Risk Review",
                RiskBacklogAction.RiskReassessment => "📊 Risk Reassessment",
                RiskBacklogAction.RiskClosure => "🔒 Risk Closure",
                _ => ActionType.ToString()
            };
        }

        public string GetSourceDescription()
        {
            if (IsFindingWorkflow())
            {
                return FindingSource switch
                {
                    "Manual Creation" => "Manual Entry",
                    "Excel Upload" => "Bulk Upload",
                    _ => FindingSource ?? "Unknown"
                };
            }
            else
            {
                // For risks, determine source based on context or action type
                return ActionType switch
                {
                    RiskBacklogAction.NewRisk => "Risk Assessment",
                    RiskBacklogAction.RiskReassessment => "Risk Review",
                    RiskBacklogAction.RiskAcceptance => "Risk Acceptance",
                    RiskBacklogAction.RiskExtension => "Risk Extension",
                    RiskBacklogAction.RiskReview => "Periodic Review",
                    _ => "Manual Entry"
                };
            }
        }

        public string GetStatusDisplayName()
        {
            if (IsFindingWorkflow())
            {
                return Status switch
                {
                    RiskBacklogStatus.Unassigned => "Pending Review",
                    RiskBacklogStatus.AssignedToAnalyst => "Under Analysis",
                    RiskBacklogStatus.AssignedToManager => "Manager Review",
                    RiskBacklogStatus.Approved => "Approved for Register",
                    RiskBacklogStatus.Rejected => "Rejected",
                    RiskBacklogStatus.Escalated => "Escalated",
                    _ => Status.ToString()
                };
            }
            else
            {
                return Status switch
                {
                    RiskBacklogStatus.Unassigned => "Pending Review",
                    RiskBacklogStatus.AssignedToAnalyst => "Under Assessment",
                    RiskBacklogStatus.AssignedToManager => "Manager Review", 
                    RiskBacklogStatus.Approved => "Approved for Register",
                    RiskBacklogStatus.Rejected => "Rejected",
                    RiskBacklogStatus.Escalated => "Escalated",
                    _ => Status.ToString()
                };
            }
        }

        public string GetPriorityIcon()
        {
            return Priority switch
            {
                BacklogPriority.Critical => "🔴",
                BacklogPriority.High => "🟠", 
                BacklogPriority.Medium => "🟡",
                BacklogPriority.Low => "🟢",
                _ => "⚪"
            };
        }

        public string GetRiskRatingBadgeClass()
        {
            var rating = GetRiskRating();
            return rating switch
            {
                Models.RiskRating.Critical => "badge badge-danger",
                Models.RiskRating.High => "badge badge-warning",
                Models.RiskRating.Medium => "badge badge-info",
                Models.RiskRating.Low => "badge badge-success",
                _ => "badge badge-secondary"
            };
        }

        // SLA Tracking and Escalation Methods
        public int GetDaysOld()
        {
            return (DateTime.UtcNow - CreatedAt).Days;
        }

        public int? GetDaysUntilDue()
        {
            if (!DueDate.HasValue) return null;
            return (DueDate.Value - DateTime.UtcNow).Days;
        }

        public int GetDaysOverdue()
        {
            if (!DueDate.HasValue || DueDate.Value >= DateTime.UtcNow) return 0;
            return (DateTime.UtcNow - DueDate.Value).Days;
        }

        public string GetSLAStatus()
        {
            if (!DueDate.HasValue) return "No SLA";
            
            var daysUntilDue = GetDaysUntilDue();
            var daysOverdue = GetDaysOverdue();

            if (daysOverdue > 0) return "Overdue";
            if (daysUntilDue <= 1) return "Due Soon";
            if (daysUntilDue <= 3) return "Approaching";
            return "On Track";
        }

        public string GetSLAStatusBadgeClass()
        {
            return GetSLAStatus() switch
            {
                "Overdue" => "badge badge-danger",
                "Due Soon" => "badge badge-warning", 
                "Approaching" => "badge badge-info",
                "On Track" => "badge badge-success",
                "No SLA" => "badge badge-secondary",
                _ => "badge badge-secondary"
            };
        }

        public string GetSLAIcon()
        {
            return GetSLAStatus() switch
            {
                "Overdue" => "🔴",
                "Due Soon" => "🟠",
                "Approaching" => "🟡", 
                "On Track" => "🟢",
                "No SLA" => "⚪",
                _ => "⚪"
            };
        }

        public bool RequiresEscalation()
        {
            var daysOverdue = GetDaysOverdue();
            var daysOld = GetDaysOld();

            // Escalation rules based on priority and age
            return Priority switch
            {
                BacklogPriority.Critical => daysOverdue >= 1 || daysOld >= 3,
                BacklogPriority.High => daysOverdue >= 2 || daysOld >= 7,
                BacklogPriority.Medium => daysOverdue >= 5 || daysOld >= 14,
                BacklogPriority.Low => daysOverdue >= 10 || daysOld >= 30,
                _ => daysOverdue >= 7 || daysOld >= 21
            };
        }

        public string GetEscalationReason()
        {
            if (!RequiresEscalation()) return "";

            var daysOverdue = GetDaysOverdue();
            var daysOld = GetDaysOld();

            if (daysOverdue > 0)
                return $"SLA breached - {daysOverdue} days overdue";
            
            return $"Long pending - {daysOld} days old";
        }

        public string GetAgingDisplayText()
        {
            var daysOld = GetDaysOld();
            if (!DueDate.HasValue)
                return $"{daysOld} days old";

            var daysOverdue = GetDaysOverdue();
            var daysUntilDue = GetDaysUntilDue();

            if (daysOverdue > 0)
                return $"{daysOverdue} days overdue";
            else if (daysUntilDue.HasValue)
                return $"{daysUntilDue} days remaining";
            
            return $"{daysOld} days old";
        }

        public int GetSLAPriorityScore()
        {
            // Higher score = higher priority for sorting
            var baseScore = Priority switch
            {
                BacklogPriority.Critical => 1000,
                BacklogPriority.High => 800,
                BacklogPriority.Medium => 600,
                BacklogPriority.Low => 400,
                _ => 200
            };

            var slaScore = GetSLAStatus() switch
            {
                "Overdue" => 500,
                "Due Soon" => 300,
                "Approaching" => 200,
                "On Track" => 100,
                _ => 50
            };

            var ageScore = Math.Min(GetDaysOld() * 5, 200); // Cap age contribution

            return baseScore + slaScore + ageScore;
        }
    }
}