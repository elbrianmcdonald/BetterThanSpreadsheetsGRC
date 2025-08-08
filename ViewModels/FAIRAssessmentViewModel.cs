using CyberRiskApp.Models;

namespace CyberRiskApp.ViewModels
{
    public class FAIRAssessmentViewModel
    {
        public RiskAssessment Assessment { get; set; } = new RiskAssessment();
        // FAIR Controls removed
        public List<QualitativeControl> QualitativeControls { get; set; } = new List<QualitativeControl>();
        
        private List<Risk> _identifiedRisks = new List<Risk>();
        public List<Risk> IdentifiedRisks 
        { 
            get => _identifiedRisks; 
            set => _identifiedRisks = value?.Where(r => !string.IsNullOrEmpty(r.Title)).ToList() ?? new List<Risk>(); 
        }

        // New threat scenario-based approach for qualitative assessments
        public List<ThreatScenario> ThreatScenarios { get; set; } = new List<ThreatScenario>();
        
        public RiskLevelSettings? RiskLevelSettings { get; set; }
        
        // Threat model selection support
        public List<int> SelectedThreatModelIds { get; set; } = new List<int>();
        public List<AttackChain> AvailableThreatModels { get; set; } = new List<AttackChain>();
        
        // FAIR quantitative features removed
        public decimal CombinedControlEffectiveness => CalculateCombinedControlEffectiveness();
        
        // Chart data for visualization
        public List<decimal> ALEDistribution { get; set; } = new List<decimal>();
        public List<string> DistributionLabels { get; set; } = new List<string>();
        
        private decimal CalculateCombinedControlEffectiveness()
        {
            // FAIR quantitative controls removed - only qualitative controls remain
            if (QualitativeControls?.Any() == true)
            {
                // QualitativeControl doesn't have Effectiveness field - return 0 for now
                return 0;
            }
            return 0;
        }
    }
}