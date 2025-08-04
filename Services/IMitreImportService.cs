using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IMitreImportService
    {
        Task<bool> ImportLatestMitreDataAsync();
        Task<bool> ImportMitreDataAsync(MitreFrameworkType frameworkType);
        Task<bool> ImportAllFrameworksAsync();
        Task<IEnumerable<MitreTechnique>> FetchMitreDataAsync(MitreFrameworkType frameworkType);
        Task<int> GetCurrentTechniqueCountAsync();
        Task<int> GetTechniqueCountByFrameworkAsync(MitreFrameworkType frameworkType);
        Task<bool> ClearExistingTechniquesAsync();
        Task<bool> ClearTechniquesByFrameworkAsync(MitreFrameworkType frameworkType);
        Task<string> GetMitreVersionAsync();
        Task<Dictionary<MitreFrameworkType, int>> GetFrameworkTechniqueCountsAsync();
    }
}