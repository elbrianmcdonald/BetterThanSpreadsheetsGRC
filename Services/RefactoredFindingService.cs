using CyberRiskApp.Models;
using CyberRiskApp.Repositories;

namespace CyberRiskApp.Services
{
    /// <summary>
    /// Refactored Finding Service using Repository Pattern and Unit of Work
    /// This demonstrates how to migrate from direct DbContext access to repository pattern
    /// </summary>
    public class RefactoredFindingService : IFindingService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IAuditService _auditService;

        public RefactoredFindingService(IUnitOfWork unitOfWork, IAuditService auditService)
        {
            _unitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
            _auditService = auditService ?? throw new ArgumentNullException(nameof(auditService));
        }

        // Basic CRUD operations using repository
        public async Task<IEnumerable<Finding>> GetAllFindingsAsync()
        {
            try
            {
                return await _unitOfWork.Findings.GetAllAsync();
            }
            catch
            {
                return new List<Finding>();
            }
        }

        public async Task<IEnumerable<Finding>> GetFindingsAsync(FindingStatus? status = null)
        {
            try
            {
                if (status.HasValue)
                {
                    return await _unitOfWork.Findings.GetFindingsByStatusAsync(status.Value);
                }
                return await _unitOfWork.Findings.GetAllAsync();
            }
            catch
            {
                return new List<Finding>();
            }
        }

        public async Task<Finding?> GetFindingByIdAsync(int id)
        {
            try
            {
                return await _unitOfWork.Findings.GetByIdAsync(id);
            }
            catch
            {
                return null;
            }
        }

        // Domain-specific operations using specialized repository methods
        public async Task<IEnumerable<Finding>> GetFindingsByDomainAsync(string domain)
        {
            try
            {
                return await _unitOfWork.Findings.GetFindingsByDomainAsync(domain);
            }
            catch
            {
                return new List<Finding>();
            }
        }

        public async Task<IEnumerable<Finding>> GetFindingsByAssetAsync(string asset)
        {
            try
            {
                return await _unitOfWork.Findings.GetFindingsByAssetAsync(asset);
            }
            catch
            {
                return new List<Finding>();
            }
        }

        public async Task<IEnumerable<Finding>> GetOverdueFindingsAsync()
        {
            try
            {
                return await _unitOfWork.Findings.GetOverdueFindingsAsync();
            }
            catch
            {
                return new List<Finding>();
            }
        }

        public async Task<IEnumerable<Finding>> GetCriticalFindingsAsync()
        {
            try
            {
                return await _unitOfWork.Findings.GetCriticalFindingsAsync();
            }
            catch
            {
                return new List<Finding>();
            }
        }

