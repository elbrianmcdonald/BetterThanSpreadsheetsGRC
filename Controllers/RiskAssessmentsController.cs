using CyberRiskApp.Authorization;
using CyberRiskApp.Data;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.ViewModels;
using CyberRiskApp.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using CyberRiskApp.Extensions;

namespace CyberRiskApp.Controllers
{
    // REMOVED: [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)] - controller level authorization
    public class RiskAssessmentsController : Controller
    {
        private readonly IRiskAssessmentService _assessmentService;
        private readonly IRiskService _riskService;
        private readonly IRiskLevelSettingsService _settingsService;
        private readonly IFindingService _findingService; // ADDED: Findings service
        private readonly IPdfExportService _pdfExportService;
        private readonly IRiskMatrixService _riskMatrixService; // ADDED: Risk matrix service
        private readonly CyberRiskContext _context; // ADDED: Context for control management
        private readonly IThreatModelingService _threatModelingService; // ADDED: Threat modeling service

        public RiskAssessmentsController(
            IRiskAssessmentService assessmentService,
            IRiskService riskService,
            IRiskLevelSettingsService settingsService,
            IFindingService findingService, // ADDED: Findings service
            IPdfExportService pdfExportService,
            IRiskMatrixService riskMatrixService, // ADDED: Risk matrix service
            CyberRiskContext context, // ADDED: Context for control management
            IThreatModelingService threatModelingService) // ADDED: Threat modeling service
        {
            _assessmentService = assessmentService;
            _riskService = riskService;
            _settingsService = settingsService;
            _findingService = findingService; // ADDED: Findings service
            _pdfExportService = pdfExportService;
            _riskMatrixService = riskMatrixService; // ADDED: Risk matrix service
            _context = context; // ADDED: Context for control management
            _threatModelingService = threatModelingService; // ADDED: Threat modeling service
        }

        // UPDATED: All users can view risk assessments
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Index()
        {
            var assessments = await _assessmentService.GetAllAssessmentsAsync();
            ViewBag.CanPerformAssessments = User.CanUserPerformAssessments(); // Show/hide create buttons
            return View(assessments);
        }

        // UPDATED: All users can view assessment details  
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> Details(int id)
        {
            var assessment = await _assessmentService.GetAssessmentByIdAsync(id);
            if (assessment == null)
                return NotFound();

            // Load threat models and their attack scenarios for this assessment
            var attackScenariosDict = new Dictionary<int, IEnumerable<AttackScenario>>();
            if (assessment.LinkedThreatModels?.Any() == true)
            {
                foreach (var threatModel in assessment.LinkedThreatModels)
                {
                    // Load attack scenarios for each threat model
                    var scenarios = await _threatModelingService.GetAttackScenariosByThreatModelIdAsync(threatModel.Id);
                    attackScenariosDict[threatModel.Id] = scenarios ?? new List<AttackScenario>();
                    
                    // Debug logging
                    Console.WriteLine($"Threat Model: {threatModel.Name} (ID: {threatModel.Id}) has {scenarios?.Count() ?? 0} scenarios");
                }
            }
            ViewBag.AttackScenarios = attackScenariosDict;

            return View(assessment);
        }

        // UPDATED: Only GRC and Admin can create assessments - Assessment Type Selection
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public IActionResult Create()
        {
            // Redirect to the assessment type selection page
            return RedirectToAction(nameof(SelectType));
        }

        // NEW: Assessment type selection page
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public IActionResult SelectType()
        {
            return View();
        }

