using CyberRiskApp.Models;

namespace CyberRiskApp.ViewModels
{
    public class BacklogDashboardViewModel
    {
        public BacklogStatistics Statistics { get; set; } = new();
        public List<RiskBacklogEntry> MyBacklogEntries { get; set; } = new();
        public List<RiskBacklogEntry> UnassignedEntries { get; set; } = new();
        public List<RiskBacklogEntry> AllEntries { get; set; } = new();
        
        // Permissions
        public bool CanAssign { get; set; }
        public bool CanApprove { get; set; }
        
        // Assignment data
        public List<User> AvailableAnalysts { get; set; } = new();
        public List<User> AvailableManagers { get; set; } = new();
        
        // Filtering
        public string CurrentFilter { get; set; } = "all";
        public string? FilterStatus { get; set; }
        public string? FilterAction { get; set; }
        public string? FilterPriority { get; set; }
        public string? FilterAssignee { get; set; }
    }

    public class BacklogDetailsViewModel
    {
        public RiskBacklogEntry Entry { get; set; } = new();
        public List<RiskBacklogComment> Comments { get; set; } = new();
        public List<RiskBacklogActivity> Activities { get; set; } = new();
        
        // Permissions
        public bool CanApprove { get; set; }
        public bool CanAssign { get; set; }
        public bool CanComment { get; set; }
        
        // Assignment data
        public List<User> AvailableAnalysts { get; set; } = new();
        public List<User> AvailableManagers { get; set; } = new();
    }

    public class BacklogReportsViewModel
    {
        public BacklogStatistics Statistics { get; set; } = new();
        public List<RiskBacklogEntry> OverdueEntries { get; set; } = new();
        public List<RiskBacklogEntry> DueEntries { get; set; } = new();
        
        // Performance data
        public Dictionary<string, int> WeeklyCompletions { get; set; } = new();
        public Dictionary<string, double> SLAPerformance { get; set; } = new();
        public Dictionary<string, int> AssigneeWorkload { get; set; } = new();
    }
}