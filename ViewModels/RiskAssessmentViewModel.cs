using CyberRiskApp.Models;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace CyberRiskApp.ViewModels
{
    public class RiskAssessmentViewModel
    {
        public RiskAssessment Assessment { get; set; } = new RiskAssessment();
        public List<Risk> OpenRisks { get; set; } = new List<Risk>();

        // ADDED: List of findings for dropdown selection
        public List<SelectListItem> AvailableFindings { get; set; } = new List<SelectListItem>();
    }
}