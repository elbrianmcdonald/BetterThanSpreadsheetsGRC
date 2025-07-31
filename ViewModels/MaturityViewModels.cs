using System.ComponentModel.DataAnnotations;
using CyberRiskApp.Models;

namespace CyberRiskApp.ViewModels
{
    public class MaturityFrameworkUploadViewModel
    {
        public MaturityFramework Framework { get; set; } = new MaturityFramework();

        [Required(ErrorMessage = "Please select an Excel file to upload.")]
        public IFormFile? ExcelFile { get; set; }
    }

    public class MaturityDashboardViewModel
    {
        public Dictionary<string, object> Stats { get; set; } = new Dictionary<string, object>();
        public IEnumerable<MaturityAssessment> RecentAssessments { get; set; } = new List<MaturityAssessment>();
        public IEnumerable<MaturityAssessment> UpcomingDeadlines { get; set; } = new List<MaturityAssessment>();
        public IEnumerable<MaturityFramework> ActiveFrameworks { get; set; } = new List<MaturityFramework>();
    }

    public class MaturityAssessmentViewModel
    {
        public MaturityAssessment Assessment { get; set; } = new MaturityAssessment();
        public IEnumerable<MaturityFramework> AvailableFrameworks { get; set; } = new List<MaturityFramework>();
        public IEnumerable<BusinessOrganization> AvailableOrganizations { get; set; } = new List<BusinessOrganization>();
    }

    public class MaturityAssessmentDetailsViewModel
    {
        public MaturityAssessment Assessment { get; set; } = new MaturityAssessment();
        public IEnumerable<MaturityControlAssessment> ControlAssessments { get; set; } = new List<MaturityControlAssessment>();
        public Dictionary<string, decimal> FunctionScores { get; set; } = new Dictionary<string, decimal>();
        public Dictionary<string, decimal> DomainScores { get; set; } = new Dictionary<string, decimal>(); // For C2M2
        public decimal OverallScore { get; set; }

        // Maturity level distribution
        public Dictionary<MaturityLevel, int> MaturityDistribution { get; set; } = new Dictionary<MaturityLevel, int>();

        // Gap analysis summary
        public int ControlsNeedingImprovement { get; set; }

        // FIXED: Add back the ProjectsRequired property as int
        public int ProjectsRequired { get; set; }

        public Dictionary<TShirtSize, int> ProjectSizeDistribution { get; set; } = new Dictionary<TShirtSize, int>();

        // NEW: Add the missing properties that the controller is setting
        public Dictionary<string, List<MaturityControlAssessment>> GapsByFunction { get; set; } = new Dictionary<string, List<MaturityControlAssessment>>();
        public Dictionary<string, List<MaturityControlAssessment>> GapsByDomain { get; set; } = new Dictionary<string, List<MaturityControlAssessment>>();

        // Additional properties that appear to be used in the enhanced controller
        public Dictionary<MaturityLevel, int> CurrentMaturityDistribution { get; set; } = new Dictionary<MaturityLevel, int>();
        public Dictionary<MaturityLevel, int> TargetMaturityDistribution { get; set; } = new Dictionary<MaturityLevel, int>();
        public IEnumerable<MaturityControlAssessment> HighPriorityGaps { get; set; } = new List<MaturityControlAssessment>();

        // RENAMED: Use a different name for the list to avoid conflict
        public IEnumerable<MaturityControlAssessment> ProjectsRequiredList { get; set; } = new List<MaturityControlAssessment>();

        public IEnumerable<string> KeyRecommendations { get; set; } = new List<string>();
    }

    public class PerformMaturityAssessmentViewModel
    {
        public MaturityAssessment Assessment { get; set; } = new MaturityAssessment();
        public IEnumerable<MaturityControlAssessment> ControlAssessments { get; set; } = new List<MaturityControlAssessment>();

        // Current control being assessed
        public MaturityControlAssessment? CurrentControl { get; set; }
        public int CurrentControlIndex { get; set; }
        public int TotalControls { get; set; }

        // Progress tracking
        public decimal ProgressPercentage { get; set; }
        public int CompletedControls { get; set; }

        // Framework-specific information
        public bool IsNISTCSF => Assessment?.Framework?.Type == FrameworkType.NISTCSF;
        public bool IsC2M2 => Assessment?.Framework?.Type == FrameworkType.C2M2;

        // Available maturity levels based on framework
        public IEnumerable<MaturityLevel> AvailableMaturityLevels { get; set; } = new List<MaturityLevel>();
    }

    public class MaturityControlAssessmentEditViewModel
    {
        public MaturityControlAssessment ControlAssessment { get; set; } = new MaturityControlAssessment();
        public MaturityControl Control { get; set; } = new MaturityControl();
        public MaturityAssessment Assessment { get; set; } = new MaturityAssessment();

        // Available options
        public IEnumerable<MaturityLevel> AvailableCurrentLevels { get; set; } = new List<MaturityLevel>();
        public IEnumerable<MaturityLevel> AvailableTargetLevels { get; set; } = new List<MaturityLevel>();
        public IEnumerable<TShirtSize> AvailableTShirtSizes { get; set; } = Enum.GetValues<TShirtSize>();

        // Framework type for view logic
        public FrameworkType FrameworkType { get; set; }
    }

    public class MaturityReportViewModel
    {
        public MaturityAssessment Assessment { get; set; } = new MaturityAssessment();
        public decimal OverallMaturityScore { get; set; }
        public Dictionary<string, decimal> FunctionScores { get; set; } = new Dictionary<string, decimal>();
        public Dictionary<string, decimal> DomainScores { get; set; } = new Dictionary<string, decimal>();

        // Maturity level summary
        public Dictionary<MaturityLevel, int> CurrentMaturityDistribution { get; set; } = new Dictionary<MaturityLevel, int>();
        public Dictionary<MaturityLevel, int> TargetMaturityDistribution { get; set; } = new Dictionary<MaturityLevel, int>();

        // Gap analysis
        public IEnumerable<MaturityControlAssessment> HighPriorityGaps { get; set; } = new List<MaturityControlAssessment>();
        public IEnumerable<MaturityControlAssessment> ProjectsRequired { get; set; } = new List<MaturityControlAssessment>();

        // Recommendations
        public IEnumerable<string> KeyRecommendations { get; set; } = new List<string>();
        public Dictionary<string, List<MaturityControlAssessment>> GapsByFunction { get; set; } = new Dictionary<string, List<MaturityControlAssessment>>();
        public Dictionary<string, List<MaturityControlAssessment>> GapsByDomain { get; set; } = new Dictionary<string, List<MaturityControlAssessment>>();
    }

    public class MaturityControlAssessmentUpdate
    {
        public int Id { get; set; }
        public string? CurrentMaturityLevel { get; set; }
        public string? TargetMaturityLevel { get; set; }
        public string? Ownership { get; set; }
        public DateTime? TargetCompletionDate { get; set; }
        public string? TargetCompletionDateString { get; set; }
        public bool ProjectNeeded { get; set; }
        public string? TShirtSize { get; set; }
        public string? ProjectNumber { get; set; }
        public string? Evidence { get; set; }
        public string? GapNotes { get; set; }
        public string? RecommendedActions { get; set; }
    }
}