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
        Critical = 4,
        Extreme = 5
    }

    public enum LikelihoodLevel
    {
        Unlikely = 1,
        Possible = 2,
        Likely = 3,
        AlmostCertain = 4,
        Certain = 5
    }

    public enum ExposureLevel
    {
        SlightlyExposed = 1,      // 0.2
        Exposed = 2,              // 0.4
        ModeratelyExposed = 3,    // 0.8
        HighlyExposed = 4,        // 1.0
        CriticallyExposed = 5     // 1.2
    }

    public enum RiskRating
    {
        Low = 1,
        Medium = 2,
        High = 3,
        Critical = 4,
        Extreme = 5
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
        Critical = 4,
        Extreme = 5
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

    // Assessment Type enum - only qualitative assessments supported
    public enum AssessmentType
    {
        Qualitative = 1     // Likelihood x Impact x Exposure (Qualitative)
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

    // NEW: Lockheed Martin Cyber Kill Chain Phases
    public enum CyberKillChainPhase
    {
        Reconnaissance = 1,     // Research, identification and selection of targets
        Weaponization = 2,      // Coupling exploit with backdoor into deliverable payload
        Delivery = 3,           // Transmission of weapon to targeted environment
        Exploitation = 4,       // Execution of code on victim's system
        Installation = 5,       // Installation of malware on the asset
        CommandAndControl = 6,  // Channel for remote manipulation of victim
        ActionsOnObjectives = 7 // Intruders accomplish their original goals
    }

    // NEW: Threat Model Status
    public enum ThreatModelStatus
    {
        Draft = 1,
        InReview = 2,
        Approved = 3,
        Active = 4,
        Archived = 5
    }

    // NEW: Attack Vector Types
    public enum AttackVector
    {
        Network = 1,
        Adjacent = 2,
        Local = 3,
        Physical = 4,
        Social = 5,
        Email = 6,
        Web = 7,
        Wireless = 8,
        Supply_Chain = 9,
        Insider = 10
    }

    // NEW: Attack Complexity
    public enum AttackComplexity
    {
        Low = 1,
        Medium = 2,
        High = 3
    }

    // NEW: Threat Actor Types
    public enum ThreatActorType
    {
        Script_Kiddie = 1,
        Cybercriminal = 2,
        Hacktivist = 3,
        Insider_Threat = 4,
        Nation_State = 5,
        Advanced_Persistent_Threat = 6,
        Competitor = 7,
        Terrorist = 8
    }

    // NEW: Threat Modeling Framework Selection
    public enum ThreatModelingFramework
    {
        MITRE = 1,
        KillChain = 2,
        Both = 3
    }

    // NEW: MITRE ATT&CK Framework Types
    public enum MitreFrameworkType
    {
        Enterprise = 1,
        ICS = 2,
        Mobile = 3
    }

    // NEW: Risk Backlog System Enums
    public enum RiskBacklogStatus
    {
        Unassigned = 1,
        AssignedToAnalyst = 2,
        AssignedToManager = 3,
        Approved = 4,
        Rejected = 5,
        Escalated = 6
    }

    public enum RiskBacklogAction
    {
        NewRisk = 1,
        RiskAcceptance = 2,
        RiskExtension = 3,
        RiskReview = 4,
        RiskReassessment = 5,
        NewFinding = 6,
        FindingReview = 7,
        FindingClosure = 8
    }

    public enum BacklogPriority
    {
        Low = 1,
        Medium = 2,
        High = 3,
        Critical = 4
    }

    public enum RiskSource
    {
        FindingAcceptance = 1,
        ManualImport = 2,
        RiskAssessment = 3
    }
}