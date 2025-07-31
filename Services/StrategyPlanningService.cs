using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class StrategyPlanningService : IStrategyPlanningService
    {
        private readonly CyberRiskContext _context;

        public StrategyPlanningService(CyberRiskContext context)
        {
            _context = context;
        }

        // Strategy Plan Management
        public async Task<IEnumerable<StrategyPlan>> GetAllPlansAsync()
        {
            return await _context.StrategyPlans
                .Include(sp => sp.Organization)
                .Include(sp => sp.Goals)
                    .ThenInclude(g => g.Capabilities)
                .Include(sp => sp.Milestones)
                .OrderByDescending(sp => sp.CreatedAt)
                .ToListAsync();
        }

        public async Task<StrategyPlan?> GetPlanByIdAsync(int id)
        {
            return await _context.StrategyPlans
                .Include(sp => sp.Organization)
                .Include(sp => sp.Goals)
                    .ThenInclude(g => g.MaturityFramework)
                .Include(sp => sp.Goals)
                    .ThenInclude(g => g.Capabilities)
                .Include(sp => sp.Milestones)
                .FirstOrDefaultAsync(sp => sp.Id == id);
        }

        public async Task<StrategyPlan> CreatePlanAsync(StrategyPlan plan)
        {
            plan.CreatedAt = DateTime.UtcNow;
            plan.UpdatedAt = DateTime.UtcNow;
            
            _context.StrategyPlans.Add(plan);
            await _context.SaveChangesAsync();
            return plan;
        }

        public async Task<StrategyPlan> UpdatePlanAsync(StrategyPlan plan)
        {
            plan.UpdatedAt = DateTime.UtcNow;
            _context.StrategyPlans.Update(plan);
            await _context.SaveChangesAsync();
            return plan;
        }

        public async Task DeletePlanAsync(int id)
        {
            var plan = await _context.StrategyPlans.FindAsync(id);
            if (plan != null)
            {
                _context.StrategyPlans.Remove(plan);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<StrategyPlan>> GetPlansByOrganizationAsync(int organizationId)
        {
            return await _context.StrategyPlans
                .Include(sp => sp.Organization)
                .Include(sp => sp.Goals)
                .Where(sp => sp.BusinessOrganizationId == organizationId)
                .OrderByDescending(sp => sp.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<StrategyPlan>> GetPlansByStatusAsync(StrategyPlanStatus status)
        {
            return await _context.StrategyPlans
                .Include(sp => sp.Organization)
                .Include(sp => sp.Goals)
                .Where(sp => sp.Status == status)
                .OrderByDescending(sp => sp.CreatedAt)
                .ToListAsync();
        }

        // Strategy Goal Management
        public async Task<IEnumerable<StrategyGoal>> GetGoalsByPlanIdAsync(int planId)
        {
            return await _context.StrategyGoals
                .Include(sg => sg.MaturityFramework)
                .Include(sg => sg.Capabilities)
                .Where(sg => sg.StrategyPlanId == planId)
                .OrderBy(sg => sg.FunctionDomain)
                .ThenBy(sg => sg.TargetDate)
                .ToListAsync();
        }

        public async Task<StrategyGoal?> GetGoalByIdAsync(int id)
        {
            return await _context.StrategyGoals
                .Include(sg => sg.StrategyPlan)
                .Include(sg => sg.MaturityFramework)
                .Include(sg => sg.Capabilities)
                .FirstOrDefaultAsync(sg => sg.Id == id);
        }

        public async Task<StrategyGoal> CreateGoalAsync(StrategyGoal goal)
        {
            goal.CreatedAt = DateTime.UtcNow;
            goal.UpdatedAt = DateTime.UtcNow;
            
            _context.StrategyGoals.Add(goal);
            await _context.SaveChangesAsync();
            return goal;
        }

        public async Task<StrategyGoal> UpdateGoalAsync(StrategyGoal goal)
        {
            goal.UpdatedAt = DateTime.UtcNow;
            _context.StrategyGoals.Update(goal);
            await _context.SaveChangesAsync();
            return goal;
        }

        public async Task DeleteGoalAsync(int id)
        {
            var goal = await _context.StrategyGoals.FindAsync(id);
            if (goal != null)
            {
                _context.StrategyGoals.Remove(goal);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<StrategyGoal>> GetOverdueGoalsAsync()
        {
            return await _context.StrategyGoals
                .Include(sg => sg.StrategyPlan)
                .Include(sg => sg.MaturityFramework)
                .Where(sg => sg.TargetDate < DateTime.UtcNow && sg.Status != GoalStatus.Completed)
                .OrderBy(sg => sg.TargetDate)
                .ToListAsync();
        }

        // Capability Management
        public async Task<IEnumerable<CapabilityRequirement>> GetCapabilitiesByGoalIdAsync(int goalId)
        {
            return await _context.CapabilityRequirements
                .Include(cr => cr.StrategyGoal)
                .Where(cr => cr.StrategyGoalId == goalId)
                .OrderBy(cr => cr.Priority)
                .ThenBy(cr => cr.TargetDate)
                .ToListAsync();
        }

        public async Task<IEnumerable<CapabilityRequirement>> GetCapabilitiesByPlanIdAsync(int planId)
        {
            return await _context.CapabilityRequirements
                .Include(cr => cr.StrategyGoal)
                    .ThenInclude(sg => sg.StrategyPlan)
                .Where(cr => cr.StrategyGoal.StrategyPlanId == planId)
                .OrderBy(cr => cr.Priority)
                .ThenBy(cr => cr.TargetDate)
                .ToListAsync();
        }

        public async Task<CapabilityRequirement?> GetCapabilityByIdAsync(int id)
        {
            return await _context.CapabilityRequirements
                .Include(cr => cr.StrategyGoal)
                    .ThenInclude(sg => sg.StrategyPlan)
                .Include(cr => cr.ControlMappings)
                    .ThenInclude(ccm => ccm.ComplianceControl)
                        .ThenInclude(cc => cc.Framework)
                .FirstOrDefaultAsync(cr => cr.Id == id);
        }

        public async Task<CapabilityRequirement> CreateCapabilityAsync(CapabilityRequirement capability)
        {
            capability.CreatedAt = DateTime.UtcNow;
            capability.UpdatedAt = DateTime.UtcNow;
            
            _context.CapabilityRequirements.Add(capability);
            await _context.SaveChangesAsync();
            return capability;
        }

        public async Task<CapabilityRequirement> CreateCapabilityWithControlsAsync(CapabilityRequirement capability, int[] controlIds)
        {
            capability.CreatedAt = DateTime.UtcNow;
            capability.UpdatedAt = DateTime.UtcNow;
            
            _context.CapabilityRequirements.Add(capability);
            await _context.SaveChangesAsync();
            
            // Create control mappings if control IDs were provided
            if (controlIds != null && controlIds.Length > 0)
            {
                var mappings = controlIds.Select(controlId => new CapabilityControlMapping
                {
                    CapabilityRequirementId = capability.Id,
                    ComplianceControlId = controlId,
                    Status = CapabilityControlStatus.Planned,
                    Priority = MappingPriority.Medium,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }).ToList();
                
                _context.CapabilityControlMappings.AddRange(mappings);
                await _context.SaveChangesAsync();
            }
            
            return capability;
        }

        public async Task<CapabilityRequirement> UpdateCapabilityAsync(CapabilityRequirement capability)
        {
            capability.UpdatedAt = DateTime.UtcNow;
            
            // Auto-set completion date when status changes to completed
            if (capability.Status == CapabilityStatus.Completed && !capability.CompletionDate.HasValue)
            {
                capability.CompletionDate = DateTime.UtcNow;
                capability.ProgressPercentage = 100;
            }
            
            _context.CapabilityRequirements.Update(capability);
            await _context.SaveChangesAsync();
            return capability;
        }

        public async Task DeleteCapabilityAsync(int id)
        {
            var capability = await _context.CapabilityRequirements.FindAsync(id);
            if (capability != null)
            {
                _context.CapabilityRequirements.Remove(capability);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<CapabilityRequirement>> GetCapabilitiesByTypeAsync(CapabilityType type)
        {
            return await _context.CapabilityRequirements
                .Include(cr => cr.StrategyGoal)
                .Where(cr => cr.CapabilityType == type)
                .OrderBy(cr => cr.Priority)
                .ToListAsync();
        }

        public async Task<IEnumerable<CapabilityRequirement>> GetCapabilitiesByStatusAsync(CapabilityStatus status)
        {
            return await _context.CapabilityRequirements
                .Include(cr => cr.StrategyGoal)
                .Where(cr => cr.Status == status)
                .OrderBy(cr => cr.TargetDate)
                .ToListAsync();
        }

        // Milestone Management
        public async Task<IEnumerable<ImplementationMilestone>> GetMilestonesByPlanIdAsync(int planId)
        {
            return await _context.ImplementationMilestones
                .Where(im => im.StrategyPlanId == planId)
                .OrderBy(im => im.SortOrder)
                .ThenBy(im => im.TargetDate)
                .ToListAsync();
        }

        public async Task<ImplementationMilestone?> GetMilestoneByIdAsync(int id)
        {
            return await _context.ImplementationMilestones
                .Include(im => im.StrategyPlan)
                .FirstOrDefaultAsync(im => im.Id == id);
        }

        public async Task<ImplementationMilestone> CreateMilestoneAsync(ImplementationMilestone milestone)
        {
            milestone.CreatedAt = DateTime.UtcNow;
            milestone.UpdatedAt = DateTime.UtcNow;
            
            _context.ImplementationMilestones.Add(milestone);
            await _context.SaveChangesAsync();
            return milestone;
        }

        public async Task<ImplementationMilestone> UpdateMilestoneAsync(ImplementationMilestone milestone)
        {
            milestone.UpdatedAt = DateTime.UtcNow;
            
            // Auto-set completion date when status changes to completed
            if (milestone.Status == MilestoneStatus.Completed && !milestone.CompletionDate.HasValue)
            {
                milestone.CompletionDate = DateTime.UtcNow;
            }
            
            _context.ImplementationMilestones.Update(milestone);
            await _context.SaveChangesAsync();
            return milestone;
        }

        public async Task DeleteMilestoneAsync(int id)
        {
            var milestone = await _context.ImplementationMilestones.FindAsync(id);
            if (milestone != null)
            {
                _context.ImplementationMilestones.Remove(milestone);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<ImplementationMilestone>> GetUpcomingMilestonesAsync(int days = 30)
        {
            var cutoffDate = DateTime.UtcNow.AddDays(days);
            return await _context.ImplementationMilestones
                .Include(im => im.StrategyPlan)
                .Where(im => im.TargetDate <= cutoffDate && 
                            im.Status != MilestoneStatus.Completed)
                .OrderBy(im => im.TargetDate)
                .ToListAsync();
        }

        // Analytics and Reporting
        public async Task<decimal> GetPlanProgressPercentageAsync(int planId)
        {
            var capabilities = await GetCapabilitiesByPlanIdAsync(planId);
            if (!capabilities.Any()) return 0;
            
            var totalCapabilities = capabilities.Count();
            var completedCapabilities = capabilities.Count(c => c.Status == CapabilityStatus.Completed);
            
            return totalCapabilities > 0 ? (decimal)completedCapabilities / totalCapabilities * 100 : 0;
        }

        public async Task<Dictionary<CapabilityStatus, int>> GetCapabilityStatusBreakdownAsync(int planId)
        {
            var capabilities = await GetCapabilitiesByPlanIdAsync(planId);
            return capabilities.GroupBy(c => c.Status)
                             .ToDictionary(g => g.Key, g => g.Count());
        }

        public async Task<Dictionary<CapabilityType, int>> GetCapabilityTypeBreakdownAsync(int planId)
        {
            var capabilities = await GetCapabilitiesByPlanIdAsync(planId);
            return capabilities.GroupBy(c => c.CapabilityType)
                             .ToDictionary(g => g.Key, g => g.Count());
        }

        public async Task<decimal> GetTotalPlanBudgetUsageAsync(int planId)
        {
            var plan = await GetPlanByIdAsync(planId);
            if (plan?.TotalBudget == null || plan.TotalBudget == 0) return 0;
            
            return (plan.SpentBudget ?? 0) / plan.TotalBudget.Value * 100;
        }

        public async Task<IEnumerable<CapabilityRequirement>> GetOverdueCapabilitiesAsync()
        {
            return await _context.CapabilityRequirements
                .Include(cr => cr.StrategyGoal)
                    .ThenInclude(sg => sg.StrategyPlan)
                .Where(cr => cr.TargetDate.HasValue && 
                            cr.TargetDate.Value < DateTime.UtcNow && 
                            cr.Status != CapabilityStatus.Completed)
                .OrderBy(cr => cr.TargetDate)
                .ToListAsync();
        }

        public async Task<Dictionary<string, object>> GetPlanDashboardDataAsync(int planId)
        {
            var plan = await GetPlanByIdAsync(planId);
            if (plan == null) return new Dictionary<string, object>();
            
            var capabilities = await GetCapabilitiesByPlanIdAsync(planId);
            var milestones = await GetMilestonesByPlanIdAsync(planId);
            
            return new Dictionary<string, object>
            {
                ["TotalGoals"] = plan.Goals.Count,
                ["CompletedGoals"] = plan.Goals.Count(g => g.Status == GoalStatus.Completed),
                ["TotalCapabilities"] = capabilities.Count(),
                ["CompletedCapabilities"] = capabilities.Count(c => c.Status == CapabilityStatus.Completed),
                ["InProgressCapabilities"] = capabilities.Count(c => c.Status == CapabilityStatus.InProgress),
                ["TotalMilestones"] = milestones.Count(),
                ["CompletedMilestones"] = milestones.Count(m => m.Status == MilestoneStatus.Completed),
                ["OverallProgress"] = plan.OverallProgressPercentage,
                ["BudgetUsage"] = await GetTotalPlanBudgetUsageAsync(planId),
                ["DaysRemaining"] = plan.DaysRemaining,
                ["OverdueCapabilities"] = capabilities.Count(c => c.IsOverdue)
            };
        }

        // Import/Export
        public async Task<StrategyPlan> ImportFromMaturityAssessmentAsync(int assessmentId, StrategyPlan plan)
        {
            var assessment = await _context.MaturityAssessments
                .Include(ma => ma.Framework)
                .Include(ma => ma.ControlAssessments)
                    .ThenInclude(ca => ca.Control)
                .FirstOrDefaultAsync(ma => ma.Id == assessmentId);
            
            if (assessment == null) 
                throw new ArgumentException("Assessment not found");

            // Create the plan first
            var createdPlan = await CreatePlanAsync(plan);
            
            // Group controls by function/domain and create goals
            var functionGroups = assessment.ControlAssessments
                .GroupBy(ca => ca.Control.Function ?? "General")
                .ToList();
            
            foreach (var functionGroup in functionGroups)
            {
                var currentLevel = functionGroup.Min(ca => (int)ca.CurrentMaturityLevel);
                var targetLevel = Math.Min(currentLevel + 1, 4); // Increment by 1, max 4
                
                var goal = new StrategyGoal
                {
                    StrategyPlanId = createdPlan.Id,
                    MaturityFrameworkId = assessment.MaturityFrameworkId,
                    FunctionDomain = functionGroup.Key,
                    CurrentMaturityLevel = currentLevel,
                    TargetMaturityLevel = targetLevel,
                    TargetDate = plan.EndDate.AddMonths(-3), // Target 3 months before plan end
                    Priority = currentLevel <= 1 ? GoalPriority.Critical : GoalPriority.High,
                    Status = GoalStatus.Planned
                };
                
                await CreateGoalAsync(goal);
            }
            
            return createdPlan;
        }

        public async Task<IEnumerable<CapabilityRequirement>> GetCapabilityTemplatesAsync(CapabilityType? type = null)
        {
            // Return predefined capability templates
            var templates = new List<CapabilityRequirement>
            {
                // Process templates
                new() { CapabilityName = "Risk Management Process Enhancement", CapabilityType = CapabilityType.Process, EstimatedEffortMonths = 3, EstimatedCost = 25000 },
                new() { CapabilityName = "Incident Response Procedure Update", CapabilityType = CapabilityType.Process, EstimatedEffortMonths = 2, EstimatedCost = 15000 },
                new() { CapabilityName = "Business Continuity Planning", CapabilityType = CapabilityType.Process, EstimatedEffortMonths = 4, EstimatedCost = 35000 },
                
                // Technology templates
                new() { CapabilityName = "SIEM System Implementation", CapabilityType = CapabilityType.Technology, EstimatedEffortMonths = 6, EstimatedCost = 150000 },
                new() { CapabilityName = "Identity and Access Management System", CapabilityType = CapabilityType.Technology, EstimatedEffortMonths = 8, EstimatedCost = 200000 },
                new() { CapabilityName = "Endpoint Detection and Response", CapabilityType = CapabilityType.Technology, EstimatedEffortMonths = 4, EstimatedCost = 100000 },
                
                // People templates
                new() { CapabilityName = "Cybersecurity Awareness Training Program", CapabilityType = CapabilityType.People, EstimatedEffortMonths = 2, EstimatedCost = 20000 },
                new() { CapabilityName = "Security Operations Center Staffing", CapabilityType = CapabilityType.People, EstimatedEffortMonths = 6, EstimatedCost = 300000 },
                
                // Governance templates
                new() { CapabilityName = "Information Security Policy Framework", CapabilityType = CapabilityType.Governance, EstimatedEffortMonths = 3, EstimatedCost = 30000 },
                new() { CapabilityName = "Third-Party Risk Management Program", CapabilityType = CapabilityType.Governance, EstimatedEffortMonths = 4, EstimatedCost = 40000 }
            };
            
            return type.HasValue 
                ? templates.Where(t => t.CapabilityType == type.Value)
                : templates;
        }

        // Validation
        public async Task<bool> ValidatePlanDatesAsync(StrategyPlan plan)
        {
            if (plan.StartDate >= plan.EndDate) return false;
            if (plan.StartDate < DateTime.UtcNow.Date.AddDays(-30)) return false; // Can't start more than 30 days in the past
            return true;
        }

        public async Task<List<string>> ValidateGoalConsistencyAsync(StrategyGoal goal)
        {
            var errors = new List<string>();
            
            if (goal.CurrentMaturityLevel >= goal.TargetMaturityLevel)
                errors.Add("Target maturity level must be higher than current level");
            
            if (goal.TargetDate <= DateTime.UtcNow.Date)
                errors.Add("Target date must be in the future");
            
            var plan = await GetPlanByIdAsync(goal.StrategyPlanId);
            if (plan != null && goal.TargetDate > plan.EndDate)
                errors.Add("Goal target date cannot be beyond strategy plan end date");
            
            return errors;
        }

        public async Task<bool> CheckCapabilityDependenciesAsync(int capabilityId)
        {
            var capability = await GetCapabilityByIdAsync(capabilityId);
            if (capability == null || string.IsNullOrEmpty(capability.Dependencies))
                return true;
            
            // Parse dependencies and check if they're completed
            var dependencyNames = capability.Dependencies.Split(',', StringSplitOptions.RemoveEmptyEntries);
            var goalCapabilities = await GetCapabilitiesByGoalIdAsync(capability.StrategyGoalId);
            
            foreach (var depName in dependencyNames)
            {
                var dependency = goalCapabilities.FirstOrDefault(c => 
                    c.CapabilityName.Contains(depName.Trim(), StringComparison.OrdinalIgnoreCase));
                
                if (dependency != null && dependency.Status != CapabilityStatus.Completed)
                    return false;
            }
            
            return true;
        }
    }
}