using System.ComponentModel.DataAnnotations;
using CyberRiskApp.Models;

namespace CyberRiskApp.ViewModels
{
    public class ReferenceDataManagementViewModel
    {
        public Dictionary<ReferenceDataCategory, int> CategoryCounts { get; set; } = new();
        public int UnusedEntriesCount { get; set; }
        public List<CategoryViewModel> Categories { get; set; } = new();
    }

    public class CategoryViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public class CategoryManagementViewModel
    {
        public ReferenceDataCategory Category { get; set; }
        public string CategoryDisplayName { get; set; } = string.Empty;
        public List<ReferenceDataEntry> Entries { get; set; } = new();
        public int CurrentPage { get; set; }
        public int PageSize { get; set; }
        public int TotalItems { get; set; }
        public int TotalPages { get; set; }
        public string? SearchTerm { get; set; }

        public bool HasPreviousPage => CurrentPage > 1;
        public bool HasNextPage => CurrentPage < TotalPages;
        public int StartItem => (CurrentPage - 1) * PageSize + 1;
        public int EndItem => Math.Min(CurrentPage * PageSize, TotalItems);
    }

    public class CreateReferenceDataViewModel
    {
        public ReferenceDataCategory Category { get; set; }
        public string CategoryDisplayName { get; set; } = string.Empty;

        [Required]
        [StringLength(200, MinimumLength = 1)]
        [Display(Name = "Value")]
        public string Value { get; set; } = string.Empty;

        [StringLength(500)]
        [Display(Name = "Description")]
        public string? Description { get; set; }
    }

    public class EditReferenceDataViewModel
    {
        public int Id { get; set; }
        public ReferenceDataCategory Category { get; set; }
        public string CategoryDisplayName { get; set; } = string.Empty;

        [Required]
        [StringLength(200, MinimumLength = 1)]
        [Display(Name = "Value")]
        public string Value { get; set; } = string.Empty;

        [StringLength(500)]
        [Display(Name = "Description")]
        public string? Description { get; set; }

        [Display(Name = "Active")]
        public bool? IsActive { get; set; }

        [Display(Name = "Usage Count")]
        public int UsageCount { get; set; }

        [Display(Name = "Created By")]
        public string CreatedBy { get; set; } = string.Empty;

        [Display(Name = "Created At")]
        public DateTime CreatedAt { get; set; }

        [Display(Name = "Updated By")]
        public string? UpdatedBy { get; set; }

        [Display(Name = "Updated At")]
        public DateTime? UpdatedAt { get; set; }
    }

    public class UnusedEntriesViewModel
    {
        public List<ReferenceDataEntry> Entries { get; set; } = new();
    }
}