using System.ComponentModel.DataAnnotations;

namespace CyberRiskApp.ViewModels
{
    public class RiskUploadViewModel
    {
        [Required(ErrorMessage = "Please select an Excel file to upload.")]
        [Display(Name = "Excel File")]
        public IFormFile ExcelFile { get; set; } = null!;

        [Display(Name = "Overwrite Existing Risks")]
        public bool OverwriteExisting { get; set; } = false;

        // Results after upload
        public int SuccessfulUploads { get; set; }
        public int FailedUploads { get; set; }
        public List<string> Errors { get; set; } = new List<string>();
        public List<string> Warnings { get; set; } = new List<string>();
    }
}