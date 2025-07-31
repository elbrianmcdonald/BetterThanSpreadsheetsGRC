using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IRiskAssessmentService
    {
        Task<IEnumerable<RiskAssessment>> GetAllAssessmentsAsync();
        Task<RiskAssessment?> GetAssessmentByIdAsync(int id);
        Task<RiskAssessment> CreateAssessmentAsync(RiskAssessment assessment);
        Task<RiskAssessment> UpdateAssessmentAsync(RiskAssessment assessment);
        Task<bool> DeleteAssessmentAsync(int id);
        RiskAssessment CalculateFAIRResults(RiskAssessment assessment);
    }
}