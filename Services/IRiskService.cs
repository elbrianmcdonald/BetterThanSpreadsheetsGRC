using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IRiskService
    {
        Task<IEnumerable<Risk>> GetAllRisksAsync();
        Task<Risk?> GetRiskByIdAsync(int id);
        Task<Risk> CreateRiskAsync(Risk risk);
        Task<Risk> UpdateRiskAsync(Risk risk);
        Task<bool> DeleteRiskAsync(int id);

        // Dashboard and summary methods
        Task<decimal> GetTotalALEAsync();
        Task<Dictionary<string, int>> GetRiskSummaryAsync();
        Task<IEnumerable<Risk>> GetHighValueRisksAsync();

        // Risk numbering method
        Task<string> GenerateNextRiskNumberAsync();

        // NEW: Bulk operations for Excel upload
        Task<List<Risk>> CreateRisksAsync(List<Risk> risks);
        Task<int> GetRiskCountAsync();
    }
}