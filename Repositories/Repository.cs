using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace CyberRiskApp.Repositories
{
    /// <summary>
    /// Generic repository implementation with automatic audit field handling
    /// </summary>
    public class Repository<T> : IRepository<T> where T : class, IAuditableEntity
    {
        protected readonly CyberRiskContext _context;
        protected readonly DbSet<T> _dbSet;

        public Repository(CyberRiskContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _dbSet = _context.Set<T>();
        }

        // Basic CRUD operations
        public virtual async Task<T?> GetByIdAsync(int id)
        {
            return await _dbSet.FindAsync(id);
        }

        public virtual async Task<T?> GetByIdWithIncludesAsync(int id, params Expression<Func<T, object>>[] includes)
        {
            IQueryable<T> query = _dbSet;
            
            foreach (var include in includes)
            {
                query = query.Include(include);
            }
            
            return await query.FirstOrDefaultAsync(e => e.Id == id);
        }

        public virtual async Task<IEnumerable<T>> GetAllAsync()
        {
            return await _dbSet.ToListAsync();
        }

        public virtual async Task<IEnumerable<T>> GetAllWithIncludesAsync(params Expression<Func<T, object>>[] includes)
        {
            IQueryable<T> query = _dbSet;
            
            foreach (var include in includes)
            {
                query = query.Include(include);
            }
            
            return await query.ToListAsync();
        }

        // Query operations
        public virtual async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate)
        {
            return await _dbSet.Where(predicate).ToListAsync();
        }

        public virtual async Task<IEnumerable<T>> FindWithIncludesAsync(
            Expression<Func<T, bool>> predicate, 
            params Expression<Func<T, object>>[] includes)
        {
            IQueryable<T> query = _dbSet;
            
            foreach (var include in includes)
            {
                query = query.Include(include);
            }
            
            return await query.Where(predicate).ToListAsync();
        }

        public virtual async Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate)
        {
            return await _dbSet.FirstOrDefaultAsync(predicate);
        }

        public virtual async Task<T?> FirstOrDefaultWithIncludesAsync(
            Expression<Func<T, bool>> predicate,
            params Expression<Func<T, object>>[] includes)
        {
            IQueryable<T> query = _dbSet;
            
            foreach (var include in includes)
            {
                query = query.Include(include);
            }
            
            return await query.FirstOrDefaultAsync(predicate);
        }

        // Count and existence
        public virtual async Task<int> CountAsync()
        {
            return await _dbSet.CountAsync();
        }

        public virtual async Task<int> CountAsync(Expression<Func<T, bool>> predicate)
        {
            return await _dbSet.CountAsync(predicate);
        }

        public virtual async Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate)
        {
            return await _dbSet.AnyAsync(predicate);
        }

        // Paging support
        public virtual async Task<IEnumerable<T>> GetPagedAsync(int pageNumber, int pageSize)
        {
            return await _dbSet
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        public virtual async Task<IEnumerable<T>> GetPagedAsync(
            Expression<Func<T, bool>> predicate, 
            int pageNumber, 
            int pageSize)
        {
            return await _dbSet
                .Where(predicate)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        public virtual async Task<IEnumerable<T>> GetPagedWithSortAsync<TKey>(
            Expression<Func<T, bool>> predicate,
            Expression<Func<T, TKey>> orderBy,
            bool ascending,
            int pageNumber,
            int pageSize)
        {
            var query = _dbSet.Where(predicate);
            
            query = ascending 
                ? query.OrderBy(orderBy) 
                : query.OrderByDescending(orderBy);
            
            return await query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        // Modification operations with audit handling
        public virtual async Task<T> CreateAsync(T entity, string userId)
        {
            SetAuditFieldsForCreate(entity, userId);
            _dbSet.Add(entity);
            await _context.SaveChangesAsync();
            return entity;
        }

        public virtual async Task<IEnumerable<T>> CreateManyAsync(IEnumerable<T> entities, string userId)
        {
            var entityList = entities.ToList();
            
            foreach (var entity in entityList)
            {
                SetAuditFieldsForCreate(entity, userId);
            }
            
            _dbSet.AddRange(entityList);
            await _context.SaveChangesAsync();
            return entityList;
        }

        public virtual async Task<T> UpdateAsync(T entity, string userId)
        {
            SetAuditFieldsForUpdate(entity, userId);
            _dbSet.Update(entity);
            await _context.SaveChangesAsync();
            return entity;
        }

        public virtual async Task<IEnumerable<T>> UpdateManyAsync(IEnumerable<T> entities, string userId)
        {
            var entityList = entities.ToList();
            
            foreach (var entity in entityList)
            {
                SetAuditFieldsForUpdate(entity, userId);
            }
            
            _dbSet.UpdateRange(entityList);
            await _context.SaveChangesAsync();
            return entityList;
        }

        public virtual async Task<bool> DeleteAsync(int id)
        {
            var entity = await GetByIdAsync(id);
            if (entity == null) return false;
            
            _dbSet.Remove(entity);
            await _context.SaveChangesAsync();
            return true;
        }

        public virtual async Task<int> DeleteManyAsync(Expression<Func<T, bool>> predicate)
        {
            var entities = await _dbSet.Where(predicate).ToListAsync();
            _dbSet.RemoveRange(entities);
            await _context.SaveChangesAsync();
            return entities.Count;
        }

        // Soft delete support (if needed in future)
        public virtual async Task<bool> SoftDeleteAsync(int id, string userId)
        {
            var entity = await GetByIdAsync(id);
            if (entity == null) return false;
            
            // If soft delete is implemented, set IsDeleted = true and DeletedBy/DeletedAt
            // For now, perform hard delete
            return await DeleteAsync(id);
        }

        public virtual async Task<int> SoftDeleteManyAsync(Expression<Func<T, bool>> predicate, string userId)
        {
            // If soft delete is implemented, update entities instead of removing
            // For now, perform hard delete
            return await DeleteManyAsync(predicate);
        }

        // Advanced querying
        public virtual IQueryable<T> Query()
        {
            return _dbSet.AsQueryable();
        }

        public virtual IQueryable<T> QueryWithIncludes(params Expression<Func<T, object>>[] includes)
        {
            IQueryable<T> query = _dbSet;
            
            foreach (var include in includes)
            {
                query = query.Include(include);
            }
            
            return query;
        }

        // Private helper methods for audit field management
        private void SetAuditFieldsForCreate(T entity, string userId)
        {
            var now = DateTime.UtcNow;
            entity.CreatedAt = now;
            entity.UpdatedAt = now;
            entity.CreatedBy = userId;
            entity.UpdatedBy = userId;
        }

        private void SetAuditFieldsForUpdate(T entity, string userId)
        {
            entity.UpdatedAt = DateTime.UtcNow;
            entity.UpdatedBy = userId;
            // Don't modify CreatedAt and CreatedBy
        }
    }
}