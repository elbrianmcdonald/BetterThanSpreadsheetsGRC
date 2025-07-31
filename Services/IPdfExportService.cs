using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IPdfExportService
    {
        Task<byte[]> ExportRiskAssessmentToPdfAsync(RiskAssessment riskAssessment);
        Task<byte[]> ExportMultipleRiskAssessmentsToPdfAsync(IEnumerable<RiskAssessment> riskAssessments);
        Task<byte[]> ExportFindingToPdfAsync(Finding finding);
        Task<byte[]> ExportRiskToPdfAsync(Risk risk);
    }
}