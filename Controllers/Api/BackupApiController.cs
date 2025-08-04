using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Services;
using CyberRiskApp.Authorization;
using System.Collections.Concurrent;

namespace CyberRiskApp.Controllers.Api
{
    [Route("api/backup")]
    [ApiController]
    [Authorize(Policy = PolicyConstants.RequireAdminRole)]
    [IgnoreAntiforgeryToken]
    public class BackupApiController : ControllerBase
    {
        private readonly IBackupService _backupService;
        private readonly ILogger<BackupApiController> _logger;
        private static readonly ConcurrentDictionary<string, BackupProgress> _restoreProgress = new();

        public BackupApiController(IBackupService backupService, ILogger<BackupApiController> logger)
        {
            _backupService = backupService;
            _logger = logger;
        }

        [HttpPost("restore/{fileName}")]
        public async Task<IActionResult> RestoreBackup(string fileName)
        {
            var progressId = Guid.NewGuid().ToString();
            var progress = new Progress<BackupProgress>(p =>
            {
                _restoreProgress[progressId] = p;
            });

            // Start restore in background
            _ = Task.Run(async () =>
            {
                try
                {
                    await _backupService.RestoreDatabaseBackupAsync(fileName, progress);
                }
                finally
                {
                    // Clean up progress after 5 minutes
                    await Task.Delay(TimeSpan.FromMinutes(5));
                    _restoreProgress.TryRemove(progressId, out _);
                }
            });

            return Ok(new { progressId });
        }

        [HttpGet("restore/progress/{progressId}")]
        public IActionResult GetRestoreProgress(string progressId)
        {
            if (_restoreProgress.TryGetValue(progressId, out var progress))
            {
                return Ok(progress);
            }

            return NotFound(new { message = "Progress not found" });
        }

        [HttpGet("validate/{fileName}")]
        public async Task<IActionResult> ValidateBackup(string fileName)
        {
            var result = await _backupService.ValidateBackupFileAsync(fileName);
            return Ok(new
            {
                isValid = result.Success,
                message = result.Message
            });
        }

        [HttpGet("size/{fileName}")]
        public async Task<IActionResult> GetBackupSize(string fileName)
        {
            var size = await _backupService.GetBackupSizeAsync(fileName);
            return Ok(new { size });
        }
    }
}