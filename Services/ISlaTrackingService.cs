using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface ISlaTrackingService
    {
        // SLA Status Checking
        Task<SlaStatus> GetRemediationSlaStatusAsync(int findingId);
        Task<SlaStatus> GetReviewSlaStatusAsync(int riskId);
        Task<SlaStatus> GetAssessmentSlaStatusAsync(int assessmentId, SlaAssessmentType assessmentType);
        Task<SlaStatus> GetApprovalSlaStatusAsync(int requestId, SlaApprovalType approvalType);

        // SLA Breach Detection
        Task<IEnumerable<SlaBreachInfo>> GetRemediationSlaBreachesAsync();
        Task<IEnumerable<SlaBreachInfo>> GetReviewSlaBreachesAsync();
        Task<IEnumerable<SlaBreachInfo>> GetAssessmentSlaBreachesAsync();
        Task<IEnumerable<SlaBreachInfo>> GetApprovalSlaBreachesAsync();

        // SLA Dashboard Data
        Task<SlaDashboardData> GetSlaDashboardDataAsync();
        Task<IEnumerable<SlaUpcomingDeadline>> GetUpcomingSlaDeadlinesAsync(int dayLookAhead = 7);
        
        // SLA Performance Metrics
        Task<SlaPerformanceMetrics> GetSlaPerformanceMetricsAsync(DateTime startDate, DateTime endDate);
        Task<IEnumerable<SlaComplianceReport>> GetSlaComplianceReportAsync(DateTime startDate, DateTime endDate);

        // SLA Notification Support
        Task<IEnumerable<SlaNotification>> GetPendingSlaNotificationsAsync();
        Task MarkSlaNotificationSentAsync(int notificationId);
        Task CreateSlaNotificationAsync(SlaNotification notification);
    }

    // Data Transfer Objects for SLA Tracking
    public class SlaStatus
    {
        public int ItemId { get; set; }
        public SlaType SlaType { get; set; }
        public string ItemDescription { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public DateTime SlaDeadline { get; set; }
        public DateTime? CompletedDate { get; set; }
        public int SlaHours { get; set; }
        public bool IsBreached { get; set; }
        public bool IsCompleted { get; set; }
        public TimeSpan? TimeRemaining { get; set; }
        public TimeSpan? OverdueBy { get; set; }
        public RiskLevel? RiskLevel { get; set; }
        public string Status { get; set; } = string.Empty;
        public string StatusColor { get; set; } = string.Empty;
    }

    public class SlaBreachInfo
    {
        public int ItemId { get; set; }
        public SlaType SlaType { get; set; }
        public string ItemType { get; set; } = string.Empty;
        public string ItemDescription { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public DateTime SlaDeadline { get; set; }
        public TimeSpan OverdueBy { get; set; }
        public RiskLevel? RiskLevel { get; set; }
        public string AssignedTo { get; set; } = string.Empty;
        public string AssignedToEmail { get; set; } = string.Empty;
        public int DaysOverdue => (int)OverdueBy.TotalDays;
    }

    public class SlaDashboardData
    {
        public int TotalRemediationBreaches { get; set; }
        public int TotalReviewBreaches { get; set; }
        public int TotalAssessmentBreaches { get; set; }
        public int TotalApprovalBreaches { get; set; }
        public int TotalActiveItems { get; set; }
        public decimal OverallCompliancePercentage { get; set; }
        public List<SlaBreachByCategory> BreachSummaryByType { get; set; } = new();
        public List<SlaBreachByCategory> BreachSummaryByRiskLevel { get; set; } = new();
    }

    public class SlaBreachByCategory
    {
        public string Category { get; set; } = string.Empty;
        public int BreachCount { get; set; }
        public int TotalCount { get; set; }
        public decimal CompliancePercentage { get; set; }
    }

    public class SlaUpcomingDeadline
    {
        public int ItemId { get; set; }
        public SlaType SlaType { get; set; }
        public string ItemType { get; set; } = string.Empty;
        public string ItemDescription { get; set; } = string.Empty;
        public DateTime SlaDeadline { get; set; }
        public TimeSpan TimeUntilDeadline { get; set; }
        public RiskLevel? RiskLevel { get; set; }
        public string AssignedTo { get; set; } = string.Empty;
        public string AssignedToEmail { get; set; } = string.Empty;
        public int DaysUntilDue => (int)TimeUntilDeadline.TotalDays;
        public int HoursUntilDue => (int)TimeUntilDeadline.TotalHours;
        public string UrgencyLevel => DaysUntilDue switch
        {
            <= 0 => "Critical",
            <= 1 => "High",
            <= 3 => "Medium",
            _ => "Low"
        };
    }

    public class SlaPerformanceMetrics
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal OverallComplianceRate { get; set; }
        public Dictionary<SlaType, decimal> ComplianceRateByType { get; set; } = new();
        public Dictionary<RiskLevel, decimal> ComplianceRateByRiskLevel { get; set; } = new();
        public int TotalItemsTracked { get; set; }
        public int TotalBreaches { get; set; }
        public TimeSpan AverageResolutionTime { get; set; }
        public List<SlaPerformanceTrend> PerformanceTrends { get; set; } = new();
    }

    public class SlaPerformanceTrend
    {
        public DateTime Date { get; set; }
        public SlaType SlaType { get; set; }
        public decimal ComplianceRate { get; set; }
        public int ItemCount { get; set; }
    }

    public class SlaComplianceReport
    {
        public string Category { get; set; } = string.Empty;
        public int TotalItems { get; set; }
        public int ComplianceItems { get; set; }
        public int BreachedItems { get; set; }
        public decimal CompliancePercentage { get; set; }
        public TimeSpan AverageCompletionTime { get; set; }
        public List<string> TopBreachers { get; set; } = new();
    }

    public class SlaNotification
    {
        public int Id { get; set; }
        public int ItemId { get; set; }
        public SlaType SlaType { get; set; }
        public string ItemType { get; set; } = string.Empty;
        public string ItemDescription { get; set; } = string.Empty;
        public NotificationType NotificationType { get; set; }
        public DateTime ScheduledDate { get; set; }
        public DateTime? SentDate { get; set; }
        public string RecipientEmail { get; set; } = string.Empty;
        public string RecipientName { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public bool IsSent => SentDate.HasValue;
        public DateTime CreatedAt { get; set; }
    }

    public enum NotificationType
    {
        UpcomingDeadline = 1,
        SlaBreached = 2,
        EscalationAlert = 3,
        WeeklyDigest = 4
    }
}