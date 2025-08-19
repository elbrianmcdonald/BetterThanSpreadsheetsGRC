using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.Authorization;
using Microsoft.Extensions.Logging;
using CyberRiskApp.Extensions;
using CyberRiskApp.Filters;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireAdminRole)]
    public class UserManagementController : BaseController
    {
        private readonly IUserService _userService;
        private readonly UserManager<User> _userManager;

        public UserManagementController(IUserService userService, UserManager<User> userManager, ILogger<UserManagementController> logger) : base(logger)
        {
            _userService = userService;
            _userManager = userManager;
        }

        public async Task<IActionResult> Index()
        {
            return await ExecuteWithErrorHandling(
                async () => await _userService.GetUserManagementDataAsync(),
                viewModel => View(viewModel),
                "loading user management data"
            );
        }

        public async Task<IActionResult> Details(string id)
        {
            if (string.IsNullOrEmpty(id))
            {
                return NotFound();
            }

            var user = await _userService.GetUserByIdAsync(id);
            if (user == null)
            {
                return NotFound();
            }

            return View(user);
        }

        public IActionResult Create()
        {
            return View(new UserRegistrationViewModel());
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(UserRegistrationViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            // Check if user already exists
            var existingUser = await _userService.GetUserByEmailAsync(model.Email);
            if (existingUser != null)
            {
                ModelState.AddModelError("Email", "A user with this email already exists.");
                return View(model);
            }

            var result = await _userService.CreateUserAsync(model);

            if (result)
            {
                TempData["Success"] = $"User {model.FirstName} {model.LastName} created successfully.";
                return RedirectToAction(nameof(Index));
            }

            ModelState.AddModelError(string.Empty, "Failed to create user. Please try again.");
            return View(model);
        }

        public async Task<IActionResult> Edit(string id)
        {
            if (string.IsNullOrEmpty(id))
            {
                return NotFound();
            }

            var user = await _userService.GetUserByIdAsync(id);
            if (user == null)
            {
                return NotFound();
            }

            var model = new UserEditViewModel
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email!,
                Department = user.Department,
                JobTitle = user.JobTitle,
                Role = user.Role,
                IsActive = user.IsActive
            };

            return View(model);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(UserEditViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var user = await _userService.GetUserByIdAsync(model.Id);
            if (user == null)
            {
                return NotFound();
            }

            // Update user properties
            user.FirstName = model.FirstName;
            user.LastName = model.LastName;
            user.Email = model.Email;
            user.UserName = model.Email;
            user.Department = model.Department;
            user.JobTitle = model.JobTitle;
            user.Role = model.Role;
            user.IsActive = model.IsActive;

            var result = await _userService.UpdateUserAsync(user);

            if (result)
            {
                // Update custom role claim
                var claims = await _userManager.GetClaimsAsync(user);
                var roleClaim = claims.FirstOrDefault(c => c.Type == "Role");
                if (roleClaim != null)
                {
                    await _userManager.RemoveClaimAsync(user, roleClaim);
                }
                await _userManager.AddClaimAsync(user, new System.Security.Claims.Claim("Role", model.Role.ToString()));

                // Update ASP.NET Identity role
                var currentRoles = await _userManager.GetRolesAsync(user);
                if (currentRoles.Any())
                {
                    await _userManager.RemoveFromRolesAsync(user, currentRoles);
                }

                string newRoleName = model.Role switch
                {
                    UserRole.Admin => "Admin",
                    UserRole.GRCManager => "GRCManager",
                    UserRole.GRCAnalyst => "GRCAnalyst",
                    UserRole.ITUser => "ITUser",
                    _ => "ITUser"
                };

                await _userManager.AddToRoleAsync(user, newRoleName);

                TempData["Success"] = $"User {model.FirstName} {model.LastName} updated successfully.";
                return RedirectToAction(nameof(Index));
            }

            ModelState.AddModelError(string.Empty, "Failed to update user. Please try again.");
            return View(model);
        }

        // MISSING METHOD - This is what was causing the 404 error
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ToggleStatus(string id)
        {
            if (string.IsNullOrEmpty(id))
            {
                TempData["Error"] = "Invalid user ID.";
                return RedirectToAction(nameof(Index));
            }

            try
            {
                var user = await _userService.GetUserByIdAsync(id);
                if (user == null)
                {
                    TempData["Error"] = "User not found.";
                    return RedirectToAction(nameof(Index));
                }

                var result = await _userService.ToggleUserStatusAsync(id);

                if (result)
                {
                    var status = user.IsActive ? "deactivated" : "activated";
                    TempData["Success"] = $"User {user.FullName} has been {status} successfully.";
                }
                else
                {
                    TempData["Error"] = "Failed to update user status. Please try again.";
                }
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"An error occurred: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ResetPassword(string id)
        {
            if (string.IsNullOrEmpty(id))
            {
                TempData["Error"] = "Invalid user ID.";
                return RedirectToAction(nameof(Index));
            }

            try
            {
                var user = await _userService.GetUserByIdAsync(id);
                if (user == null)
                {
                    TempData["Error"] = "User not found.";
                    return RedirectToAction(nameof(Index));
                }

                var result = await _userService.ResetPasswordAsync(id);

                if (result)
                {
                    TempData["Success"] = $"Password reset for {user.FullName}. Temporary password: TempPassword123!";
                }
                else
                {
                    TempData["Error"] = "Failed to reset password. Please try again.";
                }
            }
            catch (Exception ex)
            {
                TempData["Error"] = $"An error occurred: {ex.Message}";
            }

            return RedirectToAction(nameof(Index));
        }
    }
}