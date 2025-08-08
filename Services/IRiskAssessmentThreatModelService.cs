using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IRiskAssessmentThreatModelService
    {
        /// <summary>
        /// Get all approved threat model templates that can be used in risk assessments
        /// </summary>
        Task<IEnumerable<AttackChain>> GetApprovedTemplatesAsync();

        /// <summary>
        /// Create assessment-specific copies of selected templates
        /// </summary>
        Task<IEnumerable<RiskAssessmentThreatModel>> CreateThreatModelCopiesAsync(int riskAssessmentId, IEnumerable<int> templateIds, string userId);

        /// <summary>
        /// Get all threat models for a specific risk assessment
        /// </summary>
        Task<IEnumerable<RiskAssessmentThreatModel>> GetThreatModelsForAssessmentAsync(int riskAssessmentId);

        /// <summary>
        /// Get all assessment-specific threat models across all risk assessments
        /// </summary>
        Task<IEnumerable<RiskAssessmentThreatModel>> GetAllThreatModelsAsync();

        /// <summary>
        /// Get a specific threat model by ID
        /// </summary>
        Task<RiskAssessmentThreatModel?> GetThreatModelByIdAsync(int threatModelId);

        /// <summary>
        /// Update threat model data (from FlowchartDesigner)
        /// </summary>
        Task<bool> UpdateThreatModelAsync(int threatModelId, string threatEventData, string vulnerabilitiesData, string lossEventData, string userId);

        /// <summary>
        /// Delete a threat model from risk assessment
        /// </summary>
        Task<bool> DeleteThreatModelAsync(int threatModelId, string userId);

        /// <summary>
        /// Calculate ALE for all threat models in an assessment and return summary
        /// </summary>
        Task<decimal> CalculateTotalALEForAssessmentAsync(int riskAssessmentId);
    }
}