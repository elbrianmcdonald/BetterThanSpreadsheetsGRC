using CyberRiskApp.Authorization;
using CyberRiskApp.Data;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.ViewModels;
using CyberRiskApp.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using CyberRiskApp.Extensions;

namespace CyberRiskApp.Controllers
{
    // REMOVED: [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)] - controller level authorization
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
        private readonly IRiskAssessmentThreatModelService _riskAssessmentThreatModelService; // ADDED: Risk assessment threat model service
        private readonly IRiskBacklogService _backlogService; // ADDED: Risk backlog service

        public RiskAssessmentsController(
            IRiskAssessmentService assessmentService,
            IRiskService riskService,
            IRiskLevelSettingsService settingsService,
            IFindingService findingService, // ADDED: Findings service
            IPdfExportService pdfExportService,
            IRiskMatrixService riskMatrixService, // ADDED: Risk matrix service
            CyberRiskContext context, // ADDED: Context for control management
            IThreatModelingService threatModelingService, // ADDED: Threat modeling service
            IRiskAssessmentThreatModelService riskAssessmentThreatModelService, // ADDED: Risk assessment threat model service
            IRiskBacklogService backlogService) // ADDED: Risk backlog service
        {
            _assessmentService = assessmentService;
            _riskService = riskService;
            _settingsService = settingsService;
            _findingService = findingService; // ADDED: Findings service
            _pdfExportService = pdfExportService;
            _riskMatrixService = riskMatrixService; // ADDED: Risk matrix service
            _context = context; // ADDED: Context for control management
            _threatModelingService = threatModelingService; // ADDED: Threat modeling service
            _riskAssessmentThreatModelService = riskAssessmentThreatModelService; // ADDED: Risk assessment threat model service
            _backlogService = backlogService; // ADDED: Risk backlog service
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

            // Load risk level settings for risk appetite line on chart
            var riskLevelSettings = await _settingsService.GetActiveSettingsAsync();
            ViewBag.RiskLevelSettings = riskLevelSettings;

            return View(assessment);
        }

        // UPDATED: Only GRC and Admin can create assessments - Assessment Type Selection
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public IActionResult Create()
        {
            // Redirect to the assessment type selection page
            return RedirectToAction(nameof(SelectType));
        }

        // NEW: Assessment type selection page
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public IActionResult SelectType()
        {
            return View();
        }


        // NEW: Create Qualitative Assessment
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> CreateQualitative(int? matrixId = null)
        {
            // Get all available matrices
            var allMatrices = await _riskMatrixService.GetAllMatricesAsync();
            var activeMatrices = allMatrices.Where(m => m.IsActive).ToList();
            
            // Select matrix to use: specified matrixId, or default, or first available
            RiskMatrix? selectedMatrix = null;
            if (matrixId.HasValue)
            {
                selectedMatrix = await _riskMatrixService.GetMatrixByIdAsync(matrixId.Value);
            }
            
            if (selectedMatrix == null)
            {
                selectedMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            }
            
            if (selectedMatrix == null && activeMatrices.Any())
            {
                selectedMatrix = activeMatrices.First();
            }
            
            // Log what we found
            System.Diagnostics.Debug.WriteLine($"Selected Matrix Found: {selectedMatrix != null}");
            if (selectedMatrix != null)
            {
                System.Diagnostics.Debug.WriteLine($"Selected Matrix ID: {selectedMatrix.Id}, Name: {selectedMatrix.Name}");
            }

            var model = new FAIRAssessmentViewModel
            {
                Assessment = new RiskAssessment
                {
                    AssessmentType = AssessmentType.Qualitative, // Set to Qualitative
                    Status = AssessmentStatus.Draft, // Set default status
                    
                    // Qualitative defaults (using decimal values from typical 5x5 matrix)
                    QualitativeLikelihood = 2.0m, // Possible
                    QualitativeImpact = 3.0m, // Medium 
                    QualitativeExposure = 0.4m, // Exposed level
                    
                    // Set selected risk matrix
                    RiskMatrixId = selectedMatrix?.Id,
                    
                    // Threat details moved to separate threat modeling functionality
                },
                QualitativeControls = new List<QualitativeControl>()
            };

            // Load risk level settings (for backwards compatibility)
            model.RiskLevelSettings = await _settingsService.GetSettingsByIdAsync(1);

            // Load available approved threat model templates
            var approvedTemplatesForQualitative = await _riskAssessmentThreatModelService.GetApprovedTemplatesAsync();
            model.AvailableThreatModels = approvedTemplatesForQualitative.ToList();

            // Pass available matrices to the view
            ViewBag.AvailableMatrices = activeMatrices;
            ViewBag.SelectedMatrix = selectedMatrix;
            ViewBag.DefaultMatrix = selectedMatrix; // Keep for backwards compatibility with existing JS
            
            // Pass selected matrix cells and levels for risk calculation
            if (selectedMatrix != null)
            {
                // Use the levels already included with the matrix
                var matrixLevels = selectedMatrix.Levels?.ToList() ?? await _riskMatrixService.GetLevelsByMatrixIdAsync(selectedMatrix.Id);
                var matrixCells = selectedMatrix.MatrixCells?.ToList() ?? await _riskMatrixService.GetCellsByMatrixIdAsync(selectedMatrix.Id);
                
                ViewBag.DefaultMatrixCells = matrixCells;
                ViewBag.DefaultMatrixLevels = matrixLevels;
                
                // Debug logging
                var levelsCount = matrixLevels?.Count() ?? 0;
                var cellsCount = matrixCells?.Count() ?? 0;
                System.Diagnostics.Debug.WriteLine($"Selected Matrix: {selectedMatrix.Name} (ID: {selectedMatrix.Id})");
                System.Diagnostics.Debug.WriteLine($"Matrix Size: {selectedMatrix.MatrixSize}");
                System.Diagnostics.Debug.WriteLine($"Matrix Type: {selectedMatrix.MatrixType}");
                System.Diagnostics.Debug.WriteLine($"Matrix Levels Count: {levelsCount}");
                System.Diagnostics.Debug.WriteLine($"Matrix Cells Count: {cellsCount}");
                
                if (matrixLevels != null && matrixLevels.Any())
                {
                    foreach (var level in matrixLevels)
                    {
                        System.Diagnostics.Debug.WriteLine($"Level: Type={level.LevelType}, Name={level.LevelName}, Value={level.LevelValue}, Multiplier={level.Multiplier}");
                    }
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine("WARNING: No levels found for selected matrix!");
                }
            }
            else
            {
                System.Diagnostics.Debug.WriteLine("WARNING: No matrix found in the system!");
                ViewBag.DefaultMatrixCells = new List<RiskMatrixCell>();
                ViewBag.DefaultMatrixLevels = new List<RiskMatrixLevel>();
            }

            return View(model);
        }


