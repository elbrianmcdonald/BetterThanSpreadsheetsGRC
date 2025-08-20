using CyberRiskApp.Models;

namespace CyberRiskApp.Repositories
{
    /// <summary>
    /// Unit of Work pattern interface for managing database transactions
    /// and coordinating multiple repository operations
    /// </summary>
    public interface IUnitOfWork : IDisposable
    {
        // Repository properties for core entities
        IFindingRepository Findings { get; }
        IRiskRepository Risks { get; }
        IComplianceAssessmentRepository ComplianceAssessments { get; }
        IRepository<ControlAssessment> ControlAssessments { get; }
        
        // Non-auditable entity repositories (basic CRUD only)
        IBasicRepository<ComplianceFramework> ComplianceFrameworks { get; }
        IBasicRepository<ComplianceControl> ComplianceControls { get; }
        IBasicRepository<BusinessOrganization> BusinessOrganizations { get; }
        IRepository<RiskBacklogEntry> RiskBacklogEntries { get; }
        IRepository<RiskBacklogActivity> RiskBacklogActivities { get; }
        
        // Maturity assessment repositories
        IRepository<MaturityAssessment> MaturityAssessments { get; }
        
        // Non-auditable entity repositories (basic CRUD only)
        IBasicRepository<AssessmentRequest> AssessmentRequests { get; }
        IBasicRepository<MaturityFramework> MaturityFrameworks { get; }
        IBasicRepository<MaturityControl> MaturityControls { get; }
        IRepository<MaturityControlAssessment> MaturityControlAssessments { get; }
        
        // Risk assessment repositories
        IRepository<RiskAssessment> RiskAssessments { get; }
        IRepository<ThreatScenario> ThreatScenarios { get; }
        
        // Transaction management
        Task<int> SaveChangesAsync();
        Task<int> SaveChangesAsync(CancellationToken cancellationToken);
        
        // Transaction scope management
        Task BeginTransactionAsync();
        Task CommitTransactionAsync();
        Task RollbackTransactionAsync();
        
        // Bulk operations across repositories
        Task<int> BulkSaveChangesAsync(CancellationToken cancellationToken = default);
        
        // Generic repository access for entities not covered above
        IRepository<T> Repository<T>() where T : class, IAuditableEntity;
        
        // Database state management
        Task<bool> HasPendingChangesAsync();
        void DetachAllEntities();
        Task ReloadEntityAsync<T>(T entity) where T : class, IAuditableEntity;
    }
}