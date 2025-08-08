using CyberRiskApp.Models;
using CyberRiskApp.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace CyberRiskApp.Services
{
    public interface IMitreAttackService
    {
        Task<List<MitreTechnique>> GetTechniquesAsync();
        Task<MitreTechnique?> GetTechniqueByIdAsync(string techniqueId);
        Task<List<MitreTechnique>> SearchTechniquesAsync(string searchTerm);
        Task SeedMitreTechniquesAsync();
        Task<List<string>> GetTacticsAsync();
        Task<List<string>> GetDataSourcesAsync();
    }

    public class MitreAttackService : IMitreAttackService
    {
        private readonly CyberRiskContext _context;
        private readonly ILogger<MitreAttackService> _logger;

        public MitreAttackService(CyberRiskContext context, ILogger<MitreAttackService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<MitreTechnique>> GetTechniquesAsync()
        {
            return await _context.MitreTechniques
                .Where(t => !t.IsDeprecated)
                .OrderBy(t => t.TechniqueId)
                .ToListAsync();
        }

        public async Task<MitreTechnique?> GetTechniqueByIdAsync(string techniqueId)
        {
            return await _context.MitreTechniques
                .FirstOrDefaultAsync(t => t.TechniqueId == techniqueId);
        }

        public async Task<List<MitreTechnique>> SearchTechniquesAsync(string searchTerm)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
            {
                return await GetTechniquesAsync();
            }

            searchTerm = searchTerm.ToLower();

            return await _context.MitreTechniques
                .Where(t => !t.IsDeprecated && 
                           (t.Name.ToLower().Contains(searchTerm) ||
                            t.TechniqueId.ToLower().Contains(searchTerm) ||
                            t.Description.ToLower().Contains(searchTerm) ||
                            t.Tactic.ToLower().Contains(searchTerm)))
                .OrderBy(t => t.TechniqueId)
                .ToListAsync();
        }

        public async Task<List<string>> GetTacticsAsync()
        {
            return await _context.MitreTechniques
                .Where(t => !t.IsDeprecated)
                .Select(t => t.Tactic)
                .Distinct()
                .OrderBy(t => t)
                .ToListAsync();
        }

        public async Task<List<string>> GetDataSourcesAsync()
        {
            var techniques = await _context.MitreTechniques
                .Where(t => !t.IsDeprecated && !string.IsNullOrEmpty(t.DataSources))
                .Select(t => t.DataSources)
                .ToListAsync();

            var allDataSources = new HashSet<string>();

            foreach (var dataSourcesJson in techniques)
            {
                try
                {
                    var dataSources = JsonSerializer.Deserialize<string[]>(dataSourcesJson);
                    if (dataSources != null)
                    {
                        foreach (var source in dataSources)
                        {
                            allDataSources.Add(source);
                        }
                    }
                }
                catch (JsonException)
                {
                    // Handle non-JSON data sources (legacy format)
                    var sources = dataSourcesJson.Split(',', StringSplitOptions.RemoveEmptyEntries);
                    foreach (var source in sources)
                    {
                        allDataSources.Add(source.Trim());
                    }
                }
            }

            return allDataSources.OrderBy(s => s).ToList();
        }

        public async Task SeedMitreTechniquesAsync()
        {
            // Check if techniques already exist
            if (await _context.MitreTechniques.AnyAsync())
            {
                _logger.LogInformation("MITRE ATT&CK techniques already exist in database");
                return;
            }

            _logger.LogInformation("Seeding MITRE ATT&CK techniques...");

            var techniques = GetSampleMitreTechniques();

            await _context.MitreTechniques.AddRangeAsync(techniques);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"Seeded {techniques.Count} MITRE ATT&CK techniques");
        }

        private List<MitreTechnique> GetSampleMitreTechniques()
        {
            return new List<MitreTechnique>
            {
                new MitreTechnique
                {
                    TechniqueId = "T1566.001",
                    Name = "Spearphishing Attachment",
                    Description = "Adversaries may send spearphishing emails with a malicious attachment in an attempt to gain access to victim systems.",
                    Tactic = "Initial Access",
                    FrameworkType = MitreFrameworkType.Enterprise,
                    IsSubTechnique = true,
                    Platforms = JsonSerializer.Serialize(new[] { "Linux", "macOS", "Windows" }),
                    DataSources = JsonSerializer.Serialize(new[] { "Application Log", "Email Gateway", "File", "Network Traffic" }),
                    Detection = "Network intrusion detection systems and email security appliances can be used to detect spearphishing with malicious attachments.",
                    Mitigation = "User training, email security solutions, application control"
                },
                new MitreTechnique
                {
                    TechniqueId = "T1566.002",
                    Name = "Spearphishing Link",
                    Description = "Adversaries may send spearphishing emails with a malicious link in an attempt to gain access to victim systems.",
                    Tactic = "Initial Access",
                    FrameworkType = MitreFrameworkType.Enterprise,
                    IsSubTechnique = true,
                    Platforms = JsonSerializer.Serialize(new[] { "Linux", "macOS", "Windows" }),
                    DataSources = JsonSerializer.Serialize(new[] { "Application Log", "Email Gateway", "Network Traffic", "Web Proxy" }),
                    Detection = "URL inspection within web proxies or user training can help detect suspicious links.",
                    Mitigation = "User training, email security solutions, web content filtering"
                },
                new MitreTechnique
                {
                    TechniqueId = "T1078",
                    Name = "Valid Accounts",
                    Description = "Adversaries may obtain and abuse valid accounts to gain access to systems.",
                    Tactic = "Defense Evasion",
                    FrameworkType = MitreFrameworkType.Enterprise,
                    Platforms = JsonSerializer.Serialize(new[] { "Azure AD", "Linux", "macOS", "Windows", "Office 365", "SaaS", "IaaS", "Google Workspace" }),
                    DataSources = JsonSerializer.Serialize(new[] { "Logon Session", "User Account", "Process" }),
                    Detection = "Monitor for suspicious account usage, unusual logon patterns, and privileged account activities.",
                    Mitigation = "Multi-factor authentication, privileged account management, account monitoring"
                },
                new MitreTechnique
                {
                    TechniqueId = "T1059.001",
                    Name = "PowerShell",
                    Description = "Adversaries may abuse PowerShell commands to execute malicious code.",
                    Tactic = "Execution",
                    FrameworkType = MitreFrameworkType.Enterprise,
                    IsSubTechnique = true,
                    Platforms = JsonSerializer.Serialize(new[] { "Windows" }),
                    DataSources = JsonSerializer.Serialize(new[] { "Command", "Module", "Process", "Script" }),
                    Detection = "Monitor PowerShell execution and command-line arguments.",
                    Mitigation = "Application control, execution prevention, code signing"
                },
                new MitreTechnique
                {
                    TechniqueId = "T1055",
                    Name = "Process Injection",
                    Description = "Adversaries may inject code into processes to hide their presence or elevate privileges.",
                    Tactic = "Defense Evasion",
                    FrameworkType = MitreFrameworkType.Enterprise,
                    Platforms = JsonSerializer.Serialize(new[] { "Linux", "macOS", "Windows" }),
                    DataSources = JsonSerializer.Serialize(new[] { "Process", "API" }),
                    Detection = "Monitor for process hollowing, DLL injection, and other process injection techniques.",
                    Mitigation = "Application control, behavior prevention on endpoint"
                },
                new MitreTechnique
                {
                    TechniqueId = "T1083",
                    Name = "File and Directory Discovery",
                    Description = "Adversaries may enumerate files and directories to find information of interest.",
                    Tactic = "Discovery",
                    FrameworkType = MitreFrameworkType.Enterprise,
                    Platforms = JsonSerializer.Serialize(new[] { "Linux", "macOS", "Windows" }),
                    DataSources = JsonSerializer.Serialize(new[] { "Command", "File", "Process" }),
                    Detection = "Monitor for unusual file and directory enumeration activities.",
                    Mitigation = "Limited effectiveness through preventive controls"
                },
                new MitreTechnique
                {
                    TechniqueId = "T1005",
                    Name = "Data from Local System",
                    Description = "Adversaries may search local system sources for files containing sensitive information.",
                    Tactic = "Collection",
                    FrameworkType = MitreFrameworkType.Enterprise,
                    Platforms = JsonSerializer.Serialize(new[] { "Linux", "macOS", "Windows" }),
                    DataSources = JsonSerializer.Serialize(new[] { "Command", "File", "Process" }),
                    Detection = "Monitor for processes and commands associated with file collection activities.",
                    Mitigation = "Data loss prevention, access controls"
                },
                new MitreTechnique
                {
                    TechniqueId = "T1041",
                    Name = "Exfiltration Over C2 Channel",
                    Description = "Adversaries may steal data using the same communication channel used for command and control.",
                    Tactic = "Exfiltration",
                    FrameworkType = MitreFrameworkType.Enterprise,
                    Platforms = JsonSerializer.Serialize(new[] { "Linux", "macOS", "Windows" }),
                    DataSources = JsonSerializer.Serialize(new[] { "Command", "File", "Network Traffic" }),
                    Detection = "Monitor for large data transfers or unusual network traffic patterns.",
                    Mitigation = "Data loss prevention, network segmentation"
                },
                new MitreTechnique
                {
                    TechniqueId = "T1486",
                    Name = "Data Encrypted for Impact",
                    Description = "Adversaries may encrypt data on target systems to interrupt business operations.",
                    Tactic = "Impact",
                    FrameworkType = MitreFrameworkType.Enterprise,
                    Platforms = JsonSerializer.Serialize(new[] { "Linux", "macOS", "Windows" }),
                    DataSources = JsonSerializer.Serialize(new[] { "Command", "File", "Process" }),
                    Detection = "Monitor for suspicious file modifications and encryption activities.",
                    Mitigation = "Data backup, behavior prevention on endpoint"
                },
                new MitreTechnique
                {
                    TechniqueId = "T1190",
                    Name = "Exploit Public-Facing Application",
                    Description = "Adversaries may exploit a weakness in an Internet-facing computer or program.",
                    Tactic = "Initial Access",
                    FrameworkType = MitreFrameworkType.Enterprise,
                    Platforms = JsonSerializer.Serialize(new[] { "Linux", "Windows", "macOS", "Network" }),
                    DataSources = JsonSerializer.Serialize(new[] { "Application Log", "Network Traffic", "Web Application Firewall Logs" }),
                    Detection = "Monitor application logs for exploit attempts and unusual access patterns.",
                    Mitigation = "Application isolation, network segmentation, update software, vulnerability scanning"
                }
            };
        }
    }
}