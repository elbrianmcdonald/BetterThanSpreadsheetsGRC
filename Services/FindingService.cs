using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class FindingService : IFindingService
    {
        private readonly CyberRiskContext _context;

        public FindingService(CyberRiskContext context)
        {
            _context = context;
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
            finding.FindingNumber = await GenerateFindingNumberAsync();
            finding.OpenDate = DateTime.Today;
            finding.Status = FindingStatus.Open; // Always start as Open
            finding.CreatedAt = DateTime.UtcNow;
            finding.UpdatedAt = DateTime.UtcNow;

            _context.Findings.Add(finding);
            await _context.SaveChangesAsync();
            return finding;
        }

        public async Task<Finding> UpdateFindingAsync(Finding finding)
        {
            _context.Entry(finding).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return finding;
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
    }
}