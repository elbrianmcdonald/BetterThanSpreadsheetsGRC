using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class FindingService : IFindingService
    {
        private readonly CyberRiskContext _context;
        private readonly IAuditService _auditService;
        private readonly IRiskMatrixService _riskMatrixService;

        public FindingService(CyberRiskContext context, IAuditService auditService, IRiskMatrixService riskMatrixService)
        {
            _context = context;
            _auditService = auditService;
            _riskMatrixService = riskMatrixService;
        }

        public async Task<IEnumerable<Finding>> GetAllFindingsAsync()
        {
            try
            {
                return await _context.Findings
                    .OrderByDescending(f => f.CreatedAt)
                    .ToListAsync();
            }
            catch
            {
                return new List<Finding>();
            }
        }

        public async Task<IEnumerable<Finding>> GetFindingsAsync(FindingStatus? status = null)
        {
            try
            {
                var query = _context.Findings.AsQueryable();

                if (status.HasValue)
                {
                    query = query.Where(f => f.Status == status.Value);
                }

                return await query
                    .OrderByDescending(f => f.CreatedAt)
                    .ToListAsync();
            }
            catch
            {
                return new List<Finding>();
            }
        }

        public async Task<Finding?> GetFindingByIdAsync(int id)
        {
            try
            {
                return await _context.Findings.FindAsync(id);
            }
            catch
            {
                return null;
            }
        }

        public async Task<Finding> CreateFindingAsync(Finding finding)
        {
            try
            {
                finding.FindingNumber = await GenerateFindingNumberAsync();
                finding.OpenDate = DateTime.Today;
                finding.Status = FindingStatus.Open; // Always start as Open
                
                // Calculate RiskScore and RiskLevel using RiskMatrix system
                await ApplyRiskMatrixCalculationsAsync(finding);
                
                // Set audit fields using AuditService
                _auditService.SetAuditFields(finding, _auditService.GetCurrentUser());

                _context.Findings.Add(finding);
                await _context.SaveChangesAsync();
                return finding;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                if (await _auditService.HandleConcurrencyException(ex, finding))
                {
                    await _context.SaveChangesAsync();
                    return finding;
                }
                throw;
            }
        }

        public async Task<Finding> UpdateFindingAsync(Finding finding)
        {
            try
            {
                // Recalculate RiskScore and RiskLevel if risk factors changed
                await ApplyRiskMatrixCalculationsAsync(finding);
                
                // Set audit fields for update
                _auditService.SetAuditFields(finding, _auditService.GetCurrentUser(), true);
                
                _context.Entry(finding).State = EntityState.Modified;
                await _context.SaveChangesAsync();
                return finding;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                if (await _auditService.HandleConcurrencyException(ex, finding))
                {
                    await _context.SaveChangesAsync();
                    return finding;
                }
                throw;
            }
        }

        public async Task<bool> DeleteFindingAsync(int id)
        {
            var finding = await _context.Findings.FindAsync(id);
            if (finding == null)
                return false;

            _context.Findings.Remove(finding);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<string> GenerateFindingNumberAsync()
        {
            var year = DateTime.Now.Year;
            var yearPrefix = year.ToString();

            try
            {
                var lastFinding = await _context.Findings
                    .Where(f => f.FindingNumber.StartsWith(yearPrefix))
                    .OrderByDescending(f => f.FindingNumber)
                    .FirstOrDefaultAsync();

                int nextNumber = 1;
                if (lastFinding != null)
                {
                    var lastNumberStr = lastFinding.FindingNumber.Substring(5);
                    if (int.TryParse(lastNumberStr, out int lastNumber))
                    {
                        nextNumber = lastNumber + 1;
                    }
                }

                return $"{year}-{nextNumber:D4}";
            }
            catch
            {
                return $"{year}-0001";
            }
        }

        public async Task<IEnumerable<Finding>> GetOpenFindingsAsync()
        {
            try
            {
                return await _context.Findings
                    .Where(f => f.Status == FindingStatus.Open)
                    .OrderBy(f => f.SlaDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<Finding>();
            }
        }

        public async Task<IEnumerable<Finding>> GetClosedFindingsAsync()
        {
            try
            {
                return await _context.Findings
                    .Where(f => f.Status == FindingStatus.Closed)
                    .OrderByDescending(f => f.UpdatedAt)
                    .ToListAsync();
            }
            catch
            {
                return new List<Finding>();
            }
        }

        public async Task<IEnumerable<Finding>> GetOverdueFindingsAsync()
        {
            try
            {
                var today = DateTime.Today;
                return await _context.Findings
                    .Where(f => f.Status == FindingStatus.Open && f.SlaDate < today)
                    .OrderBy(f => f.SlaDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<Finding>();
            }
        }

        public async Task<bool> CloseFindingAsync(int id, string closureNotes = "")
        {
            try
            {
                var finding = await _context.Findings.FindAsync(id);
                if (finding == null)
                    return false;

                finding.Status = FindingStatus.Closed;
                // Note: If you want to store closure notes, you'd need to add a ClosureNotes field to the Finding model

                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Applies RiskMatrix calculations to a Finding: RiskScore, RiskLevel, and automatic SLA date
        /// </summary>
        private async Task ApplyRiskMatrixCalculationsAsync(Finding finding)
        {
            try
            {
                // Calculate RiskScore using the Finding's helper method
                var riskScore = finding.CalculateRiskScore();
                finding.RiskScore = riskScore;
                
                // Get RiskLevel from RiskMatrix system
                var riskLevel = await _riskMatrixService.GetRiskLevelFromScoreAsync(riskScore);
                finding.RiskLevel = riskLevel;
                
                // Calculate automatic SLA date using RiskMatrix SLA configuration (only if not already set)
                if (!finding.SlaDate.HasValue)
                {
                    var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
                    if (defaultMatrix != null)
                    {
                        var slaHours = defaultMatrix.GetSlaHoursForRiskLevel(riskLevel);
                        finding.SlaDate = finding.OpenDate.AddHours(slaHours);
                    }
                    else
                    {
                        // Fallback to default 30-day SLA if no matrix found
                        finding.SlaDate = finding.OpenDate.AddDays(30);
                    }
                }

                // Update legacy RiskRating for backward compatibility
                finding.RiskRating = riskLevel switch
                {
                    RiskLevel.Critical => RiskRating.Critical,
                    RiskLevel.High => RiskRating.High,
                    RiskLevel.Medium => RiskRating.Medium,
                    RiskLevel.Low => RiskRating.Low,
                    _ => RiskRating.Medium
                };
            }
            catch (Exception)
            {
                // Fallback to default values if RiskMatrix calculation fails
                finding.RiskScore ??= finding.CalculateRiskScore();
                finding.RiskLevel = RiskLevel.Medium;
                finding.RiskRating = RiskRating.Medium;
                
                if (!finding.SlaDate.HasValue)
                {
                    finding.SlaDate = finding.OpenDate.AddDays(30);
                }
            }
        }
    }
}