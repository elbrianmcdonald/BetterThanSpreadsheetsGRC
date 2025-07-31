using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IRiskMatrixService
    {
        Task<IEnumerable<RiskMatrix>> GetAllMatricesAsync();
        Task<RiskMatrix?> GetMatrixByIdAsync(int id);
        Task<RiskMatrix?> GetDefaultMatrixAsync();
        Task<RiskMatrix> CreateMatrixAsync(RiskMatrix matrix);
        Task<RiskMatrix> UpdateMatrixAsync(RiskMatrix matrix);
        Task DeleteMatrixAsync(int id);
        Task<RiskMatrix> SetDefaultMatrixAsync(int id);
        
        // Matrix level management
        Task<RiskMatrixLevel> CreateLevelAsync(RiskMatrixLevel level);
        Task<RiskMatrixLevel> UpdateLevelAsync(RiskMatrixLevel level);
        Task DeleteLevelAsync(int id);
        Task<IEnumerable<RiskMatrixLevel>> GetLevelsByMatrixIdAsync(int matrixId);
        Task SaveLevelsAsync(int matrixId, List<RiskMatrixLevel> levels);
        
        // Matrix cell management
        Task<RiskMatrixCell> CreateCellAsync(RiskMatrixCell cell);
        Task<RiskMatrixCell> UpdateCellAsync(RiskMatrixCell cell);
        Task DeleteCellAsync(int id);
        Task<IEnumerable<RiskMatrixCell>> GetCellsByMatrixIdAsync(int matrixId);
        Task GenerateMatrixCellsAsync(int matrixId);
        
        // Risk calculation
        Task<RiskLevel> CalculateRiskLevelAsync(int matrixId, int impact, int likelihood, int? exposure = null);
        Task<decimal> CalculateRiskScoreAsync(int matrixId, int impact, int likelihood, int? exposure = null);
        
        // Matrix validation and seeding
        Task<bool> ValidateMatrixAsync(RiskMatrix matrix);
        Task SeedDefaultMatricesAsync();
    }
}