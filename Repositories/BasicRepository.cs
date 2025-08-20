using System.Linq.Expressions;
using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Repositories
{
    /// <summary>
    /// Basic repository implementation for entities that don't implement IAuditableEntity
    /// Provides standard CRUD operations without audit tracking
    /// </summary>
    /// <typeparam name="T">Entity type that implements IEntity</typeparam>
    public class BasicRepository<T> : IBasicRepository<T> where T : class, IEntity
    {
        protected readonly CyberRiskContext _context;
        protected readonly DbSet<T> _dbSet;

        public BasicRepository(CyberRiskContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _dbSet = context.Set<T>();
        }

        // Basic CRUD operations
        public virtual async Task<IEnumerable<T>> GetAllAsync()
        {
            return await _dbSet.ToListAsync();
        }

        public virtual async Task<T?> GetByIdAsync(int id)
        {
            return await _dbSet.FindAsync(id);
        }

        public virtual async Task<T> CreateAsync(T entity)
        {
            var entry = await _dbSet.AddAsync(entity);
            await _context.SaveChangesAsync();
            return entry.Entity;
        }

        public virtual async Task<T> UpdateAsync(T entity)
        {
            _dbSet.Update(entity);
            await _context.SaveChangesAsync();
            return entity;
        }

        public virtual async Task<bool> DeleteAsync(int id)
        {
            var entity = await GetByIdAsync(id);
            if (entity == null) return false;

            _dbSet.Remove(entity);
            await _context.SaveChangesAsync();
            return true;
        }

        // Query operations
        public virtual async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate)
        {
            return await _dbSet.Where(predicate).ToListAsync();
        }

        public virtual async Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate)
        {
            return await _dbSet.FirstOrDefaultAsync(predicate);
        }

        public virtual async Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate)
        {
            return await _dbSet.AnyAsync(predicate);
        }

        public virtual async Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null)
        {
            return predicate == null 
                ? await _dbSet.CountAsync() 
                : await _dbSet.CountAsync(predicate);
        }

        // Bulk operations
        public virtual async Task<int> BulkCreateAsync(IEnumerable<T> entities)
        {
            var entitiesList = entities.ToList();
            await _dbSet.AddRangeAsync(entitiesList);
            await _context.SaveChangesAsync();
            return entitiesList.Count;
        }

        public virtual async Task<int> BulkUpdateAsync(IEnumerable<T> entities)
        {
            var entitiesList = entities.ToList();
            _dbSet.UpdateRange(entitiesList);
            await _context.SaveChangesAsync();
            return entitiesList.Count;
        }

        public virtual async Task<int> BulkDeleteAsync(IEnumerable<int> ids)
        {
            var idsList = ids.ToList();
            var entities = await _dbSet.Where(e => idsList.Contains(e.Id)).ToListAsync();
            
            if (!entities.Any()) return 0;

            _dbSet.RemoveRange(entities);
            await _context.SaveChangesAsync();
            return entities.Count;
        }
    }
}