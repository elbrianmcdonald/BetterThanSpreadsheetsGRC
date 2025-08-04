using CyberRiskApp.Models;
using CyberRiskApp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CyberRiskApp.Authorization;

namespace CyberRiskApp.Controllers
{
    // UPDATED: Changed from GRC/Admin only to allow all authenticated users
    [Authorize(Policy = PolicyConstants.RequireAnyRole)]
    public class CISOExecutiveController : Controller
    {
        private readonly IFindingService _findingService;
        private readonly IRiskService _riskService;
        private readonly IGovernanceService _governanceService;
        private readonly IRiskLevelSettingsService _riskLevelSettingsService;
        private readonly IRiskAssessmentService _riskAssessmentService;

        public CISOExecutiveController(IFindingService findingService, IRiskService riskService, IGovernanceService governanceService, IRiskLevelSettingsService riskLevelSettingsService, IRiskAssessmentService riskAssessmentService)
        {
            _findingService = findingService;
            _riskService = riskService;
            _governanceService = governanceService;
            _riskLevelSettingsService = riskLevelSettingsService;
            _riskAssessmentService = riskAssessmentService;
        }

        public IActionResult Index()
        {
            return View();
        }

        [HttpGet]
        public async Task<IActionResult> GetExecutiveDashboardData()
        {
            try
            {
                // Get all findings and risks
                var allFindings = await _findingService.GetAllFindingsAsync();
                var allRisks = await _riskService.GetAllRisksAsync();
                var openFindings = allFindings.Where(f => f.Status != FindingStatus.Closed).ToList();
                
                // DEBUG: Comprehensive logging
                Console.WriteLine("📊 ===== CISO DASHBOARD DATA DEBUG =====");
                Console.WriteLine($"📊 Total findings retrieved: {allFindings.Count()}");
                Console.WriteLine($"📊 Total risks retrieved: {allRisks.Count()}");
                Console.WriteLine($"📊 Open findings: {openFindings.Count}");
                
                // Log risk details
                var openRisks = allRisks.Where(r => r.Status == RiskStatus.Open).ToList();
                Console.WriteLine($"📊 Open risks: {openRisks.Count}");
                Console.WriteLine($"📊 Risk Status Distribution:");
                foreach (var statusGroup in allRisks.GroupBy(r => r.Status))
                {
                    Console.WriteLine($"   - {statusGroup.Key}: {statusGroup.Count()} risks");
                }
                
                // Log risk levels
                Console.WriteLine($"📊 Risk Level Distribution:");
                foreach (var levelGroup in openRisks.GroupBy(r => r.RiskLevel))
                {
                    Console.WriteLine($"   - {levelGroup.Key}: {levelGroup.Count()} risks");
                }
                
                // Log top risks with ALE
                Console.WriteLine($"📊 Top 5 Risks by ALE:");
                foreach (var risk in openRisks.OrderByDescending(r => r.ALE).Take(5))
                {
                    Console.WriteLine($"   - {risk.Title ?? "No Title"} | ALE: ${risk.ALE:N0} | Level: {risk.RiskLevel} | Status: {risk.Status}");
                }
                
                // Log finding risk ratings
                Console.WriteLine($"📊 Finding Risk Ratings:");
                foreach (var ratingGroup in openFindings.GroupBy(f => f.RiskRating))
                {
                    Console.WriteLine($"   - {ratingGroup.Key}: {ratingGroup.Count()} findings");
                }
                
                var totalALE = await _riskService.GetTotalALEAsync();
                Console.WriteLine($"📊 Total ALE (from service): ${totalALE:N0}");
                Console.WriteLine($"📊 Total ALE (manual calc): ${openRisks.Sum(r => r.ALE):N0}");
                Console.WriteLine("📊 ===== END DEBUG =====");
                var overdueFindings = openFindings.Where(f => f.IsOverdue).ToList();
                var criticalHighFindings = openFindings.Where(f =>
                    f.RiskRating == RiskRating.Critical || f.RiskRating == RiskRating.High).ToList();

                // Group risks by business unit for the heatmap
                var businessUnitMetrics = openRisks
                    .GroupBy(r => r.BusinessUnit)
                    .Select(g => new
                    {
                        businessUnit = g.Key,
                        totalRisks = g.Count(),
                        criticalCount = g.Count(r => r.RiskLevel == RiskLevel.Critical),
                        highCount = g.Count(r => r.RiskLevel == RiskLevel.High),
                        mediumCount = g.Count(r => r.RiskLevel == RiskLevel.Medium),
                        lowCount = g.Count(r => r.RiskLevel == RiskLevel.Low),
                        totalALE = g.Sum(r => r.ALE),
                        status = GetBusinessUnitRiskStatus(g.ToList())
                    })
                    .ToList();


                // Get top financial risks
                var topFinancialRisks = allRisks
                    .Where(r => r.Status == RiskStatus.Open)
                    .OrderByDescending(r => r.ALE)
                    .Take(5)
                    .Select(r => new
                    {
                        riskDescription = r.Title ?? "Risk Assessment",
                        asset = r.Asset ?? "Not specified",
                        ale = r.ALE,
                        status = r.Status.ToString()
                    })
                    .ToList();
                    
                // DEBUG: Log top financial risks
                Console.WriteLine($"🔍 CISO Dashboard Debug - Top financial risks count: {topFinancialRisks.Count}");
                foreach (var risk in topFinancialRisks)
                {
                    Console.WriteLine($"🔍 Top Financial Risk: {risk.riskDescription}, ALE: ${risk.ale}");
                }

                // Calculate SLA performance
                var totalWithSLA = openFindings.Count(f => f.SlaDate.HasValue);
                var onTimeItems = openFindings.Count(f => f.SlaDate.HasValue && !f.IsOverdue);
                var slaPerformance = totalWithSLA > 0 ? (decimal)onTimeItems / totalWithSLA * 100 : 0;

                // Set compliance percentage to 0 since we removed assessment selection
                var compliancePercentage = 0m;

                // Calculate risks above appetite
                var risksAboveAppetite = await CalculateRisksAboveAppetite();
                
                // Get top 10 assets with most risks above appetite
                var topAssetsWithHighRisks = await GetTopAssetsWithRisksAboveAppetite();

                var dashboardData = new
                {
                    summary = new
                    {
                        totalCriticalHighFindings = criticalHighFindings.Count,
                        totalALE = await _riskService.GetTotalALEAsync(),
                        slaPerformance = Math.Round(slaPerformance, 1),
                        compliancePercentage = compliancePercentage,
                        overdueFindings = overdueFindings.Count,
                        riskExposure = await _riskService.GetTotalALEAsync(),
                        risksAboveAppetite = risksAboveAppetite.Count,
                        riskAppetiteTrend = risksAboveAppetite.Trend
                    },
                    riskDistribution = new
                    {
                        critical = openRisks.Count(r => r.RiskLevel == RiskLevel.Critical),
                        high = openRisks.Count(r => r.RiskLevel == RiskLevel.High),
                        medium = openRisks.Count(r => r.RiskLevel == RiskLevel.Medium),
                        low = openRisks.Count(r => r.RiskLevel == RiskLevel.Low)
                    },
                    businessUnitMetrics = businessUnitMetrics,
                    topFinancialRisks = topFinancialRisks,
                    topAssetsWithHighRisks = topAssetsWithHighRisks
                };

                return Json(dashboardData);
            }
            catch (Exception ex)
            {
                return Json(new { error = ex.Message });
            }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> CreateSampleFAIRAssessments()
        {
            try
            {
                var sampleAssessments = new[]
                {
                    new RiskAssessment
                    {
                        Title = "Email System Data Breach Assessment",
                        Asset = "Email Infrastructure",
                        BusinessUnit = "IT Department",
                        BusinessOwner = "IT Manager",
                        Description = "FAIR assessment of potential data breach through email system compromise",
                        ThreatScenario = "External attacker compromises email server and accesses sensitive communications",
                        CIATriad = CIATriad.Confidentiality,
                        AssessmentType = AssessmentType.FAIR,
                        Status = AssessmentStatus.Completed,
                        DateCompleted = DateTime.Today,
                        Assessor = "Risk Analyst",
                        AnnualLossExpectancy = 320000m,
                        ALE_50th = 320000m,
                        ThreatEventFrequency = 0.5m,
                        ContactFrequency = 80m,
                        ActionSuccess = 25m,
                        ProductivityLossMostLikely = 150000m,
                        ResponseCostsMostLikely = 85000m,
                        FinesMostLikely = 75000m,
                        ReputationDamageMostLikely = 10000m,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    },
                    new RiskAssessment
                    {
                        Title = "Ransomware Attack on File Servers",
                        Asset = "Corporate File Servers", 
                        BusinessUnit = "Operations",
                        BusinessOwner = "Operations Director",
                        Description = "FAIR assessment of ransomware impact on business operations",
                        ThreatScenario = "Ransomware encrypts critical business files leading to operational shutdown",
                        CIATriad = CIATriad.Availability,
                        AssessmentType = AssessmentType.FAIR,
                        Status = AssessmentStatus.Completed,
                        DateCompleted = DateTime.Today,
                        Assessor = "Security Analyst",
                        AnnualLossExpectancy = 680000m,
                        ALE_50th = 680000m,
                        ThreatEventFrequency = 0.3m,
                        ContactFrequency = 90m,
                        ActionSuccess = 35m,
                        ProductivityLossMostLikely = 400000m,
                        ResponseCostsMostLikely = 150000m,
                        ReplacementCostMostLikely = 100000m,
                        ReputationDamageMostLikely = 30000m,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    },
                    new RiskAssessment
                    {
                        Title = "Customer Database SQL Injection Attack",
                        Asset = "Customer Database",
                        BusinessUnit = "Customer Services",
                        BusinessOwner = "Customer Services Manager", 
                        Description = "FAIR assessment of SQL injection leading to customer data exposure",
                        ThreatScenario = "Attacker exploits web application vulnerability to access customer PII",
                        CIATriad = CIATriad.Confidentiality,
                        AssessmentType = AssessmentType.FAIR,
                        Status = AssessmentStatus.Completed,
                        DateCompleted = DateTime.Today,
                        Assessor = "Risk Analyst",
                        AnnualLossExpectancy = 450000m,
                        ALE_50th = 450000m,
                        ThreatEventFrequency = 0.8m,
                        ContactFrequency = 60m,
                        ActionSuccess = 20m,
                        ProductivityLossMostLikely = 80000m,
                        ResponseCostsMostLikely = 120000m,
                        FinesMostLikely = 200000m,
                        ReputationDamageMostLikely = 50000m,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    }
                };

                var risksCreated = 0;
                
                foreach (var assessment in sampleAssessments)
                {
                    // Create the assessment (no automatic risks will be created)
                    await _riskAssessmentService.CreateAssessmentAsync(assessment);
                    
                    // Manually create a sample identified risk for each assessment to demonstrate the proper business logic
                    // This simulates what would happen when a user adds identified risks through the assessment form
                    var identifiedRisk = new Risk
                    {
                        Title = $"Data Loss Risk - {assessment.Asset}",
                        Description = $"Risk of data loss from {assessment.ThreatScenario}",
                        Asset = assessment.Asset,
                        BusinessUnit = assessment.BusinessUnit ?? "Unknown",
                        ThreatScenario = assessment.ThreatScenario,
                        CIATriad = assessment.CIATriad ?? CIATriad.All,
                        Owner = assessment.Assessor,
                        // Inherit ALE from the FAIR assessment
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

                    // Calculate risk level based on ALE (same logic as RiskAssessmentsController)
                    var currentSettings = await _riskLevelSettingsService.GetActiveSettingsAsync();
                    if (currentSettings != null)
                    {
                        identifiedRisk.RiskLevel = identifiedRisk.ALE >= currentSettings.FairCriticalThreshold ? RiskLevel.Critical :
                                                 identifiedRisk.ALE >= currentSettings.FairHighThreshold ? RiskLevel.High :
                                                 identifiedRisk.ALE >= currentSettings.FairMediumThreshold ? RiskLevel.Medium : RiskLevel.Low;
                    }
                    else
                    {
                        // Fallback to default FAIR thresholds
                        identifiedRisk.RiskLevel = identifiedRisk.ALE >= 100000 ? RiskLevel.Critical :
                                                 identifiedRisk.ALE >= 50000 ? RiskLevel.High :
                                                 identifiedRisk.ALE >= 10000 ? RiskLevel.Medium : RiskLevel.Low;
                    }
                    
                    identifiedRisk.InherentRiskLevel = identifiedRisk.RiskLevel;
                    identifiedRisk.ResidualRiskLevel = identifiedRisk.RiskLevel;
                    
                    // Create the risk (this simulates what happens when assessment is completed with identified risks)
                    await _riskService.CreateRiskAsync(identifiedRisk);
                    risksCreated++;
                    
                    Console.WriteLine($"✅ Created identified risk '{identifiedRisk.Title}' from {assessment.AssessmentType} assessment with ALE: ${identifiedRisk.ALE:N0}, Level: {identifiedRisk.RiskLevel}");
                }

                var totalALE = sampleAssessments.Sum(a => a.AnnualLossExpectancy ?? 0);
                return Json(new { 
                    success = true, 
                    message = $"Created {sampleAssessments.Length} FAIR assessments and {risksCreated} identified risks. Total ALE: ${totalALE:N0}", 
                    assessments = sampleAssessments.Length,
                    risks = risksCreated,
                    totalALE = totalALE
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, error = ex.Message });
            }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> CreateSampleRiskData()
        {
            try
            {
                // Create sample risks with ALE values for testing
                var sampleRisks = new[]
                {
                    new Risk
                    {
                        RiskNumber = await GenerateNextRiskNumberAsync(),
                        Title = "Data Breach - Customer Database",
                        ThreatScenario = "External attacker gains access to customer database through SQL injection",
                        CIATriad = CIATriad.Confidentiality,
                        Description = "Unauthorized access to customer personal information could result in regulatory fines and reputation damage",
                        BusinessUnit = "IT Department",
                        Asset = "Customer Database",
                        Owner = "IT Manager",
                        Impact = ImpactLevel.High,
                        Likelihood = LikelihoodLevel.Possible,
                        Exposure = ExposureLevel.HighlyExposed,
                        InherentRiskLevel = RiskLevel.High,
                        Treatment = TreatmentStrategy.Mitigate,
                        ResidualRiskLevel = RiskLevel.Medium,
                        ALE = 250000m,
                        RiskLevel = RiskLevel.High,
                        Status = RiskStatus.Open,
                        OpenDate = DateTime.Today.AddDays(-30),
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    },
                    new Risk
                    {
                        RiskNumber = await GenerateNextRiskNumberAsync(),
                        Title = "Ransomware Attack",
                        ThreatScenario = "Malicious email attachment deploys ransomware across network",
                        CIATriad = CIATriad.Availability,
                        Description = "Business operations disrupted due to encrypted files and systems",
                        BusinessUnit = "Operations",
                        Asset = "File Servers",
                        Owner = "Operations Manager",
                        Impact = ImpactLevel.Critical,
                        Likelihood = LikelihoodLevel.Possible,
                        Exposure = ExposureLevel.HighlyExposed,
                        InherentRiskLevel = RiskLevel.Critical,
                        Treatment = TreatmentStrategy.Mitigate,
                        ResidualRiskLevel = RiskLevel.High,
                        ALE = 500000m,
                        RiskLevel = RiskLevel.Critical,
                        Status = RiskStatus.Open,
                        OpenDate = DateTime.Today.AddDays(-15),
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    },
                    new Risk
                    {
                        RiskNumber = await GenerateNextRiskNumberAsync(),
                        Title = "Insider Threat - Data Theft",
                        ThreatScenario = "Privileged user downloads sensitive data for personal gain",
                        CIATriad = CIATriad.Confidentiality,
                        Description = "Employee with elevated access steals intellectual property",
                        BusinessUnit = "HR Department",
                        Asset = "Document Management System",
                        Owner = "HR Director",
                        Impact = ImpactLevel.High,
                        Likelihood = LikelihoodLevel.Unlikely,
                        Exposure = ExposureLevel.Exposed,
                        InherentRiskLevel = RiskLevel.Medium,
                        Treatment = TreatmentStrategy.Mitigate,
                        ResidualRiskLevel = RiskLevel.Low,
                        ALE = 75000m,
                        RiskLevel = RiskLevel.Medium,
                        Status = RiskStatus.Open,
                        OpenDate = DateTime.Today.AddDays(-45),
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    }
                };

                foreach (var risk in sampleRisks)
                {
                    await _riskService.CreateRiskAsync(risk);
                }

                return Json(new { success = true, message = $"Created {sampleRisks.Length} sample risks with ALE values", risks = sampleRisks.Length });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, error = ex.Message });
            }
        }

        private async Task<string> GenerateNextRiskNumberAsync()
        {
            var allRisks = await _riskService.GetAllRisksAsync();
            var maxNumber = allRisks
                .Where(r => r.RiskNumber.StartsWith("RISK-"))
                .Select(r => {
                    var numberPart = r.RiskNumber.Substring(5);
                    return int.TryParse(numberPart, out int num) ? num : 0;
                })
                .DefaultIfEmpty(0)
                .Max();
            
            return $"RISK-{(maxNumber + 1):D4}";
        }

        [HttpGet]
        public async Task<IActionResult> DiagnoseRiskALE()
        {
            try
            {
                var risks = await _riskService.GetAllRisksAsync();
                var assessments = await _riskAssessmentService.GetAllAssessmentsAsync();
                
                var riskDetails = risks.Select(r => new
                {
                    r.Id,
                    r.RiskNumber,
                    r.Title,
                    r.ALE,
                    r.RiskLevel,
                    r.Status,
                    r.RiskAssessmentId,
                    AssessmentTitle = r.RiskAssessmentId.HasValue 
                        ? assessments.FirstOrDefault(a => a.Id == r.RiskAssessmentId.Value)?.Title 
                        : "No linked assessment",
                    AssessmentALE = r.RiskAssessmentId.HasValue 
                        ? assessments.FirstOrDefault(a => a.Id == r.RiskAssessmentId.Value)?.AnnualLossExpectancy 
                        : null,
                    AssessmentType = r.RiskAssessmentId.HasValue 
                        ? assessments.FirstOrDefault(a => a.Id == r.RiskAssessmentId.Value)?.AssessmentType.ToString() 
                        : "None",
                    AssessmentStatus = r.RiskAssessmentId.HasValue 
                        ? assessments.FirstOrDefault(a => a.Id == r.RiskAssessmentId.Value)?.Status.ToString() 
                        : "None"
                }).ToList();
                
                return Json(new 
                { 
                    totalRisks = risks.Count(),
                    risksWithALE = risks.Count(r => r.ALE > 0),
                    totalAssessments = assessments.Count(),
                    completedFAIRAssessments = assessments.Count(a => a.Status == AssessmentStatus.Completed && a.AssessmentType == AssessmentType.FAIR),
                    riskDetails = riskDetails
                });
            }
            catch (Exception ex)
            {
                return Json(new { error = ex.Message, stackTrace = ex.StackTrace });
            }
        }

        [HttpGet]
        public async Task<IActionResult> DiagnoseSpecificAssessment(int id)
        {
            try
            {
                var assessment = await _riskAssessmentService.GetAssessmentByIdAsync(id);
                if (assessment == null)
                    return Json(new { error = "Assessment not found" });
                
                var risks = await _riskService.GetAllRisksAsync();
                var linkedRisks = risks.Where(r => r.RiskAssessmentId == id).ToList();
                
                return Json(new 
                {
                    assessment = new
                    {
                        assessment.Id,
                        assessment.Title,
                        assessment.AssessmentType,
                        assessment.AnnualLossExpectancy,
                        assessment.Status,
                        IdentifiedRisksCount = assessment.IdentifiedRisks?.Count ?? 0
                    },
                    linkedRisks = linkedRisks.Select(r => new
                    {
                        r.Id,
                        r.RiskNumber,
                        r.Title,
                        r.ALE,
                        r.RiskLevel,
                        r.Status
                    }).ToList(),
                    diagnosis = $"Assessment ALE: ${assessment.AnnualLossExpectancy ?? 0:N0}, " +
                               $"Linked Risks: {linkedRisks.Count}, " +
                               $"Risks with ALE=0: {linkedRisks.Count(r => r.ALE == 0)}"
                });
            }
            catch (Exception ex)
            {
                return Json(new { error = ex.Message });
            }
        }

        [HttpGet]
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> FixIdentifiedRisksALE()
        {
            try
            {
                var risks = await _riskService.GetAllRisksAsync();
                var assessments = await _riskAssessmentService.GetAllAssessmentsAsync();
                var currentSettings = await _riskLevelSettingsService.GetActiveSettingsAsync();
                var fixedCount = 0;
                
                // Find risks that are linked to FAIR assessments but have ALE = 0 or incorrect ALE
                var risksToFix = risks.Where(r => r.RiskAssessmentId.HasValue).ToList();
                var risksWithZeroALE = risksToFix.Where(r => r.ALE == 0).ToList();
                
                Console.WriteLine($"🔍 Found {risksToFix.Count} risks linked to assessments");
                Console.WriteLine($"🔍 Found {risksWithZeroALE.Count} risks with ALE = 0 that are linked to assessments");
                
                foreach (var risk in risksToFix)
                {
                    var assessment = assessments.FirstOrDefault(a => a.Id == risk.RiskAssessmentId.Value);
                    if (assessment != null && 
                        assessment.AssessmentType == AssessmentType.FAIR && 
                        assessment.AnnualLossExpectancy.HasValue &&
                        assessment.AnnualLossExpectancy > 0)
                    {
                        // Check if the risk needs fixing (ALE doesn't match assessment ALE)
                        if (risk.ALE != assessment.AnnualLossExpectancy.Value)
                        {
                            Console.WriteLine($"🔧 Fixing risk {risk.RiskNumber}: '{risk.Title}'");
                            Console.WriteLine($"   - Current ALE: ${risk.ALE:N0}");
                            Console.WriteLine($"   - Assessment ALE: ${assessment.AnnualLossExpectancy:N0}");
                            Console.WriteLine($"   - Current Risk Level: {risk.RiskLevel}");
                            
                            // Update risk with correct ALE from assessment
                            risk.ALE = assessment.AnnualLossExpectancy.Value;
                        
                            // Recalculate risk level based on ALE
                            if (currentSettings != null)
                            {
                                risk.RiskLevel = risk.ALE >= currentSettings.FairCriticalThreshold ? RiskLevel.Critical :
                                               risk.ALE >= currentSettings.FairHighThreshold ? RiskLevel.High :
                                               risk.ALE >= currentSettings.FairMediumThreshold ? RiskLevel.Medium : RiskLevel.Low;
                            }
                            else
                            {
                                // Default thresholds
                                risk.RiskLevel = risk.ALE >= 100000 ? RiskLevel.Critical :
                                               risk.ALE >= 50000 ? RiskLevel.High :
                                               risk.ALE >= 10000 ? RiskLevel.Medium : RiskLevel.Low;
                            }
                            
                            risk.InherentRiskLevel = risk.RiskLevel;
                            risk.ResidualRiskLevel = risk.RiskLevel;
                            
                            await _riskService.UpdateRiskAsync(risk);
                            fixedCount++;
                            
                            Console.WriteLine($"   - New ALE: ${risk.ALE:N0}");
                            Console.WriteLine($"   - New Risk Level: {risk.RiskLevel}");
                        }
                        else
                        {
                            Console.WriteLine($"✅ Risk {risk.RiskNumber} already has correct ALE: ${risk.ALE:N0}");
                        }
                    }
                }
                
                return Json(new { 
                    success = true, 
                    message = $"Fixed {fixedCount} identified risks to inherit ALE from their FAIR assessments",
                    fixedCount = fixedCount
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, error = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> FixExistingRisks()
        {
            try
            {
                var risks = await _riskService.GetAllRisksAsync();
                var assessments = await _riskAssessmentService.GetAllAssessmentsAsync();
                var currentSettings = await _riskLevelSettingsService.GetActiveSettingsAsync();
                var fixedCount = 0;
                
                foreach (var risk in risks.Where(r => r.RiskAssessmentId.HasValue))
                {
                    var assessment = assessments.FirstOrDefault(a => a.Id == risk.RiskAssessmentId.Value);
                    if (assessment != null && assessment.AssessmentType == AssessmentType.FAIR && assessment.AnnualLossExpectancy.HasValue)
                    {
                        // Update risk with correct ALE
                        risk.ALE = assessment.AnnualLossExpectancy.Value;
                        
                        // Recalculate risk level based on ALE
                        if (currentSettings != null)
                        {
                            risk.RiskLevel = risk.ALE >= currentSettings.FairCriticalThreshold ? RiskLevel.Critical :
                                           risk.ALE >= currentSettings.FairHighThreshold ? RiskLevel.High :
                                           risk.ALE >= currentSettings.FairMediumThreshold ? RiskLevel.Medium : RiskLevel.Low;
                        }
                        else
                        {
                            // Default thresholds
                            risk.RiskLevel = risk.ALE >= 100000 ? RiskLevel.Critical :
                                           risk.ALE >= 50000 ? RiskLevel.High :
                                           risk.ALE >= 10000 ? RiskLevel.Medium : RiskLevel.Low;
                        }
                        
                        risk.InherentRiskLevel = risk.RiskLevel;
                        risk.ResidualRiskLevel = risk.RiskLevel;
                        
                        await _riskService.UpdateRiskAsync(risk);
                        fixedCount++;
                        
                        Console.WriteLine($"✅ Fixed Risk {risk.RiskNumber}: ALE=${risk.ALE:N0}, Level={risk.RiskLevel}");
                    }
                }
                
                return Json(new { 
                    success = true, 
                    message = $"Fixed {fixedCount} risks with proper ALE values from their assessments",
                    fixedCount = fixedCount
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, error = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetDatabaseStatus()
        {
            try
            {
                var risks = await _riskService.GetAllRisksAsync();
                var findings = await _findingService.GetAllFindingsAsync();
                var assessments = await _riskAssessmentService.GetAllAssessmentsAsync();
                
                var status = new
                {
                    TotalRisks = risks.Count(),
                    OpenRisks = risks.Count(r => r.Status == RiskStatus.Open),
                    RisksWithALE = risks.Count(r => r.ALE > 0),
                    TotalALE = risks.Where(r => r.Status == RiskStatus.Open).Sum(r => r.ALE),
                    TotalFindings = findings.Count(),
                    OpenFindings = findings.Count(f => f.Status != FindingStatus.Closed),
                    TotalAssessments = assessments.Count(),
                    CompletedAssessments = assessments.Count(a => a.Status == AssessmentStatus.Completed),
                    FAIRAssessments = assessments.Count(a => a.AssessmentType == AssessmentType.FAIR),
                    RisksByLevel = risks.Where(r => r.Status == RiskStatus.Open)
                        .GroupBy(r => r.RiskLevel)
                        .ToDictionary(g => g.Key.ToString(), g => g.Count()),
                    FindingsByRating = findings.Where(f => f.Status != FindingStatus.Closed)
                        .GroupBy(f => f.RiskRating)
                        .ToDictionary(g => g.Key.ToString(), g => g.Count())
                };
                
                return Json(status);
            }
            catch (Exception ex)
            {
                return Json(new { error = ex.Message, stackTrace = ex.StackTrace });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetAvailableAssessments()
        {
            try
            {
                var allAssessments = await _governanceService.GetAllAssessmentsAsync();

                Console.WriteLine($"🔍 Total assessments found: {allAssessments.Count()}");

                foreach (var assessment in allAssessments)
                {
                    Console.WriteLine($"📋 Assessment: ID={assessment.Id}, Title='{assessment.Title}', Status={assessment.Status}");
                }

                var availableAssessments = allAssessments
                    .OrderByDescending(a => a.CreatedAt)
                    .Select(a => new {
                        Value = a.Id.ToString(),
                        Text = $"{a.Title} ({a.Status})"
                    })
                    .ToList();

                Console.WriteLine($"✅ Returning {availableAssessments.Count} assessments to dropdown");
                return Json(availableAssessments);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error loading assessments: {ex.Message}");
                Console.WriteLine($"❌ Stack trace: {ex.StackTrace}");
                return Json(new { error = ex.Message });
            }
        }

        private string GetBusinessUnitStatus(List<Finding> findings)
        {
            var criticalCount = findings.Count(f => f.RiskRating == RiskRating.Critical);
            var highCount = findings.Count(f => f.RiskRating == RiskRating.High);
            var overdueCount = findings.Count(f => f.IsOverdue);

            if (criticalCount > 0 || overdueCount > 5) return "critical";
            if (highCount > 3 || overdueCount > 2) return "warning";
            if (highCount > 0 || overdueCount > 0) return "good";
            return "excellent";
        }

        private string GetBusinessUnitRiskStatus(List<Risk> risks)
        {
            var criticalCount = risks.Count(r => r.RiskLevel == RiskLevel.Critical);
            var highCount = risks.Count(r => r.RiskLevel == RiskLevel.High);
            var totalALE = risks.Sum(r => r.ALE);

            // Risk status based on risk levels and ALE
            if (criticalCount > 0 || totalALE >= 500000) return "critical";
            if (highCount > 3 || totalALE >= 200000) return "warning";
            if (highCount > 0 || totalALE >= 50000) return "good";
            return "excellent";
        }



        private async Task<dynamic> CalculateRisksAboveAppetite()
        {
            try
            {
                var appetiteThreshold = await _riskLevelSettingsService.GetRiskAppetiteThresholdAsync();
                var allRisks = await _riskService.GetAllRisksAsync();
                var openRisks = allRisks.Where(r => r.Status == RiskStatus.Open).ToList();

                // Calculate current risks above appetite
                var currentAboveAppetite = 0;
                foreach (var risk in openRisks)
                {
                    // Use ALE for FAIR assessment (convert to risk score equivalent)
                    // Use qualitative risk level calculation for others
                    decimal riskScore = 0;
                    AssessmentType assessmentType = AssessmentType.Qualitative; // Default
                    
                    if (risk.ALE > 0)
                    {
                        // For FAIR assessments, use ALE directly
                        assessmentType = AssessmentType.FAIR;
                        riskScore = risk.ALE;
                    }
                    else
                    {
                        // For qualitative assessments, calculate risk score from Impact × Likelihood × Exposure
                        var impactValue = GetRiskFactorValue(risk.Impact.ToString());
                        var likelihoodValue = GetRiskFactorValue(risk.Likelihood.ToString());
                        var exposureValue = GetRiskFactorValue(risk.Exposure.ToString());
                        riskScore = impactValue * likelihoodValue * exposureValue;
                        assessmentType = AssessmentType.Qualitative;
                    }
                    
                    if (await _riskLevelSettingsService.IsRiskAboveAppetiteAsync(riskScore, assessmentType))
                    {
                        currentAboveAppetite++;
                    }
                }

                // Calculate trend (simplified - would need historical data for real trend)
                // For now, assuming a slight increase trend if there are risks above appetite
                var trend = currentAboveAppetite > 0 ? "up" : "stable";

                return new
                {
                    Count = currentAboveAppetite,
                    Trend = trend,
                    Threshold = appetiteThreshold
                };
            }
            catch (Exception ex)
            {
                // Return default values on error
                return new
                {
                    Count = 0,
                    Trend = "stable",
                    Threshold = 6.0m
                };
            }
        }

        private decimal GetRiskFactorValue(string factor)
        {
            return factor.ToLower() switch
            {
                "very low" or "verylow" => 1,
                "low" => 2,
                "medium" => 3,
                "high" => 4,
                "very high" or "veryhigh" => 5,
                _ => 1
            };
        }
        
        private async Task<List<object>> GetTopAssetsWithRisksAboveAppetite()
        {
            try
            {
                var allRisks = await _riskService.GetAllRisksAsync();
                var openRisks = allRisks.Where(r => r.Status == RiskStatus.Open && !string.IsNullOrEmpty(r.Asset)).ToList();
                
                var assetRiskData = new Dictionary<string, List<Risk>>();
                
                // Group risks by asset
                foreach (var risk in openRisks)
                {
                    if (!assetRiskData.ContainsKey(risk.Asset))
                    {
                        assetRiskData[risk.Asset] = new List<Risk>();
                    }
                    assetRiskData[risk.Asset].Add(risk);
                }
                
                var topAssets = new List<object>();
                
                foreach (var assetGroup in assetRiskData)
                {
                    var asset = assetGroup.Key;
                    var risks = assetGroup.Value;
                    
                    var risksAboveAppetite = 0;
                    var totalALE = 0m;
                    var criticalCount = 0;
                    var highCount = 0;
                    
                    foreach (var risk in risks)
                    {
                        // Count risk levels
                        if (risk.RiskLevel == RiskLevel.Critical) criticalCount++;
                        if (risk.RiskLevel == RiskLevel.High) highCount++;
                        
                        // Sum ALE
                        totalALE += risk.ALE;
                        
                        // Check if risk is above appetite
                        decimal riskScore = 0;
                        AssessmentType assessmentType = AssessmentType.Qualitative;
                        
                        if (risk.ALE > 0)
                        {
                            assessmentType = AssessmentType.FAIR;
                            riskScore = risk.ALE;
                        }
                        else
                        {
                            var impactValue = GetRiskFactorValue(risk.Impact.ToString());
                            var likelihoodValue = GetRiskFactorValue(risk.Likelihood.ToString());
                            var exposureValue = GetRiskFactorValue(risk.Exposure.ToString());
                            riskScore = impactValue * likelihoodValue * exposureValue;
                        }
                        
                        if (await _riskLevelSettingsService.IsRiskAboveAppetiteAsync(riskScore, assessmentType))
                        {
                            risksAboveAppetite++;
                        }
                    }
                    
                    topAssets.Add(new
                    {
                        asset = asset,
                        totalRisks = risks.Count,
                        risksAboveAppetite = risksAboveAppetite,
                        totalALE = totalALE,
                        criticalCount = criticalCount,
                        highCount = highCount,
                        businessUnit = risks.FirstOrDefault()?.BusinessUnit ?? "Unknown"
                    });
                }
                
                // Return top 10 assets with most risks above appetite
                return topAssets
                    .OrderByDescending(a => ((dynamic)a).risksAboveAppetite)
                    .ThenByDescending(a => ((dynamic)a).totalALE)
                    .Take(10)
                    .ToList();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error calculating top assets with high risks: {ex.Message}");
                return new List<object>();
            }
        }
    }
}