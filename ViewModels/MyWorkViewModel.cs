using CyberRiskApp.Models;

namespace CyberRiskApp.ViewModels
{
    public class MyWorkViewModel
    {
        public IEnumerable<AssessmentRequest> AssignedAssessmentRequests { get; set; } = new List<AssessmentRequest>();
        public IEnumerable<RiskAcceptanceRequest> AssignedAcceptanceRequests { get; set; } = new List<RiskAcceptanceRequest>();
        public IEnumerable<FindingClosureRequest> AssignedClosureRequests { get; set; } = new List<FindingClosureRequest>();

        public int TotalAssignedRequests => 
            AssignedAssessmentRequests.Count() + 
            AssignedAcceptanceRequests.Count() + 
            AssignedClosureRequests.Count();

        public int PendingRequests => 
            AssignedAssessmentRequests.Count(r => r.Status == RequestStatus.Pending) +
            AssignedAcceptanceRequests.Count(r => r.Status == RequestStatus.PendingApproval) +
            AssignedClosureRequests.Count(r => r.Status == RequestStatus.PendingApproval);

        public int InProgressRequests => 
            AssignedAssessmentRequests.Count(r => r.Status == RequestStatus.InProgress) +
            AssignedAcceptanceRequests.Count(r => r.Status == RequestStatus.InProgress) +
            AssignedClosureRequests.Count(r => r.Status == RequestStatus.InProgress);

        public int CompletedRequests => 
            AssignedAssessmentRequests.Count(r => r.Status == RequestStatus.Completed) +
            AssignedAcceptanceRequests.Count(r => r.Status == RequestStatus.Completed) +
            AssignedClosureRequests.Count(r => r.Status == RequestStatus.Completed);
    }
}