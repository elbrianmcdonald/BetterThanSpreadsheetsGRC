using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IMaturityService
    {
        // Maturity Framework methods
        Task<IEnumerable<MaturityFramework>> GetAllFrameworksAsync();
        Task<MaturityFramework?> GetFrameworkByIdAsync(int id);
        Task<MaturityFramework> CreateFrameworkAsync(MaturityFramework framework);
        Task<MaturityFramework> UpdateFrameworkAsync(MaturityFramework framework);
        Task<bool> DeleteFrameworkAsync(int id);

        // Maturity Assessment methods
        Task<IEnumerable<MaturityAssessment>> GetAllAssessmentsAsync();
        Task<MaturityAssessment?> GetAssessmentByIdAsync(int id);
        Task<MaturityAssessment> CreateAssessmentAsync(MaturityAssessment assessment);
        Task<MaturityAssessment> UpdateAssessmentAsync(MaturityAssessment assessment);
        Task<bool> DeleteAssessmentAsync(int id);

        // Maturity Control Assessment methods
        Task<MaturityControlAssessment?> GetControlAssessmentByIdAsync(int id);
        Task<MaturityControlAssessment> UpdateControlAssessmentAsync(MaturityControlAssessment controlAssessment);
        Task<IEnumerable<MaturityControlAssessment>> GetControlAssessmentsByAssessmentIdAsync(int assessmentId);

        // Maturity Control methods
        Task<MaturityControl?> GetControlByIdAsync(int id);
        Task<MaturityControl> UpdateControlAsync(MaturityControl control);
        Task<bool> UpdateControlPriorityAsync(int controlId, ControlPriority priority);
        Task<IEnumerable<MaturityControl>> GetControlsByFrameworkIdAsync(int frameworkId);

        // NEW: Enhanced Priority Management Methods
        Task<int> BulkUpdateControlPrioritiesAsync(int frameworkId, Dictionary<int, ControlPriority> priorities);
        Task<Dictionary<string, object>> GetFrameworkControlStatsAsync(int frameworkId);
        Task<IEnumerable<MaturityControl>> SearchControlsAsync(int frameworkId, string searchTerm, ControlPriority? priority = null, string domain = null);

        // Dashboard statistics
        Task<Dictionary<string, object>> GetMaturityDashboardStatsAsync();
        Task<IEnumerable<MaturityAssessment>> GetRecentAssessmentsAsync(int count = 5);
        Task<IEnumerable<MaturityAssessment>> GetUpcomingDeadlinesAsync(int days = 30);

        // Excel Upload Support
        Task AddControlsToFrameworkAsync(int frameworkId, List<MaturityControl> controls);

        // Maturity Score Calculation - Framework Agnostic
        Task<decimal> CalculateOverallMaturityScoreAsync(int assessmentId);
        Task<Dictionary<string, decimal>> GetMaturityScoresByFunctionAsync(int assessmentId);
        Task<Dictionary<string, decimal>> GetMaturityScoresByDomainAsync(int assessmentId); // For C2M2

        // C2M2-Specific Methods (these are public for advanced C2M2 reporting)
        Task<Dictionary<string, Dictionary<string, int>>> GetC2M2ObjectiveScoresAsync(int assessmentId);
        Task<Dictionary<string, List<string>>> GetC2M2InstitutionalizationGapsAsync(int assessmentId);

        // ADDED: Missing bulk update method
        Task BulkUpdateControlAssessmentsAsync(List<MaturityControlAssessment> controlAssessments);
    }
}