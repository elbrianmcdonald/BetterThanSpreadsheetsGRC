using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
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
        private readonly IRiskMatrixService _riskMatrixService;
        private readonly IRiskAssessmentService _riskAssessmentService;
        private readonly IMaturityService _maturityService;
        private readonly IUserService _userService;
        private readonly IRequestService _requestService;
        private readonly UserManager<User> _userManager;

        public CISOExecutiveController(IFindingService findingService, IRiskService riskService, IGovernanceService governanceService, IRiskMatrixService riskMatrixService, IRiskAssessmentService riskAssessmentService, IMaturityService maturityService, IUserService userService, IRequestService requestService, UserManager<User> userManager)
        {
            _findingService = findingService;
            _riskService = riskService;
            _governanceService = governanceService;
            _riskMatrixService = riskMatrixService;
            _riskAssessmentService = riskAssessmentService;
            _maturityService = maturityService;
            _userService = userService;
            _requestService = requestService;
            _userManager = userManager;
        }

        public async Task<IActionResult> Index()
        {
            try
            {
                // Get current user info
                var currentUser = await _userManager.GetUserAsync(User);
                if (currentUser != null)
                {
                    ViewBag.CurrentUserInfo = $"Logged in as: {currentUser.Email} ({currentUser.Role})";
                }

                // Get all data for dashboard
                var allFindings = await _findingService.GetAllFindingsAsync();
                var allRisks = await _riskService.GetAllRisksAsync();
                var pendingRequests = await _requestService.GetPendingAssessmentRequestsAsync();
                
                // Get compliance metrics
                var complianceBreakdowns = await _governanceService.GetComplianceBreakdownByFrameworkAsync();
                var averageCompliance = complianceBreakdowns.Any() ? complianceBreakdowns.Average(c => c.CompliancePercentage) : 0;
                var fullyCompliantFrameworks = complianceBreakdowns.Count(c => c.CompliancePercentage >= 95);
                
                // Get comprehensive trend analysis data for charts
                var trendAnalytics = await GetDashboardTrendAnalyticsAsync(complianceBreakdowns);

                // Calculate dashboard metrics
                var filteredFindings = allFindings;
                var filteredRisks = allRisks;

                // Build view model
                var model = new DashboardViewModel
                {
                    // Basic metrics
                    OpenFindings = filteredFindings.Count(f => f.Status != FindingStatus.Closed),
                    HighRiskFindings = filteredFindings.Count(f => f.RiskRating == RiskRating.High && f.Status != FindingStatus.Closed),
                    CriticalRiskFindings = filteredFindings.Count(f => f.RiskRating == RiskRating.Critical && f.Status != FindingStatus.Closed),
                    TotalRisks = filteredRisks.Count(),
                    CriticalRisks = filteredRisks.Count(r => r.RiskLevel == RiskLevel.Critical),
                    HighRisks = filteredRisks.Count(r => r.RiskLevel == RiskLevel.High),
                    PendingRequests = pendingRequests.Count(),
                    OverdueItems = filteredFindings.Count(f => f.IsOverdue),
                    
                    // Collections for tables
                    RecentFindings = filteredFindings
                        .Where(f => f.Status != FindingStatus.Closed)
                        .OrderByDescending(f => f.CreatedAt)
                        .Take(10)
                        .ToList(),
                    
                    PendingAssessments = pendingRequests.Take(10).ToList(),
                    
                    // Compliance data
                    ComplianceBreakdowns = complianceBreakdowns.ToList(),
                    AverageCompliancePercentage = averageCompliance,
                    TotalFrameworks = complianceBreakdowns.Count(),
                    FullyCompliantFrameworks = fullyCompliantFrameworks,
                    
                    // Trend analytics
                    TrendAnalytics = trendAnalytics
                };

                return View(model);
            }
            catch (Exception ex)
            {
                // Log error and return empty model
                var emptyModel = new DashboardViewModel
                {
                    TrendAnalytics = new DashboardTrendAnalytics()
                };
                ViewBag.Error = $"Error loading dashboard data: {ex.Message}";
                return View(emptyModel);
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetExecutiveDashboardData()
        {
            try
            {
                // Core Data Gathering
                var allFindings = await _findingService.GetAllFindingsAsync();
                var allRisks = await _riskService.GetAllRisksAsync();
                var allAssessments = await _riskAssessmentService.GetAllAssessmentsAsync();
                var allMaturityAssessments = await _maturityService.GetAllAssessmentsAsync();
                var allComplianceAssessments = await _governanceService.GetAllAssessmentsAsync();

                var openFindings = allFindings.Where(f => f.Status != FindingStatus.Closed).ToList();
                var openRisks = allRisks.Where(r => r.Status == RiskStatus.Open).ToList();

                // 1. EXECUTIVE SUMMARY METRICS
                var executiveSummary = await GetExecutiveSummaryMetrics(allFindings, allRisks, allAssessments);

                // 2. RISK POSTURE ANALYSIS
                var riskPosture = GetRiskPostureAnalysis(openRisks, allRisks);

                // 3. COMPLIANCE & GOVERNANCE METRICS
                var complianceMetrics = await GetComplianceAndGovernanceMetrics(allComplianceAssessments, allFindings);

                // 4. SECURITY MATURITY INSIGHTS
                var maturityInsights = await GetSecurityMaturityInsights(allMaturityAssessments);

                // 5. THREAT & VULNERABILITY LANDSCAPE
                var threatLandscape = GetThreatAndVulnerabilityLandscape(allFindings, openRisks);

                // 6. OPERATIONAL PERFORMANCE METRICS
                var operationalMetrics = GetOperationalPerformanceMetrics(allFindings, allAssessments);

                // 7. BUSINESS UNIT RISK ANALYSIS
                var businessUnitAnalysis = GetBusinessUnitRiskAnalysis(openRisks, allFindings);


                // 9. INCIDENT & BREACH METRICS (using findings as proxy)
                var incidentMetrics = GetIncidentAndBreachMetrics(allFindings);

                // 10. INVESTMENT & ROI INDICATORS
                var investmentMetrics = GetInvestmentAndROIIndicators(allRisks, allFindings);

                // 11. TOP FINANCIAL RISKS
                var topFinancialRisks = await GetTopFinancialRisks(allRisks);

                // 12. TOP ASSETS WITH HIGH RISKS
                var topAssetsWithHighRisks = await GetTopAssetsWithRisksAboveAppetite();

                // 13. STRATEGIC INDICATORS
                var strategicIndicators = await GetStrategicRiskIndicators(allRisks, allFindings);

                var comprehensiveDashboardData = new
                {
                    lastUpdated = DateTime.UtcNow,
                    executiveSummary,
                    riskPosture,
                    complianceMetrics,
                    maturityInsights,
                    threatLandscape,
                    operationalMetrics,
                    businessUnitAnalysis,
                    incidentMetrics,
                    investmentMetrics,
                    topFinancialRisks,
                    topAssetsWithHighRisks,
                    strategicIndicators,
                    
                    // Legacy compatibility (keeping existing fields for smooth transition)
                    summary = executiveSummary,
                    riskDistribution = riskPosture?.GetType().GetProperty("riskDistribution")?.GetValue(riskPosture),
                    businessUnitMetrics = businessUnitAnalysis?.GetType().GetProperty("businessUnits")?.GetValue(businessUnitAnalysis),
                };

                return Json(comprehensiveDashboardData);
            }
            catch (Exception ex)
            {
                return Json(new { error = ex.Message });
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
                    RisksWithQualitativeScoring = risks.Count(r => GetQualitativeRiskScore(r) > 0),
                    TotalRiskScore = risks.Where(r => r.Status == RiskStatus.Open).Sum(r => GetQualitativeRiskScore(r)),
                    TotalFindings = findings.Count(),
                    OpenFindings = findings.Count(f => f.Status != FindingStatus.Closed),
                    TotalAssessments = assessments.Count(),
                    CompletedAssessments = assessments.Count(a => a.Status == AssessmentStatus.Completed),
                    QualitativeAssessments = assessments.Count(a => a.AssessmentType == AssessmentType.Qualitative),
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
            var totalRiskScore = risks.Sum(r => GetQualitativeRiskScore(r));

            // Risk status based on risk levels and ALE
            if (criticalCount > 0 || totalRiskScore >= 200) return "critical";
            if (highCount > 3 || totalRiskScore >= 100) return "warning";
            if (highCount > 0 || totalRiskScore >= 50) return "good";
            return "excellent";
        }



        private async Task<dynamic> CalculateRisksAboveAppetite()
        {
            try
            {
                // Get appetite threshold from default risk matrix
                var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
                var appetiteThreshold = defaultMatrix?.RiskAppetiteThreshold ?? 6.0m;
                var allRisks = await _riskService.GetAllRisksAsync();
                var openRisks = allRisks.Where(r => r.Status == RiskStatus.Open).ToList();

                // Calculate current risks above appetite
                var currentAboveAppetite = 0;
                foreach (var risk in openRisks)
                {
                    // FAIR ALE functionality removed
                    // Use qualitative risk level calculation for others
                    decimal riskScore = GetQualitativeRiskScore(risk);
                    AssessmentType assessmentType = AssessmentType.Qualitative; // Only qualitative supported
                    
                    if (!await _riskMatrixService.IsWithinRiskAppetiteAsync(riskScore))
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
                    var totalRiskScore = 0m;
                    var criticalCount = 0;
                    var highCount = 0;
                    
                    foreach (var risk in risks)
                    {
                        // Count risk levels
                        if (risk.RiskLevel == RiskLevel.Critical) criticalCount++;
                        if (risk.RiskLevel == RiskLevel.High) highCount++;
                        
                        // Calculate qualitative risk score
                        decimal riskScore = GetQualitativeRiskScore(risk);
                        totalRiskScore += riskScore;
                        AssessmentType assessmentType = AssessmentType.Qualitative;
                        
                        if (!await _riskMatrixService.IsWithinRiskAppetiteAsync(riskScore))
                        {
                            risksAboveAppetite++;
                        }
                    }
                    
                    topAssets.Add(new
                    {
                        asset = asset,
                        totalRisks = risks.Count,
                        risksAboveAppetite = risksAboveAppetite,
                        totalRiskScore = totalRiskScore,
                        criticalCount = criticalCount,
                        highCount = highCount,
                        businessUnit = risks.FirstOrDefault()?.BusinessUnit ?? "Unknown"
                    });
                }
                
                // Return top 10 assets with most risks above appetite
                return topAssets
                    .OrderByDescending(a => ((dynamic)a).risksAboveAppetite)
                    .ThenByDescending(a => ((dynamic)a).totalRiskScore)
                    .Take(10)
                    .ToList();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error calculating top assets with high risks: {ex.Message}");
                return new List<object>();
            }
        }

        #region Comprehensive CISO Dashboard Helper Methods

        private async Task<object> GetExecutiveSummaryMetrics(IEnumerable<Finding> allFindings, IEnumerable<Risk> allRisks, IEnumerable<RiskAssessment> allAssessments)
        {
            var openFindings = allFindings.Where(f => f.Status != FindingStatus.Closed);
            var openRisks = allRisks.Where(r => r.Status == RiskStatus.Open);
            var criticalHighFindings = openFindings.Where(f => f.RiskRating == RiskRating.Critical || f.RiskRating == RiskRating.High);
            var overdueFindings = openFindings.Where(f => f.IsOverdue);
            
            // Calculate risk velocity (risks identified in last 30 days)
            var recentRisks = openRisks.Where(r => r.OpenDate >= DateTime.Today.AddDays(-30)).Count();
            
            // Calculate mean time to resolution
            var closedFindings = allFindings.Where(f => f.Status == FindingStatus.Closed);
            var avgResolutionTime = closedFindings.Any() ? 
                closedFindings.Average(f => (f.UpdatedAt - f.CreatedAt).TotalDays) : 0;

            // Risk appetite analysis
            var risksAboveAppetite = await CalculateRisksAboveAppetite();
            
            return new
            {
                totalCriticalHighFindings = criticalHighFindings.Count(),
                totalRiskScore = await CalculateTotalQualitativeRiskScore(),
                overdueFindings = overdueFindings.Count(),
                risksAboveAppetite = risksAboveAppetite.Count,
                riskAppetiteTrend = risksAboveAppetite.Trend,
                riskVelocity = recentRisks,
                avgResolutionTimeDays = Math.Round(avgResolutionTime, 1),
                totalOpenRisks = openRisks.Count(),
                totalAssessments = allAssessments.Count(),
                assessmentCompletionRate = allAssessments.Any() ? 
                    Math.Round((decimal)allAssessments.Count(a => a.Status == AssessmentStatus.Completed) / allAssessments.Count() * 100, 1) : 0,
                securityPosture = GetOverallSecurityPosture(openRisks, criticalHighFindings)
            };
        }

        private object GetRiskPostureAnalysis(IEnumerable<Risk> openRisks, IEnumerable<Risk> allRisks)
        {
            var risksByLevel = openRisks.GroupBy(r => r.RiskLevel).ToDictionary(g => g.Key.ToString(), g => g.Count());
            var risksByTreatment = openRisks.GroupBy(r => r.Treatment).ToDictionary(g => g.Key.ToString(), g => g.Count());
            var risksByCIA = openRisks.GroupBy(r => r.CIATriad).ToDictionary(g => g.Key.ToString(), g => g.Count());

            // Risk trending (comparing current vs previous 30 days)
            var current30Days = openRisks.Where(r => r.OpenDate >= DateTime.Today.AddDays(-30));
            var previous30Days = allRisks.Where(r => r.OpenDate >= DateTime.Today.AddDays(-60) && r.OpenDate < DateTime.Today.AddDays(-30));
            
            var riskTrend = current30Days.Count() > previous30Days.Count() ? "increasing" : 
                           current30Days.Count() < previous30Days.Count() ? "decreasing" : "stable";

            return new
            {
                riskDistribution = new
                {
                    critical = risksByLevel.GetValueOrDefault("Critical", 0),
                    high = risksByLevel.GetValueOrDefault("High", 0),
                    medium = risksByLevel.GetValueOrDefault("Medium", 0),
                    low = risksByLevel.GetValueOrDefault("Low", 0)
                },
                treatmentStrategy = risksByTreatment,
                ciaImpactDistribution = risksByCIA,
                riskTrend = riskTrend,
                totalRiskScore = openRisks.Sum(r => GetQualitativeRiskScore(r)),
                avgRiskScore = openRisks.Any() ? openRisks.Average(r => (int)r.Impact * (int)r.Likelihood) : 0,
                riskDiversification = GetRiskDiversificationScore(openRisks)
            };
        }

        private async Task<object> GetComplianceAndGovernanceMetrics(IEnumerable<ComplianceAssessment> complianceAssessments, IEnumerable<Finding> allFindings)
        {
            var activeAssessments = complianceAssessments.Where(a => a.Status == AssessmentStatus.Completed);
            var complianceFindings = allFindings.Where(f => f.Domain.Contains("Compliance", StringComparison.OrdinalIgnoreCase));

            // Calculate overall compliance percentage
            var totalControls = activeAssessments.SelectMany(a => a.ControlAssessments).Count();
            var compliantControls = activeAssessments.SelectMany(a => a.ControlAssessments)
                .Count(c => c.Status == ComplianceStatus.FullyCompliant);
            
            var overallComplianceRate = totalControls > 0 ? (decimal)compliantControls / totalControls * 100 : 0;

            // Framework compliance breakdown
            var frameworkCompliance = activeAssessments.GroupBy(a => a.Framework.Name)
                .Select(g => new
                {
                    framework = g.Key,
                    complianceRate = g.SelectMany(a => a.ControlAssessments).Any() ?
                        Math.Round((decimal)g.SelectMany(a => a.ControlAssessments).Count(c => c.Status == ComplianceStatus.FullyCompliant) /
                        g.SelectMany(a => a.ControlAssessments).Count() * 100, 1) : 0,
                    totalControls = g.SelectMany(a => a.ControlAssessments).Count(),
                    gapsCount = g.SelectMany(a => a.ControlAssessments).Count(c => c.Status == ComplianceStatus.NonCompliant)
                }).ToList();

            return new
            {
                overallComplianceRate = Math.Round(overallComplianceRate, 1),
                frameworkCompliance = frameworkCompliance,
                complianceGaps = complianceFindings.Count(f => f.RiskRating == RiskRating.Critical || f.RiskRating == RiskRating.High),
                auditReadiness = GetAuditReadinessScore(activeAssessments),
                governanceEffectiveness = GetGovernanceEffectivenessScore(allFindings, complianceAssessments),
                regulatoryRiskScore = GetRegulatoryRiskScore(complianceFindings)
            };
        }

        private async Task<object> GetSecurityMaturityInsights(IEnumerable<MaturityAssessment> maturityAssessments)
        {
            var activeMaturityAssessments = maturityAssessments.Where(a => a.Status == AssessmentStatus.Completed);
            
            if (!activeMaturityAssessments.Any())
            {
                return new { 
                    overallMaturityLevel = "Not Assessed",
                    maturityScore = 0,
                    maturityTrend = "unknown",
                    domainMaturityBreakdown = new List<object>(),
                    maturityGaps = 0,
                    improvementOpportunities = new List<object>()
                };
            }

            // Calculate overall maturity score
            var allControlAssessments = activeMaturityAssessments.SelectMany(a => a.ControlAssessments);
            var avgCurrentMaturity = allControlAssessments.Any() ? 
                allControlAssessments.Average(c => (int)c.CurrentMaturityLevel) : 0;
            var avgTargetMaturity = allControlAssessments.Any() ? 
                allControlAssessments.Average(c => (int)c.TargetMaturityLevel) : 0;

            // Domain-level maturity breakdown
            var domainMaturity = allControlAssessments
                .Where(c => !string.IsNullOrEmpty(c.Control?.Function))
                .GroupBy(c => c.Control.Function)
                .Select(g => new
                {
                    domain = g.Key,
                    currentMaturity = Math.Round(g.Average(c => (int)c.CurrentMaturityLevel), 1),
                    targetMaturity = Math.Round(g.Average(c => (int)c.TargetMaturityLevel), 1),
                    gapAnalysis = Math.Round(g.Average(c => (int)c.TargetMaturityLevel - (int)c.CurrentMaturityLevel), 1),
                    controlsCount = g.Count()
                }).ToList();

            var maturityGaps = allControlAssessments.Count(c => c.CurrentMaturityLevel < c.TargetMaturityLevel);

            return new
            {
                overallMaturityLevel = GetMaturityLevelLabel(avgCurrentMaturity),
                maturityScore = Math.Round(avgCurrentMaturity / 4 * 100, 1), // Convert to percentage (assuming max level 4)
                maturityTrend = avgCurrentMaturity > 2.5 ? "improving" : avgCurrentMaturity < 2 ? "needs_attention" : "stable",
                domainMaturityBreakdown = domainMaturity,
                maturityGaps = maturityGaps,
                avgMaturityGap = Math.Round(avgTargetMaturity - avgCurrentMaturity, 1),
                improvementOpportunities = GetTopMaturityImprovementOpportunities(allControlAssessments.ToList())
            };
        }

        private object GetThreatAndVulnerabilityLandscape(IEnumerable<Finding> allFindings, IEnumerable<Risk> openRisks)
        {
            var threatCategories = openRisks
                .Where(r => !string.IsNullOrEmpty(r.ThreatScenario))
                .GroupBy(r => GetThreatCategory(r.ThreatScenario))
                .Select(g => new { category = g.Key, count = g.Count(), avgRiskScore = g.Average(r => GetQualitativeRiskScore(r)) })
                .OrderByDescending(x => x.count)
                .ToList();

            var vulnerabilityFindings = allFindings.Where(f => f.Status != FindingStatus.Closed);
            var criticalVulns = vulnerabilityFindings.Count(f => f.RiskRating == RiskRating.Critical);
            var highVulns = vulnerabilityFindings.Count(f => f.RiskRating == RiskRating.High);

            return new
            {
                threatCategories = threatCategories,
                vulnerabilityMetrics = new
                {
                    totalActiveVulnerabilities = vulnerabilityFindings.Count(),
                    criticalVulnerabilities = criticalVulns,
                    highVulnerabilities = highVulns,
                    vulnerabilityTrend = GetVulnerabilityTrend(allFindings),
                    meanTimeToRemediation = GetMeanTimeToRemediation(allFindings),
                    vulnerabilityBacklog = vulnerabilityFindings.Count(f => f.IsOverdue)
                },
                threatIntelligence = new
                {
                    emergingThreats = GetEmergingThreatCount(openRisks),
                    industrySpecificThreats = GetIndustrySpecificThreats(openRisks),
                    attackVectorAnalysis = GetAttackVectorAnalysis(openRisks)
                }
            };
        }

        private object GetOperationalPerformanceMetrics(IEnumerable<Finding> allFindings, IEnumerable<RiskAssessment> allAssessments)
        {
            var openFindings = allFindings.Where(f => f.Status != FindingStatus.Closed);
            var completedAssessments = allAssessments.Where(a => a.Status == AssessmentStatus.Completed);

            // SLA Performance
            var totalWithSLA = openFindings.Count(f => f.SlaDate.HasValue);
            var onTimeItems = openFindings.Count(f => f.SlaDate.HasValue && !f.IsOverdue);
            var slaPerformance = totalWithSLA > 0 ? (decimal)onTimeItems / totalWithSLA * 100 : 0;

            // Assessment metrics
            var assessmentMetrics = new
            {
                totalAssessments = allAssessments.Count(),
                completedAssessments = completedAssessments.Count(),
                completionRate = allAssessments.Any() ? 
                    Math.Round((decimal)completedAssessments.Count() / allAssessments.Count() * 100, 1) : 0,
                avgAssessmentDuration = GetAverageAssessmentDuration(completedAssessments),
                assessmentsThisMonth = allAssessments.Count(a => a.CreatedAt >= DateTime.Today.AddDays(-30))
            };

            return new
            {
                slaPerformance = Math.Round(slaPerformance, 1),
                assessmentMetrics = assessmentMetrics,
                operationalEfficiency = new
                {
                    findingResolutionRate = GetFindingResolutionRate(allFindings),
                    riskMitigationRate = GetRiskMitigationRate(allFindings),
                    teamProductivity = GetTeamProductivityScore(allFindings, allAssessments),
                    processMaturity = GetProcessMaturityScore(allFindings, allAssessments)
                }
            };
        }

        private object GetBusinessUnitRiskAnalysis(IEnumerable<Risk> openRisks, IEnumerable<Finding> allFindings)
        {
            var businessUnitMetrics = openRisks
                .GroupBy(r => r.BusinessUnit ?? "Unknown")
                .Select(g => new
                {
                    businessUnit = g.Key,
                    totalRisks = g.Count(),
                    criticalCount = g.Count(r => r.RiskLevel == RiskLevel.Critical),
                    highCount = g.Count(r => r.RiskLevel == RiskLevel.High),
                    mediumCount = g.Count(r => r.RiskLevel == RiskLevel.Medium),
                    lowCount = g.Count(r => r.RiskLevel == RiskLevel.Low),
                    totalRiskScore = g.Sum(r => GetQualitativeRiskScore(r)),
                    avgRiskScore = g.Average(r => (int)r.Impact * (int)r.Likelihood),
                    riskDensity = g.Count() / Math.Max(1, GetBusinessUnitSize(g.Key)), // Risks per employee (estimate)
                    status = GetBusinessUnitRiskStatus(g.ToList()),
                    riskTrend = GetBusinessUnitRiskTrend(g.Key, openRisks),
                    topRiskCategory = GetTopRiskCategory(g.ToList())
                })
                .OrderByDescending(x => x.totalRiskScore)
                .ToList();

            return new
            {
                businessUnits = businessUnitMetrics,
                riskConcentration = GetRiskConcentrationAnalysis(businessUnitMetrics),
                crossFunctionalRisks = GetCrossFunctionalRisks(openRisks),
                businessImpactAssessment = GetBusinessImpactAssessment(businessUnitMetrics)
            };
        }


        private object GetIncidentAndBreachMetrics(IEnumerable<Finding> allFindings)
        {
            // Using findings as proxy for incidents
            var criticalFindings = allFindings.Where(f => f.RiskRating == RiskRating.Critical);
            var recentCriticalFindings = criticalFindings.Where(f => f.CreatedAt >= DateTime.Today.AddDays(-30));
            
            return new
            {
                totalCriticalIncidents = criticalFindings.Count(),
                recentCriticalIncidents = recentCriticalFindings.Count(),
                incidentTrend = recentCriticalFindings.Count() > criticalFindings.Count() / 12 ? "increasing" : "stable",
                avgIncidentResolutionTime = GetAverageIncidentResolutionTime(criticalFindings),
                breachRiskIndicators = new
                {
                    highRiskExposures = criticalFindings.Count(f => f.Details.ToLower().Contains("data") || 
                                                                  f.Details.ToLower().Contains("breach") ||
                                                                  f.Details.ToLower().Contains("exposure")),
                    dataRelatedRisks = criticalFindings.Count(f => f.Details.ToLower().Contains("data") || 
                                                                f.Details.ToLower().Contains("personal") ||
                                                                f.Details.ToLower().Contains("customer")),
                    complianceBreaches = criticalFindings.Count(f => f.Domain.Contains("Compliance", StringComparison.OrdinalIgnoreCase))
                },
                incidentResponseReadiness = GetIncidentResponseReadiness(allFindings)
            };
        }

        private object GetInvestmentAndROIIndicators(IEnumerable<Risk> allRisks, IEnumerable<Finding> allFindings)
        {
            var totalRiskScore = allRisks.Where(r => r.Status == RiskStatus.Open).Sum(r => GetQualitativeRiskScore(r));
            var mitigatedRisks = allRisks.Where(r => r.Status == RiskStatus.Closed);
            var totalRiskMitigated = mitigatedRisks.Sum(r => GetQualitativeRiskScore(r));
            
            return new
            {
                totalRiskScore = totalRiskScore,
                mitigatedRiskValue = totalRiskMitigated,
                riskMitigationEffectiveness = mitigatedRisks.Any() ? Math.Round(totalRiskMitigated / Math.Max(1, totalRiskScore) * 100, 1) : 0,
                investmentPriorities = new[]
                {
                    new { category = "Security Awareness Training", estimatedCost = 50000, priority = "High" },
                    new { category = "Endpoint Detection & Response", estimatedCost = 150000, priority = "High" },
                    new { category = "Identity & Access Management", estimatedCost = 100000, priority = "Medium" },
                    new { category = "Network Segmentation", estimatedCost = 200000, priority = "Medium" },
                    new { category = "Backup & Recovery Enhancement", estimatedCost = 75000, priority = "Low" }
                }
            };
        }

        private async Task<List<object>> GetTopFinancialRisks(IEnumerable<Risk> allRisks)
        {
            var openRisks = allRisks.Where(r => r.Status == RiskStatus.Open);
            
            return openRisks
                .OrderByDescending(r => GetQualitativeRiskScore(r))
                .Take(10)
                .Select(r => new
                {
                    riskDescription = r.Title ?? r.Description ?? "Unknown Risk",
                    asset = r.Asset ?? "Unknown Asset",
                    riskScore = GetQualitativeRiskScore(r),
                    status = r.Status.ToString()
                })
                .ToList<object>();
        }

        private async Task<object> GetStrategicRiskIndicators(IEnumerable<Risk> allRisks, IEnumerable<Finding> allFindings)
        {
            var openRisks = allRisks.Where(r => r.Status == RiskStatus.Open).ToList();
            
            return new
            {
                strategicMetrics = new
                {
                    riskConcentrationIndex = GetRiskConcentrationIndex(openRisks),
                    reputationalRiskScore = GetReputationalRiskScore(openRisks, allFindings),
                    businessContinuityRisks = GetBusinessContinuityRisks(openRisks),
                    regulatoryRiskExposure = GetRegulatoryRiskExposure(openRisks)
                }
            };
        }

        #region Helper Method Implementations

        private string GetOverallSecurityPosture(IEnumerable<Risk> openRisks, IEnumerable<Finding> criticalHighFindings)
        {
            var criticalRisks = openRisks.Count(r => r.RiskLevel == RiskLevel.Critical);
            var totalFindings = criticalHighFindings.Count();
            
            if (criticalRisks > 5 || totalFindings > 20) return "Critical";
            if (criticalRisks > 2 || totalFindings > 10) return "High Risk";
            if (criticalRisks > 0 || totalFindings > 5) return "Moderate Risk";
            return "Low Risk";
        }

        private double GetRiskDiversificationScore(IEnumerable<Risk> risks)
        {
            var categoryGroups = risks.GroupBy(r => GetThreatCategory(r.ThreatScenario ?? "")).Count();
            return categoryGroups > 5 ? 0.8 : categoryGroups > 3 ? 0.6 : categoryGroups > 1 ? 0.4 : 0.2;
        }

        private string GetThreatCategory(string threatScenario)
        {
            var scenario = threatScenario.ToLower();
            if (scenario.Contains("malware") || scenario.Contains("ransomware")) return "Malware";
            if (scenario.Contains("phishing") || scenario.Contains("social")) return "Social Engineering";
            if (scenario.Contains("breach") || scenario.Contains("unauthorized")) return "Data Breach";
            if (scenario.Contains("insider") || scenario.Contains("employee")) return "Insider Threat";
            if (scenario.Contains("ddos") || scenario.Contains("attack")) return "Cyber Attack";
            return "Other";
        }

        private double GetAuditReadinessScore(IEnumerable<ComplianceAssessment> assessments)
        {
            var totalControls = assessments.SelectMany(a => a.ControlAssessments).Count();
            var compliantControls = assessments.SelectMany(a => a.ControlAssessments)
                .Count(c => c.Status == ComplianceStatus.FullyCompliant || c.Status == ComplianceStatus.MajorlyCompliant);
            return totalControls > 0 ? Math.Round((double)compliantControls / totalControls, 2) : 0;
        }

        private double GetGovernanceEffectivenessScore(IEnumerable<Finding> findings, IEnumerable<ComplianceAssessment> assessments)
        {
            var recentFindings = findings.Where(f => f.CreatedAt >= DateTime.Today.AddDays(-90)).Count();
            var totalAssessments = assessments.Count();
            
            // Simple scoring: fewer recent findings + more assessments = better governance
            var baseScore = Math.Max(0, 1 - (recentFindings / Math.Max(1, totalAssessments * 10.0)));
            return Math.Round(baseScore, 2);
        }

        private double GetRegulatoryRiskScore(IEnumerable<Finding> complianceFindings)
        {
            var criticalCompliance = complianceFindings.Count(f => f.RiskRating == RiskRating.Critical);
            var highCompliance = complianceFindings.Count(f => f.RiskRating == RiskRating.High);
            
            // Higher score means higher regulatory risk
            return Math.Min(1.0, (criticalCompliance * 0.3 + highCompliance * 0.1));
        }

        private string GetMaturityLevelLabel(double avgMaturity)
        {
            if (avgMaturity >= 3.5) return "Advanced";
            if (avgMaturity >= 2.5) return "Intermediate";
            if (avgMaturity >= 1.5) return "Basic";
            return "Initial";
        }

        private List<object> GetTopMaturityImprovementOpportunities(List<MaturityControlAssessment> controlAssessments)
        {
            return controlAssessments
                .Where(c => c.TargetMaturityLevel > c.CurrentMaturityLevel)
                .OrderByDescending(c => (int)c.TargetMaturityLevel - (int)c.CurrentMaturityLevel)
                .Take(5)
                .Select(c => new
                {
                    control = c.Control?.Title ?? "Unknown Control",
                    currentLevel = c.CurrentMaturityLevel.ToString(),
                    targetLevel = c.TargetMaturityLevel.ToString(),
                    gap = (int)c.TargetMaturityLevel - (int)c.CurrentMaturityLevel,
                    domain = c.Control?.Function ?? "Unknown"
                }).ToList<object>();
        }

        private int GetBusinessUnitSize(string businessUnit)
        {
            // This would ideally come from HR system - using estimates for now
            var sizeMap = new Dictionary<string, int>
            {
                { "IT Department", 50 },
                { "Operations", 100 },
                { "Finance", 25 },
                { "HR", 15 },
                { "Sales", 75 },
                { "Marketing", 30 }
            };
            return sizeMap.GetValueOrDefault(businessUnit, 50);
        }

        private string GetVulnerabilityTrend(IEnumerable<Finding> findings)
        {
            var last30Days = findings.Count(f => f.CreatedAt >= DateTime.Today.AddDays(-30));
            var previous30Days = findings.Count(f => f.CreatedAt >= DateTime.Today.AddDays(-60) && f.CreatedAt < DateTime.Today.AddDays(-30));
            
            return last30Days > previous30Days ? "increasing" : last30Days < previous30Days ? "decreasing" : "stable";
        }

        private double GetMeanTimeToRemediation(IEnumerable<Finding> findings)
        {
            var closedFindings = findings.Where(f => f.Status == FindingStatus.Closed);
            return closedFindings.Any() ? closedFindings.Average(f => (f.UpdatedAt - f.CreatedAt).TotalDays) : 0;
        }

        private int GetEmergingThreatCount(IEnumerable<Risk> risks)
        {
            return risks.Count(r => r.OpenDate >= DateTime.Today.AddDays(-60) && 
                                  (r.RiskLevel == RiskLevel.Critical || r.RiskLevel == RiskLevel.High));
        }

        private List<string> GetIndustrySpecificThreats(IEnumerable<Risk> risks)
        {
            // This would be customized based on industry
            return new List<string> { "Financial Fraud", "Data Breach", "Ransomware", "Supply Chain Attack" };
        }

        private object GetAttackVectorAnalysis(IEnumerable<Risk> risks)
        {
            return risks.GroupBy(r => GetThreatCategory(r.ThreatScenario ?? ""))
                       .ToDictionary(g => g.Key, g => g.Count());
        }

        private double GetAverageAssessmentDuration(IEnumerable<RiskAssessment> assessments)
        {
            var completedAssessments = assessments.Where(a => a.DateCompleted.HasValue);
            return completedAssessments.Any() ? 
                completedAssessments.Average(a => (a.DateCompleted.Value - a.CreatedAt).TotalDays) : 0;
        }

        private double GetFindingResolutionRate(IEnumerable<Finding> findings)
        {
            var total = findings.Count();
            var closed = findings.Count(f => f.Status == FindingStatus.Closed);
            return total > 0 ? Math.Round((double)closed / total * 100, 1) : 0;
        }

        private double GetRiskMitigationRate(IEnumerable<Finding> findings)
        {
            // Using findings closure as proxy for risk mitigation
            return GetFindingResolutionRate(findings);
        }

        private double GetTeamProductivityScore(IEnumerable<Finding> findings, IEnumerable<RiskAssessment> assessments)
        {
            var recentFindings = findings.Count(f => f.CreatedAt >= DateTime.Today.AddDays(-30));
            var recentAssessments = assessments.Count(a => a.CreatedAt >= DateTime.Today.AddDays(-30));
            
            // Higher score for more activity (simple metric)
            return Math.Min(1.0, (recentFindings + recentAssessments) / 20.0);
        }

        private double GetProcessMaturityScore(IEnumerable<Finding> findings, IEnumerable<RiskAssessment> assessments)
        {
            var avgResolutionTime = GetMeanTimeToRemediation(findings);
            var assessmentCompletionRate = assessments.Any() ? 
                (double)assessments.Count(a => a.Status == AssessmentStatus.Completed) / assessments.Count() : 0;
            
            // Combine metrics for overall process maturity
            var timeScore = avgResolutionTime > 0 ? Math.Max(0, 1 - (avgResolutionTime / 90)) : 0.5;
            return Math.Round((timeScore + assessmentCompletionRate) / 2, 2);
        }

        private string GetBusinessUnitRiskTrend(string businessUnit, IEnumerable<Risk> allRisks)
        {
            var unitRisks = allRisks.Where(r => r.BusinessUnit == businessUnit);
            var recent = unitRisks.Count(r => r.OpenDate >= DateTime.Today.AddDays(-30));
            var previous = unitRisks.Count(r => r.OpenDate >= DateTime.Today.AddDays(-60) && r.OpenDate < DateTime.Today.AddDays(-30));
            
            return recent > previous ? "increasing" : recent < previous ? "decreasing" : "stable";
        }

        private string GetTopRiskCategory(List<Risk> risks)
        {
            return risks.GroupBy(r => GetThreatCategory(r.ThreatScenario ?? ""))
                       .OrderByDescending(g => g.Count())
                       .FirstOrDefault()?.Key ?? "Unknown";
        }

        private object GetRiskConcentrationAnalysis(object businessUnitMetrics)
        {
            // Simplified analysis - in reality would do more sophisticated concentration risk calculation
            return new { concentrationRisk = "Moderate", diversificationScore = 0.7 };
        }

        private List<object> GetCrossFunctionalRisks(IEnumerable<Risk> risks)
        {
            return risks.Where(r => r.Description?.ToLower().Contains("cross") == true ||
                               r.Description?.ToLower().Contains("multiple") == true)
                       .Take(5)
                       .Select(r => new { title = r.Title, impactedUnits = "Multiple", riskLevel = r.RiskLevel.ToString() })
                       .ToList<object>();
        }

        private object GetBusinessImpactAssessment(object businessUnitMetrics)
        {
            return new { overallImpactScore = 0.65, criticalBusinessFunctions = 3, recoveryTimeObjective = "4 hours" };
        }

        private double GetRiskConcentrationIndex(IEnumerable<Risk> risks)
        {
            // Herfindahl-Hirschman Index for risk concentration
            var businessUnitRisks = risks.GroupBy(r => r.BusinessUnit ?? "Unknown")
                                         .Select(g => (double)g.Count() / risks.Count())
                                         .ToList();
            
            return businessUnitRisks.Sum(share => share * share);
        }

        private object GetSystemicRiskIndicators(IEnumerable<Risk> risks)
        {
            var interconnectedRisks = risks.Count(r => r.Description?.ToLower().Contains("system") == true ||
                                                      r.Description?.ToLower().Contains("network") == true);
            
            return new
            {
                interconnectedRisks = interconnectedRisks,
                cascadingRiskPotential = interconnectedRisks > 5 ? "High" : interconnectedRisks > 2 ? "Medium" : "Low",
                systemDependencyRisk = risks.Count(r => r.Asset?.ToLower().Contains("critical") == true)
            };
        }

        private object GetBusinessContinuityRisks(IEnumerable<Risk> risks)
        {
            var continuityRisks = risks.Where(r => r.CIATriad == CIATriad.Availability ||
                                                  r.Description?.ToLower().Contains("availability") == true ||
                                                  r.Description?.ToLower().Contains("downtime") == true);
            
            return new
            {
                totalContinuityRisks = continuityRisks.Count(),
                criticalServiceRisks = continuityRisks.Count(r => r.RiskLevel == RiskLevel.Critical),
                estimatedDowntimeRisk = continuityRisks.Sum(r => GetQualitativeRiskScore(r)),
                recoveryRiskScore = continuityRisks.Any() ? "Needs Assessment" : "Low"
            };
        }

        private double GetReputationalRiskScore(IEnumerable<Risk> risks, IEnumerable<Finding> findings)
        {
            var reputationKeywords = new[] { "breach", "exposure", "leak", "public", "media", "customer" };
            var reputationalRisks = risks.Count(r => reputationKeywords.Any(k => 
                (r.Description?.ToLower().Contains(k) == true) || 
                (r.ThreatScenario?.ToLower().Contains(k) == true)));
            
            return Math.Min(1.0, reputationalRisks / Math.Max(1.0, risks.Count()) * 5);
        }

        private decimal GetRegulatoryRiskExposure(IEnumerable<Risk> risks)
        {
            var regulatoryRisks = risks.Where(r => r.Description?.ToLower().Contains("gdpr") == true ||
                                                  r.Description?.ToLower().Contains("hipaa") == true ||
                                                  r.Description?.ToLower().Contains("sox") == true ||
                                                  r.Description?.ToLower().Contains("compliance") == true);
            
            return regulatoryRisks.Sum(r => GetQualitativeRiskScore(r));
        }

        private async Task<object> GetRiskAppetiteAlignment(IEnumerable<Risk> risks)
        {
            var risksAboveAppetite = await CalculateRisksAboveAppetite();
            var totalRisks = risks.Count();
            
            return new
            {
                alignmentScore = totalRisks > 0 ? Math.Round((1 - (double)risksAboveAppetite.Count / totalRisks) * 100, 1) : 100,
                risksAboveAppetite = risksAboveAppetite.Count,
                appetiteBreaches = risksAboveAppetite.Count,
                recommendedActions = risksAboveAppetite.Count > 0 ? "Immediate Risk Review Required" : "Within Appetite"
            };
        }

        private double GetAverageIncidentResolutionTime(IEnumerable<Finding> incidents)
        {
            var resolvedIncidents = incidents.Where(i => i.Status == FindingStatus.Closed);
            return resolvedIncidents.Any() ? 
                resolvedIncidents.Average(i => (i.UpdatedAt - i.CreatedAt).TotalHours) : 0;
        }

        private async Task<decimal> CalculateTotalQualitativeRiskScore()
        {
            try
            {
                var openRisks = await _riskService.GetAllRisksAsync();
                var activeRisks = openRisks.Where(r => r.Status == RiskStatus.Open);
                
                return activeRisks.Sum(risk => GetQualitativeRiskScore(risk));
            }
            catch
            {
                return 0;
            }
        }

        private decimal GetQualitativeRiskScore(Risk risk)
        {
            // Calculate qualitative risk score based on Impact × Likelihood × Exposure
            var impactScore = (int)risk.Impact;
            var likelihoodScore = (int)risk.Likelihood;  
            var exposureScore = (int)risk.Exposure;
            
            // Qualitative risk score: Impact × Likelihood × Exposure (max = 4×4×4 = 64 per risk)
            return impactScore * likelihoodScore * exposureScore;
        }

        private double GetIncidentResponseReadiness(IEnumerable<Finding> findings)
        {
            var criticalFindings = findings.Where(f => f.RiskRating == RiskRating.Critical);
            var avgResponseTime = GetAverageIncidentResolutionTime(criticalFindings);
            
            // Lower response time = higher readiness (inverse relationship)
            return avgResponseTime > 0 ? Math.Max(0, 1 - (avgResponseTime / (24 * 7))) : 0.5; // 7 days as baseline
        }


        #endregion

        #endregion

        // DASHBOARD TREND ANALYTICS METHODS
        // ========================================

        private async Task<DashboardTrendAnalytics> GetDashboardTrendAnalyticsAsync(IEnumerable<ComplianceBreakdown> complianceBreakdowns)
        {
            try
            {
                var analytics = new DashboardTrendAnalytics();
                
                // Get findings trend data (last 12 months)
                var findingsTrend = await GetFindingsTrendDataAsync(12);
                analytics.FindingsTrendLabels = string.Join(",", findingsTrend.Select(t => $"\"{t.Date:MMM yyyy}\""));
                analytics.FindingsTrendData = string.Join(",", findingsTrend.Select(t => t.Count.ToString()));
                
                // Get risks trend data
                var risksTrend = await GetRisksTrendDataAsync(12);
                analytics.RisksTrendLabels = string.Join(",", risksTrend.Select(t => $"\"{t.Date:MMM yyyy}\""));
                analytics.RisksTrendData = string.Join(",", risksTrend.Select(t => t.Count.ToString()));
                
                // Get compliance trend data (aggregate all frameworks)
                if (complianceBreakdowns.Any())
                {
                    var complianceTrend = await GetAggregateComplianceTrendAsync(complianceBreakdowns.Select(c => c.FrameworkId).ToList());
                    analytics.ComplianceTrendLabels = string.Join(",", complianceTrend.Select(t => $"\"{t.Date:MMM yyyy}\""));
                    analytics.ComplianceTrendData = string.Join(",", complianceTrend.Select(t => t.AverageCompliance.ToString("F1")));
                }
                
                // Get SLA performance trend
                var slaTrend = await GetSLAPerformanceTrendAsync(12);
                analytics.SLATrendLabels = string.Join(",", slaTrend.Select(t => $"\"{t.Date:MMM yyyy}\""));
                analytics.SLATrendData = string.Join(",", slaTrend.Select(t => t.OnTimePercentage.ToString("F1")));
                
                // Calculate executive KPIs
                analytics.ExecutiveKPIs = new DashboardExecutiveKPIs
                {
                    RiskTrend = CalculateTrendDirection(risksTrend.Select(t => (decimal)t.Count).ToList()),
                    FindingsTrend = CalculateTrendDirection(findingsTrend.Select(t => (decimal)t.Count).ToList()),
                    ComplianceTrend = analytics.ComplianceTrendData.Any() ? "Stable" : "No Data",
                    SLAPerformanceTrend = CalculateTrendDirection(slaTrend.Select(t => t.OnTimePercentage).ToList()),
                    OverallHealthScore = CalculateOverallHealthScore(complianceBreakdowns, findingsTrend, risksTrend, slaTrend)
                };
                
                // Risk heat map data
                analytics.RiskHeatMapData = await GetRiskHeatMapDataAsync();
                
                return analytics;
            }
            catch
            {
                return new DashboardTrendAnalytics(); // Return empty analytics on error
            }
        }

        private async Task<List<TrendDataPoint>> GetFindingsTrendDataAsync(int months)
        {
            var findings = await _findingService.GetAllFindingsAsync();
            var startDate = DateTime.UtcNow.AddMonths(-months);
            
            return findings
                .Where(f => f.CreatedAt >= startDate)
                .GroupBy(f => new { f.CreatedAt.Year, f.CreatedAt.Month })
                .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
                .Select(g => new TrendDataPoint
                {
                    Date = new DateTime(g.Key.Year, g.Key.Month, 1),
                    Count = g.Count()
                }).ToList();
        }

        private async Task<List<TrendDataPoint>> GetRisksTrendDataAsync(int months)
        {
            var risks = await _riskService.GetAllRisksAsync();
            var startDate = DateTime.UtcNow.AddMonths(-months);
            
            return risks
                .Where(r => r.CreatedAt >= startDate)
                .GroupBy(r => new { r.CreatedAt.Year, r.CreatedAt.Month })
                .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
                .Select(g => new TrendDataPoint
                {
                    Date = new DateTime(g.Key.Year, g.Key.Month, 1),
                    Count = g.Count()
                }).ToList();
        }

        private async Task<List<ComplianceTrendDataPoint>> GetAggregateComplianceTrendAsync(List<int> frameworkIds)
        {
            var trendPoints = new List<ComplianceTrendDataPoint>();
            
            foreach (var frameworkId in frameworkIds.Take(5)) // Limit to top 5 frameworks for performance
            {
                try
                {
                    var frameworkTrend = await _governanceService.GetComplianceTrendDataAsync(frameworkId, 12);
                    
                    // Aggregate by month
                    foreach (var point in frameworkTrend)
                    {
                        var existing = trendPoints.FirstOrDefault(t => t.Date.Year == point.Date.Year && t.Date.Month == point.Date.Month);
                        if (existing != null)
                        {
                            existing.TotalCompliance += point.CompliancePercentage;
                            existing.FrameworkCount++;
                            existing.AverageCompliance = existing.TotalCompliance / existing.FrameworkCount;
                        }
                        else
                        {
                            trendPoints.Add(new ComplianceTrendDataPoint
                            {
                                Date = new DateTime(point.Date.Year, point.Date.Month, 1),
                                TotalCompliance = point.CompliancePercentage,
                                FrameworkCount = 1,
                                AverageCompliance = point.CompliancePercentage
                            });
                        }
                    }
                }
                catch
                {
                    // Skip framework if error occurs
                    continue;
                }
            }
            
            return trendPoints.OrderBy(t => t.Date).ToList();
        }

        private async Task<List<SLATrendDataPoint>> GetSLAPerformanceTrendAsync(int months)
        {
            // This would integrate with RiskBacklogService for SLA data
            // For now, return simulated data based on findings and risks
            var findings = await _findingService.GetAllFindingsAsync();
            var startDate = DateTime.UtcNow.AddMonths(-months);
            
            return Enumerable.Range(0, months)
                .Select(i => 
                {
                    var monthDate = DateTime.UtcNow.AddMonths(-months + i);
                    var monthFindings = findings.Where(f => f.CreatedAt.Year == monthDate.Year && f.CreatedAt.Month == monthDate.Month);
                    var onTimeCount = monthFindings.Count(f => !f.IsOverdue);
                    var totalCount = monthFindings.Count();
                    
                    return new SLATrendDataPoint
                    {
                        Date = new DateTime(monthDate.Year, monthDate.Month, 1),
                        OnTimePercentage = totalCount > 0 ? (decimal)onTimeCount / totalCount * 100 : 100,
                        TotalItems = totalCount,
                        OnTimeItems = onTimeCount
                    };
                })
                .OrderBy(t => t.Date)
                .ToList();
        }

        private string CalculateTrendDirection(List<decimal> values)
        {
            if (values.Count < 2) return "Stable";
            
            var first = values.Take(values.Count / 2).Average();
            var second = values.Skip(values.Count / 2).Average();
            var change = ((second - first) / first) * 100;
            
            if (change > 10) return "Increasing";
            if (change < -10) return "Decreasing";
            return "Stable";
        }

        private decimal CalculateOverallHealthScore(IEnumerable<ComplianceBreakdown> compliance, 
                                                   List<TrendDataPoint> findings, 
                                                   List<TrendDataPoint> risks, 
                                                   List<SLATrendDataPoint> sla)
        {
            var complianceScore = compliance.Any() ? compliance.Average(c => c.CompliancePercentage) : 50;
            var findingsScore = 100 - Math.Min(100, findings.LastOrDefault()?.Count ?? 0);
            var risksScore = 100 - Math.Min(100, (risks.LastOrDefault()?.Count ?? 0) * 2);
            var slaScore = sla.LastOrDefault()?.OnTimePercentage ?? 80;
            
            return (complianceScore * 0.4m) + (findingsScore * 0.2m) + (risksScore * 0.2m) + (slaScore * 0.2m);
        }

        private async Task<RiskHeatMapData> GetRiskHeatMapDataAsync()
        {
            var allFindings = await _findingService.GetAllFindingsAsync();
            
            return new RiskHeatMapData
            {
                CriticalFindings = allFindings.Count(f => f.RiskRating == RiskRating.Critical),
                HighFindings = allFindings.Count(f => f.RiskRating == RiskRating.High),
                MediumFindings = allFindings.Count(f => f.RiskRating == RiskRating.Medium),
                LowFindings = allFindings.Count(f => f.RiskRating == RiskRating.Low),
                // Domain distribution
                DomainDistribution = allFindings
                    .Where(f => !string.IsNullOrEmpty(f.Domain))
                    .GroupBy(f => f.Domain)
                    .ToDictionary(g => g.Key, g => g.Count())
            };
        }
    }
}