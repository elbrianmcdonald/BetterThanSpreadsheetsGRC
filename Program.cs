using CyberRiskApp.Data;
using CyberRiskApp.Models;
using CyberRiskApp.Services;
using CyberRiskApp.Authorization;
using CyberRiskApp.Middleware;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Server.IIS;
using Microsoft.AspNetCore.Server.Kestrel.Core;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

// Database configuration
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ??
    "Host=localhost;Database=CyberRiskDB;Username=cyberrisk_user;Password=CyberRisk123!";

builder.Services.AddDbContext<CyberRiskContext>(options =>
    options.UseNpgsql(connectionString));

// Configure Identity (your existing setup)
builder.Services.AddIdentity<User, IdentityRole>(options =>
{
    options.Password.RequiredLength = 6;
    options.Password.RequireDigit = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireLowercase = false;
    options.SignIn.RequireConfirmedAccount = false;
})
.AddEntityFrameworkStores<CyberRiskContext>()
.AddDefaultTokenProviders();

// Configure authorization policies (your existing setup)
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(PolicyConstants.RequireAdminRole, policy =>
        policy.RequireRole("Admin"));

    options.AddPolicy(PolicyConstants.RequireGRCOrAdminRole, policy =>
        policy.RequireRole("Admin", "GRCUser"));

    options.AddPolicy(PolicyConstants.RequireAnyRole, policy =>
        policy.RequireRole("Admin", "GRCUser", "ITUser"));
});

// Register existing Risk Management services
builder.Services.AddScoped<IFindingService, FindingService>();
builder.Services.AddScoped<IRiskService, RiskService>();
builder.Services.AddScoped<IRiskAssessmentService, RiskAssessmentService>();
builder.Services.AddScoped<IRequestService, RequestService>();
builder.Services.AddScoped<IUserService, UserService>();

// Register new Governance services
builder.Services.AddScoped<IGovernanceService, GovernanceService>();
builder.Services.AddScoped<IMaturityService, MaturityService>();
// Register new Export service
builder.Services.AddScoped<IExportService, ExportService>();
// Register new Risk Level Settings service
// NEW: Register Risk Level Settings service
builder.Services.AddScoped<IRiskLevelSettingsService, RiskLevelSettingsService>();
// Register Third Party Risk Management service
builder.Services.AddScoped<IThirdPartyService, ThirdPartyService>();
// Register PDF Export service
builder.Services.AddScoped<IPdfExportService, PdfExportService>();
// Register Reference Data service
builder.Services.AddScoped<IReferenceDataService, ReferenceDataService>();
// Register Technical Control Mapping service
builder.Services.AddScoped<ITechnicalControlMappingService, TechnicalControlMappingService>();
// Register Monte Carlo Simulation service for FAIR calculations
builder.Services.AddScoped<IMonteCarloSimulationService, MonteCarloSimulationService>();
// Register Risk Matrix Management service
builder.Services.AddScoped<IRiskMatrixService, RiskMatrixService>();
// Register Strategy Planning service
builder.Services.AddScoped<IStrategyPlanningService, StrategyPlanningService>();
// Register SSL Management service
builder.Services.AddScoped<ISSLService, SSLService>();

builder.Services.Configure<FormOptions>(options =>
{
    // Increase form data limits for bulk operations
    options.ValueLengthLimit = int.MaxValue;
    options.MultipartBodyLengthLimit = int.MaxValue;
    options.KeyLengthLimit = int.MaxValue;
    options.ValueCountLimit = int.MaxValue;
    options.MultipartHeadersCountLimit = int.MaxValue;
    options.MultipartHeadersLengthLimit = int.MaxValue;
    
    // Add timeout configuration
    options.BufferBody = true;
    options.BufferBodyLengthLimit = int.MaxValue;
});

// Add request timeout configuration
builder.Services.Configure<IISServerOptions>(options =>
{
    options.MaxRequestBodySize = int.MaxValue;
    options.AllowSynchronousIO = true; // For large form processing
});

builder.Services.Configure<KestrelServerOptions>(options =>
{
    options.Limits.MaxRequestBodySize = int.MaxValue;
    options.Limits.RequestHeadersTimeout = TimeSpan.FromMinutes(5);
    options.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(5);
});

// Configure forwarded headers for reverse proxy scenarios
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

// Use forwarded headers
app.UseForwardedHeaders();

// Initialize database and fix existing users
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var userService = services.GetRequiredService<IUserService>();
        var userManager = services.GetRequiredService<UserManager<User>>();
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();

        // Fix existing users (this will add them to proper Identity roles)
        await userService.FixExistingUserRolesAsync();

        // Create default admin if it doesn't exist, or fix existing admin role
        var adminUser = await userManager.FindByEmailAsync("admin@cyberrisk.com");
        if (adminUser == null)
        {
            adminUser = new User
            {
                UserName = "admin@cyberrisk.com",
                Email = "admin@cyberrisk.com",
                EmailConfirmed = true,
                Role = UserRole.Admin,
                FirstName = "System",
                LastName = "Administrator",
                Department = "IT",
                JobTitle = "System Administrator",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var result = await userManager.CreateAsync(adminUser, "Admin123!");
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(adminUser, "Admin");
                Console.WriteLine("✅ Created default admin user: admin@cyberrisk.com / Admin123!");
            }
        }
        else
        {
            // Fix existing admin user role if it's wrong
            if (adminUser.Role != UserRole.Admin)
            {
                adminUser.Role = UserRole.Admin;
                await userManager.UpdateAsync(adminUser);
                Console.WriteLine("✅ Fixed admin user role");
            }
            
            // Ensure admin user is in Admin role
            if (!await userManager.IsInRoleAsync(adminUser, "Admin"))
            {
                await userManager.AddToRoleAsync(adminUser, "Admin");
                Console.WriteLine("✅ Added admin user to Admin role");
            }
        }

        // Initialize default risk matrices
        var riskMatrixService = services.GetRequiredService<IRiskMatrixService>();
        await riskMatrixService.SeedDefaultMatricesAsync();
        Console.WriteLine("✅ Initialized default risk matrices");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Error during startup initialization: {ex.Message}");
    }
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

// Use conditional HTTPS redirection based on SSL settings
app.UseConditionalHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

// Map API controllers
app.MapControllers();

app.Run();