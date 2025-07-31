using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class ThirdPartyService : IThirdPartyService
    {
        private readonly CyberRiskContext _context;
        private readonly ILogger<ThirdPartyService> _logger;

        public ThirdPartyService(CyberRiskContext context, ILogger<ThirdPartyService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<IEnumerable<ThirdParty>> GetAllThirdPartiesAsync()
        {
            try
            {
                return await _context.ThirdParties
                    .OrderBy(tp => tp.Name)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all third parties");
                return new List<ThirdParty>();
            }
        }

        public async Task<ThirdParty?> GetThirdPartyByIdAsync(int id)
        {
            try
            {
                return await _context.ThirdParties
                    .FirstOrDefaultAsync(tp => tp.Id == id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving third party with ID {Id}", id);
                return null;
            }
        }

        public async Task<ThirdParty> CreateThirdPartyAsync(ThirdParty thirdParty)
        {
            try
            {
                thirdParty.CreatedAt = DateTime.UtcNow;
                thirdParty.UpdatedAt = DateTime.UtcNow;

                _context.ThirdParties.Add(thirdParty);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Third party {Name} created successfully with ID {Id}", 
                    thirdParty.Name, thirdParty.Id);

                return thirdParty;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating third party {Name}", thirdParty.Name);
                throw;
            }
        }

        public async Task<ThirdParty> UpdateThirdPartyAsync(ThirdParty thirdParty)
        {
            try
            {
                thirdParty.UpdatedAt = DateTime.UtcNow;

                _context.ThirdParties.Update(thirdParty);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Third party {Name} updated successfully", thirdParty.Name);

                return thirdParty;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating third party with ID {Id}", thirdParty.Id);
                throw;
            }
        }

        public async Task<bool> DeleteThirdPartyAsync(int id)
        {
            try
            {
                var thirdParty = await _context.ThirdParties.FindAsync(id);
                if (thirdParty == null)
                    return false;

                _context.ThirdParties.Remove(thirdParty);
                var result = await _context.SaveChangesAsync();

                _logger.LogInformation("Third party {Name} deleted successfully", thirdParty.Name);

                return result > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting third party with ID {Id}", id);
                return false;
            }
        }

        public async Task<bool> ThirdPartyExistsAsync(int id)
        {
            try
            {
                return await _context.ThirdParties.AnyAsync(tp => tp.Id == id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if third party with ID {Id} exists", id);
                return false;
            }
        }

        public async Task<bool> IsThirdPartyNameUniqueAsync(string name, int? excludeId = null)
        {
            try
            {
                var query = _context.ThirdParties.Where(tp => tp.Name.ToLower() == name.ToLower());
                
                if (excludeId.HasValue)
                    query = query.Where(tp => tp.Id != excludeId.Value);

                return !await query.AnyAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking third party name uniqueness for {Name}", name);
                return false;
            }
        }

        public async Task<IEnumerable<ThirdParty>> GetThirdPartiesByOrganizationAsync(string organization)
        {
            try
            {
                return await _context.ThirdParties
                    .Where(tp => tp.Organization.ToLower().Contains(organization.ToLower()))
                    .OrderBy(tp => tp.Name)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving third parties by organization {Organization}", organization);
                return new List<ThirdParty>();
            }
        }

        public async Task<IEnumerable<ThirdParty>> GetThirdPartiesByStatusAsync(TPRAStatus status)
        {
            try
            {
                return await _context.ThirdParties
                    .Where(tp => tp.TPRAStatus == status)
                    .OrderBy(tp => tp.Name)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving third parties by status {Status}", status);
                return new List<ThirdParty>();
            }
        }

        public async Task<IEnumerable<ThirdParty>> GetThirdPartiesByRiskLevelAsync(RiskLevel riskLevel)
        {
            try
            {
                return await _context.ThirdParties
                    .Where(tp => tp.RiskLevel == riskLevel)
                    .OrderBy(tp => tp.Name)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving third parties by risk level {RiskLevel}", riskLevel);
                return new List<ThirdParty>();
            }
        }

        public async Task<int> GetThirdPartyCountAsync()
        {
            try
            {
                return await _context.ThirdParties.CountAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving third party count");
                return 0;
            }
        }
    }
}