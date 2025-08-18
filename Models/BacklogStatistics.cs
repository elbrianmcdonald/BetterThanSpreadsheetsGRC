namespace CyberRiskApp.Models
{
    public class BacklogStatistics
    {
        public int TotalEntries { get; set; }
        public int Unassigned { get; set; }
        public int AssignedToAnalyst { get; set; }
        public int AssignedToManager { get; set; }
        public int OverdueSLA { get; set; }
        public int CompletedThisWeek { get; set; }
        public int CompletedThisMonth { get; set; }
        public int RejectedThisMonth { get; set; }
        
        public Dictionary<RiskBacklogAction, int> ActionTypeCounts { get; set; } = new();
        public Dictionary<BacklogPriority, int> PriorityCounts { get; set; } = new();
        public Dictionary<RiskSource, int> SourceCounts { get; set; } = new();
        
        // Performance metrics
        public double AvgAnalystProcessingDays { get; set; }
        public double AvgManagerProcessingDays { get; set; }
        public double SLAComplianceRate { get; set; }
        
        // Top assignees by volume
        public Dictionary<string, int> TopAnalysts { get; set; } = new();
        public Dictionary<string, int> TopManagers { get; set; } = new();
    }
}