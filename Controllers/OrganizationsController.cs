using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.ViewModels;
using CyberRiskApp.Authorization;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
    public class OrganizationsController : Controller
    {
        private readonly IGovernanceService _governanceService;

        public OrganizationsController(IGovernanceService governanceService)
        {
            _governanceService = governanceService;
        }

        // GET: Organizations
        public async Task<IActionResult> Index()
        {
            var model = new OrganizationManagementViewModel
            {
                Organizations = (await _governanceService.GetAllOrganizationsAsync()).ToList()
            };

            return View(model);
        }

        // GET: Organizations/Details/5
        public async Task<IActionResult> Details(int id)
        {
            var organization = await _governanceService.GetOrganizationByIdAsync(id);
            if (organization == null)
                return NotFound();

            return View(organization);
        }

        // GET: Organizations/Create
        public IActionResult Create()
        {
            return View();
        }

        // POST: Organizations/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(BusinessOrganization organization)
        {
            if (ModelState.IsValid)
            {
                await _governanceService.CreateOrganizationAsync(organization);
                TempData["Success"] = "Organization created successfully.";
                return RedirectToAction(nameof(Index));
            }

            return View(organization);
        }

        // GET: Organizations/Edit/5
        public async Task<IActionResult> Edit(int id)
        {
            var organization = await _governanceService.GetOrganizationByIdAsync(id);
            if (organization == null)
                return NotFound();

            return View(organization);
        }

        // POST: Organizations/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, BusinessOrganization organization)
        {
            if (id != organization.Id)
                return NotFound();

            if (ModelState.IsValid)
            {
                await _governanceService.UpdateOrganizationAsync(organization);
                TempData["Success"] = "Organization updated successfully.";
                return RedirectToAction(nameof(Index));
            }

            return View(organization);
        }

        // POST: Organizations/Delete/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(int id)
        {
            var success = await _governanceService.DeleteOrganizationAsync(id);
            if (success)
            {
                TempData["Success"] = "Organization deleted successfully.";
            }
            else
            {
                TempData["Error"] = "Error deleting organization.";
            }

            return RedirectToAction(nameof(Index));
        }
    }
}