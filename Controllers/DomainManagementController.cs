using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Services;
using CyberRiskApp.Models;
using CyberRiskApp.Authorization;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireAdminRole)]
    public class DomainManagementController : Controller
    {
        private readonly IDomainService _domainService;
        private readonly ILogger<DomainManagementController> _logger;

        public DomainManagementController(IDomainService domainService, ILogger<DomainManagementController> logger)
        {
            _domainService = domainService;
            _logger = logger;
        }

        // GET: DomainManagement
        public async Task<IActionResult> Index()
        {
            try
            {
                var dashboardData = await _domainService.GetDomainDashboardDataAsync();
                return View(dashboardData);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading domain management dashboard");
                TempData["Error"] = "Error loading domain dashboard: " + ex.Message;
                return View(new Dictionary<string, object>());
            }
        }

        // GET: DomainManagement/Domains
        public async Task<IActionResult> Domains()
        {
            try
            {
                var domains = await _domainService.GetAllDomainsAsync();
                return View(domains);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading domains");
                TempData["Error"] = "Error loading domains: " + ex.Message;
                return View(new List<ApplicationDomain>());
            }
        }

        // GET: DomainManagement/Create
        public IActionResult Create()
        {
            var domain = new ApplicationDomain
            {
                HttpPort = 80,
                HttpsPort = 443,
                EnableHSTS = false,
                HSTSMaxAge = 31536000,
                CreatedBy = User.Identity?.Name ?? "Unknown"
            };
            return View(domain);
        }

        // POST: DomainManagement/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(ApplicationDomain domain)
        {
            try
            {
                if (ModelState.IsValid)
                {
                    domain.CreatedBy = User.Identity?.Name ?? "Unknown";
                    
                    // Validate domain configuration
                    if (!await _domainService.ValidateDomainConfigurationAsync(domain))
                    {
                        ModelState.AddModelError("DomainName", "Domain name already exists or conflicts with existing aliases.");
                        return View(domain);
                    }

                    await _domainService.CreateDomainAsync(domain);
                    TempData["Success"] = $"Application domain '{domain.DomainName}' created successfully.";
                    return RedirectToAction(nameof(Domains));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating domain: {DomainName}", domain.DomainName);
                TempData["Error"] = "Error creating domain: " + ex.Message;
            }

            return View(domain);
        }

        // GET: DomainManagement/Edit/5
        public async Task<IActionResult> Edit(int id)
        {
            var domain = await _domainService.GetDomainByIdAsync(id);
            if (domain == null)
            {
                TempData["Error"] = "Domain not found.";
                return RedirectToAction(nameof(Domains));
            }

            return View(domain);
        }

        // POST: DomainManagement/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, ApplicationDomain domain)
        {
            if (id != domain.Id)
            {
                TempData["Error"] = "Domain ID mismatch.";
                return RedirectToAction(nameof(Domains));
            }

            try
            {
                if (ModelState.IsValid)
                {
                    domain.UpdatedBy = User.Identity?.Name ?? "Unknown";
                    
                    // Validate domain configuration
                    if (!await _domainService.ValidateDomainConfigurationAsync(domain))
                    {
                        ModelState.AddModelError("DomainName", "Domain name already exists or conflicts with existing aliases.");
                        return View(domain);
                    }

                    await _domainService.UpdateDomainAsync(domain);
                    TempData["Success"] = $"Application domain '{domain.DomainName}' updated successfully.";
                    return RedirectToAction(nameof(Domains));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating domain: {DomainName}", domain.DomainName);
                TempData["Error"] = "Error updating domain: " + ex.Message;
            }

            return View(domain);
        }

        // GET: DomainManagement/Details/5
        public async Task<IActionResult> Details(int id)
        {
            var domain = await _domainService.GetDomainByIdAsync(id);
            if (domain == null)
            {
                TempData["Error"] = "Domain not found.";
                return RedirectToAction(nameof(Domains));
            }

            ViewBag.Aliases = await _domainService.GetDomainAliasesAsync(id);
            return View(domain);
        }

        // POST: DomainManagement/Delete/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var domain = await _domainService.GetDomainByIdAsync(id);
                if (domain == null)
                {
                    TempData["Error"] = "Domain not found.";
                    return RedirectToAction(nameof(Domains));
                }

                var success = await _domainService.DeleteDomainAsync(id);
                if (success)
                {
                    TempData["Success"] = $"Application domain '{domain.DomainName}' deleted successfully.";
                }
                else
                {
                    TempData["Error"] = "Cannot delete domain. It may be the primary domain or have dependencies.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting domain with ID: {DomainId}", id);
                TempData["Error"] = "Error deleting domain: " + ex.Message;
            }

            return RedirectToAction(nameof(Domains));
        }

        // POST: DomainManagement/SetPrimary/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SetPrimary(int id)
        {
            try
            {
                var success = await _domainService.SetPrimaryDomainAsync(id);
                if (success)
                {
                    TempData["Success"] = "Primary domain updated successfully.";
                }
                else
                {
                    TempData["Error"] = "Failed to set primary domain.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting primary domain: {DomainId}", id);
                TempData["Error"] = "Error setting primary domain: " + ex.Message;
            }

            return RedirectToAction(nameof(Domains));
        }

        // GET: DomainManagement/Aliases/5
        public async Task<IActionResult> Aliases(int domainId)
        {
            var domain = await _domainService.GetDomainByIdAsync(domainId);
            if (domain == null)
            {
                TempData["Error"] = "Domain not found.";
                return RedirectToAction(nameof(Domains));
            }

            ViewBag.Domain = domain;
            var aliases = await _domainService.GetDomainAliasesAsync(domainId);
            return View(aliases);
        }

        // GET: DomainManagement/CreateAlias/5
        public async Task<IActionResult> CreateAlias(int domainId)
        {
            var domain = await _domainService.GetDomainByIdAsync(domainId);
            if (domain == null)
            {
                TempData["Error"] = "Domain not found.";
                return RedirectToAction(nameof(Domains));
            }

            ViewBag.Domain = domain;
            var alias = new DomainAlias
            {
                ApplicationDomainId = domainId,
                RedirectType = RedirectType.Permanent,
                CreatedBy = User.Identity?.Name ?? "Unknown"
            };
            return View(alias);
        }

        // POST: DomainManagement/CreateAlias
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateAlias(DomainAlias alias)
        {
            try
            {
                if (ModelState.IsValid)
                {
                    alias.CreatedBy = User.Identity?.Name ?? "Unknown";
                    await _domainService.CreateAliasAsync(alias);
                    TempData["Success"] = $"Domain alias '{alias.AliasName}' created successfully.";
                    return RedirectToAction(nameof(Aliases), new { domainId = alias.ApplicationDomainId });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating alias: {AliasName}", alias.AliasName);
                TempData["Error"] = "Error creating alias: " + ex.Message;
            }

            var domain = await _domainService.GetDomainByIdAsync(alias.ApplicationDomainId);
            ViewBag.Domain = domain;
            return View(alias);
        }

        // GET: DomainManagement/Analytics
        public async Task<IActionResult> Analytics()
        {
            try
            {
                var stats = await _domainService.GetDomainStatisticsAsync();
                return View(stats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading domain analytics");
                TempData["Error"] = "Error loading analytics: " + ex.Message;
                return View(new DomainStatistics());
            }
        }

        // GET: DomainManagement/AccessLogs
        public async Task<IActionResult> AccessLogs(DateTime? startDate = null, DateTime? endDate = null, string? domain = null)
        {
            try
            {
                var logs = await _domainService.GetAccessLogsAsync(startDate, endDate, domain, 100);
                ViewBag.StartDate = startDate;
                ViewBag.EndDate = endDate;
                ViewBag.Domain = domain;
                return View(logs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading access logs");
                TempData["Error"] = "Error loading access logs: " + ex.Message;
                return View(new List<DomainAccessLog>());
            }
        }

        // GET: DomainManagement/Health
        [HttpGet]
        public async Task<IActionResult> Health()
        {
            try
            {
                var isHealthy = await _domainService.CheckDomainHealthAsync();
                return Json(new { 
                    healthy = isHealthy, 
                    message = isHealthy ? "Domain configuration is healthy" : "Domain configuration needs attention" 
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking domain health");
                return Json(new { healthy = false, message = "Error checking domain health" });
            }
        }
    }
}