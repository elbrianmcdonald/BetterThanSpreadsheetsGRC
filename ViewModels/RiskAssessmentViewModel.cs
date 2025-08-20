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

        // ===== Enhanced Complex Assessment Support =====
        
        // Risk Matrix Support
        public List<RiskMatrix> AvailableMatrices { get; set; } = new List<RiskMatrix>();
        public RiskMatrix? SelectedMatrix { get; set; }
        
        // Comprehensive Threat Scenarios
        public List<ComprehensiveThreatScenario> ThreatScenarios { get; set; } = new List<ComprehensiveThreatScenario>();
        
        // MITRE ATT&CK Integration
        public List<SelectListItem> AvailableMitreTechniques { get; set; } = new List<SelectListItem>();
        
        // Available Controls for Selection
        public List<SelectListItem> AvailableProtectiveControls { get; set; } = new List<SelectListItem>();
        public List<SelectListItem> AvailableDetectiveControls { get; set; } = new List<SelectListItem>();
        
        // User Permissions
        public bool CanAddNewAssets { get; set; }
        public bool CanAddNewBusinessUnits { get; set; }
        public bool CanAddNewBusinessOwners { get; set; }
        public bool CanAddTechnicalControls { get; set; }
    }

    // Comprehensive Threat Scenario ViewModel
    public class ComprehensiveThreatScenario
    {
        public int Id { get; set; }
        public string ScenarioId { get; set; } = string.Empty;
        public string ScenarioName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        
        // Initial Threat Vector
        public ThreatVectorViewModel ThreatVector { get; set; } = new ThreatVectorViewModel();
        
        // Multiple Threat Actor Steps
        public List<ThreatActorStepViewModel> ThreatActorSteps { get; set; } = new List<ThreatActorStepViewModel>();
        
        // Threat Actor Objective
        public ThreatActorObjectiveViewModel ThreatActorObjective { get; set; } = new ThreatActorObjectiveViewModel();
        
        // Multiple Risks per Scenario
        public List<ScenarioRiskViewModel> ScenarioRisks { get; set; } = new List<ScenarioRiskViewModel>();
        
        // Overall Scenario Risk (highest individual risk)
        public decimal? OverallRiskScore { get; set; }
        public string OverallRiskLevel { get; set; } = "Unknown";
    }

    // Threat Vector ViewModel
    public class ThreatVectorViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string MitreTechnique { get; set; } = string.Empty;
        
        // Controls
        public List<ControlSelectionViewModel> CurrentProtectiveControls { get; set; } = new List<ControlSelectionViewModel>();
        public List<ControlSelectionViewModel> CurrentDetectiveControls { get; set; } = new List<ControlSelectionViewModel>();
        public List<ControlSelectionViewModel> NeededProtectiveControls { get; set; } = new List<ControlSelectionViewModel>();
        public List<ControlSelectionViewModel> NeededDetectiveControls { get; set; } = new List<ControlSelectionViewModel>();
    }

    // Threat Actor Step ViewModel
    public class ThreatActorStepViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string MitreTechnique { get; set; } = string.Empty;
        public int StepOrder { get; set; }
        
        // Controls
        public List<ControlSelectionViewModel> CurrentProtectiveControls { get; set; } = new List<ControlSelectionViewModel>();
        public List<ControlSelectionViewModel> CurrentDetectiveControls { get; set; } = new List<ControlSelectionViewModel>();
        public List<ControlSelectionViewModel> NeededProtectiveControls { get; set; } = new List<ControlSelectionViewModel>();
        public List<ControlSelectionViewModel> NeededDetectiveControls { get; set; } = new List<ControlSelectionViewModel>();
    }

    // Threat Actor Objective ViewModel
    public class ThreatActorObjectiveViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string MitreTechnique { get; set; } = string.Empty;
        
        // Controls
        public List<ControlSelectionViewModel> CurrentProtectiveControls { get; set; } = new List<ControlSelectionViewModel>();
        public List<ControlSelectionViewModel> CurrentDetectiveControls { get; set; } = new List<ControlSelectionViewModel>();
        public List<ControlSelectionViewModel> NeededProtectiveControls { get; set; } = new List<ControlSelectionViewModel>();
        public List<ControlSelectionViewModel> NeededDetectiveControls { get; set; } = new List<ControlSelectionViewModel>();
    }

    // Individual Risk within a Threat Scenario
    public class ScenarioRiskViewModel
    {
        public int Id { get; set; }
        public string RiskName { get; set; } = string.Empty;
        public string RiskDescription { get; set; } = string.Empty;
        
        // Current Risk Ratings
        public decimal? CurrentImpact { get; set; }
        public decimal? CurrentLikelihood { get; set; }
        public decimal? CurrentExposure { get; set; }
        public decimal? CurrentRiskScore { get; set; }
        public string CurrentRiskLevel { get; set; } = "Unknown";
        public bool IsCurrentRiskAboveAppetite { get; set; }
        
        // Residual Risk Ratings
        public decimal? ResidualImpact { get; set; }
        public decimal? ResidualLikelihood { get; set; }
        public decimal? ResidualExposure { get; set; }
        public decimal? ResidualRiskScore { get; set; }
        public string ResidualRiskLevel { get; set; } = "Unknown";
        public bool IsResidualRiskAboveAppetite { get; set; }
        
        // Risk Treatment
        public string RiskTreatmentPlan { get; set; } = string.Empty;
        public DateTime? ExpectedCompletionDate { get; set; }
        public TreatmentPlanStatus TreatmentPlanStatus { get; set; } = TreatmentPlanStatus.NotStarted;
        
        // Computed Properties
        public bool IsTreatmentOverdue { get; set; }
        public bool IsTreatmentPastSla { get; set; }
    }

    // Control Selection ViewModel
    public class ControlSelectionViewModel
    {
        public int Id { get; set; }
        public string ControlName { get; set; } = string.Empty;
        public string ControlDescription { get; set; } = string.Empty;
        public ControlImplementationStatus ImplementationStatus { get; set; } = ControlImplementationStatus.NotImplemented;
        public bool IsSelected { get; set; }
    }
}