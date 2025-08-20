using CyberRiskApp.Models;
using System.Linq.Expressions;

namespace CyberRiskApp.Repositories
{
    /// <summary>
    /// Repository interface for ComplianceAssessment entities with domain-specific operations
    /// </summary>
    public interface IComplianceAssessmentRepository : IRepository<ComplianceAssessment>
    {
        // Compliance assessment queries
        Task<IEnumerable<ComplianceAssessment>> GetAssessmentsByStatusAsync(AssessmentStatus status);
        Task<IEnumerable<ComplianceAssessment>> GetAssessmentsByFrameworkAsync(int frameworkId);
        Task<IEnumerable<ComplianceAssessment>> GetAssessmentsByOrganizationAsync(int organizationId);
        Task<IEnumerable<ComplianceAssessment>> GetAssessmentsByAssessorAsync(string assessor);
        Task<IEnumerable<ComplianceAssessment>> GetAssessmentsWithControlsAsync();
        Task<ComplianceAssessment?> GetAssessmentWithControlsAsync(int assessmentId);
        
        // Status-based queries
        Task<IEnumerable<ComplianceAssessment>> GetDraftAssessmentsAsync();
        Task<IEnumerable<ComplianceAssessment>> GetInProgressAssessmentsAsync();
        Task<IEnumerable<ComplianceAssessment>> GetCompletedAssessmentsAsync();
        Task<IEnumerable<ComplianceAssessment>> GetOverdueAssessmentsAsync();
        Task<IEnumerable<ComplianceAssessment>> GetRecentAssessmentsAsync(int count = 10);
        
        // Statistical and analytics queries
        Task<Dictionary<AssessmentStatus, int>> GetAssessmentsCountByStatusAsync();
        Task<Dictionary<int, int>> GetAssessmentsCountByFrameworkAsync();
        Task<Dictionary<string, int>> GetAssessmentsCountByAssessorAsync();
        Task<Dictionary<int, decimal>> GetCompliancePercentagesByFrameworkAsync();
        Task<decimal> GetAverageCompliancePercentageAsync();
        Task<decimal> GetFrameworkCompliancePercentageAsync(int frameworkId);
        
        // Assessment lifecycle operations
        Task<bool> StartAssessmentAsync(int assessmentId, string userId);
        Task<bool> CompleteAssessmentAsync(int assessmentId, string userId);
        Task<bool> ApproveAssessmentAsync(int assessmentId, string userId);
        Task<bool> UpdateCompliancePercentageAsync(int assessmentId, decimal percentage, string userId);
        Task<bool> AssignAssessorAsync(int assessmentId, string assessor, string userId);
        
        // Control assessment operations
        Task<IEnumerable<ControlAssessment>> GetControlAssessmentsByAssessmentIdAsync(int assessmentId);
        Task<ControlAssessment?> GetControlAssessmentByIdAsync(int controlAssessmentId);
        Task<bool> UpdateControlAssessmentAsync(ControlAssessment controlAssessment, string userId);
        Task<int> BulkUpdateControlAssessmentsAsync(IEnumerable<ControlAssessment> controlAssessments, string userId);
        
        // Compliance trend analysis
        Task<IEnumerable<ComplianceAssessment>> GetAssessmentsInDateRangeAsync(DateTime startDate, DateTime endDate);
        Task<Dictionary<DateTime, decimal>> GetComplianceTrendDataAsync(int frameworkId, int months = 12);
        Task<IEnumerable<ComplianceAssessment>> GetHistoricalAssessmentsForFrameworkAsync(int frameworkId);
    }
}