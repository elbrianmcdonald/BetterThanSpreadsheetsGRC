using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Models;
using CyberRiskApp.Services;

namespace CyberRiskApp.Controllers
{
    public class AccountController : Controller
    {
        private readonly UserManager<User> _userManager;
        private readonly SignInManager<User> _signInManager;
        private readonly IUserService _userService;

        public AccountController(UserManager<User> userManager, SignInManager<User> signInManager, IUserService userService)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _userService = userService;
        }

        [AllowAnonymous]
        public IActionResult Login()
        {
            return View(new UserLoginViewModel());
        }

        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(UserLoginViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            try
            {
                var user = await _userManager.FindByEmailAsync(model.Email);
                if (user?.IsActive == true)
                {
                    var result = await _signInManager.PasswordSignInAsync(user.UserName!, model.Password, model.RememberMe, false);
                    if (result.Succeeded)
                    {
                        // Update last login
                        await _userService.UpdateLastLoginAsync(user.Id);

                        // Check if user needs to change password (default password)
                        if (user.Email == "admin@cyberrisk.com" && await _userManager.CheckPasswordAsync(user, "TempAdmin123!"))
                        {
                            TempData["Warning"] = "You are using the default password. Please change it for security.";
                            return RedirectToAction("Profile");
                        }

                        return RedirectToAction("Index", "RiskBacklog");
                    }
                }

                ModelState.AddModelError(string.Empty, "Invalid login attempt or account is inactive.");
            }
            catch (Exception ex)
            {
                ModelState.AddModelError(string.Empty, "An error occurred during login. Please try again.");
            }

            return View(model);
        }

        [Authorize]
        public async Task<IActionResult> Profile()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return RedirectToAction("Login");
            }

            var model = new ProfileViewModel
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email!,
                Department = user.Department,
                JobTitle = user.JobTitle,
                Role = user.Role,
                LastLoginDate = user.LastLoginDate,
                CreatedAt = user.CreatedAt
            };

            return View(model);
        }

        [HttpPost]
        [Authorize]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Profile(ProfileViewModel model)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return RedirectToAction("Login");
            }

            // Remove password validation if user is not trying to change password
            if (string.IsNullOrEmpty(model.NewPassword))
            {
                ModelState.Remove("CurrentPassword");
                ModelState.Remove("NewPassword");
                ModelState.Remove("ConfirmNewPassword");
            }

            if (!ModelState.IsValid)
            {
                // Restore the read-only fields
                model.Id = user.Id;
                model.Role = user.Role;
                model.LastLoginDate = user.LastLoginDate;
                model.CreatedAt = user.CreatedAt;
                return View(model);
            }

            try
            {
                // Update basic profile information
                user.FirstName = model.FirstName;
                user.LastName = model.LastName;
                user.Department = model.Department;
                user.JobTitle = model.JobTitle;
                user.UpdatedAt = DateTime.UtcNow;

                var updateResult = await _userManager.UpdateAsync(user);
                if (!updateResult.Succeeded)
                {
                    foreach (var error in updateResult.Errors)
                    {
                        ModelState.AddModelError(string.Empty, error.Description);
                    }
                    model.Id = user.Id;
                    model.Role = user.Role;
                    model.LastLoginDate = user.LastLoginDate;
                    model.CreatedAt = user.CreatedAt;
                    return View(model);
                }

                // Handle password change if requested
                if (!string.IsNullOrEmpty(model.NewPassword))
                {
                    if (string.IsNullOrEmpty(model.CurrentPassword))
                    {
                        ModelState.AddModelError("CurrentPassword", "Current password is required to change password.");
                        model.Id = user.Id;
                        model.Role = user.Role;
                        model.LastLoginDate = user.LastLoginDate;
                        model.CreatedAt = user.CreatedAt;
                        return View(model);
                    }

                    var passwordResult = await _userManager.ChangePasswordAsync(user, model.CurrentPassword, model.NewPassword);
                    if (!passwordResult.Succeeded)
                    {
                        foreach (var error in passwordResult.Errors)
                        {
                            ModelState.AddModelError(string.Empty, error.Description);
                        }
                        model.Id = user.Id;
                        model.Role = user.Role;
                        model.LastLoginDate = user.LastLoginDate;
                        model.CreatedAt = user.CreatedAt;
                        return View(model);
                    }

                    TempData["Success"] = "Profile updated successfully and password changed!";
                }
                else
                {
                    TempData["Success"] = "Profile updated successfully!";
                }

                return RedirectToAction("Profile");
            }
            catch (Exception ex)
            {
                ModelState.AddModelError(string.Empty, "An error occurred while updating your profile. Please try again.");
                model.Id = user.Id;
                model.Role = user.Role;
                model.LastLoginDate = user.LastLoginDate;
                model.CreatedAt = user.CreatedAt;
                return View(model);
            }
        }

        [Authorize]
        public IActionResult ChangePassword()
        {
            return View();
        }

        [HttpPost]
        [Authorize]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ChangePassword(ChangePasswordViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return RedirectToAction("Login");
            }

            var result = await _userManager.ChangePasswordAsync(user, model.CurrentPassword, model.NewPassword);
            if (result.Succeeded)
            {
                TempData["Success"] = "Password changed successfully!";
                return RedirectToAction("Index", "RiskBacklog");
            }

            ViewBag.Error = "Failed to change password: " + string.Join(", ", result.Errors.Select(e => e.Description));
            return View();
        }

        [Authorize]
        public async Task<IActionResult> Logout()
        {
            await _signInManager.SignOutAsync();
            return RedirectToAction("Login");
        }

        [AllowAnonymous]
        public IActionResult AccessDenied()
        {
            return View();
        }

        [AllowAnonymous]
        public IActionResult Test()
        {
            return Content("AccountController is working!");
        }

        // Debug method - remove after testing
        [AllowAnonymous]
        public async Task<IActionResult> DebugUsers()
        {
            var allUsers = _userManager.Users.ToList();
            var debugInfo = new List<string>();

            debugInfo.Add($"Total users in database: {allUsers.Count}");

            foreach (var user in allUsers)
            {
                debugInfo.Add($"User: {user.Email} | UserName: {user.UserName} | Id: {user.Id}");
            }

            // Check current authentication
            debugInfo.Add("--- Current Authentication ---");
            debugInfo.Add($"User.Identity.IsAuthenticated: {User.Identity?.IsAuthenticated}");
            debugInfo.Add($"User.Identity.Name: {User.Identity?.Name}");
            debugInfo.Add($"User.Identity.AuthenticationType: {User.Identity?.AuthenticationType}");

            // Check claims
            debugInfo.Add("--- Current Claims ---");
            foreach (var claim in User.Claims)
            {
                debugInfo.Add($"Claim: {claim.Type} = {claim.Value}");
            }

            return Json(debugInfo);
        }
    }
}