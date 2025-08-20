using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace CyberRiskApp.Repositories
{
    /// <summary>
    /// Unit of Work implementation providing coordinated access to repositories
    /// and transaction management capabilities
    /// </summary>
    public class UnitOfWork : IUnitOfWork
    {
        private readonly CyberRiskContext _context;
        private IDbContextTransaction? _transaction;
        private bool _disposed = false;
        
        // Repository instances (lazy-loaded)
        private IFindingRepository? _findings;
        private IRiskRepository? _risks;
        private IComplianceAssessmentRepository? _complianceAssessments;
        private IRepository<ControlAssessment>? _controlAssessments;
        private IBasicRepository<ComplianceFramework>? _complianceFrameworks;
        private IBasicRepository<ComplianceControl>? _complianceControls;
        private IBasicRepository<BusinessOrganization>? _businessOrganizations;
        private IBasicRepository<AssessmentRequest>? _assessmentRequests;
        private IRepository<RiskBacklogEntry>? _riskBacklogEntries;
        private IRepository<RiskBacklogActivity>? _riskBacklogActivities;
        private IRepository<MaturityAssessment>? _maturityAssessments;
        private IBasicRepository<MaturityFramework>? _maturityFrameworks;
        private IBasicRepository<MaturityControl>? _maturityControls;
        private IRepository<MaturityControlAssessment>? _maturityControlAssessments;
        private IRepository<RiskAssessment>? _riskAssessments;
        private IRepository<ThreatScenario>? _threatScenarios;
        
        // Generic repository cache
        private readonly Dictionary<Type, object> _repositories = new();

        public UnitOfWork(CyberRiskContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        // Repository properties (lazy initialization)
        public IFindingRepository Findings
        {
            get { return _findings ??= new FindingRepository(_context); }
        }

        public IRiskRepository Risks
        {
            get { return _risks ??= new RiskRepository(_context); }
        }

        public IComplianceAssessmentRepository ComplianceAssessments
        {
            get { return _complianceAssessments ??= new ComplianceAssessmentRepository(_context); }
        }

        public IRepository<ControlAssessment> ControlAssessments
        {
            get { return _controlAssessments ??= new Repository<ControlAssessment>(_context); }
        }

        public IBasicRepository<ComplianceFramework> ComplianceFrameworks
        {
            get { return _complianceFrameworks ??= new BasicRepository<ComplianceFramework>(_context); }
        }

        public IBasicRepository<ComplianceControl> ComplianceControls
        {
            get { return _complianceControls ??= new BasicRepository<ComplianceControl>(_context); }
        }

        public IBasicRepository<BusinessOrganization> BusinessOrganizations
        {
            get { return _businessOrganizations ??= new BasicRepository<BusinessOrganization>(_context); }
        }

        public IBasicRepository<AssessmentRequest> AssessmentRequests
        {
            get { return _assessmentRequests ??= new BasicRepository<AssessmentRequest>(_context); }
        }

        public IRepository<RiskBacklogEntry> RiskBacklogEntries
        {
            get { return _riskBacklogEntries ??= new Repository<RiskBacklogEntry>(_context); }
        }

        public IRepository<RiskBacklogActivity> RiskBacklogActivities
        {
            get { return _riskBacklogActivities ??= new Repository<RiskBacklogActivity>(_context); }
        }

        public IRepository<MaturityAssessment> MaturityAssessments
        {
            get { return _maturityAssessments ??= new Repository<MaturityAssessment>(_context); }
        }

        public IBasicRepository<MaturityFramework> MaturityFrameworks
        {
            get { return _maturityFrameworks ??= new BasicRepository<MaturityFramework>(_context); }
        }

        public IBasicRepository<MaturityControl> MaturityControls
        {
            get { return _maturityControls ??= new BasicRepository<MaturityControl>(_context); }
        }

        public IRepository<MaturityControlAssessment> MaturityControlAssessments
        {
            get { return _maturityControlAssessments ??= new Repository<MaturityControlAssessment>(_context); }
        }

        public IRepository<RiskAssessment> RiskAssessments
        {
            get { return _riskAssessments ??= new Repository<RiskAssessment>(_context); }
        }

        public IRepository<ThreatScenario> ThreatScenarios
        {
            get { return _threatScenarios ??= new Repository<ThreatScenario>(_context); }
        }

        // Generic repository access
        public IRepository<T> Repository<T>() where T : class, IAuditableEntity
        {
            var type = typeof(T);
            
            if (_repositories.ContainsKey(type))
            {
                return (IRepository<T>)_repositories[type];
            }

            var repository = new Repository<T>(_context);
            _repositories.Add(type, repository);
            return repository;
        }

        // Transaction management
        public async Task<int> SaveChangesAsync()
        {
            try
            {
                return await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                // Handle concurrency conflicts
                foreach (var entry in ex.Entries)
                {
                    if (entry.Entity is IAuditableEntity)
                    {
                        // Reload the entity from database
                        await entry.ReloadAsync();
                    }
                }
                throw;
            }
        }

        public async Task<int> SaveChangesAsync(CancellationToken cancellationToken)
        {
            try
            {
                return await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException ex)
            {
                // Handle concurrency conflicts
                foreach (var entry in ex.Entries)
                {
                    if (entry.Entity is IAuditableEntity)
                    {
                        // Reload the entity from database
                        await entry.ReloadAsync(cancellationToken);
                    }
                }
                throw;
            }
        }

        // Transaction scope management
        public async Task BeginTransactionAsync()
        {
            if (_transaction != null)
            {
                throw new InvalidOperationException("A transaction is already in progress.");
            }

            _transaction = await _context.Database.BeginTransactionAsync();
        }

        public async Task CommitTransactionAsync()
        {
            if (_transaction == null)
            {
                throw new InvalidOperationException("No transaction in progress.");
            }

            try
            {
                await SaveChangesAsync();
                await _transaction.CommitAsync();
            }
            catch
            {
                await _transaction.RollbackAsync();
                throw;
            }
            finally
            {
                _transaction.Dispose();
                _transaction = null;
            }
        }

        public async Task RollbackTransactionAsync()
        {
            if (_transaction == null)
            {
                throw new InvalidOperationException("No transaction in progress.");
            }

            try
            {
                await _transaction.RollbackAsync();
            }
            finally
            {
                _transaction.Dispose();
                _transaction = null;
            }
        }

        // Bulk operations
        public async Task<int> BulkSaveChangesAsync(CancellationToken cancellationToken = default)
        {
            try
            {
                // Disable change tracking for bulk operations to improve performance
                _context.ChangeTracker.AutoDetectChangesEnabled = false;
                var result = await _context.SaveChangesAsync(cancellationToken);
                _context.ChangeTracker.AutoDetectChangesEnabled = true;
                return result;
            }
            catch
            {
                // Re-enable change tracking on error
                _context.ChangeTracker.AutoDetectChangesEnabled = true;
                throw;
            }
        }

        // Database state management
        public async Task<bool> HasPendingChangesAsync()
        {
            return await Task.FromResult(_context.ChangeTracker.HasChanges());
        }

        public void DetachAllEntities()
        {
            var entries = _context.ChangeTracker.Entries()
                .Where(e => e.State != EntityState.Detached)
                .ToList();

            foreach (var entry in entries)
            {
                entry.State = EntityState.Detached;
            }
        }

        public async Task ReloadEntityAsync<T>(T entity) where T : class, IAuditableEntity
        {
            var entry = _context.Entry(entity);
            if (entry != null)
            {
                await entry.ReloadAsync();
            }
        }

        // Dispose pattern implementation
        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (!_disposed && disposing)
            {
                // Dispose transaction if still active
                if (_transaction != null)
                {
                    _transaction.Dispose();
                    _transaction = null;
                }

                // Context is managed by DI container, don't dispose here
                _disposed = true;
            }
        }

        ~UnitOfWork()
        {
            Dispose(false);
        }
    }
}