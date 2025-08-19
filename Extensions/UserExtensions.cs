using System.Security.Claims;

namespace CyberRiskApp.Extensions
{
    /// <summary>
    /// Extension methods for ClaimsPrincipal to simplify user identity operations
    /// </summary>
    public static class UserExtensions
    {
        /// <summary>
        /// Get user ID with fallback to "Unknown"
        /// Replaces: User.Identity?.Name ?? ""
        /// </summary>
        public static string GetUserId(this ClaimsPrincipal user)
        {
            return user.Identity?.Name ?? "Unknown";
        }

        /// <summary>
        /// Get user ID with custom fallback
        /// </summary>
        public static string GetUserId(this ClaimsPrincipal user, string fallback)
        {
            return user.Identity?.Name ?? fallback;
        }

        /// <summary>
        /// Get all user roles as list
        /// Replaces: User.Claims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value).ToList()
        /// </summary>
        public static List<string> GetUserRoles(this ClaimsPrincipal user)
        {
            return user.Claims
                .Where(c => c.Type == ClaimTypes.Role)
                .Select(c => c.Value)
                .ToList();
        }

        /// <summary>
        /// Get user roles as comma-separated string
        /// Replaces: string.Join(",", User.Claims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value))
        /// </summary>
        public static string GetUserRolesString(this ClaimsPrincipal user)
        {
            var roles = user.GetUserRoles();
            return roles.Any() ? string.Join(",", roles) : "";
        }

        /// <summary>
        /// Get user roles string with fallback logic for service calls
        /// </summary>
        public static string GetUserRolesForService(this ClaimsPrincipal user)
        {
            var roles = user.GetUserRoles();
            if (roles.Any())
                return string.Join(",", roles);

            // Fallback to checking IsInRole for backwards compatibility
            if (user.IsInRole("Admin")) return "Admin";
            if (user.IsInRole("GRCManager")) return "GRCManager";
            if (user.IsInRole("GRCAnalyst")) return "GRCAnalyst";
            
            return "";
        }

        /// <summary>
        /// Check if user has any of the specified roles
        /// </summary>
        public static bool HasAnyRole(this ClaimsPrincipal user, params string[] roles)
        {
            return roles.Any(role => user.IsInRole(role));
        }

        /// <summary>
        /// Check if user is admin
        /// </summary>
        public static bool IsAdmin(this ClaimsPrincipal user)
        {
            return user.IsInRole("Admin");
        }

        /// <summary>
        /// Check if user is manager (GRCManager or Admin)
        /// </summary>
        public static bool IsManager(this ClaimsPrincipal user)
        {
            return user.IsInRole("GRCManager") || user.IsAdmin();
        }

        /// <summary>
        /// Check if user is analyst (GRCAnalyst, GRCManager, or Admin)
        /// </summary>
        public static bool IsAnalyst(this ClaimsPrincipal user)
        {
            return user.IsInRole("GRCAnalyst") || user.IsManager();
        }

        /// <summary>
        /// Get user display name from claims
        /// </summary>
        public static string GetDisplayName(this ClaimsPrincipal user)
        {
            var firstName = user.FindFirst("FirstName")?.Value ?? "";
            var lastName = user.FindFirst("LastName")?.Value ?? "";
            
            if (!string.IsNullOrEmpty(firstName) && !string.IsNullOrEmpty(lastName))
                return $"{firstName} {lastName}";
                
            if (!string.IsNullOrEmpty(firstName))
                return firstName;
                
            return user.GetUserId();
        }

        /// <summary>
        /// Get user email with fallback
        /// </summary>
        public static string GetUserEmail(this ClaimsPrincipal user)
        {
            return user.FindFirst(ClaimTypes.Email)?.Value 
                ?? user.FindFirst("Email")?.Value 
                ?? "";
        }
    }
}