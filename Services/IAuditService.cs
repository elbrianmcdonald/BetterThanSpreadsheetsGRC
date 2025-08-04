using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public interface IAuditService
    {
        void SetAuditFields(IAuditableEntity entity, string currentUser, bool isUpdate = false);
        Task<bool> HandleConcurrencyException<T>(DbUpdateConcurrencyException ex, T entity) where T : class, IAuditableEntity;
        string GetCurrentUser();
    }
    
    public class AuditService : IAuditService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;
        
        public AuditService(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }
        
        public void SetAuditFields(IAuditableEntity entity, string currentUser, bool isUpdate = false)
        {
            var now = DateTime.UtcNow;
            var user = !string.IsNullOrEmpty(currentUser) ? currentUser : "System";
            
            if (!isUpdate)
            {
                entity.CreatedAt = now;
                entity.CreatedBy = user;
            }
            
            entity.UpdatedAt = now;
            entity.UpdatedBy = user;
        }
        
        public string GetCurrentUser()
        {
            try
            {
                var httpContext = _httpContextAccessor.HttpContext;
                if (httpContext?.User?.Identity?.IsAuthenticated == true)
                {
                    // Try to get the username from the identity
                    var username = httpContext.User.Identity.Name;
                    if (!string.IsNullOrEmpty(username))
                    {
                        return username;
                    }
                    
                    // Fallback: try to get email claim if username is not available
                    var emailClaim = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.Email);
                    if (emailClaim != null && !string.IsNullOrEmpty(emailClaim.Value))
                    {
                        return emailClaim.Value;
                    }
                }
                
                return "System";
            }
            catch
            {
                return "System";
            }
        }
        
        public async Task<bool> HandleConcurrencyException<T>(DbUpdateConcurrencyException ex, T entity) where T : class, IAuditableEntity
        {
            try
            {
                // Get the database values
                var entry = ex.Entries.Single();
                var databaseEntry = entry.GetDatabaseValues();
                
                if (databaseEntry == null)
                {
                    // Entity was deleted by another user
                    return false;
                }
                
                // For now, we'll use a simple "last writer wins" approach
                // In a production system, you might want to implement merge logic
                entry.OriginalValues.SetValues(databaseEntry);
                
                // Update audit fields for the retry
                SetAuditFields(entity, GetCurrentUser(), true);
                
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}