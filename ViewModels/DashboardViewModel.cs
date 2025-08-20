using CyberRiskApp.Models;
using CyberRiskApp.Services;

namespace CyberRiskApp.ViewModels
{
    public class CustomizableDashboardViewModel
    {
        public List<DashboardWidget> Widgets { get; set; } = new List<DashboardWidget>();
        public List<DashboardWidget> SelectedWidgets { get; set; } = new List<DashboardWidget>();
        public List<DashboardWidgetInfo> AvailableWidgets { get; set; } = new List<DashboardWidgetInfo>();
        public DashboardSummary Summary { get; set; } = new DashboardSummary();
        public DashboardData Data { get; set; } = new DashboardData();
    }

    public class DashboardWidget
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public DashboardWidgetType Type { get; set; }
        public int Position { get; set; }
        public bool IsVisible { get; set; } = true;
        public object? Data { get; set; }
        public string Icon { get; set; } = string.Empty;
        public string Size { get; set; } = "medium";
    }

    public class DashboardWidgetInfo
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
    }

    public enum DashboardWidgetType
    {
        SummaryCards = 1,
        FindingsChart = 2,
        RisksChart = 3,
        AssessmentTime = 4,
        AssetFindings = 5,
        AssetRisks = 6,
        BusinessUnitFindings = 7,
        BusinessUnitRisks = 8
    }

    public class DashboardSummary
    {
        public int TotalFindings { get; set; }
        public int OpenFindings { get; set; }
        public int HighRiskFindings { get; set; }
        public int OverdueFindings { get; set; }
        public int TotalRisks { get; set; }
        public int AcceptedRisks { get; set; }
        public decimal TotalALE { get; set; }
        public int PendingRequests { get; set; }
        public int CompletedAssessments { get; set; }
        public int PendingAssessments { get; set; }
    }

    public class DashboardData
    {
        public List<object> ChartData { get; set; } = new List<object>();
        public string ChartType { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public List<AssessmentTimeMetric> AssessmentTimes { get; set; } = new List<AssessmentTimeMetric>();
        public List<AssetRiskMetric> AssetsWithAcceptedRisks { get; set; } = new List<AssetRiskMetric>();
        public List<AssetFindingMetric> AssetsWithOpenFindings { get; set; } = new List<AssetFindingMetric>();
        public List<BusinessUnitRiskMetric> BusinessUnitsWithAcceptedRisks { get; set; } = new List<BusinessUnitRiskMetric>();
        public List<BusinessUnitFindingMetric> BusinessUnitsWithOverdueFindings { get; set; } = new List<BusinessUnitFindingMetric>();
        public DashboardSummary Summary { get; set; } = new DashboardSummary();
        public decimal AverageAssessmentDays { get; set; }
    }

    public class AssessmentTimeMetric
    {
        public int AssessmentId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Asset { get; set; } = string.Empty;
        public DateTime? StartDate { get; set; }
        public DateTime? CompletionDate { get; set; }
        public int DaysToComplete { get; set; }
        public string Status { get; set; } = string.Empty;
        public string AssessorName { get; set; } = string.Empty;
        public decimal AverageHours { get; set; }
        public int CompletedAssessments { get; set; }
    }

    public class AssetRiskMetric
    {
        public string Asset { get; set; } = string.Empty;
        public int AcceptedRiskCount { get; set; }
        public List<string> RiskTitles { get; set; } = new List<string>();
        public string AssetName { get; set; } = string.Empty;
        public int AcceptedRisks { get; set; }
        public decimal TotalALE { get; set; }
    }

    public class AssetFindingMetric
    {
        public string Asset { get; set; } = string.Empty;
        public int OpenFindingCount { get; set; }
        public int CriticalFindings { get; set; }
        public int HighFindings { get; set; }
        public List<string> FindingTitles { get; set; } = new List<string>();
        public string AssetName { get; set; } = string.Empty;
        public int OpenFindings { get; set; }
        public int HighRiskFindings { get; set; }
    }

    public class BusinessUnitRiskMetric
    {
        public string BusinessOwner { get; set; } = string.Empty;
        public int AcceptedRiskCount { get; set; }
        public List<string> Assets { get; set; } = new List<string>();
        public string BusinessUnit { get; set; } = string.Empty;
        public int AcceptedRisks { get; set; }
        public decimal TotalALE { get; set; }
    }

    public class BusinessUnitFindingMetric
    {
        public string BusinessOwner { get; set; } = string.Empty;
        public int OverdueFindingCount { get; set; }
        public int DaysOverdue { get; set; }
        public List<string> Assets { get; set; } = new List<string>();
        public string BusinessUnit { get; set; } = string.Empty;
        public int OverdueFindings { get; set; }
        public int TotalFindings { get; set; }
    }

    // Enhanced DashboardViewModel with filtering capabilities
    public class DashboardViewModel
    {
        public int TotalRisks { get; set; }
        public decimal TotalALE { get; set; }
        public int OpenFindings { get; set; }
        public int HighRiskFindings { get; set; }
        public int CriticalRiskFindings { get; set; }
        public int HighRisks { get; set; }
        public int CriticalRisks { get; set; }
        public int PendingRequests { get; set; }
        public int OverdueItems { get; set; }
        public IEnumerable<Finding> RecentFindings { get; set; } = new List<Finding>();
        public IEnumerable<Risk> HighValueRisks { get; set; } = new List<Risk>();
        public IEnumerable<AssessmentRequest> PendingAssessments { get; set; } = new List<AssessmentRequest>();
        
        // Filter Settings
        public DashboardFilters Filters { get; set; } = new DashboardFilters();
        
        // Filter Options for UI
        public List<string> AvailableBusinessUnits { get; set; } = new List<string>();
        public List<string> AvailableDomains { get; set; } = new List<string>();
        public List<string> AvailableAssets { get; set; } = new List<string>();
        public List<string> AvailableAssignees { get; set; } = new List<string>();
        
        // Trend Data for Charts
        public List<DashboardTrendData> TrendData { get; set; } = new List<DashboardTrendData>();
        
        // Comparison Data (filtered vs unfiltered)
        public DashboardComparison? Comparison { get; set; }
        
        // Compliance Metrics
        public List<ComplianceBreakdown> ComplianceBreakdowns { get; set; } = new List<ComplianceBreakdown>();
        public decimal AverageCompliancePercentage { get; set; }
        public int TotalFrameworks { get; set; }
        public int FullyCompliantFrameworks { get; set; }
        
        // Trend Analytics
        public DashboardTrendAnalytics? TrendAnalytics { get; set; }
    }

    public class DashboardFilters
    {
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string? BusinessUnit { get; set; }
        public string? Domain { get; set; }
        public string? Asset { get; set; }
        public string? AssignedTo { get; set; }
        public RiskRating? MinRiskRating { get; set; }
        public RiskLevel? MinRiskLevel { get; set; }
        public FindingStatus? FindingStatus { get; set; }
        public RiskStatus? RiskStatus { get; set; }
        public bool ShowOverdueOnly { get; set; }
        public bool ShowCriticalOnly { get; set; }
        
        // Helper method to check if any filters are active
        public bool HasActiveFilters()
        {
            return StartDate.HasValue || EndDate.HasValue || 
                   !string.IsNullOrEmpty(BusinessUnit) || 
                   !string.IsNullOrEmpty(Domain) ||
                   !string.IsNullOrEmpty(Asset) ||
                   !string.IsNullOrEmpty(AssignedTo) ||
                   MinRiskRating.HasValue || MinRiskLevel.HasValue ||
                   FindingStatus.HasValue || RiskStatus.HasValue ||
                   ShowOverdueOnly || ShowCriticalOnly;
        }
        
        // Generate filter description for UI
        public string GetFilterDescription()
        {
            var filters = new List<string>();
            
            if (StartDate.HasValue || EndDate.HasValue)
            {
                var dateRange = "";
                if (StartDate.HasValue && EndDate.HasValue)
                    dateRange = $"{StartDate.Value:MMM dd} - {EndDate.Value:MMM dd, yyyy}";
                else if (StartDate.HasValue)
                    dateRange = $"From {StartDate.Value:MMM dd, yyyy}";
                else if (EndDate.HasValue)
                    dateRange = $"Until {EndDate.Value:MMM dd, yyyy}";
                filters.Add($"Date: {dateRange}");
            }
            
            if (!string.IsNullOrEmpty(BusinessUnit))
                filters.Add($"Business Unit: {BusinessUnit}");
            if (!string.IsNullOrEmpty(Domain))
                filters.Add($"Domain: {Domain}");
            if (!string.IsNullOrEmpty(Asset))
                filters.Add($"Asset: {Asset}");
            if (!string.IsNullOrEmpty(AssignedTo))
                filters.Add($"Assigned: {AssignedTo}");
            if (MinRiskRating.HasValue)
                filters.Add($"Min Risk: {MinRiskRating}+");
            if (ShowOverdueOnly)
                filters.Add("Overdue Only");
            if (ShowCriticalOnly)
                filters.Add("Critical Only");
                
            return filters.Any() ? string.Join(" | ", filters) : "No filters applied";
        }
    }

    public class DashboardTrendData
    {
        public DateTime Date { get; set; }
        public int NewFindings { get; set; }
        public int ClosedFindings { get; set; }
        public int NewRisks { get; set; }
        public int AcceptedRisks { get; set; }
        public int OverdueCount { get; set; }
        public decimal TotalALE { get; set; }
    }

    public class DashboardComparison
    {
        public int FilteredFindings { get; set; }
        public int TotalFindings { get; set; }
        public int FilteredRisks { get; set; }
        public int TotalRisks { get; set; }
        public decimal FilteredALE { get; set; }
        public decimal TotalALE { get; set; }
        
        public double FindingsPercentage => TotalFindings > 0 ? (FilteredFindings / (double)TotalFindings) * 100 : 0;
        public double RisksPercentage => TotalRisks > 0 ? (FilteredRisks / (double)TotalRisks) * 100 : 0;
        public double ALEPercentage => TotalALE > 0 ? (double)(FilteredALE / TotalALE) * 100 : 0;
    }

    // Framework Compliance Analytics ViewModel
    public class FrameworkComplianceAnalyticsViewModel
    {
        public ComplianceFramework Framework { get; set; } = new ComplianceFramework();
        public ComplianceMetrics Metrics { get; set; } = new ComplianceMetrics();
        public List<ComplianceTrend> TrendData { get; set; } = new List<ComplianceTrend>();
        public List<ControlComplianceDetail> ControlDetails { get; set; } = new List<ControlComplianceDetail>();
        public Dictionary<string, List<ControlComplianceDetail>> ControlsByCategory { get; set; } = new Dictionary<string, List<ControlComplianceDetail>>();
        
        // Filter options
        public object StatusFilterOptions { get; set; } = new object();
        public List<string> Categories => ControlsByCategory.Keys.ToList();
        
        // Summary properties
        public int TotalControlsWithGaps => ControlDetails.Count(c => c.Status != ComplianceStatus.FullyCompliant && c.Status != ComplianceStatus.NotApplicable);
        public int CriticalGaps => ControlDetails.Count(c => c.Status == ComplianceStatus.NonCompliant && c.Priority == ControlPriority.High);
        public decimal ComplianceImprovement => TrendData.Count >= 2 ? TrendData.Last().CompliancePercentage - TrendData.First().CompliancePercentage : 0;
        
        // Chart data preparation
        public string TrendChartLabels => string.Join(",", TrendData.Select(t => $"\"{t.Date:MMM yyyy}\""));
        public string TrendChartData => string.Join(",", TrendData.Select(t => t.CompliancePercentage.ToString("F1")));
    }

    // Advanced Trend Analysis ViewModel
    public class ComplianceTrendAnalysisViewModel
    {
        public ComplianceFramework Framework { get; set; } = new ComplianceFramework();
        public ComplianceTrendAnalysis TrendAnalysis { get; set; } = new ComplianceTrendAnalysis();
        public List<ComplianceForecast> Forecast { get; set; } = new List<ComplianceForecast>();
        public ComplianceVelocityMetrics Velocity { get; set; } = new ComplianceVelocityMetrics();
        public List<ComplianceMilestone> Milestones { get; set; } = new List<ComplianceMilestone>();
        public ComplianceMaturityProgression MaturityProgression { get; set; } = new ComplianceMaturityProgression();
        
        // Chart data for JavaScript visualization
        public string HistoricalChartLabels { get; set; } = string.Empty;
        public string HistoricalChartData { get; set; } = string.Empty;
        public string ForecastChartLabels { get; set; } = string.Empty;
        public string ForecastChartData { get; set; } = string.Empty;
        public string ForecastUpperBound { get; set; } = string.Empty;
        public string ForecastLowerBound { get; set; } = string.Empty;
        public string VelocityChartLabels { get; set; } = string.Empty;
        public string VelocityChartData { get; set; } = string.Empty;
        
        // Summary calculations
        public int UpcomingMilestones => Milestones.Count(m => !m.IsAchieved && m.TargetDate >= DateTime.UtcNow);
        public int OverdueMilestones => Milestones.Count(m => !m.IsAchieved && m.TargetDate < DateTime.UtcNow);
        public decimal ProjectedCompletionDays => TrendAnalysis.DaysToTarget;
        public string PerformanceTrend => TrendAnalysis.OverallTrend;
        public bool IsImproving => TrendAnalysis.TrendSlope > 0;
        public decimal ComplianceAcceleration => Velocity.AccelerationRate;
        
        // Risk indicators
        public bool HasHighVariance => TrendAnalysis.ComplianceVariance > 10;
        public bool IsStagnating => Math.Abs(TrendAnalysis.TrendSlope) < 0.1m;
        public bool HasConsistentProgress => Velocity.ConsecutiveImprovementMonths >= 3;
        public string OverallHealthStatus => DetermineHealthStatus();
        
        private string DetermineHealthStatus()
        {
            if (TrendAnalysis.CurrentCompliance >= 90 && IsImproving) return "Excellent";
            if (TrendAnalysis.CurrentCompliance >= 75 && !IsStagnating) return "Good";
            if (TrendAnalysis.CurrentCompliance >= 50 && IsImproving) return "Fair";
            if (IsStagnating || TrendAnalysis.TrendSlope < -1) return "Poor";
            return "Needs Attention";
        }
    }

    // Dashboard Trend Analytics Data Structures
    public class DashboardTrendAnalytics
    {
        // Chart Labels and Data (CSV format for JavaScript)
        public string FindingsTrendLabels { get; set; } = string.Empty;
        public string FindingsTrendData { get; set; } = string.Empty;
        public string RisksTrendLabels { get; set; } = string.Empty;
        public string RisksTrendData { get; set; } = string.Empty;
        public string ComplianceTrendLabels { get; set; } = string.Empty;
        public string ComplianceTrendData { get; set; } = string.Empty;
        public string SLATrendLabels { get; set; } = string.Empty;
        public string SLATrendData { get; set; } = string.Empty;
        
        // Executive KPI Summary
        public DashboardExecutiveKPIs ExecutiveKPIs { get; set; } = new DashboardExecutiveKPIs();
        
        // Risk Heat Map Data
        public RiskHeatMapData RiskHeatMapData { get; set; } = new RiskHeatMapData();
    }

    public class DashboardExecutiveKPIs
    {
        public string RiskTrend { get; set; } = "Stable";
        public string FindingsTrend { get; set; } = "Stable";
        public string ComplianceTrend { get; set; } = "Stable";
        public string SLAPerformanceTrend { get; set; } = "Stable";
        public decimal OverallHealthScore { get; set; }
        
        // Helper properties for UI styling
        public string RiskTrendClass => GetTrendClass(RiskTrend, true); // Inverted: increasing risks = bad
        public string FindingsTrendClass => GetTrendClass(FindingsTrend, true); // Inverted: increasing findings = bad
        public string ComplianceTrendClass => GetTrendClass(ComplianceTrend, false); // Normal: increasing compliance = good
        public string SLATrendClass => GetTrendClass(SLAPerformanceTrend, false); // Normal: increasing SLA = good
        public string HealthScoreClass => OverallHealthScore >= 80 ? "text-success" : OverallHealthScore >= 60 ? "text-warning" : "text-danger";
        
        private string GetTrendClass(string trend, bool inverted)
        {
            return trend switch
            {
                "Increasing" => inverted ? "text-danger" : "text-success",
                "Decreasing" => inverted ? "text-success" : "text-danger", 
                "Stable" => "text-info",
                _ => "text-muted"
            };
        }
    }

    public class RiskHeatMapData
    {
        public int CriticalFindings { get; set; }
        public int HighFindings { get; set; }
        public int MediumFindings { get; set; }
        public int LowFindings { get; set; }
        public Dictionary<string, int> DomainDistribution { get; set; } = new Dictionary<string, int>();
        
        // Chart data for heat map visualization
        public string HeatMapLabels => string.Join(",", DomainDistribution.Keys.Select(k => $"\"{k}\""));
        public string HeatMapData => string.Join(",", DomainDistribution.Values);
        public int TotalFindings => CriticalFindings + HighFindings + MediumFindings + LowFindings;
    }

    // Supporting trend data structures
    public class TrendDataPoint
    {
        public DateTime Date { get; set; }
        public int Count { get; set; }
    }

    public class ComplianceTrendDataPoint
    {
        public DateTime Date { get; set; }
        public decimal TotalCompliance { get; set; }
        public int FrameworkCount { get; set; }
        public decimal AverageCompliance { get; set; }
    }

    public class SLATrendDataPoint
    {
        public DateTime Date { get; set; }
        public decimal OnTimePercentage { get; set; }
        public int TotalItems { get; set; }
        public int OnTimeItems { get; set; }
    }
}