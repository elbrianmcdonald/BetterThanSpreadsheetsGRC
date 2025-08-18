namespace CyberRiskApp.ViewModels
{
    public class SystemHealthViewModel
    {
        public int TotalBacklogEntries { get; set; }
        public int OrphanedEntriesCount { get; set; }
        public int StuckEntriesCount { get; set; }
        public int RecentErrorsCount { get; set; }
        
        public Dictionary<string, int> BacklogByStatus { get; set; } = new();
        
        // Calculated metrics
        public double OrphanedPercentage => TotalBacklogEntries > 0 ? (OrphanedEntriesCount * 100.0 / TotalBacklogEntries) : 0;
        public double StuckPercentage => TotalBacklogEntries > 0 ? (StuckEntriesCount * 100.0 / TotalBacklogEntries) : 0;
        
        // System health score (0-100)
        public int HealthScore
        {
            get
            {
                if (TotalBacklogEntries == 0) return 100;
                
                var problemEntries = OrphanedEntriesCount + StuckEntriesCount + RecentErrorsCount;
                var healthPercentage = Math.Max(0, 100 - (problemEntries * 100 / TotalBacklogEntries));
                return Math.Min(100, healthPercentage);
            }
        }
        
        public string HealthStatus => HealthScore switch
        {
            >= 90 => "Excellent",
            >= 75 => "Good", 
            >= 50 => "Fair",
            >= 25 => "Poor",
            _ => "Critical"
        };
        
        public string HealthColor => HealthScore switch
        {
            >= 90 => "success",
            >= 75 => "info",
            >= 50 => "warning", 
            >= 25 => "danger",
            _ => "dark"
        };
    }
}