using CyberRiskApp.Services;
using CyberRiskApp.ViewModels;
using CyberRiskApp.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Authorization;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireAnyRole)]
    public class DashboardController : Controller
    {
        private readonly IFindingService _findingService;
        private readonly IRiskService _riskService;
        private readonly IRequestService _requestService;
        private readonly IGovernanceService _governanceService;
        private readonly UserManager<User> _userManager;

        public DashboardController(
            IFindingService findingService,
            IRiskService riskService,
            IRequestService requestService,
            IGovernanceService governanceService,
            UserManager<User> userManager)
        {
            _findingService = findingService;
            _riskService = riskService;
            _requestService = requestService;
            _governanceService = governanceService;
            _userManager = userManager;
        }

        public async Task<IActionResult> Index(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? businessUnit = null,
            string? domain = null,
            string? asset = null,
            string? assignedTo = null,
            RiskRating? minRiskRating = null,
            RiskLevel? minRiskLevel = null,
            FindingStatus? findingStatus = null,
            RiskStatus? riskStatus = null,
            bool showOverdueOnly = false,
            bool showCriticalOnly = false)
        {
            try
            {
                // Get current user info
                var currentUser = await _userManager.GetUserAsync(User);
                if (currentUser != null)
                {
                    ViewBag.CurrentUserInfo = $"Logged in as: {currentUser.Email} ({currentUser.Role})";
                }

                // Create filters object
                var filters = new DashboardFilters
                {
                    StartDate = startDate,
                    EndDate = endDate,
                    BusinessUnit = businessUnit,
                    Domain = domain,
                    Asset = asset,
                    AssignedTo = assignedTo,
                    MinRiskRating = minRiskRating,
                    MinRiskLevel = minRiskLevel,
                    FindingStatus = findingStatus,
                    RiskStatus = riskStatus,
                    ShowOverdueOnly = showOverdueOnly,
                    ShowCriticalOnly = showCriticalOnly
                };

                // Get all data (unfiltered for comparison)
                var allFindings = await _findingService.GetAllFindingsAsync();
                var allRisks = await _riskService.GetAllRisksAsync();
                var pendingRequests = await _requestService.GetPendingAssessmentRequestsAsync();
                
                // Get compliance metrics
                var complianceBreakdowns = await _governanceService.GetComplianceBreakdownByFrameworkAsync();
                var averageCompliance = complianceBreakdowns.Any() ? complianceBreakdowns.Average(c => c.CompliancePercentage) : 0;
                var fullyCompliantFrameworks = complianceBreakdowns.Count(c => c.CompliancePercentage >= 95);
                
                // Get comprehensive trend analysis data for charts
                var trendAnalytics = await GetDashboardTrendAnalyticsAsync(complianceBreakdowns);

                // Apply filters
                var filteredFindings = ApplyFindingFilters(allFindings, filters);
                var filteredRisks = ApplyRiskFilters(allRisks, filters);

                // Get filter options for dropdowns
                var availableBusinessUnits = allFindings.Select(f => f.BusinessUnit)
                    .Concat(allRisks.Select(r => r.BusinessUnit))
                    .Where(bu => !string.IsNullOrEmpty(bu))
                    .Distinct()
                    .OrderBy(bu => bu)
                    .ToList();

                var availableDomains = allFindings.Select(f => f.Domain)
                    .Where(d => !string.IsNullOrEmpty(d))
                    .Distinct()
                    .OrderBy(d => d)
                    .ToList();

                var availableAssets = allFindings.Select(f => f.Asset)
                    .Concat(allRisks.Select(r => r.Asset))
                    .Where(a => !string.IsNullOrEmpty(a))
                    .Distinct()
                    .OrderBy(a => a)
                    .ToList();

                var availableAssignees = allFindings.Select(f => f.AssignedTo)
                    .Concat(allRisks.Select(r => r.Owner))
                    .Where(a => !string.IsNullOrEmpty(a))
                    .Distinct()
                    .OrderBy(a => a)
                    .ToList();

                var model = new DashboardViewModel
                {
                    Filters = filters,
                    TotalRisks = filteredRisks.Count(),
                    TotalALE = 0, // ALE functionality removed - using qualitative risk assessment
                    OpenFindings = filteredFindings.Count(f => f.Status == FindingStatus.Open),
                    HighRiskFindings = filteredFindings.Count(f => f.RiskRating == RiskRating.High),
                    CriticalRiskFindings = filteredFindings.Count(f => f.RiskRating == RiskRating.Critical),
                    HighRisks = filteredRisks.Count(r => r.RiskLevel == RiskLevel.High),
                    CriticalRisks = filteredRisks.Count(r => r.RiskLevel == RiskLevel.Critical),
                    PendingRequests = pendingRequests.Count(), // Requests not filtered by date for now
                    OverdueItems = filteredFindings.Count(f => f.IsOverdue),
                    RecentFindings = filteredFindings.OrderByDescending(f => f.CreatedAt).Take(5),
                    HighValueRisks = (await _riskService.GetHighValueRisksAsync()).Take(5), // TODO: Apply filtering
                    PendingAssessments = pendingRequests.Take(5),
                    
                    // Filter options
                    AvailableBusinessUnits = availableBusinessUnits,
                    AvailableDomains = availableDomains,
                    AvailableAssets = availableAssets,
                    AvailableAssignees = availableAssignees,
                    
                    // Comparison data
                    Comparison = new DashboardComparison
                    {
                        FilteredFindings = filteredFindings.Count(),
                        TotalFindings = allFindings.Count(),
                        FilteredRisks = filteredRisks.Count(),
                        TotalRisks = allRisks.Count(),
                        FilteredALE = 0,
                        TotalALE = 0
                    },
                    
                    // Compliance data
                    ComplianceBreakdowns = complianceBreakdowns.ToList(),
                    AverageCompliancePercentage = averageCompliance,
                    TotalFrameworks = complianceBreakdowns.Count(),
                    FullyCompliantFrameworks = fullyCompliantFrameworks,
                    
                    // Trend analytics data
                    TrendAnalytics = trendAnalytics
                };

                return View(model);
            }
            catch (Exception ex)
            {
                // If there's any error, return a simple dashboard
                ViewBag.Error = "Error loading dashboard data: " + ex.Message;

                var emptyModel = new DashboardViewModel
                {
                    TotalRisks = 0,
                    TotalALE = 0,
                    OpenFindings = 0,
                    HighRiskFindings = 0,
                    CriticalRiskFindings = 0,
                    HighRisks = 0,
                    CriticalRisks = 0,
                    PendingRequests = 0,
                    OverdueItems = 0,
                    RecentFindings = new List<Finding>(),
                    HighValueRisks = new List<Risk>(),
                    PendingAssessments = new List<AssessmentRequest>()
                };

                return View(emptyModel);
            }
        }

        private IEnumerable<Finding> ApplyFindingFilters(IEnumerable<Finding> findings, DashboardFilters filters)
        {
            var result = findings.AsQueryable();

            if (filters.StartDate.HasValue)
                result = result.Where(f => f.CreatedAt >= filters.StartDate.Value);

            if (filters.EndDate.HasValue)
                result = result.Where(f => f.CreatedAt <= filters.EndDate.Value.AddDays(1));

            if (!string.IsNullOrEmpty(filters.BusinessUnit))
                result = result.Where(f => f.BusinessUnit == filters.BusinessUnit);

            if (!string.IsNullOrEmpty(filters.Domain))
                result = result.Where(f => f.Domain == filters.Domain);

            if (!string.IsNullOrEmpty(filters.Asset))
                result = result.Where(f => f.Asset == filters.Asset);

            if (!string.IsNullOrEmpty(filters.AssignedTo))
                result = result.Where(f => f.AssignedTo == filters.AssignedTo);

            if (filters.MinRiskRating.HasValue)
                result = result.Where(f => f.RiskRating >= filters.MinRiskRating.Value);

            if (filters.FindingStatus.HasValue)
                result = result.Where(f => f.Status == filters.FindingStatus.Value);

            if (filters.ShowOverdueOnly)
                result = result.Where(f => f.IsOverdue);

            if (filters.ShowCriticalOnly)
                result = result.Where(f => f.RiskRating == RiskRating.Critical);

            return result.ToList();
        }

        private IEnumerable<Risk> ApplyRiskFilters(IEnumerable<Risk> risks, DashboardFilters filters)
        {
            var result = risks.AsQueryable();

            if (filters.StartDate.HasValue)
                result = result.Where(r => r.CreatedAt >= filters.StartDate.Value);

            if (filters.EndDate.HasValue)
                result = result.Where(r => r.CreatedAt <= filters.EndDate.Value.AddDays(1));

            if (!string.IsNullOrEmpty(filters.BusinessUnit))
                result = result.Where(r => r.BusinessUnit == filters.BusinessUnit);

            // Note: Risk model doesn't have Domain property, skip domain filtering for risks

            if (!string.IsNullOrEmpty(filters.Asset))
                result = result.Where(r => r.Asset == filters.Asset);

            if (!string.IsNullOrEmpty(filters.AssignedTo))
                result = result.Where(r => r.Owner == filters.AssignedTo);

            if (filters.MinRiskLevel.HasValue)
                result = result.Where(r => r.RiskLevel >= filters.MinRiskLevel.Value);

            if (filters.RiskStatus.HasValue)
                result = result.Where(r => r.Status == filters.RiskStatus.Value);

            if (filters.ShowCriticalOnly)
                result = result.Where(r => r.RiskLevel == RiskLevel.Critical);

            return result.ToList();
        }

        // ========================================
        // TREND ANALYTICS METHODS
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

        // NEW: System Health page for administrators
        [Authorize(Policy = PolicyConstants.RequireAdminRole)]
        public async Task<IActionResult> SystemHealth()
        {
            try
            {
                // Get system health information
                var allFindings = await _findingService.GetAllFindingsAsync();
                var allRisks = await _riskService.GetAllRisksAsync();
                var pendingRequests = await _requestService.GetPendingAssessmentRequestsAsync();
                var totalUsers = _userManager.Users.Count();

                var systemHealth = new
                {
                    TotalUsers = totalUsers,
                    TotalFindings = allFindings.Count(),
                    TotalRisks = allRisks.Count(),
                    PendingRequests = pendingRequests.Count(),
                    DatabaseStatus = "Connected",
                    LastDataRefresh = DateTime.Now,
                    SystemVersion = "1.0.0",
                    Environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development"
                };

                ViewBag.SystemHealth = systemHealth;
                return View();
            }
            catch (Exception ex)
            {
                ViewBag.Error = $"Error loading system health: {ex.Message}";
                return View();
            }
        }

        // Simple API endpoint for dashboard data
        [HttpGet]
        public async Task<IActionResult> GetDashboardData()
        {
            try
            {
                var allFindings = await _findingService.GetAllFindingsAsync();
                var allRisks = await _riskService.GetAllRisksAsync();

                var data = new
                {
                    totalFindings = allFindings.Count(),
                    openFindings = allFindings.Count(f => f.Status == FindingStatus.Open),
                    highRiskFindings = allFindings.Count(f => f.RiskRating == RiskRating.High),
                    totalRisks = allRisks.Count(),
                    totalALE = 0, // ALE functionality removed - using qualitative risk assessment
                    pendingRequests = (await _requestService.GetPendingAssessmentRequestsAsync()).Count()
                };

                return Json(data);
            }
            catch (Exception ex)
            {
                return Json(new { error = ex.Message });
            }
        }
    }
}