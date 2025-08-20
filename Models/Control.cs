using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class Control : IAuditableEntity
    {
        public int Id { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Control Name")]
        public string Name { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Control Description")]
        public string Description { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Control Type")]
        public ControlType ControlType { get; set; }

        [Required]
        [Display(Name = "Control Status")]
        public ControlStatus ControlStatus { get; set; }

        // Foreign key relationships for different threat components
        public int? ThreatVectorId { get; set; }
        public int? ThreatActorStepId { get; set; }
        public int? ThreatActorObjectiveId { get; set; }

        // Audit and Concurrency Control Fields
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

        // Navigation properties
        [ForeignKey("ThreatVectorId")]
        public virtual ThreatVector? ThreatVector { get; set; }

        [ForeignKey("ThreatActorStepId")]
        public virtual ThreatActorStep? ThreatActorStep { get; set; }

        [ForeignKey("ThreatActorObjectiveId")]
        public virtual ThreatActorObjective? ThreatActorObjective { get; set; }
    }

    public enum ControlType
    {
        [Display(Name = "Protective")]
        Protective = 0,
        
        [Display(Name = "Detective")]
        Detective = 1
    }

    public enum ControlStatus
    {
        [Display(Name = "Current")]
        Current = 0,
        
        [Display(Name = "Needed")]
        Needed = 1
    }
}