using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IAppSettingsService
    {
        Task<AppSettings?> GetAppSettingsAsync();
        Task<AppSettings> GetOrCreateAppSettingsAsync();
        Task<AppSettings> UpdateAppSettingsAsync(AppSettings settings);
    }
}