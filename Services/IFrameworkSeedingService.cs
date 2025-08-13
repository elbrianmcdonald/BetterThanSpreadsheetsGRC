using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IFrameworkSeedingService
    {
        /// <summary>
        /// Seeds all default frameworks from Excel files in the grc imports folder
        /// </summary>
        Task SeedDefaultFrameworksAsync();

        /// <summary>
        /// Seeds a specific maturity framework from an Excel file
        /// </summary>
        Task SeedMaturityFrameworkAsync(string filePath, string name, string version, string description, FrameworkType type);

        /// <summary>
        /// Seeds a specific compliance framework from an Excel file
        /// </summary>
        Task SeedComplianceFrameworkAsync(string filePath, string name, string version, string description);

        /// <summary>
        /// Checks if framework seeding is needed (no frameworks exist)
        /// </summary>
        Task<bool> IsFrameworkSeedingNeededAsync();
    }
}