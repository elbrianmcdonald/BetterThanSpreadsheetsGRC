using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface ISlaHistoryService
    {
        // Historical Data Recording
        Task RecordSlaEventAsync(SlaHistory slaHistory);
        Task RecordFindingCompletionAsync(int findingId, DateTime completedDate);
        Task RecordRiskReviewAsync(int riskId, DateTime reviewDate);
        Task RecordAssessmentCompletionAsync(int assessmentId, string assessmentType, DateTime completedDate);
        
        // Performance Analytics
        Task<SlaPerformanceReport> GetSlaPerformanceReportAsync(DateTime startDate, DateTime endDate);
        Task<IEnumerable<SlaComplianceTrend>> GetSlaComplianceTrendsAsync(DateTime startDate, DateTime endDate, SlaType? slaType = null);
        Task<IEnumerable<SlaPerformanceByRiskLevel>> GetSlaPerformanceByRiskLevelAsync(DateTime startDate, DateTime endDate);
        Task<IEnumerable<SlaPerformanceByTeam>> GetSlaPerformanceByTeamAsync(DateTime startDate, DateTime endDate);
        
        // Breach Analysis
        Task<IEnumerable<SlaBreachAnalysis>> GetTopSlaBreachCausesAsync(DateTime startDate, DateTime endDate);
        Task<SlaBreachSummary> GetSlaBreachSummaryAsync(DateTime startDate, DateTime endDate);
        
        // Historical Query Methods
        Task<IEnumerable<SlaHistory>> GetSlaHistoryAsync(DateTime startDate, DateTime endDate, SlaType? slaType = null);
        Task<SlaHistory?> GetSlaHistoryByItemAsync(string itemType, int itemId);
        
        // Dashboard Data
        Task<SlaDashboardMetrics> GetSlaDashboardMetricsAsync(int daysBack = 30);
    }

    // DTOs for SLA Performance Analytics
    public class SlaPerformanceReport
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public int TotalItems { get; set; }
        public int CompletedItems { get; set; }
        public int BreachedItems { get; set; }
        public decimal OverallComplianceRate { get; set; }
        public TimeSpan AverageCompletionTime { get; set; }
        public Dictionary<SlaType, SlaTypePerformance> PerformanceByType { get; set; } = new();
        public Dictionary<RiskLevel, SlaRiskLevelPerformance> PerformanceByRiskLevel { get; set; } = new();
    }

    public class SlaTypePerformance
    {
        public SlaType SlaType { get; set; }
        public int TotalItems { get; set; }
        public int CompletedItems { get; set; }
        public int BreachedItems { get; set; }
        public decimal ComplianceRate { get; set; }
        public TimeSpan AverageCompletionTime { get; set; }
        public TimeSpan AverageSlaVariance { get; set; }
    }

    public class SlaRiskLevelPerformance
    {
        public RiskLevel RiskLevel { get; set; }
        public int TotalItems { get; set; }
        public int CompletedItems { get; set; }
        public int BreachedItems { get; set; }
        public decimal ComplianceRate { get; set; }
        public TimeSpan AverageCompletionTime { get; set; }
    }

    public class SlaComplianceTrend
    {
        public DateTime Date { get; set; }
        public SlaType SlaType { get; set; }
        public int TotalItems { get; set; }
        public int CompletedItems { get; set; }
        public int BreachedItems { get; set; }
        public decimal ComplianceRate { get; set; }
    }

    public class SlaPerformanceByRiskLevel
    {
        public RiskLevel RiskLevel { get; set; }
        public int TotalItems { get; set; }
        public int CompletedItems { get; set; }
        public int BreachedItems { get; set; }
        public decimal ComplianceRate { get; set; }
        public TimeSpan AverageCompletionTime { get; set; }
    }

    public class SlaPerformanceByTeam
    {
        public string TeamName { get; set; } = string.Empty;
        public string AssignedTo { get; set; } = string.Empty;
        public int TotalItems { get; set; }
        public int CompletedItems { get; set; }
        public int BreachedItems { get; set; }
        public decimal ComplianceRate { get; set; }
        public TimeSpan AverageCompletionTime { get; set; }
    }

    public class SlaBreachAnalysis
    {
        public string BreachCause { get; set; } = string.Empty;
        public SlaType SlaType { get; set; }
        public RiskLevel RiskLevel { get; set; }
        public int BreachCount { get; set; }
        public TimeSpan AverageOverdueTime { get; set; }
        public decimal ImpactPercentage { get; set; }
    }

    public class SlaBreachSummary
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public int TotalBreaches { get; set; }
        public Dictionary<SlaType, int> BreachesByType { get; set; } = new();
        public Dictionary<RiskLevel, int> BreachesByRiskLevel { get; set; } = new();
        public TimeSpan AverageBreachDuration { get; set; }
        public string MostFrequentBreachType { get; set; } = string.Empty;
    }

    public class SlaDashboardMetrics
    {
        public int DaysBack { get; set; }
        public decimal OverallComplianceRate { get; set; }
        public int TotalCompletedItems { get; set; }
        public int TotalBreachedItems { get; set; }
        public TimeSpan AverageCompletionTime { get; set; }
        public Dictionary<SlaType, decimal> ComplianceRateByType { get; set; } = new();
        public List<SlaComplianceTrend> ComplianceTrend { get; set; } = new();
        public List<SlaPerformanceByRiskLevel> PerformanceByRiskLevel { get; set; } = new();
    }
}