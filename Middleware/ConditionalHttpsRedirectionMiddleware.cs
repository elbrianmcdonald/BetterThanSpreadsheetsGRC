using CyberRiskApp.Services;

namespace CyberRiskApp.Middleware
{
    public class ConditionalHttpsRedirectionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ConditionalHttpsRedirectionMiddleware> _logger;

        public ConditionalHttpsRedirectionMiddleware(RequestDelegate next, ILogger<ConditionalHttpsRedirectionMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Skip SSL checks for certain paths
            if (IsExcludedPath(context.Request.Path))
            {
                await _next(context);
                return;
            }

            try
            {
                // Get SSL service from DI container
                var sslService = context.RequestServices.GetRequiredService<ISSLService>();
                var sslSettings = await sslService.GetSSLSettingsAsync();

                // Check if HTTPS redirection is enabled
                if (sslSettings.EnableHttpsRedirection && !context.Request.IsHttps)
                {
                    var httpsUrl = $"https://{context.Request.Host.Host}:{sslSettings.HttpsPort}{context.Request.Path}{context.Request.QueryString}";
                    
                    _logger.LogInformation($"Redirecting HTTP request to HTTPS: {httpsUrl}");
                    context.Response.Redirect(httpsUrl, permanent: true);
                    return;
                }

                // Check if HTTPS is required
                if (sslSettings.RequireHttps && !context.Request.IsHttps)
                {
                    context.Response.StatusCode = 426; // Upgrade Required
                    await context.Response.WriteAsync("HTTPS Required");
                    return;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in HTTPS redirection middleware");
                // Continue without redirection if there's an error
            }

            await _next(context);
        }

        private static bool IsExcludedPath(PathString path)
        {
            // Exclude health checks, API endpoints that might need HTTP, etc.
            var excludedPaths = new[]
            {
                "/health",
                "/.well-known",
                "/api/health"
            };

            return excludedPaths.Any(excluded => path.StartsWithSegments(excluded, StringComparison.OrdinalIgnoreCase));
        }
    }

    public static class ConditionalHttpsRedirectionMiddlewareExtensions
    {
        public static IApplicationBuilder UseConditionalHttpsRedirection(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<ConditionalHttpsRedirectionMiddleware>();
        }
    }
}