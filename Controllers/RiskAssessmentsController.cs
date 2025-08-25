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
using Microsoft.Extensions.Logging;

namespace CyberRiskApp.Controllers
{
    // REMOVED: [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)] - controller level authorization
    public class RiskAssessmentsController : BaseController
    {
        private readonly IRiskAssessmentService _assessmentService;
        private readonly IRiskService _riskService;
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
            IFindingService findingService, // ADDED: Findings service
            IPdfExportService pdfExportService,
            IRiskMatrixService riskMatrixService, // ADDED: Risk matrix service
            CyberRiskContext context, // ADDED: Context for control management
            IThreatModelingService threatModelingService, // ADDED: Threat modeling service
            IRiskAssessmentThreatModelService riskAssessmentThreatModelService, // ADDED: Risk assessment threat model service
            IRiskBacklogService backlogService, // ADDED: Risk backlog service
            ILogger<RiskAssessmentsController> logger) : base(logger)
        {
            _assessmentService = assessmentService;
            _riskService = riskService;
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
            return await ExecuteWithErrorHandling(
                async () =>
                {
                    var assessments = await _assessmentService.GetAllAssessmentsAsync();
                    ViewBag.CanPerformAssessments = User.CanUserPerformAssessments(); // Show/hide create buttons
                    return assessments;
                },
                assessments => View(assessments),
                "loading risk assessments"
            );
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
            var riskMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            ViewBag.RiskMatrix = riskMatrix;

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

            var model = new RiskAssessmentViewModel
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
                },
                OpenRisks = new List<Risk>(),
                AvailableFindings = new List<Microsoft.AspNetCore.Mvc.Rendering.SelectListItem>(),
                
                // ===== Enhanced Complex Assessment Support =====
                
                // Risk Matrix Support
                AvailableMatrices = activeMatrices,
                SelectedMatrix = selectedMatrix,
                
                // User Permissions for Smart Comboboxes
                CanAddNewAssets = User.IsInRole("Admin") || User.IsInRole("GRCAnalyst") || User.IsInRole("GRCManager"),
                CanAddNewBusinessUnits = User.IsInRole("Admin") || User.IsInRole("GRCAnalyst") || User.IsInRole("GRCManager"),
                CanAddNewBusinessOwners = User.IsInRole("Admin") || User.IsInRole("GRCAnalyst") || User.IsInRole("GRCManager"),
                CanAddTechnicalControls = User.IsInRole("Admin") || User.IsInRole("GRCAnalyst") || User.IsInRole("GRCManager"),
                
