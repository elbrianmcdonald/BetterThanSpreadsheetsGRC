using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CyberRiskApp.Data;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.Authorization;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireGRCAnalystOrAbove)]
    public class LossEventController : Controller
    {
        private readonly CyberRiskContext _context;
        private readonly IMitreAttackService _mitreService;
        private readonly ILogger<LossEventController> _logger;

        public LossEventController(
            CyberRiskContext context,
            IMitreAttackService mitreService,
            ILogger<LossEventController> logger)
        {
            _context = context;
            _mitreService = mitreService;
            _logger = logger;
        }

        // GET: LossEvent
        public async Task<IActionResult> Index()
        {
            var lossEvents = await _context.LossEvents
                .Include(le => le.MitreTechnique)
                .OrderByDescending(le => le.AleMostLikely)
                .ThenByDescending(le => le.CreatedAt)
                .ToListAsync();

            return View(lossEvents);
        }

        // GET: LossEvent/Details/5
        public async Task<IActionResult> Details(int? id)
        {
            if (id == null) return NotFound();

            var lossEvent = await _context.LossEvents
                .Include(le => le.MitreTechnique)
                .Include(le => le.AttackStepVulnerabilities)
                .Include(le => le.AttackChains)
                .FirstOrDefaultAsync(le => le.Id == id);

            if (lossEvent == null) return NotFound();

            return View(lossEvent);
        }

        // GET: LossEvent/Create
        public async Task<IActionResult> Create()
        {
            await PrepareViewData();
            return View();
        }

        // POST: LossEvent/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(LossEvent lossEvent)
        {
            if (ModelState.IsValid)
            {
                // Auto-calculate Most Likely values for loss amounts if provided
                if (lossEvent.PrimaryLossMinimum.HasValue && lossEvent.PrimaryLossMaximum.HasValue)
                {
                    lossEvent.PrimaryLossMostLikely = CalculateTriangularMostLikely(
                        lossEvent.PrimaryLossMinimum.Value, 
                        lossEvent.PrimaryLossMaximum.Value);
                }

                if (lossEvent.SecondaryLossMinimum.HasValue && lossEvent.SecondaryLossMaximum.HasValue)
                {
                    lossEvent.SecondaryLossMostLikely = CalculateTriangularMostLikely(
                        lossEvent.SecondaryLossMinimum.Value, 
                        lossEvent.SecondaryLossMaximum.Value);
                }

                lossEvent.CreatedBy = User.Identity?.Name ?? "Unknown";
                lossEvent.UpdatedBy = User.Identity?.Name ?? "Unknown";
                lossEvent.CreatedAt = DateTime.UtcNow;
                lossEvent.UpdatedAt = DateTime.UtcNow;

                _context.LossEvents.Add(lossEvent);
                await _context.SaveChangesAsync();

                TempData["Success"] = "Loss event created successfully.";
                return RedirectToAction(nameof(Details), new { id = lossEvent.Id });
            }

            await PrepareViewData();
            return View(lossEvent);
        }

        // GET: LossEvent/Edit/5
        public async Task<IActionResult> Edit(int? id)
        {
            if (id == null) return NotFound();

            var lossEvent = await _context.LossEvents.FindAsync(id);
            if (lossEvent == null) return NotFound();

            await PrepareViewData();
            return View(lossEvent);
        }

        // POST: LossEvent/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, LossEvent lossEvent)
        {
            if (id != lossEvent.Id) return NotFound();

            if (ModelState.IsValid)
            {
                try
                {
                    // Recalculate Most Likely values
                    if (lossEvent.PrimaryLossMinimum.HasValue && lossEvent.PrimaryLossMaximum.HasValue)
                    {
                        lossEvent.PrimaryLossMostLikely = CalculateTriangularMostLikely(
                            lossEvent.PrimaryLossMinimum.Value, 
                            lossEvent.PrimaryLossMaximum.Value);
                    }

                    if (lossEvent.SecondaryLossMinimum.HasValue && lossEvent.SecondaryLossMaximum.HasValue)
                    {
                        lossEvent.SecondaryLossMostLikely = CalculateTriangularMostLikely(
                            lossEvent.SecondaryLossMinimum.Value, 
                            lossEvent.SecondaryLossMaximum.Value);
                    }

                    lossEvent.UpdatedBy = User.Identity?.Name ?? "Unknown";
                    lossEvent.UpdatedAt = DateTime.UtcNow;

                    _context.Update(lossEvent);
                    await _context.SaveChangesAsync();

                    TempData["Success"] = "Loss event updated successfully.";
                    return RedirectToAction(nameof(Details), new { id = lossEvent.Id });
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!LossEventExists(lossEvent.Id))
                        return NotFound();
                    throw;
                }
            }

            await PrepareViewData();
            return View(lossEvent);
        }

        // GET: LossEvent/Delete/5
        public async Task<IActionResult> Delete(int? id)
        {
            if (id == null) return NotFound();

            var lossEvent = await _context.LossEvents
                .Include(le => le.MitreTechnique)
                .FirstOrDefaultAsync(le => le.Id == id);

            if (lossEvent == null) return NotFound();

            return View(lossEvent);
        }

        // POST: LossEvent/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            var lossEvent = await _context.LossEvents.FindAsync(id);
            if (lossEvent != null)
            {
                _context.LossEvents.Remove(lossEvent);
                await _context.SaveChangesAsync();
                TempData["Success"] = "Loss event deleted successfully.";
            }

            return RedirectToAction(nameof(Index));
        }

        // POST: LossEvent/RecalculateALE/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> RecalculateALE(int id)
        {
            var lossEvent = await _context.LossEvents
                .Include(le => le.AttackChains)
                    .ThenInclude(ac => ac.ThreatEvent)
                .Include(le => le.AttackChains)
                    .ThenInclude(ac => ac.AttackChainSteps)
                        .ThenInclude(acs => acs.Vulnerability)
                .FirstOrDefaultAsync(le => le.Id == id);

            if (lossEvent == null) return NotFound();

            try
            {
                await RecalculateLossEventFrequencyAndALE(lossEvent);
                await _context.SaveChangesAsync();

                TempData["Success"] = "Loss event ALE recalculated successfully.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error recalculating ALE for loss event ID {Id}", id);
                TempData["Error"] = "Error recalculating loss event ALE.";
            }

            return RedirectToAction(nameof(Details), new { id });
        }

        // Helper methods
        private async Task PrepareViewData()
        {
            var mitreTechniques = await _mitreService.GetTechniquesAsync();
            ViewData["MitreTechniques"] = mitreTechniques
                .Select(mt => new { mt.Id, Text = $"{mt.TechniqueId} - {mt.Name}" })
                .ToList();

            ViewData["LossTypes"] = new List<object>
            {
                new { value = "Data Breach", text = "Data Breach" },
                new { value = "Service Disruption", text = "Service Disruption" },
                new { value = "Ransomware", text = "Ransomware" },
                new { value = "Intellectual Property Theft", text = "Intellectual Property Theft" },
                new { value = "Fraud", text = "Fraud" },
                new { value = "Regulatory Fine", text = "Regulatory Fine" }
            };

            ViewData["BusinessImpactCategories"] = new List<object>
            {
                new { value = "Financial", text = "Financial" },
                new { value = "Reputation", text = "Reputation" },
                new { value = "Regulatory", text = "Regulatory" },
                new { value = "Operational", text = "Operational" },
                new { value = "Strategic", text = "Strategic" }
            };
        }

        private bool LossEventExists(int id)
        {
            return _context.LossEvents.Any(le => le.Id == id);
        }

        private double CalculateTriangularMostLikely(double min, double max)
        {
            // For a triangular distribution, most likely is typically the midpoint
            // unless other information suggests otherwise
            return (min + max) / 2.0;
        }

        private async Task RecalculateLossEventFrequencyAndALE(LossEvent lossEvent)
        {
            if (!lossEvent.AttackChains.Any()) return;

            // Calculate LEF based on all attack chains that lead to this loss event
            double totalLef = 0;
            double minLef = double.MaxValue;
            double maxLef = 0;

            foreach (var attackChain in lossEvent.AttackChains)
            {
                var threatEvent = attackChain.ThreatEvent;
                double chainProbability = 1.0;

                // Calculate cumulative probability through vulnerabilities
                foreach (var step in attackChain.AttackChainSteps.OrderBy(s => s.StepOrder))
                {
                    if (step.Vulnerability != null)
                    {
                        var vulnLikelihood = (step.Vulnerability.VulnMinimum + 
                                           step.Vulnerability.VulnMaximum + 
                                           step.Vulnerability.VulnMostLikely) / 3.0;
                        chainProbability *= vulnLikelihood;
                    }
                }

                // Calculate LEF for this chain
                var chainLef = ((threatEvent.TefMinimum + threatEvent.TefMaximum + threatEvent.TefMostLikely) / 3.0) * chainProbability;
                totalLef += chainLef;

                var chainLefMin = threatEvent.TefMinimum * chainProbability;
                var chainLefMax = threatEvent.TefMaximum * chainProbability;

                minLef = Math.Min(minLef, chainLefMin);
                maxLef = Math.Max(maxLef, chainLefMax);
            }

            // Update LEF
            lossEvent.LefMostLikely = totalLef;
            lossEvent.LefMinimum = minLef == double.MaxValue ? 0 : minLef;
            lossEvent.LefMaximum = maxLef;

            // Calculate ALE if loss values are available
            if (lossEvent.PrimaryLossMostLikely.HasValue)
            {
                var totalLoss = lossEvent.PrimaryLossMostLikely.Value + (lossEvent.SecondaryLossMostLikely ?? 0);
                
                lossEvent.AleMostLikely = lossEvent.LefMostLikely * totalLoss;
                lossEvent.AleMinimum = lossEvent.LefMinimum * totalLoss;
                lossEvent.AleMaximum = lossEvent.LefMaximum * totalLoss;
            }

            lossEvent.UpdatedAt = DateTime.UtcNow;
            lossEvent.UpdatedBy = "System";
        }
    }
}