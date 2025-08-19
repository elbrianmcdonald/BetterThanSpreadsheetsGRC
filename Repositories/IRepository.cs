using CyberRiskApp.Models;
using System.Linq.Expressions;

namespace CyberRiskApp.Repositories
{
    /// <summary>
    /// Generic repository interface for entities that implement IAuditableEntity
    /// </summary>
    public interface IRepository<T> where T : class, IAuditableEntity
    {
        // Basic CRUD operations
        Task<T?> GetByIdAsync(int id);
        Task<T?> GetByIdWithIncludesAsync(int id, params Expression<Func<T, object>>[] includes);
        Task<IEnumerable<T>> GetAllAsync();
        Task<IEnumerable<T>> GetAllWithIncludesAsync(params Expression<Func<T, object>>[] includes);
        
        // Query operations
        Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate);
        Task<IEnumerable<T>> FindWithIncludesAsync(
            Expression<Func<T, bool>> predicate, 
            params Expression<Func<T, object>>[] includes);
        
        Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate);
        Task<T?> FirstOrDefaultWithIncludesAsync(
            Expression<Func<T, bool>> predicate,
            params Expression<Func<T, object>>[] includes);
        
        // Count and existence
        Task<int> CountAsync();
        Task<int> CountAsync(Expression<Func<T, bool>> predicate);
        Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate);
        
        // Paging support
        Task<IEnumerable<T>> GetPagedAsync(int pageNumber, int pageSize);
        Task<IEnumerable<T>> GetPagedAsync(
            Expression<Func<T, bool>> predicate, 
            int pageNumber, 
            int pageSize);
        Task<IEnumerable<T>> GetPagedWithSortAsync<TKey>(
            Expression<Func<T, bool>> predicate,
            Expression<Func<T, TKey>> orderBy,
            bool ascending,
            int pageNumber,
            int pageSize);
        
        // Modification operations
        Task<T> CreateAsync(T entity, string userId);
        Task<IEnumerable<T>> CreateManyAsync(IEnumerable<T> entities, string userId);
        Task<T> UpdateAsync(T entity, string userId);
        Task<IEnumerable<T>> UpdateManyAsync(IEnumerable<T> entities, string userId);
        Task<bool> DeleteAsync(int id);
        Task<int> DeleteManyAsync(Expression<Func<T, bool>> predicate);
        
        // Soft delete support (if implemented)
        Task<bool> SoftDeleteAsync(int id, string userId);
        Task<int> SoftDeleteManyAsync(Expression<Func<T, bool>> predicate, string userId);
        
        // Advanced querying
        IQueryable<T> Query();
        IQueryable<T> QueryWithIncludes(params Expression<Func<T, object>>[] includes);
    }
}