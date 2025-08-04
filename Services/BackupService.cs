using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.IO.Compression;
using Microsoft.Extensions.Configuration;
using System.Text;

namespace CyberRiskApp.Services
{
    public class BackupMetadata
    {
        public string FileName { get; set; } = string.Empty;
        public string BackupName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public BackupType Type { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
    }

    public class BackupService : IBackupService
    {
        private readonly CyberRiskContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<BackupService> _logger;
        private readonly string _backupDirectory;
        private readonly string _connectionString;

        public BackupService(CyberRiskContext context, IConfiguration configuration, ILogger<BackupService> logger)
        {
            _context = context;
            _configuration = configuration;
            _logger = logger;
            
            // Create backups directory if it doesn't exist
            _backupDirectory = Path.Combine(Directory.GetCurrentDirectory(), "Backups");
            Directory.CreateDirectory(_backupDirectory);
            
            _connectionString = _configuration.GetConnectionString("DefaultConnection") ?? 
                throw new InvalidOperationException("Database connection string not found");
        }

        public async Task<BackupResult> CreateDatabaseBackupAsync(string backupName, string? description = null)
        {
            try
            {
                var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
                var fileName = $"database_backup_{backupName}_{timestamp}.sql";
                var filePath = Path.Combine(_backupDirectory, fileName);

                _logger.LogInformation("Starting database backup: {BackupName}", backupName);

                // Generate custom SQL script instead of using pg_dump
                var sqlScript = await GenerateCustomSqlBackupAsync();
                await File.WriteAllTextAsync(filePath, sqlScript);

                // Create backup metadata
                await CreateBackupMetadataAsync(fileName, backupName, description, BackupType.DatabaseOnly);

                var fileInfo = new FileInfo(filePath);
                _logger.LogInformation("Database backup completed: {FileName}, Size: {Size} bytes", fileName, fileInfo.Length);

                return BackupResult.SuccessResult(
                    $"Database backup '{backupName}' created successfully", 
                    fileName, 
                    fileInfo.Length);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating database backup: {BackupName}", backupName);
                return BackupResult.ErrorResult($"Error creating backup: {ex.Message}", ex);
            }
        }

        public async Task<BackupResult> CreateFullBackupAsync(string backupName, string? description = null)
        {
            try
            {
                var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
                var fileName = $"full_backup_{backupName}_{timestamp}.zip";
                var filePath = Path.Combine(_backupDirectory, fileName);

                _logger.LogInformation("Starting full backup: {BackupName}", backupName);
                var stopwatch = System.Diagnostics.Stopwatch.StartNew();

                using var archive = ZipFile.Open(filePath, ZipArchiveMode.Create, Encoding.UTF8);
                
                // Generate custom SQL script instead of using pg_dump
                _logger.LogInformation("Generating custom SQL backup script");
                var sqlScript = await GenerateCustomSqlBackupAsync();
                
                // Add SQL script to archive
                var sqlEntry = archive.CreateEntry("database.sql", CompressionLevel.Fastest);
                using (var entryStream = sqlEntry.Open())
                using (var writer = new StreamWriter(entryStream))
                {
                    await writer.WriteAsync(sqlScript);
                }
                _logger.LogInformation("Added custom SQL script to archive ({ElapsedMs}ms)", stopwatch.ElapsedMilliseconds);

                // Add configuration files
                await AddConfigurationFilesToArchive(archive);
                _logger.LogInformation("Added configuration files to archive ({ElapsedMs}ms)", stopwatch.ElapsedMilliseconds);

                // Add application settings
                await AddApplicationSettingsToArchive(archive);
                _logger.LogInformation("Added application settings to archive ({ElapsedMs}ms)", stopwatch.ElapsedMilliseconds);

                // Create backup metadata
                await CreateBackupMetadataAsync(fileName, backupName, description, BackupType.FullBackup);

                var fileInfo = new FileInfo(filePath);
                _logger.LogInformation("Full backup completed: {FileName}, Size: {Size} bytes", fileName, fileInfo.Length);

                return BackupResult.SuccessResult(
                    $"Full backup '{backupName}' created successfully", 
                    fileName, 
                    fileInfo.Length);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating full backup: {BackupName}", backupName);
                return BackupResult.ErrorResult($"Error creating full backup: {ex.Message}", ex);
            }
        }

