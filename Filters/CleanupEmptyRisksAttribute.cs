using CyberRiskApp.ViewModels;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CyberRiskApp.Filters
{
    public class CleanupEmptyRisksAttribute : ActionFilterAttribute
    {
        public override void OnActionExecuting(ActionExecutingContext context)
        {
            // Find the RiskAssessmentViewModel parameter
            foreach (var parameter in context.ActionArguments.Values)
            {
                if (parameter is RiskAssessmentViewModel model)
                {
                    // Remove any open risks that don't have a title
                    if (model.OpenRisks != null)
                    {
                        model.OpenRisks = model.OpenRisks.Where(r => !string.IsNullOrEmpty(r.Title)).ToList();
                        
                        // If no valid risks remain, clear the list entirely
                        if (!model.OpenRisks.Any())
                        {
                            model.OpenRisks = new List<CyberRiskApp.Models.Risk>();
                        }
                    }

                    // Remove ModelState entries for empty risks to prevent enum validation errors
                    var controller = context.Controller as Microsoft.AspNetCore.Mvc.Controller;
                    if (controller != null)
                    {
                        var keysToRemove = controller.ModelState.Keys
                            .Where(k => k.Contains("OpenRisks"))
                            .ToList();

                        foreach (var key in keysToRemove)
                        {
                            // Check if this key corresponds to an empty risk
                            var parts = key.Split('[', ']');
                            if (parts.Length >= 2 && int.TryParse(parts[1], out int index))
                            {
                                if (model.OpenRisks == null || index >= model.OpenRisks.Count ||
                                    string.IsNullOrEmpty(model.OpenRisks[index]?.Title))
                                {
                                    controller.ModelState.Remove(key);
                                }
                            }
                        }

                        // Also remove any "value '0' is invalid" errors
                        var errorKeys = controller.ModelState.Keys.ToList();
                        foreach (var key in errorKeys)
                        {
                            if (controller.ModelState[key].Errors.Any(e => e.ErrorMessage.Contains("The value '0' is invalid")))
                            {
                                controller.ModelState.Remove(key);
                            }
                        }
                    }
                    break;
                }
            }

            base.OnActionExecuting(context);
        }
    }
}