using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IUserService
    {
        Task<User?> GetUserByIdAsync(string userId);
        Task<User?> GetUserByEmailAsync(string email);
        Task<List<User>> GetAllUsersAsync();
        Task<bool> CreateUserAsync(UserRegistrationViewModel model);
        Task<bool> UpdateUserAsync(User user);
        Task<bool> ToggleUserStatusAsync(string userId);
        Task UpdateLastLoginAsync(string userId);
        Task<UserManagementViewModel> GetUserManagementDataAsync();
        Task<bool> ResetPasswordAsync(string userId);
        Task<bool> FixExistingUserRolesAsync();
    }
}