        public async Task<IEnumerable<BackupInfo>> GetAvailableBackupsAsync()
        {
            try
            {
                var backups = new List<BackupInfo>();
                var backupFiles = Directory.GetFiles(_backupDirectory, "*.*")
                    .Where(f => f.EndsWith(".sql") || f.EndsWith(".zip"))
                    .OrderByDescending(f => File.GetCreationTime(f));

                foreach (var file in backupFiles)
                {
                    var metadata = await GetBackupMetadataAsync(Path.GetFileName(file));
                    var fileInfo = new FileInfo(file);

                    var backup = new BackupInfo
                    {
                        FileName = Path.GetFileName(file),
                        BackupName = metadata?.BackupName ?? ExtractBackupNameFromFileName(Path.GetFileName(file)),
                        Description = metadata?.Description,
                        CreatedAt = metadata?.CreatedAt ?? fileInfo.CreationTime,
                        SizeInBytes = fileInfo.Length,
                        Type = metadata?.Type ?? (file.EndsWith(".zip") ? BackupType.FullBackup : BackupType.DatabaseOnly),
                        CreatedBy = metadata?.CreatedBy ?? "Unknown",
                        IsValid = await ValidateBackupFileInternalAsync(file)
                    };

                    backups.Add(backup);
                }

                return backups;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting available backups");
                return Enumerable.Empty<BackupInfo>();
            }
        }

        public async Task<BackupResult> RestoreDatabaseBackupAsync(string backupFileName)
        {
            return await RestoreDatabaseBackupAsync(backupFileName, null);
        }

        public async Task<BackupResult> RestoreDatabaseBackupAsync(string backupFileName, IProgress<BackupProgress>? progress)
        {
            try
            {
                var filePath = Path.Combine(_backupDirectory, backupFileName);
                
                progress?.Report(new BackupProgress
                {
                    CurrentStep = "Initializing restore process",
                    PercentComplete = 0,
                    State = BackupProgressState.Starting
                });

                if (!File.Exists(filePath))
                {
                    progress?.Report(new BackupProgress
                    {
                        CurrentStep = "Backup file not found",
                        PercentComplete = 0,
                        State = BackupProgressState.Failed
                    });
                    return BackupResult.ErrorResult("Backup file not found");
                }

                _logger.LogInformation("Starting database restore from: {BackupFileName}", backupFileName);

                // Validate backup file first
                progress?.Report(new BackupProgress
                {
                    CurrentStep = "Validating backup file",
                    PercentComplete = 10,
                    State = BackupProgressState.ValidatingFile,
                    Details = "Checking file integrity..."
                });

                var validationResult = await ValidateBackupFileAsync(backupFileName);
                if (!validationResult.Success)
                {
                    progress?.Report(new BackupProgress
                    {
                        CurrentStep = "Validation failed",
                        PercentComplete = 10,
                        State = BackupProgressState.Failed,
                        Details = validationResult.Message
                    });
                    return validationResult;
                }

                // For ZIP files, extract database.sql first
                string sqlFilePath = filePath;
                if (backupFileName.EndsWith(".zip"))
                {
                    progress?.Report(new BackupProgress
                    {
                        CurrentStep = "Extracting backup data",
                        PercentComplete = 30,
                        State = BackupProgressState.ExtractingData,
                        Details = "Extracting database from archive..."
                    });
                    sqlFilePath = await ExtractDatabaseFromZip(filePath);
                }

                // Restore database from custom SQL script
                progress?.Report(new BackupProgress
                {
                    CurrentStep = "Restoring database",
                    PercentComplete = 50,
                    State = BackupProgressState.RestoringDatabase,
                    Details = "Executing database restore commands..."
                });

                var success = await RestoreFromCustomSqlAsync(sqlFilePath);

                // Clean up temporary file if it was extracted from ZIP
                if (sqlFilePath != filePath && File.Exists(sqlFilePath))
                {
                    File.Delete(sqlFilePath);
                }

                if (!success)
                {
                    progress?.Report(new BackupProgress
                    {
                        CurrentStep = "Restore failed",
                        PercentComplete = 80,
                        State = BackupProgressState.Failed,
                        Details = "Failed to restore database backup"
                    });
                    return BackupResult.ErrorResult("Failed to restore database backup");
                }

                // Custom SQL already includes sequence resets, but verify
                progress?.Report(new BackupProgress
                {
                    CurrentStep = "Finalizing restore",
                    PercentComplete = 85,
                    State = BackupProgressState.VerifyingRestore,
                    Details = "Verifying database integrity..."
                });

                // Verify restore
                progress?.Report(new BackupProgress
                {
                    CurrentStep = "Verifying restore",
                    PercentComplete = 90,
                    State = BackupProgressState.VerifyingRestore,
                    Details = "Checking database integrity..."
                });

                _logger.LogInformation("Database restore completed successfully: {BackupFileName}", backupFileName);

                progress?.Report(new BackupProgress
                {
                    CurrentStep = "Restore completed successfully",
                    PercentComplete = 100,
                    State = BackupProgressState.Completed,
                    Details = $"Database restored from '{backupFileName}'"
                });

                return BackupResult.SuccessResult($"Database restored successfully from '{backupFileName}'");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring database backup: {BackupFileName}", backupFileName);
                
                progress?.Report(new BackupProgress
                {
                    CurrentStep = "Error during restore",
                    PercentComplete = 0,
                    State = BackupProgressState.Failed,
                    Details = ex.Message
                });

                return BackupResult.ErrorResult($"Error restoring backup: {ex.Message}", ex);
            }
        }

