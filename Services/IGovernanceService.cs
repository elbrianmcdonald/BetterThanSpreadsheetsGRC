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
    }
}