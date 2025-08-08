using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CyberRiskApp.Services
{
    public class RiskAssessmentService : IRiskAssessmentService
    {
        private readonly CyberRiskContext _context;
        private readonly IRiskLevelSettingsService _settingsService;
        private readonly IRiskService _riskService;
        private readonly ILogger<RiskAssessmentService> _logger;
        private readonly IAuditService _auditService;

        public RiskAssessmentService(CyberRiskContext context, IRiskLevelSettingsService settingsService, 
            IRiskService riskService, ILogger<RiskAssessmentService> logger,
            IAuditService auditService)
        {
            _context = context;
            _settingsService = settingsService;
            _riskService = riskService;
            _logger = logger;
            _auditService = auditService;
        }

        public async Task<IEnumerable<RiskAssessment>> GetAllAssessmentsAsync()
        {
            try
            {
                return await _context.RiskAssessments
                    .Include(a => a.IdentifiedRisks)
                    .OrderByDescending(a => a.DateCompleted)
                    .ToListAsync();
            }
            catch
            {
                return new List<RiskAssessment>();
            }
        }

        public async Task<RiskAssessment?> GetAssessmentByIdAsync(int id)
        {
            try
            {
                var assessment = await _context.RiskAssessments
                    .Include(a => a.IdentifiedRisks)
                    .Include(a => a.QualitativeControls)
                    .Include(a => a.LinkedThreatModels)
                    .Include(a => a.ThreatModels)
                        .ThenInclude(tm => tm.TemplateAttackChain)
                    .Include(a => a.ThreatScenarios)
                        .ThenInclude(ts => ts.IdentifiedRisks)
                    .FirstOrDefaultAsync(a => a.Id == id);

                return assessment;
            }
            catch
            {
                return null;
            }
        }

        public async Task<RiskAssessment> CreateAssessmentAsync(RiskAssessment assessment)
        {
            try
            {
                // Only qualitative assessments supported - calculate results
                if (assessment.AssessmentType == AssessmentType.Qualitative)
                {
                    assessment = CalculateQualitativeResults(assessment);
                }

                // Set audit fields using AuditService
                _auditService.SetAuditFields(assessment, _auditService.GetCurrentUser());

                assessment.DateCompleted = DateTime.Today;
                assessment.Status = AssessmentStatus.Completed;

                _context.RiskAssessments.Add(assessment);
                await _context.SaveChangesAsync();

                return assessment;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                if (await _auditService.HandleConcurrencyException(ex, assessment))
                {
                    await _context.SaveChangesAsync();
                    return assessment;
                }
                throw;
            }
        }

        public async Task<RiskAssessment> UpdateAssessmentAsync(RiskAssessment assessment)
        {
            try
            {
                // Find the existing tracked entity
                var existingEntity = _context.RiskAssessments.Local
                    .FirstOrDefault(e => e.Id == assessment.Id);

                if (existingEntity != null)
                {
                    // Update the existing tracked entity with values from the incoming assessment
                    _context.Entry(existingEntity).CurrentValues.SetValues(assessment);
                    
                    // Only qualitative assessments supported - calculate results
                    if (existingEntity.AssessmentType == AssessmentType.Qualitative)
                    {
                        existingEntity = CalculateQualitativeResults(existingEntity);
                    }

                    // Set audit fields for update
                    _auditService.SetAuditFields(existingEntity, _auditService.GetCurrentUser(), true);
                    
                    await _context.SaveChangesAsync();
                    return existingEntity;
                }
                else
                {
                    // No existing tracked entity, proceed normally
                    // Only qualitative assessments supported - calculate results
                    if (assessment.AssessmentType == AssessmentType.Qualitative)
                    {
                        assessment = CalculateQualitativeResults(assessment);
                    }

                    // Set audit fields for update
                    _auditService.SetAuditFields(assessment, _auditService.GetCurrentUser(), true);

                    _context.Entry(assessment).State = EntityState.Modified;
                    await _context.SaveChangesAsync();
                    return assessment;
                }
            }
            catch (DbUpdateConcurrencyException ex)
            {
                if (await _auditService.HandleConcurrencyException(ex, assessment))
                {
                    await _context.SaveChangesAsync();
                    return assessment;
                }
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating assessment: {Message}", ex.Message);
                throw;
            }
        }

        public async Task<bool> DeleteAssessmentAsync(int id)
        {
            try
            {
                // Use the execution strategy to handle the transaction properly with PostgreSQL retry strategy
                var strategy = _context.Database.CreateExecutionStrategy();
                
                return await strategy.ExecuteAsync(async () =>
                {
                    using var transaction = await _context.Database.BeginTransactionAsync();
                    try
                    {
                        // First check if the assessment exists
                        var assessment = await _context.RiskAssessments
                            .AsNoTracking()
                            .FirstOrDefaultAsync(a => a.Id == id);

                        if (assessment == null)
                            return false;

                        // Use ExecuteSqlRaw for more reliable deletion with proper constraint handling
                        // Delete in the correct order to avoid foreign key constraint violations

                        // 1. Update Risks to remove references to ThreatScenarios and RiskAssessment
                        await _context.Database.ExecuteSqlRawAsync(
                            "UPDATE \"Risks\" SET \"ThreatScenarioId\" = NULL WHERE \"ThreatScenarioId\" IN (SELECT \"Id\" FROM \"ThreatScenarios\" WHERE \"RiskAssessmentId\" = {0})", 
                            id);

                        await _context.Database.ExecuteSqlRawAsync(
                            "UPDATE \"Risks\" SET \"RiskAssessmentId\" = NULL WHERE \"RiskAssessmentId\" = {0}", 
                            id);

                        // 2. Delete QualitativeControls
                        await _context.Database.ExecuteSqlRawAsync(
                            "DELETE FROM \"QualitativeControls\" WHERE \"RiskAssessmentId\" = {0}", 
                            id);

                        // 3. Delete RiskAssessmentThreatModels
                        await _context.Database.ExecuteSqlRawAsync(
                            "DELETE FROM \"RiskAssessmentThreatModels\" WHERE \"RiskAssessmentId\" = {0}", 
                            id);

                        // 4. Update ThreatModels to remove RiskAssessmentId reference
                        await _context.Database.ExecuteSqlRawAsync(
                            "UPDATE \"ThreatModels\" SET \"RiskAssessmentId\" = NULL WHERE \"RiskAssessmentId\" = {0}", 
                            id);

                        // 5. Update LossEvents and ThreatEvents to remove ThreatScenarioId references
                        await _context.Database.ExecuteSqlRawAsync(
                            "UPDATE \"LossEvents\" SET \"ThreatScenarioId\" = NULL WHERE \"ThreatScenarioId\" IN (SELECT \"Id\" FROM \"ThreatScenarios\" WHERE \"RiskAssessmentId\" = {0})", 
                            id);

                        await _context.Database.ExecuteSqlRawAsync(
                            "UPDATE \"ThreatEvents\" SET \"ThreatScenarioId\" = NULL WHERE \"ThreatScenarioId\" IN (SELECT \"Id\" FROM \"ThreatScenarios\" WHERE \"RiskAssessmentId\" = {0})", 
                            id);

                        // 6. Delete ThreatScenarios (should cascade to any remaining related entities)
                        await _context.Database.ExecuteSqlRawAsync(
                            "DELETE FROM \"ThreatScenarios\" WHERE \"RiskAssessmentId\" = {0}", 
                            id);

                        // 7. Finally delete the RiskAssessment
                        await _context.Database.ExecuteSqlRawAsync(
                            "DELETE FROM \"RiskAssessments\" WHERE \"Id\" = {0}", 
                            id);

                        await transaction.CommitAsync();
                        return true;
                    }
                    catch (Exception ex)
                    {
                        await transaction.RollbackAsync();
                        System.Diagnostics.Debug.WriteLine($"Error in transaction: {ex.Message}");
                        if (ex.InnerException != null)
                        {
                            System.Diagnostics.Debug.WriteLine($"Inner exception: {ex.InnerException.Message}");
                        }
                        throw; // Re-throw to be handled by execution strategy
                    }
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error deleting risk assessment: {ex.Message}");
                if (ex.InnerException != null)
                {
                    System.Diagnostics.Debug.WriteLine($"Inner exception: {ex.InnerException.Message}");
                }
                return false;
            }
        }


        // FAIR features removed - method disabled
        public RiskAssessment CalculateFAIRResults(RiskAssessment assessment)
        {
            // FAIR quantitative assessments are no longer supported
            // Return assessment unchanged
            return assessment;
        }

        // FAIR control calculation methods removed

        // FAIR secondary loss calculation removed

        private RiskAssessment CalculateQualitativeResults(RiskAssessment assessment)
        {
            if (assessment.QualitativeLikelihood.HasValue && assessment.QualitativeImpact.HasValue && assessment.QualitativeExposure.HasValue)
            {
                var likelihoodScore = (int)assessment.QualitativeLikelihood.Value;
                var impactScore = (int)assessment.QualitativeImpact.Value;
                var exposureRating = assessment.QualitativeExposure.Value; // Direct decimal value

                // Calculate: (Likelihood × Impact) × Exposure Rating
                assessment.QualitativeRiskScore = (likelihoodScore * impactScore) * exposureRating;
            }

            return assessment;
        }

    }
}