        // Advanced filtering using repository methods
        public async Task<IEnumerable<Finding>> GetFindingsWithFiltersAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? businessUnit = null,
            string? domain = null,
            string? asset = null,
            string? assignedTo = null,
            RiskRating? minRiskRating = null,
            FindingStatus? status = null,
            bool? showOverdueOnly = null)
        {
            try
            {
                return await _unitOfWork.Findings.GetFindingsWithFiltersAsync(
                    startDate, endDate, businessUnit, domain, asset,
                    assignedTo, minRiskRating, status, showOverdueOnly);
            }
            catch
            {
                return new List<Finding>();
            }
        }

        // CRUD operations with transaction management
        public async Task<Finding> CreateFindingAsync(Finding finding)
        {
            try
            {
                var currentUser = _auditService.GetCurrentUser();
                await _unitOfWork.BeginTransactionAsync();

                var createdFinding = await _unitOfWork.Findings.CreateAsync(finding, currentUser);
                
                // Note: Audit logging would be implemented here if needed
                
                await _unitOfWork.CommitTransactionAsync();
                return createdFinding;
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }
        }

        public async Task<Finding> UpdateFindingAsync(Finding finding)
        {
            try
            {
                var currentUser = _auditService.GetCurrentUser();
                await _unitOfWork.BeginTransactionAsync();

                var updatedFinding = await _unitOfWork.Findings.UpdateAsync(finding, currentUser);
                
                // Note: Audit logging would be implemented here if needed
                
                await _unitOfWork.CommitTransactionAsync();
                return updatedFinding;
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }
        }

        public async Task<bool> DeleteFindingAsync(int id)
        {
            try
            {
                var currentUser = _auditService.GetCurrentUser();
                await _unitOfWork.BeginTransactionAsync();

                var result = await _unitOfWork.Findings.DeleteAsync(id);
                
                // Note: Audit logging would be implemented here if needed
                
                await _unitOfWork.CommitTransactionAsync();
                return result;
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }
        }

        // Business logic operations using repository methods
        public async Task<bool> UpdateFindingStatusAsync(int findingId, FindingStatus newStatus)
        {
            try
            {
                var currentUser = _auditService.GetCurrentUser();
                await _unitOfWork.BeginTransactionAsync();

                var result = await _unitOfWork.Findings.UpdateFindingStatusAsync(findingId, newStatus, currentUser);
                
                // Note: Audit logging would be implemented here if needed
                
                await _unitOfWork.CommitTransactionAsync();
                return result;
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }
        }

        public async Task<bool> AssignFindingAsync(int findingId, string assignedTo)
        {
            try
            {
                var currentUser = _auditService.GetCurrentUser();
                await _unitOfWork.BeginTransactionAsync();

                var result = await _unitOfWork.Findings.AssignFindingAsync(findingId, assignedTo, currentUser);
                
                // Note: Audit logging would be implemented here if needed
                
                await _unitOfWork.CommitTransactionAsync();
                return result;
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }
        }

        // Bulk operations with improved transaction handling
        public async Task<int> BulkUpdateFindingStatusAsync(IEnumerable<int> findingIds, FindingStatus newStatus)
        {
            try
            {
                var currentUser = _auditService.GetCurrentUser();
                await _unitOfWork.BeginTransactionAsync();

                var result = await _unitOfWork.Findings.BulkUpdateStatusAsync(findingIds, newStatus, currentUser);
                
                // Note: Audit logging would be implemented here if needed
                
                await _unitOfWork.CommitTransactionAsync();
                return result;
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }
        }

        // Statistical methods using repository analytics
        public async Task<Dictionary<FindingStatus, int>> GetFindingsCountByStatusAsync()
        {
            try
            {
                return await _unitOfWork.Findings.GetFindingsCountByStatusAsync();
            }
            catch
            {
                return new Dictionary<FindingStatus, int>();
            }
        }

        public async Task<Dictionary<RiskRating, int>> GetFindingsCountByRiskRatingAsync()
        {
            try
            {
                return await _unitOfWork.Findings.GetFindingsCountByRiskRatingAsync();
            }
            catch
            {
                return new Dictionary<RiskRating, int>();
            }
        }

        public async Task<Dictionary<string, int>> GetFindingsCountByDomainAsync()
        {
            try
            {
                return await _unitOfWork.Findings.GetFindingsCountByDomainAsync();
            }
            catch
            {
                return new Dictionary<string, int>();
            }
        }

        // Example of complex business logic using multiple repositories
        public async Task<bool> CloseFindingWithRiskAssessmentAsync(int findingId, string closureNotes)
        {
            try
            {
                var currentUser = _auditService.GetCurrentUser();
                await _unitOfWork.BeginTransactionAsync();

                // Get the finding
                var finding = await _unitOfWork.Findings.GetByIdAsync(findingId);
                if (finding == null) return false;

                // Update finding status
                await _unitOfWork.Findings.UpdateFindingStatusAsync(findingId, FindingStatus.Closed, currentUser);

                // If finding has associated risks, update them
                var risks = await _unitOfWork.Risks.FindAsync(r => r.Asset == finding.Asset && r.BusinessUnit == finding.BusinessUnit);
                foreach (var risk in risks)
                {
                    // Use Closed status instead of Mitigated (which doesn't exist)
                    await _unitOfWork.Risks.UpdateRiskStatusAsync(risk.Id, RiskStatus.Closed, currentUser);
                }

                // Note: Audit logging would be implemented here if needed
                
                await _unitOfWork.CommitTransactionAsync();
                return true;
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }
        }

        // Additional required interface methods
        public async Task<string> GenerateFindingNumberAsync()
        {
            try
            {
                var currentYear = DateTime.UtcNow.Year;
                var findingsThisYear = await _unitOfWork.Findings.CountAsync(f => f.CreatedAt.Year == currentYear);
                return $"F-{currentYear}-{(findingsThisYear + 1):D4}";
            }
            catch
            {
                // Fallback to timestamp-based number
                return $"F-{DateTime.UtcNow:yyyyMMdd}-{DateTime.UtcNow:HHmmss}";
            }
        }

        public async Task<IEnumerable<Finding>> GetOpenFindingsAsync()
        {
            try
            {
                return await _unitOfWork.Findings.GetFindingsByStatusAsync(FindingStatus.Open);
            }
            catch
            {
                return new List<Finding>();
            }
        }

        public async Task<IEnumerable<Finding>> GetClosedFindingsAsync()
        {
            try
            {
                return await _unitOfWork.Findings.GetFindingsByStatusAsync(FindingStatus.Closed);
            }
            catch
            {
                return new List<Finding>();
            }
        }

        public async Task<bool> CloseFindingAsync(int id, string closureNotes = "")
        {
            try
            {
                var currentUser = _auditService.GetCurrentUser();
                await _unitOfWork.BeginTransactionAsync();

                var result = await _unitOfWork.Findings.UpdateFindingStatusAsync(id, FindingStatus.Closed, currentUser);
                
                // Note: Audit logging would be implemented here if needed
                
                await _unitOfWork.CommitTransactionAsync();
                return result;
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }
        }
    }
}