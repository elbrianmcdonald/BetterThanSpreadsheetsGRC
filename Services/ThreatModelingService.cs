using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class ThreatModelingService : IThreatModelingService
    {
        private readonly CyberRiskContext _context;

        public ThreatModelingService(CyberRiskContext context)
        {
            _context = context;
        }

        // ThreatModel methods
        public async Task<IEnumerable<ThreatModel>> GetAllThreatModelsAsync()
        {
            return await _context.ThreatModels
                .Include(tm => tm.Attacks)
                .Include(tm => tm.LinkedRiskAssessment)
                .OrderByDescending(tm => tm.CreatedAt)
                .ToListAsync();
        }

        public async Task<ThreatModel?> GetThreatModelByIdAsync(int id)
        {
            return await _context.ThreatModels
                .Include(tm => tm.Attacks)
                .Include(tm => tm.LinkedRiskAssessment)
                .FirstOrDefaultAsync(tm => tm.Id == id);
        }

        public async Task<ThreatModel> CreateThreatModelAsync(ThreatModel threatModel)
        {
            threatModel.CreatedAt = DateTime.UtcNow;
            threatModel.UpdatedAt = DateTime.UtcNow;
            
            _context.ThreatModels.Add(threatModel);
            await _context.SaveChangesAsync();
            return threatModel;
        }

        public async Task<ThreatModel> UpdateThreatModelAsync(ThreatModel threatModel)
        {
            threatModel.UpdatedAt = DateTime.UtcNow;
            
            _context.ThreatModels.Update(threatModel);
            await _context.SaveChangesAsync();
            return threatModel;
        }

        public async Task<bool> DeleteThreatModelAsync(int id)
        {
            try
            {
                var threatModel = await _context.ThreatModels.FindAsync(id);
                if (threatModel == null)
                    return false;

                _context.ThreatModels.Remove(threatModel);
                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<IEnumerable<ThreatModel>> GetThreatModelsByStatusAsync(ThreatModelStatus status)
        {
            return await _context.ThreatModels
                .Include(tm => tm.Attacks)
                .Where(tm => tm.Status == status)
                .OrderByDescending(tm => tm.UpdatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<ThreatModel>> GetThreatModelsByAssetAsync(string asset)
        {
            return await _context.ThreatModels
                .Include(tm => tm.Attacks)
                .Where(tm => tm.Asset.Contains(asset))
                .OrderByDescending(tm => tm.UpdatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<ThreatModel>> GetThreatModelsByBusinessUnitAsync(string businessUnit)
        {
            return await _context.ThreatModels
                .Include(tm => tm.Attacks)
                .Where(tm => tm.BusinessUnit == businessUnit)
                .OrderByDescending(tm => tm.UpdatedAt)
                .ToListAsync();
        }

        // Attack methods
        public async Task<IEnumerable<Attack>> GetAllAttacksAsync()
        {
            return await _context.Attacks
                .Include(a => a.ThreatModel)
                .Include(a => a.LinkedFinding)
                .Include(a => a.LinkedRisk)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();
        }

        public async Task<Attack?> GetAttackByIdAsync(int id)
        {
            return await _context.Attacks
                .Include(a => a.ThreatModel)
                .Include(a => a.LinkedFinding)
                .Include(a => a.LinkedRisk)
                .FirstOrDefaultAsync(a => a.Id == id);
        }

        public async Task<IEnumerable<Attack>> GetAttacksByThreatModelIdAsync(int threatModelId)
        {
            return await _context.Attacks
                .Include(a => a.LinkedFinding)
                .Include(a => a.LinkedRisk)
                .Where(a => a.ThreatModelId == threatModelId)
                .OrderBy(a => (int)a.KillChainPhase)
                .ToListAsync();
        }

        public async Task<IEnumerable<Attack>> GetAttacksByKillChainPhaseAsync(CyberKillChainPhase phase)
        {
            return await _context.Attacks
                .Include(a => a.ThreatModel)
                .Where(a => a.KillChainPhase == phase)
                .OrderByDescending(a => a.RiskLevel)
                .ToListAsync();
        }

        public async Task<IEnumerable<Attack>> GetAttacksByRiskLevelAsync(RiskLevel riskLevel)
        {
            return await _context.Attacks
                .Include(a => a.ThreatModel)
                .Where(a => a.RiskLevel == riskLevel)
                .OrderBy(a => (int)a.KillChainPhase)
                .ToListAsync();
        }

        public async Task<IEnumerable<Attack>> GetAttacksByThreatActorTypeAsync(ThreatActorType actorType)
        {
            return await _context.Attacks
                .Include(a => a.ThreatModel)
                .Where(a => a.ThreatActorType == actorType)
                .OrderByDescending(a => a.RiskLevel)
                .ToListAsync();
        }

        public async Task<Attack> CreateAttackAsync(Attack attack)
        {
            attack.CreatedAt = DateTime.UtcNow;
            attack.UpdatedAt = DateTime.UtcNow;
            
            _context.Attacks.Add(attack);
            await _context.SaveChangesAsync();
            return attack;
        }

        public async Task<Attack> UpdateAttackAsync(Attack attack)
        {
            attack.UpdatedAt = DateTime.UtcNow;
            
            _context.Attacks.Update(attack);
            await _context.SaveChangesAsync();
            return attack;
        }

        public async Task<bool> DeleteAttackAsync(int id)
        {
            try
            {
                var attack = await _context.Attacks.FindAsync(id);
                if (attack == null)
                    return false;

                _context.Attacks.Remove(attack);
                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        // Analytics and reporting methods
        public async Task<Dictionary<CyberKillChainPhase, int>> GetAttackCountByKillChainPhaseAsync(int? threatModelId = null)
        {
            var query = _context.Attacks.AsQueryable();
            
            if (threatModelId.HasValue)
                query = query.Where(a => a.ThreatModelId == threatModelId.Value);

            return await query
                .GroupBy(a => a.KillChainPhase)
                .Select(g => new { Phase = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Phase, x => x.Count);
        }

        public async Task<Dictionary<RiskLevel, int>> GetAttackCountByRiskLevelAsync(int? threatModelId = null)
        {
            var query = _context.Attacks.AsQueryable();
            
            if (threatModelId.HasValue)
                query = query.Where(a => a.ThreatModelId == threatModelId.Value);

            return await query
                .GroupBy(a => a.RiskLevel)
                .Select(g => new { RiskLevel = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.RiskLevel, x => x.Count);
        }

        public async Task<Dictionary<ThreatActorType, int>> GetAttackCountByThreatActorAsync(int? threatModelId = null)
        {
            var query = _context.Attacks.AsQueryable();
            
            if (threatModelId.HasValue)
                query = query.Where(a => a.ThreatModelId == threatModelId.Value);

            return await query
                .GroupBy(a => a.ThreatActorType)
                .Select(g => new { ActorType = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.ActorType, x => x.Count);
        }

        public async Task<Dictionary<AttackVector, int>> GetAttackCountByVectorAsync(int? threatModelId = null)
        {
            var query = _context.Attacks.AsQueryable();
            
            if (threatModelId.HasValue)
                query = query.Where(a => a.ThreatModelId == threatModelId.Value);

            return await query
                .GroupBy(a => a.AttackVector)
                .Select(g => new { Vector = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Vector, x => x.Count);
        }

        public async Task<IEnumerable<Attack>> GetHighRiskAttacksAsync()
        {
            return await _context.Attacks
                .Include(a => a.ThreatModel)
                .Where(a => a.RiskLevel == RiskLevel.High || a.RiskLevel == RiskLevel.Critical)
                .OrderByDescending(a => a.RiskLevel)
                .ThenBy(a => (int)a.KillChainPhase)
                .ToListAsync();
        }

        public async Task<IEnumerable<ThreatModel>> GetActiveThreatModelsAsync()
        {
            return await _context.ThreatModels
                .Include(tm => tm.Attacks)
                .Where(tm => tm.Status == ThreatModelStatus.Active || tm.Status == ThreatModelStatus.Approved)
                .OrderByDescending(tm => tm.UpdatedAt)
                .ToListAsync();
        }

        // Integration methods
        public async Task<IEnumerable<RiskAssessment>> GetAvailableRiskAssessmentsAsync()
        {
            return await _context.RiskAssessments
                .Where(ra => ra.Status == AssessmentStatus.Completed || ra.Status == AssessmentStatus.Approved)
                .OrderByDescending(ra => ra.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Finding>> GetAvailableFindingsAsync()
        {
            return await _context.Findings
                .Where(f => f.Status == FindingStatus.Open)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<Risk>> GetAvailableRisksAsync()
        {
            return await _context.Risks
                .Where(r => r.Status == RiskStatus.Open || r.Status == RiskStatus.UnderReview)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<bool> LinkAttackToFindingAsync(int attackId, int findingId)
        {
            try
            {
                var attack = await _context.Attacks.FindAsync(attackId);
                if (attack == null)
                    return false;

                attack.FindingId = findingId;
                attack.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<bool> LinkAttackToRiskAsync(int attackId, int riskId)
        {
            try
            {
                var attack = await _context.Attacks.FindAsync(attackId);
                if (attack == null)
                    return false;

                attack.RiskId = riskId;
                attack.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<bool> LinkThreatModelToRiskAssessmentAsync(int threatModelId, int riskAssessmentId)
        {
            try
            {
                var threatModel = await _context.ThreatModels.FindAsync(threatModelId);
                if (threatModel == null)
                    return false;

                threatModel.RiskAssessmentId = riskAssessmentId;
                threatModel.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        // Bulk operations
        public async Task<IEnumerable<Attack>> CreateBulkAttacksAsync(IEnumerable<Attack> attacks)
        {
            var attackList = attacks.ToList();
            var now = DateTime.UtcNow;

            foreach (var attack in attackList)
            {
                attack.CreatedAt = now;
                attack.UpdatedAt = now;
            }

            _context.Attacks.AddRange(attackList);
            await _context.SaveChangesAsync();
            return attackList;
        }

        public async Task<bool> UpdateThreatModelStatusAsync(int threatModelId, ThreatModelStatus status, string? notes = null)
        {
            try
            {
                var threatModel = await _context.ThreatModels.FindAsync(threatModelId);
                if (threatModel == null)
                    return false;

                threatModel.Status = status;
                threatModel.UpdatedAt = DateTime.UtcNow;
                
                if (!string.IsNullOrEmpty(notes))
                    threatModel.ReviewNotes = notes;

                if (status == ThreatModelStatus.Approved)
                    threatModel.ApprovedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<IEnumerable<Attack>> GetAttacksRequiringMitigationAsync()
        {
            return await _context.Attacks
                .Include(a => a.ThreatModel)
                .Where(a => (a.RiskLevel == RiskLevel.High || a.RiskLevel == RiskLevel.Critical) &&
                           a.TreatmentStrategy == TreatmentStrategy.Mitigate &&
                           string.IsNullOrEmpty(a.RecommendedMitigations))
                .OrderByDescending(a => a.RiskLevel)
                .ThenBy(a => (int)a.KillChainPhase)
                .ToListAsync();
        }

        // Environment management - REMOVED (environments no longer used in threat modeling)

        // MITRE ATT&CK techniques
        public async Task<IEnumerable<MitreTechnique>> GetAllMitreTechniquesAsync()
        {
            return await _context.MitreTechniques
                .Where(t => !t.IsDeprecated)
                .OrderBy(t => t.Tactic)
                .ThenBy(t => t.TechniqueId)
                .ToListAsync();
        }

        public async Task<IEnumerable<MitreTechnique>> GetMitreTechniquesByTacticAsync(string tactic)
        {
            return await _context.MitreTechniques
                .Where(t => t.Tactic == tactic && !t.IsDeprecated)
                .OrderBy(t => t.TechniqueId)
                .ToListAsync();
        }

        public async Task<MitreTechnique?> GetMitreTechniqueByIdAsync(int id)
        {
            return await _context.MitreTechniques
                .Include(t => t.SubTechniques)
                .FirstOrDefaultAsync(t => t.Id == id);
        }

        public async Task<MitreTechnique?> GetMitreTechniqueByTechniqueIdAsync(string techniqueId)
        {
            return await _context.MitreTechniques
                .Include(t => t.SubTechniques)
                .FirstOrDefaultAsync(t => t.TechniqueId == techniqueId);
        }

        public async Task<IEnumerable<MitreTechnique>> SearchMitreTechniquesAsync(string searchTerm)
        {
            var lowerSearch = searchTerm.ToLower();
            return await _context.MitreTechniques
                .Where(t => !t.IsDeprecated &&
                           (t.TechniqueId.ToLower().Contains(lowerSearch) ||
                            t.Name.ToLower().Contains(lowerSearch) ||
                            t.Description.ToLower().Contains(lowerSearch) ||
                            t.Tactic.ToLower().Contains(lowerSearch)))
                .OrderBy(t => t.TechniqueId)
                .Take(50)
                .ToListAsync();
        }

        public async Task<bool> ImportMitreTechniquesAsync(IEnumerable<MitreTechnique> techniques)
        {
            try
            {
                foreach (var technique in techniques)
                {
                    technique.CreatedAt = DateTime.UtcNow;
                    technique.UpdatedAt = DateTime.UtcNow;
                    _context.MitreTechniques.Add(technique);
                }

                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        // Technique-Environment mapping - REMOVED (environments no longer used)

        // Kill Chain activities
        public async Task<IEnumerable<KillChainActivity>> GetAllKillChainActivitiesAsync()
        {
            return await _context.KillChainActivities
                .OrderBy(k => k.Phase)
                .ThenBy(k => k.EnvironmentType)
                .ToListAsync();
        }

        public async Task<IEnumerable<KillChainActivity>> GetKillChainActivitiesByPhaseAsync(CyberKillChainPhase phase)
        {
            return await _context.KillChainActivities
                .Where(k => k.Phase == phase)
                .OrderBy(k => k.EnvironmentType)
                .ToListAsync();
        }

        public async Task<IEnumerable<KillChainActivity>> GetKillChainActivitiesByEnvironmentAsync(string environmentType)
        {
            return await _context.KillChainActivities
                .Where(k => k.EnvironmentType == environmentType)
                .OrderBy(k => k.Phase)
                .ToListAsync();
        }

        public async Task<KillChainActivity> CreateKillChainActivityAsync(KillChainActivity activity)
        {
            activity.CreatedAt = DateTime.UtcNow;
            activity.UpdatedAt = DateTime.UtcNow;

            _context.KillChainActivities.Add(activity);
            await _context.SaveChangesAsync();
            return activity;
        }

        public async Task<KillChainActivity> UpdateKillChainActivityAsync(KillChainActivity activity)
        {
            activity.UpdatedAt = DateTime.UtcNow;

            _context.KillChainActivities.Update(activity);
            await _context.SaveChangesAsync();
            return activity;
        }

        public async Task<bool> DeleteKillChainActivityAsync(int id)
        {
            try
            {
                var activity = await _context.KillChainActivities.FindAsync(id);
                if (activity == null)
                    return false;

                _context.KillChainActivities.Remove(activity);
                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        // Attack scenarios
        public async Task<IEnumerable<AttackScenario>> GetAttackScenariosByThreatModelIdAsync(int threatModelId)
        {
            return await _context.AttackScenarios
                .Include(s => s.Steps)
                .Include(s => s.AttackPaths)
                .Include(s => s.Recommendations)
                .Where(s => s.ThreatModelId == threatModelId)
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();
        }

        public async Task<AttackScenario?> GetAttackScenarioByIdAsync(int id)
        {
            return await _context.AttackScenarios
                .Include(s => s.Steps)
                    .ThenInclude(step => step.MitreTechnique)
                .Include(s => s.Steps)
                    .ThenInclude(step => step.KillChainActivity)
                .Include(s => s.AttackPaths)
                .Include(s => s.Recommendations)
                .Include(s => s.MitreTechniques)
                .FirstOrDefaultAsync(s => s.Id == id);
        }

        public async Task<AttackScenario> CreateAttackScenarioAsync(AttackScenario scenario)
        {
            scenario.CreatedAt = DateTime.UtcNow;
            scenario.UpdatedAt = DateTime.UtcNow;

            _context.AttackScenarios.Add(scenario);
            await _context.SaveChangesAsync();
            return scenario;
        }

        public async Task<AttackScenario> UpdateAttackScenarioAsync(AttackScenario scenario)
        {
            scenario.UpdatedAt = DateTime.UtcNow;

            _context.AttackScenarios.Update(scenario);
            await _context.SaveChangesAsync();
            return scenario;
        }

        public async Task<bool> DeleteAttackScenarioAsync(int id)
        {
            try
            {
                var scenario = await _context.AttackScenarios.FindAsync(id);
                if (scenario == null)
                    return false;

                _context.AttackScenarios.Remove(scenario);
                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<AttackScenarioStep> AddScenarioStepAsync(AttackScenarioStep step)
        {
            step.CreatedAt = DateTime.UtcNow;

            _context.AttackScenarioSteps.Add(step);
            await _context.SaveChangesAsync();
            return step;
        }

        public async Task<bool> UpdateScenarioStepAsync(AttackScenarioStep step)
        {
            try
            {
                _context.AttackScenarioSteps.Update(step);
                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<bool> DeleteScenarioStepAsync(int id)
        {
            try
            {
                var step = await _context.AttackScenarioSteps.FindAsync(id);
                if (step == null)
                    return false;

                _context.AttackScenarioSteps.Remove(step);
                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<IEnumerable<AttackPath>> GetAttackPathsForScenarioAsync(int scenarioId)
        {
            return await _context.AttackPaths
                .Where(p => p.AttackScenarioId == scenarioId)
                .ToListAsync();
        }

        public async Task<AttackPath> CreateAttackPathAsync(AttackPath path)
        {
            path.CreatedAt = DateTime.UtcNow;

            _context.AttackPaths.Add(path);
            await _context.SaveChangesAsync();
            return path;
        }

        // Recommendations
        public async Task<IEnumerable<ScenarioRecommendation>> GetRecommendationsByScenarioIdAsync(int scenarioId)
        {
            return await _context.ScenarioRecommendations
                .Where(r => r.AttackScenarioId == scenarioId)
                .OrderBy(r => r.Priority)
                .ThenBy(r => r.Type)
                .ToListAsync();
        }

        public async Task<ScenarioRecommendation> CreateRecommendationAsync(ScenarioRecommendation recommendation)
        {
            recommendation.CreatedAt = DateTime.UtcNow;
            recommendation.UpdatedAt = DateTime.UtcNow;

            _context.ScenarioRecommendations.Add(recommendation);
            await _context.SaveChangesAsync();
            return recommendation;
        }

        public async Task<ScenarioRecommendation> UpdateRecommendationAsync(ScenarioRecommendation recommendation)
        {
            recommendation.UpdatedAt = DateTime.UtcNow;

            _context.ScenarioRecommendations.Update(recommendation);
            await _context.SaveChangesAsync();
            return recommendation;
        }

        public async Task<bool> UpdateRecommendationStatusAsync(int recommendationId, RecommendationStatus status)
        {
            try
            {
                var recommendation = await _context.ScenarioRecommendations.FindAsync(recommendationId);
                if (recommendation == null)
                    return false;

                recommendation.Status = status;
                recommendation.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        // Analytics for enhanced threat modeling

        public async Task<Dictionary<CyberKillChainPhase, List<AttackScenarioStep>>> GetKillChainFlowAsync(int scenarioId)
        {
            var steps = await _context.AttackScenarioSteps
                .Include(s => s.MitreTechnique)
                .Include(s => s.KillChainActivity)
                .Where(s => s.AttackScenarioId == scenarioId)
                .OrderBy(s => s.StepNumber)
                .ToListAsync();

            return steps.GroupBy(s => s.KillChainPhase)
                .ToDictionary(g => g.Key, g => g.ToList());
        }

        public async Task<IEnumerable<AttackPath>> GetCriticalAttackPathsAsync(int threatModelId)
        {
            return await _context.AttackPaths
                .Include(p => p.AttackScenario)
                .Where(p => p.AttackScenario!.ThreatModelId == threatModelId &&
                           (p.Complexity == AttackComplexity.Low || p.Complexity == AttackComplexity.Medium))
                .OrderBy(p => p.Complexity)
                .ThenBy(p => p.EstimatedTimeMinutes)
                .ToListAsync();
        }

    }
}