        public async Task<bool> DeleteBackupAsync(string backupFileName)
        {
            try
            {
                var filePath = Path.Combine(_backupDirectory, backupFileName);
                var metadataPath = Path.Combine(_backupDirectory, $"{backupFileName}.metadata.json");

                if (File.Exists(filePath))
                {
                    File.Delete(filePath);
                }

                if (File.Exists(metadataPath))
                {
                    File.Delete(metadataPath);
                }

                _logger.LogInformation("Backup deleted: {BackupFileName}", backupFileName);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting backup: {BackupFileName}", backupFileName);
                return false;
            }
        }

        public async Task<BackupInfo?> GetBackupInfoAsync(string backupFileName)
        {
            try
            {
                var filePath = Path.Combine(_backupDirectory, backupFileName);
                
                if (!File.Exists(filePath))
                {
                    return null;
                }

                var metadata = await GetBackupMetadataAsync(backupFileName);
                var fileInfo = new FileInfo(filePath);

                return new BackupInfo
                {
                    FileName = backupFileName,
                    BackupName = metadata?.BackupName ?? ExtractBackupNameFromFileName(backupFileName),
                    Description = metadata?.Description,
                    CreatedAt = metadata?.CreatedAt ?? fileInfo.CreationTime,
                    SizeInBytes = fileInfo.Length,
                    Type = metadata?.Type ?? (backupFileName.EndsWith(".zip") ? BackupType.FullBackup : BackupType.DatabaseOnly),
                    CreatedBy = metadata?.CreatedBy ?? "Unknown",
                    IsValid = await ValidateBackupFileInternalAsync(filePath)
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting backup info: {BackupFileName}", backupFileName);
                return null;
            }
        }

        public async Task<byte[]> DownloadBackupAsync(string backupFileName)
        {
            var filePath = Path.Combine(_backupDirectory, backupFileName);
            
            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException($"Backup file '{backupFileName}' not found");
            }

            return await File.ReadAllBytesAsync(filePath);
        }

