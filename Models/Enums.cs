namespace CyberRiskApp.Models
{
    public enum FrameworkType
    {
        ISO27001 = 1,
        NIST = 2,
        SOX = 3,
        Custom = 4,
        GDPR = 5,
        HIPAA = 6,
        // NEW: Maturity Framework Types
        NISTCSF = 7,    // NIST Cybersecurity Framework 2.0
        C2M2 = 8        // Cybersecurity Capability Maturity Model
    }

    public enum FrameworkStatus
    {
        Draft = 1,
        Active = 2,
        Archived = 3,
        Deprecated = 4
    }

    public enum ControlPriority
    {
        Low = 1,
        Medium = 2,
        High = 3,
        Critical = 4
    }

    public enum OrganizationType
    {
        IT = 1,
        OT = 2,
        Finance = 3,
        HR = 4,
        Legal = 5,
        Operations = 6,
        Other = 7
    }

    // UPDATED: New ComplianceStatus enum with your requested values
    public enum ComplianceStatus
    {
        NonCompliant = 1,
        PartiallyCompliant = 2,
        MajorlyCompliant = 3,
        FullyCompliant = 4,
        NotApplicable = 5
    }

    // NEW: Maturity Level enum for maturity assessments (0-4 for NIST CSF, 1-3 for C2M2)
    public enum MaturityLevel
    {
        NotImplemented = 0,     // Level 0 - NIST CSF only
        Initial = 1,            // Level 1 - Both frameworks
        Developing = 2,         // Level 2 - Both frameworks  
        Defined = 3,            // Level 3 - Both frameworks
        Managed = 4             // Level 4 - NIST CSF only
    }

    // NEW: T-Shirt Size enum for project sizing
    public enum TShirtSize
    {
        XS = 1,
        S = 2,
        M = 3,
        L = 4,
        XL = 5,
        XXL = 6
    }

    public enum ImpactLevel
    {
        Low = 1,
        Medium = 2,
        High = 3,
        Critical = 4
    }

    public enum LikelihoodLevel
    {
        Unlikely = 1,
        Possible = 2,
        Likely = 3,
        AlmostCertain = 4
    }

    public enum ExposureLevel
    {
        SlightlyExposed = 1,      // 0.2
        Exposed = 2,              // 0.4
        ModeratelyExposed = 3,    // 0.8
        HighlyExposed = 4         // 1.0
    }

    public enum RiskRating
    {
        Low = 1,
        Medium = 2,
        High = 3,
        Critical = 4
    }

    public enum FindingStatus
    {
        Open = 1,
        Closed = 2,
        RiskAccepted = 3
    }

    public enum RiskStatus
    {
        Open = 1,
        Closed = 2,
        Accepted = 3,
        UnderReview = 4
    }

    public enum RiskLevel
    {
        Low = 1,
        Medium = 2,
        High = 3,
        Critical = 4
    }

    public enum TreatmentStrategy
    {
        Mitigate = 1,
        Transfer = 2,
        Accept = 3,
        Avoid = 4
    }

    public enum AssessmentStatus
    {
        Draft = 1,
        InProgress = 2,
        Completed = 3,
        Approved = 4
    }

    // NEW: Assessment Type enum to distinguish between assessment methods
    public enum AssessmentType
    {
        FAIR = 1,           // Factor Analysis of Information Risk (Quantitative)
        Qualitative = 2     // Likelihood x Impact x Exposure (Qualitative)
    }

    public enum Priority
    {
        Low = 1,
        Medium = 2,
        High = 3,
        Urgent = 4
    }

    public enum RequestStatus
    {
        Pending = 1,
        InProgress = 2,
        Completed = 3,
        Rejected = 4,
        PendingApproval = 5,
        Approved = 6
    }

    public enum AcceptanceDuration
    {
        Temporary = 1,
        Permanent = 2,
        Custom = 3
    }
}