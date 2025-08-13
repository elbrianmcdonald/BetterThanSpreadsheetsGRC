using CyberRiskApp.Models;

namespace CyberRiskApp.ViewModels
{
    public class RequestManagementViewModel
    {
        public IEnumerable<AssessmentRequest> AssessmentRequests { get; set; } = new List<AssessmentRequest>();
        public IEnumerable<RiskAcceptanceRequest> RiskAcceptanceRequests { get; set; } = new List<RiskAcceptanceRequest>();
        public IEnumerable<FindingClosureRequest> FindingClosureRequests { get; set; } = new List<FindingClosureRequest>();
        public List<User> AvailableAssignees { get; set; } = new List<User>();

        // Summary counts
        public int TotalUnassignedAssessments => AssessmentRequests.Count(r => string.IsNullOrEmpty(r.AssignedToUserId));
        public int TotalUnassignedAcceptances => RiskAcceptanceRequests.Count(r => string.IsNullOrEmpty(r.AssignedToUserId));
        public int TotalUnassignedClosures => FindingClosureRequests.Count(r => string.IsNullOrEmpty(r.AssignedToUserId));
        
        public int TotalPendingRequests => 
            AssessmentRequests.Count(r => r.Status == RequestStatus.Pending) +
            RiskAcceptanceRequests.Count(r => r.Status == RequestStatus.PendingApproval) +
            FindingClosureRequests.Count(r => r.Status == RequestStatus.PendingApproval);

        public int TotalInProgressRequests =>
            AssessmentRequests.Count(r => r.Status == RequestStatus.InProgress) +
            RiskAcceptanceRequests.Count(r => r.Status == RequestStatus.InProgress) +
            FindingClosureRequests.Count(r => r.Status == RequestStatus.InProgress);
    }
}