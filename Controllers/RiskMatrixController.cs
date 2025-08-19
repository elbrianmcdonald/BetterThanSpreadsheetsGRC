using CyberRiskApp.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireAdminRole)]
    public class RiskMatrixController : Controller
    {
        private readonly IRiskMatrixService _riskMatrixService;

        public RiskMatrixController(IRiskMatrixService riskMatrixService)
        {
            _riskMatrixService = riskMatrixService;
        }

        // GET: RiskMatrix
        public async Task<IActionResult> Index()
        {
            var matrices = await _riskMatrixService.GetAllMatricesAsync();
            return View(matrices);
        }

        // GET: RiskMatrix/Details/5
        public async Task<IActionResult> Details(int id)
        {
            var matrix = await _riskMatrixService.GetMatrixByIdAsync(id);
            if (matrix == null)
            {
                return NotFound();
            }

            return View(matrix);
        }

        // GET: RiskMatrix/Create
        public IActionResult Create()
        {
            var model = new RiskMatrix
            {
                MatrixSize = 5,
                MatrixType = RiskMatrixType.ImpactLikelihood,
                IsActive = true
            };
            return View(model);
        }

        // POST: RiskMatrix/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(RiskMatrix matrix)
        {
            if (ModelState.IsValid)
            {
                try
                {
                    matrix.CreatedBy = User.Identity?.Name ?? "Unknown";
                    var createdMatrix = await _riskMatrixService.CreateMatrixAsync(matrix);
                    
                    TempData["Success"] = "Risk matrix created successfully. Now configure the levels and cells.";
                    return RedirectToAction(nameof(Configure), new { id = createdMatrix.Id });
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error creating risk matrix: {ex.Message}";
                }
            }

            return View(matrix);
        }

        // GET: RiskMatrix/Edit/5 - Redirect to Configure
        public async Task<IActionResult> Edit(int id)
        {
            var matrix = await _riskMatrixService.GetMatrixByIdAsync(id);
            if (matrix == null)
            {
                return NotFound();
            }
            // Redirect to Configure action since that's the actual edit view
            return RedirectToAction(nameof(Configure), new { id });
        }

        // POST: RiskMatrix/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, RiskMatrix matrix)
        {
            if (id != matrix.Id)
            {
                return NotFound();
            }

            if (ModelState.IsValid)
            {
                try
                {
                    await _riskMatrixService.UpdateMatrixAsync(matrix);
                    TempData["Success"] = "Risk matrix updated successfully.";
                    return RedirectToAction(nameof(Index));
                }
                catch (Exception ex)
                {
                    TempData["Error"] = $"Error updating risk matrix: {ex.Message}";
                }
            }
            return RedirectToAction(nameof(Configure), new { id = matrix.Id });
        }

        // GET: RiskMatrix/Configure/5
        public async Task<IActionResult> Configure(int id)
        {
            var matrix = await _riskMatrixService.GetMatrixByIdAsync(id);
            if (matrix == null)
            {
                return NotFound();
            }

            var levels = await _riskMatrixService.GetLevelsByMatrixIdAsync(id);
            var cells = await _riskMatrixService.GetCellsByMatrixIdAsync(id);

            ViewBag.Matrix = matrix;
            ViewBag.Levels = levels;
            ViewBag.Cells = cells;
            
            return View(matrix);
        }

        // POST: RiskMatrix/SetDefault/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SetDefault(int id)
        {
            try
            {
                await _riskMatrixService.SetDefaultMatrixAsync(id);
                TempData["Success"] = "Default risk matrix updated successfully.";
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error setting default matrix: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // POST: RiskMatrix/GenerateCells/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> GenerateCells(int id)
        {
            try
            {
                await _riskMatrixService.GenerateMatrixCellsAsync(id);
                TempData["Success"] = "Matrix cells generated successfully.";
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error generating matrix cells: {ex.Message}";
            }

            return RedirectToAction(nameof(Configure), new { id });
        }

        // POST: RiskMatrix/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            try
            {
                var matrix = await _riskMatrixService.GetMatrixByIdAsync(id);
                if (matrix?.IsDefault == true)
                {
                    TempData["Error"] = "Cannot delete the default risk matrix.";
                    return RedirectToAction(nameof(Index));
                }

                await _riskMatrixService.DeleteMatrixAsync(id);
                TempData["Success"] = "Risk matrix deleted successfully.";
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"Error deleting risk matrix: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        // API endpoints for AJAX operations
        
        // POST: RiskMatrix/CreateLevel
        [HttpPost]
        public async Task<IActionResult> CreateLevel([FromBody] RiskMatrixLevel level)
        {
            try
            {
                var createdLevel = await _riskMatrixService.CreateLevelAsync(level);
                return Json(new { success = true, level = createdLevel });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        // POST: RiskMatrix/UpdateLevel
        [HttpPost]
        public async Task<IActionResult> UpdateLevel([FromBody] RiskMatrixLevel level)
        {
            try
            {
                var updatedLevel = await _riskMatrixService.UpdateLevelAsync(level);
                return Json(new { success = true, level = updatedLevel });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        // POST: RiskMatrix/DeleteLevel/5
        [HttpPost]
        public async Task<IActionResult> DeleteLevel(int id)
        {
            try
            {
                await _riskMatrixService.DeleteLevelAsync(id);
                return Json(new { success = true });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        // POST: RiskMatrix/UpdateCell
        [HttpPost]
        public async Task<IActionResult> UpdateCell([FromBody] RiskMatrixCell cell)
        {
            try
            {
                var updatedCell = await _riskMatrixService.UpdateCellAsync(cell);
                return Json(new { success = true, cell = updatedCell });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        // POST: RiskMatrix/SaveLevels/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SaveLevels(int id, [FromBody] List<RiskMatrixLevel> levels)
        {
            try
            {
                // Validate input
                if (levels == null || !levels.Any())
                {
                    return Json(new { success = false, message = "No level data provided" });
                }

                // Verify matrix exists
                var matrix = await _riskMatrixService.GetMatrixByIdAsync(id);
                if (matrix == null)
                {
                    return Json(new { success = false, message = $"Risk matrix with ID {id} not found" });
                }

                // Validate and prepare levels
                foreach (var level in levels)
                {
                    level.RiskMatrixId = id;
                    level.Id = 0; // Ensure new entity
                    
                    // Validate required fields
                    if (string.IsNullOrWhiteSpace(level.LevelName))
                    {
                        return Json(new { success = false, message = "Level name is required for all levels" });
                    }

                    // Ensure multiplier has a value
                    if (level.Multiplier == null)
                    {
                        level.Multiplier = level.LevelValue;
                    }
                }
                
                await _riskMatrixService.SaveLevelsAsync(id, levels);
                return Json(new { success = true, message = $"Successfully saved {levels.Count} levels" });
            }
            catch (Exception ex)
            {
                // Log the full exception for debugging
                Console.WriteLine($"Error saving levels: {ex}");
                return Json(new { success = false, message = $"Error saving levels: {ex.Message}" });
            }
        }

        // POST: RiskMatrix/GenerateMatrix/5
        [HttpPost]
        public async Task<IActionResult> GenerateMatrix(int id)
        {
            try
            {
                await _riskMatrixService.GenerateMatrixCellsAsync(id);
                return Json(new { success = true });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        // POST: RiskMatrix/SaveThresholds/5
        [HttpPost]
        public async Task<IActionResult> SaveThresholds(int id, [FromBody] dynamic thresholds)
        {
            try
            {
                // For now, we'll save these as matrix properties
                // In a real implementation, you might want a separate table for thresholds
                var matrix = await _riskMatrixService.GetMatrixByIdAsync(id);
                if (matrix != null)
                {
                    // You could add threshold properties to the RiskMatrix model
                    // or create a separate RiskThreshold entity
                    await _riskMatrixService.UpdateMatrixAsync(matrix);
                }
                
                return Json(new { success = true });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        // GET: RiskMatrix/GetMatrixData/5
        [HttpGet]
        public async Task<IActionResult> GetMatrixData(int id)
        {
            try
            {
                var matrix = await _riskMatrixService.GetMatrixByIdAsync(id);
                var levels = await _riskMatrixService.GetLevelsByMatrixIdAsync(id);
                var cells = await _riskMatrixService.GetCellsByMatrixIdAsync(id);

                return Json(new { 
                    success = true, 
                    matrix = new {
                        id = matrix.Id,
                        name = matrix.Name,
                        matrixSize = matrix.MatrixSize,
                        matrixType = (int)matrix.MatrixType
                    },
                    levels = levels.Select(l => new {
                        id = l.Id,
                        levelType = l.LevelType.ToString(),
                        levelValue = l.LevelValue,
                        levelName = l.LevelName,
                        color = l.ColorCode,
                        multiplier = l.Multiplier
                    }),
                    cells = cells.Select(c => new {
                        id = c.Id,
                        impactLevel = c.ImpactLevel,
                        likelihoodLevel = c.LikelihoodLevel,
                        exposureLevel = c.ExposureLevel,
                        riskScore = c.RiskScore,
                        riskLevel = c.ResultingRiskLevel.ToString()
                    })
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        // GET: RiskMatrix/Preview/5
        public async Task<IActionResult> Preview(int id)
        {
            var matrix = await _riskMatrixService.GetMatrixByIdAsync(id);
            if (matrix == null)
            {
                return NotFound();
            }

            var levels = await _riskMatrixService.GetLevelsByMatrixIdAsync(id);
            var cells = await _riskMatrixService.GetCellsByMatrixIdAsync(id);

            ViewBag.Matrix = matrix;
            ViewBag.Levels = levels;
            ViewBag.Cells = cells;

            return View(matrix);
        }
    }
}