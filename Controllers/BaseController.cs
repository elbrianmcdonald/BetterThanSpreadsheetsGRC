using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Security.Claims;

namespace CyberRiskApp.Controllers
{
    /// <summary>
    /// Base controller providing common functionality and centralized error handling
    /// </summary>
    public abstract class BaseController : Controller
    {
        protected readonly ILogger _logger;

        protected BaseController(ILogger logger)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Centralized error handling with consistent logging and user feedback
        /// </summary>
        protected IActionResult HandleError(Exception ex, string operation, string? redirectAction = null, object? routeValues = null)
        {
            _logger.LogError(ex, "Error {Operation}: {Message}", operation, ex.Message);
            TempData["Error"] = $"Error {operation}: {ex.Message}";
            
            if (redirectAction != null)
            {
                return routeValues != null 
                    ? RedirectToAction(redirectAction, routeValues)
                    : RedirectToAction(redirectAction);
            }
            
            return View();
        }

        /// <summary>
        /// Execute an operation with automatic error handling
        /// </summary>
        protected async Task<IActionResult> ExecuteWithErrorHandling<T>(
            Func<Task<T>> operation,
            Func<T, IActionResult> onSuccess,
            string operationName,
            string? redirectAction = null,
            object? routeValues = null)
        {
            try
            {
                var result = await operation();
                return onSuccess(result);
            }
            catch (Exception ex)
            {
                return HandleError(ex, operationName, redirectAction, routeValues);
            }
        }

        /// <summary>
        /// Execute an operation with automatic error handling (void return)
        /// </summary>
        protected async Task<IActionResult> ExecuteWithErrorHandling(
            Func<Task> operation,
            IActionResult onSuccess,
            string operationName,
            string? redirectAction = null,
            object? routeValues = null)
        {
            try
            {
                await operation();
                return onSuccess;
            }
            catch (Exception ex)
            {
                return HandleError(ex, operationName, redirectAction, routeValues);
            }
        }

        /// <summary>
        /// Execute an operation with automatic error handling and success message
        /// </summary>
        protected async Task<IActionResult> ExecuteWithSuccessMessage<T>(
            Func<Task<T>> operation,
            Func<T, string> getSuccessMessage,
            string operationName,
            string? redirectAction = null,
            object? routeValues = null)
        {
            return await ExecuteWithErrorHandling(
                operation,
                result =>
                {
                    TempData["Success"] = getSuccessMessage(result);
                    return redirectAction != null
                        ? (routeValues != null 
                            ? RedirectToAction(redirectAction, routeValues)
                            : RedirectToAction(redirectAction))
                        : View(result);
                },
                operationName,
                redirectAction,
                routeValues
            );
        }

        /// <summary>
        /// Set success message in TempData
        /// </summary>
        protected void SetSuccessMessage(string message)
        {
            TempData["Success"] = message;
        }

        /// <summary>
        /// Set warning message in TempData
        /// </summary>
        protected void SetWarningMessage(string message)
        {
            TempData["Warning"] = message;
        }

        /// <summary>
        /// Set info message in TempData
        /// </summary>
        protected void SetInfoMessage(string message)
        {
            TempData["Info"] = message;
        }

        /// <summary>
        /// Check if user has any of the specified roles
        /// </summary>
        protected bool HasAnyRole(params string[] roles)
        {
            return roles.Any(role => User.IsInRole(role));
        }

        /// <summary>
        /// Check if user is admin
        /// </summary>
        protected bool IsAdmin => User.IsInRole("Admin");

        /// <summary>
        /// Check if user is manager (GRCManager or Admin)
        /// </summary>
        protected bool IsManager => User.IsInRole("GRCManager") || IsAdmin;

        /// <summary>
        /// Check if user is analyst (GRCAnalyst, GRCManager, or Admin)
        /// </summary>
        protected bool IsAnalyst => User.IsInRole("GRCAnalyst") || IsManager;
    }
}