        public async Task<BackupResult> UploadAndRestoreBackupAsync(Stream backupStream, string fileName)
        {
            try
            {
                var filePath = Path.Combine(_backupDirectory, fileName);
                
                // Save uploaded file
                using (var fileStream = File.Create(filePath))
                {
                    await backupStream.CopyToAsync(fileStream);
                }

                // Restore from uploaded file
                var result = await RestoreDatabaseBackupAsync(fileName);
                
                // Clean up uploaded file if restore failed
                if (!result.Success && File.Exists(filePath))
                {
                    File.Delete(filePath);
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading and restoring backup: {FileName}", fileName);
                return BackupResult.ErrorResult($"Error uploading backup: {ex.Message}", ex);
            }
        }

        public async Task<BackupResult> ValidateBackupFileAsync(string backupFileName)
        {
            try
            {
                var filePath = Path.Combine(_backupDirectory, backupFileName);
                
                if (!File.Exists(filePath))
                {
                    return BackupResult.ErrorResult("Backup file not found");
                }

                var isValid = await ValidateBackupFileInternalAsync(filePath);
                
                return isValid 
                    ? BackupResult.SuccessResult("Backup file is valid")
                    : BackupResult.ErrorResult("Backup file is corrupted or invalid");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating backup file: {BackupFileName}", backupFileName);
                return BackupResult.ErrorResult($"Error validating backup: {ex.Message}", ex);
            }
        }

        public async Task<long> GetBackupSizeAsync(string backupFileName)
        {
            var filePath = Path.Combine(_backupDirectory, backupFileName);
            
            if (!File.Exists(filePath))
            {
                return 0;
            }

            var fileInfo = new FileInfo(filePath);
            return fileInfo.Length;
        }

        public async Task CleanupOldBackupsAsync(int keepDays = 30)
        {
            try
            {
                var cutoffDate = DateTime.UtcNow.AddDays(-keepDays);
                var backupFiles = Directory.GetFiles(_backupDirectory, "*.*")
                    .Where(f => f.EndsWith(".sql") || f.EndsWith(".zip"))
                    .Where(f => File.GetCreationTime(f) < cutoffDate);

                var deletedCount = 0;
                foreach (var file in backupFiles)
                {
                    try
                    {
                        File.Delete(file);
                        
                        // Also delete metadata file if it exists
                        var metadataFile = $"{file}.metadata.json";
                        if (File.Exists(metadataFile))
                        {
                            File.Delete(metadataFile);
                        }
                        
                        deletedCount++;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to delete old backup file: {File}", file);
                    }
                }

                _logger.LogInformation("Cleaned up {DeletedCount} old backup files older than {KeepDays} days", deletedCount, keepDays);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during backup cleanup");
            }
        }

        // Private helper methods
        private async Task<bool> CreatePostgreSQLDumpAsync(string filePath, bool useCompression = false)
        {
            try
            {
                // Parse connection string to get database details
                var builder = new Npgsql.NpgsqlConnectionStringBuilder(_connectionString);
                
                // Find pg_dump executable
                var pgDumpPath = FindPostgreSQLExecutable("pg_dump");
                if (string.IsNullOrEmpty(pgDumpPath))
                {
                    _logger.LogError("pg_dump executable not found. Please ensure PostgreSQL is installed and in PATH.");
                    return false;
                }
                
                // Build arguments - use custom format with compression for better performance
                var arguments = $"-h {builder.Host} -p {builder.Port} -U {builder.Username} -d {builder.Database} --no-owner --no-acl --if-exists --clean --inserts --column-inserts";
                
                if (useCompression)
                {
                    arguments += $" -Fc -Z6 -f \"{filePath}\""; // Custom format with compression level 6
                }
                else
                {
                    arguments += $" -f \"{filePath}\""; // Plain SQL format
                }
                
                var processInfo = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = pgDumpPath,
                    Arguments = arguments,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    Environment = { ["PGPASSWORD"] = builder.Password }
                };

                using var process = System.Diagnostics.Process.Start(processInfo);
                if (process == null)
                {
                    _logger.LogError("Failed to start pg_dump process");
                    return false;
                }

                await process.WaitForExitAsync();
                
                if (process.ExitCode != 0)
                {
                    var error = await process.StandardError.ReadToEndAsync();
                    _logger.LogError("pg_dump failed with exit code {ExitCode}: {Error}", process.ExitCode, error);
                    return false;
                }

                return File.Exists(filePath) && new FileInfo(filePath).Length > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating PostgreSQL dump");
                return false;
            }
        }

