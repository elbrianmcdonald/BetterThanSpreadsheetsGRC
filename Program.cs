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

// Configure Kestrel to accept custom domains
builder.WebHost.ConfigureKestrel(options =>
{
    // Listen on all interfaces for HTTP
    options.ListenAnyIP(5197); // HTTP
    
    // Only configure HTTPS if we have a development certificate or in production
    // In development, this will use the dev certificate if available
    if (builder.Environment.IsDevelopment())
    {
        // Try to use HTTPS in development if dev certificate is available
        try
        {
            options.ListenAnyIP(7212, listenOptions =>
            {
                listenOptions.UseHttps(); // This will use the dev certificate if available
            });
        }
        catch
        {
            // If no dev certificate, just log and continue with HTTP only
            Console.WriteLine("⚠️  No development HTTPS certificate found. Running HTTP only.");
        }
    }
    else
    {
        // In production, HTTPS will be configured dynamically via SSL service
        // For now, just HTTP until certificate is properly configured
        Console.WriteLine("ℹ️  Production mode: HTTPS will be available after SSL certificate configuration.");
    }
});

// Add Initial Setup Service
builder.Services.AddScoped<IInitialSetupService, InitialSetupService>();

// Add services to the container.
builder.Services.AddControllersWithViews()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.MaxDepth = 64;
    });

// Database configuration
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ??
    "Host=localhost;Database=CyberRiskDB;Username=cyberrisk_user;Password=CyberRisk123!;Pooling=true;MinPoolSize=5;MaxPoolSize=50;ConnectionIdleLifetime=300;ConnectionPruningInterval=10";

builder.Services.AddDbContext<CyberRiskContext>(options =>
    options.UseNpgsql(connectionString, npgsqlOptions =>
    {
        npgsqlOptions.CommandTimeout(30);
        npgsqlOptions.EnableRetryOnFailure(
            maxRetryCount: 3,
            maxRetryDelay: TimeSpan.FromSeconds(5),
            errorCodesToAdd: null);
    }));

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

// Register audit and transaction services for concurrency control
builder.Services.AddHttpContextAccessor(); // Required for AuditService to get current user
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<ITransactionService, TransactionService>();

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
// Monte Carlo Simulation service removed (FAIR functionality deprecated)
// Register Risk Matrix Management service
builder.Services.AddScoped<IRiskMatrixService, RiskMatrixService>();
// Register MITRE ATT&CK service for enhanced threat modeling
builder.Services.AddScoped<IMitreAttackService, MitreAttackService>();
// Register Strategy Planning service
builder.Services.AddScoped<IStrategyPlanningService, StrategyPlanningService>();
// Register SSL Management service
builder.Services.AddScoped<ISSLService, SSLService>();
// Register DNS Management service
builder.Services.AddScoped<IDomainService, DomainService>();
// Register App Settings service
builder.Services.AddScoped<IAppSettingsService, AppSettingsService>();
// Register Threat Modeling service
builder.Services.AddScoped<IThreatModelingService, ThreatModelingService>();
// Register MITRE Import service
builder.Services.AddScoped<IMitreImportService, MitreImportService>();
// Register Backup service
builder.Services.AddScoped<IBackupService, BackupService>();
// Register Risk Assessment Threat Model service
builder.Services.AddScoped<IRiskAssessmentThreatModelService, RiskAssessmentThreatModelService>();
// Register HTTP Client Factory for external API calls
builder.Services.AddHttpClient();

// Register Memory Cache for reference data caching
builder.Services.AddMemoryCache();
builder.Services.AddScoped<ICacheService, CacheService>();

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

        // SSL settings are created on-demand when certificates are uploaded
        Console.WriteLine("✅ SSL will be available once certificates are uploaded");
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

// Add security headers including Content Security Policy
app.Use(async (context, next) =>
{
    // Content Security Policy to help prevent XSS attacks
    context.Response.Headers["Content-Security-Policy"] = 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://code.jquery.com; " +
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self'; " +
        "frame-ancestors 'none'; " +
        "form-action 'self'; " +
        "base-uri 'self';";
    
    // Additional security headers - use indexer to avoid duplicates
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["X-XSS-Protection"] = "1; mode=block";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    
    await next();
});

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