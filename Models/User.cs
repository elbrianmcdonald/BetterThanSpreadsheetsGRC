using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace CyberRiskApp.Models
{
    public class User : IdentityUser
    {
        [Required]
        [StringLength(100)]
        [Display(Name = "First Name")]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        [Display(Name = "Last Name")]
        public string LastName { get; set; } = string.Empty;

        [StringLength(100)]
        public string Department { get; set; } = string.Empty;

        [StringLength(100)]
        [Display(Name = "Job Title")]
        public string JobTitle { get; set; } = string.Empty;

        [Display(Name = "Is Active")]
        public bool IsActive { get; set; } = true;

        [Display(Name = "Last Login")]
        public DateTime? LastLoginDate { get; set; }

        [Display(Name = "Created Date")]
        public DateTime CreatedAt { get; set; }

        [Display(Name = "Updated Date")]
        public DateTime UpdatedAt { get; set; }

        [Display(Name = "Full Name")]
        public string FullName => $"{FirstName} {LastName}";

        // Role property for easier access
        public UserRole Role { get; set; }
    }

    public enum UserRole
    {
        [Display(Name = "IT User")]
        ITUser = 1,

        [Display(Name = "GRC User")]
        GRCUser = 2,

        [Display(Name = "Admin")]
        Admin = 3
    }
}