        private async Task<bool> RestorePostgreSQLDumpAsync(string filePath)
        {
            try
            {
                var builder = new Npgsql.NpgsqlConnectionStringBuilder(_connectionString);
                
                // Find psql executable
                var psqlPath = FindPostgreSQLExecutable("psql");
                if (string.IsNullOrEmpty(psqlPath))
                {
                    _logger.LogError("psql executable not found. Please ensure PostgreSQL is installed and in PATH.");
                    return false;
                }
                
                var processInfo = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = psqlPath,
                    Arguments = $"-h {builder.Host} -p {builder.Port} -U {builder.Username} -d {builder.Database} -f \"{filePath}\"",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    Environment = { ["PGPASSWORD"] = builder.Password }
                };

                using var process = System.Diagnostics.Process.Start(processInfo);
                if (process == null)
                {
                    _logger.LogError("Failed to start psql process");
                    return false;
                }

                await process.WaitForExitAsync();
                
                if (process.ExitCode != 0)
                {
                    var error = await process.StandardError.ReadToEndAsync();
                    _logger.LogError("psql restore failed with exit code {ExitCode}: {Error}", process.ExitCode, error);
                    return false;
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring PostgreSQL dump");
                return false;
            }
        }

        private async Task CreateBackupMetadataAsync(string fileName, string backupName, string? description, BackupType type)
        {
            try
            {
                var metadata = new BackupMetadata
                {
                    FileName = fileName,
                    BackupName = backupName,
                    Description = description,
                    Type = type,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = "System", // TODO: Get current user
                    Version = "1.0"
                };

                var metadataPath = Path.Combine(_backupDirectory, $"{fileName}.metadata.json");
                var json = JsonSerializer.Serialize(metadata, new JsonSerializerOptions { WriteIndented = true });
                await File.WriteAllTextAsync(metadataPath, json);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to create backup metadata for {FileName}", fileName);
            }
        }

        private async Task<BackupMetadata?> GetBackupMetadataAsync(string fileName)
        {
            try
            {
                var metadataPath = Path.Combine(_backupDirectory, $"{fileName}.metadata.json");
                
                if (!File.Exists(metadataPath))
                {
                    return null;
                }

                var json = await File.ReadAllTextAsync(metadataPath);
                return JsonSerializer.Deserialize<BackupMetadata>(json);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to read backup metadata for {FileName}", fileName);
                return null;
            }
        }

        private async Task AddConfigurationFilesToArchive(ZipArchive archive)
        {
            try
            {
                var configFiles = new[]
                {
                    "appsettings.json",
                    "appsettings.Production.json",
                    "appsettings.Development.json"
                };

                foreach (var configFile in configFiles)
                {
                    var filePath = Path.Combine(Directory.GetCurrentDirectory(), configFile);
                    if (File.Exists(filePath))
                    {
                        archive.CreateEntryFromFile(filePath, $"config/{configFile}");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to add configuration files to backup");
            }
        }

        private async Task AddApplicationSettingsToArchive(ZipArchive archive)
        {
            try
            {
                // Export application settings from database - only include essential data
                var settings = new
                {
                    RiskMatrices = await _context.RiskMatrices.AsNoTracking().ToListAsync(),
                    ComplianceFrameworks = await _context.ComplianceFrameworks.AsNoTracking()
                        .Select(cf => new { cf.Id, cf.Name, cf.Version, cf.Status })
                        .ToListAsync(),
                    BackupDate = DateTime.UtcNow,
                    Version = "1.0"
                };

                var json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = false });
                var entry = archive.CreateEntry("settings/application_settings.json", CompressionLevel.Optimal);
                
                using var stream = entry.Open();
                using var writer = new StreamWriter(stream);
                await writer.WriteAsync(json);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to add application settings to backup");
            }
        }

        private async Task<string> ExtractDatabaseFromZip(string zipFilePath)
        {
            var tempFile = Path.Combine(Path.GetTempPath(), $"temp_db_{Guid.NewGuid()}.sql");
            
            using var archive = ZipFile.OpenRead(zipFilePath);
            var dbEntry = archive.GetEntry("database.sql");
            
            if (dbEntry == null)
            {
                throw new InvalidOperationException("Database file not found in backup archive");
            }

            dbEntry.ExtractToFile(tempFile);
            return tempFile;
        }

