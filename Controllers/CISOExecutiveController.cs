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

        public CISOExecutiveController(IFindingService findingService, IRiskService riskService, IGovernanceService governanceService, IRiskLevelSettingsService riskLevelSettingsService)
        {
            _findingService = findingService;
            _riskService = riskService;
            _governanceService = governanceService;
            _riskLevelSettingsService = riskLevelSettingsService;
        }

        public IActionResult Index()
        {
            return View();
        }

        [HttpGet]
        public async Task<IActionResult> GetExecutiveDashboardData(string assessmentType = "", int assessmentId = 0)
        {
            try
            {
                // Get all findings and risks
                var allFindings = await _findingService.GetAllFindingsAsync();
                var allRisks = await _riskService.GetAllRisksAsync();
                var openFindings = allFindings.Where(f => f.Status != FindingStatus.Closed).ToList();
                var overdueFindings = openFindings.Where(f => f.IsOverdue).ToList();
                var criticalHighFindings = openFindings.Where(f =>
                    f.RiskRating == RiskRating.Critical || f.RiskRating == RiskRating.High).ToList();

                // Group findings by business unit for the heatmap
                var businessUnitMetrics = openFindings
                    .GroupBy(f => f.BusinessUnit)
                    .Select(g => new
                    {
                        BusinessUnit = g.Key,
                        TotalFindings = g.Count(),
                        CriticalCount = g.Count(f => f.RiskRating == RiskRating.Critical),
                        HighCount = g.Count(f => f.RiskRating == RiskRating.High),
                        OverdueCount = g.Count(f => f.IsOverdue),
                        Status = GetBusinessUnitStatus(g.ToList())
                    })
                    .ToList();

                // Get top critical issues
                var topCriticalIssues = openFindings
                    .Where(f => f.RiskRating == RiskRating.Critical || f.IsOverdue)
                    .OrderByDescending(f => f.RiskRating)
                    .ThenByDescending(f => f.IsOverdue ? (DateTime.Today - f.SlaDate.Value).Days : 0)
                    .Take(5)
                    .Select(f => new
                    {
                        Issue = f.Title,
                        BusinessUnit = f.BusinessUnit,
                        RiskLevel = f.RiskRating.ToString(),
                        DaysOverdue = f.IsOverdue ? (DateTime.Today - f.SlaDate.Value).Days : 0
                    })
                    .ToList();

                // Get top financial risks
                var topFinancialRisks = allRisks
                    .Where(r => r.Status == RiskStatus.Open)
                    .OrderByDescending(r => r.ALE)
                    .Take(5)
                    .Select(r => new
                    {
                        RiskDescription = r.Title ?? "Risk Assessment",
                        Asset = r.Asset ?? "Not specified",
                        ALE = r.ALE,
                        Status = r.Status.ToString()
                    })
                    .ToList();

                // Calculate SLA performance
                var totalWithSLA = openFindings.Count(f => f.SlaDate.HasValue);
                var onTimeItems = openFindings.Count(f => f.SlaDate.HasValue && !f.IsOverdue);
                var slaPerformance = totalWithSLA > 0 ? (decimal)onTimeItems / totalWithSLA * 100 : 0;

                // Calculate compliance percentage based on selected assessment
                var compliancePercentage = await CalculateCompliancePercentage(assessmentId);

                // Calculate risks above appetite
                var risksAboveAppetite = await CalculateRisksAboveAppetite();

                var dashboardData = new
                {
                    Summary = new
                    {
                        TotalCriticalHigh = criticalHighFindings.Count,
                        TotalALE = await _riskService.GetTotalALEAsync(),
                        SLAPerformance = Math.Round(slaPerformance, 1),
                        CompliancePercentage = compliancePercentage,
                        OverdueCount = overdueFindings.Count,
                        RiskExposure = await _riskService.GetTotalALEAsync(),
                        RisksAboveAppetite = risksAboveAppetite.Count,
                        RiskAppetiteTrend = risksAboveAppetite.Trend
                    },
                    RiskDistribution = new
                    {
                        Critical = openFindings.Count(f => f.RiskRating == RiskRating.Critical),
                        High = openFindings.Count(f => f.RiskRating == RiskRating.High),
                        Medium = openFindings.Count(f => f.RiskRating == RiskRating.Medium),
                        Low = openFindings.Count(f => f.RiskRating == RiskRating.Low)
                    },
                    BusinessUnitMetrics = businessUnitMetrics,
                    TopCriticalIssues = topCriticalIssues,
                    TopFinancialRisks = topFinancialRisks,
                    TrendData = await GetTrendData(),
                    SelectedAssessment = assessmentId > 0 ? assessmentId.ToString() : assessmentType
                };

                return Json(dashboardData);
            }
            catch (Exception ex)
            {
                return Json(new { error = ex.Message });
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

        private async Task<decimal> CalculateCompliancePercentage(int assessmentId)
        {
            if (assessmentId <= 0)
            {
                return 0;
            }

            try
            {
                var assessment = await _governanceService.GetAssessmentByIdAsync(assessmentId);
                if (assessment == null)
                {
                    return 0;
                }

                return Math.Round(assessment.CompliancePercentage, 1);
            }
            catch
            {
                return 0;
            }
        }

        private async Task<object> GetTrendData()
        {
            return new
            {
                Labels = new string[0],
                Critical = new int[0],
                High = new int[0],
                Medium = new int[0],
                ALE = new decimal[0]
            };
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
    }
}