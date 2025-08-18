using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    [Table("RiskBacklogComments")]
    public class RiskBacklogComment : IAuditableEntity
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int BacklogEntryId { get; set; }

        [ForeignKey("BacklogEntryId")]
        public virtual RiskBacklogEntry BacklogEntry { get; set; } = null!;

        [Required]
        [Display(Name = "Comment")]
        public string Comment { get; set; } = string.Empty;

        [Required]
        [StringLength(50)]
        [Display(Name = "Comment Type")]
        public string CommentType { get; set; } = string.Empty; // "Analyst", "Manager", "System"

        [Display(Name = "Is Internal")]
        public bool IsInternal { get; set; } = false; // Internal comments not visible to requester

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