using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class ThreatControl : IAuditableEntity
    {
        public int Id { get; set; }

        [Required]
        [StringLength(200)]
        [Display(Name = "Control Name")]
        public string ControlName { get; set; } = string.Empty;

        [Display(Name = "Control Description")]
        public string ControlDescription { get; set; } = string.Empty;

        [Required]
        [Display(Name = "Control Type")]
        public ControlType ControlType { get; set; }

        [Required]
        [Display(Name = "Control Category")]
        public ControlCategory ControlCategory { get; set; }

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
        public byte[]? RowVersion { get; set; }

        // Navigation properties for many-to-many relationships
        public virtual ICollection<ThreatVectorControl> ThreatVectorControls { get; set; } = new List<ThreatVectorControl>();
        public virtual ICollection<ThreatActorStepControl> ThreatActorStepControls { get; set; } = new List<ThreatActorStepControl>();
        public virtual ICollection<ThreatActorObjectiveControl> ThreatActorObjectiveControls { get; set; } = new List<ThreatActorObjectiveControl>();
    }

    // Junction table for ThreatVector -> Controls
    public class ThreatVectorControl
    {
        public int Id { get; set; }
        public int ThreatVectorId { get; set; }
        public int ThreatControlId { get; set; }
        
        [Required]
        [Display(Name = "Implementation Status")]
        public ControlImplementationStatus ImplementationStatus { get; set; }

        [ForeignKey("ThreatVectorId")]
        public virtual ThreatVector ThreatVector { get; set; } = null!;
        
        [ForeignKey("ThreatControlId")]
        public virtual ThreatControl ThreatControl { get; set; } = null!;
    }

    // Junction table for ThreatActorStep -> Controls
    public class ThreatActorStepControl
    {
        public int Id { get; set; }
        public int ThreatActorStepId { get; set; }
        public int ThreatControlId { get; set; }
        
        [Required]
        [Display(Name = "Implementation Status")]
        public ControlImplementationStatus ImplementationStatus { get; set; }

        [ForeignKey("ThreatActorStepId")]
        public virtual ThreatActorStep ThreatActorStep { get; set; } = null!;
        
        [ForeignKey("ThreatControlId")]
        public virtual ThreatControl ThreatControl { get; set; } = null!;
    }

    // Junction table for ThreatActorObjective -> Controls
    public class ThreatActorObjectiveControl
    {
        public int Id { get; set; }
        public int ThreatActorObjectiveId { get; set; }
        public int ThreatControlId { get; set; }
        
        [Required]
        [Display(Name = "Implementation Status")]
        public ControlImplementationStatus ImplementationStatus { get; set; }

        [ForeignKey("ThreatActorObjectiveId")]
        public virtual ThreatActorObjective ThreatActorObjective { get; set; } = null!;
        
        [ForeignKey("ThreatControlId")]
        public virtual ThreatControl ThreatControl { get; set; } = null!;
    }

    public enum ControlCategory
    {
        [Display(Name = "Current")]
        Current = 1,
        
        [Display(Name = "Needed")]
        Needed = 2
    }

    public enum ControlImplementationStatus
    {
        [Display(Name = "Not Implemented")]
        NotImplemented = 0,
        
        [Display(Name = "Partially Implemented")]
        PartiallyImplemented = 1,
        
        [Display(Name = "Fully Implemented")]
        FullyImplemented = 2,
        
        [Display(Name = "Planned")]
        Planned = 3
    }
}