        // NEW: Create FAIR Assessment
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> CreateFAIR()
        {
            var model = new FAIRAssessmentViewModel
            {
                Assessment = new RiskAssessment
                {
                    AssessmentType = AssessmentType.FAIR, // Default to FAIR

                    // Enhanced FAIR defaults with distributions
                    ThreatEventFrequency = 10,
                    ThreatEventFrequencyMin = 5,
                    ThreatEventFrequencyMax = 20,
                    ThreatEventFrequencyConfidence = 90,
                    
                    ContactFrequency = 50,
                    ActionSuccess = 30,
                    
                    // Primary Loss defaults
                    ProductivityLossMin = 5000,
                    ProductivityLossMostLikely = 15000,
                    ProductivityLossMax = 25000,
                    ResponseCostsMin = 2000,
                    ResponseCostsMostLikely = 8000,
                    ResponseCostsMax = 15000,
                    ReplacementCostMin = 1000,
                    ReplacementCostMostLikely = 5000,
                    ReplacementCostMax = 10000,
                    FinesMin = 0,
                    FinesMostLikely = 10000,
                    FinesMax = 50000,
                    
                    // Secondary Loss defaults (zero by default)
                    SecondaryResponseCostMin = 0,
                    SecondaryResponseCostMostLikely = 0,
                    SecondaryResponseCostMax = 0,
                    ReputationDamageMin = 0,
                    ReputationDamageMostLikely = 0,
                    ReputationDamageMax = 0,
                    CompetitiveAdvantageLossMin = 0,
                    CompetitiveAdvantageLossMostLikely = 0,
                    CompetitiveAdvantageLossMax = 0,
                    ExternalStakeholderLossMin = 0,
                    ExternalStakeholderLossMostLikely = 0,
                    ExternalStakeholderLossMax = 0,
                    
                    // Simulation settings
                    SimulationIterations = 10000,
                    DistributionType = "PERT",
                    LossMagnitudeConfidence = 90,
                    UsePerDistribution = true,
                    
                    // Threat details
                    ThreatCommunity = "External Actors",
                    ThreatAction = "Data Exfiltration"
                },
                Controls = new List<RiskAssessmentControl>()
            };

            // Load risk level settings
            model.RiskLevelSettings = await _settingsService.GetSettingsByIdAsync(1);

            // Load available threat models
            model.AvailableThreatModels = (await _threatModelingService.GetAllThreatModelsAsync()).ToList();

            return View(model);
        }

        // NEW: Create Qualitative Assessment
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> CreateQualitative()
        {
            // Get default risk matrix or first available matrix
            var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            var allMatrices = await _riskMatrixService.GetAllMatricesAsync();

            var model = new FAIRAssessmentViewModel
            {
                Assessment = new RiskAssessment
                {
                    AssessmentType = AssessmentType.Qualitative, // Set to Qualitative
                    
                    // Qualitative defaults
                    QualitativeLikelihood = LikelihoodLevel.Possible,
                    QualitativeImpact = ImpactLevel.Medium,
                    QualitativeExposure = ExposureLevel.Exposed,
                    
                    // Set default risk matrix
                    RiskMatrixId = defaultMatrix?.Id,
                    
                    // Threat details
                    ThreatCommunity = "External Actors",
                    ThreatAction = "Data Exfiltration"
                },
                QualitativeControls = new List<QualitativeControl>()
            };

            // Load risk level settings
            model.RiskLevelSettings = await _settingsService.GetSettingsByIdAsync(1);

            // Load available threat models
            model.AvailableThreatModels = (await _threatModelingService.GetAllThreatModelsAsync()).ToList();

            // Pass available matrices to the view
            ViewBag.AvailableMatrices = allMatrices.Where(m => m.IsActive).ToList();
            ViewBag.DefaultMatrix = defaultMatrix;

            return View(model);
        }

