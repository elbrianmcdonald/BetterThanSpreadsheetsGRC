using CyberRiskApp.Data;
using CyberRiskApp.Models;
using OfficeOpenXml;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class FrameworkSeedingService : IFrameworkSeedingService
    {
        private readonly CyberRiskContext _context;
        private readonly IMaturityService _maturityService;
        private readonly IGovernanceService _governanceService;
        private readonly ILogger<FrameworkSeedingService> _logger;
        private readonly IWebHostEnvironment _environment;

        public FrameworkSeedingService(
            CyberRiskContext context,
            IMaturityService maturityService,
            IGovernanceService governanceService,
            ILogger<FrameworkSeedingService> logger,
            IWebHostEnvironment environment)
        {
            _context = context;
            _maturityService = maturityService;
            _governanceService = governanceService;
            _logger = logger;
            _environment = environment;
        }

        public async Task SeedDefaultFrameworksAsync()
        {
            try
            {
                _logger.LogInformation("Starting framework seeding process...");

                var grcImportsPath = Path.Combine(_environment.ContentRootPath, "grc imports");
                
                if (!Directory.Exists(grcImportsPath))
                {
                    _logger.LogWarning("GRC imports directory not found at: {Path}", grcImportsPath);
                    return;
                }

                // Seed C2M2 Maturity Framework
                var c2m2Path = Path.Combine(grcImportsPath, "c2m2 import.xlsx");
                if (File.Exists(c2m2Path))
                {
                    await SeedMaturityFrameworkAsync(
                        c2m2Path,
                        "Cybersecurity Capability Maturity Model (C2M2)",
                        "2.1",
                        "The Department of Energy's Cybersecurity Capability Maturity Model (C2M2) provides a comprehensive framework for evaluating and improving cybersecurity capabilities across critical infrastructure sectors.",
                        FrameworkType.C2M2
                    );
                    _logger.LogInformation("✅ Seeded C2M2 framework");
                }
                else
                {
                    _logger.LogWarning("C2M2 import file not found: {Path}", c2m2Path);
                }

                // Seed NIST CSF 2.0 Maturity Framework
                var nistCsfPath = Path.Combine(grcImportsPath, "nist csf 2 import.xlsx");
                if (File.Exists(nistCsfPath))
                {
                    await SeedMaturityFrameworkAsync(
                        nistCsfPath,
                        "NIST Cybersecurity Framework 2.0",
                        "2.0",
                        "The National Institute of Standards and Technology Cybersecurity Framework 2.0 provides a policy framework of computer security guidance for how private sector organizations can assess and improve their ability to prevent, detect, and respond to cyber attacks.",
                        FrameworkType.NISTCSF
                    );
                    _logger.LogInformation("✅ Seeded NIST CSF 2.0 framework");
                }
                else
                {
                    _logger.LogWarning("NIST CSF 2.0 import file not found: {Path}", nistCsfPath);
                }

                // Seed NIST 800-53 Compliance Framework
                var nist80053Path = Path.Combine(grcImportsPath, "nist 800-53 import.xlsx");
                if (File.Exists(nist80053Path))
                {
                    await SeedComplianceFrameworkAsync(
                        nist80053Path,
                        "NIST 800-53 Security Controls",
                        "Rev 5",
                        "NIST Special Publication 800-53 provides a comprehensive catalog of security and privacy controls for information systems and organizations to protect organizational operations and assets."
                    );
                    _logger.LogInformation("✅ Seeded NIST 800-53 framework");
                }
                else
                {
                    _logger.LogWarning("NIST 800-53 import file not found: {Path}", nist80053Path);
                }

                _logger.LogInformation("Framework seeding process completed successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred during framework seeding");
                throw;
            }
        }

        public async Task SeedMaturityFrameworkAsync(string filePath, string name, string version, string description, FrameworkType type)
        {
            try
            {
                // Check if framework already exists
                var existingFrameworks = await _maturityService.GetAllFrameworksAsync();
                if (existingFrameworks.Any(f => f.Name == name && f.Version == version))
                {
                    _logger.LogInformation("Maturity framework {Name} v{Version} already exists, skipping", name, version);
                    return;
                }

                _logger.LogInformation("Seeding maturity framework: {Name} v{Version}", name, version);

                // Create the framework
                var framework = new MaturityFramework
                {
                    Name = name,
                    Version = version,
                    Description = description,
                    Type = type,
                    Status = FrameworkStatus.Active,
                    UploadedBy = "System",
                    UploadedDate = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                // Save framework to get the ID
                framework = await _maturityService.CreateFrameworkAsync(framework);

                // Parse Excel file and create controls
                var controls = await ParseMaturityExcelFile(filePath, framework.Id, framework.Type);

                if (controls.Count > 0)
                {
                    await _maturityService.AddControlsToFrameworkAsync(framework.Id, controls);
                    _logger.LogInformation("Added {Count} controls to {Name}", controls.Count, name);
                }
                else
                {
                    _logger.LogWarning("No controls found in {FilePath} for {Name}", filePath, name);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error seeding maturity framework {Name} from {FilePath}", name, filePath);
                throw;
            }
        }

        public async Task SeedComplianceFrameworkAsync(string filePath, string name, string version, string description)
        {
            try
            {
                // Check if framework already exists
                var existingFrameworks = await _governanceService.GetAllFrameworksAsync();
                if (existingFrameworks.Any(f => f.Name == name && f.Version == version))
                {
                    _logger.LogInformation("Compliance framework {Name} v{Version} already exists, skipping", name, version);
                    return;
                }

                _logger.LogInformation("Seeding compliance framework: {Name} v{Version}", name, version);

                // Create the framework
                var framework = new ComplianceFramework
                {
                    Name = name,
                    Version = version,
                    Description = description,
                    Status = FrameworkStatus.Active,
                    UploadedBy = "System",
                    UploadedDate = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                // Save framework to get the ID
                framework = await _governanceService.CreateFrameworkAsync(framework);

                // Parse Excel file and create controls
                var controls = await ParseComplianceExcelFile(filePath, framework.Id);

                if (controls.Count > 0)
                {
                    await _governanceService.AddControlsToFrameworkAsync(framework.Id, controls);
                    _logger.LogInformation("Added {Count} controls to {Name}", controls.Count, name);
                }
                else
                {
                    _logger.LogWarning("No controls found in {FilePath} for {Name}", filePath, name);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error seeding compliance framework {Name} from {FilePath}", name, filePath);
                throw;
            }
        }

        public async Task<bool> IsFrameworkSeedingNeededAsync()
        {
            try
            {
                var hasMaturityFrameworks = await _context.MaturityFrameworks.AnyAsync();
                var hasComplianceFrameworks = await _context.ComplianceFrameworks.AnyAsync();
                
                // Seed if either type of framework is missing
                return !hasMaturityFrameworks || !hasComplianceFrameworks;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if framework seeding is needed");
                return false;
            }
        }

        private async Task<List<MaturityControl>> ParseMaturityExcelFile(string filePath, int frameworkId, FrameworkType frameworkType)
        {
            var controls = new List<MaturityControl>();

            using (var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read))
            using (var package = new ExcelPackage(stream))
            {
                var worksheet = package.Workbook.Worksheets.FirstOrDefault();
                if (worksheet?.Dimension == null || worksheet.Dimension.Rows < 2)
                {
                    return controls;
                }

                // Expected columns for maturity frameworks:
                // A: Domain/Function, B: Category, C: Control ID, D: Control Title, 
                // E: Control Description, F: Implementation Guidance, G: Priority

                for (int row = 2; row <= worksheet.Dimension.Rows; row++)
                {
                    try
                    {
                        var domain = GetCellValue(worksheet, row, 1)?.Trim();
                        var category = GetCellValue(worksheet, row, 2)?.Trim();
                        var controlId = GetCellValue(worksheet, row, 3)?.Trim();
                        var title = GetCellValue(worksheet, row, 4)?.Trim();
                        var description = GetCellValue(worksheet, row, 5)?.Trim();
                        var implementationGuidance = GetCellValue(worksheet, row, 6)?.Trim();
                        var priorityText = GetCellValue(worksheet, row, 7)?.Trim();

                        // Skip rows without essential data
                        if (string.IsNullOrEmpty(controlId) || string.IsNullOrEmpty(title))
                            continue;

                        // Parse priority
                        var priority = ParseControlPriority(priorityText, frameworkType, domain);

                        var control = new MaturityControl
                        {
                            MaturityFrameworkId = frameworkId,
                            ControlId = controlId,
                            Title = title ?? string.Empty,
                            Description = description ?? string.Empty,
                            ImplementationGuidance = implementationGuidance ?? string.Empty,
                            Function = domain ?? string.Empty,
                            Category = category ?? string.Empty,
                            Priority = priority
                        };

                        controls.Add(control);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("Error parsing maturity control at row {Row}: {Message}", row, ex.Message);
                    }
                }
            }

            return controls;
        }

        private async Task<List<ComplianceControl>> ParseComplianceExcelFile(string filePath, int frameworkId)
        {
            var controls = new List<ComplianceControl>();

            using (var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read))
            using (var package = new ExcelPackage(stream))
            {
                var worksheet = package.Workbook.Worksheets.FirstOrDefault();
                if (worksheet?.Dimension == null || worksheet.Dimension.Rows < 2)
                {
                    return controls;
                }

                // Expected columns for compliance frameworks:
                // A: Control Family, B: Control ID, C: Control Title, 
                // D: Control Description, E: Implementation Guidance, F: Priority

                for (int row = 2; row <= worksheet.Dimension.Rows; row++)
                {
                    try
                    {
                        var controlFamily = GetCellValue(worksheet, row, 1)?.Trim();
                        var controlId = GetCellValue(worksheet, row, 2)?.Trim();
                        var title = GetCellValue(worksheet, row, 3)?.Trim();
                        var description = GetCellValue(worksheet, row, 4)?.Trim();
                        var implementationGuidance = GetCellValue(worksheet, row, 5)?.Trim();
                        var priorityText = GetCellValue(worksheet, row, 6)?.Trim();

                        // Skip rows without essential data
                        if (string.IsNullOrEmpty(controlId) || string.IsNullOrEmpty(title))
                            continue;

                        // Parse priority
                        var priority = ParseControlPriority(priorityText, null, null);

                        var control = new ComplianceControl
                        {
                            ComplianceFrameworkId = frameworkId,
                            ControlId = controlId,
                            Title = title ?? string.Empty,
                            Description = description ?? string.Empty,
                            ControlText = implementationGuidance ?? string.Empty,
                            Category = controlFamily ?? string.Empty,
                            Priority = priority
                        };

                        controls.Add(control);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("Error parsing compliance control at row {Row}: {Message}", row, ex.Message);
                    }
                }
            }

            return controls;
        }

        private ControlPriority ParseControlPriority(string? priorityText, FrameworkType? frameworkType, string? domain)
        {
            if (string.IsNullOrEmpty(priorityText))
                return ControlPriority.Medium;

            // Try direct enum parsing first
            if (Enum.TryParse<ControlPriority>(priorityText, true, out var parsedPriority))
                return parsedPriority;

            // Handle various priority formats
            switch (priorityText.ToLower().Trim())
            {
                case "critical":
                case "1":
                case "high":
                case "p1":
                    return ControlPriority.Critical;
                case "important":
                case "2":
                case "medium":
                case "p2":
                    return ControlPriority.High;
                case "moderate":
                case "3":
                case "low":
                case "p3":
                    return ControlPriority.Medium;
                case "optional":
                case "4":
                case "p4":
                    return ControlPriority.Low;
                default:
                    return ControlPriority.Medium;
            }
        }

        private string? GetCellValue(ExcelWorksheet worksheet, int row, int col)
        {
            try
            {
                var cell = worksheet.Cells[row, col];
                return cell?.Value?.ToString()?.Trim();
            }
            catch
            {
                return null;
            }
        }
    }
}