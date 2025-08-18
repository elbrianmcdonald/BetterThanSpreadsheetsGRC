using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.AspNetCore.Authorization;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = "RequireGRCAnalystOrAbove")]
    public class CapabilityControlMappingController : Controller
    {
        private readonly CyberRiskContext _context;

        public CapabilityControlMappingController(CyberRiskContext context)
        {
            _context = context;
        }

        // GET: CapabilityControlMapping
        public async Task<IActionResult> Index(int? capabilityRequirementId)
        {
            var mappings = _context.CapabilityControlMappings
                .Include(ccm => ccm.CapabilityRequirement)
                    .ThenInclude(cr => cr.StrategyGoal)
                        .ThenInclude(sg => sg.StrategyPlan)
                .Include(ccm => ccm.ComplianceControl)
                    .ThenInclude(cc => cc.Framework)
                .AsQueryable();

            if (capabilityRequirementId.HasValue)
            {
                mappings = mappings.Where(m => m.CapabilityRequirementId == capabilityRequirementId.Value);
                ViewBag.CapabilityRequirementId = capabilityRequirementId.Value;
                
                var capability = await _context.CapabilityRequirements
                    .Include(cr => cr.StrategyGoal)
                        .ThenInclude(sg => sg.StrategyPlan)
                    .FirstOrDefaultAsync(cr => cr.Id == capabilityRequirementId.Value);
                ViewBag.CapabilityName = capability?.CapabilityName;
                ViewBag.StrategyPlanTitle = capability?.StrategyGoal?.StrategyPlan?.PlanName;
            }

            return View(await mappings.OrderBy(m => m.CapabilityRequirement.CapabilityName)
                                    .ThenBy(m => m.ComplianceControl.ControlId)
                                    .ToListAsync());
        }

        // GET: CapabilityControlMapping/Details/5
        public async Task<IActionResult> Details(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var mapping = await _context.CapabilityControlMappings
                .Include(ccm => ccm.CapabilityRequirement)
                    .ThenInclude(cr => cr.StrategyGoal)
                        .ThenInclude(sg => sg.StrategyPlan)
                .Include(ccm => ccm.ComplianceControl)
                    .ThenInclude(cc => cc.Framework)
                .FirstOrDefaultAsync(m => m.Id == id);

            if (mapping == null)
            {
                return NotFound();
            }

            return View(mapping);
        }

        // GET: CapabilityControlMapping/Create
        public async Task<IActionResult> Create(int? capabilityRequirementId)
        {
            await PopulateDropdowns();
            
            if (capabilityRequirementId.HasValue)
            {
                ViewBag.SelectedCapabilityRequirementId = capabilityRequirementId.Value;
                var capability = await _context.CapabilityRequirements
                    .Include(cr => cr.StrategyGoal)
                        .ThenInclude(sg => sg.StrategyPlan)
                    .FirstOrDefaultAsync(cr => cr.Id == capabilityRequirementId.Value);
                ViewBag.CapabilityName = capability?.CapabilityName;
            }

            return View();
        }

        // POST: CapabilityControlMapping/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create([Bind("CapabilityRequirementId,ComplianceControlId,ImplementationNotes,Status,Priority,EstimatedHours,StartDate,TargetDate,AssignedTo,Notes")] CapabilityControlMapping mapping)
        {
            // Remove navigation property validation
            ModelState.Remove("CapabilityRequirement");
            ModelState.Remove("ComplianceControl");

            if (ModelState.IsValid)
            {
                // Check for duplicate mapping
                var existingMapping = await _context.CapabilityControlMappings
                    .FirstOrDefaultAsync(m => m.CapabilityRequirementId == mapping.CapabilityRequirementId && 
                                            m.ComplianceControlId == mapping.ComplianceControlId);

                if (existingMapping != null)
                {
                    ModelState.AddModelError("", "This capability is already mapped to the selected control.");
                    await PopulateDropdowns();
                    return View(mapping);
                }

                mapping.CreatedAt = DateTime.UtcNow;
                mapping.UpdatedAt = DateTime.UtcNow;

                _context.Add(mapping);
                await _context.SaveChangesAsync();
                
                return RedirectToAction(nameof(Index), new { capabilityRequirementId = mapping.CapabilityRequirementId });
            }

            await PopulateDropdowns();
            return View(mapping);
        }

        // GET: CapabilityControlMapping/Edit/5
        public async Task<IActionResult> Edit(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var mapping = await _context.CapabilityControlMappings.FindAsync(id);
            if (mapping == null)
            {
                return NotFound();
            }

            await PopulateDropdowns();
            return View(mapping);
        }

        // POST: CapabilityControlMapping/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, [Bind("Id,CapabilityRequirementId,ComplianceControlId,ImplementationNotes,Status,Priority,EstimatedHours,ActualHours,StartDate,TargetDate,CompletionDate,AssignedTo,Notes,CreatedAt")] CapabilityControlMapping mapping)
        {
            if (id != mapping.Id)
            {
                return NotFound();
            }

            // Remove navigation property validation
            ModelState.Remove("CapabilityRequirement");
            ModelState.Remove("ComplianceControl");

            if (ModelState.IsValid)
            {
                try
                {
                    mapping.UpdatedAt = DateTime.UtcNow;
                    _context.Update(mapping);
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!CapabilityControlMappingExists(mapping.Id))
                    {
                        return NotFound();
                    }
                    else
                    {
                        throw;
                    }
                }
                return RedirectToAction(nameof(Index), new { capabilityRequirementId = mapping.CapabilityRequirementId });
            }

            await PopulateDropdowns();
            return View(mapping);
        }

        // GET: CapabilityControlMapping/Delete/5
        public async Task<IActionResult> Delete(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var mapping = await _context.CapabilityControlMappings
                .Include(ccm => ccm.CapabilityRequirement)
                    .ThenInclude(cr => cr.StrategyGoal)
                        .ThenInclude(sg => sg.StrategyPlan)
                .Include(ccm => ccm.ComplianceControl)
                    .ThenInclude(cc => cc.Framework)
                .FirstOrDefaultAsync(m => m.Id == id);

            if (mapping == null)
            {
                return NotFound();
            }

            return View(mapping);
        }

        // POST: CapabilityControlMapping/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            var mapping = await _context.CapabilityControlMappings.FindAsync(id);
            if (mapping != null)
            {
                var capabilityRequirementId = mapping.CapabilityRequirementId;
                _context.CapabilityControlMappings.Remove(mapping);
                await _context.SaveChangesAsync();
                return RedirectToAction(nameof(Index), new { capabilityRequirementId });
            }

            return RedirectToAction(nameof(Index));
        }

        // AJAX endpoint for bulk mapping creation
        [HttpPost]
        public async Task<IActionResult> CreateBulkMappings(int capabilityRequirementId, int[] controlIds, CapabilityControlStatus status = CapabilityControlStatus.Planned, MappingPriority priority = MappingPriority.Medium)
        {
            try
            {
                var mappingsToAdd = new List<CapabilityControlMapping>();

                foreach (var controlId in controlIds)
                {
                    // Check if mapping already exists
                    var existingMapping = await _context.CapabilityControlMappings
                        .FirstOrDefaultAsync(m => m.CapabilityRequirementId == capabilityRequirementId && 
                                                m.ComplianceControlId == controlId);

                    if (existingMapping == null)
                    {
                        mappingsToAdd.Add(new CapabilityControlMapping
                        {
                            CapabilityRequirementId = capabilityRequirementId,
                            ComplianceControlId = controlId,
                            Status = status,
                            Priority = priority,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        });
                    }
                }

                if (mappingsToAdd.Any())
                {
                    _context.CapabilityControlMappings.AddRange(mappingsToAdd);
                    await _context.SaveChangesAsync();
                }

                return Json(new { success = true, message = $"Successfully created {mappingsToAdd.Count} mappings." });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = $"Error creating mappings: {ex.Message}" });
            }
        }

        private async Task PopulateDropdowns()
        {
            ViewBag.CapabilityRequirements = new SelectList(
                await _context.CapabilityRequirements
                    .Include(cr => cr.StrategyGoal)
                        .ThenInclude(sg => sg.StrategyPlan)
                    .OrderBy(cr => cr.StrategyGoal.StrategyPlan.PlanName)
                        .ThenBy(cr => cr.CapabilityName)
                    .Select(cr => new { 
                        cr.Id, 
                        DisplayName = $"{cr.StrategyGoal.StrategyPlan.PlanName} - {cr.CapabilityName}" 
                    })
                    .ToListAsync(),
                "Id", "DisplayName");

            ViewBag.ComplianceControls = new SelectList(
                await _context.ComplianceControls
                    .Include(cc => cc.Framework)
                    .OrderBy(cc => cc.Framework.Name)
                        .ThenBy(cc => cc.ControlId)
                    .Select(cc => new { 
                        cc.Id, 
                        DisplayName = $"{cc.Framework.Name} - {cc.ControlId}: {cc.Title}" 
                    })
                    .ToListAsync(),
                "Id", "DisplayName");
        }

        private bool CapabilityControlMappingExists(int id)
        {
            return _context.CapabilityControlMappings.Any(e => e.Id == id);
        }
    }
}