        // NEW: POST action for FAIR Assessment creation
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        [CleanupEmptyRisks]
        public async Task<IActionResult> CreateFAIR(FAIRAssessmentViewModel model)
        {
            // Ensure assessment type is set to FAIR
            model.Assessment.AssessmentType = AssessmentType.FAIR;

            // Remove any identified risks that don't have a title to prevent enum validation errors
            if (model.IdentifiedRisks != null)
            {
                model.IdentifiedRisks = model.IdentifiedRisks.Where(r => !string.IsNullOrEmpty(r.Title)).ToList();
            }

            // If no valid identified risks remain, clear the list entirely
            if (model.IdentifiedRisks == null || !model.IdentifiedRisks.Any())
            {
                model.IdentifiedRisks = new List<Risk>();
            }

            // Remove ALL ModelState entries related to IdentifiedRisks to prevent enum validation issues
            var allRiskKeys = ModelState.Keys.Where(k => k.Contains("IdentifiedRisks")).ToList();
            foreach (var key in allRiskKeys)
            {
                ModelState.Remove(key);
            }

            if (ModelState.IsValid)
            {
                try
                {
                    // Set assessment metadata
                    model.Assessment.Assessor = User.Identity?.Name ?? "Current User";
                    model.Assessment.CreatedAt = DateTime.UtcNow;
                    model.Assessment.UpdatedAt = DateTime.UtcNow;

                    var createdAssessment = await _assessmentService.CreateAssessmentAsync(model.Assessment);
                    
                    // Save FAIR controls if any were provided
                    if (model.Controls != null && model.Controls.Any())
                    {
                        foreach (var control in model.Controls.Where(c => !string.IsNullOrEmpty(c.ControlName)))
                        {
                            control.RiskAssessmentId = createdAssessment.Id;
                            control.CreatedAt = DateTime.UtcNow;
                            control.UpdatedAt = DateTime.UtcNow;
                            _context.RiskAssessmentControls.Add(control);
                        }
                        await _context.SaveChangesAsync();
                    }

                    // Save identified risks if any were provided
                    if (model.IdentifiedRisks != null && model.IdentifiedRisks.Any())
                    {
                        foreach (var risk in model.IdentifiedRisks.Where(r => !string.IsNullOrEmpty(r.Title)))
                        {
                            risk.RiskAssessmentId = createdAssessment.Id;
                            risk.Asset = model.Assessment.Asset;
                            risk.BusinessUnit = model.Assessment.BusinessUnit ?? "Unknown";
                            risk.ThreatScenario = model.Assessment.ThreatScenario;
                            risk.CIATriad = model.Assessment.CIATriad ?? CIATriad.All;
                            risk.Status = RiskStatus.Open;
                            risk.OpenDate = DateTime.Today;
                            risk.NextReviewDate = DateTime.Today.AddMonths(3);
                            risk.CreatedAt = DateTime.UtcNow;
                            risk.UpdatedAt = DateTime.UtcNow;
                            
                            // IMPORTANT: Inherit ALE from the FAIR assessment
                            risk.ALE = createdAssessment.AnnualLossExpectancy ?? 0m;
                            
                            // Calculate risk level based on ALE using assessment's method
                            var calculatedRiskLevel = createdAssessment.CalculateRiskLevel();
                            var riskLevelEnum = calculatedRiskLevel switch
                            {
                                "Critical" => RiskLevel.Critical,
                                "High" => RiskLevel.High,
                                "Medium" => RiskLevel.Medium,
                                "Low" => RiskLevel.Low,
                                _ => RiskLevel.Medium
                            };
                            
                            // Set risk levels based on calculated assessment level
                            risk.RiskLevel = riskLevelEnum;
                            
                            // Set default enum values if not provided (to avoid value '0' errors)
                            if (risk.Impact == 0) risk.Impact = ImpactLevel.Medium;
                            if (risk.Likelihood == 0) risk.Likelihood = LikelihoodLevel.Possible;
                            if (risk.Exposure == 0) risk.Exposure = ExposureLevel.ModeratelyExposed;
                            if (risk.InherentRiskLevel == 0) risk.InherentRiskLevel = riskLevelEnum;
                            if (risk.ResidualRiskLevel == 0) risk.ResidualRiskLevel = riskLevelEnum;
                            if (risk.RiskLevel == 0) risk.RiskLevel = riskLevelEnum;
                            
                            // Risk number will be auto-generated by RiskService if not provided
                            // Leave RiskNumber empty to allow service to generate proper sequential number
                            
                            // Set default treatment if not provided
                            if (risk.Treatment == 0)
                            {
                                risk.Treatment = TreatmentStrategy.Mitigate;
                            }
                            
                            // Use RiskService to create risk with proper ID generation
                            await _riskService.CreateRiskAsync(risk);
                        }
                    }

                    // Link selected threat models to the risk assessment
                    if (model.SelectedThreatModelIds != null && model.SelectedThreatModelIds.Any())
                    {
                        foreach (var threatModelId in model.SelectedThreatModelIds)
                        {
                            var threatModel = await _threatModelingService.GetThreatModelByIdAsync(threatModelId);
                            if (threatModel != null)
                            {
                                threatModel.RiskAssessmentId = createdAssessment.Id;
                                await _threatModelingService.UpdateThreatModelAsync(threatModel);
                            }
                        }
                    }

                    TempData["Success"] = "FAIR risk assessment created successfully.";
                    return RedirectToAction(nameof(Details), new { id = createdAssessment.Id });
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error creating FAIR assessment: {ex.Message}";
                }
            }

            // Reload risk level settings and threat models if validation fails
            model.RiskLevelSettings = await _settingsService.GetSettingsByIdAsync(1);
            model.AvailableThreatModels = (await _threatModelingService.GetAllThreatModelsAsync()).ToList();
            return View(model);
        }

