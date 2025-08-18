using System.Security.Claims;
using CyberRiskApp.Models;

namespace CyberRiskApp.Extensions
{
    public static class AuthorizationExtensions
    {
        public static bool CanUserApproveClosures(this ClaimsPrincipal user)
        {
            var roleClaim = user.FindFirst("Role")?.Value;
            if (Enum.TryParse<UserRole>(roleClaim, out var role))
            {
                return role == UserRole.GRCAnalyst || role == UserRole.GRCManager || role == UserRole.Admin;
            }
            return false;
        }

        public static bool CanUserPerformAssessments(this ClaimsPrincipal user)
        {
            var roleClaim = user.FindFirst("Role")?.Value;
            if (Enum.TryParse<UserRole>(roleClaim, out var role))
            {
                return role == UserRole.GRCAnalyst || role == UserRole.GRCManager || role == UserRole.Admin;
            }
            return false;
        }

        public static bool IsUserAdmin(this ClaimsPrincipal user)
        {
            var roleClaim = user.FindFirst("Role")?.Value;
            if (Enum.TryParse<UserRole>(roleClaim, out var role))
            {
                return role == UserRole.Admin;
            }
            return false;
        }

        public static UserRole GetUserRole(this ClaimsPrincipal user)
        {
            var roleClaim = user.FindFirst("Role")?.Value;
            if (Enum.TryParse<UserRole>(roleClaim, out var role))
            {
                return role;
            }
            return UserRole.ITUser; // Default fallback
        }

        public static string GetUserRoleDisplayName(this ClaimsPrincipal user)
        {
            return user.GetUserRole() switch
            {
                UserRole.Admin => "Admin",
                UserRole.GRCManager => "GRC Manager",
                UserRole.GRCAnalyst => "GRC Analyst",
                UserRole.ITUser => "IT User",
                _ => "User"
            };
        }
    }
}