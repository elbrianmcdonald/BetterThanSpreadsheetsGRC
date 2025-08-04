namespace CyberRiskApp.Models.DTOs
{
    public class MitreTechniqueDto
    {
        public int Id { get; set; }
        public string TechniqueId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Tactic { get; set; } = string.Empty;
        public MitreFrameworkType FrameworkType { get; set; }
        public int? ParentTechniqueId { get; set; }
        public string Platforms { get; set; } = string.Empty;
        public string DataSources { get; set; } = string.Empty;
        public string Detection { get; set; } = string.Empty;
        public string Mitigation { get; set; } = string.Empty;
        public string Examples { get; set; } = string.Empty;
        public bool IsSubTechnique { get; set; }
        public bool IsDeprecated { get; set; }
        
        // Simple list of sub-technique IDs to avoid circular references
        public List<string> SubTechniqueIds { get; set; } = new List<string>();
        public string? ParentTechniqueId_String { get; set; }

        public static MitreTechniqueDto FromMitreTechnique(MitreTechnique technique)
        {
            return new MitreTechniqueDto
            {
                Id = technique.Id,
                TechniqueId = technique.TechniqueId,
                Name = technique.Name,
                Description = technique.Description,
                Tactic = technique.Tactic,
                FrameworkType = technique.FrameworkType,
                ParentTechniqueId = technique.ParentTechniqueId,
                Platforms = technique.Platforms,
                DataSources = technique.DataSources,
                Detection = technique.Detection,
                Mitigation = technique.Mitigation,
                Examples = technique.Examples,
                IsSubTechnique = technique.IsSubTechnique,
                IsDeprecated = technique.IsDeprecated,
                SubTechniqueIds = technique.SubTechniques?.Select(st => st.TechniqueId).ToList() ?? new List<string>(),
                ParentTechniqueId_String = technique.ParentTechnique?.TechniqueId
            };
        }
    }
}