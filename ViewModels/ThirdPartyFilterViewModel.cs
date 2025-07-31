using CyberRiskApp.Models;
using Microsoft.AspNetCore.Mvc.Rendering;
using System.ComponentModel.DataAnnotations;

namespace CyberRiskApp.ViewModels
{
    public class ThirdPartyFilterViewModel
    {
        // Filter criteria
        [Display(Name = "Third Party Name")]
        public string? Name { get; set; }

        [Display(Name = "Organization")]
        public string? Organization { get; set; }

        [Display(Name = "Representative Email")]
        public string? RepresentativeEmail { get; set; }

        [Display(Name = "TPRA Status")]
        public TPRAStatus? TPRAStatus { get; set; }

        [Display(Name = "Risk Level")]
        public RiskLevel? RiskLevel { get; set; }

        [Display(Name = "BIA Rating")]
        public BIARating? BIARating { get; set; }

        // Results
        public List<ThirdParty> FilteredThirdParties { get; set; } = new List<ThirdParty>();
        public int TotalCount { get; set; }
        public int FilteredCount { get; set; }

        // Select lists for dropdowns
        public SelectList? TPRAStatusOptions { get; set; }
        public SelectList? RiskLevelOptions { get; set; }
        public SelectList? BIARatingOptions { get; set; }
        public SelectList? OrganizationOptions { get; set; }
    }
}