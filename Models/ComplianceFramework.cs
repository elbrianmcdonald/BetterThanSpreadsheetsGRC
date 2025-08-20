using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CyberRiskApp.Models
{
    public class ComplianceFramework : IEntity
    {
        public int Id { get; set; }

        [Required]
        [Column(TypeName = "text")]
        public string Name { get; set; } = string.Empty;

        [Column(TypeName = "text")]
        public string Version { get; set; } = string.Empty;

        [Column(TypeName = "text")]
        public string Description { get; set; } = string.Empty;

        [Required]
        public FrameworkType Type { get; set; }

        public FrameworkStatus Status { get; set; }

        [Column(TypeName = "text")]
        public string UploadedBy { get; set; } = string.Empty;

        public DateTime UploadedDate { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        // Navigation properties
        public virtual ICollection<ComplianceControl> Controls { get; set; } = new List<ComplianceControl>();
        public virtual ICollection<ComplianceAssessment> Assessments { get; set; } = new List<ComplianceAssessment>();

        // Computed properties for NIST 800-53 frameworks
        [NotMapped]
        public int BaseControlCount => Controls?.Where(c => !c.ControlId.Contains("(")).Count() ?? 0;

        [NotMapped]
        public int EnhancementCount => Controls?.Where(c => c.ControlId.Contains("(")).Count() ?? 0;

        [NotMapped]
        public int ControlFamilyCount => Controls?.GroupBy(c => c.Category).Count() ?? 0;

        [NotMapped]
        public Dictionary<string, int> ControlsByFamily =>
            Controls?.GroupBy(c => c.Category)
                   .ToDictionary(g => g.Key, g => g.Count()) ?? new Dictionary<string, int>();
    }

    public class ComplianceControl : IEntity
    {
        public int Id { get; set; }

        [Required]
        [Column(TypeName = "text")]
        public string ControlId { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "text")]
        public string Title { get; set; } = string.Empty;

        [Column(TypeName = "text")]
        public string Description { get; set; } = string.Empty;

        [Column(TypeName = "text")]
        public string Category { get; set; } = string.Empty;

        public ControlPriority Priority { get; set; }

        // ENHANCED: Additional fields for NIST 800-53 structure
        [Column(TypeName = "text")]
        public string ControlText { get; set; } = string.Empty; // Raw control requirements

        [Column(TypeName = "text")]
        public string SupplementalGuidance { get; set; } = string.Empty; // Discussion/guidance

        [Column(TypeName = "text")]
        public string RelatedControls { get; set; } = string.Empty; // Related control references

        [Column(TypeName = "text")]
        public string ControlEnhancements { get; set; } = string.Empty; // Available enhancements for base controls

        // NIST-specific computed properties
        [NotMapped]
        public bool IsEnhancement => ControlId.Contains("(");

        [NotMapped]
        public string BaseControlId => IsEnhancement ?
            System.Text.RegularExpressions.Regex.Match(ControlId, @"^([A-Z]+-\d+)").Groups[1].Value :
            ControlId;

        [NotMapped]
        public string ControlFamily =>
            System.Text.RegularExpressions.Regex.Match(ControlId, @"^([A-Z]+)").Groups[1].Value;

        [NotMapped]
        public int AssignmentParameterCount =>
            System.Text.RegularExpressions.Regex.Matches(ControlText ?? "", @"\[Assignment:[^\]]+\]").Count;

        [NotMapped]
        public int SelectionParameterCount =>
            System.Text.RegularExpressions.Regex.Matches(ControlText ?? "", @"\[Selection[^\]]+\]").Count;

        [NotMapped]
        public bool HasParameters => AssignmentParameterCount > 0 || SelectionParameterCount > 0;

        // Foreign key
        public int ComplianceFrameworkId { get; set; }

        // Navigation properties
        public virtual ComplianceFramework Framework { get; set; } = null!;
        public virtual ICollection<ControlAssessment> Assessments { get; set; } = new List<ControlAssessment>();
        public virtual ICollection<CapabilityControlMapping> CapabilityMappings { get; set; } = new List<CapabilityControlMapping>();
    }

    public class BusinessOrganization : IEntity
    {
        public int Id { get; set; }

        [Required]
        [Column(TypeName = "text")]
        public string Name { get; set; } = string.Empty;

        [Column(TypeName = "text")]
        public string Code { get; set; } = string.Empty;

        [Column(TypeName = "text")]
        public string Description { get; set; } = string.Empty;

        [Column(TypeName = "text")]
        public string ComplianceOwner { get; set; } = string.Empty;

        [Column(TypeName = "text")]
        public string Stakeholders { get; set; } = string.Empty;

        public OrganizationType Type { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        // Navigation properties
        public virtual ICollection<ComplianceAssessment> Assessments { get; set; } = new List<ComplianceAssessment>();
    }

    public class ComplianceAssessment : IAuditableEntity
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Assessment title is required")]
        [Column(TypeName = "text")]
        public string Title { get; set; } = string.Empty;

        [Column(TypeName = "text")]
        public string Description { get; set; } = string.Empty;

        public AssessmentStatus Status { get; set; }

        [Column(TypeName = "text")]
        public string Assessor { get; set; } = string.Empty;

        public DateTime StartDate { get; set; }
        public DateTime? CompletedDate { get; set; }
        public DateTime? DueDate { get; set; }

        [Display(Name = "SLA Deadline")]
        [DataType(DataType.DateTime)]
        public DateTime? SlaDeadline { get; set; }

        public decimal CompliancePercentage { get; set; }

        // Foreign keys
        [Required(ErrorMessage = "Please select a compliance framework")]
        [Range(1, int.MaxValue, ErrorMessage = "Please select a valid framework")]
        public int ComplianceFrameworkId { get; set; }

        [Required(ErrorMessage = "Please select an organization")]
        [Range(1, int.MaxValue, ErrorMessage = "Please select a valid organization")]
        public int BusinessOrganizationId { get; set; }

        // Audit and Concurrency Control Fields
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        
        [Required]
        [StringLength(100)]
        [Display(Name = "Created By")]
        [ScaffoldColumn(false)] // Hide from forms
        public string CreatedBy { get; set; } = string.Empty;
        
        [Required]
        [StringLength(100)]
        [Display(Name = "Updated By")]
        [ScaffoldColumn(false)] // Hide from forms
        public string UpdatedBy { get; set; } = string.Empty;
        
        [Timestamp]
        public byte[] RowVersion { get; set; } = Array.Empty<byte>();

        // SLA-related computed properties
        [NotMapped]
        public bool IsOverdue
        {
            get
            {
                if (Status == AssessmentStatus.Completed || Status == AssessmentStatus.Approved || !SlaDeadline.HasValue)
                    return false;
                return DateTime.UtcNow > SlaDeadline.Value;
            }
        }

        [NotMapped]
        public TimeSpan? TimeUntilDeadline
        {
            get
            {
                if (!SlaDeadline.HasValue || Status == AssessmentStatus.Completed || Status == AssessmentStatus.Approved)
                    return null;
                var timeSpan = SlaDeadline.Value - DateTime.UtcNow;
                return timeSpan.TotalSeconds > 0 ? timeSpan : null;
            }
        }

        [NotMapped]
        public TimeSpan? OverdueBy
        {
            get
            {
                if (!IsOverdue || !SlaDeadline.HasValue)
                    return null;
                return DateTime.UtcNow - SlaDeadline.Value;
            }
        }

        // Navigation properties
        public virtual ComplianceFramework? Framework { get; set; }
        public virtual BusinessOrganization? Organization { get; set; }
        public virtual ICollection<ControlAssessment> ControlAssessments { get; set; } = new List<ControlAssessment>();
    }

    public class ControlAssessment : IAuditableEntity
    {
        public int Id { get; set; }

        // Compliance Status
        public ComplianceStatus Status { get; set; } = ComplianceStatus.NonCompliant;

        // Score field
        [Column(TypeName = "text")]
        public string Score { get; set; } = string.Empty;

        // Evidence of Compliance
        [Column(TypeName = "text")]
        public string EvidenceOfCompliance { get; set; } = string.Empty;

        // Gap Notes
        [Column(TypeName = "text")]
        public string GapNotes { get; set; } = string.Empty;

        // Ownership
        [Column(TypeName = "text")]
        public string Ownership { get; set; } = string.Empty;

        // Projected Compliance Date
        public DateTime? ProjectedComplianceDate { get; set; }

        // Project Needed
        public bool ProjectNeeded { get; set; } = false;

        // T-Shirt Size
        public TShirtSize? TShirtSize { get; set; }

        // Project Number
        [Column(TypeName = "text")]
        public string ProjectNumber { get; set; } = string.Empty;

        // Assessment tracking fields
        [Column(TypeName = "text")]
        public string AssessedBy { get; set; } = string.Empty;

        public DateTime? AssessmentDate { get; set; }

        // ENHANCED: NIST-specific assessment fields
        [Column(TypeName = "text")]
        public string AssignmentParameters { get; set; } = string.Empty; // Organization-defined parameters

        [Column(TypeName = "text")]
        public string SelectionParameters { get; set; } = string.Empty; // Selected options

        [Column(TypeName = "text")]
        public string ImplementationNotes { get; set; } = string.Empty; // How the control is implemented

        [Column(TypeName = "text")]
        public string TestingProcedures { get; set; } = string.Empty; // How compliance is tested

        public DateTime? LastTestDate { get; set; }
        public DateTime? NextTestDate { get; set; }

        // Foreign keys
        public int ComplianceControlId { get; set; }
        public int ComplianceAssessmentId { get; set; }

        // Audit and Concurrency Control Fields
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        
        [Required]
        [StringLength(100)]
        [Display(Name = "Created By")]
        [ScaffoldColumn(false)] // Hide from forms
        public string CreatedBy { get; set; } = string.Empty;
        
        [Required]
        [StringLength(100)]
        [Display(Name = "Updated By")]
        [ScaffoldColumn(false)] // Hide from forms
        public string UpdatedBy { get; set; } = string.Empty;
        
        [Timestamp]
        public byte[] RowVersion { get; set; } = Array.Empty<byte>();

        // Navigation properties
        public virtual ComplianceControl Control { get; set; } = null!;
        public virtual ComplianceAssessment Assessment { get; set; } = null!;

        // Legacy properties for backward compatibility
        public string Evidence
        {
            get => EvidenceOfCompliance;
            set => EvidenceOfCompliance = value;
        }

        public string Notes
        {
            get => GapNotes;
            set => GapNotes = value;
        }
    }
}