        // NEW: POST action for Qualitative Assessment creation
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        [CleanupEmptyRisks]
        public async Task<IActionResult> CreateQualitative(FAIRAssessmentViewModel model)
        {
            // Ensure assessment type is set to Qualitative
            model.Assessment.AssessmentType = AssessmentType.Qualitative;

            // Remove audit fields from model validation since they're set automatically
            ModelState.Remove("Assessment.CreatedBy");
            ModelState.Remove("Assessment.UpdatedBy");
            
            // Remove any nested audit fields from complex objects
            var auditKeys = ModelState.Keys.Where(k => 
                k.Contains("CreatedBy") || 
                k.Contains("UpdatedBy") ||
                k.Contains("CreatedAt") ||
                k.Contains("UpdatedAt")).ToList();
            foreach (var key in auditKeys)
            {
                ModelState.Remove(key);
            }

            // NUCLEAR OPTION: Remove ALL IdentifiedRisks related ModelState entries
            var keysToRemove = ModelState.Keys.Where(k => k.Contains("IdentifiedRisks")).ToList();
            foreach (var key in keysToRemove)
            {
                ModelState.Remove(key);
            }

            // Remove ThreatEvent and LossEvent validation since they're nested within ThreatScenarios
            var threatKeys = ModelState.Keys.Where(k => 
                k.Contains("ThreatEvents") || 
                k.Contains("LossEvents") ||
                k.Contains("RiskAssessment")).ToList();
            foreach (var key in threatKeys)
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
                
                // Additional check - remove any remaining CreatedBy/UpdatedBy errors
                var remainingAuditErrors = ModelState.Keys.Where(k => 
                    k.Contains("Created By") || 
                    k.Contains("Updated By") ||
                    ModelState[k].Errors.Any(e => 
                        e.ErrorMessage.Contains("Created By") || 
                        e.ErrorMessage.Contains("Updated By"))).ToList();
                        
                foreach (var key in remainingAuditErrors)
                {
                    Console.WriteLine($"Removing remaining audit error: {key}");
                    ModelState.Remove(key);
                }
            }

