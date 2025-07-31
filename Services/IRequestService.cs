using CyberRiskApp.Models;

namespace CyberRiskApp.Services
{
    public interface IRequestService
    {
        // Assessment Request methods
        Task<IEnumerable<AssessmentRequest>> GetAllAssessmentRequestsAsync();
        Task<AssessmentRequest?> GetAssessmentRequestByIdAsync(int id);
        Task<AssessmentRequest> CreateAssessmentRequestAsync(AssessmentRequest request);
        Task<AssessmentRequest> UpdateAssessmentRequestAsync(AssessmentRequest request);
        Task<bool> DeleteAssessmentRequestAsync(int id);
        Task<IEnumerable<AssessmentRequest>> GetPendingAssessmentRequestsAsync();

        // Assignment methods
        Task<IEnumerable<AssessmentRequest>> GetUnassignedAssessmentRequestsAsync();
        Task<IEnumerable<AssessmentRequest>> GetAssignedRequestsForUserAsync(string userId);
        Task<IEnumerable<RiskAcceptanceRequest>> GetAssignedAcceptanceRequestsForUserAsync(string userId);
        Task<IEnumerable<FindingClosureRequest>> GetAssignedClosureRequestsForUserAsync(string userId);
        Task<AssessmentRequest> AssignAssessmentRequestAsync(int requestId, string assignedToUserId, string assignedByUserId, string? notes = null, decimal? estimatedHours = null);
        Task<AssessmentRequest> StartAssessmentRequestAsync(int requestId, string userId);
        Task<AssessmentRequest> CompleteAssessmentRequestAsync(int requestId, string userId, decimal? actualHours = null, string? notes = null);

        // User methods
        Task<IEnumerable<User>> GetGRCUsersAsync();

        // Risk Acceptance Request methods
        Task<IEnumerable<RiskAcceptanceRequest>> GetAllAcceptanceRequestsAsync();
        Task<RiskAcceptanceRequest?> GetAcceptanceRequestByIdAsync(int id);
        Task<RiskAcceptanceRequest> CreateAcceptanceRequestAsync(RiskAcceptanceRequest request);
        Task<RiskAcceptanceRequest> UpdateAcceptanceRequestAsync(RiskAcceptanceRequest request);
        Task<bool> DeleteAcceptanceRequestAsync(int id);
        Task<IEnumerable<RiskAcceptanceRequest>> GetPendingAcceptanceRequestsAsync();

        // NEW methods for getting open findings and risks
        Task<IEnumerable<Finding>> GetOpenFindingsAsync();
        Task<IEnumerable<Risk>> GetOpenRisksAsync();

        // Assignment methods for Risk Acceptance Requests
        Task<IEnumerable<RiskAcceptanceRequest>> GetUnassignedAcceptanceRequestsAsync();
        Task<RiskAcceptanceRequest> AssignAcceptanceRequestAsync(int requestId, string assignedToUserId, string assignedByUserId, string? notes = null);
        Task<RiskAcceptanceRequest> StartAcceptanceRequestAsync(int requestId, string userId);
        Task<RiskAcceptanceRequest> CompleteAcceptanceRequestAsync(int requestId, string userId);

        // Assignment methods for Finding Closure Requests
        Task<IEnumerable<FindingClosureRequest>> GetAllClosureRequestsAsync();
        Task<FindingClosureRequest?> GetClosureRequestByIdAsync(int id);
        Task<FindingClosureRequest> CreateClosureRequestAsync(FindingClosureRequest request);
        Task<FindingClosureRequest> UpdateClosureRequestAsync(FindingClosureRequest request);
        Task<bool> DeleteClosureRequestAsync(int id);
        Task<IEnumerable<FindingClosureRequest>> GetPendingClosureRequestsAsync();
        Task<IEnumerable<FindingClosureRequest>> GetUnassignedClosureRequestsAsync();
        Task<FindingClosureRequest> AssignClosureRequestAsync(int requestId, string assignedToUserId, string assignedByUserId, string? notes = null);
        Task<FindingClosureRequest> StartClosureRequestAsync(int requestId, string userId);
        Task<FindingClosureRequest> CompleteClosureRequestAsync(int requestId, string userId);
    }
}