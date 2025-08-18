using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class UserService : IUserService
    {
        private readonly CyberRiskContext _context;
        private readonly UserManager<User> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;

        public UserService(CyberRiskContext context, UserManager<User> userManager, RoleManager<IdentityRole> roleManager)
        {
            _context = context;
            _userManager = userManager;
            _roleManager = roleManager;
        }

        public async Task<User?> GetUserByIdAsync(string userId)
        {
            return await _userManager.FindByIdAsync(userId);
        }

        public async Task<User?> GetUserByEmailAsync(string email)
        {
            return await _userManager.FindByEmailAsync(email);
        }

        public async Task<List<User>> GetAllUsersAsync()
        {
            return await _context.Users
                .OrderBy(u => u.LastName)
                .ThenBy(u => u.FirstName)
                .ToListAsync();
        }

        public async Task<bool> CreateUserAsync(UserRegistrationViewModel model)
        {
            try
            {
                // Ensure roles exist first
                await EnsureRolesExistAsync();

                var user = new User
                {
                    UserName = model.Email,
                    Email = model.Email,
                    FirstName = model.FirstName,
                    LastName = model.LastName,
                    Department = model.Department,
                    JobTitle = model.JobTitle,
                    Role = model.Role,
                    IsActive = true,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now,
                    EmailConfirmed = true
                };

                var result = await _userManager.CreateAsync(user, model.Password);

                if (result.Succeeded)
                {
                    // Add both custom claim AND actual Identity role
                    await _userManager.AddClaimAsync(user, new System.Security.Claims.Claim("Role", model.Role.ToString()));

                    // Add to actual ASP.NET Identity role
                    string roleName = GetRoleName(model.Role);
                    await _userManager.AddToRoleAsync(user, roleName);

                    return true;
                }

                return false;
            }
            catch
            {
                return false;
            }
        }

        public async Task<bool> UpdateUserAsync(User user)
        {
            try
            {
                user.UpdatedAt = DateTime.Now;
                var result = await _userManager.UpdateAsync(user);
                return result.Succeeded;
            }
            catch
            {
                return false;
            }
        }

        public async Task<bool> ToggleUserStatusAsync(string userId)
        {
            try
            {
                var user = await _userManager.FindByIdAsync(userId);
                if (user != null)
                {
                    user.IsActive = !user.IsActive;
                    user.UpdatedAt = DateTime.Now;
                    var result = await _userManager.UpdateAsync(user);
                    return result.Succeeded;
                }
                return false;
            }
            catch
            {
                return false;
            }
        }

        public async Task UpdateLastLoginAsync(string userId)
        {
            try
            {
                var user = await _userManager.FindByIdAsync(userId);
                if (user != null)
                {
                    user.LastLoginDate = DateTime.Now;
                    await _userManager.UpdateAsync(user);
                }
            }
            catch
            {
                // Log error but don't throw
            }
        }

        public async Task<UserManagementViewModel> GetUserManagementDataAsync()
        {
            var users = await _context.Users.ToListAsync();

            return new UserManagementViewModel
            {
                Users = users,
                TotalUsers = users.Count,
                ActiveUsers = users.Count(u => u.IsActive),
                AdminUsers = users.Count(u => u.Role == UserRole.Admin),
                GRCUsers = users.Count(u => u.Role == UserRole.GRCAnalyst || u.Role == UserRole.GRCManager),
                ITUsers = users.Count(u => u.Role == UserRole.ITUser)
            };
        }

        public async Task<bool> ResetPasswordAsync(string userId)
        {
            try
            {
                var user = await _userManager.FindByIdAsync(userId);
                if (user != null)
                {
                    var token = await _userManager.GeneratePasswordResetTokenAsync(user);
                    var result = await _userManager.ResetPasswordAsync(user, token, "TempPassword123!");
                    return result.Succeeded;
                }
                return false;
            }
            catch
            {
                return false;
            }
        }

        // Helper method to ensure all roles exist
        private async Task EnsureRolesExistAsync()
        {
            string[] roleNames = { "Admin", "GRCManager", "GRCAnalyst", "ITUser", "GRCUser" }; // Keep GRCUser for backward compatibility

            foreach (string roleName in roleNames)
            {
                if (!await _roleManager.RoleExistsAsync(roleName))
                {
                    await _roleManager.CreateAsync(new IdentityRole(roleName));
                }
            }
        }

        // Helper method to convert UserRole enum to role name
        private string GetRoleName(UserRole role)
        {
            return role switch
            {
                UserRole.Admin => "Admin",
                UserRole.GRCManager => "GRCManager",
                UserRole.GRCAnalyst => "GRCAnalyst", 
                UserRole.ITUser => "ITUser",
                _ => "ITUser"
            };
        }

        // Method to fix existing users (add this temporarily)
        public async Task<bool> FixExistingUserRolesAsync()
        {
            try
            {
                await EnsureRolesExistAsync();

                var allUsers = await _context.Users.ToListAsync();

                foreach (var user in allUsers)
                {
                    string roleName = GetRoleName(user.Role);

                    // Remove user from all roles first
                    var currentRoles = await _userManager.GetRolesAsync(user);
                    if (currentRoles.Any())
                    {
                        await _userManager.RemoveFromRolesAsync(user, currentRoles);
                    }

                    // Add to correct role
                    await _userManager.AddToRoleAsync(user, roleName);

                    // Ensure custom claim exists
                    var claims = await _userManager.GetClaimsAsync(user);
                    var roleClaim = claims.FirstOrDefault(c => c.Type == "Role");
                    if (roleClaim == null)
                    {
                        await _userManager.AddClaimAsync(user, new System.Security.Claims.Claim("Role", user.Role.ToString()));
                    }
                }

                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}