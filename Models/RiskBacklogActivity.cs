using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("RiskBacklogActivities")]
    public class RiskBacklogActivity : IAuditableEntity
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int BacklogEntryId { get; set; }

        [ForeignKey("BacklogEntryId")]
        public virtual RiskBacklogEntry BacklogEntry { get; set; } = null!;

        [Required]
        [StringLength(100)]
        [Display(Name = "Activity Type")]
        public string ActivityType { get; set; } = string.Empty; // "StatusChange", "Assignment", "Comment", "Priority", etc.

        [StringLength(200)]
        [Display(Name = "From Value")]
        public string FromValue { get; set; } = string.Empty;

        [StringLength(200)]
        [Display(Name = "To Value")]
        public string ToValue { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Description")]
        public string Description { get; set; } = string.Empty;

        [StringLength(500)]
        [Display(Name = "Additional Details")]
        public string AdditionalDetails { get; set; } = string.Empty;

        // Audit fields
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        [Required]
        [StringLength(100)]
        [Display(Name = "Created By")]
        public string CreatedBy { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        [Display(Name = "Updated By")]
        public string UpdatedBy { get; set; } = string.Empty;

        [Timestamp]
        public byte[] RowVersion { get; set; } = Array.Empty<byte>();
    }
}