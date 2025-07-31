using CyberRiskApp.Models;

namespace CyberRiskApp.ViewModels
{
    public class FAIRAssessmentViewModel
    {
        public RiskAssessment Assessment { get; set; } = new RiskAssessment();
        public List<RiskAssessmentControl> Controls { get; set; } = new List<RiskAssessmentControl>();
        public List<QualitativeControl> QualitativeControls { get; set; } = new List<QualitativeControl>();
        
        private List<Risk> _identifiedRisks = new List<Risk>();
        public List<Risk> IdentifiedRisks 
        { 
            get => _identifiedRisks; 
            set => _identifiedRisks = value?.Where(r => !string.IsNullOrEmpty(r.Title)).ToList() ?? new List<Risk>(); 
        }
        
        public RiskLevelSettings? RiskLevelSettings { get; set; }
        
        // For display purposes
        public decimal CalculatedVulnerabilityPercentage => (Assessment.CalculatedVulnerability ?? 1) * 100;
        public decimal CombinedControlEffectiveness => CalculateCombinedControlEffectiveness();
        
        // Chart data for visualization
        public List<decimal> ALEDistribution { get; set; } = new List<decimal>();
        public List<string> DistributionLabels { get; set; } = new List<string>();
        
        private decimal CalculateCombinedControlEffectiveness()
        {
            var implementedControls = Controls?.Where(c => c.ImplementationStatus == "Implemented").ToList();
            if (implementedControls == null || !implementedControls.Any())
                return 0;

            decimal remainingVulnerability = 1.0m;
            foreach (var control in implementedControls)
            {
                decimal controlEffectiveness = control.ControlEffectiveness / 100m;
                remainingVulnerability *= (1 - controlEffectiveness);
            }
            
            return (1 - remainingVulnerability) * 100;
        }
    }
}