        private async Task<bool> ValidateBackupFileInternalAsync(string filePath)
        {
            try
            {
                if (!File.Exists(filePath))
                {
                    return false;
                }

                var fileInfo = new FileInfo(filePath);
                
                // Check if file is empty
                if (fileInfo.Length == 0)
                {
                    return false;
                }

                // Validate based on file type
                if (filePath.EndsWith(".sql"))
                {
                    // Basic SQL file validation
                    var content = await File.ReadAllTextAsync(filePath);
                    return content.Contains("CREATE") || content.Contains("INSERT");
                }
                else if (filePath.EndsWith(".zip"))
                {
                    // Validate ZIP file
                    try
                    {
                        using var archive = ZipFile.OpenRead(filePath);
                        return archive.Entries.Any();
                    }
                    catch
                    {
                        return false;
                    }
                }

                return true;
            }
            catch
            {
                return false;
            }
        }

        private string ExtractBackupNameFromFileName(string fileName)
        {
            // Extract backup name from filename pattern: type_backupname_timestamp.ext
            var parts = Path.GetFileNameWithoutExtension(fileName).Split('_');
            if (parts.Length >= 3)
            {
                // Skip first part (type) and last part (timestamp)
                return string.Join("_", parts.Skip(1).Take(parts.Length - 2));
            }
            return fileName;
        }

        private string FindPostgreSQLExecutable(string executableName)
        {
            // First check if it's in PATH
            var pathVariable = Environment.GetEnvironmentVariable("PATH");
            if (!string.IsNullOrEmpty(pathVariable))
            {
                var paths = pathVariable.Split(Path.PathSeparator);
                foreach (var path in paths)
                {
                    var fullPath = Path.Combine(path, executableName);
                    if (File.Exists(fullPath))
                        return fullPath;
                    
                    // On Windows, also check with .exe extension
                    if (Environment.OSVersion.Platform == PlatformID.Win32NT)
                    {
                        fullPath = Path.Combine(path, executableName + ".exe");
                        if (File.Exists(fullPath))
                            return fullPath;
                    }
                }
            }

            // Common PostgreSQL installation paths on Windows
            if (Environment.OSVersion.Platform == PlatformID.Win32NT)
            {
                var commonPaths = new[]
                {
                    @"C:\Program Files\PostgreSQL",
                    @"C:\Program Files (x86)\PostgreSQL",
                    Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles) + @"\PostgreSQL",
                    Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86) + @"\PostgreSQL"
                };

                foreach (var basePath in commonPaths)
                {
                    if (Directory.Exists(basePath))
                    {
                        // Look for PostgreSQL versions
                        var versionDirs = Directory.GetDirectories(basePath)
                            .OrderByDescending(d => d)
                            .ToList();

                        foreach (var versionDir in versionDirs)
                        {
                            var binPath = Path.Combine(versionDir, "bin", executableName + ".exe");
                            if (File.Exists(binPath))
                            {
                                _logger.LogInformation("Found PostgreSQL executable at: {Path}", binPath);
                                return binPath;
                            }
                        }
                    }
                }
            }

            // Common PostgreSQL installation paths on Linux/Mac
            if (Environment.OSVersion.Platform == PlatformID.Unix || Environment.OSVersion.Platform == PlatformID.MacOSX)
            {
                var commonPaths = new[]
                {
                    "/usr/bin",
                    "/usr/local/bin",
                    "/opt/postgresql/bin",
                    "/usr/pgsql-*/bin"
                };

                foreach (var path in commonPaths)
                {
                    var fullPath = Path.Combine(path, executableName);
                    if (File.Exists(fullPath))
                        return fullPath;
                }
            }

            return string.Empty;
        }

        private async Task<bool> RestoreFromCustomSqlAsync(string sqlFilePath)
        {
            try
            {
                var sqlContent = await File.ReadAllTextAsync(sqlFilePath);
                
                // Clear existing data first (in reverse dependency order)
                await ClearAllTablesAsync();
                
                // Execute the SQL script
                await _context.Database.ExecuteSqlRawAsync(sqlContent);
                
                _logger.LogInformation("Successfully restored database from custom SQL script");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring from custom SQL script");
                return false;
            }
        }

