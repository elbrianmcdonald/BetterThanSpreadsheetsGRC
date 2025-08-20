using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IGovernanceService
    {
        // Compliance Framework methods
        Task<IEnumerable<ComplianceFramework>> GetAllFrameworksAsync();
        Task<ComplianceFramework?> GetFrameworkByIdAsync(int id);
        Task<ComplianceFramework> CreateFrameworkAsync(ComplianceFramework framework);
        Task<ComplianceFramework> UpdateFrameworkAsync(ComplianceFramework framework);
        Task<bool> DeleteFrameworkAsync(int id);

        // Business Organization methods
        Task<IEnumerable<BusinessOrganization>> GetAllOrganizationsAsync();
        Task<BusinessOrganization?> GetOrganizationByIdAsync(int id);
        Task<BusinessOrganization> CreateOrganizationAsync(BusinessOrganization organization);
        Task<BusinessOrganization> UpdateOrganizationAsync(BusinessOrganization organization);
        Task<bool> DeleteOrganizationAsync(int id);

        // Compliance Assessment methods
        Task<IEnumerable<ComplianceAssessment>> GetAllAssessmentsAsync();
        Task<ComplianceAssessment?> GetAssessmentByIdAsync(int id);
        Task<ComplianceAssessment> CreateAssessmentAsync(ComplianceAssessment assessment);
        Task<ComplianceAssessment> UpdateAssessmentAsync(ComplianceAssessment assessment);
        Task<bool> DeleteAssessmentAsync(int id);

        // Control Assessment methods (MISSING METHODS ADDED)
        Task<ControlAssessment?> GetControlAssessmentByIdAsync(int id);
        Task<ControlAssessment> UpdateControlAssessmentAsync(ControlAssessment controlAssessment);
        Task<IEnumerable<ControlAssessment>> GetControlAssessmentsByAssessmentIdAsync(int assessmentId);

        // NEW: Compliance Control methods for individual control management
        Task<ComplianceControl?> GetControlByIdAsync(int id);
        Task<ComplianceControl> UpdateControlAsync(ComplianceControl control);
        Task<bool> UpdateControlPriorityAsync(int controlId, ControlPriority priority);
        Task<IEnumerable<ComplianceControl>> GetControlsByFrameworkIdAsync(int frameworkId);

        // Dashboard statistics
        Task<Dictionary<string, object>> GetGovernanceDashboardStatsAsync();
        Task<IEnumerable<ComplianceAssessment>> GetRecentAssessmentsAsync(int count = 5);
        Task<IEnumerable<ComplianceAssessment>> GetUpcomingDeadlinesAsync(int days = 30);

        // Excel Upload Support
        Task AddControlsToFrameworkAsync(int frameworkId, List<ComplianceControl> controls);

        // Enhanced Compliance Analytics
        Task<Dictionary<int, ComplianceMetrics>> GetFrameworkComplianceMetricsAsync();
        Task<ComplianceMetrics> GetFrameworkComplianceMetricsAsync(int frameworkId);
        Task<List<ComplianceBreakdown>> GetComplianceBreakdownByFrameworkAsync();
        Task<List<ComplianceTrend>> GetComplianceTrendDataAsync(int frameworkId, int months = 12);
        Task<List<ControlComplianceDetail>> GetControlComplianceDetailsAsync(int frameworkId, ComplianceStatus? filterStatus = null);
        Task<ComplianceComparison> GetComplianceComparisonAsync(List<int> frameworkIds);
        
        // Advanced Trend Analysis
        Task<ComplianceTrendAnalysis> GetComplianceTrendAnalysisAsync(int frameworkId, int months = 24);
        Task<List<ComplianceForecast>> GetComplianceForecastAsync(int frameworkId, int forecastMonths = 6);
        Task<ComplianceVelocityMetrics> GetComplianceVelocityAsync(int frameworkId);
        Task<List<ComplianceMilestone>> GetComplianceMilestonesAsync(int frameworkId);
        Task<ComplianceMaturityProgression> GetComplianceMaturityProgressionAsync(int frameworkId);
    }

    // Analytics Support Classes
    public class ComplianceMetrics
    {
        public int FrameworkId { get; set; }
        public string FrameworkName { get; set; } = string.Empty;
        public FrameworkType FrameworkType { get; set; }
        public int TotalControls { get; set; }
        public int FullyCompliantControls { get; set; }
        public int MajorlyCompliantControls { get; set; }
        public int PartiallyCompliantControls { get; set; }
        public int NonCompliantControls { get; set; }
        public int NotApplicableControls { get; set; }
        public decimal OverallCompliancePercentage { get; set; }
        public decimal WeightedComplianceScore { get; set; }
        public DateTime LastAssessmentDate { get; set; }
        public string LastAssessor { get; set; } = string.Empty;
        public int ActiveAssessments { get; set; }
        
        // Calculated Properties
        public decimal FullyCompliantPercentage => TotalControls > 0 ? (FullyCompliantControls / (decimal)TotalControls) * 100 : 0;
        public decimal AtLeastPartiallyCompliantPercentage => TotalControls > 0 ? ((FullyCompliantControls + MajorlyCompliantControls + PartiallyCompliantControls) / (decimal)TotalControls) * 100 : 0;
        public string ComplianceGrade => OverallCompliancePercentage >= 90 ? "A" : OverallCompliancePercentage >= 80 ? "B" : OverallCompliancePercentage >= 70 ? "C" : OverallCompliancePercentage >= 60 ? "D" : "F";
        public string RiskLevel => OverallCompliancePercentage >= 85 ? "Low" : OverallCompliancePercentage >= 70 ? "Medium" : OverallCompliancePercentage >= 50 ? "High" : "Critical";
    }

    public class ComplianceBreakdown
    {
        public int FrameworkId { get; set; }
        public string FrameworkName { get; set; } = string.Empty;
        public FrameworkType FrameworkType { get; set; }
        public decimal CompliancePercentage { get; set; }
        public string ComplianceGrade { get; set; } = string.Empty;
        public string RiskLevel { get; set; } = string.Empty;
        public int TotalControls { get; set; }
        public int AssessedControls { get; set; }
        public DateTime? LastAssessmentDate { get; set; }
        public string BadgeClass => RiskLevel switch {
            "Low" => "badge-success",
            "Medium" => "badge-warning", 
            "High" => "badge-danger",
            "Critical" => "badge-dark",
            _ => "badge-secondary"
        };
    }

    public class ComplianceTrend
    {
        public DateTime Date { get; set; }
        public decimal CompliancePercentage { get; set; }
        public int FullyCompliantControls { get; set; }
        public int TotalAssessedControls { get; set; }
        public string Assessor { get; set; } = string.Empty;
    }

    public class ControlComplianceDetail
    {
        public int ControlId { get; set; }
        public string ControlNumber { get; set; } = string.Empty;
        public string ControlTitle { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public ControlPriority Priority { get; set; }
        public ComplianceStatus Status { get; set; }
        public string StatusDisplayName => Status switch {
            ComplianceStatus.FullyCompliant => "Fully Compliant",
            ComplianceStatus.MajorlyCompliant => "Majorly Compliant", 
            ComplianceStatus.PartiallyCompliant => "Partially Compliant",
            ComplianceStatus.NonCompliant => "Non-Compliant",
            ComplianceStatus.NotApplicable => "Not Applicable",
            _ => "Unknown"
        };
        public string Evidence { get; set; } = string.Empty;
        public string GapAnalysis { get; set; } = string.Empty;
        public DateTime? LastAssessmentDate { get; set; }
        public string LastAssessor { get; set; } = string.Empty;
        public string StatusBadgeClass => Status switch {
            ComplianceStatus.FullyCompliant => "badge-success",
            ComplianceStatus.MajorlyCompliant => "badge-info",
            ComplianceStatus.PartiallyCompliant => "badge-warning",
            ComplianceStatus.NonCompliant => "badge-danger", 
            ComplianceStatus.NotApplicable => "badge-secondary",
            _ => "badge-light"
        };
    }

    public class ComplianceComparison
    {
        public List<ComplianceMetrics> FrameworkMetrics { get; set; } = new List<ComplianceMetrics>();
        public decimal AverageCompliancePercentage { get; set; }
        public string BestPerformingFramework { get; set; } = string.Empty;
        public string WorstPerformingFramework { get; set; } = string.Empty;
        public int TotalControlsAcrossFrameworks { get; set; }
        public int TotalCompliantControls { get; set; }
    }

    // Advanced Trend Analysis Classes
    public class ComplianceTrendAnalysis
    {
        public int FrameworkId { get; set; }
        public string FrameworkName { get; set; } = string.Empty;
        public List<ComplianceTrend> TrendData { get; set; } = new List<ComplianceTrend>();
        public decimal CurrentCompliance { get; set; }
        public decimal AverageCompliance { get; set; }
        public decimal BestCompliance { get; set; }
        public decimal WorstCompliance { get; set; }
        public decimal ComplianceVariance { get; set; }
        public string OverallTrend { get; set; } = string.Empty; // "Improving", "Stable", "Declining"
        public decimal TrendSlope { get; set; } // Rate of change per month
        public int DaysToTarget { get; set; } // Estimated days to reach 100% compliance
        public DateTime? LastImprovementDate { get; set; }
        public DateTime? LastDeclineDate { get; set; }
        public List<CompliancePeriodSummary> PeriodSummaries { get; set; } = new List<CompliancePeriodSummary>();
    }

    public class CompliancePeriodSummary
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal StartCompliance { get; set; }
        public decimal EndCompliance { get; set; }
        public decimal ChangePercentage { get; set; }
        public int ControlsImproved { get; set; }
        public int ControlsDeclined { get; set; }
        public string PeriodType { get; set; } = string.Empty; // "Quarter", "Half-Year", "Annual"
    }

    public class ComplianceForecast
    {
        public DateTime Date { get; set; }
        public decimal PredictedCompliance { get; set; }
        public decimal ConfidenceInterval { get; set; }
        public decimal LowerBound { get; set; }
        public decimal UpperBound { get; set; }
        public string ForecastMethod { get; set; } = string.Empty; // "Linear", "Exponential", "Seasonal"
        public List<string> AssumptionNotes { get; set; } = new List<string>();
    }

    public class ComplianceVelocityMetrics
    {
        public int FrameworkId { get; set; }
        public string FrameworkName { get; set; } = string.Empty;
        public decimal CurrentVelocity { get; set; } // Compliance points gained per month
        public decimal AverageVelocity { get; set; }
        public decimal MaxVelocity { get; set; }
        public decimal MinVelocity { get; set; }
        public int ConsecutiveImprovementMonths { get; set; }
        public int ConsecutiveDeclineMonths { get; set; }
        public decimal AccelerationRate { get; set; } // Change in velocity over time
        public DateTime? PeakVelocityDate { get; set; }
        public DateTime? LowestVelocityDate { get; set; }
        public List<VelocityPeriod> VelocityHistory { get; set; } = new List<VelocityPeriod>();
    }

    public class VelocityPeriod
    {
        public DateTime Date { get; set; }
        public decimal Velocity { get; set; }
        public decimal Acceleration { get; set; }
        public int ControlsChanged { get; set; }
        public string VelocityCategory { get; set; } = string.Empty; // "High", "Medium", "Low", "Stalled"
    }

    public class ComplianceMilestone
    {
        public int MilestoneId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal TargetCompliance { get; set; }
        public DateTime TargetDate { get; set; }
        public DateTime? AchievedDate { get; set; }
        public bool IsAchieved { get; set; }
        public decimal ActualCompliance { get; set; }
        public int DaysAheadBehind { get; set; }
        public string Status { get; set; } = string.Empty; // "On Track", "At Risk", "Behind", "Completed"
        public List<string> RequiredActions { get; set; } = new List<string>();
        public string Priority { get; set; } = string.Empty; // "Critical", "High", "Medium", "Low"
    }

    public class ComplianceMaturityProgression
    {
        public int FrameworkId { get; set; }
        public string FrameworkName { get; set; } = string.Empty;
        public int CurrentMaturityLevel { get; set; } // 1-5 scale
        public int TargetMaturityLevel { get; set; }
        public string CurrentMaturityDescription { get; set; } = string.Empty;
        public string TargetMaturityDescription { get; set; } = string.Empty;
        public decimal ProgressToNextLevel { get; set; }
        public List<MaturityLevelRequirement> LevelRequirements { get; set; } = new List<MaturityLevelRequirement>();
        public List<MaturityProgressIndicator> ProgressIndicators { get; set; } = new List<MaturityProgressIndicator>();
        public DateTime? EstimatedTargetAchievementDate { get; set; }
        public List<string> NextStepRecommendations { get; set; } = new List<string>();
    }

    public class MaturityLevelRequirement
    {
        public int Level { get; set; }
        public string LevelName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal MinimumCompliancePercentage { get; set; }
        public int RequiredControlsCount { get; set; }
        public int AchievedControlsCount { get; set; }
        public bool IsAchieved { get; set; }
        public List<string> KeyRequirements { get; set; } = new List<string>();
    }

    public class MaturityProgressIndicator
    {
        public string Category { get; set; } = string.Empty;
        public string Indicator { get; set; } = string.Empty;
        public decimal CurrentScore { get; set; }
        public decimal TargetScore { get; set; }
        public decimal ProgressPercentage { get; set; }
        public string Status { get; set; } = string.Empty;
        public string TrendDirection { get; set; } = string.Empty; // "Up", "Down", "Stable"
    }
}