                // Initialize empty threat scenarios collection
                ThreatScenarios = new List<ComprehensiveThreatScenario>()
            };

            // Load available threat models for integration
            try
            {
                var approvedThreatModels = await _context.ThreatModels
                    .Where(tm => tm.Status == ThreatModelStatus.Approved || tm.Status == ThreatModelStatus.InReview)
                    .Include(tm => tm.AttackScenarios)
                    .OrderBy(tm => tm.Name)
                    .ToListAsync();
                // model.AvailableThreatModels = approvedThreatModels; // Not needed for comprehensive threat scenarios
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Could not load threat models: {ex.Message}");
                // model.AvailableThreatModels = new List<ThreatModel>(); // Not needed for comprehensive threat scenarios
            }

            // Load MITRE ATT&CK techniques for dropdown
            try
            {
                var mitreTechniques = await _context.MitreTechniques
                    .OrderBy(mt => mt.TechniqueId)
                    .Select(mt => new Microsoft.AspNetCore.Mvc.Rendering.SelectListItem
                    {
                        Value = mt.Id.ToString(),
                        Text = $"{mt.TechniqueId} - {mt.Name}"
                    })
                    .ToListAsync();
                model.AvailableMitreTechniques = mitreTechniques;
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Could not load MITRE techniques: {ex.Message}");
                model.AvailableMitreTechniques = new List<Microsoft.AspNetCore.Mvc.Rendering.SelectListItem>();
            }

            // Load Kill Chain phases - not needed for comprehensive threat scenarios
            // model.KillChainPhases = new List<Microsoft.AspNetCore.Mvc.Rendering.SelectListItem>
            // {
            //     new() { Value = "Reconnaissance", Text = "1. Reconnaissance" },
            //     new() { Value = "Weaponization", Text = "2. Weaponization" },
            //     new() { Value = "Delivery", Text = "3. Delivery" },
            //     new() { Value = "Exploitation", Text = "4. Exploitation" },
            //     new() { Value = "Installation", Text = "5. Installation" },
            //     new() { Value = "CommandAndControl", Text = "6. Command & Control" },
            //     new() { Value = "ActionsOnObjectives", Text = "7. Actions on Objectives" }
            // };

            // Load available technical controls
            try
            {
                var technicalControls = await _context.ReferenceDataEntries
                    .Where(rd => rd.Category == ReferenceDataCategory.TechnicalControl && rd.IsActive)
                    .OrderBy(rd => rd.Value)
                    .Select(rd => new Microsoft.AspNetCore.Mvc.Rendering.SelectListItem
                    {
                        Value = rd.Value,
                        Text = rd.Value
                    })
                    .ToListAsync();
                // model.AvailableTechnicalControls = technicalControls; // Not needed for comprehensive threat scenarios
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Could not load technical controls: {ex.Message}");
                // model.AvailableTechnicalControls = new List<Microsoft.AspNetCore.Mvc.Rendering.SelectListItem>(); // Not needed for comprehensive threat scenarios
            }

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
        [RemoveAuditFields]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        [CleanupEmptyRisks]
        public async Task<IActionResult> CreateQualitative(RiskAssessmentViewModel model)
        {
            // Ensure assessment type is set to Qualitative
            model.Assessment.AssessmentType = AssessmentType.Qualitative;

            // Audit fields are now automatically removed by RemoveAuditFields filter
            
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
                
                // Remove validation errors for empty threat scenarios
                var threatScenarioErrors = ModelState.Keys.Where(k => 
                    k.Contains("ThreatScenarios") && 
                    (k.Contains("MitreTechnique") || k.Contains("Description") || k.Contains("Name"))).ToList();
                        
                foreach (var key in threatScenarioErrors)
                {
                    Console.WriteLine($"Removing threat scenario validation error: {key}");
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
                    
                        // Set assessment metadata - preserve user-selected status
                        model.Assessment.Assessor = User.GetUserId();
                        // model.Assessment.Status is preserved from user input (don't override)
                        model.Assessment.CreatedAt = DateTime.UtcNow;
                        model.Assessment.UpdatedAt = DateTime.UtcNow;
                        model.Assessment.CreatedBy = User.GetUserId();
                        model.Assessment.UpdatedBy = User.GetUserId();
                        
                        Console.WriteLine($"🔍 DEBUGGING: Assessment status set to: {model.Assessment.Status}");

                        createdAssessment = await _assessmentService.CreateAssessmentAsync(model.Assessment);
                    Console.WriteLine($"✅ DEBUGGING: Created assessment {createdAssessment.Id} - '{createdAssessment.Title}'");
                    
                    // Qualitative controls functionality removed with FAIR
                    // Risk assessment now focuses on standard risk scoring via RiskMatrix

                    // FAIR IdentifiedRisks functionality removed
                    // Standard risk assessments now use OpenRisks property
                    if (false) // Disabled FAIR logic
                    {
                        // foreach (var risk in model.IdentifiedRisks.Where(r => !string.IsNullOrEmpty(r.Title))) // FAIR logic disabled
                        // {
                        //     risk.RiskAssessmentId = createdAssessment.Id;
                        //     risk.Asset = model.Assessment.Asset;
                        //     risk.BusinessUnit = model.Assessment.BusinessUnit ?? "Unknown";
                        //     risk.ThreatScenario = model.Assessment.ThreatScenario;
                        //     risk.CIATriad = model.Assessment.CIATriad ?? CIATriad.All;
                        //     risk.Status = RiskStatus.Open;
                        //     risk.OpenDate = DateTime.Today;
                        //     risk.NextReviewDate = DateTime.Today.AddMonths(3);
                        //     risk.CreatedAt = DateTime.UtcNow;
                        //     risk.UpdatedAt = DateTime.UtcNow;
                        //     
                        //     // Set default enum values if not provided (to avoid value '0' errors)
                        //     if (risk.Impact == 0) risk.Impact = ImpactLevel.Medium;
                        //     if (risk.Likelihood == 0) risk.Likelihood = LikelihoodLevel.Possible;
                        //     if (risk.Exposure == 0) risk.Exposure = ExposureLevel.ModeratelyExposed;
                        //     if (risk.InherentRiskLevel == 0) risk.InherentRiskLevel = RiskLevel.Medium;
                        //     if (risk.ResidualRiskLevel == 0) risk.ResidualRiskLevel = RiskLevel.Medium;
                        //     if (risk.RiskLevel == 0) risk.RiskLevel = RiskLevel.Medium;
                        //     
                        //     // Set default treatment if not provided
                        //     if (risk.Treatment == 0)
                        //     {
                        //         risk.Treatment = TreatmentStrategy.Mitigate;
                        //     }
                        //     
                        //     // Create backlog entry for risk approval (don't create the risk yet)
                        //     try
                        //     {
                        //         var riskDescription = BuildRiskDescriptionForBacklog(risk, model.Assessment);
                        //         var backlogEntry = await _backlogService.CreateBacklogEntryAsync(
                        //             riskId: null, // No risk created yet - will be created upon approval
                        //             actionType: RiskBacklogAction.NewRisk,
                        //             description: riskDescription,
                        //             justification: $"New risk identified from assessment '{model.Assessment.Title}' for asset '{model.Assessment.Asset}'. Risk level: {risk.RiskLevel}",
                        //             requesterId: User.GetUserId()
                        //         );
                        //         Console.WriteLine($"✅ DEBUGGING: Created backlog entry {backlogEntry.BacklogNumber} for risk '{risk.Title}' pending approval");
                        //     }
                        //     catch (Exception backlogEx)
                        //     {
                        //         // Log error but don't fail the assessment creation
                        //         Console.WriteLine($"❌ DEBUGGING: Failed to create backlog entry for risk '{risk.Title}': {backlogEx.Message}");
                        //     }
                        // }
                    }

                    // FAIR ThreatScenarios functionality removed  
                    // Standard risk assessments use simplified risk scoring
                    if (false) // Disabled FAIR logic
                    {
                        // // First collect all the risks from scenarios before clearing navigation properties
                        // var allScenarioRisks = new List<(ThreatScenario scenario, List<Risk> risks)>();
                        // 
                        // foreach (var scenario in model.ThreatScenarios.Where(s => !string.IsNullOrEmpty(s.Description)))
                        // {
                        //     scenario.RiskAssessmentId = createdAssessment.Id;
                        //     scenario.CreatedAt = DateTime.UtcNow;
                        //     scenario.UpdatedAt = DateTime.UtcNow;
                        //     scenario.CreatedBy = User.GetUserId();
                        //     scenario.UpdatedBy = User.GetUserId();
                        //     
                        //     // RowVersion will be initialized by the model's default value
                        //     
                        //     // Calculate risk score for the scenario
                        //     scenario.CalculateRiskScore();
                        //     
                        //     // Collect the risks before clearing navigation property
                        //     var scenarioRisks = scenario.IdentifiedRisks?.Where(r => !string.IsNullOrEmpty(r.Title)).ToList() ?? new List<Risk>();
                        //     // allScenarioRisks.Add((scenario, scenarioRisks)); // FAIR logic disabled
                        //     
                        //     // Clear the navigation property to avoid EF confusion
                        //     scenario.IdentifiedRisks.Clear();
                        //     
                        //     _context.ThreatScenarios.Add(scenario);
                        // }
                        // await _context.SaveChangesAsync();
                        
                        // // Save all collected risks from scenarios using proper service calls
                        // foreach (var (scenario, risks) in allScenarioRisks)
                        // {
                        //     foreach (var risk in risks)
                        //     {
                        //         risk.RiskAssessmentId = createdAssessment.Id;
                        //         risk.ThreatScenarioId = scenario.Id; // Link to the specific threat scenario
                        //         risk.Asset = model.Assessment.Asset;
                        //         risk.BusinessUnit = model.Assessment.BusinessUnit ?? "Unknown";
                        //         risk.ThreatScenario = scenario.Description; // Use scenario description as threat scenario
                        //         risk.CIATriad = model.Assessment.CIATriad ?? CIATriad.All;
                        //         risk.Status = RiskStatus.Open;
                        //         risk.OpenDate = DateTime.Today;
                        //         risk.NextReviewDate = DateTime.Today.AddMonths(3);
                        //         risk.CreatedAt = DateTime.UtcNow;
                        //         risk.UpdatedAt = DateTime.UtcNow;
                        //         
                        //         // Set default enum values if not provided
                        //         if (risk.Impact == 0) risk.Impact = ImpactLevel.Medium;
                        //         if (risk.Likelihood == 0) risk.Likelihood = LikelihoodLevel.Possible;
                        //         if (risk.Exposure == 0) risk.Exposure = ExposureLevel.ModeratelyExposed;
                        //         if (risk.InherentRiskLevel == 0) risk.InherentRiskLevel = RiskLevel.Medium;
                        //         if (risk.ResidualRiskLevel == 0) risk.ResidualRiskLevel = RiskLevel.Medium;
                        //         if (risk.RiskLevel == 0) risk.RiskLevel = RiskLevel.Medium;
                        //         
                        //         // Set default treatment if not provided
                        //         if (risk.Treatment == 0)
                        //         {
                        //             risk.Treatment = TreatmentStrategy.Mitigate;
                        //         }
                        //         
                        //         // Create backlog entry for risk approval (don't create the risk yet)
                        //         try
                        //         {
                        //             var riskDescription = BuildRiskDescriptionForBacklog(risk, model.Assessment);
                        //             riskDescription += $"\nThreat Scenario: {scenario.Description}\n";
                        //             if (scenario.QualitativeLikelihood.HasValue)
                        //             {
                        //                 riskDescription += $"Scenario Likelihood: {scenario.QualitativeLikelihood.Value}\n";
                        //             }
                        //             if (scenario.QualitativeImpact.HasValue)
                        //             {
                        //                 riskDescription += $"Scenario Impact: {scenario.QualitativeImpact.Value}\n";
                        //             }
                        //             if (scenario.QualitativeRiskScore.HasValue)
                        //             {
                        //                 riskDescription += $"Scenario Risk Score: {scenario.QualitativeRiskScore.Value}\n";
                        //             }
                        //             
                        //             var requesterId = User.GetUserId();
                        //             var justification = $"New risk identified from threat scenario in assessment '{model.Assessment.Title}' for asset '{model.Assessment.Asset}'. Risk level: {risk.RiskLevel}";
                        //             
                        //             Console.WriteLine($"🔍 CONTROLLER DEBUG: About to create backlog entry");
                        //             Console.WriteLine($"🔍 CONTROLLER DEBUG: riskId=null, actionType=NewRisk, requesterId='{requesterId}'");
                        //             Console.WriteLine($"🔍 CONTROLLER DEBUG: description length={riskDescription?.Length}, justification length={justification?.Length}");
                        //             
                        //             var backlogEntry = await _backlogService.CreateBacklogEntryAsync(
                        //                 riskId: null, // No risk created yet - will be created upon approval
                        //                 actionType: RiskBacklogAction.NewRisk,
                        //                 description: riskDescription,
                        //                 justification: justification,
                        //                 requesterId: requesterId
                        //             );
                        //             Console.WriteLine($"✅ DEBUGGING: Created backlog entry {backlogEntry.BacklogNumber} for threat scenario risk '{risk.Title}' pending approval");
                        //         }
                        //         catch (Exception backlogEx)
                        //         {
                        //             // Log error but don't fail the assessment creation
                        //             Console.WriteLine($"❌ DEBUGGING: Failed to create backlog entry for threat scenario risk '{risk.Title}': {backlogEx.Message}");
                        //         }
                        //     }
                        // }
                    }

                    // ===== COMPREHENSIVE THREAT SCENARIO PROCESSING =====
                    await ProcessComprehensiveThreatScenarios(model.ThreatScenarios, createdAssessment.Id);

                    // FAIR threat model linking removed
                    if (false) // Disabled FAIR logic
                    {
                        // // foreach (var threatModelId in model.SelectedThreatModelIds) // FAIR logic disabled
                        // {
                        //     var threatModel = await _threatModelingService.GetThreatModelByIdAsync(threatModelId);
                        //     if (threatModel != null)
                        //     {
                        //         threatModel.RiskAssessmentId = createdAssessment.Id;
                        //         await _threatModelingService.UpdateThreatModelAsync(threatModel);
                        //     }
                        // }
                    }

                    // ===== CREATE BACKLOG ENTRY FOR READY FOR REVIEW STATUS =====
                    Console.WriteLine($"🔍 DEBUGGING: Checking if assessment status is ReadyForReview. Status: {createdAssessment.Status} (enum value: {(int)createdAssessment.Status})");
                    Console.WriteLine($"🔍 DEBUGGING: AssessmentStatus.ReadyForReview enum value: {(int)AssessmentStatus.ReadyForReview}");
                    
                    if (createdAssessment.Status == AssessmentStatus.ReadyForReview)
                    {
                        Console.WriteLine("🔄 DEBUGGING: Status matches! Creating backlog entry for ReadyForReview assessment...");
                        
                        try 
                        {
                            var assessmentDescription = BuildAssessmentDescriptionForBacklog(createdAssessment);
                            var justification = $"Risk assessment '{createdAssessment.Title}' has been submitted for review and requires approval before risks are added to the register.";
                            
                            var backlogEntry = await _backlogService.CreateBacklogEntryAsync(
                                riskId: null, // No specific risk - this is for assessment approval
                                actionType: RiskBacklogAction.AssessmentApproval, // Use proper assessment approval action type
                                description: assessmentDescription,
                                justification: justification,
                                requesterId: User.GetUserId()
                            );
                            
                            Console.WriteLine($"✅ DEBUGGING: Created backlog entry {backlogEntry.BacklogNumber} for ReadyForReview assessment");
                        }
                        catch (Exception backlogEx)
                        {
                            Console.WriteLine($"❌ DEBUGGING: Failed to create backlog entry for ReadyForReview assessment: {backlogEx.Message}");
                            // Don't fail the entire transaction - just log the error
                        }
                    }
                    else
                    {
                        Console.WriteLine($"ℹ️ DEBUGGING: Assessment status is not ReadyForReview, no backlog entry created.");
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
                    var successMessage = createdAssessment.Status == AssessmentStatus.ReadyForReview 
                        ? "Risk assessment created and submitted for review! It has been added to the manager approval backlog."
                        : "Risk assessment created successfully! Set status to 'Ready for Review' and save to submit for approval.";
                    
                    TempData["Success"] = successMessage;
                    return RedirectToAction(nameof(Details), new { id = createdAssessment.Id });
                }
                else
                {
                    TempData["Error"] = $"Error creating qualitative assessment: {errorMessage}";
                    
                    // Need to reload the model data and return the view
                    var approvedTemplatesReloadError = await _riskAssessmentThreatModelService.GetApprovedTemplatesAsync();
                    // model.AvailableThreatModels = approvedTemplatesReloadError.ToList(); // FAIR logic disabled
                    
                    var allMatricesError = await _riskMatrixService.GetAllMatricesAsync();
                    ViewBag.AvailableMatrices = allMatricesError.Where(m => m.IsActive).ToList();
                    ViewBag.DefaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
                    
                    return View(model);
                }
            }

            // Reload risk level settings and threat models if validation fails
            // Risk level settings replaced with RiskMatrix - model may need adjustment
            var approvedTemplatesReloadQualitative = await _riskAssessmentThreatModelService.GetApprovedTemplatesAsync();
            // model.AvailableThreatModels = approvedTemplatesReloadQualitative.ToList(); // FAIR logic disabled
            
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
        public async Task<IActionResult> Create(RiskAssessmentViewModel model)
        {
            // Audit fields are now automatically removed by RemoveAuditFields filter
            
            if (ModelState.IsValid)
            {
                try
                {
                    // Set assessment metadata
                    model.Assessment.Assessor = User.GetUserId();
                    model.Assessment.CreatedAt = DateTime.UtcNow;
                    model.Assessment.UpdatedAt = DateTime.UtcNow;

                    var createdAssessment = await _assessmentService.CreateAssessmentAsync(model.Assessment);
                    

                    // Qualitative controls functionality removed with FAIR
                    // Risk assessment now focuses on standard risk scoring via RiskMatrix

                    /* FAIR IdentifiedRisks functionality removed (Create method)
                    if (model.IdentifiedRisks != null && model.IdentifiedRisks.Any())
                    {
                        // foreach (var risk in model.IdentifiedRisks.Where(r => !string.IsNullOrEmpty(r.Title))) // FAIR logic disabled
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
                                    requesterId: User.GetUserId()
                                );
                            }
                            catch (Exception backlogEx)
                            {
                                // Log error but don't fail the assessment creation
                                Console.WriteLine($"Warning: Failed to create backlog entry for risk '{risk.Title}': {backlogEx.Message}");
                            }
                        }
                    }
                    */ // End FAIR IdentifiedRisks block (Create method)

                    TempData["Success"] = "Risk assessment created successfully!";
                    return RedirectToAction(nameof(Details), new { id = createdAssessment.Id });
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error creating assessment: {ex.Message}";
                }
            }

            // Reload risk level settings if validation fails
            // Risk level settings replaced with RiskMatrix - model may need adjustment
            return View(model);
        }

        // Edit GET action method
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Edit(int id)
        {
            var assessment = await _assessmentService.GetAssessmentByIdAsync(id);
            if (assessment == null)
                return NotFound();

            // Load all required data for the full edit form (same as CreateQualitative)
            var model = new RiskAssessmentViewModel
            {
                Assessment = assessment,
                AvailableMatrices = await _context.RiskMatrices.ToListAsync(),
                SelectedMatrix = assessment.RiskMatrixId.HasValue ? 
                    await _context.RiskMatrices.FindAsync(assessment.RiskMatrixId.Value) : null,
                
                // Convert existing threat scenarios to ViewModels for editing
                ThreatScenarios = assessment.ThreatScenarios?.Select(ts => new ComprehensiveThreatScenario
                {
                    Id = ts.Id,
                    ScenarioId = ts.ScenarioId ?? "",
                    ScenarioName = ts.ScenarioName ?? "",
                    Description = ts.Description ?? "",
                    CIAImpactType = ts.CIAImpactType,
                    // Convert related entities to ViewModels as needed
                    ThreatVector = new ThreatVectorViewModel
                    {
                        Id = ts.ThreatVector?.Id ?? 0,
                        Name = ts.ThreatVector?.Name ?? "",
                        Description = ts.ThreatVector?.Description ?? "",
                        
                        // Convert controls with null checks
                        CurrentProtectiveControls = ts.ThreatVector?.Controls?
                            .Where(c => c.ThreatControl != null && c.ThreatControl.ControlType == ControlType.Protective && c.ThreatControl.ControlCategory == ControlCategory.Current)
                            .Select(c => new ControlSelectionViewModel
                            {
                                Id = c.ThreatControl.Id,
                                ControlName = c.ThreatControl.ControlName,
                                ControlDescription = c.ThreatControl.ControlDescription,
                                ImplementationStatus = c.ImplementationStatus,
                                IsSelected = true
                            }).ToList() ?? new List<ControlSelectionViewModel>(),
                            
                        CurrentDetectiveControls = ts.ThreatVector?.Controls?
                            .Where(c => c.ThreatControl != null && c.ThreatControl.ControlType == ControlType.Detective && c.ThreatControl.ControlCategory == ControlCategory.Current)
                            .Select(c => new ControlSelectionViewModel
                            {
                                Id = c.ThreatControl.Id,
                                ControlName = c.ThreatControl.ControlName,
                                ControlDescription = c.ThreatControl.ControlDescription,
                                ImplementationStatus = c.ImplementationStatus,
                                IsSelected = true
                            }).ToList() ?? new List<ControlSelectionViewModel>(),
                            
                        NeededProtectiveControls = ts.ThreatVector?.Controls?
                            .Where(c => c.ThreatControl != null && c.ThreatControl.ControlType == ControlType.Protective && c.ThreatControl.ControlCategory == ControlCategory.Needed)
                            .Select(c => new ControlSelectionViewModel
                            {
                                Id = c.ThreatControl.Id,
                                ControlName = c.ThreatControl.ControlName,
                                ControlDescription = c.ThreatControl.ControlDescription,
                                ImplementationStatus = c.ImplementationStatus,
                                IsSelected = true
                            }).ToList() ?? new List<ControlSelectionViewModel>(),
                            
                        NeededDetectiveControls = ts.ThreatVector?.Controls?
                            .Where(c => c.ThreatControl != null && c.ThreatControl.ControlType == ControlType.Detective && c.ThreatControl.ControlCategory == ControlCategory.Needed)
                            .Select(c => new ControlSelectionViewModel
                            {
                                Id = c.ThreatControl.Id,
                                ControlName = c.ThreatControl.ControlName,
                                ControlDescription = c.ThreatControl.ControlDescription,
                                ImplementationStatus = c.ImplementationStatus,
                                IsSelected = true
                            }).ToList() ?? new List<ControlSelectionViewModel>()
                    },
                    ThreatActorSteps = ts.ThreatActorSteps?.Select(step => new ThreatActorStepViewModel
                    {
                        Id = step.Id,
                        Name = step.Name ?? "",
                        Description = step.Description ?? "",
                        MitreTechnique = step.MitreTechnique ?? "",
                        StepOrder = step.StepOrder,
                        
                        // Convert controls with null checks
                        CurrentProtectiveControls = step.Controls?
                            .Where(c => c.ThreatControl != null && c.ThreatControl.ControlType == ControlType.Protective && c.ThreatControl.ControlCategory == ControlCategory.Current)
                            .Select(c => new ControlSelectionViewModel
                            {
                                Id = c.ThreatControl.Id,
                                ControlName = c.ThreatControl.ControlName,
                                ControlDescription = c.ThreatControl.ControlDescription,
                                ImplementationStatus = c.ImplementationStatus,
                                IsSelected = true
                            }).ToList() ?? new List<ControlSelectionViewModel>(),
                            
                        CurrentDetectiveControls = step.Controls?
                            .Where(c => c.ThreatControl != null && c.ThreatControl.ControlType == ControlType.Detective && c.ThreatControl.ControlCategory == ControlCategory.Current)
                            .Select(c => new ControlSelectionViewModel
                            {
                                Id = c.ThreatControl.Id,
                                ControlName = c.ThreatControl.ControlName,
                                ControlDescription = c.ThreatControl.ControlDescription,
                                ImplementationStatus = c.ImplementationStatus,
                                IsSelected = true
                            }).ToList() ?? new List<ControlSelectionViewModel>(),
                            
                        NeededProtectiveControls = step.Controls?
                            .Where(c => c.ThreatControl != null && c.ThreatControl.ControlType == ControlType.Protective && c.ThreatControl.ControlCategory == ControlCategory.Needed)
                            .Select(c => new ControlSelectionViewModel
                            {
                                Id = c.ThreatControl.Id,
                                ControlName = c.ThreatControl.ControlName,
                                ControlDescription = c.ThreatControl.ControlDescription,
                                ImplementationStatus = c.ImplementationStatus,
                                IsSelected = true
                            }).ToList() ?? new List<ControlSelectionViewModel>(),
                            
                        NeededDetectiveControls = step.Controls?
                            .Where(c => c.ThreatControl != null && c.ThreatControl.ControlType == ControlType.Detective && c.ThreatControl.ControlCategory == ControlCategory.Needed)
                            .Select(c => new ControlSelectionViewModel
                            {
                                Id = c.ThreatControl.Id,
                                ControlName = c.ThreatControl.ControlName,
                                ControlDescription = c.ThreatControl.ControlDescription,
                                ImplementationStatus = c.ImplementationStatus,
                                IsSelected = true
                            }).ToList() ?? new List<ControlSelectionViewModel>()
                    }).ToList() ?? new List<ThreatActorStepViewModel>(),
                    // Convert threat actor objective
                    ThreatActorObjective = ts.ThreatActorObjective != null ? new ThreatActorObjectiveViewModel
                    {
                        Id = ts.ThreatActorObjective.Id,
                        Name = ts.ThreatActorObjective.Name ?? "",
                        Description = ts.ThreatActorObjective.Description ?? "",
                        MitreTechnique = ts.ThreatActorObjective.MitreTechnique ?? "",
                        
                        // Convert controls with null checks
                        CurrentProtectiveControls = ts.ThreatActorObjective.Controls?
                            .Where(c => c.ThreatControl != null && c.ThreatControl.ControlType == ControlType.Protective && c.ThreatControl.ControlCategory == ControlCategory.Current)
                            .Select(c => new ControlSelectionViewModel
                            {
                                Id = c.ThreatControl.Id,
                                ControlName = c.ThreatControl.ControlName,
                                ControlDescription = c.ThreatControl.ControlDescription,
                                ImplementationStatus = c.ImplementationStatus,
                                IsSelected = true
                            }).ToList() ?? new List<ControlSelectionViewModel>(),
                            
                        CurrentDetectiveControls = ts.ThreatActorObjective.Controls?
                            .Where(c => c.ThreatControl != null && c.ThreatControl.ControlType == ControlType.Detective && c.ThreatControl.ControlCategory == ControlCategory.Current)
                            .Select(c => new ControlSelectionViewModel
                            {
                                Id = c.ThreatControl.Id,
                                ControlName = c.ThreatControl.ControlName,
                                ControlDescription = c.ThreatControl.ControlDescription,
                                ImplementationStatus = c.ImplementationStatus,
                                IsSelected = true
                            }).ToList() ?? new List<ControlSelectionViewModel>(),
                            
                        NeededProtectiveControls = ts.ThreatActorObjective.Controls?
                            .Where(c => c.ThreatControl != null && c.ThreatControl.ControlType == ControlType.Protective && c.ThreatControl.ControlCategory == ControlCategory.Needed)
                            .Select(c => new ControlSelectionViewModel
                            {
                                Id = c.ThreatControl.Id,
                                ControlName = c.ThreatControl.ControlName,
                                ControlDescription = c.ThreatControl.ControlDescription,
                                ImplementationStatus = c.ImplementationStatus,
                                IsSelected = true
                            }).ToList() ?? new List<ControlSelectionViewModel>(),
                            
                        NeededDetectiveControls = ts.ThreatActorObjective.Controls?
                            .Where(c => c.ThreatControl != null && c.ThreatControl.ControlType == ControlType.Detective && c.ThreatControl.ControlCategory == ControlCategory.Needed)
                            .Select(c => new ControlSelectionViewModel
                            {
                                Id = c.ThreatControl.Id,
                                ControlName = c.ThreatControl.ControlName,
                                ControlDescription = c.ThreatControl.ControlDescription,
                                ImplementationStatus = c.ImplementationStatus,
                                IsSelected = true
                            }).ToList() ?? new List<ControlSelectionViewModel>()
                    } : new ThreatActorObjectiveViewModel(),
                    // Convert associated risks with ALL properties
                    ScenarioRisks = ts.ScenarioRisks?.Select(risk => new ScenarioRiskViewModel
                    {
                        Id = risk.Id,
                        RiskName = risk.RiskName ?? "",
                        RiskDescription = risk.RiskDescription ?? "",
                        
                        // Current Risk Ratings
                        CurrentImpact = risk.CurrentImpact,
                        CurrentLikelihood = risk.CurrentLikelihood,
                        CurrentExposure = risk.CurrentExposure,
                        CurrentRiskScore = risk.CurrentRiskScore,
                        CurrentRiskLevel = risk.CurrentRiskLevel ?? "Unknown",
                        IsCurrentRiskAboveAppetite = risk.IsCurrentRiskAboveAppetite,
                        
                        // Residual Risk Ratings
                        ResidualImpact = risk.ResidualImpact,
                        ResidualLikelihood = risk.ResidualLikelihood,
                        ResidualExposure = risk.ResidualExposure,
                        ResidualRiskScore = risk.ResidualRiskScore,
                        ResidualRiskLevel = risk.ResidualRiskLevel ?? "Unknown",
                        IsResidualRiskAboveAppetite = risk.IsResidualRiskAboveAppetite,
                        
                        // Risk Treatment
                        RiskTreatmentPlan = risk.RiskTreatmentPlan ?? "",
                        ExpectedCompletionDate = risk.ExpectedCompletionDate,
                        TreatmentPlanStatus = risk.TreatmentPlanStatus,
                        
                        // Computed Properties
                        IsTreatmentOverdue = risk.IsTreatmentOverdue,
                        IsTreatmentPastSla = risk.IsTreatmentPastSla
                    }).ToList() ?? new List<ScenarioRiskViewModel>()
                }).ToList() ?? new List<ComprehensiveThreatScenario>(),
                
                // Load related risks
                OpenRisks = assessment.IdentifiedRisks?.Where(r => r.Status != RiskStatus.Closed).ToList() ?? new List<Risk>()
            };

            // Use the CreateQualitative view for editing (context-aware)
            return View("CreateQualitative", model);
        }

        // Edit POST action method
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Edit(int id, RiskAssessmentViewModel model)
        {
            if (id != model.Assessment.Id)
                return NotFound();

            // Clean up ONLY completely empty threat scenarios before validation
            if (model.ThreatScenarios != null)
            {
                model.ThreatScenarios = model.ThreatScenarios
                    .Where(ts => 
                        !string.IsNullOrWhiteSpace(ts.ScenarioName) || 
                        !string.IsNullOrWhiteSpace(ts.Description) ||
                        !string.IsNullOrWhiteSpace(ts.ScenarioId) ||
                        (ts.ThreatVector != null && !string.IsNullOrWhiteSpace(ts.ThreatVector.Name)) ||
                        (ts.ThreatActorSteps != null && ts.ThreatActorSteps.Any(s => !string.IsNullOrWhiteSpace(s.Name))) ||
                        (ts.ScenarioRisks != null && ts.ScenarioRisks.Any(r => !string.IsNullOrWhiteSpace(r.RiskName))))
                    .ToList();
                    
                // Clean up threat actor steps within scenarios
                foreach (var scenario in model.ThreatScenarios)
                {
                    // Only clean up completely empty items - preserve existing data
                    if (scenario.ThreatActorSteps != null)
                    {
                        scenario.ThreatActorSteps = scenario.ThreatActorSteps
                            .Where(step => 
                                !string.IsNullOrWhiteSpace(step.Name) || 
                                !string.IsNullOrWhiteSpace(step.Description) ||
                                !string.IsNullOrWhiteSpace(step.MitreTechnique))
                            .ToList();
                    }
                    
                    // Clean up scenario risks - keep if any field has data
                    if (scenario.ScenarioRisks != null)
                    {
                        scenario.ScenarioRisks = scenario.ScenarioRisks
                            .Where(risk => 
                                !string.IsNullOrWhiteSpace(risk.RiskName) || 
                                !string.IsNullOrWhiteSpace(risk.RiskDescription) ||
                                !string.IsNullOrWhiteSpace(risk.RiskTreatmentPlan))
                            .ToList();
                    }
                    
                    // Only remove threat vector if ALL key fields are empty
                    if (scenario.ThreatVector != null && 
                        string.IsNullOrWhiteSpace(scenario.ThreatVector.Name) && 
                        string.IsNullOrWhiteSpace(scenario.ThreatVector.Description) &&
                        string.IsNullOrWhiteSpace(scenario.ThreatVector.MitreTechnique))
                    {
                        scenario.ThreatVector = null;
                    }
                }
            }

            // Ensure audit fields are set before revalidation
            if (string.IsNullOrEmpty(model.Assessment.CreatedBy))
            {
                model.Assessment.CreatedBy = User.GetUserId();
            }
            if (string.IsNullOrEmpty(model.Assessment.UpdatedBy))
            {
                model.Assessment.UpdatedBy = User.GetUserId();
            }
            if (model.Assessment.CreatedAt == DateTime.MinValue)
            {
                model.Assessment.CreatedAt = DateTime.UtcNow;
            }
            if (model.Assessment.UpdatedAt == DateTime.MinValue)
            {
                model.Assessment.UpdatedAt = DateTime.UtcNow;
            }

            // Clear ModelState and validate only the core assessment fields, ignoring optional nested objects
            ModelState.Clear();
            
            // Manually validate only required Assessment fields
            if (string.IsNullOrWhiteSpace(model.Assessment.Title))
                ModelState.AddModelError("Assessment.Title", "The Title field is required.");
            if (string.IsNullOrWhiteSpace(model.Assessment.Asset))
                ModelState.AddModelError("Assessment.Asset", "The Asset field is required.");

            // Validate only populated threat scenarios (ignore empty ones)
            if (model.ThreatScenarios != null)
            {
                for (int i = 0; i < model.ThreatScenarios.Count; i++)
                {
                    var scenario = model.ThreatScenarios[i];
                    var hasScenarioData = !string.IsNullOrWhiteSpace(scenario.ScenarioName) || 
                                         !string.IsNullOrWhiteSpace(scenario.Description) ||
                                         scenario.ThreatActorSteps?.Any(s => !string.IsNullOrWhiteSpace(s.Name)) == true;
                    
                    if (hasScenarioData)
                    {
                        // Only validate if scenario has some data
                        if (string.IsNullOrWhiteSpace(scenario.ScenarioName))
                            ModelState.AddModelError($"ThreatScenarios[{i}].ScenarioName", "Scenario name is required when scenario data is provided.");
                        if (string.IsNullOrWhiteSpace(scenario.Description))
                            ModelState.AddModelError($"ThreatScenarios[{i}].Description", "Description is required when scenario data is provided.");
                    }
                }
            }

            if (ModelState.IsValid)
            {
                try
                {
                    Console.WriteLine($"DEBUG: Starting update for assessment ID: {id}");
                    
                    // Check if model and Assessment are not null
                    if (model?.Assessment == null)
                    {
                        Console.WriteLine("ERROR: model.Assessment is null");
                        return BadRequest("Assessment data is null");
                    }

                    Console.WriteLine($"DEBUG: model.Assessment.Id = {model.Assessment.Id}");
                    
                    // Preserve original metadata
                    var originalAssessment = await _assessmentService.GetAssessmentByIdAsync(id);
                    if (originalAssessment == null)
                    {
                        Console.WriteLine($"ERROR: Original assessment not found for ID: {id}");
                        return NotFound();
                    }

                    Console.WriteLine($"DEBUG: Original assessment found: {originalAssessment.Title}");

                    // Check User context
                    var userId = User.GetUserId();
                    if (string.IsNullOrEmpty(userId))
                    {
                        Console.WriteLine("ERROR: User.GetUserId() returned null or empty");
                        return BadRequest("User ID not available");
                    }

                    Console.WriteLine($"DEBUG: User ID: {userId}");

                    // Update fields but preserve metadata
                    model.Assessment.CreatedAt = originalAssessment.CreatedAt;
                    model.Assessment.CreatedBy = originalAssessment.CreatedBy; // Preserve original creator
                    model.Assessment.UpdatedAt = DateTime.UtcNow;
                    model.Assessment.UpdatedBy = userId; // Set current user as updater
                    model.Assessment.Assessor = originalAssessment.Assessor; // Preserve original assessor

                    Console.WriteLine($"DEBUG: About to call UpdateAssessmentAsync for ID: {model.Assessment.Id}");
                    await _assessmentService.UpdateAssessmentAsync(model.Assessment);


                    /* FAIR QualitativeControls functionality removed - block commented out
                    if (model.QualitativeControls != null)
                    {
                        // FAIR qualitative controls removed
                        // var existingQualControls = _context.QualitativeControls.Where(c => c.RiskAssessmentId == id);
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
                    */ // End FAIR qualitative controls block

                    /* FAIR IdentifiedRisks functionality removed - block commented out
                    if (model.IdentifiedRisks != null && model.IdentifiedRisks.Any())
                    {
                        // FAIR identified risks removed  
                        // var existingRisks = _context.Risks.Where(r => r.RiskAssessmentId == id);
                        _context.Risks.RemoveRange(existingRisks);

                        // Add updated identified risks
                        // foreach (var risk in model.IdentifiedRisks.Where(r => !string.IsNullOrEmpty(r.Title))) // FAIR logic disabled
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
                                    requesterId: User.GetUserId()
                                );
                            }
                            catch (Exception backlogEx)
                            {
                                // Log error but don't fail the assessment creation
                                Console.WriteLine($"Warning: Failed to create backlog entry for risk '{risk.Title}': {backlogEx.Message}");
                            }
                        }
                    }
                    */ // End FAIR IdentifiedRisks block

                    // FAIR ThreatScenarios functionality removed (Edit method)  
                    if (false) // FAIR logic disabled
                    {
                        // FAIR threat scenarios removed
                        // var existingScenarios = _context.ThreatScenarios.Where(s => s.RiskAssessmentId == id);
                        // _context.ThreatScenarios.RemoveRange(existingScenarios);

                        // Collect all risks before clearing navigation properties
                        var allScenarioRisks = new List<(ThreatScenario scenario, List<Risk> risks)>();
                        
                        // Add updated threat scenarios
                        // foreach (var scenario in model.ThreatScenarios.Where(s => !string.IsNullOrEmpty(s.Description)))
                        // {
                        //     scenario.RiskAssessmentId = id;
                        //     scenario.CreatedAt = scenario.CreatedAt == DateTime.MinValue ? DateTime.UtcNow : scenario.CreatedAt;
                        //     scenario.UpdatedAt = DateTime.UtcNow;
                        //     scenario.CreatedBy = scenario.CreatedBy ?? User.GetUserId();
                        //     scenario.UpdatedBy = User.GetUserId();
                        //     
                        //     // RowVersion will be initialized by the model's default value
                        //     
                        //     // Calculate risk score for the scenario
                        //     scenario.CalculateRiskScore();
                        //     
                        //     // Collect the risks before clearing navigation property
                        //     var scenarioRisks = scenario.IdentifiedRisks?.Where(r => !string.IsNullOrEmpty(r.Title)).ToList() ?? new List<Risk>();
                        //     // allScenarioRisks.Add((scenario, scenarioRisks)); // FAIR logic disabled
                        //     
                        //     // Clear the navigation property to avoid EF confusion
                        //     scenario.IdentifiedRisks.Clear();
                        //     
                        //     _context.ThreatScenarios.Add(scenario);
                        // }
                        // await _context.SaveChangesAsync();
                        // 
                        // // Now save all collected risks from scenarios
                        // foreach (var (scenario, risks) in allScenarioRisks)
                        // {
                        //     foreach (var risk in risks)
                        //     {
                        //         risk.RiskAssessmentId = id;
                        //         risk.Asset = model.Assessment.Asset;
                        //         risk.BusinessUnit = model.Assessment.BusinessUnit ?? "Unknown";
                        //         risk.ThreatScenario = scenario.Description; // Use scenario description as threat scenario
                        //         risk.CIATriad = model.Assessment.CIATriad ?? CIATriad.All;
                        //         risk.Status = risk.Status == 0 ? RiskStatus.Open : risk.Status;
                        //         risk.OpenDate = risk.OpenDate == DateTime.MinValue ? DateTime.Today : risk.OpenDate;
                        //         risk.NextReviewDate = risk.NextReviewDate ?? DateTime.Today.AddMonths(3);
                        //         risk.CreatedAt = risk.CreatedAt == DateTime.MinValue ? DateTime.UtcNow : risk.CreatedAt;
                        //         risk.UpdatedAt = DateTime.UtcNow;
                        //         
                        //         // Set default enum values if not provided
                        //         if (risk.Impact == 0) risk.Impact = ImpactLevel.Medium;
                        //         if (risk.Likelihood == 0) risk.Likelihood = LikelihoodLevel.Possible;
                        //         if (risk.Exposure == 0) risk.Exposure = ExposureLevel.ModeratelyExposed;
                        //         if (risk.InherentRiskLevel == 0) risk.InherentRiskLevel = RiskLevel.Medium;
                        //         if (risk.ResidualRiskLevel == 0) risk.ResidualRiskLevel = RiskLevel.Medium;
                        //         if (risk.RiskLevel == 0) risk.RiskLevel = RiskLevel.Medium;
                        //         
                        //         // Set default treatment if not provided
                        //         if (risk.Treatment == 0)
                        //         {
                        //             risk.Treatment = TreatmentStrategy.Mitigate;
                        //         }
                        //         
                        //         // Create backlog entry for risk approval (don't create the risk yet)
                        //     try
                        //     {
                        //         var riskDescription = BuildRiskDescriptionForBacklog(risk, model.Assessment);
                        //         await _backlogService.CreateBacklogEntryAsync(
                        //             riskId: null, // No risk created yet - will be created upon approval
                        //             actionType: RiskBacklogAction.NewRisk,
                        //             description: riskDescription,
                        //             justification: $"New risk identified from assessment '{model.Assessment.Title}' for asset '{model.Assessment.Asset}'. Risk level: {risk.RiskLevel}",
                        //             requesterId: User.GetUserId()
                        //         );
                        //     }
                        //     catch (Exception backlogEx)
                        //     {
                        //         // Log error but don't fail the assessment creation
                        //         Console.WriteLine($"Warning: Failed to create backlog entry for risk '{risk.Title}': {backlogEx.Message}");
                        //     }
                        //     }
                        // }
                    }

                    // ===== COMPREHENSIVE THREAT SCENARIO PROCESSING =====
                    Console.WriteLine($"DEBUG: About to process threat scenarios. Count: {model.ThreatScenarios?.Count ?? -1}");
                    if (model.ThreatScenarios != null)
                    {
                        for (int i = 0; i < model.ThreatScenarios.Count; i++)
                        {
                            var scenario = model.ThreatScenarios[i];
                            Console.WriteLine($"DEBUG: Scenario {i}: Name='{scenario?.ScenarioName}', Desc='{scenario?.Description?.Substring(0, Math.Min(50, scenario.Description?.Length ?? 0))}...'");
                        }
                    }
                    try
                    {
                        await ProcessComprehensiveThreatScenarios(model.ThreatScenarios, id);
                        Console.WriteLine("DEBUG: ProcessComprehensiveThreatScenarios completed successfully");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"ERROR in ProcessComprehensiveThreatScenarios: {ex.Message}");
                        Console.WriteLine($"ERROR StackTrace: {ex.StackTrace}");
                        throw; // Re-throw to maintain original behavior
                    }

                    // ===== CREATE BACKLOG ENTRY IF STATUS CHANGED TO READY FOR REVIEW =====
                    var statusChanged = originalAssessment.Status != model.Assessment.Status;
                    var nowReadyForReview = model.Assessment.Status == AssessmentStatus.ReadyForReview;
                    var wasNotReadyForReview = originalAssessment.Status != AssessmentStatus.ReadyForReview;

                    if (statusChanged && nowReadyForReview && wasNotReadyForReview)
                    {
                        Console.WriteLine("🔄 DEBUGGING: Creating backlog entry for status change to ReadyForReview...");
                        
                        try 
                        {
                            var assessmentDescription = BuildAssessmentDescriptionForBacklog(model.Assessment);
                            var justification = $"Risk assessment '{model.Assessment.Title}' has been updated and submitted for review. Requires approval before risks are added to the register.";
                            
                            var backlogEntry = await _backlogService.CreateBacklogEntryAsync(
                                riskId: null, // No specific risk - this is for assessment approval
                                actionType: RiskBacklogAction.AssessmentApproval, // Use proper assessment approval action type
                                description: assessmentDescription,
                                justification: justification,
                                requesterId: User.GetUserId()
                            );
                            
                            Console.WriteLine($"✅ DEBUGGING: Created backlog entry {backlogEntry.BacklogNumber} for ReadyForReview status change");
                            TempData["Success"] = $"Risk assessment updated and submitted for review! Backlog entry {backlogEntry.BacklogNumber} created.";
                        }
                        catch (Exception backlogEx)
                        {
                            Console.WriteLine($"❌ DEBUGGING: Failed to create backlog entry for ReadyForReview status change: {backlogEx.Message}");
                            TempData["Success"] = "Risk assessment updated successfully, but failed to create approval backlog entry. Please contact administrator.";
                        }
                    }
                    else
                    {
                        TempData["Success"] = "Risk assessment updated successfully!";
                    }

                    return RedirectToAction(nameof(Details), new { id = model.Assessment.Id });
                }
                catch (Exception ex)
                {
                    var innerMessage = ex.InnerException?.Message ?? "No inner exception";
                    var fullMessage = $"Error updating assessment: {ex.Message}. Inner: {innerMessage}";
                    Console.WriteLine($"🔧 Update Error: {fullMessage}");
                    Console.WriteLine($"🔧 Stack Trace: {ex.StackTrace}");
                    TempData["Error"] = fullMessage;
                }
            }

            // Reload all required data if validation fails (same as CreateQualitative)
            model.AvailableMatrices = await _context.RiskMatrices.ToListAsync();
            model.SelectedMatrix = model.Assessment.RiskMatrixId.HasValue ? 
                await _context.RiskMatrices.FindAsync(model.Assessment.RiskMatrixId.Value) : null;
            
            return View("CreateQualitative", model);
        }
        // FAIR ThreatScenarios block completed

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

                // STEP 4: Mark as completed and create backlog entry for approval
                Console.WriteLine("🔄 DEBUGGING: Marking assessment as completed...");
                assessment.Status = AssessmentStatus.Completed;
                assessment.DateCompleted = DateTime.Today;

                await _assessmentService.UpdateAssessmentAsync(assessment);
                Console.WriteLine("✅ DEBUGGING: Assessment status updated to Completed");

                // STEP 5: Create backlog entry for assessment completion approval
                Console.WriteLine("🔄 DEBUGGING: Creating backlog entry for assessment completion approval...");
                
                var assessmentDescription = BuildAssessmentDescriptionForBacklog(assessment);
                var justification = $"Risk assessment '{assessment.Title}' has been completed and requires approval before risks are added to the register.";
                
                try 
                {
                    var backlogEntry = await _backlogService.CreateBacklogEntryAsync(
                        riskId: null, // No specific risk - this is for assessment approval
                        actionType: RiskBacklogAction.AssessmentApproval, // Use proper assessment approval action type
                        description: assessmentDescription,
                        justification: justification,
                        requesterId: User.GetUserId()
                    );
                    
                    Console.WriteLine($"✅ DEBUGGING: Created backlog entry {backlogEntry.BacklogNumber} for assessment completion approval");
                    TempData["Success"] = $"Risk assessment completed and submitted for approval! Backlog entry {backlogEntry.BacklogNumber} created.";
                }
                catch (Exception backlogEx)
                {
                    Console.WriteLine($"❌ DEBUGGING: Failed to create backlog entry for assessment completion: {backlogEx.Message}");
                    TempData["Warning"] = "Assessment completed but failed to create approval backlog entry. Please contact administrator.";
                }

                return RedirectToAction(nameof(Details), new { id });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ DEBUGGING: Error in Complete method: {ex.Message}");
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

        // Approve Risk Assessment
        [HttpPost]
        [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
        public async Task<IActionResult> Approve(int id)
        {
            try
            {
                var assessment = await _assessmentService.GetAssessmentByIdAsync(id);
                if (assessment == null)
                {
                    return NotFound();
                }

                if (assessment.Status != AssessmentStatus.Completed)
                {
                    TempData["Error"] = "Only completed assessments can be approved.";
                    return RedirectToAction(nameof(Details), new { id });
                }

                // Update assessment status to Approved
                assessment.Status = AssessmentStatus.Approved;
                assessment.UpdatedAt = DateTime.UtcNow;
                assessment.UpdatedBy = User.Identity?.Name ?? "System";

                await _assessmentService.UpdateAssessmentAsync(assessment);

                // TODO: Update any related backlog entries to approved status
                // This would typically involve updating the RiskBacklog entries created during completion

                TempData["Success"] = "Risk assessment has been approved successfully. All identified risks are now part of the official risk register.";
                return RedirectToAction(nameof(Details), new { id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error approving risk assessment {AssessmentId}", id);
                TempData["Error"] = "An error occurred while approving the assessment. Please try again.";
                return RedirectToAction(nameof(Details), new { id });
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
                foreach (var scenario in assessment.ThreatScenarios.Where(ts => ts.CalculateOverallRiskScore() > 0))
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
                        
                        // Map scenario values to risk (using comprehensive scenario model)
                        Impact = ImpactLevel.Medium, // TODO: Calculate from comprehensive scenario risks
                        Likelihood = LikelihoodLevel.Likely, // TODO: Calculate from comprehensive scenario risks
                        Exposure = ExposureLevel.ModeratelyExposed, // TODO: Calculate from comprehensive scenario risks
                        InherentRiskLevel = MapRiskScore(scenario.CalculateOverallRiskScore() ?? 4.0m),
                        RiskLevel = MapRiskScore(scenario.CalculateOverallRiskScore() ?? 4.0m),
                        
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
                        justification: $"Risk assessment completed with {scenario.CalculateOverallRiskLevel()} risk level (Score: {scenario.CalculateOverallRiskScore()?.ToString("F1") ?? "N/A"})",
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
                var userId = User.GetUserId();
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
                var userId = User.GetUserId();
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
                var riskMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
                var riskLevels = new[]
                {
                    new { value = "Critical", label = "Critical", threshold = riskMatrix?.QualitativeCriticalThreshold ?? 16m },
                    new { value = "High", label = "High", threshold = riskMatrix?.QualitativeHighThreshold ?? 10m },
                    new { value = "Medium", label = "Medium", threshold = riskMatrix?.QualitativeMediumThreshold ?? 4m },
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

        // Helper method to build detailed assessment description for backlog approval
        private string BuildAssessmentDescriptionForBacklog(RiskAssessment assessment)
        {
            var description = $"ASSESSMENT COMPLETION APPROVAL: {assessment.Title}\n\n";
            description += $"Assessment ID: {assessment.Id}\n";
            description += $"Assessment Type: {assessment.AssessmentType}\n";
            description += $"Asset: {assessment.Asset}\n";
            description += $"Business Unit: {assessment.BusinessUnit ?? "Unknown"}\n";
            description += $"Business Owner: {assessment.BusinessOwner ?? "Not specified"}\n";
            description += $"Assessor: {assessment.Assessor}\n";
            description += $"Date Completed: {assessment.DateCompleted?.ToString("yyyy-MM-dd") ?? "Today"}\n";
            description += $"CIA Triad: {assessment.CIATriad}\n\n";
            
            if (!string.IsNullOrEmpty(assessment.Description))
            {
                description += $"Description: {assessment.Description}\n\n";
            }
            
            // Add threat scenario summary
            if (assessment.ThreatScenarios?.Any() == true)
            {
                description += $"Threat Scenarios ({assessment.ThreatScenarios.Count()}):\n";
                foreach (var scenario in assessment.ThreatScenarios.Take(5)) // Limit to first 5 for brevity
                {
                    description += $"  - {scenario.ScenarioName}: {scenario.Description ?? "No description"}\n";
                    if (scenario.ScenarioRisks?.Any() == true)
                    {
                        description += $"    ({scenario.ScenarioRisks.Count()} risks identified)\n";
                    }
                }
                if (assessment.ThreatScenarios.Count() > 5)
                {
                    description += $"  ... and {assessment.ThreatScenarios.Count() - 5} more scenarios\n";
                }
                description += "\n";
            }
            
            description += $"⚠️ APPROVAL REQUIRED: Once approved, all identified risks will be added to the Risk Register.\n";
            description += $"Assessment created: {assessment.CreatedAt:yyyy-MM-dd HH:mm}\n";
            description += $"Assessment completed: {DateTime.UtcNow:yyyy-MM-dd HH:mm}\n";
            
            return description;
        }

        // ===== COMPREHENSIVE THREAT SCENARIO PROCESSING =====
        private async Task ProcessComprehensiveThreatScenarios(List<ComprehensiveThreatScenario> threatScenarios, int assessmentId)
        {
            Console.WriteLine($"🔍 DEBUGGING: ProcessComprehensiveThreatScenarios called with {threatScenarios?.Count ?? 0} scenarios for assessment {assessmentId}");
            
            if (threatScenarios?.Any() != true)
            {
                Console.WriteLine($"🔍 DEBUGGING: No threat scenarios to process");
                return;
            }

            // Get the assessment with its risk matrix for proper risk calculations
            var assessment = await _context.RiskAssessments
                .Include(ra => ra.RiskMatrix)
                .FirstOrDefaultAsync(ra => ra.Id == assessmentId);
            
            var riskMatrix = assessment?.RiskMatrix;
            Console.WriteLine($"🔍 DEBUGGING: Assessment RiskMatrix: {riskMatrix?.Name ?? "None"}");

            // Get existing threat scenarios for this assessment
            var existingScenarios = await _context.ThreatScenarios
                .Where(ts => ts.RiskAssessmentId == assessmentId)
                .Include(ts => ts.ThreatVector)
                .Include(ts => ts.ThreatActorSteps)
                .Include(ts => ts.ThreatActorObjective)
                .Include(ts => ts.ScenarioRisks)
                .ToListAsync();

            Console.WriteLine($"🔍 DEBUGGING: Found {existingScenarios.Count} existing scenarios");

            foreach (var scenarioViewModel in threatScenarios.Where(s => !string.IsNullOrEmpty(s.ScenarioName)))
            {
                Console.WriteLine($"🔍 DEBUGGING: Processing threat scenario: {scenarioViewModel.ScenarioName}");
                Console.WriteLine($"🔍 DEBUGGING: scenarioViewModel.Id = {scenarioViewModel.Id}");
                Console.WriteLine($"🔍 DEBUGGING: Available existing scenario IDs: [{string.Join(", ", existingScenarios.Select(es => es.Id))}]");
                
                // Find existing scenario by ID or create new one
                var threatScenario = existingScenarios.FirstOrDefault(ts => ts.Id == scenarioViewModel.Id);
                
                if (threatScenario == null)
                {
                    Console.WriteLine($"🔍 DEBUGGING: Creating new threat scenario");
                    // Create new threat scenario
                    threatScenario = new ThreatScenario
                    {
                        RiskAssessmentId = assessmentId,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = User.GetUserId()
                    };
                    _context.ThreatScenarios.Add(threatScenario);
                }
                else
                {
                    Console.WriteLine($"🔍 DEBUGGING: Updating existing threat scenario ID: {threatScenario.Id}");
                }

                // Update fields
                threatScenario.ScenarioId = scenarioViewModel.ScenarioId;
                threatScenario.ScenarioName = scenarioViewModel.ScenarioName;
                threatScenario.Description = scenarioViewModel.Description;
                threatScenario.CIAImpactType = scenarioViewModel.CIAImpactType;
                threatScenario.UpdatedAt = DateTime.UtcNow;
                threatScenario.UpdatedBy = User.GetUserId();

                // Save changes for this scenario (need ID for related entities)
                await _context.SaveChangesAsync();

                // Process Threat Vector - Update or Create
                if (scenarioViewModel.ThreatVector != null && !string.IsNullOrEmpty(scenarioViewModel.ThreatVector.Name))
                {
                    var existingThreatVector = threatScenario.ThreatVector;
                    
                    if (existingThreatVector == null)
                    {
                        // Create new threat vector
                        var threatVector = new ThreatVector
                        {
                            ThreatScenarioId = threatScenario.Id,
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = User.GetUserId()
                        };
                        _context.ThreatVectors.Add(threatVector);
                        existingThreatVector = threatVector;
                    }
                    
                    // Update fields
                    existingThreatVector.Name = scenarioViewModel.ThreatVector.Name;
                    existingThreatVector.Description = scenarioViewModel.ThreatVector.Description;
                    existingThreatVector.MitreTechnique = string.IsNullOrWhiteSpace(scenarioViewModel.ThreatVector.MitreTechnique) ? "N/A" : scenarioViewModel.ThreatVector.MitreTechnique;
                    existingThreatVector.UpdatedAt = DateTime.UtcNow;
                    existingThreatVector.UpdatedBy = User.GetUserId();
                    
                    // Save changes
                    await _context.SaveChangesAsync();

                    // Process controls for threat vector
                    await ProcessThreatVectorControls(existingThreatVector.Id, scenarioViewModel.ThreatVector);
                }

                // Process Threat Actor Steps - Update or Create
                if (scenarioViewModel.ThreatActorSteps != null)
                {
                    for (int stepIndex = 0; stepIndex < scenarioViewModel.ThreatActorSteps.Count; stepIndex++)
                    {
                        var stepViewModel = scenarioViewModel.ThreatActorSteps[stepIndex];
                        if (!string.IsNullOrEmpty(stepViewModel.Name))
                        {
                            // Find existing step or create new one
                            var existingStep = threatScenario.ThreatActorSteps?.FirstOrDefault(s => s.Id == stepViewModel.Id);
                            
                            if (existingStep == null)
                            {
                                // Create new step
                                existingStep = new ThreatActorStep
                                {
                                    ThreatScenarioId = threatScenario.Id,
                                    CreatedAt = DateTime.UtcNow,
                                    CreatedBy = User.GetUserId()
                                };
                                _context.ThreatActorSteps.Add(existingStep);
                            }
                            
                            // Update fields
                            existingStep.Name = stepViewModel.Name;
                            existingStep.Description = stepViewModel.Description;
                            existingStep.MitreTechnique = string.IsNullOrWhiteSpace(stepViewModel.MitreTechnique) ? "N/A" : stepViewModel.MitreTechnique;
                            existingStep.StepOrder = stepIndex + 1;
                            existingStep.UpdatedAt = DateTime.UtcNow;
                            existingStep.UpdatedBy = User.GetUserId();
                            
                            await _context.SaveChangesAsync();

                            // Process controls for threat actor step
                            await ProcessThreatActorStepControls(existingStep.Id, stepViewModel);
                    }
                }
                }

                // Process Threat Actor Objective - Update or Create
                if (scenarioViewModel.ThreatActorObjective != null && !string.IsNullOrEmpty(scenarioViewModel.ThreatActorObjective.Name))
                {
                    // Find existing objective or create new one
                    var existingObjective = threatScenario.ThreatActorObjective;
                    
                    if (existingObjective == null)
                    {
                        // Create new objective
                        existingObjective = new ThreatActorObjective
                        {
                            ThreatScenarioId = threatScenario.Id,
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = User.GetUserId()
                        };
                        _context.ThreatActorObjectives.Add(existingObjective);
                    }
                    
                    // Update fields
                    existingObjective.Name = scenarioViewModel.ThreatActorObjective.Name;
                    existingObjective.Description = scenarioViewModel.ThreatActorObjective.Description;
                    existingObjective.MitreTechnique = string.IsNullOrWhiteSpace(scenarioViewModel.ThreatActorObjective.MitreTechnique) ? "N/A" : scenarioViewModel.ThreatActorObjective.MitreTechnique;
                    existingObjective.UpdatedAt = DateTime.UtcNow;
                    existingObjective.UpdatedBy = User.GetUserId();
                    
                    await _context.SaveChangesAsync();

                    // Process controls for threat actor objective
                    await ProcessThreatActorObjectiveControls(existingObjective.Id, scenarioViewModel.ThreatActorObjective);
                }

                // Process Scenario Risks - Update or Create
                if (scenarioViewModel.ScenarioRisks != null)
                {
                    foreach (var riskViewModel in scenarioViewModel.ScenarioRisks.Where(r => !string.IsNullOrEmpty(r.RiskName)))
                    {
                        // Find existing risk or create new one
                        var existingRisk = threatScenario.ScenarioRisks?.FirstOrDefault(r => r.Id == riskViewModel.Id);
                        
                        if (existingRisk == null)
                        {
                            // Create new risk
                            existingRisk = new ScenarioRisk
                            {
                                ThreatScenarioId = threatScenario.Id,
                                CreatedAt = DateTime.UtcNow,
                                CreatedBy = User.GetUserId()
                            };
                            _context.ScenarioRisks.Add(existingRisk);
                        }
                        
                        // Update fields
                        existingRisk.RiskName = riskViewModel.RiskName;
                        existingRisk.RiskDescription = riskViewModel.RiskDescription;
                        
                        // Current Risk Values
                        existingRisk.CurrentImpact = riskViewModel.CurrentImpact;
                        existingRisk.CurrentLikelihood = riskViewModel.CurrentLikelihood;
                        existingRisk.CurrentExposure = riskViewModel.CurrentExposure;
                        
                        // Residual Risk Values
                        existingRisk.ResidualImpact = riskViewModel.ResidualImpact;
                        existingRisk.ResidualLikelihood = riskViewModel.ResidualLikelihood;
                        existingRisk.ResidualExposure = riskViewModel.ResidualExposure;
                        
                        // Risk Treatment
                        existingRisk.RiskTreatmentPlan = string.IsNullOrWhiteSpace(riskViewModel.RiskTreatmentPlan) ? "N/A" : riskViewModel.RiskTreatmentPlan;
                        existingRisk.ExpectedCompletionDate = riskViewModel.ExpectedCompletionDate;
                        existingRisk.TreatmentPlanStatus = riskViewModel.TreatmentPlanStatus;
                        
                        // Audit fields
                        existingRisk.UpdatedAt = DateTime.UtcNow;
                        existingRisk.UpdatedBy = User.GetUserId();

                        // Calculate risk scores using the assessment's risk matrix
                        existingRisk.CalculateCurrentRisk(riskMatrix);
                        existingRisk.CalculateResidualRisk(riskMatrix);
                        
                        await _context.SaveChangesAsync();
                }
                }

                await _context.SaveChangesAsync();
            }
        }

        private async Task ProcessThreatVectorControls(int threatVectorId, ThreatVectorViewModel threatVector)
        {
            await ProcessControlsForComponent(threatVectorId, "ThreatVector", 
                threatVector.CurrentProtectiveControls, ControlType.Protective, ControlCategory.Current);
            await ProcessControlsForComponent(threatVectorId, "ThreatVector", 
                threatVector.CurrentDetectiveControls, ControlType.Detective, ControlCategory.Current);
            await ProcessControlsForComponent(threatVectorId, "ThreatVector", 
                threatVector.NeededProtectiveControls, ControlType.Protective, ControlCategory.Needed);
            await ProcessControlsForComponent(threatVectorId, "ThreatVector", 
                threatVector.NeededDetectiveControls, ControlType.Detective, ControlCategory.Needed);
        }

        private async Task ProcessThreatActorStepControls(int threatActorStepId, ThreatActorStepViewModel threatStep)
        {
            await ProcessControlsForComponent(threatActorStepId, "ThreatActorStep", 
                threatStep.CurrentProtectiveControls, ControlType.Protective, ControlCategory.Current);
            await ProcessControlsForComponent(threatActorStepId, "ThreatActorStep", 
                threatStep.CurrentDetectiveControls, ControlType.Detective, ControlCategory.Current);
            await ProcessControlsForComponent(threatActorStepId, "ThreatActorStep", 
                threatStep.NeededProtectiveControls, ControlType.Protective, ControlCategory.Needed);
            await ProcessControlsForComponent(threatActorStepId, "ThreatActorStep", 
                threatStep.NeededDetectiveControls, ControlType.Detective, ControlCategory.Needed);
        }

        private async Task ProcessThreatActorObjectiveControls(int threatActorObjectiveId, ThreatActorObjectiveViewModel threatObjective)
        {
            await ProcessControlsForComponent(threatActorObjectiveId, "ThreatActorObjective", 
                threatObjective.CurrentProtectiveControls, ControlType.Protective, ControlCategory.Current);
            await ProcessControlsForComponent(threatActorObjectiveId, "ThreatActorObjective", 
                threatObjective.CurrentDetectiveControls, ControlType.Detective, ControlCategory.Current);
            await ProcessControlsForComponent(threatActorObjectiveId, "ThreatActorObjective", 
                threatObjective.NeededProtectiveControls, ControlType.Protective, ControlCategory.Needed);
            await ProcessControlsForComponent(threatActorObjectiveId, "ThreatActorObjective", 
                threatObjective.NeededDetectiveControls, ControlType.Detective, ControlCategory.Needed);
        }

        private async Task ProcessControlsForComponent(int componentId, string componentType, 
            List<ControlSelectionViewModel> controls, ControlType controlType, ControlCategory controlCategory)
        {
            if (controls == null || !controls.Any())
                return;

            foreach (var controlViewModel in controls.Where(c => !string.IsNullOrEmpty(c.ControlName)))
            {
                try
                {
                    // Create or find existing threat control
                    var existingControl = await _context.ThreatControls
                        .FirstOrDefaultAsync(tc => tc.ControlName == controlViewModel.ControlName);

                    ThreatControl threatControl;
                    if (existingControl != null)
                    {
                        threatControl = existingControl;
                    }
                    else
                    {
                        threatControl = new ThreatControl
                        {
                            ControlName = controlViewModel.ControlName,
                            ControlDescription = string.IsNullOrEmpty(controlViewModel.ControlDescription) ? 
                                controlViewModel.ControlName : controlViewModel.ControlDescription,
                            ControlType = controlType,
                            ControlCategory = controlCategory,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow,
                            CreatedBy = User.GetUserId(),
                            UpdatedBy = User.GetUserId()
                        };
                        _context.ThreatControls.Add(threatControl);
                        await _context.SaveChangesAsync();
                    }

                    // Default implementation status if not provided
                    var implementationStatus = controlViewModel.ImplementationStatus == 0 ? 
                        ControlImplementationStatus.NotImplemented : controlViewModel.ImplementationStatus;

                    // Create the junction table record based on component type
                    switch (componentType)
                    {
                        case "ThreatVector":
                            var vectorControl = new ThreatVectorControl
                            {
                                ThreatVectorId = componentId,
                                ThreatControlId = threatControl.Id,
                                ImplementationStatus = implementationStatus
                            };
                            _context.ThreatVectorControls.Add(vectorControl);
                            break;
                        case "ThreatActorStep":
                            var stepControl = new ThreatActorStepControl
                            {
                                ThreatActorStepId = componentId,
                                ThreatControlId = threatControl.Id,
                                ImplementationStatus = implementationStatus
                            };
                            _context.ThreatActorStepControls.Add(stepControl);
                            break;
                        case "ThreatActorObjective":
                            var objectiveControl = new ThreatActorObjectiveControl
                            {
                                ThreatActorObjectiveId = componentId,
                                ThreatControlId = threatControl.Id,
                                ImplementationStatus = implementationStatus
                            };
                            _context.ThreatActorObjectiveControls.Add(objectiveControl);
                            break;
                    }
                }
                catch (Exception ex)
                {
                    // Log error but continue processing other controls
                    Console.WriteLine($"Error processing control {controlViewModel.ControlName}: {ex.Message}");
                }
            }

            await _context.SaveChangesAsync();
        }
    }
}