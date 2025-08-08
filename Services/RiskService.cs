using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class RiskService : IRiskService
    {
        private readonly CyberRiskContext _context;
        private readonly IAuditService _auditService;
        private readonly ITransactionService _transactionService;

        public RiskService(CyberRiskContext context, IAuditService auditService, ITransactionService transactionService)
        {
            _context = context;
            _auditService = auditService;
            _transactionService = transactionService;
        }

        public async Task<IEnumerable<Risk>> GetAllRisksAsync()
        {
            return await _context.Risks
                .Include(r => r.LinkedFinding)
                .Include(r => r.LinkedAssessment)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
        }

        public async Task<Risk?> GetRiskByIdAsync(int id)
        {
            return await _context.Risks
                .Include(r => r.LinkedFinding)
                .Include(r => r.LinkedAssessment)
                .FirstOrDefaultAsync(r => r.Id == id);
        }

        public async Task<Risk> CreateRiskAsync(Risk risk)
        {
            try
            {
                // AUTO-GENERATE RISK NUMBER if not already set
                if (string.IsNullOrWhiteSpace(risk.RiskNumber))
                {
                    risk.RiskNumber = await GenerateNextRiskNumberAsync();
                }

                // Ensure Owner is never null
                if (string.IsNullOrEmpty(risk.Owner))
                {
                    risk.Owner = "Unknown";
                }

                // Set audit fields
                _auditService.SetAuditFields(risk, _auditService.GetCurrentUser());

                _context.Risks.Add(risk);
                await _context.SaveChangesAsync();
                return risk;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                if (await _auditService.HandleConcurrencyException(ex, risk))
                {
                    await _context.SaveChangesAsync();
                    return risk;
                }
                throw;
            }
        }

        public async Task<Risk> UpdateRiskAsync(Risk risk)
        {
            try
            {
                // Set audit fields
                _auditService.SetAuditFields(risk, _auditService.GetCurrentUser(), true);
                
                _context.Entry(risk).State = EntityState.Modified;
                await _context.SaveChangesAsync();
                return risk;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                if (await _auditService.HandleConcurrencyException(ex, risk))
                {
                    await _context.SaveChangesAsync();
                    return risk;
                }
                throw;
            }
        }

        public async Task<bool> DeleteRiskAsync(int id)
        {
            try
            {
                var risk = await _context.Risks.FindAsync(id);
                if (risk == null)
                    return false;

                _context.Risks.Remove(risk);
                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<bool> CloseRiskAsync(int id, string remediationDetails, string closedBy)
        {
            var risk = await _context.Risks.FindAsync(id);
            if (risk == null)
                return false;
                
            try
            {
                risk.Status = RiskStatus.Closed;
                risk.ClosedDate = DateTime.UtcNow;
                risk.RemediationDetails = remediationDetails ?? string.Empty;
                risk.ClosedBy = closedBy ?? "Unknown";
                
                // Set audit fields
                _auditService.SetAuditFields(risk, _auditService.GetCurrentUser(), true);

                _context.Entry(risk).State = EntityState.Modified;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                if (await _auditService.HandleConcurrencyException(ex, risk))
                {
                    await _context.SaveChangesAsync();
                    return true;
                }
                return false;
            }
            catch
            {
                return false;
            }
        }

        // GetTotalALEAsync method removed - ALE functionality deprecated in favor of qualitative risk assessment

        public async Task<Dictionary<string, int>> GetRiskSummaryAsync()
        {
            try
            {
                var summary = new Dictionary<string, int>
                {
                    ["Total"] = await _context.Risks.CountAsync(),
                    ["Open"] = await _context.Risks.CountAsync(r => r.Status == RiskStatus.Open),
                    ["Closed"] = await _context.Risks.CountAsync(r => r.Status == RiskStatus.Closed),
                    ["Accepted"] = await _context.Risks.CountAsync(r => r.Status == RiskStatus.Accepted),
                    ["Critical"] = await _context.Risks.CountAsync(r => r.RiskLevel == RiskLevel.Critical),
                    ["High"] = await _context.Risks.CountAsync(r => r.RiskLevel == RiskLevel.High),
                    ["Medium"] = await _context.Risks.CountAsync(r => r.RiskLevel == RiskLevel.Medium),
                    ["Low"] = await _context.Risks.CountAsync(r => r.RiskLevel == RiskLevel.Low)
                };

                return summary;
            }
            catch
            {
                return new Dictionary<string, int>();
            }
        }

        public async Task<IEnumerable<Risk>> GetHighValueRisksAsync()
        {
            try
            {
                return await _context.Risks
                    .Where(r => r.Status == RiskStatus.Open && r.ALE >= 50000)
                    .OrderByDescending(r => r.ALE)
                    .Take(10)
                    .ToListAsync();
            }
            catch
            {
                return new List<Risk>();
            }
        }

        // Generate the next sequential risk number
        public async Task<string> GenerateNextRiskNumberAsync()
        {
            try
            {
                // Get the current year
                var currentYear = DateTime.Now.Year;
                var yearPrefix = $"RISK-{currentYear}-";

                // Find the highest risk number for this year
                var existingRisks = await _context.Risks
                    .Where(r => r.RiskNumber.StartsWith(yearPrefix))
                    .Select(r => r.RiskNumber)
                    .ToListAsync();

                int nextNumber = 1;

                if (existingRisks.Any())
                {
                    // Extract numbers from existing risk numbers and find the maximum
                    var numbers = existingRisks
                        .Select(rn => {
                            var parts = rn.Split('-');
                            if (parts.Length >= 3 && int.TryParse(parts[2], out int num))
                                return num;
                            return 0;
                        })
                        .Where(n => n > 0);

                    if (numbers.Any())
                    {
                        nextNumber = numbers.Max() + 1;
                    }
                }

                // Return formatted risk number: RISK-2025-001, RISK-2025-002, etc.
                return $"{yearPrefix}{nextNumber:D3}";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error generating risk number: {ex.Message}");
                // Fallback to simple number if there's an error
                var fallbackCount = await _context.Risks.CountAsync() + 1;
                return $"RISK-{DateTime.Now.Year}-{fallbackCount:D3}";
            }
        }

        // NEW: Bulk operations for Excel upload with optimized transactions
        public async Task<List<Risk>> CreateRisksAsync(List<Risk> risks)
        {
            return await _transactionService.ExecuteInTransactionAsync(async () =>
            {
                var createdRisks = new List<Risk>();
                var currentUser = _auditService.GetCurrentUser();

                foreach (var risk in risks)
                {
                    try
                    {
                        // Generate unique risk number for each risk
                        if (string.IsNullOrEmpty(risk.RiskNumber))
                        {
                            risk.RiskNumber = await GenerateNextRiskNumberAsync();
                        }

                        // Set audit fields
                        _auditService.SetAuditFields(risk, currentUser);

                        // Ensure required fields have defaults
                        if (risk.OpenDate == default)
                            risk.OpenDate = DateTime.Today;

                        if (!risk.NextReviewDate.HasValue)
                            risk.NextReviewDate = DateTime.Today.AddMonths(3);

                        if (risk.Status == default)
                            risk.Status = RiskStatus.Open;

                        _context.Risks.Add(risk);
                        createdRisks.Add(risk);

                        // Batch save every 50 records for better performance
                        if (createdRisks.Count % 50 == 0)
                        {
                            await _context.SaveChangesAsync();
                        }
                    }
                    catch (Exception ex)
                    {
                        // Log individual risk creation failure but continue with others
                        Console.WriteLine($"Failed to create risk '{risk.Title}': {ex.Message}");
                    }
                }

                // Save remaining risks
                if (createdRisks.Count % 50 != 0)
                {
                    await _context.SaveChangesAsync();
                }

                return createdRisks;
            });
        }

        public async Task<int> GetRiskCountAsync()
        {
            try
            {
                return await _context.Risks.CountAsync();
            }
            catch
            {
                return 0;
            }
        }
    }
}