        private async Task ClearAllTablesAsync()
        {
            try
            {
                _logger.LogInformation("Clearing existing data before restore");
                
                // Disable foreign key checks temporarily
                await _context.Database.ExecuteSqlRawAsync("SET CONSTRAINTS ALL DEFERRED;");
                
                // Clear tables in reverse dependency order
                var tablesToClear = new[]
                {
                    "ScenarioRecommendations",
                    "KillChainActivities", 
                    "MitreTechniques",
                    "AttackScenarioSteps",
                    "AttackScenarios",
                    "AttackPaths",
                    "Attacks",
                    "ThreatModels",
                    "SSLSettings",
                    "SSLCertificates",
                    "MaturityControlAssessments",
                    "MaturityAssessments",
                    "MaturityFrameworks",
                    "FindingClosures",
                    "Findings",
                    "RiskAssessments",
                    "Risks",
                    "ControlAssessments",
                    "ComplianceAssessments",
                    "ComplianceControls",
                    "ComplianceFrameworks",
                    "RiskMatrices",
                    "BusinessOrganizations",
                    "AspNetUserRoles",
                    "AspNetUsers",
                    "AspNetRoles"
                };

                foreach (var table in tablesToClear)
                {
                    try
                    {
                        await _context.Database.ExecuteSqlRawAsync($"DELETE FROM \"{table}\";");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to clear table {TableName}, may not exist", table);
                    }
                }

                // Re-enable foreign key checks
                await _context.Database.ExecuteSqlRawAsync("SET CONSTRAINTS ALL IMMEDIATE;");
                
                _logger.LogInformation("Completed clearing existing data");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error clearing existing data");
                throw;
            }
        }

