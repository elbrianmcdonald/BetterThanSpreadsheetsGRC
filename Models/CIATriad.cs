using System.ComponentModel.DataAnnotations;

namespace CyberRiskApp.Models
{
    public enum CIATriad
    {
        [Display(Name = "Confidentiality")]
        Confidentiality = 1,

        [Display(Name = "Integrity")]
        Integrity = 2,

        [Display(Name = "Availability")]
        Availability = 3,

        [Display(Name = "Confidentiality & Integrity")]
        ConfidentialityIntegrity = 4,

        [Display(Name = "Confidentiality & Availability")]
        ConfidentialityAvailability = 5,

        [Display(Name = "Integrity & Availability")]
        IntegrityAvailability = 6,

        [Display(Name = "Confidentiality, Integrity & Availability")]
        All = 7
    }
}