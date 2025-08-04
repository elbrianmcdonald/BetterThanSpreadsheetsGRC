using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IThreatModelingService
    {
        // ThreatModel methods
        Task<IEnumerable<ThreatModel>> GetAllThreatModelsAsync();
        Task<ThreatModel?> GetThreatModelByIdAsync(int id);
        Task<ThreatModel> CreateThreatModelAsync(ThreatModel threatModel);
        Task<ThreatModel> UpdateThreatModelAsync(ThreatModel threatModel);
        Task<bool> DeleteThreatModelAsync(int id);
        Task<IEnumerable<ThreatModel>> GetThreatModelsByStatusAsync(ThreatModelStatus status);
        Task<IEnumerable<ThreatModel>> GetThreatModelsByAssetAsync(string asset);
        Task<IEnumerable<ThreatModel>> GetThreatModelsByBusinessUnitAsync(string businessUnit);

        // Attack methods
        Task<IEnumerable<Attack>> GetAllAttacksAsync();
        Task<Attack?> GetAttackByIdAsync(int id);
        Task<IEnumerable<Attack>> GetAttacksByThreatModelIdAsync(int threatModelId);
        Task<IEnumerable<Attack>> GetAttacksByKillChainPhaseAsync(CyberKillChainPhase phase);
        Task<IEnumerable<Attack>> GetAttacksByRiskLevelAsync(RiskLevel riskLevel);
        Task<IEnumerable<Attack>> GetAttacksByThreatActorTypeAsync(ThreatActorType actorType);
        Task<Attack> CreateAttackAsync(Attack attack);
        Task<Attack> UpdateAttackAsync(Attack attack);
        Task<bool> DeleteAttackAsync(int id);

        // Analytics and reporting methods
        Task<Dictionary<CyberKillChainPhase, int>> GetAttackCountByKillChainPhaseAsync(int? threatModelId = null);
        Task<Dictionary<RiskLevel, int>> GetAttackCountByRiskLevelAsync(int? threatModelId = null);
        Task<Dictionary<ThreatActorType, int>> GetAttackCountByThreatActorAsync(int? threatModelId = null);
        Task<Dictionary<AttackVector, int>> GetAttackCountByVectorAsync(int? threatModelId = null);
        Task<IEnumerable<Attack>> GetHighRiskAttacksAsync();
        Task<IEnumerable<ThreatModel>> GetActiveThreatModelsAsync();

        // Integration methods
        Task<IEnumerable<RiskAssessment>> GetAvailableRiskAssessmentsAsync();
        Task<IEnumerable<Finding>> GetAvailableFindingsAsync();
        Task<IEnumerable<Risk>> GetAvailableRisksAsync();
        Task<bool> LinkAttackToFindingAsync(int attackId, int findingId);
        Task<bool> LinkAttackToRiskAsync(int attackId, int riskId);
        Task<bool> LinkThreatModelToRiskAssessmentAsync(int threatModelId, int riskAssessmentId);

        // Bulk operations
        Task<IEnumerable<Attack>> CreateBulkAttacksAsync(IEnumerable<Attack> attacks);
        Task<bool> UpdateThreatModelStatusAsync(int threatModelId, ThreatModelStatus status, string? notes = null);
        Task<IEnumerable<Attack>> GetAttacksRequiringMitigationAsync();

        // Environment management - REMOVED (environments no longer used)

        // MITRE ATT&CK techniques
        Task<IEnumerable<MitreTechnique>> GetAllMitreTechniquesAsync();
        Task<IEnumerable<MitreTechnique>> GetMitreTechniquesByTacticAsync(string tactic);
        Task<MitreTechnique?> GetMitreTechniqueByIdAsync(int id);
        Task<MitreTechnique?> GetMitreTechniqueByTechniqueIdAsync(string techniqueId);
        Task<IEnumerable<MitreTechnique>> SearchMitreTechniquesAsync(string searchTerm);
        Task<bool> ImportMitreTechniquesAsync(IEnumerable<MitreTechnique> techniques);

        // Kill Chain activities
        Task<IEnumerable<KillChainActivity>> GetAllKillChainActivitiesAsync();
        Task<IEnumerable<KillChainActivity>> GetKillChainActivitiesByPhaseAsync(CyberKillChainPhase phase);
        Task<IEnumerable<KillChainActivity>> GetKillChainActivitiesByEnvironmentAsync(string environmentType);
        Task<KillChainActivity> CreateKillChainActivityAsync(KillChainActivity activity);
        Task<KillChainActivity> UpdateKillChainActivityAsync(KillChainActivity activity);
        Task<bool> DeleteKillChainActivityAsync(int id);

        // Attack scenarios
        Task<IEnumerable<AttackScenario>> GetAttackScenariosByThreatModelIdAsync(int threatModelId);
        Task<AttackScenario?> GetAttackScenarioByIdAsync(int id);
        Task<AttackScenario> CreateAttackScenarioAsync(AttackScenario scenario);
        Task<AttackScenario> UpdateAttackScenarioAsync(AttackScenario scenario);
        Task<bool> DeleteAttackScenarioAsync(int id);
        Task<AttackScenarioStep> AddScenarioStepAsync(AttackScenarioStep step);
        Task<bool> UpdateScenarioStepAsync(AttackScenarioStep step);
        Task<bool> DeleteScenarioStepAsync(int id);
        Task<IEnumerable<AttackPath>> GetAttackPathsForScenarioAsync(int scenarioId);
        Task<AttackPath> CreateAttackPathAsync(AttackPath path);

        // Recommendations
        Task<IEnumerable<ScenarioRecommendation>> GetRecommendationsByScenarioIdAsync(int scenarioId);
        Task<ScenarioRecommendation> CreateRecommendationAsync(ScenarioRecommendation recommendation);
        Task<ScenarioRecommendation> UpdateRecommendationAsync(ScenarioRecommendation recommendation);
        Task<bool> UpdateRecommendationStatusAsync(int recommendationId, RecommendationStatus status);

        // Analytics for enhanced threat modeling
        Task<Dictionary<CyberKillChainPhase, List<AttackScenarioStep>>> GetKillChainFlowAsync(int scenarioId);
        Task<IEnumerable<AttackPath>> GetCriticalAttackPathsAsync(int threatModelId);
    }
}