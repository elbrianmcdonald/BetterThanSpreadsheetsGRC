using System.Linq.Expressions;
using CyberRiskApp.Models;

namespace CyberRiskApp.Repositories
{
    /// <summary>
    /// Basic repository interface for entities that don't implement IAuditableEntity
    /// Provides standard CRUD operations without audit tracking
    /// </summary>
    /// <typeparam name="T">Entity type that implements IEntity</typeparam>
    public interface IBasicRepository<T> where T : class, IEntity
    {
        // Basic CRUD operations
        Task<IEnumerable<T>> GetAllAsync();
        Task<T?> GetByIdAsync(int id);
        Task<T> CreateAsync(T entity);
        Task<T> UpdateAsync(T entity);
        Task<bool> DeleteAsync(int id);

        // Query operations
        Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate);
        Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate);
        Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate);
        Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null);

        // Bulk operations
        Task<int> BulkCreateAsync(IEnumerable<T> entities);
        Task<int> BulkUpdateAsync(IEnumerable<T> entities);
        Task<int> BulkDeleteAsync(IEnumerable<int> ids);
    }
}