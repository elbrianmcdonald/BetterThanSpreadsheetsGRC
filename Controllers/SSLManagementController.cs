using CyberRiskApp.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireAdminRole)]
    public class SSLManagementController : Controller
    {
        private readonly ISSLService _sslService;
        private readonly ILogger<SSLManagementController> _logger;

        public SSLManagementController(ISSLService sslService, ILogger<SSLManagementController> logger)
        {
            _sslService = sslService;
            _logger = logger;
        }

        // GET: SSLManagement
        public async Task<IActionResult> Index()
        {
            var certificates = await _sslService.GetAllCertificatesAsync();
            var settings = await _sslService.GetSSLSettingsAsync();
            var dashboardData = await _sslService.GetSSLDashboardDataAsync();

            ViewBag.Settings = settings;
            ViewBag.DashboardData = dashboardData;
            
            return View(certificates);
        }

        // GET: SSLManagement/Upload
        public IActionResult Upload()
        {
            return View();
        }

        // POST: SSLManagement/Upload
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Upload(string certificateName, IFormFile certificateFile, IFormFile? privateKeyFile, string? password)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(certificateName))
                {
                    ModelState.AddModelError("certificateName", "Certificate name is required");
                }

                if (certificateFile == null || certificateFile.Length == 0)
                {
                    ModelState.AddModelError("certificateFile", "Certificate file is required");
                }

                if (!ModelState.IsValid)
                {
                    return View();
                }

                byte[] certificateData;
                using (var ms = new MemoryStream())
                {
                    await certificateFile!.CopyToAsync(ms);
                    certificateData = ms.ToArray();
                }

                byte[]? privateKeyData = null;
                if (privateKeyFile != null && privateKeyFile.Length > 0)
                {
                    using var ms = new MemoryStream();
                    await privateKeyFile.CopyToAsync(ms);
                    privateKeyData = ms.ToArray();
                }

                var certificate = await _sslService.ProcessUploadedCertificateAsync(
                    certificateData, privateKeyData, password, certificateName, User.Identity?.Name ?? "Unknown");

                TempData["Success"] = $"SSL Certificate '{certificate.Name}' uploaded successfully.";
                return RedirectToAction(nameof(Index));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading SSL certificate");
                TempData["Error"] = $"Error uploading certificate: {ex.Message}";
                return View();
            }
        }

        // GET: SSLManagement/Details/5
        public async Task<IActionResult> Details(int id)
        {
            var certificate = await _sslService.GetCertificateByIdAsync(id);
            if (certificate == null)
            {
                return NotFound();
            }

            return View(certificate);
        }

        // POST: SSLManagement/SetActive/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SetActive(int id)
        {
            try
            {
                var success = await _sslService.SetActiveCertificateAsync(id, User.Identity?.Name ?? "Unknown");
                if (success)
                {
                    TempData["Success"] = "Certificate set as active successfully.";
                }
                else
                {
                    TempData["Error"] = "Failed to set certificate as active. Certificate may be invalid or expired.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error setting certificate {id} as active");
                TempData["Error"] = $"Error setting certificate as active: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // POST: SSLManagement/Install/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Install(int id)
        {
            try
            {
                var success = await _sslService.InstallCertificateAsync(id);
                if (success)
                {
                    TempData["Success"] = "Certificate installed to system store successfully.";
                }
                else
                {
                    TempData["Error"] = "Failed to install certificate to system store.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error installing certificate {id}");
                TempData["Error"] = $"Error installing certificate: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // POST: SSLManagement/Remove/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Remove(int id)
        {
            try
            {
                var success = await _sslService.RemoveCertificateAsync(id);
                if (success)
                {
                    TempData["Success"] = "Certificate removed from system store successfully.";
                }
                else
                {
                    TempData["Error"] = "Failed to remove certificate from system store.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error removing certificate {id}");
                TempData["Error"] = $"Error removing certificate: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // POST: SSLManagement/Delete/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var success = await _sslService.DeleteCertificateAsync(id);
                if (success)
                {
                    TempData["Success"] = "Certificate deleted successfully.";
                }
                else
                {
                    TempData["Error"] = "Failed to delete certificate. It may be the active certificate.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting certificate {id}");
                TempData["Error"] = $"Error deleting certificate: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // GET: SSLManagement/Settings
        public async Task<IActionResult> Settings()
        {
            var settings = await _sslService.GetSSLSettingsAsync();
            return View(settings);
        }

        // POST: SSLManagement/Settings
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Settings(SSLSettings settings)
        {
            try
            {
                if (ModelState.IsValid)
                {
                    settings.UpdatedBy = User.Identity?.Name ?? "Unknown";
                    await _sslService.UpdateSSLSettingsAsync(settings);
                    TempData["Success"] = "SSL settings updated successfully.";
                    return RedirectToAction(nameof(Index));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating SSL settings");
                TempData["Error"] = $"Error updating SSL settings: {ex.Message}";
            }

            return View(settings);
        }

        // GET: SSLManagement/Export/5
        public async Task<IActionResult> Export(int id, bool includePrivateKey = false)
        {
            try
            {
                var certificate = await _sslService.GetCertificateByIdAsync(id);
                if (certificate == null)
                {
                    return NotFound();
                }

                var data = await _sslService.ExportCertificateAsync(id, includePrivateKey);
                var fileName = includePrivateKey ? $"{certificate.Name}.pfx" : $"{certificate.Name}.cer";
                var contentType = includePrivateKey ? "application/x-pkcs12" : "application/x-x509-ca-cert";

                return File(data, contentType, fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error exporting certificate {id}");
                TempData["Error"] = $"Error exporting certificate: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }

        // AJAX: Get expiring certificates
        [HttpGet]
        public async Task<IActionResult> GetExpiringCertificates(int days = 30)
        {
            try
            {
                var certificates = await _sslService.GetExpiringCertificatesAsync(days);
                return Json(new { success = true, certificates });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting expiring certificates");
                return Json(new { success = false, message = ex.Message });
            }
        }

        // AJAX: Get dashboard data
        [HttpGet]
        public async Task<IActionResult> GetDashboardData()
        {
            try
            {
                var data = await _sslService.GetSSLDashboardDataAsync();
                return Json(new { success = true, data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting SSL dashboard data");
                return Json(new { success = false, message = ex.Message });
            }
        }
    }
}