            if (ModelState.IsValid)
            {
                // Use execution strategy to handle PostgreSQL retry logic properly
                var strategy = _context.Database.CreateExecutionStrategy();
                RiskAssessment? createdAssessment = null;
                bool success = false;
                string? errorMessage = null;
                
                await strategy.ExecuteAsync(async () =>
                {
                    using var transaction = await _context.Database.BeginTransactionAsync();
                    try
                {
                    Console.WriteLine($"🔄 DEBUGGING: Starting CreateQualitative transaction");
                    
                        // Set assessment metadata
                        model.Assessment.Assessor = User.Identity?.Name ?? "Current User";
                        model.Assessment.Status = AssessmentStatus.Draft; // Set default status
                        model.Assessment.CreatedAt = DateTime.UtcNow;
                        model.Assessment.UpdatedAt = DateTime.UtcNow;
                        model.Assessment.CreatedBy = User.Identity?.Name ?? "System";
                        model.Assessment.UpdatedBy = User.Identity?.Name ?? "System";

                        createdAssessment = await _assessmentService.CreateAssessmentAsync(model.Assessment);
                    Console.WriteLine($"✅ DEBUGGING: Created assessment {createdAssessment.Id} - '{createdAssessment.Title}'");
                    
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

                    // Save identified risks and create backlog entries using proper service calls
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
                            
                            // Set default treatment if not provided
                            if (risk.Treatment == 0)
                            {
                                risk.Treatment = TreatmentStrategy.Mitigate;
                            }
                            
                            // Create backlog entry for risk approval (don't create the risk yet)
                            try
                            {
                                var riskDescription = BuildRiskDescriptionForBacklog(risk, model.Assessment);
                                var backlogEntry = await _backlogService.CreateBacklogEntryAsync(
                                    riskId: null, // No risk created yet - will be created upon approval
                                    actionType: RiskBacklogAction.NewRisk,
                                    description: riskDescription,
                                    justification: $"New risk identified from assessment '{model.Assessment.Title}' for asset '{model.Assessment.Asset}'. Risk level: {risk.RiskLevel}",
                                    requesterId: User.Identity?.Name ?? "System"
                                );
                                Console.WriteLine($"✅ DEBUGGING: Created backlog entry {backlogEntry.BacklogNumber} for risk '{risk.Title}' pending approval");
                            }
                            catch (Exception backlogEx)
                            {
                                // Log error but don't fail the assessment creation
                                Console.WriteLine($"❌ DEBUGGING: Failed to create backlog entry for risk '{risk.Title}': {backlogEx.Message}");
                            }
                        }
                    }

                    // Save threat scenarios and their risks if any were provided
                    if (model.ThreatScenarios != null && model.ThreatScenarios.Any())
                    {
                        // First collect all the risks from scenarios before clearing navigation properties
                        var allScenarioRisks = new List<(ThreatScenario scenario, List<Risk> risks)>();
                        
                        foreach (var scenario in model.ThreatScenarios.Where(s => !string.IsNullOrEmpty(s.Description)))
                        {
                            scenario.RiskAssessmentId = createdAssessment.Id;
                            scenario.CreatedAt = DateTime.UtcNow;
                            scenario.UpdatedAt = DateTime.UtcNow;
                            scenario.CreatedBy = User.Identity?.Name ?? "System";
                            scenario.UpdatedBy = User.Identity?.Name ?? "System";
                            
                            // RowVersion will be initialized by the model's default value
                            
                            // Calculate risk score for the scenario
                            scenario.CalculateRiskScore();
                            
                            // Collect the risks before clearing navigation property
                            var scenarioRisks = scenario.IdentifiedRisks?.Where(r => !string.IsNullOrEmpty(r.Title)).ToList() ?? new List<Risk>();
                            allScenarioRisks.Add((scenario, scenarioRisks));
                            
                            // Clear the navigation property to avoid EF confusion
                            scenario.IdentifiedRisks.Clear();
                            
                            _context.ThreatScenarios.Add(scenario);
                        }
                        await _context.SaveChangesAsync();
                        
                        // Save all collected risks from scenarios using proper service calls
                        foreach (var (scenario, risks) in allScenarioRisks)
                        {
                            foreach (var risk in risks)
                            {
                                risk.RiskAssessmentId = createdAssessment.Id;
                                risk.ThreatScenarioId = scenario.Id; // Link to the specific threat scenario
                                risk.Asset = model.Assessment.Asset;
                                risk.BusinessUnit = model.Assessment.BusinessUnit ?? "Unknown";
                                risk.ThreatScenario = scenario.Description; // Use scenario description as threat scenario
                                risk.CIATriad = model.Assessment.CIATriad ?? CIATriad.All;
                                risk.Status = RiskStatus.Open;
                                risk.OpenDate = DateTime.Today;
                                risk.NextReviewDate = DateTime.Today.AddMonths(3);
                                risk.CreatedAt = DateTime.UtcNow;
                                risk.UpdatedAt = DateTime.UtcNow;
                                
                                // Set default enum values if not provided
                                if (risk.Impact == 0) risk.Impact = ImpactLevel.Medium;
                                if (risk.Likelihood == 0) risk.Likelihood = LikelihoodLevel.Possible;
                                if (risk.Exposure == 0) risk.Exposure = ExposureLevel.ModeratelyExposed;
                                if (risk.InherentRiskLevel == 0) risk.InherentRiskLevel = RiskLevel.Medium;
                                if (risk.ResidualRiskLevel == 0) risk.ResidualRiskLevel = RiskLevel.Medium;
                                if (risk.RiskLevel == 0) risk.RiskLevel = RiskLevel.Medium;
                                
                                // Set default treatment if not provided
                                if (risk.Treatment == 0)
                                {
                                    risk.Treatment = TreatmentStrategy.Mitigate;
                                }
                                
                                // Create backlog entry for risk approval (don't create the risk yet)
                                try
                                {
                                    var riskDescription = BuildRiskDescriptionForBacklog(risk, model.Assessment);
                                    riskDescription += $"\nThreat Scenario: {scenario.Description}\n";
                                    if (scenario.QualitativeLikelihood.HasValue)
                                    {
                                        riskDescription += $"Scenario Likelihood: {scenario.QualitativeLikelihood.Value}\n";
                                    }
                                    if (scenario.QualitativeImpact.HasValue)
                                    {
                                        riskDescription += $"Scenario Impact: {scenario.QualitativeImpact.Value}\n";
                                    }
                                    if (scenario.QualitativeRiskScore.HasValue)
                                    {
                                        riskDescription += $"Scenario Risk Score: {scenario.QualitativeRiskScore.Value}\n";
                                    }
                                    
                                    var requesterId = User.Identity?.Name ?? "System";
                                    var justification = $"New risk identified from threat scenario in assessment '{model.Assessment.Title}' for asset '{model.Assessment.Asset}'. Risk level: {risk.RiskLevel}";
                                    
                                    Console.WriteLine($"🔍 CONTROLLER DEBUG: About to create backlog entry");
                                    Console.WriteLine($"🔍 CONTROLLER DEBUG: riskId=null, actionType=NewRisk, requesterId='{requesterId}'");
                                    Console.WriteLine($"🔍 CONTROLLER DEBUG: description length={riskDescription?.Length}, justification length={justification?.Length}");
                                    
                                    var backlogEntry = await _backlogService.CreateBacklogEntryAsync(
                                        riskId: null, // No risk created yet - will be created upon approval
                                        actionType: RiskBacklogAction.NewRisk,
                                        description: riskDescription,
                                        justification: justification,
                                        requesterId: requesterId
                                    );
                                    Console.WriteLine($"✅ DEBUGGING: Created backlog entry {backlogEntry.BacklogNumber} for threat scenario risk '{risk.Title}' pending approval");
                                }
                                catch (Exception backlogEx)
                                {
                                    // Log error but don't fail the assessment creation
                                    Console.WriteLine($"❌ DEBUGGING: Failed to create backlog entry for threat scenario risk '{risk.Title}': {backlogEx.Message}");
                                }
                            }
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

                        // Commit the transaction if everything succeeded
                        await transaction.CommitAsync();
                        Console.WriteLine($"✅ DEBUGGING: Transaction committed successfully");
                        
                        success = true;
                    }
                    catch (Exception ex)
                    {
                        // Rollback the transaction on any error
                        await transaction.RollbackAsync();
                        Console.WriteLine($"❌ DEBUGGING: Transaction rolled back due to error: {ex.Message}");
                        
                        errorMessage = ex.Message;
                        if (ex.InnerException != null)
                        {
                            errorMessage += $" Inner exception: {ex.InnerException.Message}";
                        }
                        success = false;
                    }
                });
                
                // Handle the results outside the execution strategy
                if (success && createdAssessment != null)
                {
                    TempData["Success"] = "Risk assessment completed successfully! Identified risks have been submitted to the backlog for GRC review and approval.";
                    return RedirectToAction(nameof(Details), new { id = createdAssessment.Id });
                }
                else
                {
                    TempData["Error"] = $"Error creating qualitative assessment: {errorMessage}";
                    
                    // Need to reload the model data and return the view
                    var approvedTemplatesReloadError = await _riskAssessmentThreatModelService.GetApprovedTemplatesAsync();
                    model.AvailableThreatModels = approvedTemplatesReloadError.ToList();
                    
                    var allMatricesError = await _riskMatrixService.GetAllMatricesAsync();
                    ViewBag.AvailableMatrices = allMatricesError.Where(m => m.IsActive).ToList();
                    ViewBag.DefaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
                    
                    return View(model);
                }
            }