        // NEW: POST action for Qualitative Assessment creation
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        [CleanupEmptyRisks]
        public async Task<IActionResult> CreateQualitative(FAIRAssessmentViewModel model)
        {
            // Ensure assessment type is set to Qualitative
            model.Assessment.AssessmentType = AssessmentType.Qualitative;

            // NUCLEAR OPTION: Remove ALL IdentifiedRisks related ModelState entries
            var keysToRemove = ModelState.Keys.Where(k => k.Contains("IdentifiedRisks")).ToList();
            foreach (var key in keysToRemove)
            {
                ModelState.Remove(key);
            }

            // Remove any validation errors that contain "The value '0' is invalid"
            var errorKeys = ModelState.Keys.ToList();
            foreach (var key in errorKeys)
            {
                if (ModelState[key].Errors.Any(e => e.ErrorMessage.Contains("The value '0' is invalid")))
                {
                    ModelState.Remove(key);
                }
            }

            // Ensure IdentifiedRisks is empty
            model.IdentifiedRisks = new List<Risk>();

            // Debug: Log ModelState errors for qualitative assessment
            if (!ModelState.IsValid)
            {
                Console.WriteLine("=== Qualitative Assessment ModelState Validation Errors ===");
                foreach (var kvp in ModelState)
                {
                    if (kvp.Value.Errors.Count > 0)
                    {
                        Console.WriteLine($"Field: {kvp.Key}");
                        foreach (var error in kvp.Value.Errors)
                        {
                            Console.WriteLine($"  Error: {error.ErrorMessage}");
                        }
                    }
                }
                Console.WriteLine("============================================================");
            }

            if (ModelState.IsValid)
            {
                try
                {
                    // Set assessment metadata
                    model.Assessment.Assessor = User.Identity?.Name ?? "Current User";
                    model.Assessment.CreatedAt = DateTime.UtcNow;
                    model.Assessment.UpdatedAt = DateTime.UtcNow;

                    var createdAssessment = await _assessmentService.CreateAssessmentAsync(model.Assessment);
                    
                    // Save qualitative controls if any were provided
                    if (model.QualitativeControls != null && model.QualitativeControls.Any())
                    {
                        foreach (var control in model.QualitativeControls.Where(c => !string.IsNullOrEmpty(c.ControlName)))
                        {
                            control.RiskAssessmentId = createdAssessment.Id;
                            control.CreatedAt = DateTime.UtcNow;
                            control.UpdatedAt = DateTime.UtcNow;
                            _context.QualitativeControls.Add(control);
                        }
                        await _context.SaveChangesAsync();
                    }

                    // Save identified risks if any were provided
                    if (model.IdentifiedRisks != null && model.IdentifiedRisks.Any())
                    {
                        foreach (var risk in model.IdentifiedRisks.Where(r => !string.IsNullOrEmpty(r.Title)))
                        {
                            risk.RiskAssessmentId = createdAssessment.Id;
                            risk.Asset = model.Assessment.Asset;
                            risk.BusinessUnit = model.Assessment.BusinessUnit ?? "Unknown";
                            risk.ThreatScenario = model.Assessment.ThreatScenario;
                            risk.CIATriad = model.Assessment.CIATriad ?? CIATriad.All;
                            risk.Status = RiskStatus.Open;
                            risk.OpenDate = DateTime.Today;
                            risk.NextReviewDate = DateTime.Today.AddMonths(3);
                            risk.CreatedAt = DateTime.UtcNow;
                            risk.UpdatedAt = DateTime.UtcNow;
                            
                            // Set default enum values if not provided (to avoid value '0' errors)
                            if (risk.Impact == 0) risk.Impact = ImpactLevel.Medium;
                            if (risk.Likelihood == 0) risk.Likelihood = LikelihoodLevel.Possible;
                            if (risk.Exposure == 0) risk.Exposure = ExposureLevel.ModeratelyExposed;
                            if (risk.InherentRiskLevel == 0) risk.InherentRiskLevel = RiskLevel.Medium;
                            if (risk.ResidualRiskLevel == 0) risk.ResidualRiskLevel = RiskLevel.Medium;
                            if (risk.RiskLevel == 0) risk.RiskLevel = RiskLevel.Medium;
                            
                            // Generate risk number - will be set by service if not provided
                            if (string.IsNullOrEmpty(risk.RiskNumber))
                            {
                                risk.RiskNumber = $"RISK-{DateTime.Now:yyyyMMdd}-{createdAssessment.Id:000}-{risk.Title.Substring(0, Math.Min(3, risk.Title.Length)).ToUpper()}";
                            }
                            
                            // Set default treatment if not provided
                            if (risk.Treatment == 0)
                            {
                                risk.Treatment = TreatmentStrategy.Mitigate;
                            }
                            
                            _context.Risks.Add(risk);
                        }
                        await _context.SaveChangesAsync();
                    }

                    // Link selected threat models to the risk assessment
                    if (model.SelectedThreatModelIds != null && model.SelectedThreatModelIds.Any())
                    {
                        foreach (var threatModelId in model.SelectedThreatModelIds)
                        {
                            var threatModel = await _threatModelingService.GetThreatModelByIdAsync(threatModelId);
                            if (threatModel != null)
                            {
                                threatModel.RiskAssessmentId = createdAssessment.Id;
                                await _threatModelingService.UpdateThreatModelAsync(threatModel);
                            }
                        }
                    }

                    TempData["Success"] = "Qualitative risk assessment created successfully.";
                    return RedirectToAction(nameof(Details), new { id = createdAssessment.Id });
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error creating qualitative assessment: {ex.Message}";
                }
            }

            // Reload risk level settings and threat models if validation fails
            model.RiskLevelSettings = await _settingsService.GetSettingsByIdAsync(1);
            model.AvailableThreatModels = (await _threatModelingService.GetAllThreatModelsAsync()).ToList();
            
            // Also reload matrices for qualitative assessments
            var allMatrices = await _riskMatrixService.GetAllMatricesAsync();
            ViewBag.AvailableMatrices = allMatrices.Where(m => m.IsActive).ToList();
            ViewBag.DefaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            
            return View(model);
        }

