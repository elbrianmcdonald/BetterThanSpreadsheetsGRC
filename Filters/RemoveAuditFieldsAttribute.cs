using Microsoft.AspNetCore.Mvc.Filters;

namespace CyberRiskApp.Filters
{
    /// <summary>
    /// Action filter that automatically removes audit fields from ModelState
    /// Eliminates the need for manual ModelState.Remove() calls in controllers
    /// </summary>
    public class RemoveAuditFieldsAttribute : ActionFilterAttribute
    {
        private static readonly string[] AuditFields = new[]
        {
            "CreatedBy",
            "UpdatedBy", 
            "CreatedAt",
            "UpdatedAt",
            "RowVersion",
            "Id" // Often needs to be removed for create operations
        };

        /// <summary>
        /// Additional fields to remove beyond the standard audit fields
        /// </summary>
        public string[]? AdditionalFields { get; set; }

        public override void OnActionExecuting(ActionExecutingContext context)
        {
            // Remove standard audit fields
            foreach (var field in AuditFields)
            {
                context.ModelState.Remove(field);
            }

            // Remove any additional specified fields
            if (AdditionalFields != null)
            {
                foreach (var field in AdditionalFields)
                {
                    context.ModelState.Remove(field);
                }
            }

            base.OnActionExecuting(context);
        }
    }

    /// <summary>
    /// Specialized filter for entity creation that removes ID and audit fields
    /// </summary>
    public class PrepareForCreateAttribute : RemoveAuditFieldsAttribute
    {
        public PrepareForCreateAttribute()
        {
            // Inherits standard audit field removal
        }
    }

    /// <summary>
    /// Specialized filter for entity updates that removes only certain audit fields
    /// </summary>
    public class PrepareForUpdateAttribute : ActionFilterAttribute
    {
        private static readonly string[] UpdateExcludeFields = new[]
        {
            "CreatedBy",
            "CreatedAt"
        };

        public override void OnActionExecuting(ActionExecutingContext context)
        {
            foreach (var field in UpdateExcludeFields)
            {
                context.ModelState.Remove(field);
            }

            base.OnActionExecuting(context);
        }
    }
}