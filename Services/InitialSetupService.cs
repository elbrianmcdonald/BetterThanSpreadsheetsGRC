using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using CyberRiskApp.Data;
using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IInitialSetupService
    {
        Task<SetupResult> InitializeApplicationAsync();
        string GenerateSecurePassword(int length = 16);
        Task<bool> IsSetupCompleteAsync();
    }

    public class InitialSetupService : IInitialSetupService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly IConfiguration _configuration;
        private readonly ILogger<InitialSetupService> _logger;
        private readonly string _setupFilePath;

        public InitialSetupService(
            IServiceProvider serviceProvider,
            IConfiguration configuration,
            ILogger<InitialSetupService> logger)
        {
            _serviceProvider = serviceProvider;
            _configuration = configuration;
            _logger = logger;
            _setupFilePath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "CyberRiskApp",
                "setup.json"
            );
        }

        public async Task<SetupResult> InitializeApplicationAsync()
        {
            var result = new SetupResult();

            try
            {
                // Check if setup is already complete
                if (await IsSetupCompleteAsync())
                {
                    result.IsSuccess = true;
                    result.Message = "Setup already complete";
                    return result;
                }

                using var scope = _serviceProvider.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<CyberRiskContext>();
                var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
                var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

                // Ensure database is created and migrated
                await context.Database.MigrateAsync();

                // Create roles
                await CreateRolesAsync(roleManager);

                // Create admin user
                var adminPassword = await CreateAdminUserAsync(userManager);
                result.AdminPassword = adminPassword;

                // Save setup completion
                await SaveSetupCompletionAsync(result);

                result.IsSuccess = true;
                result.Message = "Initial setup completed successfully";

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during initial setup");
                result.IsSuccess = false;
                result.Message = $"Setup failed: {ex.Message}";
                return result;
            }
        }

        private async Task CreateRolesAsync(RoleManager<IdentityRole> roleManager)
        {
            string[] roles = { "Admin", "GRCUser", "ITUser" };

            foreach (var role in roles)
            {
                if (!await roleManager.RoleExistsAsync(role))
                {
                    await roleManager.CreateAsync(new IdentityRole(role));
                    _logger.LogInformation($"Created role: {role}");
                }
            }
        }

        private async Task<string> CreateAdminUserAsync(UserManager<User> userManager)
        {
            // Check for environment variable or configuration
            var adminEmail = _configuration["Setup:AdminEmail"] ?? 
                            Environment.GetEnvironmentVariable("CYBERRISK_ADMIN_EMAIL") ?? 
                            "admin@cyberrisk.local";

            var adminPassword = _configuration["Setup:AdminPassword"] ?? 
                               Environment.GetEnvironmentVariable("CYBERRISK_ADMIN_PASSWORD");

            // Generate secure password if not provided
            if (string.IsNullOrEmpty(adminPassword))
            {
                adminPassword = GenerateSecurePassword();
            }

            var adminUser = await userManager.FindByEmailAsync(adminEmail);
            if (adminUser == null)
            {
                adminUser = new User
                {
                    UserName = adminEmail,
                    Email = adminEmail,
                    EmailConfirmed = true,
                    FirstName = "System",
                    LastName = "Administrator",
                    Department = "IT",
                    JobTitle = "Administrator",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var createResult = await userManager.CreateAsync(adminUser, adminPassword);
                if (createResult.Succeeded)
                {
                    await userManager.AddToRoleAsync(adminUser, "Admin");
                    _logger.LogInformation($"Created admin user: {adminEmail}");
                }
                else
                {
                    throw new Exception($"Failed to create admin user: {string.Join(", ", createResult.Errors.Select(e => e.Description))}");
                }
            }

            return adminPassword;
        }

        public string GenerateSecurePassword(int length = 16)
        {
            const string upperCase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const string lowerCase = "abcdefghijklmnopqrstuvwxyz";
            const string digits = "0123456789";
            const string special = "!@#$%^&*()_-+=[]{}|;:,.<>?";
            const string allChars = upperCase + lowerCase + digits + special;

            var password = new StringBuilder();
            using (var rng = RandomNumberGenerator.Create())
            {
                // Ensure at least one character from each category
                password.Append(GetRandomChar(rng, upperCase));
                password.Append(GetRandomChar(rng, lowerCase));
                password.Append(GetRandomChar(rng, digits));
                password.Append(GetRandomChar(rng, special));

                // Fill the rest with random characters
                for (int i = 4; i < length; i++)
                {
                    password.Append(GetRandomChar(rng, allChars));
                }

                // Shuffle the password
                return ShuffleString(rng, password.ToString());
            }
        }

        private char GetRandomChar(RandomNumberGenerator rng, string chars)
        {
            var data = new byte[4];
            rng.GetBytes(data);
            var value = BitConverter.ToUInt32(data, 0);
            return chars[(int)(value % (uint)chars.Length)];
        }

        private string ShuffleString(RandomNumberGenerator rng, string input)
        {
            var array = input.ToCharArray();
            var n = array.Length;
            while (n > 1)
            {
                var data = new byte[4];
                rng.GetBytes(data);
                var k = (int)(BitConverter.ToUInt32(data, 0) % (uint)n);
                n--;
                (array[k], array[n]) = (array[n], array[k]);
            }
            return new string(array);
        }

        public async Task<bool> IsSetupCompleteAsync()
        {
            // Check setup file
            if (File.Exists(_setupFilePath))
            {
                return true;
            }

            // Also check database
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
                var adminExists = await userManager.Users.AnyAsync(u => u.UserName == "admin@cyberrisk.local");
                return adminExists;
            }
            catch
            {
                return false;
            }
        }

        private async Task SaveSetupCompletionAsync(SetupResult result)
        {
            var directory = Path.GetDirectoryName(_setupFilePath);
            if (!Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory!);
            }

            var setupInfo = new
            {
                SetupDate = DateTime.UtcNow,
                AdminEmail = _configuration["Setup:AdminEmail"] ?? "admin@cyberrisk.local",
                PasswordInfo = "Password saved securely. Check application logs or use password reset.",
                SetupVersion = "1.0.0"
            };

            var json = System.Text.Json.JsonSerializer.Serialize(setupInfo, new System.Text.Json.JsonSerializerOptions
            {
                WriteIndented = true
            });

            await File.WriteAllTextAsync(_setupFilePath, json);
            
            // Also log the password securely (only during initial setup)
            _logger.LogWarning($"INITIAL SETUP - Admin Password: {result.AdminPassword}");
            _logger.LogWarning("IMPORTANT: This password is logged ONLY during initial setup. Please change it immediately!");
        }
    }

    public class SetupResult
    {
        public bool IsSuccess { get; set; }
        public string Message { get; set; } = string.Empty;
        public string AdminPassword { get; set; } = string.Empty;
    }
}