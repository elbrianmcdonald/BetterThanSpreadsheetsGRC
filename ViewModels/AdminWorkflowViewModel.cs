using CyberRiskApp.Models;

namespace CyberRiskApp.ViewModels
{
    public class AdminWorkflowViewModel
    {
        public List<RiskBacklogEntry> UnassignedEntries { get; set; } = new();
        public List<RiskBacklogEntry> AnalystEntries { get; set; } = new();
        public List<RiskBacklogEntry> ManagerEntries { get; set; } = new();
        public List<RiskBacklogEntry> ApprovedEntries { get; set; } = new();
        public List<RiskBacklogEntry> RejectedEntries { get; set; } = new();
        public List<RiskBacklogEntry> EscalatedEntries { get; set; } = new();
        
        public int TotalEntries { get; set; }
        public List<RiskBacklogEntry> OrphanedEntries { get; set; } = new();
        public List<RiskBacklogEntry> StuckEntries { get; set; } = new();
        public int RecentErrorsCount { get; set; }
        
        // Workflow counts for visualization
        public int UnassignedCount => UnassignedEntries.Count;
        public int AnalystCount => AnalystEntries.Count;
        public int ManagerCount => ManagerEntries.Count;
        public int ApprovedCount => ApprovedEntries.Count;
        public int RejectedCount => RejectedEntries.Count;
        public int EscalatedCount => EscalatedEntries.Count;
        
        // System health indicators
        public int OrphanedCount => OrphanedEntries.Count;
        public int StuckCount => StuckEntries.Count;
        
        // Calculated health score (0-100)
        public int SystemHealthScore
        {
            get
            {
                if (TotalEntries == 0) return 100;
                
                var problemEntries = OrphanedCount + StuckCount + RecentErrorsCount;
                var healthPercentage = Math.Max(0, 100 - (problemEntries * 100 / TotalEntries));
                return Math.Min(100, healthPercentage);
            }
        }
    }
}