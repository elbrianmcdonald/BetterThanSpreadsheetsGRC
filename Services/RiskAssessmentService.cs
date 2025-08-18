using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace CyberRiskApp.Services
{
    public class RiskAssessmentService : IRiskAssessmentService
    {
        private readonly CyberRiskContext _context;
        private readonly IRiskLevelSettingsService _settingsService;
        private readonly IRiskService _riskService;
        private readonly ILogger<RiskAssessmentService> _logger;
        private readonly IAuditService _auditService;
        private readonly IRiskBacklogService _backlogService;

        public RiskAssessmentService(CyberRiskContext context, IRiskLevelSettingsService settingsService, 
            IRiskService riskService, ILogger<RiskAssessmentService> logger,
            IAuditService auditService, IRiskBacklogService backlogService)
        {
            _context = context;
            _settingsService = settingsService;
            _riskService = riskService;
            _logger = logger;
            _auditService = auditService;
            _backlogService = backlogService;
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
                Console.WriteLine($"=== DEBUGGING RiskAssessmentService.GetAssessmentByIdAsync({id}) ===");
                
                var assessment = await _context.RiskAssessments
                    .Include(a => a.IdentifiedRisks)
                    .Include(a => a.QualitativeControls)
                    .Include(a => a.LinkedThreatModels)
                    .Include(a => a.ThreatModels)
                        .ThenInclude(tm => tm.TemplateAttackChain)
                    .Include(a => a.ThreatScenarios)
                        .ThenInclude(ts => ts.IdentifiedRisks)
                    .FirstOrDefaultAsync(a => a.Id == id);

                if (assessment != null)
                {
                    Console.WriteLine($"   DEBUGGING: Assessment found: '{assessment.Title}'");
                    Console.WriteLine($"   DEBUGGING: IdentifiedRisks loaded: {assessment.IdentifiedRisks?.Count ?? 0} items");
                    Console.WriteLine($"   DEBUGGING: QualitativeControls loaded: {assessment.QualitativeControls?.Count ?? 0} items");
                    Console.WriteLine($"   DEBUGGING: ThreatScenarios loaded: {assessment.ThreatScenarios?.Count ?? 0} items");
                    
                    if (assessment.IdentifiedRisks?.Any() == true)
                    {
                        foreach (var risk in assessment.IdentifiedRisks)
                        {
                            Console.WriteLine($"   DEBUGGING: - IdentifiedRisk: '{risk.Title}' (ID: {risk.Id})");
                        }
                    }
                    else
                    {
                        Console.WriteLine("   DEBUGGING: No IdentifiedRisks found in database");
                    }
                }
                else
                {
                    Console.WriteLine($"   DEBUGGING: Assessment with ID {id} not found in database");
                }

                return assessment;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"   DEBUGGING: Exception in GetAssessmentByIdAsync: {ex.Message}");
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

                // Automatically generate risks for the backlog
                await AutoGenerateRisksForBacklogAsync(assessment);

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

                    // Automatically generate risks for the backlog if assessment is completed
                    if (existingEntity.Status == AssessmentStatus.Completed && !existingEntity.RisksGenerated)
                    {
                        await AutoGenerateRisksForBacklogAsync(existingEntity);
                    }

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

                    // Automatically generate risks for the backlog if assessment is completed
                    if (assessment.Status == AssessmentStatus.Completed && !assessment.RisksGenerated)
                    {
                        await AutoGenerateRisksForBacklogAsync(assessment);
                    }

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
                // Use decimal values directly from RiskMatrixLevel system
                var likelihoodScore = assessment.QualitativeLikelihood.Value;
                var impactScore = assessment.QualitativeImpact.Value;
                var exposureRating = assessment.QualitativeExposure.Value;

                // Calculate: (Likelihood × Impact) × Exposure Rating
                assessment.QualitativeRiskScore = (likelihoodScore * impactScore) * exposureRating;
            }

            return assessment;
        }

        private async Task AutoGenerateRisksForBacklogAsync(RiskAssessment assessment)
        {
            try
            {
                _logger.LogInformation("Automatically generating risks for assessment {AssessmentId}: {Title}", assessment.Id, assessment.Title);

                // Don't generate risks if already generated or if assessment doesn't have risk data
                if (assessment.RisksGenerated)
                {
                    _logger.LogInformation("Risks already generated for assessment {AssessmentId}, skipping", assessment.Id);
                    return;
                }

                var backlogEntries = new List<RiskBacklogEntry>();
                var currentUser = _auditService.GetCurrentUser();

                // Generate risks from threat scenarios
                if (assessment.ThreatScenarios?.Any() == true)
                {
                    foreach (var scenario in assessment.ThreatScenarios.Where(ts => ts.QualitativeRiskScore > 0))
                    {
                        // Create risk data object (don't save to database yet)
                        var riskData = new
                        {
                            Title = $"Risk from {assessment.Title} - Scenario {scenario.Id}",
                            Description = scenario.Description ?? "",
                            ThreatScenario = scenario.Description ?? "",
                            Asset = assessment.Asset,
                            BusinessUnit = assessment.BusinessUnit ?? "",
                            Owner = assessment.BusinessOwner ?? assessment.Assessor,
                            RiskAssessmentId = assessment.Id,
                            ThreatScenarioId = scenario.Id,
                            
                            // Map scenario values to risk (simplified mapping)
                            Impact = (ImpactLevel)Math.Min(5, Math.Max(1, (int)scenario.QualitativeImpact!)),
                            Likelihood = (LikelihoodLevel)Math.Min(5, Math.Max(1, (int)scenario.QualitativeLikelihood!)),
                            Exposure = (ExposureLevel)Math.Min(5, Math.Max(1, (int)scenario.QualitativeExposure!)),
                            InherentRiskLevel = MapRiskScore(scenario.QualitativeRiskScore!.Value),
                            RiskLevel = MapRiskScore(scenario.QualitativeRiskScore!.Value),
                            
                            CreatedBy = currentUser,
                            UpdatedBy = currentUser
                        };
                        
                        // Serialize risk data for backlog description
                        var riskDescription = JsonSerializer.Serialize(riskData);
                        
                        // Create backlog entry WITHOUT creating the risk yet
                        var backlogEntry = await _backlogService.CreateBacklogEntryAsync(
                            riskId: null, // No risk exists yet - will be created upon approval
                            actionType: RiskBacklogAction.NewRisk,
                            description: riskDescription, // Store full risk data here
                            justification: $"Risk assessment completed with {scenario.CalculateRiskLevel()} risk level (Score: {scenario.QualitativeRiskScore:F1})",
                            requesterId: currentUser
                        );
                        
                        backlogEntries.Add(backlogEntry);
                    }
                }
                // Legacy: Single assessment-level risk
                else if (assessment.QualitativeRiskScore.HasValue && assessment.QualitativeRiskScore > 0)
                {
                    // Create risk data object (don't save to database yet)
                    var riskData = new
                    {
                        Title = $"Risk from Assessment: {assessment.Title}",
                        Description = assessment.Description,
                        ThreatScenario = assessment.ThreatScenario,
                        Asset = assessment.Asset,
                        BusinessUnit = assessment.BusinessUnit ?? "",
                        Owner = assessment.BusinessOwner ?? assessment.Assessor,
                        RiskAssessmentId = assessment.Id,
                        
                        // Map assessment values (simplified mapping)
                        Impact = (ImpactLevel)Math.Min(5, Math.Max(1, (int)assessment.QualitativeImpact!)),
                        Likelihood = (LikelihoodLevel)Math.Min(5, Math.Max(1, (int)assessment.QualitativeLikelihood!)),
                        Exposure = (ExposureLevel)Math.Min(5, Math.Max(1, (int)assessment.QualitativeExposure!)),
                        InherentRiskLevel = MapRiskScore(assessment.QualitativeRiskScore.Value),
                        RiskLevel = MapRiskScore(assessment.QualitativeRiskScore.Value),
                        
                        CreatedBy = currentUser,
                        UpdatedBy = currentUser
                    };
                    
                    // Serialize risk data for backlog description
                    var riskDescription = JsonSerializer.Serialize(riskData);
                    
                    // Create backlog entry WITHOUT creating the risk yet
                    var backlogEntry = await _backlogService.CreateBacklogEntryAsync(
                        riskId: null, // No risk exists yet - will be created upon approval
                        actionType: RiskBacklogAction.NewRisk,
                        description: riskDescription, // Store full risk data here
                        justification: $"Risk assessment completed with {assessment.CalculateRiskLevel()} risk level (Score: {assessment.QualitativeRiskScore:F1})",
                        requesterId: currentUser
                    );
                    
                    backlogEntries.Add(backlogEntry);
                }
                
                // Mark assessment as having generated risks if any were created
                if (backlogEntries.Any())
                {
                    assessment.RisksGenerated = true;
                    assessment.RisksGeneratedDate = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    
                    _logger.LogInformation("Successfully generated {Count} risk backlog entries for assessment {AssessmentId}", 
                        backlogEntries.Count, assessment.Id);
                }
                else
                {
                    _logger.LogInformation("No risks to generate for assessment {AssessmentId} - no threat scenarios or risk scores found", 
                        assessment.Id);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error automatically generating risks for assessment {AssessmentId}: {Message}", 
                    assessment.Id, ex.Message);
                // Don't rethrow - this is an automatic background operation
            }
        }

        private RiskLevel MapRiskScore(decimal score)
        {
            return score switch
            {
                >= 16 => RiskLevel.Critical,
                >= 10 => RiskLevel.High,
                >= 4 => RiskLevel.Medium,
                _ => RiskLevel.Low
            };
        }

    }
}