using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CyberRiskApp.Data;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.Authorization;
using System.Text.Json;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireGRCOrAdminRole)]
    public class ThreatEventController : Controller
    {
        private readonly CyberRiskContext _context;
        private readonly IMitreAttackService _mitreService;
        private readonly ILogger<ThreatEventController> _logger;

        public ThreatEventController(
            CyberRiskContext context,
            IMitreAttackService mitreService,
            ILogger<ThreatEventController> logger)
        {
            _context = context;
            _mitreService = mitreService;
            _logger = logger;
        }

        // GET: ThreatEvent
        public async Task<IActionResult> Index()
        {
            var threatEvents = await _context.ThreatEvents
                .Include(te => te.MitreTechnique)
                .OrderByDescending(te => te.CreatedAt)
                .ToListAsync();

            return View(threatEvents);
        }

        // GET: ThreatEvent/Details/5
        public async Task<IActionResult> Details(int? id)
        {
            if (id == null) return NotFound();

            var threatEvent = await _context.ThreatEvents
                .Include(te => te.MitreTechnique)
                .Include(te => te.NextVulnerability)
                .FirstOrDefaultAsync(te => te.Id == id);

            if (threatEvent == null) return NotFound();

            return View(threatEvent);
        }

        // GET: ThreatEvent/Create
        public async Task<IActionResult> Create()
        {
            await PrepareViewData();
            return View();
        }

        // POST: ThreatEvent/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(ThreatEvent threatEvent)
        {
            if (ModelState.IsValid)
            {
                // Auto-calculate TEF Most Likely using triangular distribution
                threatEvent.TefMostLikely = CalculateTriangularMostLikely(
                    threatEvent.TefMinimum, 
                    threatEvent.TefMaximum);

                threatEvent.CreatedBy = User.Identity?.Name ?? "Unknown";
                threatEvent.UpdatedBy = User.Identity?.Name ?? "Unknown";
                threatEvent.CreatedAt = DateTime.UtcNow;
                threatEvent.UpdatedAt = DateTime.UtcNow;

                _context.ThreatEvents.Add(threatEvent);
                await _context.SaveChangesAsync();

                TempData["Success"] = "Threat event created successfully.";
                return RedirectToAction(nameof(Details), new { id = threatEvent.Id });
            }

            await PrepareViewData();
            return View(threatEvent);
        }

        // GET: ThreatEvent/Edit/5
        public async Task<IActionResult> Edit(int? id)
        {
            if (id == null) return NotFound();

            var threatEvent = await _context.ThreatEvents.FindAsync(id);
            if (threatEvent == null) return NotFound();

            await PrepareViewData();
            return View(threatEvent);
        }

        // POST: ThreatEvent/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, ThreatEvent threatEvent)
        {
            if (id != threatEvent.Id) return NotFound();

            if (ModelState.IsValid)
            {
                try
                {
                    // Recalculate TEF Most Likely
                    threatEvent.TefMostLikely = CalculateTriangularMostLikely(
                        threatEvent.TefMinimum, 
                        threatEvent.TefMaximum);

                    threatEvent.UpdatedBy = User.Identity?.Name ?? "Unknown";
                    threatEvent.UpdatedAt = DateTime.UtcNow;

                    _context.Update(threatEvent);
                    await _context.SaveChangesAsync();

                    TempData["Success"] = "Threat event updated successfully.";
                    return RedirectToAction(nameof(Details), new { id = threatEvent.Id });
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!ThreatEventExists(threatEvent.Id))
                        return NotFound();
                    throw;
                }
            }

            await PrepareViewData();
            return View(threatEvent);
        }

        // GET: ThreatEvent/Delete/5
        public async Task<IActionResult> Delete(int? id)
        {
            if (id == null) return NotFound();

            var threatEvent = await _context.ThreatEvents
                .Include(te => te.MitreTechnique)
                .FirstOrDefaultAsync(te => te.Id == id);

            if (threatEvent == null) return NotFound();

            return View(threatEvent);
        }

        // POST: ThreatEvent/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            var threatEvent = await _context.ThreatEvents.FindAsync(id);
            if (threatEvent != null)
            {
                _context.ThreatEvents.Remove(threatEvent);
                await _context.SaveChangesAsync();
                TempData["Success"] = "Threat event deleted successfully.";
            }

            return RedirectToAction(nameof(Index));
        }

        // API endpoints for smart comboboxes
        [HttpGet]
        public async Task<JsonResult> GetControlsForCategory(string category)
        {
            try
            {
                var controls = await _context.ReferenceDataEntries
                    .Where(rd => rd.Category == Enum.Parse<ReferenceDataCategory>(category))
                    .Select(rd => new { value = rd.Value, text = rd.Value, description = rd.Description })
                    .ToListAsync();

                return Json(new { results = controls });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting controls for category {Category}", category);
                return Json(new { results = new object[0] });
            }
        }

        [HttpGet]
        public async Task<JsonResult> GetDataSources()
        {
            try
            {
                var dataSources = await _mitreService.GetDataSourcesAsync();
                var results = dataSources.Select(ds => new { value = ds, text = ds }).ToList();
                return Json(new { results });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting data sources");
                return Json(new { results = new object[0] });
            }
        }

        // Helper methods
        private async Task PrepareViewData()
        {
            var mitreTechniques = await _mitreService.GetTechniquesAsync();
            ViewData["MitreTechniques"] = mitreTechniques
                .Select(mt => new { mt.Id, Text = $"{mt.TechniqueId} - {mt.Name}" })
                .ToList();

            ViewData["Vulnerabilities"] = await _context.AttackStepVulnerabilities
                .Select(v => new { v.Id, v.Title })
                .ToListAsync();
        }

        private bool ThreatEventExists(int id)
        {
            return _context.ThreatEvents.Any(te => te.Id == id);
        }

        private double CalculateTriangularMostLikely(double min, double max)
        {
            // For a triangular distribution, most likely is typically the midpoint
            // unless other information suggests otherwise
            return (min + max) / 2.0;
        }
    }
}