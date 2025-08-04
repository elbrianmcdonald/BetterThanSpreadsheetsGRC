using CyberRiskApp.Models;
using System.Security.Cryptography.X509Certificates;

namespace CyberRiskApp.Services
{
    public interface ISSLService
    {
        // Certificate Management
        Task<IEnumerable<SSLCertificate>> GetAllCertificatesAsync();
        Task<SSLCertificate?> GetCertificateByIdAsync(int id);
        Task<SSLCertificate> CreateCertificateAsync(SSLCertificate certificate);
        Task<SSLCertificate> UpdateCertificateAsync(SSLCertificate certificate);
        Task<bool> DeleteCertificateAsync(int id);

        // Certificate Validation and Processing
        Task<(bool isValid, string error, X509Certificate2? cert)> ValidateCertificateAsync(byte[] certificateData, byte[]? privateKeyData = null, string? password = null);
        Task<SSLCertificate> ProcessUploadedCertificateAsync(byte[] certificateData, byte[]? privateKeyData, string? password, string name, string createdBy);

        // SSL Settings Management
        Task<SSLSettings?> GetSSLSettingsAsync();
        Task<SSLSettings> GetOrCreateSSLSettingsAsync();
        Task<SSLSettings> UpdateSSLSettingsAsync(SSLSettings settings);
        Task<bool> SetActiveCertificateAsync(int certificateId, string updatedBy);

        // Certificate Installation
        Task<bool> InstallCertificateAsync(int certificateId);
        Task<bool> RemoveCertificateAsync(int certificateId);

        // Monitoring and Alerts
        Task<IEnumerable<SSLCertificate>> GetExpiringCertificatesAsync(int daysAhead = 30);
        Task<Dictionary<string, object>> GetSSLDashboardDataAsync();

        // Certificate Export (for backup purposes)
        Task<byte[]> ExportCertificateAsync(int certificateId, bool includePrivateKey = false);
    }
}