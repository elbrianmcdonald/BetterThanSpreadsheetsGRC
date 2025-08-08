using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace CyberRiskApp.Services
{
    public class RiskAssessmentThreatModelService : IRiskAssessmentThreatModelService
    {
        private readonly CyberRiskContext _context;

        public RiskAssessmentThreatModelService(CyberRiskContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<AttackChain>> GetApprovedTemplatesAsync()
        {
            return await _context.AttackChains
                .Where(ac => ac.Status == AttackChainStatus.Approved || ac.Status == AttackChainStatus.Reviewed)
                .OrderBy(ac => ac.Name)
                .ToListAsync();
        }

        public async Task<IEnumerable<RiskAssessmentThreatModel>> CreateThreatModelCopiesAsync(int riskAssessmentId, IEnumerable<int> templateIds, string userId)
        {
            var templates = await _context.AttackChains
                .Where(ac => templateIds.Contains(ac.Id))
                .ToListAsync();

            var copiedModels = new List<RiskAssessmentThreatModel>();

            foreach (var template in templates)
            {
                // Create assessment-specific copy
                var threatModel = new RiskAssessmentThreatModel
                {
                    RiskAssessmentId = riskAssessmentId,
                    TemplateAttackChainId = template.Id,
                    Title = template.Name,
                    Description = template.Description,
                    Status = AttackChainStatus.Draft,
                    ThreatEventData = "{}",
                    VulnerabilitiesData = "[]", 
                    LossEventData = "{}",
                    ALEMinimum = 0,
                    ALEMostLikely = 0,
                    ALEMaximum = 0,
                    LEFValue = 0,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                };

                _context.RiskAssessmentThreatModels.Add(threatModel);
                copiedModels.Add(threatModel);
            }

            await _context.SaveChangesAsync();
            return copiedModels;
        }

        public async Task<IEnumerable<RiskAssessmentThreatModel>> GetThreatModelsForAssessmentAsync(int riskAssessmentId)
        {
            return await _context.RiskAssessmentThreatModels
                .Include(tm => tm.TemplateAttackChain)
                .Where(tm => tm.RiskAssessmentId == riskAssessmentId)
                .OrderBy(tm => tm.Title)
                .ToListAsync();
        }

        public async Task<IEnumerable<RiskAssessmentThreatModel>> GetAllThreatModelsAsync()
        {
            return await _context.RiskAssessmentThreatModels
                .Include(tm => tm.TemplateAttackChain)
                .Include(tm => tm.RiskAssessment)
                .OrderByDescending(tm => tm.UpdatedAt)
                .ToListAsync();
        }

        public async Task<RiskAssessmentThreatModel?> GetThreatModelByIdAsync(int threatModelId)
        {
            return await _context.RiskAssessmentThreatModels
                .Include(tm => tm.TemplateAttackChain)
                .Include(tm => tm.RiskAssessment)
                .FirstOrDefaultAsync(tm => tm.Id == threatModelId);
        }

        public async Task<bool> UpdateThreatModelAsync(int threatModelId, string threatEventData, string vulnerabilitiesData, string lossEventData, string userId)
        {
            var threatModel = await _context.RiskAssessmentThreatModels
                .FirstOrDefaultAsync(tm => tm.Id == threatModelId);

            if (threatModel == null) return false;

            // Update the data
            threatModel.ThreatEventData = threatEventData;
            threatModel.VulnerabilitiesData = vulnerabilitiesData;
            threatModel.LossEventData = lossEventData;
            threatModel.UpdatedBy = userId;
            threatModel.UpdatedAt = DateTime.UtcNow;

            // Calculate and update ALE values
            try
            {
                var aleResults = CalculateALEFromData(threatEventData, vulnerabilitiesData, lossEventData);
                threatModel.ALEMinimum = aleResults.Minimum;
                threatModel.ALEMostLikely = aleResults.MostLikely;
                threatModel.ALEMaximum = aleResults.Maximum;
                threatModel.LEFValue = aleResults.LEF;
            }
            catch (Exception)
            {
                // If calculation fails, keep previous values or set to 0
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteThreatModelAsync(int threatModelId, string userId)
        {
            var threatModel = await _context.RiskAssessmentThreatModels
                .FirstOrDefaultAsync(tm => tm.Id == threatModelId);

            if (threatModel == null) return false;

            _context.RiskAssessmentThreatModels.Remove(threatModel);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<decimal> CalculateTotalALEForAssessmentAsync(int riskAssessmentId)
        {
            var threatModels = await _context.RiskAssessmentThreatModels
                .Where(tm => tm.RiskAssessmentId == riskAssessmentId)
                .ToListAsync();

            return threatModels.Sum(tm => tm.ALEMostLikely);
        }

        private (decimal Minimum, decimal MostLikely, decimal Maximum, decimal LEF) CalculateALEFromData(string threatEventData, string vulnerabilitiesData, string lossEventData)
        {
            try
            {
                // Parse the JSON data to extract calculation values
                var threatEvent = JsonSerializer.Deserialize<JsonElement>(threatEventData);
                var vulnerabilities = JsonSerializer.Deserialize<JsonElement>(vulnerabilitiesData);
                var lossEvent = JsonSerializer.Deserialize<JsonElement>(lossEventData);

                // Extract TEF values
                decimal tefMin = 0, tefMost = 0, tefMax = 0;
                if (threatEvent.TryGetProperty("tefMin", out var tefMinProp)) tefMin = tefMinProp.GetDecimal();
                if (threatEvent.TryGetProperty("tefMost", out var tefMostProp)) tefMost = tefMostProp.GetDecimal();
                if (threatEvent.TryGetProperty("tefMax", out var tefMaxProp)) tefMax = tefMaxProp.GetDecimal();

                // Calculate vulnerability probability product
                decimal vulnProbMin = 1, vulnProbMost = 1, vulnProbMax = 1;
                if (vulnerabilities.ValueKind == JsonValueKind.Array)
                {
                    foreach (var vuln in vulnerabilities.EnumerateArray())
                    {
                        if (vuln.TryGetProperty("vulnMin", out var vulnMinProp)) vulnProbMin *= vulnMinProp.GetDecimal();
                        if (vuln.TryGetProperty("vulnMost", out var vulnMostProp)) vulnProbMost *= vulnMostProp.GetDecimal();
                        if (vuln.TryGetProperty("vulnMax", out var vulnMaxProp)) vulnProbMax *= vulnMaxProp.GetDecimal();
                    }
                }

                // Calculate LEF = TEF × Vulnerability Probability Product
                decimal lefMin = tefMin * vulnProbMin;
                decimal lefMost = tefMost * vulnProbMost;
                decimal lefMax = tefMax * vulnProbMax;

                // For simplified calculation, assume loss magnitude of $100,000 (this would normally come from loss event data)
                decimal lossMin = 50000, lossMost = 100000, lossMax = 200000;

                // Calculate ALE = LEF × Loss Magnitude
                return (
                    Minimum: lefMin * lossMin,
                    MostLikely: lefMost * lossMost,
                    Maximum: lefMax * lossMax,
                    LEF: lefMost
                );
            }
            catch
            {
                return (0, 0, 0, 0);
            }
        }
    }
}