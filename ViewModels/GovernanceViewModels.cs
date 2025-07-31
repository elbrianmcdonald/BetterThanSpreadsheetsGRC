using CyberRiskApp.Models;

namespace CyberRiskApp.ViewModels
{
    public class GovernanceDashboardViewModel
    {
        public Dictionary<string, object> Stats { get; set; } = new Dictionary<string, object>();
        public IEnumerable<ComplianceAssessment> RecentAssessments { get; set; } = new List<ComplianceAssessment>();
        public IEnumerable<ComplianceAssessment> UpcomingDeadlines { get; set; } = new List<ComplianceAssessment>();
        public IEnumerable<ComplianceFramework> ActiveFrameworks { get; set; } = new List<ComplianceFramework>();
        
        // New properties for enhanced dashboard
        public IEnumerable<MaturityAssessment> RecentMaturityAssessments { get; set; } = new List<MaturityAssessment>();
        public IEnumerable<MaturityFramework> ActiveMaturityFrameworks { get; set; } = new List<MaturityFramework>();
        public List<ComplianceAssessment> ComplianceAssessments { get; set; } = new List<ComplianceAssessment>();
        public List<MaturityAssessment> MaturityAssessments { get; set; } = new List<MaturityAssessment>();
    }

    public class FrameworkUploadViewModel
    {
        public ComplianceFramework Framework { get; set; } = new ComplianceFramework();
        public IFormFile? ExcelFile { get; set; }
        public bool PreviewMode { get; set; } = false;
        public List<ComplianceControl> PreviewControls { get; set; } = new List<ComplianceControl>();
    }

    public class ComplianceAssessmentViewModel
    {
        public ComplianceAssessment Assessment { get; set; } = new ComplianceAssessment();
        public List<BusinessOrganization> Organizations { get; set; } = new List<BusinessOrganization>();
        public List<ComplianceFramework> Frameworks { get; set; } = new List<ComplianceFramework>();
        public List<ControlAssessmentViewModel> ControlAssessments { get; set; } = new List<ControlAssessmentViewModel>();
    }

    public class ControlAssessmentViewModel
    {
        public ControlAssessment ControlAssessment { get; set; } = new ControlAssessment();
        public ComplianceControl Control { get; set; } = new ComplianceControl();
    }

    public class OrganizationManagementViewModel
    {
        public List<BusinessOrganization> Organizations { get; set; } = new List<BusinessOrganization>();
        public BusinessOrganization NewOrganization { get; set; } = new BusinessOrganization();
    }

    public class ControlAssessmentUpdate
    {
        public int Id { get; set; }
        public string? Status { get; set; }
        public string? Ownership { get; set; }
        public DateTime? ProjectedComplianceDate { get; set; }
        public string? ProjectedComplianceDateString { get; set; }
        public bool ProjectNeeded { get; set; }
        public string? TShirtSize { get; set; }
        public string? ProjectNumber { get; set; }
        public string? GapNotes { get; set; }
        public string? EvidenceOfCompliance { get; set; }
    }
}