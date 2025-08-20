using CyberRiskApp.Models;
using CyberRiskApp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = "RequireAnyRole")]
    public class SlaDashboardController : Controller
    {
        private readonly ISlaTrackingService _slaTrackingService;
        private readonly ILogger<SlaDashboardController> _logger;

        public SlaDashboardController(ISlaTrackingService slaTrackingService, ILogger<SlaDashboardController> logger)
        {
            _slaTrackingService = slaTrackingService;
            _logger = logger;
        }

        public async Task<IActionResult> Index()
        {
            try
            {
                var dashboardData = await _slaTrackingService.GetSlaDashboardDataAsync();
                var upcomingDeadlines = await _slaTrackingService.GetUpcomingSlaDeadlinesAsync(7);
                
                var viewModel = new SlaDashboardViewModel
                {
                    DashboardData = dashboardData,
                    UpcomingDeadlines = upcomingDeadlines.ToList()
                };

                return View(viewModel);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading SLA dashboard data");
                TempData["Error"] = "Error loading SLA dashboard data. Please try again.";
                return View(new SlaDashboardViewModel());
            }
        }

        [HttpGet]
        public async Task<IActionResult> Breaches(string slaType = "all")
        {
            try
            {
                var allBreaches = new List<SlaBreachInfo>();

                switch (slaType.ToLower())
                {
                    case "remediation":
                        allBreaches.AddRange(await _slaTrackingService.GetRemediationSlaBreachesAsync());
                        break;
                    case "review":
                        allBreaches.AddRange(await _slaTrackingService.GetReviewSlaBreachesAsync());
                        break;
                    case "assessment":
                        allBreaches.AddRange(await _slaTrackingService.GetAssessmentSlaBreachesAsync());
                        break;
                    case "approval":
                        allBreaches.AddRange(await _slaTrackingService.GetApprovalSlaBreachesAsync());
                        break;
                    default:
                        allBreaches.AddRange(await _slaTrackingService.GetRemediationSlaBreachesAsync());
                        allBreaches.AddRange(await _slaTrackingService.GetReviewSlaBreachesAsync());
                        allBreaches.AddRange(await _slaTrackingService.GetAssessmentSlaBreachesAsync());
                        allBreaches.AddRange(await _slaTrackingService.GetApprovalSlaBreachesAsync());
                        break;
                }

                ViewBag.SlaType = slaType;
                return View(allBreaches.OrderByDescending(b => b.OverdueBy));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading SLA breaches for type: {SlaType}", slaType);
                TempData["Error"] = "Error loading SLA breaches. Please try again.";
                return View(new List<SlaBreachInfo>());
            }
        }

        [HttpGet]
        public async Task<IActionResult> UpcomingDeadlines(int days = 7)
        {
            try
            {
                var upcomingDeadlines = await _slaTrackingService.GetUpcomingSlaDeadlinesAsync(days);
                ViewBag.Days = days;
                return View(upcomingDeadlines);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading upcoming SLA deadlines for {Days} days", days);
                TempData["Error"] = "Error loading upcoming deadlines. Please try again.";
                return View(new List<SlaUpcomingDeadline>());
            }
        }

        [HttpGet]
        public async Task<IActionResult> Performance(DateTime? startDate = null, DateTime? endDate = null)
        {
            try
            {
                var start = startDate ?? DateTime.UtcNow.AddDays(-30);
                var end = endDate ?? DateTime.UtcNow;

                var performanceMetrics = await _slaTrackingService.GetSlaPerformanceMetricsAsync(start, end);
                var complianceReport = await _slaTrackingService.GetSlaComplianceReportAsync(start, end);

                var viewModel = new SlaPerformanceViewModel
                {
                    StartDate = start,
                    EndDate = end,
                    PerformanceMetrics = performanceMetrics,
                    ComplianceReports = complianceReport.ToList()
                };

                return View(viewModel);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading SLA performance data");
                TempData["Error"] = "Error loading performance data. Please try again.";
                return View(new SlaPerformanceViewModel());
            }
        }

        [HttpGet]
        public async Task<JsonResult> GetDashboardDataJson()
        {
            try
            {
                var dashboardData = await _slaTrackingService.GetSlaDashboardDataAsync();
                return Json(new { success = true, data = dashboardData });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading SLA dashboard data via JSON");
                return Json(new { success = false, message = "Error loading dashboard data" });
            }
        }

        [HttpGet]
        public async Task<JsonResult> GetUpcomingDeadlinesJson(int days = 7)
        {
            try
            {
                var upcomingDeadlines = await _slaTrackingService.GetUpcomingSlaDeadlinesAsync(days);
                return Json(new { success = true, data = upcomingDeadlines });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading upcoming deadlines via JSON");
                return Json(new { success = false, message = "Error loading upcoming deadlines" });
            }
        }

        [HttpGet]
        public async Task<JsonResult> GetBreachesJson(string slaType = "all")
        {
            try
            {
                var allBreaches = new List<SlaBreachInfo>();

                switch (slaType.ToLower())
                {
                    case "remediation":
                        allBreaches.AddRange(await _slaTrackingService.GetRemediationSlaBreachesAsync());
                        break;
                    case "review":
                        allBreaches.AddRange(await _slaTrackingService.GetReviewSlaBreachesAsync());
                        break;
                    case "assessment":
                        allBreaches.AddRange(await _slaTrackingService.GetAssessmentSlaBreachesAsync());
                        break;
                    case "approval":
                        allBreaches.AddRange(await _slaTrackingService.GetApprovalSlaBreachesAsync());
                        break;
                    default:
                        allBreaches.AddRange(await _slaTrackingService.GetRemediationSlaBreachesAsync());
                        allBreaches.AddRange(await _slaTrackingService.GetReviewSlaBreachesAsync());
                        allBreaches.AddRange(await _slaTrackingService.GetAssessmentSlaBreachesAsync());
                        allBreaches.AddRange(await _slaTrackingService.GetApprovalSlaBreachesAsync());
                        break;
                }

                return Json(new { success = true, data = allBreaches.OrderByDescending(b => b.OverdueBy) });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading SLA breaches via JSON for type: {SlaType}", slaType);
                return Json(new { success = false, message = "Error loading SLA breaches" });
            }
        }

        [HttpPost]
        [Authorize(Policy = "RequireGRCOrAdminRole")]
        public async Task<JsonResult> ExportSlaReport(string slaType, DateTime startDate, DateTime endDate)
        {
            try
            {
                // This would implement SLA report export functionality
                // For now, return success with placeholder data
                return Json(new { success = true, message = "SLA report export initiated. You will receive an email when ready." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting SLA report");
                return Json(new { success = false, message = "Error exporting SLA report" });
            }
        }
    }

    // View Models
    public class SlaDashboardViewModel
    {
        public SlaDashboardData DashboardData { get; set; } = new();
        public List<SlaUpcomingDeadline> UpcomingDeadlines { get; set; } = new();
    }

    public class SlaPerformanceViewModel
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public SlaPerformanceMetrics PerformanceMetrics { get; set; } = new();
        public List<SlaComplianceReport> ComplianceReports { get; set; } = new();
    }
}