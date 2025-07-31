using CyberRiskApp.Models;

namespace CyberRiskApp.Extensions
{
    public static class MaturityExtensions
    {
        /// <summary>
        /// Converts stored maturity score to display-friendly level based on framework type
        /// </summary>
        /// <param name="assessment">The maturity assessment</param>
        /// <returns>Formatted maturity level for display</returns>
        public static string GetDisplayMaturityLevel(this MaturityAssessment assessment)
        {
            if (assessment.Framework?.Type == FrameworkType.C2M2)
            {
                // Convert C2M2 percentage back to MIL level (0-3)
                return assessment.OverallMaturityScore switch
                {
                    100m => "3",
                    >= 67m => "2", 
                    >= 33m => "1",
                    _ => "0"
                };
            }
            else
            {
                // NIST CSF and others - show as decimal
                return assessment.OverallMaturityScore.ToString("F1");
            }
        }

        /// <summary>
        /// Converts stored maturity score to actual level value for calculations
        /// </summary>
        /// <param name="assessment">The maturity assessment</param>
        /// <returns>Actual maturity level as decimal</returns>
        public static decimal GetActualMaturityLevel(this MaturityAssessment assessment)
        {
            if (assessment.Framework?.Type == FrameworkType.C2M2)
            {
                // Convert C2M2 percentage back to MIL level (0-3)
                return assessment.OverallMaturityScore switch
                {
                    100m => 3m,
                    >= 67m => 2m,
                    >= 33m => 1m,
                    _ => 0m
                };
            }
            else
            {
                // NIST CSF and others - use as-is
                return assessment.OverallMaturityScore;
            }
        }

        /// <summary>
        /// Gets the maximum possible maturity level for a framework type
        /// </summary>
        /// <param name="frameworkType">The framework type</param>
        /// <returns>Maximum maturity level</returns>
        public static int GetMaxMaturityLevel(this FrameworkType frameworkType)
        {
            return frameworkType switch
            {
                FrameworkType.C2M2 => 3,
                FrameworkType.NISTCSF => 4,
                _ => 5 // Default for custom frameworks
            };
        }
    }
}