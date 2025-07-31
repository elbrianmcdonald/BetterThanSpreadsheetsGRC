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
        private readonly UserManager<User> _userManager;

        public DashboardController(
            IFindingService findingService,
            IRiskService riskService,
            IRequestService requestService,
            UserManager<User> userManager)
        {
            _findingService = findingService;
            _riskService = riskService;
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

                // Get basic dashboard data
                var allFindings = await _findingService.GetAllFindingsAsync();
                var allRisks = await _riskService.GetAllRisksAsync();
                var pendingRequests = await _requestService.GetPendingAssessmentRequestsAsync();

                var model = new DashboardViewModel
                {
                    TotalRisks = allRisks.Count(),
                    TotalALE = await _riskService.GetTotalALEAsync(),
                    OpenFindings = (await _findingService.GetOpenFindingsAsync()).Count(),
                    HighRiskFindings = allFindings.Count(f => f.RiskRating == RiskRating.High),
                    PendingRequests = pendingRequests.Count(),
                    OverdueItems = allFindings.Count(f => f.IsOverdue),
                    RecentFindings = allFindings.OrderByDescending(f => f.CreatedAt).Take(5),
                    HighValueRisks = (await _riskService.GetHighValueRisksAsync()).Take(5),
                    PendingAssessments = pendingRequests.Take(5)
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
                    PendingRequests = 0,
                    OverdueItems = 0,
                    RecentFindings = new List<Finding>(),
                    HighValueRisks = new List<Risk>(),
                    PendingAssessments = new List<AssessmentRequest>()
                };

                return View(emptyModel);
            }
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
                    totalALE = await _riskService.GetTotalALEAsync(),
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