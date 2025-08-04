using System.ComponentModel.DataAnnotations;

namespace CyberRiskApp.Models
{
    public class MaturityFramework
    {
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [StringLength(50)]
        public string Version { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        [Required]
        public FrameworkType Type { get; set; }

        public FrameworkStatus Status { get; set; }

        [StringLength(100)]
        public string UploadedBy { get; set; } = string.Empty;

        public DateTime UploadedDate { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        // Navigation properties
        public virtual ICollection<MaturityControl> Controls { get; set; } = new List<MaturityControl>();
        public virtual ICollection<MaturityAssessment> Assessments { get; set; } = new List<MaturityAssessment>();
    }

    public class MaturityControl
    {
        public int Id { get; set; }

        [Required]
        [StringLength(100)]  // Increased from 50
        public string ControlId { get; set; } = string.Empty;

        [Required]
        [StringLength(500)]  // Increased from 200
        public string Title { get; set; } = string.Empty;

        // FIXED: Removed length restriction to allow unlimited text
        public string Description { get; set; } = string.Empty;

        // For NIST CSF 2.0: Function (e.g., "Identify", "Protect", etc.)
        // For C2M2: Domain (e.g., "ASSET", "THREAT", etc.)
        [StringLength(200)]  // Increased from 100
        public string Function { get; set; } = string.Empty;

        // For NIST CSF 2.0: Category (e.g., "ID.AM", "PR.AC", etc.)
        // For C2M2: MIL (Maturity Indicator Level)
        [StringLength(200)]  // Increased from 100
        public string Category { get; set; } = string.Empty;

        // For NIST CSF 2.0: Subcategory (e.g., "ID.AM-1", "PR.AC-1", etc.)
        // For C2M2: Practice (e.g., "ASSET-1a", "THREAT-2b", etc.)
        [StringLength(200)]  // Increased from 100
        public string Subcategory { get; set; } = string.Empty;

        // For NIST CSF 2.0: Implementation Examples
        // For C2M2: Practice Text
        // FIXED: Removed length restriction to allow unlimited text
        public string ImplementationGuidance { get; set; } = string.Empty;

        // For C2M2: Help Text
        // FIXED: Removed length restriction to allow unlimited text
        public string HelpText { get; set; } = string.Empty;

        public ControlPriority Priority { get; set; }

        // Foreign key
        public int MaturityFrameworkId { get; set; }

        // Navigation properties
        public virtual MaturityFramework Framework { get; set; } = null!;
        public virtual ICollection<MaturityControlAssessment> Assessments { get; set; } = new List<MaturityControlAssessment>();
    }

    public class MaturityAssessment : IAuditableEntity
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Assessment title is required")]
        [StringLength(200)]
        public string Title { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        public AssessmentStatus Status { get; set; }

        [StringLength(100)]
        public string Assessor { get; set; } = string.Empty;

        public DateTime StartDate { get; set; }
        public DateTime? CompletedDate { get; set; }
        public DateTime? DueDate { get; set; }

        // Overall maturity score (average of all control assessments)
        public decimal OverallMaturityScore { get; set; }

        // Foreign keys
        [Required(ErrorMessage = "Please select a maturity framework")]
        [Range(1, int.MaxValue, ErrorMessage = "Please select a valid framework")]
        public int MaturityFrameworkId { get; set; }

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

        // Navigation properties
        public virtual MaturityFramework? Framework { get; set; }
        public virtual BusinessOrganization? Organization { get; set; }
        public virtual ICollection<MaturityControlAssessment> ControlAssessments { get; set; } = new List<MaturityControlAssessment>();

        // Calculated properties
        public decimal CompliancePercentage
        {
            get
            {
                if (!ControlAssessments.Any()) return 0;

                var assessedControls = ControlAssessments.Count(ca => ca.CurrentMaturityLevel > MaturityLevel.NotImplemented);
                return (decimal)assessedControls / ControlAssessments.Count * 100;
            }
        }

        public decimal MaturityScore
        {
            get
            {
                if (!ControlAssessments.Any()) return 0;

                var totalScore = ControlAssessments.Sum(ca => (int)ca.CurrentMaturityLevel);
                var maxPossibleScore = ControlAssessments.Count * (int)MaturityLevel.Managed; // Managed is the highest level (4)
                return (decimal)totalScore / maxPossibleScore * 100;
            }
        }
    }

    public class MaturityControlAssessment : IAuditableEntity
    {
        public int Id { get; set; }

        // Current and target maturity levels
        public MaturityLevel CurrentMaturityLevel { get; set; } = MaturityLevel.NotImplemented;
        public MaturityLevel TargetMaturityLevel { get; set; } = MaturityLevel.Initial;

        // Assessment details
        public string Evidence { get; set; } = string.Empty;
        public string GapNotes { get; set; } = string.Empty;
        public string RecommendedActions { get; set; } = string.Empty;
        public string Ownership { get; set; } = string.Empty;

        // Completion tracking
        public DateTime? TargetCompletionDate { get; set; }

        // Project needed to reach target maturity
        public bool ProjectNeeded { get; set; } = false;

        // T-Shirt size for project effort
        public TShirtSize? TShirtSize { get; set; }

        // Project number if applicable
        [StringLength(50)]
        public string ProjectNumber { get; set; } = string.Empty;

        // Assessment tracking fields
        [StringLength(100)]
        public string AssessedBy { get; set; } = string.Empty;

        public DateTime? AssessmentDate { get; set; }

        // Foreign keys
        public int MaturityControlId { get; set; }
        public int MaturityAssessmentId { get; set; }

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
        public virtual MaturityControl Control { get; set; } = null!;
        public virtual MaturityAssessment Assessment { get; set; } = null!;
    }
}