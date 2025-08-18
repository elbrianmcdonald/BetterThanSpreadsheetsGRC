using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using CyberRiskApp.Data;

namespace CyberRiskApp.Services
{
    public interface ITransactionService
    {
        Task<T> ExecuteInTransactionAsync<T>(Func<Task<T>> operation);
        Task ExecuteInTransactionAsync(Func<Task> operation);
    }
    
    public class TransactionService : ITransactionService
    {
        private readonly CyberRiskContext _context;
        
        public TransactionService(CyberRiskContext context)
        {
            _context = context;
        }
        
        public async Task<T> ExecuteInTransactionAsync<T>(Func<Task<T>> operation)
        {
            // Use execution strategy to handle PostgreSQL retry logic properly
            var strategy = _context.Database.CreateExecutionStrategy();
            
            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    var result = await operation();
                    await transaction.CommitAsync();
                    return result;
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            });
        }
        
        public async Task ExecuteInTransactionAsync(Func<Task> operation)
        {
            // Use execution strategy to handle PostgreSQL retry logic properly
            var strategy = _context.Database.CreateExecutionStrategy();
            
            await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    await operation();
                    await transaction.CommitAsync();
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            });
        }
    }
}