        // LEGACY: Original Create POST method - keeping for backward compatibility
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Create(FAIRAssessmentViewModel model)
        {
            // Remove audit fields from model validation since they're set automatically
            ModelState.Remove("Assessment.CreatedBy");
            ModelState.Remove("Assessment.UpdatedBy");
            
            if (ModelState.IsValid)
            {
                try
                {
                    // Set assessment metadata
                    model.Assessment.Assessor = User.Identity?.Name ?? "Current User";
                    model.Assessment.CreatedAt = DateTime.UtcNow;
                    model.Assessment.UpdatedAt = DateTime.UtcNow;

                    var createdAssessment = await _assessmentService.CreateAssessmentAsync(model.Assessment);
                    
                    // Save FAIR controls if any were provided
                    if (model.Controls != null && model.Controls.Any())
                    {
                        foreach (var control in model.Controls.Where(c => !string.IsNullOrEmpty(c.ControlName)))
                        {
                            control.RiskAssessmentId = createdAssessment.Id;
                            control.CreatedAt = DateTime.UtcNow;
                            control.UpdatedAt = DateTime.UtcNow;
                            _context.RiskAssessmentControls.Add(control);
                        }
                        await _context.SaveChangesAsync();
                    }

                    // Save qualitative controls if any were provided
                    if (model.QualitativeControls != null && model.QualitativeControls.Any())
                    {
                        foreach (var control in model.QualitativeControls.Where(c => !string.IsNullOrEmpty(c.ControlName)))
                        {
                            control.RiskAssessmentId = createdAssessment.Id;
                            control.CreatedAt = DateTime.UtcNow;
                            control.UpdatedAt = DateTime.UtcNow;
                            _context.QualitativeControls.Add(control);
                        }
                        await _context.SaveChangesAsync();
                    }

                    // Save identified risks if any were provided
                    if (model.IdentifiedRisks != null && model.IdentifiedRisks.Any())
                    {
                        foreach (var risk in model.IdentifiedRisks.Where(r => !string.IsNullOrEmpty(r.Title)))
                        {
                            risk.RiskAssessmentId = createdAssessment.Id;
                            risk.Asset = model.Assessment.Asset;
                            risk.BusinessUnit = model.Assessment.BusinessUnit ?? "Unknown";
                            risk.ThreatScenario = model.Assessment.ThreatScenario;
                            risk.CIATriad = model.Assessment.CIATriad ?? CIATriad.All;
                            risk.Status = RiskStatus.Open;
                            risk.OpenDate = DateTime.Today;
                            risk.NextReviewDate = DateTime.Today.AddMonths(3);
                            risk.CreatedAt = DateTime.UtcNow;
                            risk.UpdatedAt = DateTime.UtcNow;
                            
                            // Set default enum values if not provided (to avoid value '0' errors)
                            if (risk.Impact == 0) risk.Impact = ImpactLevel.Medium;
                            if (risk.Likelihood == 0) risk.Likelihood = LikelihoodLevel.Possible;
                            if (risk.Exposure == 0) risk.Exposure = ExposureLevel.ModeratelyExposed;
                            if (risk.InherentRiskLevel == 0) risk.InherentRiskLevel = RiskLevel.Medium;
                            if (risk.ResidualRiskLevel == 0) risk.ResidualRiskLevel = RiskLevel.Medium;
                            if (risk.RiskLevel == 0) risk.RiskLevel = RiskLevel.Medium;
                            
                            // Generate risk number - will be set by service if not provided
                            if (string.IsNullOrEmpty(risk.RiskNumber))
                            {
                                risk.RiskNumber = $"RISK-{DateTime.Now:yyyyMMdd}-{createdAssessment.Id:000}-{risk.Title.Substring(0, Math.Min(3, risk.Title.Length)).ToUpper()}";
                            }
                            
                            // Set default treatment if not provided
                            if (risk.Treatment == 0)
                            {
                                risk.Treatment = TreatmentStrategy.Mitigate;
                            }
                            
                            _context.Risks.Add(risk);
                        }
                        await _context.SaveChangesAsync();
                    }

                    TempData["Success"] = "Risk assessment created successfully.";
                    return RedirectToAction(nameof(Details), new { id = createdAssessment.Id });
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error creating assessment: {ex.Message}";
                }
            }

            // Reload risk level settings if validation fails
            model.RiskLevelSettings = await _settingsService.GetSettingsByIdAsync(1);
            return View(model);
        }

