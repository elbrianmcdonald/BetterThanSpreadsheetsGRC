using CyberRiskApp.Models;

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

    // Add your existing DashboardViewModel if needed
    public class DashboardViewModel
    {
        public int TotalRisks { get; set; }
        public decimal TotalALE { get; set; }
        public int OpenFindings { get; set; }
        public int HighRiskFindings { get; set; }
        public int PendingRequests { get; set; }
        public int OverdueItems { get; set; }
        public IEnumerable<Finding> RecentFindings { get; set; } = new List<Finding>();
        public IEnumerable<Risk> HighValueRisks { get; set; } = new List<Risk>();
        public IEnumerable<AssessmentRequest> PendingAssessments { get; set; } = new List<AssessmentRequest>();
    }
}