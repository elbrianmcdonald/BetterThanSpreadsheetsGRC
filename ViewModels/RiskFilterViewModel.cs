using CyberRiskApp.Models;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace CyberRiskApp.ViewModels
{
    public class RiskFilterViewModel
    {
        // Filter properties
        public string? RegisterId { get; set; }
        public string? Title { get; set; }
        public string? ThreatScenario { get; set; }
        public CIATriad? CIATriad { get; set; }
        public string? RiskStatement { get; set; }
        public string? Organization { get; set; }
        public string? Asset { get; set; }
        public string? RiskOwner { get; set; }
        public ImpactLevel? Impact { get; set; }
        public LikelihoodLevel? Likelihood { get; set; }
        public ExposureLevel? Exposure { get; set; }
        public RiskLevel? InherentRiskLevel { get; set; }
        public TreatmentStrategy? RiskTreatment { get; set; }
        public RiskLevel? ResidualRisk { get; set; }
        public string? TreatmentPlan { get; set; }
        public string? RiskAssessment { get; set; }
        public DateTime? DateOpenedFrom { get; set; }
        public DateTime? DateOpenedTo { get; set; }
        public DateTime? LastReviewedFrom { get; set; }
        public DateTime? LastReviewedTo { get; set; }
        public RiskStatus? Status { get; set; }

        // Results
        public IEnumerable<Risk> FilteredRisks { get; set; } = new List<Risk>();
        public int TotalCount { get; set; }
        public int FilteredCount { get; set; }

        // Select lists for dropdowns
        public SelectList? CIATriadOptions { get; set; }
        public SelectList? ImpactOptions { get; set; }
        public SelectList? LikelihoodOptions { get; set; }
        public SelectList? ExposureOptions { get; set; }
        public SelectList? InherentRiskLevelOptions { get; set; }
        public SelectList? RiskTreatmentOptions { get; set; }
        public SelectList? ResidualRiskOptions { get; set; }
        public SelectList? StatusOptions { get; set; }

        // Organizations and Risk Owners from database
        public SelectList? OrganizationOptions { get; set; }
        public SelectList? RiskOwnerOptions { get; set; }
        public SelectList? AssetOptions { get; set; }

        // Risk level settings for heatmap calculation
        public RiskLevelSettings? RiskLevelSettings { get; set; }
    }
}