        // UPDATED: Edit GET action method with FAIR enhancements
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Edit(int id)
        {
            var assessment = await _assessmentService.GetAssessmentByIdAsync(id);
            if (assessment == null)
                return NotFound();

            var model = new FAIRAssessmentViewModel
            {
                Assessment = assessment,
                Controls = assessment.Controls?.ToList() ?? new List<RiskAssessmentControl>(),
                QualitativeControls = assessment.QualitativeControls?.ToList() ?? new List<QualitativeControl>(),
                IdentifiedRisks = assessment.IdentifiedRisks?.ToList() ?? new List<Risk>()
            };

            // Load risk level settings
            model.RiskLevelSettings = await _settingsService.GetSettingsByIdAsync(1);

            return View(model);
        }

        // UPDATED: Edit POST action method with FAIR enhancements
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Edit(int id, FAIRAssessmentViewModel model)
        {
            if (id != model.Assessment.Id)
                return NotFound();

            if (ModelState.IsValid)
            {
                try
                {
                    // Preserve original metadata
                    var originalAssessment = await _assessmentService.GetAssessmentByIdAsync(id);
                    if (originalAssessment == null)
                        return NotFound();

                    // Update fields but preserve metadata
                    model.Assessment.CreatedAt = originalAssessment.CreatedAt;
                    model.Assessment.UpdatedAt = DateTime.UtcNow;
                    model.Assessment.Assessor = originalAssessment.Assessor; // Preserve original assessor

                    await _assessmentService.UpdateAssessmentAsync(model.Assessment);

                    // Update FAIR controls
                    if (model.Controls != null)
                    {
                        // Remove existing FAIR controls
                        var existingControls = _context.RiskAssessmentControls.Where(c => c.RiskAssessmentId == id);
                        _context.RiskAssessmentControls.RemoveRange(existingControls);

                        // Add updated FAIR controls
                        foreach (var control in model.Controls.Where(c => !string.IsNullOrEmpty(c.ControlName)))
                        {
                            control.RiskAssessmentId = id;
                            control.CreatedAt = control.CreatedAt == DateTime.MinValue ? DateTime.UtcNow : control.CreatedAt;
                            control.UpdatedAt = DateTime.UtcNow;
                            _context.RiskAssessmentControls.Add(control);
                        }
                        await _context.SaveChangesAsync();
                    }

                    // Update qualitative controls
                    if (model.QualitativeControls != null)
                    {
                        // Remove existing qualitative controls
                        var existingQualControls = _context.QualitativeControls.Where(c => c.RiskAssessmentId == id);
                        _context.QualitativeControls.RemoveRange(existingQualControls);

                        // Add updated qualitative controls
                        foreach (var control in model.QualitativeControls.Where(c => !string.IsNullOrEmpty(c.ControlName)))
                        {
                            control.RiskAssessmentId = id;
                            control.CreatedAt = control.CreatedAt == DateTime.MinValue ? DateTime.UtcNow : control.CreatedAt;
                            control.UpdatedAt = DateTime.UtcNow;
                            _context.QualitativeControls.Add(control);
                        }
                        await _context.SaveChangesAsync();
                    }

                    // Update identified risks
                    if (model.IdentifiedRisks != null)
                    {
                        // Remove existing identified risks
                        var existingRisks = _context.Risks.Where(r => r.RiskAssessmentId == id);
                        _context.Risks.RemoveRange(existingRisks);

                        // Add updated identified risks
                        foreach (var risk in model.IdentifiedRisks.Where(r => !string.IsNullOrEmpty(r.Title)))
                        {
                            risk.RiskAssessmentId = id;
                            risk.Asset = model.Assessment.Asset;
                            risk.BusinessUnit = model.Assessment.BusinessUnit ?? "Unknown";
                            risk.ThreatScenario = model.Assessment.ThreatScenario;
                            risk.CIATriad = model.Assessment.CIATriad ?? CIATriad.All;
                            risk.Status = risk.Status == 0 ? RiskStatus.Open : risk.Status;
                            risk.OpenDate = risk.OpenDate == DateTime.MinValue ? DateTime.Today : risk.OpenDate;
                            risk.NextReviewDate = risk.NextReviewDate ?? DateTime.Today.AddMonths(3);
                            risk.CreatedAt = risk.CreatedAt == DateTime.MinValue ? DateTime.UtcNow : risk.CreatedAt;
                            risk.UpdatedAt = DateTime.UtcNow;
                            
                            // Set default enum values if not provided (to avoid value '0' errors)
                            if (risk.Impact == 0) risk.Impact = ImpactLevel.Medium;
                            if (risk.Likelihood == 0) risk.Likelihood = LikelihoodLevel.Possible;
                            if (risk.Exposure == 0) risk.Exposure = ExposureLevel.ModeratelyExposed;
                            if (risk.InherentRiskLevel == 0) risk.InherentRiskLevel = RiskLevel.Medium;
                            if (risk.ResidualRiskLevel == 0) risk.ResidualRiskLevel = RiskLevel.Medium;
                            if (risk.RiskLevel == 0) risk.RiskLevel = RiskLevel.Medium;
                            
                            // Generate risk number if not provided
                            if (string.IsNullOrEmpty(risk.RiskNumber))
                            {
                                risk.RiskNumber = $"RISK-{DateTime.Now:yyyyMMdd}-{id:000}-{risk.Title.Substring(0, Math.Min(3, risk.Title.Length)).ToUpper()}";
                            }
                            
                            // Set default treatment if not provided
                            if (risk.Treatment == 0)
                            {
                                risk.Treatment = TreatmentStrategy.Mitigate;
                            }
                            
                            _context.Risks.Add(risk);
                        }
                        await _context.SaveChangesAsync();
                    }

                    TempData["Success"] = "Risk assessment updated successfully.";
                    return RedirectToAction(nameof(Details), new { id = model.Assessment.Id });
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error updating assessment: {ex.Message}";
                }
            }

            // Reload risk level settings if validation fails
            model.RiskLevelSettings = await _settingsService.GetSettingsByIdAsync(1);
            return View(model);
        }

