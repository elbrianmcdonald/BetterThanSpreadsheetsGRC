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
        private readonly IMonteCarloSimulationService _monteCarloService;
        private readonly ILogger<RiskAssessmentService> _logger;
        private readonly IAuditService _auditService;

        public RiskAssessmentService(CyberRiskContext context, IRiskLevelSettingsService settingsService, 
            IRiskService riskService, IMonteCarloSimulationService monteCarloService, ILogger<RiskAssessmentService> logger,
            IAuditService auditService)
        {
            _context = context;
            _settingsService = settingsService;
            _riskService = riskService;
            _monteCarloService = monteCarloService;
            _logger = logger;
            _auditService = auditService;
        }

        public async Task<IEnumerable<RiskAssessment>> GetAllAssessmentsAsync()
        {
            try
            {
                return await _context.RiskAssessments
                    .Include(a => a.IdentifiedRisks)
                    .Include(a => a.Controls)
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
                return await _context.RiskAssessments
                    .Include(a => a.IdentifiedRisks)
                    .Include(a => a.Controls)
                    .Include(a => a.QualitativeControls)
                    .Include(a => a.LinkedThreatModels)
                    .FirstOrDefaultAsync(a => a.Id == id);
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
                // Calculate results based on assessment type
                if (assessment.AssessmentType == AssessmentType.FAIR)
                {
                    assessment = CalculateFAIRResults(assessment);
                }
                else if (assessment.AssessmentType == AssessmentType.Qualitative)
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
                    
                    // Recalculate results based on assessment type
                    if (existingEntity.AssessmentType == AssessmentType.FAIR)
                    {
                        existingEntity = CalculateFAIRResults(existingEntity);
                    }
                    else if (existingEntity.AssessmentType == AssessmentType.Qualitative)
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
                    // Recalculate results based on assessment type
                    if (assessment.AssessmentType == AssessmentType.FAIR)
                    {
                        assessment = CalculateFAIRResults(assessment);
                    }
                    else if (assessment.AssessmentType == AssessmentType.Qualitative)
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
                var assessment = await _context.RiskAssessments.FindAsync(id);
                if (assessment == null)
                    return false;

                _context.RiskAssessments.Remove(assessment);
                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }


        // Enhanced FAIR Calculation Method with Monte Carlo Simulation
        public RiskAssessment CalculateFAIRResults(RiskAssessment assessment)
        {
            // Load controls if not already loaded
            if (assessment.Controls == null || !assessment.Controls.Any())
            {
                assessment.Controls = _context.RiskAssessmentControls
                    .Where(c => c.RiskAssessmentId == assessment.Id)
                    .ToList();
            }

            // Calculate Defense in Depth Vulnerability
            decimal calculatedVulnerability = CalculateDefenseInDepthVulnerability(assessment.Controls);
            assessment.CalculatedVulnerability = calculatedVulnerability;

            // Prepare Monte Carlo input
            var monteCarloInput = new MonteCarloInput
            {
                Iterations = assessment.SimulationIterations,
                DistributionType = assessment.DistributionType,
                
                // TEF Distribution
                TefMin = assessment.ThreatEventFrequencyMin,
                TefMostLikely = assessment.ThreatEventFrequency,
                TefMax = assessment.ThreatEventFrequencyMax,
                TefConfidence = assessment.ThreatEventFrequencyConfidence,
                
                // Vulnerability from Defense in Depth
                CalculatedVulnerability = calculatedVulnerability,
                
                // Primary Loss Distributions
                ProductivityLossMin = assessment.ProductivityLossMin,
                ProductivityLossMostLikely = assessment.ProductivityLossMostLikely,
                ProductivityLossMax = assessment.ProductivityLossMax,
                
                ResponseCostsMin = assessment.ResponseCostsMin,
                ResponseCostsMostLikely = assessment.ResponseCostsMostLikely,
                ResponseCostsMax = assessment.ResponseCostsMax,
                
                ReplacementCostMin = assessment.ReplacementCostMin,
                ReplacementCostMostLikely = assessment.ReplacementCostMostLikely,
                ReplacementCostMax = assessment.ReplacementCostMax,
                
                FinesMin = assessment.FinesMin,
                FinesMostLikely = assessment.FinesMostLikely,
                FinesMax = assessment.FinesMax,
                
                LossConfidence = assessment.LossMagnitudeConfidence,
                
                // Secondary Loss Distributions
                IncludeSecondaryLoss = HasSecondaryLoss(assessment),
                SecondaryLossEventFrequency = assessment.SecondaryLossEventFrequency,
                
                SecondaryResponseCostMin = assessment.SecondaryResponseCostMin,
                SecondaryResponseCostMostLikely = assessment.SecondaryResponseCostMostLikely,
                SecondaryResponseCostMax = assessment.SecondaryResponseCostMax,
                
                SecondaryProductivityLossMin = assessment.SecondaryProductivityLossMin,
                SecondaryProductivityLossMostLikely = assessment.SecondaryProductivityLossMostLikely,
                SecondaryProductivityLossMax = assessment.SecondaryProductivityLossMax,
                
                ReputationDamageMin = assessment.ReputationDamageMin,
                ReputationDamageMostLikely = assessment.ReputationDamageMostLikely,
                ReputationDamageMax = assessment.ReputationDamageMax,
                
                CompetitiveAdvantageLossMin = assessment.CompetitiveAdvantageLossMin,
                CompetitiveAdvantageLossMostLikely = assessment.CompetitiveAdvantageLossMostLikely,
                CompetitiveAdvantageLossMax = assessment.CompetitiveAdvantageLossMax,
                
                ExternalStakeholderLossMin = assessment.ExternalStakeholderLossMin,
                ExternalStakeholderLossMostLikely = assessment.ExternalStakeholderLossMostLikely,
                ExternalStakeholderLossMax = assessment.ExternalStakeholderLossMax,
                
                // Insurance
                DeductInsurance = assessment.DeductCybersecurityInsurance
            };

            // Get insurance amount if deducting
            if (assessment.DeductCybersecurityInsurance)
            {
                var settings = _settingsService.GetSettingsByIdAsync(1).Result; // Assuming default settings ID is 1
                monteCarloInput.InsuranceAmount = settings?.CybersecurityInsuranceAmount ?? 0;
            }

            // Run Monte Carlo simulation
            var simulationResult = _monteCarloService.RunSimulation(monteCarloInput);

            // Update assessment with simulation results
            assessment.ALE_10th = simulationResult.ALE_10th;
            assessment.ALE_50th = simulationResult.ALE_50th;
            assessment.ALE_90th = simulationResult.ALE_90th;
            assessment.ALE_95th = simulationResult.ALE_95th;
            
            assessment.PrimaryLoss_10th = simulationResult.PrimaryLoss_10th;
            assessment.PrimaryLoss_50th = simulationResult.PrimaryLoss_50th;
            assessment.PrimaryLoss_90th = simulationResult.PrimaryLoss_90th;
            assessment.PrimaryLoss_95th = simulationResult.PrimaryLoss_95th;

            // Also calculate traditional single-point estimates for backward compatibility
            var singlePointVulnerability = calculatedVulnerability;
            assessment.LossEventFrequency = assessment.ThreatEventFrequency * singlePointVulnerability;

            // Calculate Primary Loss Magnitude (most likely)
            assessment.PrimaryLossMagnitude = assessment.ProductivityLossMostLikely + assessment.ResponseCostsMostLikely;
            if (assessment.ReplacementCostMostLikely > 1000)
                assessment.PrimaryLossMagnitude += assessment.ReplacementCostMostLikely;
            if (assessment.FinesMostLikely > 1000)
                assessment.PrimaryLossMagnitude += assessment.FinesMostLikely;

            // Calculate Secondary Loss Magnitude if applicable
            if (HasSecondaryLoss(assessment))
            {
                assessment.SecondaryLossMagnitude = assessment.SecondaryResponseCostMostLikely +
                    assessment.SecondaryProductivityLossMostLikely +
                    assessment.ReputationDamageMostLikely +
                    assessment.CompetitiveAdvantageLossMostLikely +
                    assessment.ExternalStakeholderLossMostLikely;
            }

            // Use median (50th percentile) as the primary ALE
            assessment.AnnualLossExpectancy = simulationResult.ALE_50th;

            // Set qualitative fields to null for FAIR assessments
            assessment.QualitativeRiskScore = null;
            assessment.QualitativeLikelihood = null;
            assessment.QualitativeImpact = null;
            assessment.QualitativeExposure = null;

            return assessment;
        }

        private decimal CalculateDefenseInDepthVulnerability(ICollection<RiskAssessmentControl> controls)
        {
            // If no controls or no implemented controls, vulnerability is 100%
            var implementedControls = controls?.Where(c => c.ImplementationStatus == "Implemented").ToList();
            if (implementedControls == null || !implementedControls.Any())
                return 1.0m;

            // Calculate combined control effectiveness
            // Each control reduces the remaining vulnerability
            decimal remainingVulnerability = 1.0m;
            
            foreach (var control in implementedControls)
            {
                decimal controlEffectiveness = control.ControlEffectiveness / 100m;
                remainingVulnerability *= (1 - controlEffectiveness);
            }

            return remainingVulnerability;
        }

        private bool HasSecondaryLoss(RiskAssessment assessment)
        {
            return assessment.SecondaryResponseCostMostLikely > 0 ||
                   assessment.SecondaryProductivityLossMostLikely > 0 ||
                   assessment.ReputationDamageMostLikely > 0 ||
                   assessment.CompetitiveAdvantageLossMostLikely > 0 ||
                   assessment.ExternalStakeholderLossMostLikely > 0;
        }

        private RiskAssessment CalculateQualitativeResults(RiskAssessment assessment)
        {
            if (assessment.QualitativeLikelihood.HasValue && assessment.QualitativeImpact.HasValue && assessment.QualitativeExposure.HasValue)
            {
                var likelihoodScore = (int)assessment.QualitativeLikelihood.Value;
                var impactScore = (int)assessment.QualitativeImpact.Value;
                var exposureRating = GetExposureRating(assessment.QualitativeExposure.Value);

                // Calculate: (Likelihood × Impact) × Exposure Rating
                assessment.QualitativeRiskScore = (likelihoodScore * impactScore) * exposureRating;

                // Calculate Loss Event Frequency for qualitative (using threat analysis if available)
                if (assessment.ThreatEventFrequency > 0 && assessment.ContactFrequency > 0 && assessment.ActionSuccess > 0)
                {
                    var vulnerabilityCalc = (assessment.ContactFrequency / 100) * (assessment.ActionSuccess / 100);
                    assessment.LossEventFrequency = assessment.ThreatEventFrequency * vulnerabilityCalc;
                }
                else
                {
                    // Set default values if threat analysis is not completed
                    assessment.LossEventFrequency = 0;
                }

                // Set other FAIR fields to zero for qualitative assessments
                assessment.AnnualLossExpectancy = 0;
                assessment.PrimaryLossMagnitude = 0;
            }

            return assessment;
        }

        private decimal GetExposureRating(ExposureLevel exposureLevel)
        {
            return exposureLevel switch
            {
                ExposureLevel.SlightlyExposed => 0.2m,      // 0.2
                ExposureLevel.Exposed => 0.4m,             // 0.4
                ExposureLevel.ModeratelyExposed => 0.8m,    // 0.8
                ExposureLevel.HighlyExposed => 1.0m,        // 1.0
                _ => 0.2m
            };
        }
    }
}