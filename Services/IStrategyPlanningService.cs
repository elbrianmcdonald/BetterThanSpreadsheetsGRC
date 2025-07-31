using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IStrategyPlanningService
    {
        // Strategy Plan Management
        Task<IEnumerable<StrategyPlan>> GetAllPlansAsync();
        Task<StrategyPlan?> GetPlanByIdAsync(int id);
        Task<StrategyPlan> CreatePlanAsync(StrategyPlan plan);
        Task<StrategyPlan> UpdatePlanAsync(StrategyPlan plan);
        Task DeletePlanAsync(int id);
        Task<IEnumerable<StrategyPlan>> GetPlansByOrganizationAsync(int organizationId);
        Task<IEnumerable<StrategyPlan>> GetPlansByStatusAsync(StrategyPlanStatus status);

        // Strategy Goal Management
        Task<IEnumerable<StrategyGoal>> GetGoalsByPlanIdAsync(int planId);
        Task<StrategyGoal?> GetGoalByIdAsync(int id);
        Task<StrategyGoal> CreateGoalAsync(StrategyGoal goal);
        Task<StrategyGoal> UpdateGoalAsync(StrategyGoal goal);
        Task DeleteGoalAsync(int id);
        Task<IEnumerable<StrategyGoal>> GetOverdueGoalsAsync();

        // Capability Management
        Task<IEnumerable<CapabilityRequirement>> GetCapabilitiesByGoalIdAsync(int goalId);
        Task<IEnumerable<CapabilityRequirement>> GetCapabilitiesByPlanIdAsync(int planId);
        Task<CapabilityRequirement?> GetCapabilityByIdAsync(int id);
        Task<CapabilityRequirement> CreateCapabilityAsync(CapabilityRequirement capability);
        Task<CapabilityRequirement> CreateCapabilityWithControlsAsync(CapabilityRequirement capability, int[] controlIds);
        Task<CapabilityRequirement> UpdateCapabilityAsync(CapabilityRequirement capability);
        Task DeleteCapabilityAsync(int id);
        Task<IEnumerable<CapabilityRequirement>> GetCapabilitiesByTypeAsync(CapabilityType type);
        Task<IEnumerable<CapabilityRequirement>> GetCapabilitiesByStatusAsync(CapabilityStatus status);

        // Milestone Management
        Task<IEnumerable<ImplementationMilestone>> GetMilestonesByPlanIdAsync(int planId);
        Task<ImplementationMilestone?> GetMilestoneByIdAsync(int id);
        Task<ImplementationMilestone> CreateMilestoneAsync(ImplementationMilestone milestone);
        Task<ImplementationMilestone> UpdateMilestoneAsync(ImplementationMilestone milestone);
        Task DeleteMilestoneAsync(int id);
        Task<IEnumerable<ImplementationMilestone>> GetUpcomingMilestonesAsync(int days = 30);

        // Analytics and Reporting
        Task<decimal> GetPlanProgressPercentageAsync(int planId);
        Task<Dictionary<CapabilityStatus, int>> GetCapabilityStatusBreakdownAsync(int planId);
        Task<Dictionary<CapabilityType, int>> GetCapabilityTypeBreakdownAsync(int planId);
        Task<decimal> GetTotalPlanBudgetUsageAsync(int planId);
        Task<IEnumerable<CapabilityRequirement>> GetOverdueCapabilitiesAsync();
        Task<Dictionary<string, object>> GetPlanDashboardDataAsync(int planId);

        // Import/Export
        Task<StrategyPlan> ImportFromMaturityAssessmentAsync(int assessmentId, StrategyPlan plan);
        Task<IEnumerable<CapabilityRequirement>> GetCapabilityTemplatesAsync(CapabilityType? type = null);

        // Validation
        Task<bool> ValidatePlanDatesAsync(StrategyPlan plan);
        Task<List<string>> ValidateGoalConsistencyAsync(StrategyGoal goal);
        Task<bool> CheckCapabilityDependenciesAsync(int capabilityId);
    }
}