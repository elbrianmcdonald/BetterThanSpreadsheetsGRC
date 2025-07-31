using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IFindingService
    {
        Task<IEnumerable<Finding>> GetAllFindingsAsync();
        Task<IEnumerable<Finding>> GetFindingsAsync(FindingStatus? status = null);
        Task<Finding?> GetFindingByIdAsync(int id);
        Task<Finding> CreateFindingAsync(Finding finding);
        Task<Finding> UpdateFindingAsync(Finding finding);
        Task<bool> DeleteFindingAsync(int id);
        Task<string> GenerateFindingNumberAsync();
        Task<IEnumerable<Finding>> GetOpenFindingsAsync();
        Task<IEnumerable<Finding>> GetClosedFindingsAsync();
        Task<IEnumerable<Finding>> GetOverdueFindingsAsync();
        Task<bool> CloseFindingAsync(int id, string closureNotes = "");
    }
}