        // UPDATED: Only GRC and Admin can complete assessments
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
        public async Task<IActionResult> Complete(int id)
        {
            try
            {
                Console.WriteLine($"=== Completing assessment {id} ===");

                var assessment = await _assessmentService.GetAssessmentByIdAsync(id);
                if (assessment == null)
                {
                    Console.WriteLine("Assessment not found");
                    return NotFound();
                }

                // Mark as completed
                assessment.Status = AssessmentStatus.Completed;
                assessment.DateCompleted = DateTime.Today;

                await _assessmentService.UpdateAssessmentAsync(assessment);
                Console.WriteLine("Assessment marked as completed");

                var risksCreated = 0;

                // Create risks ONLY from manually identified risks in the assessment
                if (assessment.Status == AssessmentStatus.Completed && assessment.IdentifiedRisks?.Any() == true)
                {
                    var currentSettings = await _settingsService.GetActiveSettingsAsync();
                    
                    foreach (var identifiedRisk in assessment.IdentifiedRisks)
                    {
                        // Create risk entry from identified risk
                        var risk = new Risk
                        {
                            Title = identifiedRisk.Title,
                            Description = identifiedRisk.Description,
                            Asset = assessment.Asset,
                            BusinessUnit = assessment.BusinessUnit ?? "Unknown",
                            ThreatScenario = assessment.ThreatScenario,
                            CIATriad = assessment.CIATriad ?? CIATriad.All,
                            Owner = !string.IsNullOrEmpty(identifiedRisk.Owner) ? identifiedRisk.Owner : 
                                   (!string.IsNullOrEmpty(assessment.Assessor) ? assessment.Assessor : "Unknown"),
                            // Inherit ALE from the assessment (especially important for FAIR assessments)
                            ALE = assessment.AnnualLossExpectancy ?? 0m,
                            RiskAssessmentId = assessment.Id,
                            Status = RiskStatus.Open,
                            OpenDate = DateTime.Today,
                            NextReviewDate = DateTime.Today.AddMonths(3),
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow,
                            Impact = ImpactLevel.High,
                            Likelihood = LikelihoodLevel.Possible,
                            Exposure = ExposureLevel.HighlyExposed,
                            Treatment = TreatmentStrategy.Mitigate
                        };

                        // Use the assessment's risk level calculation method for consistency
                        var calculatedRiskLevel = assessment.CalculateRiskLevel();
                        risk.RiskLevel = calculatedRiskLevel switch
                        {
                            "Critical" => RiskLevel.Critical,
                            "High" => RiskLevel.High,
                            "Medium" => RiskLevel.Medium,
                            "Low" => RiskLevel.Low,
                            _ => RiskLevel.Medium // Fallback for "Unknown" or other values
                        };

                        risk.InherentRiskLevel = risk.RiskLevel;
                        risk.ResidualRiskLevel = risk.RiskLevel;

                        await _riskService.CreateRiskAsync(risk);
                        risksCreated++;

                        Console.WriteLine($"✅ Created identified risk '{risk.Title}' from {assessment.AssessmentType} assessment");
                        Console.WriteLine($"   - Assessment ALE: ${assessment.AnnualLossExpectancy ?? 0:N0}");
                        Console.WriteLine($"   - Risk ALE: ${risk.ALE:N0}");
                        Console.WriteLine($"   - Risk Level: {risk.RiskLevel}");
                    }
                }

                TempData["Success"] = $"Assessment completed successfully! {risksCreated} risk(s) created.";
                return RedirectToAction(nameof(Details), new { id });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error completing assessment: {ex.Message}");
                TempData["Error"] = $"Error completing assessment: {ex.Message}";
                return RedirectToAction(nameof(Details), new { id });
            }
        }

