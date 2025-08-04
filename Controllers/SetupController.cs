using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CyberRiskApp.Services;
using System.ComponentModel.DataAnnotations;

namespace CyberRiskApp.Controllers
{
    [AllowAnonymous]
    public class SetupController : Controller
    {
        private readonly IInitialSetupService _setupService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<SetupController> _logger;

        public SetupController(
            IInitialSetupService setupService,
            IConfiguration configuration,
            ILogger<SetupController> logger)
        {
            _setupService = setupService;
            _configuration = configuration;
            _logger = logger;
        }

        // GET: /Setup
        public async Task<IActionResult> Index()
        {
            // Check if setup is already complete
            if (await _setupService.IsSetupCompleteAsync())
            {
                return RedirectToAction("Login", "Account");
            }

            // Check if running in unattended mode
            var unattended = _configuration.GetValue<bool>("Setup:Unattended");
            if (unattended)
            {
                return await RunUnattendedSetup();
            }

            return View();
        }

        // POST: /Setup/Initialize
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Initialize(SetupViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View("Index", model);
            }

            try
            {
                // Set configuration for setup
                Environment.SetEnvironmentVariable("CYBERRISK_ADMIN_EMAIL", model.AdminEmail);
                if (!string.IsNullOrEmpty(model.AdminPassword))
                {
                    Environment.SetEnvironmentVariable("CYBERRISK_ADMIN_PASSWORD", model.AdminPassword);
                }

                // Run setup
                var result = await _setupService.InitializeApplicationAsync();

                if (result.IsSuccess)
                {
                    // Clear sensitive environment variables
                    Environment.SetEnvironmentVariable("CYBERRISK_ADMIN_PASSWORD", null);

                    TempData["Success"] = "Initial setup completed successfully!";
                    
                    if (!string.IsNullOrEmpty(result.AdminPassword))
                    {
                        TempData["AdminPassword"] = result.AdminPassword;
                        TempData["ShowPassword"] = true;
                    }

                    return View("SetupComplete", new SetupCompleteViewModel
                    {
                        AdminEmail = model.AdminEmail,
                        AdminPassword = result.AdminPassword,
                        Message = result.Message
                    });
                }
                else
                {
                    ModelState.AddModelError("", result.Message);
                    return View("Index", model);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during setup initialization");
                ModelState.AddModelError("", $"Setup failed: {ex.Message}");
                return View("Index", model);
            }
        }

        private async Task<IActionResult> RunUnattendedSetup()
        {
            _logger.LogInformation("Running unattended setup...");

            var result = await _setupService.InitializeApplicationAsync();

            if (result.IsSuccess)
            {
                _logger.LogInformation("Unattended setup completed successfully");
                
                // Write credentials to a secure file for retrieval
                var credentialsPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                    "CyberRiskApp",
                    "admin-credentials.txt"
                );

                var credentialsDir = Path.GetDirectoryName(credentialsPath);
                if (!Directory.Exists(credentialsDir))
                {
                    Directory.CreateDirectory(credentialsDir!);
                }

                await System.IO.File.WriteAllTextAsync(credentialsPath, 
                    $"Admin Email: {_configuration["Setup:AdminEmail"] ?? "admin@cyberrisk.local"}\n" +
                    $"Admin Password: {result.AdminPassword}\n" +
                    $"Generated: {DateTime.Now}\n" +
                    $"IMPORTANT: Delete this file after retrieving the password!");

                // Set restrictive permissions (Windows)
                var fileInfo = new FileInfo(credentialsPath);
                var fileSecurity = fileInfo.GetAccessControl();
                fileSecurity.SetAccessRuleProtection(true, false);
                fileInfo.SetAccessControl(fileSecurity);

                return Content($"Setup completed. Admin credentials saved to: {credentialsPath}");
            }
            else
            {
                return StatusCode(500, $"Setup failed: {result.Message}");
            }
        }
    }

    public class SetupViewModel
    {
        [Required]
        [EmailAddress]
        [Display(Name = "Admin Email")]
        public string AdminEmail { get; set; } = "admin@cyberrisk.local";

        [Display(Name = "Admin Password")]
        [DataType(DataType.Password)]
        [StringLength(100, MinimumLength = 8)]
        public string? AdminPassword { get; set; }

        [Display(Name = "Generate Secure Password")]
        public bool GeneratePassword { get; set; } = true;

        [Required]
        [Display(Name = "Organization Name")]
        public string OrganizationName { get; set; } = string.Empty;

        [Display(Name = "Primary Domain")]
        public string PrimaryDomain { get; set; } = "localhost";
    }

    public class SetupCompleteViewModel
    {
        public string AdminEmail { get; set; } = string.Empty;
        public string AdminPassword { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
}