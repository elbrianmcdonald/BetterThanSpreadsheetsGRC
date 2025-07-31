using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IRiskLevelSettingsService
    {
        Task<RiskLevelSettings> GetActiveSettingsAsync();
        Task<RiskLevelSettings> UpdateSettingsAsync(RiskLevelSettings settings);
        Task<RiskLevelSettings> CreateDefaultSettingsAsync();
        Task<IEnumerable<RiskLevelSettings>> GetAllSettingsAsync();
        Task<RiskLevelSettings?> GetSettingsByIdAsync(int id);

        // Helper methods for risk level calculation
        string GetRiskLevel(AssessmentType assessmentType, decimal value);
        string GetFairRiskLevel(decimal ale);
        string GetQualitativeRiskLevel(decimal riskScore);

        // Get settings for JavaScript
        Task<object> GetSettingsForJavaScriptAsync();

        // Risk appetite methods
        Task<decimal> GetRiskAppetiteThresholdAsync();
        Task<bool> IsRiskAboveAppetiteAsync(decimal riskScore, AssessmentType assessmentType);
    }
}