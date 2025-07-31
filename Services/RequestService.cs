using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class RequestService : IRequestService
    {
        private readonly CyberRiskContext _context;

        public RequestService(CyberRiskContext context)
        {
            _context = context;
        }

        // Assessment Request methods
        public async Task<IEnumerable<AssessmentRequest>> GetAllAssessmentRequestsAsync()
        {
            try
            {
                return await _context.AssessmentRequests
                    .Include(r => r.AssignedToUser)
                    .Include(r => r.AssignedByUser)
                    .OrderByDescending(r => r.RequestDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<AssessmentRequest>();
            }
        }

        public async Task<AssessmentRequest?> GetAssessmentRequestByIdAsync(int id)
        {
            try
            {
                return await _context.AssessmentRequests
                    .Include(r => r.AssignedToUser)
                    .Include(r => r.AssignedByUser)
                    .FirstOrDefaultAsync(r => r.Id == id);
            }
            catch
            {
                return null;
            }
        }

        public async Task<AssessmentRequest> CreateAssessmentRequestAsync(AssessmentRequest request)
        {
            request.RequestDate = DateTime.Today;
            request.Status = RequestStatus.Pending;
            request.CreatedAt = DateTime.Now;
            request.UpdatedAt = DateTime.Now;

            _context.AssessmentRequests.Add(request);
            await _context.SaveChangesAsync();
            return request;
        }

        public async Task<AssessmentRequest> UpdateAssessmentRequestAsync(AssessmentRequest request)
        {
            request.UpdatedAt = DateTime.Now;
            _context.Entry(request).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return request;
        }

        public async Task<bool> DeleteAssessmentRequestAsync(int id)
        {
            try
            {
                var request = await _context.AssessmentRequests.FindAsync(id);
                if (request == null)
                    return false;

                _context.AssessmentRequests.Remove(request);
                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<IEnumerable<AssessmentRequest>> GetPendingAssessmentRequestsAsync()
        {
            try
            {
                return await _context.AssessmentRequests
                    .Include(r => r.AssignedToUser)
                    .Include(r => r.AssignedByUser)
                    .Where(r => r.Status == RequestStatus.Pending)
                    .OrderBy(r => r.RequestDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<AssessmentRequest>();
            }
        }

        // Assignment methods
        public async Task<IEnumerable<AssessmentRequest>> GetUnassignedAssessmentRequestsAsync()
        {
            try
            {
                return await _context.AssessmentRequests
                    .Where(r => string.IsNullOrEmpty(r.AssignedToUserId) && r.Status == RequestStatus.Pending)
                    .OrderBy(r => r.RequestDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<AssessmentRequest>();
            }
        }

        public async Task<IEnumerable<AssessmentRequest>> GetAssignedRequestsForUserAsync(string userId)
        {
            try
            {
                return await _context.AssessmentRequests
                    .Include(r => r.AssignedByUser)
                    .Where(r => r.AssignedToUserId == userId)
                    .OrderByDescending(r => r.AssignmentDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<AssessmentRequest>();
            }
        }

        public async Task<IEnumerable<RiskAcceptanceRequest>> GetAssignedAcceptanceRequestsForUserAsync(string userId)
        {
            try
            {
                return await _context.RiskAcceptanceRequests
                    .Include(r => r.LinkedFinding)
                    .Include(r => r.LinkedRisk)
                    .Include(r => r.AssignedByUser)
                    .Where(r => r.AssignedToUserId == userId)
                    .OrderByDescending(r => r.AssignmentDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<RiskAcceptanceRequest>();
            }
        }

        public async Task<IEnumerable<FindingClosureRequest>> GetAssignedClosureRequestsForUserAsync(string userId)
        {
            try
            {
                return await _context.FindingClosureRequests
                    .Include(r => r.LinkedFinding)
                    .Include(r => r.AssignedByUser)
                    .Where(r => r.AssignedToUserId == userId)
                    .OrderByDescending(r => r.AssignmentDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<FindingClosureRequest>();
            }
        }

        public async Task<AssessmentRequest> AssignAssessmentRequestAsync(int requestId, string assignedToUserId, string assignedByUserId, string? notes = null, decimal? estimatedHours = null)
        {
            var request = await _context.AssessmentRequests.FindAsync(requestId);
            if (request == null)
                throw new ArgumentException("Assessment request not found");

            request.AssignedToUserId = assignedToUserId;
            request.AssignedByUserId = assignedByUserId;
            request.AssignmentDate = DateTime.Now;
            request.AssignmentNotes = notes ?? string.Empty;
            request.EstimatedHours = estimatedHours;
            request.UpdatedAt = DateTime.Now;

            var assignedUser = await _context.Users.FindAsync(assignedToUserId);
            request.AssignedTo = assignedUser?.FullName ?? "Unknown User";

            await _context.SaveChangesAsync();
            return request;
        }

        public async Task<AssessmentRequest> StartAssessmentRequestAsync(int requestId, string userId)
        {
            var request = await _context.AssessmentRequests.FindAsync(requestId);
            if (request == null)
                throw new ArgumentException("Assessment request not found");

            if (request.AssignedToUserId != userId)
                throw new UnauthorizedAccessException("User is not assigned to this request");

            request.StartedDate = DateTime.Now;
            request.Status = RequestStatus.InProgress;
            request.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();
            return request;
        }

        public async Task<AssessmentRequest> CompleteAssessmentRequestAsync(int requestId, string userId, decimal? actualHours = null, string? notes = null)
        {
            var request = await _context.AssessmentRequests.FindAsync(requestId);
            if (request == null)
                throw new ArgumentException("Assessment request not found");

            if (request.AssignedToUserId != userId)
                throw new UnauthorizedAccessException("User is not assigned to this request");

            request.CompletedDate = DateTime.Now;
            request.ActualHours = actualHours;
            request.Status = RequestStatus.Completed;
            request.UpdatedAt = DateTime.Now;

            if (!string.IsNullOrEmpty(notes))
            {
                request.Notes = string.IsNullOrEmpty(request.Notes) ?
                    notes : $"{request.Notes}\n\nCompletion Notes: {notes}";
            }

            await _context.SaveChangesAsync();
            return request;
        }

        // User methods
        public async Task<IEnumerable<User>> GetGRCUsersAsync()
        {
            try
            {
                return await _context.Users
                    .Where(u => u.IsActive && (u.Role == UserRole.GRCUser || u.Role == UserRole.Admin))
                    .OrderBy(u => u.FirstName)
                    .ThenBy(u => u.LastName)
                    .ToListAsync();
            }
            catch
            {
                return new List<User>();
            }
        }

        // Risk Acceptance Request methods
        public async Task<IEnumerable<RiskAcceptanceRequest>> GetAllAcceptanceRequestsAsync()
        {
            try
            {
                return await _context.RiskAcceptanceRequests
                    .Include(r => r.LinkedFinding)
                    .Include(r => r.LinkedRisk)
                    .Include(r => r.AssignedToUser)
                    .Include(r => r.AssignedByUser)
                    .OrderByDescending(r => r.RequestDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<RiskAcceptanceRequest>();
            }
        }

        public async Task<RiskAcceptanceRequest?> GetAcceptanceRequestByIdAsync(int id)
        {
            try
            {
                return await _context.RiskAcceptanceRequests
                    .Include(r => r.LinkedFinding)
                    .Include(r => r.LinkedRisk)
                    .Include(r => r.AssignedToUser)
                    .Include(r => r.AssignedByUser)
                    .FirstOrDefaultAsync(r => r.Id == id);
            }
            catch
            {
                return null;
            }
        }

        public async Task<RiskAcceptanceRequest> CreateAcceptanceRequestAsync(RiskAcceptanceRequest request)
        {
            request.RequestDate = DateTime.Today;
            request.Status = RequestStatus.PendingApproval;
            request.CreatedAt = DateTime.Now;
            request.UpdatedAt = DateTime.Now;

            _context.RiskAcceptanceRequests.Add(request);
            await _context.SaveChangesAsync();
            return request;
        }

        public async Task<RiskAcceptanceRequest> UpdateAcceptanceRequestAsync(RiskAcceptanceRequest request)
        {
            request.UpdatedAt = DateTime.Now;
            _context.Entry(request).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return request;
        }

        public async Task<bool> DeleteAcceptanceRequestAsync(int id)
        {
            try
            {
                var request = await _context.RiskAcceptanceRequests.FindAsync(id);
                if (request == null)
                    return false;

                _context.RiskAcceptanceRequests.Remove(request);
                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<IEnumerable<RiskAcceptanceRequest>> GetPendingAcceptanceRequestsAsync()
        {
            try
            {
                return await _context.RiskAcceptanceRequests
                    .Include(r => r.LinkedFinding)
                    .Include(r => r.LinkedRisk)
                    .Include(r => r.AssignedToUser)
                    .Include(r => r.AssignedByUser)
                    .Where(r => r.Status == RequestStatus.PendingApproval)
                    .OrderBy(r => r.RequestDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<RiskAcceptanceRequest>();
            }
        }

        // Method to get open findings for Risk Acceptance Request dropdown
        public async Task<IEnumerable<Finding>> GetOpenFindingsAsync()
        {
            try
            {
                return await _context.Findings
                    .Where(f => f.Status == FindingStatus.Open)
                    .OrderBy(f => f.FindingNumber)
                    .ToListAsync();
            }
            catch
            {
                return new List<Finding>();
            }
        }

        public async Task<IEnumerable<Risk>> GetOpenRisksAsync()
        {
            try
            {
                return await _context.Risks
                    .Where(r => r.Status == RiskStatus.Open)
                    .OrderBy(r => r.RiskNumber)
                    .ToListAsync();
            }
            catch
            {
                return new List<Risk>();
            }
        }

        // Assignment methods for Risk Acceptance Requests
        public async Task<IEnumerable<RiskAcceptanceRequest>> GetUnassignedAcceptanceRequestsAsync()
        {
            try
            {
                return await _context.RiskAcceptanceRequests
                    .Include(r => r.LinkedFinding)
                    .Include(r => r.LinkedRisk)
                    .Where(r => r.AssignedToUserId == null && r.Status == RequestStatus.PendingApproval)
                    .OrderBy(r => r.RequestDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<RiskAcceptanceRequest>();
            }
        }

        public async Task<RiskAcceptanceRequest> AssignAcceptanceRequestAsync(int requestId, string assignedToUserId, string assignedByUserId, string? notes = null)
        {
            var request = await _context.RiskAcceptanceRequests.FindAsync(requestId);
            if (request == null) throw new ArgumentException("Request not found");

            request.AssignedToUserId = assignedToUserId;
            request.AssignedByUserId = assignedByUserId;
            request.AssignmentDate = DateTime.UtcNow;
            request.AssignmentNotes = notes ?? "";
            request.Status = RequestStatus.InProgress;
            request.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return request;
        }

        public async Task<RiskAcceptanceRequest> StartAcceptanceRequestAsync(int requestId, string userId)
        {
            var request = await _context.RiskAcceptanceRequests.FindAsync(requestId);
            if (request == null) throw new ArgumentException("Request not found");
            if (request.AssignedToUserId != userId) throw new UnauthorizedAccessException("Request not assigned to this user");

            request.StartedDate = DateTime.UtcNow;
            request.Status = RequestStatus.InProgress;
            request.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return request;
        }

        public async Task<RiskAcceptanceRequest> CompleteAcceptanceRequestAsync(int requestId, string userId)
        {
            var request = await _context.RiskAcceptanceRequests.FindAsync(requestId);
            if (request == null) throw new ArgumentException("Request not found");
            if (request.AssignedToUserId != userId) throw new UnauthorizedAccessException("Request not assigned to this user");

            request.CompletedDate = DateTime.UtcNow;
            request.Status = RequestStatus.Completed;
            request.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return request;
        }

        // Finding Closure Request methods
        public async Task<IEnumerable<FindingClosureRequest>> GetAllClosureRequestsAsync()
        {
            try
            {
                return await _context.FindingClosureRequests
                    .Include(r => r.LinkedFinding)
                    .Include(r => r.AssignedToUser)
                    .Include(r => r.AssignedByUser)
                    .OrderByDescending(r => r.RequestDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<FindingClosureRequest>();
            }
        }

        public async Task<FindingClosureRequest?> GetClosureRequestByIdAsync(int id)
        {
            try
            {
                return await _context.FindingClosureRequests
                    .Include(r => r.LinkedFinding)
                    .Include(r => r.AssignedToUser)
                    .Include(r => r.AssignedByUser)
                    .FirstOrDefaultAsync(r => r.Id == id);
            }
            catch
            {
                return null;
            }
        }

        public async Task<FindingClosureRequest> CreateClosureRequestAsync(FindingClosureRequest request)
        {
            request.CreatedAt = DateTime.UtcNow;
            request.UpdatedAt = DateTime.UtcNow;
            
            _context.FindingClosureRequests.Add(request);
            await _context.SaveChangesAsync();
            return request;
        }

        public async Task<FindingClosureRequest> UpdateClosureRequestAsync(FindingClosureRequest request)
        {
            request.UpdatedAt = DateTime.UtcNow;
            _context.FindingClosureRequests.Update(request);
            await _context.SaveChangesAsync();
            return request;
        }

        public async Task<bool> DeleteClosureRequestAsync(int id)
        {
            try
            {
                var request = await _context.FindingClosureRequests.FindAsync(id);
                if (request == null) return false;

                _context.FindingClosureRequests.Remove(request);
                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<IEnumerable<FindingClosureRequest>> GetPendingClosureRequestsAsync()
        {
            try
            {
                return await _context.FindingClosureRequests
                    .Include(r => r.LinkedFinding)
                    .Include(r => r.AssignedToUser)
                    .Where(r => r.Status == RequestStatus.PendingApproval || r.Status == RequestStatus.InProgress)
                    .OrderBy(r => r.RequestDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<FindingClosureRequest>();
            }
        }

        public async Task<IEnumerable<FindingClosureRequest>> GetUnassignedClosureRequestsAsync()
        {
            try
            {
                return await _context.FindingClosureRequests
                    .Include(r => r.LinkedFinding)
                    .Where(r => r.AssignedToUserId == null && r.Status == RequestStatus.PendingApproval)
                    .OrderBy(r => r.RequestDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<FindingClosureRequest>();
            }
        }

        public async Task<FindingClosureRequest> AssignClosureRequestAsync(int requestId, string assignedToUserId, string assignedByUserId, string? notes = null)
        {
            var request = await _context.FindingClosureRequests.FindAsync(requestId);
            if (request == null) throw new ArgumentException("Request not found");

            request.AssignedToUserId = assignedToUserId;
            request.AssignedByUserId = assignedByUserId;
            request.AssignmentDate = DateTime.UtcNow;
            request.AssignmentNotes = notes ?? "";
            request.Status = RequestStatus.InProgress;
            request.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return request;
        }

        public async Task<FindingClosureRequest> StartClosureRequestAsync(int requestId, string userId)
        {
            var request = await _context.FindingClosureRequests.FindAsync(requestId);
            if (request == null) throw new ArgumentException("Request not found");
            if (request.AssignedToUserId != userId) throw new UnauthorizedAccessException("Request not assigned to this user");

            request.StartedDate = DateTime.UtcNow;
            request.Status = RequestStatus.InProgress;
            request.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return request;
        }

        public async Task<FindingClosureRequest> CompleteClosureRequestAsync(int requestId, string userId)
        {
            var request = await _context.FindingClosureRequests.FindAsync(requestId);
            if (request == null) throw new ArgumentException("Request not found");
            if (request.AssignedToUserId != userId) throw new UnauthorizedAccessException("Request not assigned to this user");

            request.CompletedDate = DateTime.UtcNow;
            request.Status = RequestStatus.Completed;
            request.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return request;
        }
    }
}