using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Services;
using CyberRiskApp.Authorization;
using CyberRiskApp.Models;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireAdminRole)]
    public class BackupController : Controller
    {
        private readonly IBackupService _backupService;
        private readonly ILogger<BackupController> _logger;

        public BackupController(IBackupService backupService, ILogger<BackupController> logger)
        {
            _backupService = backupService;
            _logger = logger;
        }

        // GET: Backup
        public async Task<IActionResult> Index()
        {
            try
            {
                var backups = await _backupService.GetAvailableBackupsAsync();
                return View(backups);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading backup index");
                TempData["Error"] = "Error loading backups: " + ex.Message;
                return View(Enumerable.Empty<BackupInfo>());
            }
        }

        // GET: Backup/Create
        public IActionResult Create()
        {
            return View();
        }

        // POST: Backup/CreateDatabase
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateDatabase(string backupName, string? description, BackupType backupType = BackupType.DatabaseOnly)
        {
            if (string.IsNullOrWhiteSpace(backupName))
            {
                TempData["Error"] = "Backup name is required.";
                return RedirectToAction(nameof(Create));
            }

            try
            {
                BackupResult result;
                
                if (backupType == BackupType.FullBackup)
                {
                    result = await _backupService.CreateFullBackupAsync(backupName, description);
                }
                else
                {
                    result = await _backupService.CreateDatabaseBackupAsync(backupName, description);
                }

                if (result.Success)
                {
                    TempData["Success"] = result.Message;
                    _logger.LogInformation("Backup created successfully: {BackupName} by {User}", backupName, User.Identity?.Name);
                }
                else
                {
                    TempData["Error"] = result.Message;
                    _logger.LogWarning("Backup creation failed: {BackupName}, Error: {Error}", backupName, result.Message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating backup: {BackupName}", backupName);
                TempData["Error"] = $"Error creating backup: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // POST: Backup/Restore/{fileName}
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Restore(string fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName))
            {
                TempData["Error"] = "Backup file name is required.";
                return RedirectToAction(nameof(Index));
            }

            try
            {
                // Show confirmation dialog via TempData
                if (Request.Form["confirm"] != "true")
                {
                    TempData["ConfirmRestore"] = fileName;
                    TempData["Warning"] = $"Are you sure you want to restore from '{fileName}'? This will overwrite all current data and cannot be undone.";
                    return RedirectToAction(nameof(Index));
                }

                var result = await _backupService.RestoreDatabaseBackupAsync(fileName);

                if (result.Success)
                {
                    TempData["Success"] = result.Message;
                    _logger.LogInformation("Database restored successfully from: {FileName} by {User}", fileName, User.Identity?.Name);
                }
                else
                {
                    TempData["Error"] = result.Message;
                    _logger.LogWarning("Database restore failed: {FileName}, Error: {Error}", fileName, result.Message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring backup: {FileName}", fileName);
                TempData["Error"] = $"Error restoring backup: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // POST: Backup/ConfirmRestore/{fileName}
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ConfirmRestore(string fileName)
        {
            try
            {
                var result = await _backupService.RestoreDatabaseBackupAsync(fileName);

                if (result.Success)
                {
                    TempData["Success"] = result.Message;
                    _logger.LogInformation("Database restored successfully from: {FileName} by {User}", fileName, User.Identity?.Name);
                }
                else
                {
                    TempData["Error"] = result.Message;
                    _logger.LogWarning("Database restore failed: {FileName}, Error: {Error}", fileName, result.Message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring backup: {FileName}", fileName);
                TempData["Error"] = $"Error restoring backup: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // GET: Backup/Download/{fileName}
        public async Task<IActionResult> Download(string fileName)
        {
            try
            {
                var backupInfo = await _backupService.GetBackupInfoAsync(fileName);
                if (backupInfo == null)
                {
                    return NotFound($"Backup file '{fileName}' not found.");
                }

                var fileBytes = await _backupService.DownloadBackupAsync(fileName);
                var contentType = fileName.EndsWith(".zip") ? "application/zip" : "application/sql";

                _logger.LogInformation("Backup downloaded: {FileName} by {User}", fileName, User.Identity?.Name);

                return File(fileBytes, contentType, fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error downloading backup: {FileName}", fileName);
                TempData["Error"] = $"Error downloading backup: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }

        // POST: Backup/Delete/{fileName}
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(string fileName)
        {
            try
            {
                var success = await _backupService.DeleteBackupAsync(fileName);

                if (success)
                {
                    TempData["Success"] = $"Backup '{fileName}' deleted successfully.";
                    _logger.LogInformation("Backup deleted: {FileName} by {User}", fileName, User.Identity?.Name);
                }
                else
                {
                    TempData["Error"] = $"Failed to delete backup '{fileName}'.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting backup: {FileName}", fileName);
                TempData["Error"] = $"Error deleting backup: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // GET: Backup/Details/{fileName}
        public async Task<IActionResult> Details(string fileName)
        {
            try
            {
                var backupInfo = await _backupService.GetBackupInfoAsync(fileName);
                
                if (backupInfo == null)
                {
                    return NotFound($"Backup '{fileName}' not found.");
                }

                return View(backupInfo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting backup details: {FileName}", fileName);
                TempData["Error"] = $"Error loading backup details: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }

        // POST: Backup/Upload
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Upload(IFormFile backupFile, bool restoreImmediately = false)
        {
            if (backupFile == null || backupFile.Length == 0)
            {
                TempData["Error"] = "Please select a backup file to upload.";
                return RedirectToAction(nameof(Index));
            }

            if (!backupFile.FileName.EndsWith(".sql") && !backupFile.FileName.EndsWith(".zip"))
            {
                TempData["Error"] = "Only .sql and .zip backup files are supported.";
                return RedirectToAction(nameof(Index));
            }

            try
            {
                using var stream = backupFile.OpenReadStream();
                
                if (restoreImmediately)
                {
                    var result = await _backupService.UploadAndRestoreBackupAsync(stream, backupFile.FileName);
                    
                    if (result.Success)
                    {
                        TempData["Success"] = $"Backup uploaded and restored successfully: {result.Message}";
                        _logger.LogInformation("Backup uploaded and restored: {FileName} by {User}", backupFile.FileName, User.Identity?.Name);
                    }
                    else
                    {
                        TempData["Error"] = $"Failed to restore uploaded backup: {result.Message}";
                    }
                }
                else
                {
                    // Just save the file for later use
                    var backupsPath = Path.Combine(Directory.GetCurrentDirectory(), "Backups");
                    Directory.CreateDirectory(backupsPath);
                    
                    var filePath = Path.Combine(backupsPath, backupFile.FileName);
                    
                    using var fileStream = new FileStream(filePath, FileMode.Create);
                    await stream.CopyToAsync(fileStream);
                    
                    TempData["Success"] = $"Backup '{backupFile.FileName}' uploaded successfully.";
                    _logger.LogInformation("Backup uploaded: {FileName} by {User}", backupFile.FileName, User.Identity?.Name);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading backup: {FileName}", backupFile.FileName);
                TempData["Error"] = $"Error uploading backup: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // POST: Backup/Validate/{fileName}
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Validate(string fileName)
        {
            try
            {
                var result = await _backupService.ValidateBackupFileAsync(fileName);

                if (result.Success)
                {
                    TempData["Success"] = $"Backup '{fileName}' is valid and ready for restore.";
                }
                else
                {
                    TempData["Error"] = $"Backup validation failed: {result.Message}";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating backup: {FileName}", fileName);
                TempData["Error"] = $"Error validating backup: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // POST: Backup/Cleanup
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Cleanup(int keepDays = 30)
        {
            try
            {
                await _backupService.CleanupOldBackupsAsync(keepDays);
                TempData["Success"] = $"Old backups cleanup completed. Kept backups from the last {keepDays} days.";
                _logger.LogInformation("Backup cleanup performed by {User}, kept {KeepDays} days", User.Identity?.Name, keepDays);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during backup cleanup");
                TempData["Error"] = $"Error during cleanup: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // GET: Backup/GetBackupSize/{fileName}
        [HttpGet]
        public async Task<IActionResult> GetBackupSize(string fileName)
        {
            try
            {
                var size = await _backupService.GetBackupSizeAsync(fileName);
                return Json(new { success = true, size = size });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, error = ex.Message });
            }
        }
    }
}