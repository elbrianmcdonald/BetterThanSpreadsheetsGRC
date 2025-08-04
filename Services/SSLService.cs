using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography.X509Certificates;
using System.Text;

namespace CyberRiskApp.Services
{
    public class SSLService : ISSLService
    {
        private readonly CyberRiskContext _context;
        private readonly ILogger<SSLService> _logger;

        public SSLService(CyberRiskContext context, ILogger<SSLService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<IEnumerable<SSLCertificate>> GetAllCertificatesAsync()
        {
            return await _context.SSLCertificates
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();
        }

        public async Task<SSLCertificate?> GetCertificateByIdAsync(int id)
        {
            return await _context.SSLCertificates
                .FirstOrDefaultAsync(c => c.Id == id);
        }

        public async Task<SSLCertificate> CreateCertificateAsync(SSLCertificate certificate)
        {
            certificate.CreatedAt = DateTime.UtcNow;
            _context.SSLCertificates.Add(certificate);
            await _context.SaveChangesAsync();
            return certificate;
        }

        public async Task<SSLCertificate> UpdateCertificateAsync(SSLCertificate certificate)
        {
            certificate.UpdatedAt = DateTime.UtcNow;
            _context.SSLCertificates.Update(certificate);
            await _context.SaveChangesAsync();
            return certificate;
        }

        public async Task<bool> DeleteCertificateAsync(int id)
        {
            var certificate = await _context.SSLCertificates.FindAsync(id);
            if (certificate == null)
                return false;

            // Don't allow deletion of active certificate
            var settings = await GetSSLSettingsAsync();
            if (settings.ActiveCertificateId == id)
                return false;

            _context.SSLCertificates.Remove(certificate);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<(bool isValid, string error, X509Certificate2? cert)> ValidateCertificateAsync(
            byte[] certificateData, byte[]? privateKeyData = null, string? password = null)
        {
            try
            {
                X509Certificate2 cert;
                
                if (privateKeyData != null)
                {
                    // Combine certificate and private key
                    if (!string.IsNullOrEmpty(password))
                    {
                        cert = new X509Certificate2(certificateData, password, X509KeyStorageFlags.Exportable);
                    }
                    else
                    {
                        cert = new X509Certificate2(certificateData);
                    }

                    // Try to load private key separately if needed
                    if (!cert.HasPrivateKey && privateKeyData.Length > 0)
                    {
                        // This is a simplified approach - in production, you'd want more robust private key handling
                        var certWithKey = X509Certificate2.CreateFromPem(
                            Encoding.UTF8.GetString(certificateData),
                            Encoding.UTF8.GetString(privateKeyData));
                        cert = certWithKey;
                    }
                }
                else
                {
                    cert = new X509Certificate2(certificateData, password ?? string.Empty);
                }

                // Validate certificate
                if (cert.NotAfter < DateTime.Now)
                {
                    return (false, "Certificate has expired", null);
                }

                if (cert.NotBefore > DateTime.Now)
                {
                    return (false, "Certificate is not yet valid", null);
                }

                return (true, string.Empty, cert);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating SSL certificate");
                return (false, $"Invalid certificate format: {ex.Message}", null);
            }
        }

        public async Task<SSLCertificate> ProcessUploadedCertificateAsync(
            byte[] certificateData, byte[]? privateKeyData, string? password, string name, string createdBy)
        {
            var (isValid, error, cert) = await ValidateCertificateAsync(certificateData, privateKeyData, password);
            
            if (!isValid || cert == null)
            {
                throw new InvalidOperationException($"Invalid certificate: {error}");
            }

            var sslCertificate = new SSLCertificate
            {
                Name = name,
                CertificateData = Convert.ToBase64String(certificateData),
                PrivateKeyData = privateKeyData != null ? Convert.ToBase64String(privateKeyData) : string.Empty,
                Password = password,
                ValidFrom = cert.NotBefore,
                ValidTo = cert.NotAfter,
                Subject = cert.Subject,
                Issuer = cert.Issuer,
                Thumbprint = cert.Thumbprint,
                CreatedBy = createdBy
            };

            return await CreateCertificateAsync(sslCertificate);
        }

        public async Task<SSLSettings?> GetSSLSettingsAsync()
        {
            try
            {
                return await _context.SSLSettings
                    .Include(s => s.ActiveCertificate)
                    .FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to retrieve SSL settings from database");
                return null;
            }
        }

        public async Task<SSLSettings> GetOrCreateSSLSettingsAsync()
        {
            var settings = await GetSSLSettingsAsync();
            
            if (settings == null)
            {
                settings = new SSLSettings
                {
                    EnableHttpsRedirection = false,
                    RequireHttps = false,
                    HttpsPort = 443,
                    CreatedBy = "System",
                    CreatedAt = DateTime.UtcNow
                };
                _context.SSLSettings.Add(settings);
                await _context.SaveChangesAsync();
                
                // Reload with includes
                settings = await GetSSLSettingsAsync();
            }

            return settings!;
        }

        public async Task<SSLSettings> UpdateSSLSettingsAsync(SSLSettings settings)
        {
            // Use a fresh context query to avoid tracking conflicts
            var existingSettings = await _context.SSLSettings
                .FirstOrDefaultAsync();
            
            if (existingSettings != null)
            {
                // Update the existing tracked entity
                existingSettings.EnableHttpsRedirection = settings.EnableHttpsRedirection;
                existingSettings.RequireHttps = settings.RequireHttps;
                existingSettings.HttpsPort = settings.HttpsPort;
                existingSettings.ActiveCertificateId = settings.ActiveCertificateId;
                existingSettings.UpdatedBy = settings.UpdatedBy;
                existingSettings.UpdatedAt = DateTime.UtcNow;
                
                await _context.SaveChangesAsync();
                return existingSettings;
            }
            else
            {
                // Create new settings record
                settings.CreatedAt = DateTime.UtcNow;
                settings.UpdatedAt = DateTime.UtcNow;
                _context.SSLSettings.Add(settings);
                await _context.SaveChangesAsync();
                return settings;
            }
        }

        public async Task<bool> SetActiveCertificateAsync(int certificateId, string updatedBy)
        {
            var certificate = await GetCertificateByIdAsync(certificateId);
            if (certificate == null || !certificate.IsValid)
                return false;

            // Get settings without includes to avoid tracking conflicts
            var settings = await _context.SSLSettings.FirstOrDefaultAsync();
            
            // Deactivate current certificate
            if (settings?.ActiveCertificateId.HasValue == true)
            {
                var currentCert = await GetCertificateByIdAsync(settings.ActiveCertificateId.Value);
                if (currentCert != null)
                {
                    currentCert.IsActive = false;
                    currentCert.UpdatedAt = DateTime.UtcNow;
                    // Use Update to avoid tracking issues
                    _context.Entry(currentCert).State = EntityState.Modified;
                }
            }

            // Activate new certificate
            certificate.IsActive = true;
            certificate.UpdatedAt = DateTime.UtcNow;
            _context.Entry(certificate).State = EntityState.Modified;

            // Update settings
            if (settings != null)
            {
                settings.ActiveCertificateId = certificateId;
                settings.UpdatedBy = updatedBy;
                settings.UpdatedAt = DateTime.UtcNow;
                // settings is already tracked from the query above
            }
            else
            {
                // Create new settings if none exist
                settings = new SSLSettings
                {
                    ActiveCertificateId = certificateId,
                    EnableHttpsRedirection = false,
                    RequireHttps = false,
                    HttpsPort = 443,
                    CreatedBy = updatedBy,
                    UpdatedBy = updatedBy,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.SSLSettings.Add(settings);
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> InstallCertificateAsync(int certificateId)
        {
            try
            {
                var certificate = await GetCertificateByIdAsync(certificateId);
                if (certificate == null)
                    return false;

                var certData = Convert.FromBase64String(certificate.CertificateData);
                var cert = new X509Certificate2(certData, certificate.Password ?? string.Empty, X509KeyStorageFlags.MachineKeySet);

                // Install to machine store
                using var store = new X509Store(StoreName.My, StoreLocation.LocalMachine);
                store.Open(OpenFlags.ReadWrite);
                store.Add(cert);
                store.Close();

                _logger.LogInformation($"SSL Certificate {certificate.Name} installed successfully");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error installing SSL certificate {certificateId}");
                return false;
            }
        }

        public async Task<bool> RemoveCertificateAsync(int certificateId)
        {
            try
            {
                var certificate = await GetCertificateByIdAsync(certificateId);
                if (certificate == null)
                    return false;

                using var store = new X509Store(StoreName.My, StoreLocation.LocalMachine);
                store.Open(OpenFlags.ReadWrite);
                
                var certs = store.Certificates.Find(X509FindType.FindByThumbprint, certificate.Thumbprint, false);
                foreach (var cert in certs)
                {
                    store.Remove(cert);
                }
                store.Close();

                _logger.LogInformation($"SSL Certificate {certificate.Name} removed successfully");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error removing SSL certificate {certificateId}");
                return false;
            }
        }

        public async Task<IEnumerable<SSLCertificate>> GetExpiringCertificatesAsync(int daysAhead = 30)
        {
            var cutoffDate = DateTime.UtcNow.AddDays(daysAhead);
            return await _context.SSLCertificates
                .Where(c => c.ValidTo <= cutoffDate && c.ValidTo > DateTime.UtcNow)
                .OrderBy(c => c.ValidTo)
                .ToListAsync();
        }

        public async Task<Dictionary<string, object>> GetSSLDashboardDataAsync()
        {
            var totalCerts = await _context.SSLCertificates.CountAsync();
            var activeCerts = await _context.SSLCertificates.CountAsync(c => c.IsActive);
            var expiredCerts = await _context.SSLCertificates.CountAsync(c => c.ValidTo < DateTime.UtcNow);
            var expiringCerts = await GetExpiringCertificatesAsync(30);
            var settings = await GetSSLSettingsAsync();

            return new Dictionary<string, object>
            {
                ["TotalCertificates"] = totalCerts,
                ["ActiveCertificates"] = activeCerts,
                ["ExpiredCertificates"] = expiredCerts,
                ["ExpiringCertificates"] = expiringCerts.Count(),
                ["HttpsRedirectionEnabled"] = settings.EnableHttpsRedirection,
                ["HttpsRequired"] = settings.RequireHttps,
                ["HttpsPort"] = settings.HttpsPort
            };
        }

        public async Task<byte[]> ExportCertificateAsync(int certificateId, bool includePrivateKey = false)
        {
            var certificate = await GetCertificateByIdAsync(certificateId);
            if (certificate == null)
                throw new ArgumentException("Certificate not found");

            if (includePrivateKey && !string.IsNullOrEmpty(certificate.PrivateKeyData))
            {
                // Return the full certificate with private key
                var certData = Convert.FromBase64String(certificate.CertificateData);
                return certData;
            }
            else
            {
                // Return only the public certificate
                var certData = Convert.FromBase64String(certificate.CertificateData);
                var cert = new X509Certificate2(certData);
                return cert.Export(X509ContentType.Cert);
            }
        }
    }
}