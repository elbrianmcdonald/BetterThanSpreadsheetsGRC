using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IBackupService
    {
        Task<BackupResult> CreateDatabaseBackupAsync(string backupName, string? description = null);
        Task<BackupResult> CreateFullBackupAsync(string backupName, string? description = null);
        Task<IEnumerable<BackupInfo>> GetAvailableBackupsAsync();
        Task<BackupResult> RestoreDatabaseBackupAsync(string backupFileName);
        Task<BackupResult> RestoreDatabaseBackupAsync(string backupFileName, IProgress<BackupProgress>? progress);
        Task<bool> DeleteBackupAsync(string backupFileName);
        Task<BackupInfo?> GetBackupInfoAsync(string backupFileName);
        Task<byte[]> DownloadBackupAsync(string backupFileName);
        Task<BackupResult> UploadAndRestoreBackupAsync(Stream backupStream, string fileName);
        Task<BackupResult> ValidateBackupFileAsync(string backupFileName);
        Task<long> GetBackupSizeAsync(string backupFileName);
        Task CleanupOldBackupsAsync(int keepDays = 30);
    }

    public class BackupResult
    {
        public bool Success { get; set; }
        public string? Message { get; set; }
        public string? BackupFileName { get; set; }
        public long? BackupSize { get; set; }
        public DateTime? BackupDate { get; set; }
        public Exception? Exception { get; set; }

        public static BackupResult SuccessResult(string message, string? fileName = null, long? size = null)
        {
            return new BackupResult
            {
                Success = true,
                Message = message,
                BackupFileName = fileName,
                BackupSize = size,
                BackupDate = DateTime.UtcNow
            };
        }

        public static BackupResult ErrorResult(string message, Exception? exception = null)
        {
            return new BackupResult
            {
                Success = false,
                Message = message,
                Exception = exception
            };
        }
    }

    public class BackupInfo
    {
        public string FileName { get; set; } = string.Empty;
        public string BackupName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; }
        public long SizeInBytes { get; set; }
        public BackupType Type { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public bool IsValid { get; set; } = true;
        public string? ValidationMessage { get; set; }

        public string FormattedSize => FormatBytes(SizeInBytes);
        public string FormattedDate => CreatedAt.ToString("MMM dd, yyyy HH:mm");

        private static string FormatBytes(long bytes)
        {
            string[] suffixes = { "B", "KB", "MB", "GB", "TB" };
            int counter = 0;
            decimal number = bytes;
            while (Math.Round(number / 1024) >= 1)
            {
                number /= 1024;
                counter++;
            }
            return $"{number:n1} {suffixes[counter]}";
        }
    }

    public enum BackupType
    {
        DatabaseOnly,
        FullBackup,
        ConfigurationOnly
    }

    public class BackupProgress
    {
        public string CurrentStep { get; set; } = string.Empty;
        public int PercentComplete { get; set; }
        public string? Details { get; set; }
        public BackupProgressState State { get; set; }
    }

    public enum BackupProgressState
    {
        Starting,
        ValidatingFile,
        ExtractingData,
        RestoringDatabase,
        VerifyingRestore,
        Completed,
        Failed
    }
}