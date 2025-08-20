using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class SlaTrackingServiceSimple : ISlaTrackingService
    {
        private readonly CyberRiskContext _context;
        private readonly IRiskMatrixService _riskMatrixService;
        private readonly ILogger<SlaTrackingServiceSimple> _logger;

        public SlaTrackingServiceSimple(CyberRiskContext context, IRiskMatrixService riskMatrixService, ILogger<SlaTrackingServiceSimple> logger)
        {
            _context = context;
            _riskMatrixService = riskMatrixService;
            _logger = logger;
        }

        public async Task<SlaStatus> GetRemediationSlaStatusAsync(int findingId)
        {
            var finding = await _context.Findings.FirstOrDefaultAsync(f => f.Id == findingId);
            if (finding == null) return new SlaStatus();

            var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            if (defaultMatrix == null) return new SlaStatus();

            var slaDeadline = defaultMatrix.CalculateSlaDeadline(finding.CreatedAt, SlaType.Remediation, finding.RiskLevel);
            var isCompleted = finding.Status == FindingStatus.Closed;
            var now = DateTime.UtcNow;

            return new SlaStatus
            {
                ItemId = findingId,
                SlaType = SlaType.Remediation,
                ItemDescription = finding.Title,
                CreatedDate = finding.CreatedAt,
                SlaDeadline = slaDeadline,
                CompletedDate = isCompleted ? finding.UpdatedAt : null,
                SlaHours = defaultMatrix.GetRemediationSlaHoursForRiskLevel(finding.RiskLevel),
                IsCompleted = isCompleted,
                IsBreached = !isCompleted && now > slaDeadline,
                TimeRemaining = !isCompleted && now <= slaDeadline ? slaDeadline - now : null,
                OverdueBy = !isCompleted && now > slaDeadline ? now - slaDeadline : null,
                RiskLevel = finding.RiskLevel,
                Status = GetSlaStatusText(isCompleted, now, slaDeadline),
                StatusColor = GetSlaStatusColor(isCompleted, now, slaDeadline)
            };
        }

        public async Task<SlaStatus> GetReviewSlaStatusAsync(int riskId)
        {
            var risk = await _context.Risks.FirstOrDefaultAsync(r => r.Id == riskId);
            if (risk == null || risk.Status != RiskStatus.Accepted)
                return new SlaStatus();

            var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            if (defaultMatrix == null) return new SlaStatus();

            var baseDate = risk.CreatedAt;
            var slaDeadline = defaultMatrix.CalculateSlaDeadline(baseDate, SlaType.Review, risk.RiskLevel);
            var now = DateTime.UtcNow;
            var isOverdue = now > slaDeadline;

            return new SlaStatus
            {
                ItemId = riskId,
                SlaType = SlaType.Review,
                ItemDescription = risk.Title,
                CreatedDate = baseDate,
                SlaDeadline = slaDeadline,
                CompletedDate = null, // Would need review tracking implementation
                SlaHours = defaultMatrix.GetReviewSlaHoursForRiskLevel(risk.RiskLevel),
                IsCompleted = !isOverdue,
                IsBreached = isOverdue,
                TimeRemaining = !isOverdue ? slaDeadline - now : null,
                OverdueBy = isOverdue ? now - slaDeadline : null,
                RiskLevel = risk.RiskLevel,
                Status = GetSlaStatusText(!isOverdue, now, slaDeadline),
                StatusColor = GetSlaStatusColor(!isOverdue, now, slaDeadline)
            };
        }

        public async Task<SlaStatus> GetAssessmentSlaStatusAsync(int assessmentId, SlaAssessmentType assessmentType)
        {
            var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            if (defaultMatrix == null) return new SlaStatus();

            var now = DateTime.UtcNow;

            switch (assessmentType)
            {
                case SlaAssessmentType.Risk:
                    var riskAssessment = await _context.RiskAssessments.FirstOrDefaultAsync(ra => ra.Id == assessmentId);
                    if (riskAssessment == null) return new SlaStatus();

                    var riskSlaDeadline = riskAssessment.SlaDeadline ?? 
                                         defaultMatrix.CalculateSlaDeadline(riskAssessment.CreatedAt, SlaType.Assessment, RiskLevel.Medium);
                    var riskIsCompleted = riskAssessment.Status == AssessmentStatus.Completed || riskAssessment.Status == AssessmentStatus.Approved;

                    return new SlaStatus
                    {
                        ItemId = assessmentId,
                        SlaType = SlaType.Assessment,
                        ItemDescription = riskAssessment.Title,
                        CreatedDate = riskAssessment.CreatedAt,
                        SlaDeadline = riskSlaDeadline,
                        CompletedDate = riskIsCompleted ? riskAssessment.UpdatedAt : null,
                        SlaHours = defaultMatrix.RiskAssessmentSlaHours,
                        IsCompleted = riskIsCompleted,
                        IsBreached = !riskIsCompleted && now > riskSlaDeadline,
                        TimeRemaining = !riskIsCompleted && now <= riskSlaDeadline ? riskSlaDeadline - now : null,
                        OverdueBy = !riskIsCompleted && now > riskSlaDeadline ? now - riskSlaDeadline : null,
                        RiskLevel = RiskLevel.Medium, // Default for assessments
                        Status = GetSlaStatusText(riskIsCompleted, now, riskSlaDeadline),
                        StatusColor = GetSlaStatusColor(riskIsCompleted, now, riskSlaDeadline)
                    };

                case SlaAssessmentType.Compliance:
                    var complianceAssessment = await _context.ComplianceAssessments.FirstOrDefaultAsync(ca => ca.Id == assessmentId);
                    if (complianceAssessment == null) return new SlaStatus();

                    var complianceSlaDeadline = complianceAssessment.SlaDeadline ?? 
                                               defaultMatrix.CalculateSlaDeadline(complianceAssessment.CreatedAt, SlaType.Assessment, RiskLevel.Medium);
                    var complianceIsCompleted = complianceAssessment.Status == AssessmentStatus.Completed || complianceAssessment.Status == AssessmentStatus.Approved;

                    return new SlaStatus
                    {
                        ItemId = assessmentId,
                        SlaType = SlaType.Assessment,
                        ItemDescription = complianceAssessment.Title,
                        CreatedDate = complianceAssessment.CreatedAt,
                        SlaDeadline = complianceSlaDeadline,
                        CompletedDate = complianceIsCompleted ? complianceAssessment.UpdatedAt : null,
                        SlaHours = defaultMatrix.RiskAssessmentSlaHours,
                        IsCompleted = complianceIsCompleted,
                        IsBreached = !complianceIsCompleted && now > complianceSlaDeadline,
                        TimeRemaining = !complianceIsCompleted && now <= complianceSlaDeadline ? complianceSlaDeadline - now : null,
                        OverdueBy = !complianceIsCompleted && now > complianceSlaDeadline ? now - complianceSlaDeadline : null,
                        RiskLevel = RiskLevel.Medium, // Default for assessments
                        Status = GetSlaStatusText(complianceIsCompleted, now, complianceSlaDeadline),
                        StatusColor = GetSlaStatusColor(complianceIsCompleted, now, complianceSlaDeadline)
                    };

                case SlaAssessmentType.Maturity:
                    var maturityAssessment = await _context.MaturityAssessments.FirstOrDefaultAsync(ma => ma.Id == assessmentId);
                    if (maturityAssessment == null) return new SlaStatus();

                    var maturitySlaDeadline = maturityAssessment.SlaDeadline ?? 
                                             defaultMatrix.CalculateSlaDeadline(maturityAssessment.CreatedAt, SlaType.Assessment, RiskLevel.Medium);
                    var maturityIsCompleted = maturityAssessment.Status == AssessmentStatus.Completed || maturityAssessment.Status == AssessmentStatus.Approved;

                    return new SlaStatus
                    {
                        ItemId = assessmentId,
                        SlaType = SlaType.Assessment,
                        ItemDescription = maturityAssessment.Title,
                        CreatedDate = maturityAssessment.CreatedAt,
                        SlaDeadline = maturitySlaDeadline,
                        CompletedDate = maturityIsCompleted ? maturityAssessment.UpdatedAt : null,
                        SlaHours = defaultMatrix.RiskAssessmentSlaHours,
                        IsCompleted = maturityIsCompleted,
                        IsBreached = !maturityIsCompleted && now > maturitySlaDeadline,
                        TimeRemaining = !maturityIsCompleted && now <= maturitySlaDeadline ? maturitySlaDeadline - now : null,
                        OverdueBy = !maturityIsCompleted && now > maturitySlaDeadline ? now - maturitySlaDeadline : null,
                        RiskLevel = RiskLevel.Medium, // Default for assessments
                        Status = GetSlaStatusText(maturityIsCompleted, now, maturitySlaDeadline),
                        StatusColor = GetSlaStatusColor(maturityIsCompleted, now, maturitySlaDeadline)
                    };

                default:
                    return new SlaStatus();
            }
        }

        public async Task<SlaStatus> GetApprovalSlaStatusAsync(int requestId, SlaApprovalType approvalType)
        {
            var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            if (defaultMatrix == null) return new SlaStatus();

            var now = DateTime.UtcNow;

            switch (approvalType)
            {
                case SlaApprovalType.AssessmentApproval:
                    var assessmentRequest = await _context.AssessmentRequests.FirstOrDefaultAsync(ar => ar.Id == requestId);
                    if (assessmentRequest == null) return new SlaStatus();

                    var assessmentSlaDeadline = defaultMatrix.CalculateSlaDeadline(assessmentRequest.RequestDate, SlaType.Approval, RiskLevel.Medium);
                    var assessmentIsCompleted = assessmentRequest.Status == RequestStatus.Approved || assessmentRequest.Status == RequestStatus.Rejected || assessmentRequest.Status == RequestStatus.Completed;

                    return new SlaStatus
                    {
                        ItemId = requestId,
                        SlaType = SlaType.Approval,
                        ItemDescription = $"Assessment Request - {assessmentRequest.Scope}",
                        CreatedDate = assessmentRequest.RequestDate,
                        SlaDeadline = assessmentSlaDeadline,
                        CompletedDate = assessmentIsCompleted ? (assessmentRequest.CompletedDate ?? assessmentRequest.CreatedAt) : null,
                        SlaHours = defaultMatrix.AssessmentApprovalSlaHours,
                        IsCompleted = assessmentIsCompleted,
                        IsBreached = !assessmentIsCompleted && now > assessmentSlaDeadline,
                        TimeRemaining = !assessmentIsCompleted && now <= assessmentSlaDeadline ? assessmentSlaDeadline - now : null,
                        OverdueBy = !assessmentIsCompleted && now > assessmentSlaDeadline ? now - assessmentSlaDeadline : null,
                        RiskLevel = RiskLevel.Medium, // Default for approval processes
                        Status = GetSlaStatusText(assessmentIsCompleted, now, assessmentSlaDeadline),
                        StatusColor = GetSlaStatusColor(assessmentIsCompleted, now, assessmentSlaDeadline)
                    };

                case SlaApprovalType.RiskAcceptanceApproval:
                    var riskAcceptanceRequest = await _context.RiskAcceptanceRequests.FirstOrDefaultAsync(rar => rar.Id == requestId);
                    if (riskAcceptanceRequest == null) return new SlaStatus();

                    var riskAcceptanceSlaDeadline = defaultMatrix.CalculateSlaDeadline(riskAcceptanceRequest.RequestDate, SlaType.Approval, RiskLevel.High); // Higher priority for risk acceptance
                    var riskAcceptanceIsCompleted = riskAcceptanceRequest.ReviewDate.HasValue;

                    return new SlaStatus
                    {
                        ItemId = requestId,
                        SlaType = SlaType.Approval,
                        ItemDescription = $"Risk Acceptance - {riskAcceptanceRequest.Description}",
                        CreatedDate = riskAcceptanceRequest.RequestDate,
                        SlaDeadline = riskAcceptanceSlaDeadline,
                        CompletedDate = riskAcceptanceRequest.ReviewDate,
                        SlaHours = defaultMatrix.RiskAcceptanceApprovalSlaHours,
                        IsCompleted = riskAcceptanceIsCompleted,
                        IsBreached = !riskAcceptanceIsCompleted && now > riskAcceptanceSlaDeadline,
                        TimeRemaining = !riskAcceptanceIsCompleted && now <= riskAcceptanceSlaDeadline ? riskAcceptanceSlaDeadline - now : null,
                        OverdueBy = !riskAcceptanceIsCompleted && now > riskAcceptanceSlaDeadline ? now - riskAcceptanceSlaDeadline : null,
                        RiskLevel = RiskLevel.High, // Risk acceptance is high priority
                        Status = GetSlaStatusText(riskAcceptanceIsCompleted, now, riskAcceptanceSlaDeadline),
                        StatusColor = GetSlaStatusColor(riskAcceptanceIsCompleted, now, riskAcceptanceSlaDeadline)
                    };

                case SlaApprovalType.FindingClosureApproval:
                    var findingClosureRequest = await _context.FindingClosureRequests.FirstOrDefaultAsync(fcr => fcr.Id == requestId);
                    if (findingClosureRequest == null) return new SlaStatus();

                    var findingClosureSlaDeadline = defaultMatrix.CalculateSlaDeadline(findingClosureRequest.RequestDate, SlaType.Approval, RiskLevel.Medium);
                    var findingClosureIsCompleted = findingClosureRequest.ReviewDate.HasValue;

                    return new SlaStatus
                    {
                        ItemId = requestId,
                        SlaType = SlaType.Approval,
                        ItemDescription = $"Finding Closure Request #{findingClosureRequest.Id}",
                        CreatedDate = findingClosureRequest.RequestDate,
                        SlaDeadline = findingClosureSlaDeadline,
                        CompletedDate = findingClosureRequest.ReviewDate,
                        SlaHours = defaultMatrix.ExceptionRequestApprovalSlaHours, // Using ExceptionRequestApprovalSlaHours as default for finding closures
                        IsCompleted = findingClosureIsCompleted,
                        IsBreached = !findingClosureIsCompleted && now > findingClosureSlaDeadline,
                        TimeRemaining = !findingClosureIsCompleted && now <= findingClosureSlaDeadline ? findingClosureSlaDeadline - now : null,
                        OverdueBy = !findingClosureIsCompleted && now > findingClosureSlaDeadline ? now - findingClosureSlaDeadline : null,
                        RiskLevel = RiskLevel.Medium,
                        Status = GetSlaStatusText(findingClosureIsCompleted, now, findingClosureSlaDeadline),
                        StatusColor = GetSlaStatusColor(findingClosureIsCompleted, now, findingClosureSlaDeadline)
                    };

                default:
                    return new SlaStatus();
            }
        }

        public async Task<IEnumerable<SlaBreachInfo>> GetRemediationSlaBreachesAsync()
        {
            var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            if (defaultMatrix == null) return new List<SlaBreachInfo>();

            var now = DateTime.UtcNow;
            var openFindings = await _context.Findings
                .Where(f => f.Status != FindingStatus.Closed)
                .ToListAsync();

            var breaches = new List<SlaBreachInfo>();

            foreach (var finding in openFindings)
            {
                var slaDeadline = defaultMatrix.CalculateSlaDeadline(finding.CreatedAt, SlaType.Remediation, finding.RiskLevel);
                if (now > slaDeadline)
                {
                    breaches.Add(new SlaBreachInfo
                    {
                        ItemId = finding.Id,
                        SlaType = SlaType.Remediation,
                        ItemType = "Finding",
                        ItemDescription = finding.Title,
                        CreatedDate = finding.CreatedAt,
                        SlaDeadline = slaDeadline,
                        OverdueBy = now - slaDeadline,
                        RiskLevel = finding.RiskLevel,
                        AssignedTo = finding.AssignedTo ?? "Unassigned",
                        AssignedToEmail = ""
                    });
                }
            }

            return breaches.OrderByDescending(b => b.OverdueBy);
        }

        public async Task<IEnumerable<SlaBreachInfo>> GetReviewSlaBreachesAsync()
        {
            var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            if (defaultMatrix == null) return new List<SlaBreachInfo>();

            var now = DateTime.UtcNow;
            var acceptedRisks = await _context.Risks
                .Where(r => r.Status == RiskStatus.Accepted)
                .ToListAsync();

            var breaches = new List<SlaBreachInfo>();

            foreach (var risk in acceptedRisks)
            {
                var baseDate = risk.CreatedAt;
                var slaDeadline = defaultMatrix.CalculateSlaDeadline(baseDate, SlaType.Review, risk.RiskLevel);
                
                if (now > slaDeadline)
                {
                    breaches.Add(new SlaBreachInfo
                    {
                        ItemId = risk.Id,
                        SlaType = SlaType.Review,
                        ItemType = "Risk Review",
                        ItemDescription = risk.Title,
                        CreatedDate = baseDate,
                        SlaDeadline = slaDeadline,
                        OverdueBy = now - slaDeadline,
                        RiskLevel = risk.RiskLevel,
                        AssignedTo = risk.Owner ?? "Unassigned",
                        AssignedToEmail = ""
                    });
                }
            }

            return breaches.OrderByDescending(b => b.OverdueBy);
        }

        public async Task<IEnumerable<SlaBreachInfo>> GetAssessmentSlaBreachesAsync()
        {
            var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            if (defaultMatrix == null) return new List<SlaBreachInfo>();

            var now = DateTime.UtcNow;
            var breaches = new List<SlaBreachInfo>();

            // Check RiskAssessments
            var activeRiskAssessments = await _context.RiskAssessments
                .Where(ra => ra.Status != AssessmentStatus.Completed && ra.Status != AssessmentStatus.Approved)
                .ToListAsync();

            foreach (var assessment in activeRiskAssessments)
            {
                var slaDeadline = assessment.SlaDeadline ?? 
                                 defaultMatrix.CalculateSlaDeadline(assessment.CreatedAt, SlaType.Assessment, RiskLevel.Medium);
                if (now > slaDeadline)
                {
                    breaches.Add(new SlaBreachInfo
                    {
                        ItemId = assessment.Id,
                        SlaType = SlaType.Assessment,
                        ItemType = "Risk Assessment",
                        ItemDescription = assessment.Title,
                        CreatedDate = assessment.CreatedAt,
                        SlaDeadline = slaDeadline,
                        OverdueBy = now - slaDeadline,
                        RiskLevel = RiskLevel.Medium,
                        AssignedTo = assessment.Assessor ?? "Unassigned",
                        AssignedToEmail = ""
                    });
                }
            }

            // Check ComplianceAssessments
            var activeComplianceAssessments = await _context.ComplianceAssessments
                .Where(ca => ca.Status != AssessmentStatus.Completed && ca.Status != AssessmentStatus.Approved)
                .ToListAsync();

            foreach (var assessment in activeComplianceAssessments)
            {
                var slaDeadline = assessment.SlaDeadline ?? 
                                 defaultMatrix.CalculateSlaDeadline(assessment.CreatedAt, SlaType.Assessment, RiskLevel.Medium);
                if (now > slaDeadline)
                {
                    breaches.Add(new SlaBreachInfo
                    {
                        ItemId = assessment.Id,
                        SlaType = SlaType.Assessment,
                        ItemType = "Compliance Assessment",
                        ItemDescription = assessment.Title,
                        CreatedDate = assessment.CreatedAt,
                        SlaDeadline = slaDeadline,
                        OverdueBy = now - slaDeadline,
                        RiskLevel = RiskLevel.Medium,
                        AssignedTo = assessment.Assessor ?? "Unassigned",
                        AssignedToEmail = ""
                    });
                }
            }

            // Check MaturityAssessments
            var activeMaturityAssessments = await _context.MaturityAssessments
                .Where(ma => ma.Status != AssessmentStatus.Completed && ma.Status != AssessmentStatus.Approved)
                .ToListAsync();

            foreach (var assessment in activeMaturityAssessments)
            {
                var slaDeadline = assessment.SlaDeadline ?? 
                                 defaultMatrix.CalculateSlaDeadline(assessment.CreatedAt, SlaType.Assessment, RiskLevel.Medium);
                if (now > slaDeadline)
                {
                    breaches.Add(new SlaBreachInfo
                    {
                        ItemId = assessment.Id,
                        SlaType = SlaType.Assessment,
                        ItemType = "Maturity Assessment",
                        ItemDescription = assessment.Title,
                        CreatedDate = assessment.CreatedAt,
                        SlaDeadline = slaDeadline,
                        OverdueBy = now - slaDeadline,
                        RiskLevel = RiskLevel.Medium,
                        AssignedTo = assessment.Assessor ?? "Unassigned",
                        AssignedToEmail = ""
                    });
                }
            }

            return breaches.OrderByDescending(b => b.OverdueBy);
        }

        public async Task<IEnumerable<SlaBreachInfo>> GetApprovalSlaBreachesAsync()
        {
            var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            if (defaultMatrix == null) return new List<SlaBreachInfo>();

            var now = DateTime.UtcNow;
            var breaches = new List<SlaBreachInfo>();

            // Check Assessment Request approvals
            var pendingAssessmentRequests = await _context.AssessmentRequests
                .Where(ar => ar.Status != RequestStatus.Approved && 
                            ar.Status != RequestStatus.Rejected && 
                            ar.Status != RequestStatus.Completed)
                .ToListAsync();

            foreach (var request in pendingAssessmentRequests)
            {
                var slaDeadline = defaultMatrix.CalculateSlaDeadline(request.RequestDate, SlaType.Approval, RiskLevel.Medium);
                if (now > slaDeadline)
                {
                    breaches.Add(new SlaBreachInfo
                    {
                        ItemId = request.Id,
                        SlaType = SlaType.Approval,
                        ItemType = "Assessment Approval",
                        ItemDescription = $"Assessment Request - {request.Scope}",
                        CreatedDate = request.RequestDate,
                        SlaDeadline = slaDeadline,
                        OverdueBy = now - slaDeadline,
                        RiskLevel = RiskLevel.Medium,
                        AssignedTo = request.AssignedToUser?.UserName ?? "Unassigned",
                        AssignedToEmail = request.AssignedToUser?.Email ?? ""
                    });
                }
            }

            // Check Risk Acceptance Request approvals
            var pendingRiskAcceptanceRequests = await _context.RiskAcceptanceRequests
                .Where(rar => !rar.ReviewDate.HasValue)
                .ToListAsync();

            foreach (var request in pendingRiskAcceptanceRequests)
            {
                var slaDeadline = defaultMatrix.CalculateSlaDeadline(request.RequestDate, SlaType.Approval, RiskLevel.High);
                if (now > slaDeadline)
                {
                    breaches.Add(new SlaBreachInfo
                    {
                        ItemId = request.Id,
                        SlaType = SlaType.Approval,
                        ItemType = "Risk Acceptance Approval",
                        ItemDescription = $"Risk Acceptance - {request.Description}",
                        CreatedDate = request.RequestDate,
                        SlaDeadline = slaDeadline,
                        OverdueBy = now - slaDeadline,
                        RiskLevel = RiskLevel.High,
                        AssignedTo = request.AssignedToUser?.UserName ?? "Unassigned",
                        AssignedToEmail = request.AssignedToUser?.Email ?? ""
                    });
                }
            }

            // Check Finding Closure Request approvals (if the model exists)
            var pendingFindingClosureRequests = await _context.FindingClosureRequests
                .Where(fcr => !fcr.ReviewDate.HasValue)
                .ToListAsync();

            foreach (var request in pendingFindingClosureRequests)
            {
                var slaDeadline = defaultMatrix.CalculateSlaDeadline(request.RequestDate, SlaType.Approval, RiskLevel.Medium);
                if (now > slaDeadline)
                {
                    breaches.Add(new SlaBreachInfo
                    {
                        ItemId = request.Id,
                        SlaType = SlaType.Approval,
                        ItemType = "Finding Closure Approval",
                        ItemDescription = $"Finding Closure Request #{request.Id}",
                        CreatedDate = request.RequestDate,
                        SlaDeadline = slaDeadline,
                        OverdueBy = now - slaDeadline,
                        RiskLevel = RiskLevel.Medium,
                        AssignedTo = request.AssignedToUser?.UserName ?? "Unassigned",
                        AssignedToEmail = request.AssignedToUser?.Email ?? ""
                    });
                }
            }

            return breaches.OrderByDescending(b => b.OverdueBy);
        }

        public async Task<SlaDashboardData> GetSlaDashboardDataAsync()
        {
            var remediationBreaches = await GetRemediationSlaBreachesAsync();
            var reviewBreaches = await GetReviewSlaBreachesAsync();
            var assessmentBreaches = await GetAssessmentSlaBreachesAsync();
            var approvalBreaches = await GetApprovalSlaBreachesAsync();

            var totalRemediationItems = await _context.Findings.CountAsync(f => f.Status != FindingStatus.Closed);
            var totalReviewItems = await _context.Risks.CountAsync(r => r.Status == RiskStatus.Accepted);
            
            // Calculate total assessment items across all assessment types
            var totalRiskAssessmentItems = await _context.RiskAssessments.CountAsync(ra => ra.Status != AssessmentStatus.Completed && ra.Status != AssessmentStatus.Approved);
            var totalComplianceAssessmentItems = await _context.ComplianceAssessments.CountAsync(ca => ca.Status != AssessmentStatus.Completed && ca.Status != AssessmentStatus.Approved);
            var totalMaturityAssessmentItems = await _context.MaturityAssessments.CountAsync(ma => ma.Status != AssessmentStatus.Completed && ma.Status != AssessmentStatus.Approved);
            var totalAssessmentItems = totalRiskAssessmentItems + totalComplianceAssessmentItems + totalMaturityAssessmentItems;
            
            // Calculate total approval items
            var totalAssessmentRequestItems = await _context.AssessmentRequests.CountAsync(ar => ar.Status != RequestStatus.Approved && ar.Status != RequestStatus.Rejected && ar.Status != RequestStatus.Completed);
            var totalRiskAcceptanceRequestItems = await _context.RiskAcceptanceRequests.CountAsync(rar => !rar.ReviewDate.HasValue);
            var totalFindingClosureRequestItems = await _context.FindingClosureRequests.CountAsync(fcr => !fcr.ReviewDate.HasValue);
            var totalApprovalItems = totalAssessmentRequestItems + totalRiskAcceptanceRequestItems + totalFindingClosureRequestItems;

            var totalActiveItems = totalRemediationItems + totalReviewItems + totalAssessmentItems + totalApprovalItems;
            var totalBreaches = remediationBreaches.Count() + reviewBreaches.Count() + assessmentBreaches.Count() + approvalBreaches.Count();

            var overallCompliance = totalActiveItems > 0 ? ((decimal)(totalActiveItems - totalBreaches) / totalActiveItems * 100) : 100;

            return new SlaDashboardData
            {
                TotalRemediationBreaches = remediationBreaches.Count(),
                TotalReviewBreaches = reviewBreaches.Count(),
                TotalAssessmentBreaches = assessmentBreaches.Count(),
                TotalApprovalBreaches = approvalBreaches.Count(),
                TotalActiveItems = totalActiveItems,
                OverallCompliancePercentage = Math.Round(overallCompliance, 1),
                BreachSummaryByType = new List<SlaBreachByCategory>
                {
                    new() { Category = "Remediation", BreachCount = remediationBreaches.Count(), TotalCount = totalRemediationItems, CompliancePercentage = CalculateCompliancePercentage(totalRemediationItems, remediationBreaches.Count()) },
                    new() { Category = "Review", BreachCount = reviewBreaches.Count(), TotalCount = totalReviewItems, CompliancePercentage = CalculateCompliancePercentage(totalReviewItems, reviewBreaches.Count()) },
                    new() { Category = "Assessment", BreachCount = assessmentBreaches.Count(), TotalCount = totalAssessmentItems, CompliancePercentage = CalculateCompliancePercentage(totalAssessmentItems, assessmentBreaches.Count()) },
                    new() { Category = "Approval", BreachCount = approvalBreaches.Count(), TotalCount = totalApprovalItems, CompliancePercentage = CalculateCompliancePercentage(totalApprovalItems, approvalBreaches.Count()) }
                },
                BreachSummaryByRiskLevel = new List<SlaBreachByCategory>()
            };
        }

        public async Task<IEnumerable<SlaUpcomingDeadline>> GetUpcomingSlaDeadlinesAsync(int dayLookAhead = 7)
        {
            var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            if (defaultMatrix == null) return new List<SlaUpcomingDeadline>();

            var now = DateTime.UtcNow;
            var lookAheadDate = now.AddDays(dayLookAhead);
            var upcomingDeadlines = new List<SlaUpcomingDeadline>();

            // Remediation Deadlines
            var openFindings = await _context.Findings
                .Where(f => f.Status != FindingStatus.Closed)
                .ToListAsync();

            foreach (var finding in openFindings)
            {
                var slaDeadline = defaultMatrix.CalculateSlaDeadline(finding.CreatedAt, SlaType.Remediation, finding.RiskLevel);
                if (slaDeadline > now && slaDeadline <= lookAheadDate)
                {
                    upcomingDeadlines.Add(new SlaUpcomingDeadline
                    {
                        ItemId = finding.Id,
                        SlaType = SlaType.Remediation,
                        ItemType = "Finding",
                        ItemDescription = finding.Title,
                        SlaDeadline = slaDeadline,
                        TimeUntilDeadline = slaDeadline - now,
                        RiskLevel = finding.RiskLevel,
                        AssignedTo = finding.AssignedTo ?? "Unassigned",
                        AssignedToEmail = ""
                    });
                }
            }

            // Assessment Deadlines - Risk Assessments
            var activeRiskAssessments = await _context.RiskAssessments
                .Where(ra => ra.Status != AssessmentStatus.Completed && ra.Status != AssessmentStatus.Approved)
                .ToListAsync();

            foreach (var assessment in activeRiskAssessments)
            {
                var slaDeadline = assessment.SlaDeadline ?? 
                                 defaultMatrix.CalculateSlaDeadline(assessment.CreatedAt, SlaType.Assessment, RiskLevel.Medium);
                if (slaDeadline > now && slaDeadline <= lookAheadDate)
                {
                    upcomingDeadlines.Add(new SlaUpcomingDeadline
                    {
                        ItemId = assessment.Id,
                        SlaType = SlaType.Assessment,
                        ItemType = "Risk Assessment",
                        ItemDescription = assessment.Title,
                        SlaDeadline = slaDeadline,
                        TimeUntilDeadline = slaDeadline - now,
                        RiskLevel = RiskLevel.Medium,
                        AssignedTo = assessment.Assessor ?? "Unassigned",
                        AssignedToEmail = ""
                    });
                }
            }

            // Assessment Deadlines - Compliance Assessments
            var activeComplianceAssessments = await _context.ComplianceAssessments
                .Where(ca => ca.Status != AssessmentStatus.Completed && ca.Status != AssessmentStatus.Approved)
                .ToListAsync();

            foreach (var assessment in activeComplianceAssessments)
            {
                var slaDeadline = assessment.SlaDeadline ?? 
                                 defaultMatrix.CalculateSlaDeadline(assessment.CreatedAt, SlaType.Assessment, RiskLevel.Medium);
                if (slaDeadline > now && slaDeadline <= lookAheadDate)
                {
                    upcomingDeadlines.Add(new SlaUpcomingDeadline
                    {
                        ItemId = assessment.Id,
                        SlaType = SlaType.Assessment,
                        ItemType = "Compliance Assessment",
                        ItemDescription = assessment.Title,
                        SlaDeadline = slaDeadline,
                        TimeUntilDeadline = slaDeadline - now,
                        RiskLevel = RiskLevel.Medium,
                        AssignedTo = assessment.Assessor ?? "Unassigned",
                        AssignedToEmail = ""
                    });
                }
            }

            // Assessment Deadlines - Maturity Assessments
            var activeMaturityAssessments = await _context.MaturityAssessments
                .Where(ma => ma.Status != AssessmentStatus.Completed && ma.Status != AssessmentStatus.Approved)
                .ToListAsync();

            foreach (var assessment in activeMaturityAssessments)
            {
                var slaDeadline = assessment.SlaDeadline ?? 
                                 defaultMatrix.CalculateSlaDeadline(assessment.CreatedAt, SlaType.Assessment, RiskLevel.Medium);
                if (slaDeadline > now && slaDeadline <= lookAheadDate)
                {
                    upcomingDeadlines.Add(new SlaUpcomingDeadline
                    {
                        ItemId = assessment.Id,
                        SlaType = SlaType.Assessment,
                        ItemType = "Maturity Assessment",
                        ItemDescription = assessment.Title,
                        SlaDeadline = slaDeadline,
                        TimeUntilDeadline = slaDeadline - now,
                        RiskLevel = RiskLevel.Medium,
                        AssignedTo = assessment.Assessor ?? "Unassigned",
                        AssignedToEmail = ""
                    });
                }
            }

            return upcomingDeadlines.OrderBy(d => d.SlaDeadline);
        }

        // Simplified placeholder implementations
        public async Task<SlaPerformanceMetrics> GetSlaPerformanceMetricsAsync(DateTime startDate, DateTime endDate)
        {
            return new SlaPerformanceMetrics
            {
                StartDate = startDate,
                EndDate = endDate,
                OverallComplianceRate = 85.0m,
                TotalItemsTracked = 50,
                TotalBreaches = 8,
                AverageResolutionTime = TimeSpan.FromHours(48)
            };
        }

        public async Task<IEnumerable<SlaComplianceReport>> GetSlaComplianceReportAsync(DateTime startDate, DateTime endDate)
        {
            return new List<SlaComplianceReport>();
        }

        public async Task<IEnumerable<SlaNotification>> GetPendingSlaNotificationsAsync()
        {
            return new List<SlaNotification>();
        }

        public async Task MarkSlaNotificationSentAsync(int notificationId)
        {
            // Placeholder
        }

        public async Task CreateSlaNotificationAsync(SlaNotification notification)
        {
            // Placeholder
        }

        // Helper methods
        private string GetSlaStatusText(bool isCompleted, DateTime now, DateTime slaDeadline)
        {
            if (isCompleted) return "Completed";
            if (now > slaDeadline) return "Overdue";
            
            var timeRemaining = slaDeadline - now;
            if (timeRemaining.TotalHours <= 24) return "Due Soon";
            
            return "On Track";
        }

        private string GetSlaStatusColor(bool isCompleted, DateTime now, DateTime slaDeadline)
        {
            if (isCompleted) return "success";
            if (now > slaDeadline) return "danger";
            
            var timeRemaining = slaDeadline - now;
            if (timeRemaining.TotalHours <= 24) return "warning";
            
            return "primary";
        }

        private decimal CalculateCompliancePercentage(int totalItems, int breachedItems)
        {
            if (totalItems == 0) return 100;
            return Math.Round((decimal)(totalItems - breachedItems) / totalItems * 100, 1);
        }
    }
}