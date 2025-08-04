using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class AppSettingsService : IAppSettingsService
    {
        private readonly CyberRiskContext _context;
        private readonly ILogger<AppSettingsService> _logger;

        public AppSettingsService(CyberRiskContext context, ILogger<AppSettingsService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<AppSettings?> GetAppSettingsAsync()
        {
            return await _context.AppSettings.FirstOrDefaultAsync();
        }

        public async Task<AppSettings> GetOrCreateAppSettingsAsync()
        {
            var settings = await GetAppSettingsAsync();
            if (settings == null)
            {
                settings = new AppSettings
                {
                    DomainName = "localhost",
                    CreatedBy = "System",
                    CreatedAt = DateTime.UtcNow
                };
                _context.AppSettings.Add(settings);
                await _context.SaveChangesAsync();
                _logger.LogInformation("Created default app settings");
            }
            return settings;
        }

        public async Task<AppSettings> UpdateAppSettingsAsync(AppSettings settings)
        {
            settings.UpdatedAt = DateTime.UtcNow;
            _context.AppSettings.Update(settings);
            await _context.SaveChangesAsync();
            _logger.LogInformation($"Updated app settings - Domain: {settings.DomainName}");
            return settings;
        }
    }
}