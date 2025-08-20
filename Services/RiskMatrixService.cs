using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class RiskMatrixService : IRiskMatrixService
    {
        private readonly CyberRiskContext _context;

        public RiskMatrixService(CyberRiskContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<RiskMatrix>> GetAllMatricesAsync()
        {
            return await _context.RiskMatrices
                .Include(m => m.Levels)
                .Include(m => m.MatrixCells)
                .OrderBy(m => m.Name)
                .ToListAsync();
        }

        public async Task<RiskMatrix?> GetMatrixByIdAsync(int id)
        {
            return await _context.RiskMatrices
                .Include(m => m.Levels)
                .Include(m => m.MatrixCells)
                .FirstOrDefaultAsync(m => m.Id == id);
        }

        public async Task<RiskMatrix?> GetDefaultMatrixAsync()
        {
            return await _context.RiskMatrices
                .Include(m => m.Levels)
                .Include(m => m.MatrixCells)
                .FirstOrDefaultAsync(m => m.IsDefault && m.IsActive);
        }

        public async Task<RiskMatrix> CreateMatrixAsync(RiskMatrix matrix)
        {
            matrix.CreatedAt = DateTime.UtcNow;
            matrix.UpdatedAt = DateTime.UtcNow;

            _context.RiskMatrices.Add(matrix);
            await _context.SaveChangesAsync();
            return matrix;
        }

        public async Task<RiskMatrix> UpdateMatrixAsync(RiskMatrix matrix)
        {
            matrix.UpdatedAt = DateTime.UtcNow;
            _context.RiskMatrices.Update(matrix);
            await _context.SaveChangesAsync();
            return matrix;
        }

        public async Task DeleteMatrixAsync(int id)
        {
            var matrix = await _context.RiskMatrices.FindAsync(id);
            if (matrix != null)
            {
                _context.RiskMatrices.Remove(matrix);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<RiskMatrix> SetDefaultMatrixAsync(int id)
        {
            // Remove default from all other matrices
            var allMatrices = await _context.RiskMatrices.ToListAsync();
            foreach (var matrix in allMatrices)
            {
                matrix.IsDefault = matrix.Id == id;
                matrix.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return await GetMatrixByIdAsync(id) ?? throw new InvalidOperationException("Matrix not found");
        }

        // Matrix level management
        public async Task<RiskMatrixLevel> CreateLevelAsync(RiskMatrixLevel level)
        {
            _context.RiskMatrixLevels.Add(level);
            await _context.SaveChangesAsync();
            return level;
        }

        public async Task<RiskMatrixLevel> UpdateLevelAsync(RiskMatrixLevel level)
        {
            _context.RiskMatrixLevels.Update(level);
            await _context.SaveChangesAsync();
            return level;
        }

        public async Task DeleteLevelAsync(int id)
        {
            var level = await _context.RiskMatrixLevels.FindAsync(id);
            if (level != null)
            {
                _context.RiskMatrixLevels.Remove(level);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<RiskMatrixLevel>> GetLevelsByMatrixIdAsync(int matrixId)
        {
            return await _context.RiskMatrixLevels
                .Where(l => l.RiskMatrixId == matrixId)
                .OrderBy(l => l.LevelType)
                .ThenBy(l => l.LevelValue)
                .ToListAsync();
        }

        public async Task SaveLevelsAsync(int matrixId, List<RiskMatrixLevel> levels)
        {
            // Remove existing levels for this matrix
            var existingLevels = await _context.RiskMatrixLevels
                .Where(l => l.RiskMatrixId == matrixId)
                .ToListAsync();
            
            _context.RiskMatrixLevels.RemoveRange(existingLevels);

            // Add new levels
            foreach (var level in levels)
            {
                level.RiskMatrixId = matrixId;
                level.Id = 0; // Ensure new entity
                _context.RiskMatrixLevels.Add(level);
            }

            await _context.SaveChangesAsync();
        }

        // Matrix cell management
        public async Task<RiskMatrixCell> CreateCellAsync(RiskMatrixCell cell)
        {
            _context.RiskMatrixCells.Add(cell);
            await _context.SaveChangesAsync();
            return cell;
        }

        public async Task<RiskMatrixCell> UpdateCellAsync(RiskMatrixCell cell)
        {
            _context.RiskMatrixCells.Update(cell);
            await _context.SaveChangesAsync();
            return cell;
        }

        public async Task DeleteCellAsync(int id)
        {
            var cell = await _context.RiskMatrixCells.FindAsync(id);
            if (cell != null)
            {
                _context.RiskMatrixCells.Remove(cell);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<RiskMatrixCell>> GetCellsByMatrixIdAsync(int matrixId)
        {
            return await _context.RiskMatrixCells
                .Where(c => c.RiskMatrixId == matrixId)
                .OrderBy(c => c.ImpactLevel)
                .ThenBy(c => c.LikelihoodLevel)
                .ThenBy(c => c.ExposureLevel)
                .ToListAsync();
        }

        public async Task GenerateMatrixCellsAsync(int matrixId)
        {
            var matrix = await GetMatrixByIdAsync(matrixId);
            if (matrix == null) return;

            // Get the actual level configurations for this matrix
            var levels = await GetLevelsByMatrixIdAsync(matrixId);
            var impactLevels = levels.Where(l => l.LevelType == RiskMatrixLevelType.Impact).OrderBy(l => l.LevelValue).ToList();
            var likelihoodLevels = levels.Where(l => l.LevelType == RiskMatrixLevelType.Likelihood).OrderBy(l => l.LevelValue).ToList();
            var exposureLevels = levels.Where(l => l.LevelType == RiskMatrixLevelType.Exposure).OrderBy(l => l.LevelValue).ToList();

            // Remove existing cells - ensure we save changes to clear them first
            var existingCells = await GetCellsByMatrixIdAsync(matrixId);
            if (existingCells.Any())
            {
                _context.RiskMatrixCells.RemoveRange(existingCells);
                await _context.SaveChangesAsync(); // Save the deletion first
            }

            var cells = new List<RiskMatrixCell>();

            if (matrix.MatrixType == RiskMatrixType.ImpactLikelihood)
            {
                // Generate 2D matrix (Impact × Likelihood)
                int impactIndex = 1;
                foreach (var impactLevel in impactLevels)
                {
                    int likelihoodIndex = 1;
                    foreach (var likelihoodLevel in likelihoodLevels)
                    {
                        // Use actual configured level values for calculation but sequential numbers for storage
                        var riskScore = impactLevel.LevelValue * likelihoodLevel.LevelValue;
                        var riskLevel = CalculateRiskLevelFromScore(riskScore, matrix.MatrixSize);

                        cells.Add(new RiskMatrixCell
                        {
                            RiskMatrixId = matrixId,
                            ImpactLevel = impactIndex, // Use sequential index to avoid duplicates
                            LikelihoodLevel = likelihoodIndex,
                            ExposureLevel = null,
                            RiskScore = riskScore,
                            ResultingRiskLevel = riskLevel,
                            CellColor = GetRiskLevelColor(riskLevel)
                        });
                        
                        likelihoodIndex++;
                    }
                    impactIndex++;
                }
            }
            else
            {
                // Generate 3D matrix (Likelihood × Impact) × Exposure
                int impactIndex = 1;
                foreach (var impactLevel in impactLevels)
                {
                    int likelihoodIndex = 1;
                    foreach (var likelihoodLevel in likelihoodLevels)
                    {
                        int exposureIndex = 1;
                        foreach (var exposureLevel in exposureLevels)
                        {
                            // Correct calculation: (Likelihood × Impact) × Exposure
                            var baseRiskScore = likelihoodLevel.LevelValue * impactLevel.LevelValue;
                            var exposureMultiplier = exposureLevel.Multiplier ?? exposureLevel.LevelValue;
                            var riskScore = baseRiskScore * exposureMultiplier;
                            var riskLevel = CalculateRiskLevelFromScore(riskScore, matrix.MatrixSize);

                            cells.Add(new RiskMatrixCell
                            {
                                RiskMatrixId = matrixId,
                                ImpactLevel = impactIndex,
                                LikelihoodLevel = likelihoodIndex,
                                ExposureLevel = exposureIndex,
                                RiskScore = riskScore,
                                ResultingRiskLevel = riskLevel,
                                CellColor = GetRiskLevelColor(riskLevel)
                            });
                            
                            exposureIndex++;
                        }
                        likelihoodIndex++;
                    }
                    impactIndex++;
                }
            }

            _context.RiskMatrixCells.AddRange(cells);
            await _context.SaveChangesAsync();
        }

        public async Task<RiskLevel> CalculateRiskLevelAsync(int matrixId, int impact, int likelihood, int? exposure = null)
        {
            var cell = await _context.RiskMatrixCells
                .FirstOrDefaultAsync(c => c.RiskMatrixId == matrixId &&
                                         c.ImpactLevel == impact &&
                                         c.LikelihoodLevel == likelihood &&
                                         c.ExposureLevel == exposure);

            return cell?.ResultingRiskLevel ?? RiskLevel.Medium;
        }

        public async Task<decimal> CalculateRiskScoreAsync(int matrixId, int impact, int likelihood, int? exposure = null)
        {
            var cell = await _context.RiskMatrixCells
                .FirstOrDefaultAsync(c => c.RiskMatrixId == matrixId &&
                                         c.ImpactLevel == impact &&
                                         c.LikelihoodLevel == likelihood &&
                                         c.ExposureLevel == exposure);

            return cell?.RiskScore ?? 0;
        }

        public async Task<bool> ValidateMatrixAsync(RiskMatrix matrix)
        {
            // Check if required levels exist
            var levels = await GetLevelsByMatrixIdAsync(matrix.Id);
            var impactLevels = levels.Where(l => l.LevelType == RiskMatrixLevelType.Impact).Count();
            var likelihoodLevels = levels.Where(l => l.LevelType == RiskMatrixLevelType.Likelihood).Count();

            if (impactLevels != matrix.MatrixSize || likelihoodLevels != matrix.MatrixSize)
                return false;

            if (matrix.MatrixType == RiskMatrixType.ImpactLikelihoodExposure)
            {
                var exposureLevels = levels.Where(l => l.LevelType == RiskMatrixLevelType.Exposure).Count();
                if (exposureLevels != matrix.MatrixSize)
                    return false;
            }

            return true;
        }

        public async Task SeedDefaultMatricesAsync()
        {
            if (await _context.RiskMatrices.AnyAsync()) return;

            // Create default 5x5 Impact × Likelihood × Exposure matrix (existing behavior)
            var defaultMatrix = new RiskMatrix
            {
                Name = "Default 5×5 Impact × Likelihood × Exposure",
                Description = "Traditional risk assessment matrix with exposure factor",
                MatrixSize = 5,
                MatrixType = RiskMatrixType.ImpactLikelihoodExposure,
                IsDefault = true,
                IsActive = true,
                CreatedBy = "System",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.RiskMatrices.Add(defaultMatrix);
            await _context.SaveChangesAsync();

            // Create levels for default matrix
            await CreateDefaultLevels(defaultMatrix.Id);
            await GenerateMatrixCellsAsync(defaultMatrix.Id);

            // Create additional example matrices
            await CreateExampleMatricesAsync();
        }

        private async Task CreateDefaultLevels(int matrixId)
        {
            // Impact levels
            var impactLevels = new[]
            {
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 1, LevelName = "Very Low", Description = "Minimal impact", ColorCode = "#28a745" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 2, LevelName = "Low", Description = "Minor impact", ColorCode = "#6f42c1" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 3, LevelName = "Medium", Description = "Moderate impact", ColorCode = "#ffc107" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 4, LevelName = "High", Description = "Major impact", ColorCode = "#fd7e14" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 5, LevelName = "Very High", Description = "Severe impact", ColorCode = "#dc3545" }
            };

            // Likelihood levels
            var likelihoodLevels = new[]
            {
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 1, LevelName = "Very Unlikely", Description = "Less than 5% chance", ColorCode = "#28a745" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 2, LevelName = "Unlikely", Description = "5-25% chance", ColorCode = "#6f42c1" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 3, LevelName = "Possible", Description = "25-50% chance", ColorCode = "#ffc107" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 4, LevelName = "Likely", Description = "50-75% chance", ColorCode = "#fd7e14" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 5, LevelName = "Very Likely", Description = "More than 75% chance", ColorCode = "#dc3545" }
            };

            // Exposure levels
            var exposureLevels = new[]
            {
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Exposure, LevelValue = 1, LevelName = "Slightly Exposed", Description = "Minimal exposure", ColorCode = "#28a745", Multiplier = 0.2m },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Exposure, LevelValue = 2, LevelName = "Exposed", Description = "Limited exposure", ColorCode = "#6f42c1", Multiplier = 0.4m },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Exposure, LevelValue = 3, LevelName = "Moderately Exposed", Description = "Moderate exposure", ColorCode = "#ffc107", Multiplier = 0.8m },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Exposure, LevelValue = 4, LevelName = "Highly Exposed", Description = "High exposure", ColorCode = "#fd7e14", Multiplier = 1.0m },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Exposure, LevelValue = 5, LevelName = "Extremely Exposed", Description = "Maximum exposure", ColorCode = "#dc3545", Multiplier = 1.2m }
            };

            _context.RiskMatrixLevels.AddRange(impactLevels);
            _context.RiskMatrixLevels.AddRange(likelihoodLevels);
            _context.RiskMatrixLevels.AddRange(exposureLevels);
            await _context.SaveChangesAsync();
        }

        private async Task CreateExampleMatricesAsync()
        {
            // Create a simple 3x3 matrix
            var simple3x3 = new RiskMatrix
            {
                Name = "Simple 3×3 Impact × Likelihood",
                Description = "Basic risk matrix for quick assessments",
                MatrixSize = 3,
                MatrixType = RiskMatrixType.ImpactLikelihood,
                IsDefault = false,
                IsActive = true,
                CreatedBy = "System",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.RiskMatrices.Add(simple3x3);
            await _context.SaveChangesAsync();

            // Create levels for 3x3 matrix
            await Create3x3Levels(simple3x3.Id);
            await GenerateMatrixCellsAsync(simple3x3.Id);

            // Create a 4x4 matrix with exposure
            var standard4x4 = new RiskMatrix
            {
                Name = "Standard 4×4 Impact × Likelihood × Exposure",
                Description = "Balanced 4x4 risk matrix with exposure factor",
                MatrixSize = 4,
                MatrixType = RiskMatrixType.ImpactLikelihoodExposure,
                IsDefault = false,
                IsActive = true,
                CreatedBy = "System",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.RiskMatrices.Add(standard4x4);
            await _context.SaveChangesAsync();

            await Create4x4LevelsWithExposure(standard4x4.Id);
            await GenerateMatrixCellsAsync(standard4x4.Id);
        }

        private async Task Create3x3Levels(int matrixId)
        {
            var levels = new[]
            {
                // Impact
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 1, LevelName = "Low", Description = "Minor impact", ColorCode = "#28a745" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 2, LevelName = "Medium", Description = "Moderate impact", ColorCode = "#ffc107" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 3, LevelName = "High", Description = "Major impact", ColorCode = "#dc3545" },
                
                // Likelihood
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 1, LevelName = "Unlikely", Description = "Low probability", ColorCode = "#28a745" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 2, LevelName = "Possible", Description = "Medium probability", ColorCode = "#ffc107" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 3, LevelName = "Likely", Description = "High probability", ColorCode = "#dc3545" }
            };

            _context.RiskMatrixLevels.AddRange(levels);
            await _context.SaveChangesAsync();
        }

        private async Task Create4x4Levels(int matrixId)
        {
            var levels = new[]
            {
                // Impact
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 1, LevelName = "Very Low", Description = "Minimal impact", ColorCode = "#28a745" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 2, LevelName = "Low", Description = "Minor impact", ColorCode = "#20c997" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 3, LevelName = "High", Description = "Major impact", ColorCode = "#fd7e14" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 4, LevelName = "Very High", Description = "Severe impact", ColorCode = "#dc3545" },
                
                // Likelihood
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 1, LevelName = "Very Unlikely", Description = "Very low probability", ColorCode = "#28a745" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 2, LevelName = "Unlikely", Description = "Low probability", ColorCode = "#20c997" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 3, LevelName = "Likely", Description = "High probability", ColorCode = "#fd7e14" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 4, LevelName = "Very Likely", Description = "Very high probability", ColorCode = "#dc3545" }
            };

            _context.RiskMatrixLevels.AddRange(levels);
            await _context.SaveChangesAsync();
        }

        private async Task Create4x4LevelsWithExposure(int matrixId)
        {
            var levels = new[]
            {
                // Impact levels (1-4)
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 1, LevelName = "Very Low", Description = "Minimal impact", ColorCode = "#28a745" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 2, LevelName = "Low", Description = "Minor impact", ColorCode = "#20c997" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 3, LevelName = "High", Description = "Major impact", ColorCode = "#fd7e14" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Impact, LevelValue = 4, LevelName = "Very High", Description = "Severe impact", ColorCode = "#dc3545" },
                
                // Likelihood levels (1-4)
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 1, LevelName = "Very Unlikely", Description = "Very low probability", ColorCode = "#28a745" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 2, LevelName = "Unlikely", Description = "Low probability", ColorCode = "#20c997" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 3, LevelName = "Likely", Description = "High probability", ColorCode = "#fd7e14" },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Likelihood, LevelValue = 4, LevelName = "Very Likely", Description = "Very high probability", ColorCode = "#dc3545" },

                // Exposure levels (1-4)
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Exposure, LevelValue = 1, LevelName = "Slightly Exposed", Description = "Minimal exposure", ColorCode = "#28a745", Multiplier = 0.25m },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Exposure, LevelValue = 2, LevelName = "Exposed", Description = "Limited exposure", ColorCode = "#20c997", Multiplier = 0.5m },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Exposure, LevelValue = 3, LevelName = "Highly Exposed", Description = "High exposure", ColorCode = "#fd7e14", Multiplier = 0.75m },
                new RiskMatrixLevel { RiskMatrixId = matrixId, LevelType = RiskMatrixLevelType.Exposure, LevelValue = 4, LevelName = "Extremely Exposed", Description = "Maximum exposure", ColorCode = "#dc3545", Multiplier = 1.0m }
            };

            _context.RiskMatrixLevels.AddRange(levels);
            await _context.SaveChangesAsync();
        }

        private static RiskLevel CalculateRiskLevelFromScore(decimal score, int matrixSize)
        {
            var maxScore = matrixSize * matrixSize;
            var normalized = score / maxScore;

            return normalized switch
            {
                >= 0.8m => RiskLevel.Critical,
                >= 0.6m => RiskLevel.High,
                >= 0.4m => RiskLevel.Medium,
                _ => RiskLevel.Low
            };
        }

        private static decimal GetExposureMultiplier(int exposureLevel)
        {
            return exposureLevel switch
            {
                1 => 0.2m,
                2 => 0.4m,
                3 => 0.8m,
                4 => 1.0m,
                5 => 1.2m,
                _ => 1.0m
            };
        }

        private static string GetRiskLevelColor(RiskLevel riskLevel)
        {
            return riskLevel switch
            {
                RiskLevel.Low => "#28a745",
                RiskLevel.Medium => "#ffc107",
                RiskLevel.High => "#fd7e14",
                RiskLevel.Critical => "#dc3545",
                _ => "#6c757d"
            };
        }

        // Threshold management methods (replaces RiskLevelSettings functionality)
        public async Task<RiskMatrix> UpdateThresholdsAsync(int matrixId, decimal mediumThreshold, decimal highThreshold, decimal criticalThreshold, decimal riskAppetiteThreshold)
        {
            var matrix = await _context.RiskMatrices.FindAsync(matrixId);
            if (matrix == null) throw new InvalidOperationException("Matrix not found");

            matrix.QualitativeMediumThreshold = mediumThreshold;
            matrix.QualitativeHighThreshold = highThreshold;
            matrix.QualitativeCriticalThreshold = criticalThreshold;
            matrix.RiskAppetiteThreshold = riskAppetiteThreshold;
            matrix.UpdatedAt = DateTime.UtcNow;

            _context.RiskMatrices.Update(matrix);
            await _context.SaveChangesAsync();
            
            return matrix;
        }

        public async Task<RiskLevel> GetRiskLevelFromScoreAsync(decimal score)
        {
            var defaultMatrix = await GetDefaultMatrixAsync();
            if (defaultMatrix == null) return RiskLevel.Medium; // fallback

            return defaultMatrix.GetRiskLevel(score);
        }

        public async Task<bool> IsWithinRiskAppetiteAsync(decimal score)
        {
            var defaultMatrix = await GetDefaultMatrixAsync();
            if (defaultMatrix == null) return false; // conservative fallback

            return defaultMatrix.IsWithinRiskAppetite(score);
        }

        public async Task<string> GetRiskAppetiteStatusAsync(decimal score)
        {
            var defaultMatrix = await GetDefaultMatrixAsync();
            if (defaultMatrix == null) return "Unknown"; // fallback

            return defaultMatrix.GetRiskAppetiteStatus(score);
        }

        // New method to update both thresholds and SLA configuration
        public async Task<RiskMatrix> UpdateThresholdsAndSlaAsync(int matrixId, decimal mediumThreshold, 
            decimal highThreshold, decimal criticalThreshold, decimal riskAppetiteThreshold, 
            int criticalSla, int highSla, int mediumSla, int lowSla)
        {
            var matrix = await _context.RiskMatrices.FindAsync(matrixId);
            if (matrix == null)
                throw new InvalidOperationException("Matrix not found");

            // Update thresholds
            matrix.QualitativeMediumThreshold = mediumThreshold;
            matrix.QualitativeHighThreshold = highThreshold;
            matrix.QualitativeCriticalThreshold = criticalThreshold;
            matrix.RiskAppetiteThreshold = riskAppetiteThreshold;

            // Update SLA configuration
            matrix.CriticalRiskSlaHours = criticalSla;
            matrix.HighRiskSlaHours = highSla;
            matrix.MediumRiskSlaHours = mediumSla;
            matrix.LowRiskSlaHours = lowSla;

            matrix.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return matrix;
        }

        // SLA Management Methods
        public async Task<int> GetSlaHoursForRiskLevelAsync(RiskLevel riskLevel)
        {
            var defaultMatrix = await GetDefaultMatrixAsync();
            if (defaultMatrix == null) 
            {
                // Fallback defaults if no matrix is found
                return riskLevel switch
                {
                    RiskLevel.Critical => 4,
                    RiskLevel.High => 24,
                    RiskLevel.Medium => 168,
                    RiskLevel.Low => 720,
                    _ => 720
                };
            }

            return defaultMatrix.GetSlaHoursForRiskLevel(riskLevel);
        }

        public async Task<DateTime> CalculateSlaDeadlineAsync(DateTime fromDate, RiskLevel riskLevel)
        {
            var slaHours = await GetSlaHoursForRiskLevelAsync(riskLevel);
            return fromDate.AddHours(slaHours);
        }

        public async Task<bool> IsSlaBreachedAsync(DateTime createdDate, RiskLevel riskLevel, DateTime? resolvedDate = null)
        {
            var deadline = await CalculateSlaDeadlineAsync(createdDate, riskLevel);
            var checkDate = resolvedDate ?? DateTime.UtcNow;
            return checkDate > deadline;
        }
    }
}