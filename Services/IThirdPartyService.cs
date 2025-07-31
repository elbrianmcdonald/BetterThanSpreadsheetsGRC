using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IThirdPartyService
    {
        Task<IEnumerable<ThirdParty>> GetAllThirdPartiesAsync();
        Task<ThirdParty?> GetThirdPartyByIdAsync(int id);
        Task<ThirdParty> CreateThirdPartyAsync(ThirdParty thirdParty);
        Task<ThirdParty> UpdateThirdPartyAsync(ThirdParty thirdParty);
        Task<bool> DeleteThirdPartyAsync(int id);
        Task<bool> ThirdPartyExistsAsync(int id);
        Task<bool> IsThirdPartyNameUniqueAsync(string name, int? excludeId = null);
        Task<IEnumerable<ThirdParty>> GetThirdPartiesByOrganizationAsync(string organization);
        Task<IEnumerable<ThirdParty>> GetThirdPartiesByStatusAsync(TPRAStatus status);
        Task<IEnumerable<ThirdParty>> GetThirdPartiesByRiskLevelAsync(RiskLevel riskLevel);
        Task<int> GetThirdPartyCountAsync();
    }
}