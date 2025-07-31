using CyberRiskApp.Models;

namespace CyberRiskApp.ViewModels
{
    public class RequestsViewModel
    {
        public IEnumerable<AssessmentRequest> AssessmentRequests { get; set; } = new List<AssessmentRequest>();
        public IEnumerable<RiskAcceptanceRequest> AcceptanceRequests { get; set; } = new List<RiskAcceptanceRequest>();
    }
}