        // ADDED: Helper method to load findings for dropdown
        private async Task LoadFindingsForViewModel(RiskAssessmentViewModel model)
        {
            try
            {
                var findings = await _findingService.GetAllFindingsAsync();
                model.AvailableFindings = findings
                    .Where(f => f.Status == FindingStatus.Open) // Only show open findings
                    .Select(f => new SelectListItem
                    {
                        Value = f.Id.ToString(),
                        Text = $"{f.Title} (Risk: {f.RiskRating})"
                    })
                    .ToList();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error loading findings: {ex.Message}");
                model.AvailableFindings = new List<SelectListItem>();
            }
        }

        // PDF Export Actions
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> ExportToPdf(int id)
        {
            try
            {
                var assessment = await _assessmentService.GetAssessmentByIdAsync(id);
                if (assessment == null)
                    return NotFound();

                var pdfBytes = await _pdfExportService.ExportRiskAssessmentToPdfAsync(assessment);
                var fileName = $"RiskAssessment_{assessment.Id}_{DateTime.Now:yyyyMMdd}.pdf";
                
                return File(pdfBytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error generating PDF: {ex.Message}";
                return RedirectToAction(nameof(Details), new { id });
            }
        }

        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> ExportMultipleToPdf(string ids)
        {
            try
            {
                if (string.IsNullOrEmpty(ids))
                {
                    TempData["Error"] = "No assessments selected for export.";
                    return RedirectToAction(nameof(Index));
                }

                var idList = ids.Split(',').Select(int.Parse).ToList();
                var assessments = new List<RiskAssessment>();

                foreach (var id in idList)
                {
                    var assessment = await _assessmentService.GetAssessmentByIdAsync(id);
                    if (assessment != null)
                        assessments.Add(assessment);
                }

                if (!assessments.Any())
                {
                    TempData["Error"] = "No valid assessments found for export.";
                    return RedirectToAction(nameof(Index));
                }

                var pdfBytes = await _pdfExportService.ExportMultipleRiskAssessmentsToPdfAsync(assessments);
                var fileName = $"RiskAssessments_{DateTime.Now:yyyyMMdd}.pdf";
                
                return File(pdfBytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error generating PDF: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }

        // API endpoint to get available risk assessments for linking
        [HttpGet]
        [Route("api/riskassessments/available")]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> GetAvailableRiskAssessments()
        {
            try
            {
                var assessments = await _assessmentService.GetAllAssessmentsAsync();
                var availableAssessments = assessments
                    .Select(a => new
                    {
                        id = a.Id,
                        title = a.Title,
                        asset = a.Asset,
                        assessmentType = a.AssessmentType.ToString(),
                        riskLevel = a.CalculateRiskLevel(),
                        ale = a.AnnualLossExpectancy,
                        createdDate = a.CreatedAt,
                        businessUnit = a.BusinessUnit
                    })
                    .ToList();

                return Json(availableAssessments);
            }
            catch (Exception ex)
            {
                return Json(new List<object>());
            }
        }

        // UPDATED: Only Admin can delete risk assessments
        [HttpPost, ActionName("DeleteConfirmed")]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            try
            {
                var assessment = await _assessmentService.GetAssessmentByIdAsync(id);
                if (assessment == null)
                {
                    TempData["Error"] = "Risk assessment not found.";
                    return RedirectToAction(nameof(Index));
                }

                var success = await _assessmentService.DeleteAssessmentAsync(id);
                if (success)
                {
                    TempData["Success"] = $"Risk assessment '{assessment.Title}' for asset '{assessment.Asset}' deleted successfully.";
                }
                else
                {
                    TempData["Error"] = "Failed to delete risk assessment.";
                }

                return RedirectToAction(nameof(Index));
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error deleting risk assessment: {ex.Message}";
                return RedirectToAction(nameof(Index));
            }
        }
    }
}