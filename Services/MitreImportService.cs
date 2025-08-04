using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CyberRiskApp.Services
{
    public class MitreImportService : IMitreImportService
    {
        private readonly CyberRiskContext _context;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<MitreImportService> _logger;
        private const string MITRE_ENTERPRISE_URL = "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json";
        private const string MITRE_ICS_URL = "https://raw.githubusercontent.com/mitre/cti/master/ics-attack/ics-attack.json";
        private const string MITRE_MOBILE_URL = "https://raw.githubusercontent.com/mitre/cti/master/mobile-attack/mobile-attack.json";

        public MitreImportService(CyberRiskContext context, IHttpClientFactory httpClientFactory, ILogger<MitreImportService> logger)
        {
            _context = context;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        public async Task<bool> ImportLatestMitreDataAsync()
        {
            // Default to importing all frameworks
            return await ImportAllFrameworksAsync();
        }

        public async Task<bool> ImportMitreDataAsync(MitreFrameworkType frameworkType)
        {
            try
            {
                _logger.LogInformation("Starting MITRE ATT&CK {Framework} data import...", frameworkType);

                // Fetch the latest data for specific framework
                var techniques = await FetchMitreDataAsync(frameworkType);
                if (!techniques.Any())
                {
                    _logger.LogWarning("No techniques fetched from MITRE {Framework} source", frameworkType);
                    return false;
                }

                // Clear existing techniques for this framework
                await ClearTechniquesByFrameworkAsync(frameworkType);

                // Import new techniques
                var success = await ImportTechniquesAsync(techniques);
                
                if (success)
                {
                    _logger.LogInformation($"Successfully imported {techniques.Count()} MITRE ATT&CK {frameworkType} techniques");
                }

                return success;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error importing MITRE ATT&CK {Framework} data", frameworkType);
                return false;
            }
        }

        public async Task<bool> ImportAllFrameworksAsync()
        {
            try
            {
                _logger.LogInformation("Starting MITRE ATT&CK import for all frameworks...");

                var frameworks = new[] { MitreFrameworkType.Enterprise, MitreFrameworkType.ICS };
                var allTechniques = new List<MitreTechnique>();

                foreach (var framework in frameworks)
                {
                    var techniques = await FetchMitreDataAsync(framework);
                    allTechniques.AddRange(techniques);
                }

                if (!allTechniques.Any())
                {
                    _logger.LogWarning("No techniques fetched from any MITRE source");
                    return false;
                }

                // Clear all existing techniques
                await ClearExistingTechniquesAsync();

                // Import all techniques
                var success = await ImportTechniquesAsync(allTechniques);
                
                if (success)
                {
                    _logger.LogInformation($"Successfully imported {allTechniques.Count} MITRE ATT&CK techniques from all frameworks");
                }

                return success;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error importing MITRE ATT&CK data for all frameworks");
                return false;
            }
        }

        public async Task<IEnumerable<MitreTechnique>> FetchMitreDataAsync(MitreFrameworkType frameworkType)
        {
            try
            {
                using var httpClient = _httpClientFactory.CreateClient();
                httpClient.Timeout = TimeSpan.FromMinutes(5); // Extended timeout for large file

                var url = GetFrameworkUrl(frameworkType);
                _logger.LogInformation("Fetching MITRE ATT&CK {Framework} data from GitHub...", frameworkType);
                var response = await httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                var jsonContent = await response.Content.ReadAsStringAsync();
                var mitreData = JsonSerializer.Deserialize<MitreAttackData>(jsonContent, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
                });

                if (mitreData?.Objects == null)
                {
                    _logger.LogWarning("Failed to parse MITRE ATT&CK {Framework} data", frameworkType);
                    return new List<MitreTechnique>();
                }

                var techniques = new List<MitreTechnique>();
                var techniqueObjects = mitreData.Objects.Where(obj => obj.Type == "attack-pattern" && !obj.Revoked).ToList();

                _logger.LogInformation($"Processing {techniqueObjects.Count} {frameworkType} technique objects...");

                foreach (var obj in techniqueObjects)
                {
                    try
                    {
                        var technique = MapToMitreTechnique(obj, frameworkType);
                        if (technique != null)
                        {
                            techniques.Add(technique);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, $"Failed to process {frameworkType} technique {obj.Id}");
                    }
                }

                _logger.LogInformation($"Successfully processed {techniques.Count} {frameworkType} techniques");
                return techniques;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching MITRE ATT&CK {Framework} data", frameworkType);
                return new List<MitreTechnique>();
            }
        }

        public async Task<int> GetCurrentTechniqueCountAsync()
        {
            return await _context.MitreTechniques.CountAsync();
        }

        public async Task<int> GetTechniqueCountByFrameworkAsync(MitreFrameworkType frameworkType)
        {
            return await _context.MitreTechniques.CountAsync(t => t.FrameworkType == frameworkType);
        }

        public async Task<Dictionary<MitreFrameworkType, int>> GetFrameworkTechniqueCountsAsync()
        {
            var counts = new Dictionary<MitreFrameworkType, int>();
            
            foreach (MitreFrameworkType framework in Enum.GetValues<MitreFrameworkType>())
            {
                counts[framework] = await GetTechniqueCountByFrameworkAsync(framework);
            }
            
            return counts;
        }

        public async Task<bool> ClearExistingTechniquesAsync()
        {
            try
            {
                _logger.LogInformation("Clearing existing MITRE techniques...");
                
                // Clear in order due to foreign key constraints
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM \"TechniqueEnvironmentMappings\"");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM \"MitreTechniques\"");
                
                _logger.LogInformation("Existing MITRE techniques cleared");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error clearing existing MITRE techniques");
                return false;
            }
        }

        public async Task<bool> ClearTechniquesByFrameworkAsync(MitreFrameworkType frameworkType)
        {
            try
            {
                _logger.LogInformation("Clearing existing MITRE {Framework} techniques...", frameworkType);
                
                // Clear technique environment mappings for this framework first
                var techniqueIds = await _context.MitreTechniques
                    .Where(t => t.FrameworkType == frameworkType)
                    .Select(t => t.Id)
                    .ToListAsync();

                if (techniqueIds.Any())
                {
                    await _context.Database.ExecuteSqlRawAsync(
                        "DELETE FROM \"TechniqueEnvironmentMappings\" WHERE \"MitreTechniqueId\" = ANY({0})", 
                        techniqueIds.ToArray());
                        
                    await _context.Database.ExecuteSqlRawAsync(
                        "DELETE FROM \"MitreTechniques\" WHERE \"FrameworkType\" = {0}", 
                        (int)frameworkType);
                }
                
                _logger.LogInformation("Existing MITRE {Framework} techniques cleared", frameworkType);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error clearing existing MITRE {Framework} techniques", frameworkType);
                return false;
            }
        }

        public async Task<string> GetMitreVersionAsync()
        {
            try
            {
                using var httpClient = _httpClientFactory.CreateClient();
                var response = await httpClient.GetAsync(MITRE_ENTERPRISE_URL);
                response.EnsureSuccessStatusCode();

                var jsonContent = await response.Content.ReadAsStringAsync();
                var mitreData = JsonSerializer.Deserialize<MitreAttackData>(jsonContent, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                return mitreData?.SpecVersion ?? "Unknown";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting MITRE version");
                return "Unknown";
            }
        }

        private async Task<bool> ImportTechniquesAsync(IEnumerable<MitreTechnique> techniques)
        {
            try
            {
                var techniquesList = techniques.ToList();
                
                // First pass: Add all techniques without parent relationships
                foreach (var technique in techniquesList)
                {
                    technique.ParentTechniqueId = null; // Will set this in second pass
                    _context.MitreTechniques.Add(technique);
                }

                await _context.SaveChangesAsync();

                // Second pass: Update parent relationships for sub-techniques
                var subTechniques = techniquesList.Where(t => t.IsSubTechnique).ToList();
                foreach (var subTechnique in subTechniques)
                {
                    var parentTechniqueId = ExtractParentTechniqueId(subTechnique.TechniqueId);
                    if (!string.IsNullOrEmpty(parentTechniqueId))
                    {
                        var parentTechnique = await _context.MitreTechniques
                            .FirstOrDefaultAsync(t => t.TechniqueId == parentTechniqueId);
                        
                        if (parentTechnique != null)
                        {
                            var dbSubTechnique = await _context.MitreTechniques
                                .FirstOrDefaultAsync(t => t.TechniqueId == subTechnique.TechniqueId);
                            
                            if (dbSubTechnique != null)
                            {
                                dbSubTechnique.ParentTechniqueId = parentTechnique.Id;
                            }
                        }
                    }
                }

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error importing techniques into database");
                return false;
            }
        }

        private string GetFrameworkUrl(MitreFrameworkType frameworkType)
        {
            return frameworkType switch
            {
                MitreFrameworkType.Enterprise => MITRE_ENTERPRISE_URL,
                MitreFrameworkType.ICS => MITRE_ICS_URL,
                MitreFrameworkType.Mobile => MITRE_MOBILE_URL,
                _ => MITRE_ENTERPRISE_URL
            };
        }

        private MitreTechnique? MapToMitreTechnique(MitreAttackObject obj, MitreFrameworkType frameworkType)
        {
            if (obj.ExternalReferences == null || !obj.ExternalReferences.Any())
                return null;

            var mitreRef = obj.ExternalReferences.FirstOrDefault(r => r.SourceName == "mitre-attack");
            if (mitreRef == null || string.IsNullOrEmpty(mitreRef.ExternalId))
                return null;

            var technique = new MitreTechnique
            {
                TechniqueId = mitreRef.ExternalId,
                Name = obj.Name ?? "",
                Description = obj.Description ?? "",
                FrameworkType = frameworkType,
                IsSubTechnique = mitreRef.ExternalId.Contains("."),
                IsDeprecated = obj.XMitreDeprecated ?? false,
                Version = obj.XMitreVersion ?? "15.0",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            // Extract tactics (kill chain phases)
            if (obj.KillChainPhases != null && obj.KillChainPhases.Any())
            {
                var killChainName = frameworkType == MitreFrameworkType.ICS ? "mitre-ics-attack" : "mitre-attack";
                var tactics = obj.KillChainPhases
                    .Where(kcp => kcp.KillChainName == killChainName)
                    .Select(kcp => FormatTacticName(kcp.PhaseName))
                    .ToList();
                technique.Tactic = string.Join(", ", tactics);
            }

            // Extract platforms
            if (obj.XMitrePlatforms != null && obj.XMitrePlatforms.Any())
            {
                technique.Platforms = string.Join(", ", obj.XMitrePlatforms);
            }

            // Extract data sources
            if (obj.XMitreDataSources != null && obj.XMitreDataSources.Any())
            {
                technique.DataSources = string.Join(", ", obj.XMitreDataSources);
            }

            return technique;
        }

        private string FormatTacticName(string phaseName)
        {
            // Convert "initial-access" to "Initial Access"
            return string.Join(" ", phaseName.Split('-').Select(word => 
                char.ToUpper(word[0]) + word.Substring(1).ToLower()));
        }

        private string ExtractParentTechniqueId(string subTechniqueId)
        {
            // Extract "T1234" from "T1234.001"
            var dotIndex = subTechniqueId.IndexOf('.');
            return dotIndex > 0 ? subTechniqueId.Substring(0, dotIndex) : "";
        }
    }

    // Data structures for deserializing MITRE ATT&CK JSON
    public class MitreAttackData
    {
        [JsonPropertyName("spec_version")]
        public string? SpecVersion { get; set; }

        [JsonPropertyName("objects")]
        public List<MitreAttackObject>? Objects { get; set; }
    }

    public class MitreAttackObject
    {
        [JsonPropertyName("id")]
        public string? Id { get; set; }

        [JsonPropertyName("type")]
        public string? Type { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("revoked")]
        public bool Revoked { get; set; }

        [JsonPropertyName("external_references")]
        public List<ExternalReference>? ExternalReferences { get; set; }

        [JsonPropertyName("kill_chain_phases")]
        public List<KillChainPhase>? KillChainPhases { get; set; }

        [JsonPropertyName("x_mitre_platforms")]
        public List<string>? XMitrePlatforms { get; set; }

        [JsonPropertyName("x_mitre_data_sources")]
        public List<string>? XMitreDataSources { get; set; }

        [JsonPropertyName("x_mitre_deprecated")]
        public bool? XMitreDeprecated { get; set; }

        [JsonPropertyName("x_mitre_version")]
        public string? XMitreVersion { get; set; }
    }

    public class ExternalReference
    {
        [JsonPropertyName("source_name")]
        public string? SourceName { get; set; }

        [JsonPropertyName("external_id")]
        public string? ExternalId { get; set; }

        [JsonPropertyName("url")]
        public string? Url { get; set; }
    }

    public class KillChainPhase
    {
        [JsonPropertyName("kill_chain_name")]
        public string? KillChainName { get; set; }

        [JsonPropertyName("phase_name")]
        public string? PhaseName { get; set; }
    }
}