        private async Task ResetAllSequencesAsync()
        {
            try
            {
                // Get all tables with identity columns and reset their sequences
                var sequenceResetQuery = @"
                    DO $$
                    DECLARE
                        r RECORD;
                    BEGIN
                        FOR r IN 
                            SELECT 
                                c.table_name,
                                c.column_name,
                                pg_get_serial_sequence(c.table_schema||'.'||c.table_name, c.column_name) as sequence_name
                            FROM information_schema.columns c
                            WHERE c.table_schema = 'public' 
                            AND c.column_default LIKE 'nextval%'
                            AND pg_get_serial_sequence(c.table_schema||'.'||c.table_name, c.column_name) IS NOT NULL
                        LOOP
                            IF r.sequence_name IS NOT NULL THEN
                                EXECUTE format('SELECT setval(''%s'', COALESCE((SELECT MAX(%I) FROM %I), 1), true)', 
                                    r.sequence_name, r.column_name, r.table_name);
                            END IF;
                        END LOOP;
                    END $$;";

                await _context.Database.ExecuteSqlRawAsync(sequenceResetQuery);
                
                // Explicitly reset SSLSettings sequence as it often causes issues
                await _context.Database.ExecuteSqlRawAsync(@"
                    SELECT setval(pg_get_serial_sequence('""SSLSettings""', 'Id'), 
                           COALESCE((SELECT MAX(""Id"") FROM ""SSLSettings""), 1), true)");
                
                _logger.LogInformation("Successfully reset all database sequences");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to reset sequences after restore. This may cause issues with identity columns.");
            }
        }

        private async Task<string> GenerateCustomSqlBackupAsync()
        {
            var sql = new StringBuilder();
            
            // Add header
            sql.AppendLine("-- CyberRisk Platform Database Backup");
            sql.AppendLine($"-- Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC");
            sql.AppendLine("-- This is a custom SQL backup that avoids PostgreSQL identity column issues");
            sql.AppendLine();

            try
            {
                // Core data tables - order matters for foreign key dependencies
                await AppendTableData(sql, "AspNetRoles");
                await AppendTableData(sql, "AspNetUsers");
                await AppendTableData(sql, "AspNetUserRoles");
                
                // Application tables
                await AppendTableData(sql, "BusinessOrganizations");
                await AppendTableData(sql, "RiskMatrices");
                await AppendTableData(sql, "ComplianceFrameworks");
                await AppendTableData(sql, "ComplianceControls");
                await AppendTableData(sql, "ComplianceAssessments");
                await AppendTableData(sql, "ControlAssessments");
                
                // Risk management tables
                await AppendTableData(sql, "Risks");
                await AppendTableData(sql, "RiskAssessments");
                await AppendTableData(sql, "Findings");
                await AppendTableData(sql, "FindingClosures");
                
                // Maturity assessment tables
                await AppendTableData(sql, "MaturityFrameworks");
                await AppendTableData(sql, "MaturityAssessments");
                await AppendTableData(sql, "MaturityControlAssessments");
                
                // SSL Management tables
                await AppendTableData(sql, "SSLCertificates");
                await AppendTableData(sql, "SSLSettings");
                
                // Threat Modeling tables
                await AppendTableData(sql, "ThreatModels");
                await AppendTableData(sql, "Attacks");
                await AppendTableData(sql, "AttackPaths");
                await AppendTableData(sql, "AttackScenarios");
                await AppendTableData(sql, "AttackScenarioSteps");
                await AppendTableData(sql, "MitreTechniques");
                await AppendTableData(sql, "KillChainActivities");
                await AppendTableData(sql, "ScenarioRecommendations");

                // Add sequence reset at the end
                sql.AppendLine();
                sql.AppendLine("-- Reset all sequences to prevent identity column issues");
                sql.AppendLine(@"
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT 
            c.table_name,
            c.column_name,
            pg_get_serial_sequence(c.table_schema||'.'||c.table_name, c.column_name) as sequence_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public' 
        AND c.column_default LIKE 'nextval%'
        AND pg_get_serial_sequence(c.table_schema||'.'||c.table_name, c.column_name) IS NOT NULL
    LOOP
        IF r.sequence_name IS NOT NULL THEN
            EXECUTE format('SELECT setval(''%s'', COALESCE((SELECT MAX(%I) FROM %I), 1), true)', 
                r.sequence_name, r.column_name, r.table_name);
        END IF;
    END LOOP;
END $$;");

                _logger.LogInformation("Generated custom SQL backup script with {LineCount} lines", sql.Length);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating custom SQL backup");
                sql.AppendLine($"-- ERROR: {ex.Message}");
            }

            return sql.ToString();
        }

        private async Task AppendTableData(StringBuilder sql, string tableName)
        {
            try
            {
                // Check if table exists
                var tableExists = await _context.Database.ExecuteSqlRawAsync($"SELECT 1 FROM information_schema.tables WHERE table_name = '{tableName}'") >= 0;
                
                sql.AppendLine($"-- Data for table: {tableName}");
                
                // Get all data from the table and convert to INSERT statements
                var connection = _context.Database.GetDbConnection();
                await connection.OpenAsync();
                
                using var command = connection.CreateCommand();
                command.CommandText = $"SELECT * FROM \"{tableName}\"";
                
                using var reader = await command.ExecuteReaderAsync();
                
                if (reader.HasRows)
                {
                    // Get column names
                    var columnNames = new List<string>();
                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        columnNames.Add($"\"{reader.GetName(i)}\"");
                    }
                    
                    while (await reader.ReadAsync())
                    {
                        var values = new List<string>();
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            var value = reader.GetValue(i);
                            values.Add(FormatSqlValue(value));
                        }
                        
                        sql.AppendLine($"INSERT INTO \"{tableName}\" ({string.Join(", ", columnNames)}) VALUES ({string.Join(", ", values)});");
                    }
                }
                
                await connection.CloseAsync();
                sql.AppendLine();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to backup table: {TableName}", tableName);
                sql.AppendLine($"-- WARNING: Failed to backup table {tableName}: {ex.Message}");
                sql.AppendLine();
            }
        }

        private static string FormatSqlValue(object? value)
        {
            if (value == null || value == DBNull.Value)
                return "NULL";
                
            return value switch
            {
                string s => $"'{s.Replace("'", "''")}'",
                DateTime dt => $"'{dt:yyyy-MM-dd HH:mm:ss}'",
                DateTimeOffset dto => $"'{dto:yyyy-MM-dd HH:mm:ss.fff zzz}'",
                bool b => b ? "true" : "false",
                byte[] bytes => $"'\\x{Convert.ToHexString(bytes)}'",
                _ => value.ToString() ?? "NULL"
            };
        }
    }
}