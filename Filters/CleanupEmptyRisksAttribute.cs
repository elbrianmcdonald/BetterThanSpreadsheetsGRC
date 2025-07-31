using CyberRiskApp.ViewModels;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CyberRiskApp.Filters
{
    public class CleanupEmptyRisksAttribute : ActionFilterAttribute
    {
        public override void OnActionExecuting(ActionExecutingContext context)
        {
            // Find the FAIRAssessmentViewModel parameter
            foreach (var parameter in context.ActionArguments.Values)
            {
                if (parameter is FAIRAssessmentViewModel model)
                {
                    // Remove any identified risks that don't have a title
                    if (model.IdentifiedRisks != null)
                    {
                        model.IdentifiedRisks = model.IdentifiedRisks.Where(r => !string.IsNullOrEmpty(r.Title)).ToList();
                        
                        // If no valid risks remain, clear the list entirely
                        if (!model.IdentifiedRisks.Any())
                        {
                            model.IdentifiedRisks = new List<CyberRiskApp.Models.Risk>();
                        }
                    }

                    // Remove ModelState entries for empty risks to prevent enum validation errors
                    var controller = context.Controller as Microsoft.AspNetCore.Mvc.Controller;
                    if (controller != null)
                    {
                        var keysToRemove = controller.ModelState.Keys
                            .Where(k => k.Contains("IdentifiedRisks"))
                            .ToList();

                        foreach (var key in keysToRemove)
                        {
                            // Check if this key corresponds to an empty risk
                            var parts = key.Split('[', ']');
                            if (parts.Length >= 2 && int.TryParse(parts[1], out int index))
                            {
                                if (model.IdentifiedRisks == null || index >= model.IdentifiedRisks.Count ||
                                    string.IsNullOrEmpty(model.IdentifiedRisks[index]?.Title))
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