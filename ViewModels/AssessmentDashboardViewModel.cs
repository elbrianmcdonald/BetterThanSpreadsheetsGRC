using CyberRiskApp.Models;

namespace CyberRiskApp.ViewModels
{
    public class AssessmentDashboardViewModel
    {
        public List<AssessmentCardViewModel> Assessments { get; set; } = new List<AssessmentCardViewModel>();
        public int TotalAssessments { get; set; }
        public int InProgressAssessments { get; set; }
        public int CompletedAssessments { get; set; }
    }

    public class AssessmentCardViewModel
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string AssessmentType { get; set; } = string.Empty; // "Maturity" or "Compliance"
        public string FrameworkName { get; set; } = string.Empty;
        public string FrameworkVersion { get; set; } = string.Empty;
        public AssessmentStatus Status { get; set; }
        public string StatusClass => Status switch
        {
            AssessmentStatus.Draft => "bg-secondary",
            AssessmentStatus.InProgress => "bg-warning",
            AssessmentStatus.Completed => "bg-success",
            AssessmentStatus.Approved => "bg-info",
            _ => "bg-secondary"
        };
        public DateTime StartDate { get; set; }
        public DateTime? CompletedDate { get; set; }
        public string Assessor { get; set; } = string.Empty;
        public double Progress { get; set; } // 0-100
        public string ProgressText => $"{Progress:F0}%";
        
        // For quick stats on card
        public int TotalControls { get; set; }
        public int AssessedControls { get; set; }
        
        // For maturity assessments
        public double? CurrentMaturityLevel { get; set; }
        public double? TargetMaturityLevel { get; set; }
        
        // For compliance assessments
        public double? CompliancePercentage { get; set; }
    }

    public class AssessmentDetailsViewModel
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string AssessmentType { get; set; } = string.Empty;
        public string FrameworkName { get; set; } = string.Empty;
        public string FrameworkVersion { get; set; } = string.Empty;
        public AssessmentStatus Status { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? CompletedDate { get; set; }
        public string Assessor { get; set; } = string.Empty;
        
        // Common stats
        public int TotalControls { get; set; }
        public int AssessedControls { get; set; }
        public double Progress { get; set; }
        
        // For maturity assessments (NIST CSF 2.0)
        public List<FunctionMaturityData>? FunctionMaturityData { get; set; }
        public double? OverallCurrentMaturity { get; set; }
        public double? OverallTargetMaturity { get; set; }
        
        // For compliance assessments
        public Dictionary<string, ComplianceCategoryStats>? CategoryStats { get; set; }
        public double? OverallCompliancePercentage { get; set; }
        
        // Control details
        public List<ControlAssessmentDetail> ControlAssessments { get; set; } = new List<ControlAssessmentDetail>();
    }

    public class FunctionMaturityData
    {
        public string FunctionName { get; set; } = string.Empty;
        public double CurrentMaturity { get; set; }
        public double TargetMaturity { get; set; }
        public int ControlCount { get; set; }
    }

    public class ComplianceCategoryStats
    {
        public string CategoryName { get; set; } = string.Empty;
        public int TotalControls { get; set; }
        public int CompliantControls { get; set; }
        public int NonCompliantControls { get; set; }
        public int PartiallyCompliantControls { get; set; }
        public double CompliancePercentage { get; set; }
    }

    public class ControlAssessmentDetail
    {
        public int Id { get; set; }
        public string ControlId { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        
        // For maturity
        public int? CurrentMaturityLevel { get; set; }
        public int? TargetMaturityLevel { get; set; }
        
        // For compliance
        public ComplianceStatus? ComplianceStatus { get; set; }
        
        public string Notes { get; set; } = string.Empty;
        public string Findings { get; set; } = string.Empty;
        public DateTime? AssessmentDate { get; set; }
    }
}