            // Reload risk level settings and threat models if validation fails
            model.RiskLevelSettings = await _settingsService.GetSettingsByIdAsync(1);
            var approvedTemplatesReloadQualitative = await _riskAssessmentThreatModelService.GetApprovedTemplatesAsync();
            model.AvailableThreatModels = approvedTemplatesReloadQualitative.ToList();
            
            // Also reload matrices for qualitative assessments
            var allMatrices = await _riskMatrixService.GetAllMatricesAsync();
            ViewBag.AvailableMatrices = allMatrices.Where(m => m.IsActive).ToList();
            ViewBag.DefaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            
            return View(model);
        }

        // LEGACY: Original Create POST method - keeping for backward compatibility
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
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
                            
                            // Risk number will be auto-generated by CreateRiskAsync
                            
                            // Set default treatment if not provided
                            if (risk.Treatment == 0)
                            {
                                risk.Treatment = TreatmentStrategy.Mitigate;
                            }
                            
                            // Create backlog entry for risk approval (don't create the risk yet)
                            try
                            {
                                var riskDescription = BuildRiskDescriptionForBacklog(risk, createdAssessment);
                                await _backlogService.CreateBacklogEntryAsync(
                                    riskId: null, // No risk created yet - will be created upon approval
                                    actionType: RiskBacklogAction.NewRisk,
                                    description: riskDescription,
                                    justification: $"New risk identified from assessment '{createdAssessment.Title}' for asset '{createdAssessment.Asset}'. Risk level: {risk.RiskLevel}",
                                    requesterId: User.Identity?.Name ?? "System"
                                );
                            }
                            catch (Exception backlogEx)
                            {
                                // Log error but don't fail the assessment creation
                                Console.WriteLine($"Warning: Failed to create backlog entry for risk '{risk.Title}': {backlogEx.Message}");
                            }
                        }
                    }

                    TempData["Success"] = "Risk assessment created successfully! Identified risks have been submitted to the backlog for GRC review and approval.";
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

        // Edit GET action method
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Edit(int id)
        {
            var assessment = await _assessmentService.GetAssessmentByIdAsync(id);
            if (assessment == null)
                return NotFound();

            var model = new FAIRAssessmentViewModel
            {
                Assessment = assessment,
                // Qualitative and identified risks
                QualitativeControls = assessment.QualitativeControls?.ToList() ?? new List<QualitativeControl>(),
                IdentifiedRisks = assessment.IdentifiedRisks?.ToList() ?? new List<Risk>(),
                ThreatScenarios = assessment.ThreatScenarios?.ToList() ?? new List<ThreatScenario>()
            };

            // Load risk level settings
            model.RiskLevelSettings = await _settingsService.GetSettingsByIdAsync(1);

            return View(model);
        }

        // Edit POST action method
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
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
                            
                            // Risk number will be auto-generated by CreateRiskAsync
                            
                            // Set default treatment if not provided
                            if (risk.Treatment == 0)
                            {
                                risk.Treatment = TreatmentStrategy.Mitigate;
                            }
                            
                            // Create backlog entry for risk approval (don't create the risk yet)
                            try
                            {
                                var riskDescription = BuildRiskDescriptionForBacklog(risk, model.Assessment);
                                await _backlogService.CreateBacklogEntryAsync(
                                    riskId: null, // No risk created yet - will be created upon approval
                                    actionType: RiskBacklogAction.NewRisk,
                                    description: riskDescription,
                                    justification: $"New risk identified from assessment '{model.Assessment.Title}' for asset '{model.Assessment.Asset}'. Risk level: {risk.RiskLevel}",
                                    requesterId: User.Identity?.Name ?? "System"
                                );
                            }
                            catch (Exception backlogEx)
                            {
                                // Log error but don't fail the assessment creation
                                Console.WriteLine($"Warning: Failed to create backlog entry for risk '{risk.Title}': {backlogEx.Message}");
                            }
                        }
                    }

                    // Update threat scenarios and their risks
                    if (model.ThreatScenarios != null)
                    {
                        // Remove existing threat scenarios
                        var existingScenarios = _context.ThreatScenarios.Where(s => s.RiskAssessmentId == id);
                        _context.ThreatScenarios.RemoveRange(existingScenarios);

                        // Collect all risks before clearing navigation properties
                        var allScenarioRisks = new List<(ThreatScenario scenario, List<Risk> risks)>();
                        
                        // Add updated threat scenarios
                        foreach (var scenario in model.ThreatScenarios.Where(s => !string.IsNullOrEmpty(s.Description)))
                        {
                            scenario.RiskAssessmentId = id;
                            scenario.CreatedAt = scenario.CreatedAt == DateTime.MinValue ? DateTime.UtcNow : scenario.CreatedAt;
                            scenario.UpdatedAt = DateTime.UtcNow;
                            scenario.CreatedBy = scenario.CreatedBy ?? User.Identity?.Name ?? "System";
                            scenario.UpdatedBy = User.Identity?.Name ?? "System";
                            
                            // RowVersion will be initialized by the model's default value
                            
                            // Calculate risk score for the scenario
                            scenario.CalculateRiskScore();
                            
                            // Collect the risks before clearing navigation property
                            var scenarioRisks = scenario.IdentifiedRisks?.Where(r => !string.IsNullOrEmpty(r.Title)).ToList() ?? new List<Risk>();
                            allScenarioRisks.Add((scenario, scenarioRisks));
                            
                            // Clear the navigation property to avoid EF confusion
                            scenario.IdentifiedRisks.Clear();
                            
                            _context.ThreatScenarios.Add(scenario);
                        }
                        await _context.SaveChangesAsync();
                        
                        // Now save all collected risks from scenarios
                        foreach (var (scenario, risks) in allScenarioRisks)
                        {
                            foreach (var risk in risks)
                            {
                                risk.RiskAssessmentId = id;
                                risk.Asset = model.Assessment.Asset;
                                risk.BusinessUnit = model.Assessment.BusinessUnit ?? "Unknown";
                                risk.ThreatScenario = scenario.Description; // Use scenario description as threat scenario
                                risk.CIATriad = model.Assessment.CIATriad ?? CIATriad.All;
                                risk.Status = risk.Status == 0 ? RiskStatus.Open : risk.Status;
                                risk.OpenDate = risk.OpenDate == DateTime.MinValue ? DateTime.Today : risk.OpenDate;
                                risk.NextReviewDate = risk.NextReviewDate ?? DateTime.Today.AddMonths(3);
                                risk.CreatedAt = risk.CreatedAt == DateTime.MinValue ? DateTime.UtcNow : risk.CreatedAt;
                                risk.UpdatedAt = DateTime.UtcNow;
                                
                                // Set default enum values if not provided
                                if (risk.Impact == 0) risk.Impact = ImpactLevel.Medium;
                                if (risk.Likelihood == 0) risk.Likelihood = LikelihoodLevel.Possible;
                                if (risk.Exposure == 0) risk.Exposure = ExposureLevel.ModeratelyExposed;
                                if (risk.InherentRiskLevel == 0) risk.InherentRiskLevel = RiskLevel.Medium;
                                if (risk.ResidualRiskLevel == 0) risk.ResidualRiskLevel = RiskLevel.Medium;
                                if (risk.RiskLevel == 0) risk.RiskLevel = RiskLevel.Medium;
                                
                                // Set default treatment if not provided
                                if (risk.Treatment == 0)
                                {
                                    risk.Treatment = TreatmentStrategy.Mitigate;
                                }
                                
                                // Create backlog entry for risk approval (don't create the risk yet)
                            try
                            {
                                var riskDescription = BuildRiskDescriptionForBacklog(risk, model.Assessment);
                                await _backlogService.CreateBacklogEntryAsync(
                                    riskId: null, // No risk created yet - will be created upon approval
                                    actionType: RiskBacklogAction.NewRisk,
                                    description: riskDescription,
                                    justification: $"New risk identified from assessment '{model.Assessment.Title}' for asset '{model.Assessment.Asset}'. Risk level: {risk.RiskLevel}",
                                    requesterId: User.Identity?.Name ?? "System"
                                );
                            }
                            catch (Exception backlogEx)
                            {
                                // Log error but don't fail the assessment creation
                                Console.WriteLine($"Warning: Failed to create backlog entry for risk '{risk.Title}': {backlogEx.Message}");
                            }
                            }
                        }
                    }

                    TempData["Success"] = "Risk assessment updated successfully! Any new identified risks have been submitted to the backlog for GRC review and approval.";
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
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Complete(int id)
        {
            try
            {
                Console.WriteLine($"=== DEBUGGING: Starting Complete method for assessment {id} ===");

                // STEP 1: Load assessment
                var assessment = await _assessmentService.GetAssessmentByIdAsync(id);
                if (assessment == null)
                {
                    Console.WriteLine("❌ DEBUGGING: Assessment not found");
                    return NotFound();
                }

                Console.WriteLine($"✅ DEBUGGING: Assessment loaded. Title: '{assessment.Title}', Status: {assessment.Status}");
                Console.WriteLine($"   DEBUGGING: Assessment Type: {assessment.AssessmentType}");
                Console.WriteLine($"   DEBUGGING: Asset: '{assessment.Asset}'");
                Console.WriteLine($"   DEBUGGING: Business Unit: '{assessment.BusinessUnit}'");

                // STEP 2: Check if assessment is already completed
                var wasAlreadyCompleted = assessment.Status == AssessmentStatus.Completed;
                Console.WriteLine($"   DEBUGGING: Assessment was already completed: {wasAlreadyCompleted}");

                if (wasAlreadyCompleted)
                {
                    Console.WriteLine("⚠️ DEBUGGING: Assessment already completed, no backlog entries will be created");
                    TempData["Warning"] = "Assessment was already completed.";
                    return RedirectToAction(nameof(Details), new { id });
                }

                // STEP 3: Check IdentifiedRisks collection before marking complete
                Console.WriteLine($"   DEBUGGING: IdentifiedRisks collection is null: {assessment.IdentifiedRisks == null}");
                if (assessment.IdentifiedRisks != null)
                {
                    Console.WriteLine($"   DEBUGGING: IdentifiedRisks count: {assessment.IdentifiedRisks.Count()}");
                    foreach (var identifiedRisk in assessment.IdentifiedRisks)
                    {
                        Console.WriteLine($"   DEBUGGING: - Found identified risk: '{identifiedRisk.Title}' (ID: {identifiedRisk.Id})");
                    }
                }

                // STEP 4: Mark as completed
                Console.WriteLine("🔄 DEBUGGING: Marking assessment as completed...");
                assessment.Status = AssessmentStatus.Completed;
                assessment.DateCompleted = DateTime.Today;

                await _assessmentService.UpdateAssessmentAsync(assessment);
                Console.WriteLine("✅ DEBUGGING: Assessment status updated to Completed");

                var risksCreated = 0;
                var backlogEntriesCreated = 0;

                // STEP 4: Collect all risks from both sources
                Console.WriteLine($"🔍 DEBUGGING: Collecting risks from all sources:");
                
                // Collect direct assessment risks
                var allRisks = new List<Risk>();
                if (assessment.IdentifiedRisks?.Any() == true)
                {
                    Console.WriteLine($"   - Found {assessment.IdentifiedRisks.Count} direct assessment risks");
                    allRisks.AddRange(assessment.IdentifiedRisks);
                }
                
                // Collect threat scenario risks
                if (assessment.ThreatScenarios?.Any() == true)
                {
                    foreach (var scenario in assessment.ThreatScenarios)
                    {
                        if (scenario.IdentifiedRisks?.Any() == true)
                        {
                            Console.WriteLine($"   - Found {scenario.IdentifiedRisks.Count} risks in threat scenario '{scenario.Description}'");
                            allRisks.AddRange(scenario.IdentifiedRisks);
                        }
                    }
                }
                
                Console.WriteLine($"   - Total risks collected: {allRisks.Count}");

                // Create risks from all collected sources
                if (assessment.Status == AssessmentStatus.Completed && allRisks.Any())
                {
                    Console.WriteLine("✅ DEBUGGING: Entering risk creation loop");
                    var currentSettings = await _settingsService.GetActiveSettingsAsync();
                    Console.WriteLine($"   DEBUGGING: Risk level settings loaded: {currentSettings != null}");
                    
                    foreach (var identifiedRisk in allRisks)
                    {
                        Console.WriteLine($"🔄 DEBUGGING: Processing identified risk: '{identifiedRisk.Title}'");

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
                            // Set default ALE for qualitative assessments
                            ALE = 0m,
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

                        Console.WriteLine($"   DEBUGGING: Risk object created with title: '{risk.Title}'");

                        // Use the assessment's risk level calculation method for consistency
                        var calculatedRiskLevel = assessment.CalculateRiskLevel();
                        Console.WriteLine($"   DEBUGGING: Calculated risk level: '{calculatedRiskLevel}'");
                        
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

                        Console.WriteLine($"   DEBUGGING: Creating backlog entry for risk approval...");
                        
                        // Create backlog entry for risk approval (don't create the risk yet)
                        try
                        {
                            var riskDescription = BuildRiskDescriptionForBacklog(risk, assessment);
                            var backlogEntry = await _backlogService.CreateBacklogEntryAsync(
                                riskId: null, // No risk created yet - will be created upon approval
                                actionType: RiskBacklogAction.NewRisk,
                                description: riskDescription,
                                justification: $"New risk identified from assessment '{assessment.Title}' for asset '{assessment.Asset}'. Risk level: {risk.RiskLevel}",
                                requesterId: User.Identity?.Name ?? "System"
                            );
                            backlogEntriesCreated++;
                            Console.WriteLine($"✅ DEBUGGING: Backlog entry created with number: {backlogEntry.BacklogNumber}");
                            Console.WriteLine($"✅ Created backlog entry {backlogEntry.BacklogNumber} for risk '{risk.Title}' pending approval");
                        }
                        catch (Exception backlogEx)
                        {
                            Console.WriteLine($"❌ DEBUGGING: Backlog creation failed: {backlogEx.Message}");
                            if (backlogEx.InnerException != null)
                            {
                                Console.WriteLine($"   DEBUGGING: Inner exception: {backlogEx.InnerException.Message}");
                            }
                            Console.WriteLine($"❌ Failed to create backlog entry for risk '{risk.Title}': {backlogEx.Message}");
                            // Log the error but continue with other risks
                        }
                        Console.WriteLine($"   - Risk ALE: ${risk.ALE:N0}");
                        Console.WriteLine($"   - Risk Level: {risk.RiskLevel}");
                    }
                }
                else
                {
                    Console.WriteLine("❌ DEBUGGING: Risk creation conditions not met - skipping risk creation");
                    if (assessment.Status != AssessmentStatus.Completed)
                        Console.WriteLine($"   DEBUGGING: Assessment status is not Completed: {assessment.Status}");
                    if (assessment.IdentifiedRisks == null)
                        Console.WriteLine("   DEBUGGING: IdentifiedRisks collection is null");
                    if (assessment.IdentifiedRisks?.Any() != true)
                        Console.WriteLine("   DEBUGGING: IdentifiedRisks collection is empty");
                }

                Console.WriteLine($"=== DEBUGGING: Complete method finished ===");
                Console.WriteLine($"   DEBUGGING: Total risks created: {risksCreated}");
                Console.WriteLine($"   DEBUGGING: Total backlog entries created: {backlogEntriesCreated}");

                TempData["Success"] = $"Assessment completed successfully! {backlogEntriesCreated} risk(s) submitted to backlog for GRC review and approval.";
                return RedirectToAction(nameof(Details), new { id });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ DEBUGGING: Exception in Complete method: {ex.Message}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"   DEBUGGING: Inner exception: {ex.InnerException.Message}");
                }
                Console.WriteLine($"   DEBUGGING: Stack trace: {ex.StackTrace}");
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

        // Generate Risks for Register
        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> GenerateRisks(int id)
        {
            try
            {
                var assessment = await _assessmentService.GetAssessmentByIdAsync(id);
                if (assessment == null)
                    return NotFound();
                    
                if (assessment.Status != AssessmentStatus.Completed)
                {
                    TempData["Error"] = "Only completed assessments can generate risks.";
                    return RedirectToAction(nameof(Details), new { id });
                }
                
                if (assessment.RisksGenerated)
                {
                    TempData["Info"] = "Risks from this assessment are already in the backlog for review and approval.";
                    return RedirectToAction("Index", "RiskBacklog");
                }
                else
                {
                    TempData["Info"] = "Risks are automatically generated when assessments are completed. Check the Risk Backlog to review pending risks.";
                    return RedirectToAction("Index", "RiskBacklog");
                }
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error generating risks: {ex.Message}";
                return RedirectToAction(nameof(Details), new { id });
            }
        }

        private async Task<List<RiskBacklogEntry>> GenerateRisksFromAssessmentAsync(RiskAssessment assessment, string userId)
        {
            var backlogEntries = new List<RiskBacklogEntry>();
            
            // Generate risks from threat scenarios
            if (assessment.ThreatScenarios?.Any() == true)
            {
                foreach (var scenario in assessment.ThreatScenarios.Where(ts => ts.QualitativeRiskScore > 0))
                {
                    // Create risk data object (don't save to database yet)
                    var riskData = new
                    {
                        Title = $"Risk from {assessment.Title} - Scenario {scenario.Id}",
                        Description = scenario.Description ?? "",
                        ThreatScenario = scenario.Description ?? "",
                        Asset = assessment.Asset,
                        BusinessUnit = assessment.BusinessUnit ?? "",
                        Owner = assessment.BusinessOwner ?? assessment.Assessor,
                        RiskAssessmentId = assessment.Id,
                        ThreatScenarioId = scenario.Id,
                        
                        // Map scenario values to risk (simplified mapping)
                        Impact = (ImpactLevel)Math.Min(5, Math.Max(1, (int)scenario.QualitativeImpact!)),
                        Likelihood = (LikelihoodLevel)Math.Min(5, Math.Max(1, (int)scenario.QualitativeLikelihood!)),
                        Exposure = (ExposureLevel)Math.Min(5, Math.Max(1, (int)scenario.QualitativeExposure!)),
                        InherentRiskLevel = MapRiskScore(scenario.QualitativeRiskScore!.Value),
                        RiskLevel = MapRiskScore(scenario.QualitativeRiskScore!.Value),
                        
                        CreatedBy = userId,
                        UpdatedBy = userId
                    };
                    
                    // Serialize risk data for backlog description
                    var riskDescription = System.Text.Json.JsonSerializer.Serialize(riskData);
                    
                    // Create backlog entry WITHOUT creating the risk yet
                    var backlogEntry = await _backlogService.CreateBacklogEntryAsync(
                        riskId: null, // No risk exists yet - will be created upon approval
                        actionType: RiskBacklogAction.NewRisk,
                        description: riskDescription, // Store full risk data here
                        justification: $"Risk assessment completed with {scenario.CalculateRiskLevel()} risk level (Score: {scenario.QualitativeRiskScore:F1})",
                        requesterId: userId
                    );
                    
                    backlogEntries.Add(backlogEntry);
                }
            }
            // Legacy: Single assessment-level risk
            else if (assessment.QualitativeRiskScore.HasValue && assessment.QualitativeRiskScore > 0)
            {
                // Create risk data object (don't save to database yet)
                var riskData = new
                {
                    Title = $"Risk from Assessment: {assessment.Title}",
                    Description = assessment.Description,
                    ThreatScenario = assessment.ThreatScenario,
                    Asset = assessment.Asset,
                    BusinessUnit = assessment.BusinessUnit ?? "",
                    Owner = assessment.BusinessOwner ?? assessment.Assessor,
                    RiskAssessmentId = assessment.Id,
                    
                    // Map assessment values (simplified mapping)
                    Impact = (ImpactLevel)Math.Min(5, Math.Max(1, (int)assessment.QualitativeImpact!)),
                    Likelihood = (LikelihoodLevel)Math.Min(5, Math.Max(1, (int)assessment.QualitativeLikelihood!)),
                    Exposure = (ExposureLevel)Math.Min(5, Math.Max(1, (int)assessment.QualitativeExposure!)),
                    InherentRiskLevel = MapRiskScore(assessment.QualitativeRiskScore.Value),
                    RiskLevel = MapRiskScore(assessment.QualitativeRiskScore.Value),
                    
                    CreatedBy = userId,
                    UpdatedBy = userId
                };
                
                // Serialize risk data for backlog description
                var riskDescription = System.Text.Json.JsonSerializer.Serialize(riskData);
                
                // Create backlog entry WITHOUT creating the risk yet
                var backlogEntry = await _backlogService.CreateBacklogEntryAsync(
                    riskId: null, // No risk exists yet - will be created upon approval
                    actionType: RiskBacklogAction.NewRisk,
                    description: riskDescription, // Store full risk data here
                    justification: $"Risk assessment completed with {assessment.CalculateRiskLevel()} risk level (Score: {assessment.QualitativeRiskScore:F1})",
                    requesterId: userId
                );
                
                backlogEntries.Add(backlogEntry);
            }
            
            // Mark assessment as having generated risks
            assessment.RisksGenerated = true;
            assessment.RisksGeneratedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            
            return backlogEntries;
        }
        
        private RiskLevel MapRiskScore(decimal score)
        {
            return score switch
            {
                >= 16 => RiskLevel.Critical,
                >= 10 => RiskLevel.High,
                >= 4 => RiskLevel.Medium,
                _ => RiskLevel.Low
            };
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
                        ale = 0m, // ALE not applicable for qualitative assessments
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
                var errorMessage = ex.Message;
                if (ex.InnerException != null)
                {
                    errorMessage += $" Inner exception: {ex.InnerException.Message}";
                }
                TempData["Error"] = $"Error deleting risk assessment: {errorMessage}";
                return RedirectToAction(nameof(Index));
            }
        }

        // ============================================
        // THREAT MODEL API ENDPOINTS FOR ASSESSMENTS
        // ============================================

        // API: Get approved threat model templates
        [HttpGet]
        [Route("api/riskassessments/threatmodels/templates")]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> GetApprovedThreatModelTemplates()
        {
            try
            {
                var templates = await _riskAssessmentThreatModelService.GetApprovedTemplatesAsync();
                var templateData = templates.Select(t => new
                {
                    id = t.Id,
                    name = t.Name,
                    description = t.Description,
                    status = t.Status.ToString(),
                    hasThreats = t.ThreatEvent != null,
                    hasVulnerabilities = t.AttackChainSteps?.Any() == true,
                    hasLossEvents = t.LossEvent != null
                }).ToList();

                return Json(templateData);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // API: Create assessment-specific copies of threat model templates
        [HttpPost]
        [Route("api/riskassessments/{riskAssessmentId}/threatmodels/copy")]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> CreateThreatModelCopies(int riskAssessmentId, [FromBody] List<int> templateIds)
        {
            try
            {
                var userId = User.Identity?.Name ?? "System";
                var copiedModels = await _riskAssessmentThreatModelService.CreateThreatModelCopiesAsync(
                    riskAssessmentId, templateIds, userId);

                var responseData = copiedModels.Select(tm => new
                {
                    id = tm.Id,
                    title = tm.Title,
                    description = tm.Description,
                    status = tm.Status.ToString(),
                    aleMinimum = tm.ALEMinimum,
                    aleMostLikely = tm.ALEMostLikely,
                    aleMaximum = tm.ALEMaximum,
                    templateId = tm.TemplateAttackChainId,
                    createdAt = tm.CreatedAt
                }).ToList();

                return Json(responseData);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // API: Get threat models for a specific risk assessment
        [HttpGet]
        [Route("api/riskassessments/{riskAssessmentId}/threatmodels")]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> GetThreatModelsForAssessment(int riskAssessmentId)
        {
            try
            {
                var threatModels = await _riskAssessmentThreatModelService.GetThreatModelsForAssessmentAsync(riskAssessmentId);
                
                var responseData = threatModels.Select(tm => new
                {
                    id = tm.Id,
                    title = tm.Title,
                    description = tm.Description,
                    status = tm.Status.ToString(),
                    aleMinimum = tm.ALEMinimum,
                    aleMostLikely = tm.ALEMostLikely,
                    aleMaximum = tm.ALEMaximum,
                    templateId = tm.TemplateAttackChainId,
                    templateName = tm.TemplateAttackChain?.Name,
                    createdAt = tm.CreatedAt,
                    modifiedAt = tm.ModifiedAt
                }).ToList();

                return Json(responseData);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // API: Delete a threat model from risk assessment
        [HttpDelete]
        [Route("api/threatmodels/{threatModelId}")]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> DeleteThreatModel(int threatModelId)
        {
            try
            {
                var userId = User.Identity?.Name ?? "System";
                var success = await _riskAssessmentThreatModelService.DeleteThreatModelAsync(threatModelId, userId);
                
                if (success)
                {
                    return Json(new { success = true });
                }
                else
                {
                    return NotFound(new { error = "Threat model not found or could not be deleted" });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // API: Get total ALE for all threat models in assessment
        [HttpGet]
        [Route("api/riskassessments/{riskAssessmentId}/threatmodels/ale")]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> GetTotalALEForAssessment(int riskAssessmentId)
        {
            try
            {
                var totalALE = await _riskAssessmentThreatModelService.CalculateTotalALEForAssessmentAsync(riskAssessmentId);
                return Json(new { totalALE = totalALE });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // API: Get risk levels for dropdowns
        [HttpGet]
        [Route("api/riskassessments/risklevels")]
        [Authorize(Policy = PolicyConstants.RequireAnyRole)]
        public async Task<IActionResult> GetRiskLevels()
        {
            try
            {
                var settings = await _settingsService.GetActiveSettingsAsync();
                var riskLevels = new[]
                {
                    new { value = "Critical", label = "Critical", threshold = settings.QualitativeCriticalThreshold },
                    new { value = "High", label = "High", threshold = settings.QualitativeHighThreshold },
                    new { value = "Medium", label = "Medium", threshold = settings.QualitativeMediumThreshold },
                    new { value = "Low", label = "Low", threshold = 0m }
                };
                
                return Json(riskLevels);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // Helper method to build detailed risk description for backlog approval
        private string BuildRiskDescriptionForBacklog(Risk risk, RiskAssessment assessment)
        {
            var description = $"NEW RISK: {risk.Title}\n\n";
            description += $"Asset: {risk.Asset}\n";
            description += $"Business Unit: {risk.BusinessUnit}\n";
            description += $"Risk Level: {risk.RiskLevel}\n";
            description += $"Impact: {risk.Impact}\n";
            description += $"Likelihood: {risk.Likelihood}\n";
            description += $"Exposure: {risk.Exposure}\n";
            description += $"Treatment Strategy: {risk.Treatment}\n";
            description += $"CIA Triad: {risk.CIATriad}\n\n";
            
            if (!string.IsNullOrEmpty(risk.Description))
            {
                description += $"Description: {risk.Description}\n\n";
            }
            
            if (!string.IsNullOrEmpty(risk.ThreatScenario))
            {
                description += $"Threat Scenario: {risk.ThreatScenario}\n\n";
            }
            
            description += $"Source Assessment: {assessment.Title}\n";
            description += $"Assessment Type: {assessment.AssessmentType}\n";
            description += $"Assessor: {assessment.Assessor}\n";
            description += $"Assessment Date: {assessment.CreatedAt:yyyy-MM-dd}\n";
            
            return description;
        }
    }
}