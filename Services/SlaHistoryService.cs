using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class SlaHistoryService : ISlaHistoryService
    {
        private readonly CyberRiskContext _context;
        private readonly IRiskMatrixService _riskMatrixService;
        private readonly ILogger<SlaHistoryService> _logger;

        public SlaHistoryService(CyberRiskContext context, IRiskMatrixService riskMatrixService, ILogger<SlaHistoryService> logger)
        {
            _context = context;
            _riskMatrixService = riskMatrixService;
            _logger = logger;
        }

        public async Task RecordSlaEventAsync(SlaHistory slaHistory)
        {
            _context.SlaHistories.Add(slaHistory);
            await _context.SaveChangesAsync();
        }

        public async Task RecordFindingCompletionAsync(int findingId, DateTime completedDate)
        {
            var finding = await _context.Findings.FirstOrDefaultAsync(f => f.Id == findingId);
            if (finding == null) return;

            var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            if (defaultMatrix == null) return;

            var slaHistory = new SlaHistory
            {
                SlaType = SlaType.Remediation,
                ItemType = "Finding",
                ItemId = findingId,
                ItemDescription = finding.Title,
                RiskLevel = finding.RiskLevel,
                AssignedTo = finding.AssignedTo ?? "Unassigned",
                SlaStartDate = finding.OpenDate,
                SlaDeadline = finding.SlaDate ?? defaultMatrix.CalculateSlaDeadline(finding.OpenDate, SlaType.Remediation, finding.RiskLevel),
                CompletedDate = completedDate,
                SlaHours = defaultMatrix.GetRemediationSlaHoursForRiskLevel(finding.RiskLevel),
                CompletionTime = completedDate - finding.OpenDate,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CreatedBy = "System",
                UpdatedBy = "System"
            };

            // Calculate SLA variance and compliance status
            var slaVariance = completedDate - slaHistory.SlaDeadline;
            slaHistory.SlaVariance = slaVariance;
            
            if (completedDate <= slaHistory.SlaDeadline)
            {
                slaHistory.ComplianceStatus = SlaComplianceStatus.Completed;
            }
            else
            {
                slaHistory.ComplianceStatus = SlaComplianceStatus.Breached;
            }

            await RecordSlaEventAsync(slaHistory);
        }

        public async Task RecordRiskReviewAsync(int riskId, DateTime reviewDate)
        {
            var risk = await _context.Risks.FirstOrDefaultAsync(r => r.Id == riskId);
            if (risk == null) return;

            var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            if (defaultMatrix == null) return;

            var slaHistory = new SlaHistory
            {
                SlaType = SlaType.Review,
                ItemType = "Risk",
                ItemId = riskId,
                ItemDescription = risk.Title,
                RiskLevel = risk.RiskLevel,
                AssignedTo = risk.Owner ?? "Unassigned",
                SlaStartDate = risk.AcceptanceDate ?? risk.OpenDate,
                SlaDeadline = risk.NextReviewDate ?? defaultMatrix.CalculateSlaDeadline(risk.AcceptanceDate ?? risk.OpenDate, SlaType.Review, risk.RiskLevel),
                CompletedDate = reviewDate,
                SlaHours = defaultMatrix.GetReviewSlaHoursForRiskLevel(risk.RiskLevel),
                CompletionTime = reviewDate - (risk.AcceptanceDate ?? risk.OpenDate),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CreatedBy = "System",
                UpdatedBy = "System"
            };

            // Calculate SLA variance and compliance status
            var slaVariance = reviewDate - slaHistory.SlaDeadline;
            slaHistory.SlaVariance = slaVariance;
            
            if (reviewDate <= slaHistory.SlaDeadline)
            {
                slaHistory.ComplianceStatus = SlaComplianceStatus.Completed;
            }
            else
            {
                slaHistory.ComplianceStatus = SlaComplianceStatus.Breached;
            }

            await RecordSlaEventAsync(slaHistory);
        }

        public async Task RecordAssessmentCompletionAsync(int assessmentId, string assessmentType, DateTime completedDate)
        {
            var defaultMatrix = await _riskMatrixService.GetDefaultMatrixAsync();
            if (defaultMatrix == null) return;

            string itemDescription = "";
            DateTime startDate = DateTime.UtcNow;
            string assignedTo = "Unassigned";

            // Get assessment details based on type
            switch (assessmentType.ToLower())
            {
                case "risk":
                case "riskassessment":
                    var riskAssessment = await _context.RiskAssessments.FirstOrDefaultAsync(ra => ra.Id == assessmentId);
                    if (riskAssessment == null) return;
                    itemDescription = riskAssessment.Title;
                    startDate = riskAssessment.CreatedAt;
                    assignedTo = riskAssessment.Assessor ?? "Unassigned";
                    break;

                case "compliance":
                case "complianceassessment":
                    var complianceAssessment = await _context.ComplianceAssessments.FirstOrDefaultAsync(ca => ca.Id == assessmentId);
                    if (complianceAssessment == null) return;
                    itemDescription = complianceAssessment.Title;
                    startDate = complianceAssessment.CreatedAt;
                    assignedTo = complianceAssessment.Assessor ?? "Unassigned";
                    break;

                case "maturity":
                case "maturityassessment":
                    var maturityAssessment = await _context.MaturityAssessments.FirstOrDefaultAsync(ma => ma.Id == assessmentId);
                    if (maturityAssessment == null) return;
                    itemDescription = maturityAssessment.Title;
                    startDate = maturityAssessment.CreatedAt;
                    assignedTo = maturityAssessment.Assessor ?? "Unassigned";
                    break;

                default:
                    _logger.LogWarning($"Unknown assessment type: {assessmentType}");
                    return;
            }

            var slaHistory = new SlaHistory
            {
                SlaType = SlaType.Assessment,
                ItemType = assessmentType,
                ItemId = assessmentId,
                ItemDescription = itemDescription,
                RiskLevel = RiskLevel.Medium, // Default for assessments
                AssignedTo = assignedTo,
                SlaStartDate = startDate,
                SlaDeadline = defaultMatrix.CalculateSlaDeadline(startDate, SlaType.Assessment, RiskLevel.Medium),
                CompletedDate = completedDate,
                SlaHours = defaultMatrix.RiskAssessmentSlaHours,
                CompletionTime = completedDate - startDate,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CreatedBy = "System",
                UpdatedBy = "System"
            };

            // Calculate SLA variance and compliance status
            var slaVariance = completedDate - slaHistory.SlaDeadline;
            slaHistory.SlaVariance = slaVariance;
            
            if (completedDate <= slaHistory.SlaDeadline)
            {
                slaHistory.ComplianceStatus = SlaComplianceStatus.Completed;
            }
            else
            {
                slaHistory.ComplianceStatus = SlaComplianceStatus.Breached;
            }

            await RecordSlaEventAsync(slaHistory);
        }

        public async Task<SlaPerformanceReport> GetSlaPerformanceReportAsync(DateTime startDate, DateTime endDate)
        {
            var histories = await _context.SlaHistories
                .Where(h => h.SlaStartDate >= startDate && h.SlaStartDate <= endDate)
                .ToListAsync();

            var totalItems = histories.Count;
            var completedItems = histories.Count(h => h.CompletedDate.HasValue);
            var breachedItems = histories.Count(h => h.ComplianceStatus == SlaComplianceStatus.Breached);

            var report = new SlaPerformanceReport
            {
                StartDate = startDate,
                EndDate = endDate,
                TotalItems = totalItems,
                CompletedItems = completedItems,
                BreachedItems = breachedItems,
                OverallComplianceRate = totalItems > 0 ? (decimal)(completedItems - breachedItems) / totalItems * 100 : 0,
                AverageCompletionTime = completedItems > 0 ? 
                    TimeSpan.FromTicks((long)histories.Where(h => h.CompletionTime.HasValue).Average(h => h.CompletionTime!.Value.Ticks)) : 
                    TimeSpan.Zero
            };

            // Performance by Type
            report.PerformanceByType = histories
                .GroupBy(h => h.SlaType)
                .ToDictionary(g => g.Key, g => new SlaTypePerformance
                {
                    SlaType = g.Key,
                    TotalItems = g.Count(),
                    CompletedItems = g.Count(h => h.CompletedDate.HasValue),
                    BreachedItems = g.Count(h => h.ComplianceStatus == SlaComplianceStatus.Breached),
                    ComplianceRate = g.Count() > 0 ? (decimal)(g.Count(h => h.CompletedDate.HasValue) - g.Count(h => h.ComplianceStatus == SlaComplianceStatus.Breached)) / g.Count() * 100 : 0,
                    AverageCompletionTime = g.Where(h => h.CompletionTime.HasValue).Any() ? 
                        TimeSpan.FromTicks((long)g.Where(h => h.CompletionTime.HasValue).Average(h => h.CompletionTime!.Value.Ticks)) : 
                        TimeSpan.Zero,
                    AverageSlaVariance = g.Where(h => h.SlaVariance.HasValue).Any() ? 
                        TimeSpan.FromTicks((long)g.Where(h => h.SlaVariance.HasValue).Average(h => h.SlaVariance!.Value.Ticks)) : 
                        TimeSpan.Zero
                });

            // Performance by Risk Level
            report.PerformanceByRiskLevel = histories
                .GroupBy(h => h.RiskLevel)
                .ToDictionary(g => g.Key, g => new SlaRiskLevelPerformance
                {
                    RiskLevel = g.Key,
                    TotalItems = g.Count(),
                    CompletedItems = g.Count(h => h.CompletedDate.HasValue),
                    BreachedItems = g.Count(h => h.ComplianceStatus == SlaComplianceStatus.Breached),
                    ComplianceRate = g.Count() > 0 ? (decimal)(g.Count(h => h.CompletedDate.HasValue) - g.Count(h => h.ComplianceStatus == SlaComplianceStatus.Breached)) / g.Count() * 100 : 0,
                    AverageCompletionTime = g.Where(h => h.CompletionTime.HasValue).Any() ? 
                        TimeSpan.FromTicks((long)g.Where(h => h.CompletionTime.HasValue).Average(h => h.CompletionTime!.Value.Ticks)) : 
                        TimeSpan.Zero
                });

            return report;
        }

        public async Task<IEnumerable<SlaComplianceTrend>> GetSlaComplianceTrendsAsync(DateTime startDate, DateTime endDate, SlaType? slaType = null)
        {
            var query = _context.SlaHistories
                .Where(h => h.SlaStartDate >= startDate && h.SlaStartDate <= endDate);

            if (slaType.HasValue)
            {
                query = query.Where(h => h.SlaType == slaType.Value);
            }

            var histories = await query.ToListAsync();

            return histories
                .GroupBy(h => new { Date = h.SlaStartDate.Date, h.SlaType })
                .Select(g => new SlaComplianceTrend
                {
                    Date = g.Key.Date,
                    SlaType = g.Key.SlaType,
                    TotalItems = g.Count(),
                    CompletedItems = g.Count(h => h.CompletedDate.HasValue),
                    BreachedItems = g.Count(h => h.ComplianceStatus == SlaComplianceStatus.Breached),
                    ComplianceRate = g.Count() > 0 ? (decimal)(g.Count(h => h.CompletedDate.HasValue) - g.Count(h => h.ComplianceStatus == SlaComplianceStatus.Breached)) / g.Count() * 100 : 0
                })
                .OrderBy(t => t.Date)
                .ToList();
        }

        public async Task<IEnumerable<SlaPerformanceByRiskLevel>> GetSlaPerformanceByRiskLevelAsync(DateTime startDate, DateTime endDate)
        {
            var histories = await _context.SlaHistories
                .Where(h => h.SlaStartDate >= startDate && h.SlaStartDate <= endDate)
                .ToListAsync();

            return histories
                .GroupBy(h => h.RiskLevel)
                .Select(g => new SlaPerformanceByRiskLevel
                {
                    RiskLevel = g.Key,
                    TotalItems = g.Count(),
                    CompletedItems = g.Count(h => h.CompletedDate.HasValue),
                    BreachedItems = g.Count(h => h.ComplianceStatus == SlaComplianceStatus.Breached),
                    ComplianceRate = g.Count() > 0 ? (decimal)(g.Count(h => h.CompletedDate.HasValue) - g.Count(h => h.ComplianceStatus == SlaComplianceStatus.Breached)) / g.Count() * 100 : 0,
                    AverageCompletionTime = g.Where(h => h.CompletionTime.HasValue).Any() ? 
                        TimeSpan.FromTicks((long)g.Where(h => h.CompletionTime.HasValue).Average(h => h.CompletionTime!.Value.Ticks)) : 
                        TimeSpan.Zero
                })
                .OrderBy(p => p.RiskLevel)
                .ToList();
        }

        public async Task<IEnumerable<SlaPerformanceByTeam>> GetSlaPerformanceByTeamAsync(DateTime startDate, DateTime endDate)
        {
            var histories = await _context.SlaHistories
                .Where(h => h.SlaStartDate >= startDate && h.SlaStartDate <= endDate)
                .ToListAsync();

            return histories
                .GroupBy(h => h.AssignedTo)
                .Select(g => new SlaPerformanceByTeam
                {
                    AssignedTo = g.Key,
                    TeamName = g.Key, // Could be enhanced to map to actual team names
                    TotalItems = g.Count(),
                    CompletedItems = g.Count(h => h.CompletedDate.HasValue),
                    BreachedItems = g.Count(h => h.ComplianceStatus == SlaComplianceStatus.Breached),
                    ComplianceRate = g.Count() > 0 ? (decimal)(g.Count(h => h.CompletedDate.HasValue) - g.Count(h => h.ComplianceStatus == SlaComplianceStatus.Breached)) / g.Count() * 100 : 0,
                    AverageCompletionTime = g.Where(h => h.CompletionTime.HasValue).Any() ? 
                        TimeSpan.FromTicks((long)g.Where(h => h.CompletionTime.HasValue).Average(h => h.CompletionTime!.Value.Ticks)) : 
                        TimeSpan.Zero
                })
                .OrderByDescending(p => p.ComplianceRate)
                .ToList();
        }

        public async Task<IEnumerable<SlaBreachAnalysis>> GetTopSlaBreachCausesAsync(DateTime startDate, DateTime endDate)
        {
            var breachedHistories = await _context.SlaHistories
                .Where(h => h.SlaStartDate >= startDate && h.SlaStartDate <= endDate && h.ComplianceStatus == SlaComplianceStatus.Breached)
                .ToListAsync();

            return breachedHistories
                .GroupBy(h => new { h.SlaType, h.RiskLevel })
                .Select(g => new SlaBreachAnalysis
                {
                    BreachCause = $"{g.Key.SlaType} - {g.Key.RiskLevel}",
                    SlaType = g.Key.SlaType,
                    RiskLevel = g.Key.RiskLevel,
                    BreachCount = g.Count(),
                    AverageOverdueTime = g.Where(h => h.SlaVariance.HasValue && h.SlaVariance.Value.TotalSeconds > 0).Any() ? 
                        TimeSpan.FromTicks((long)g.Where(h => h.SlaVariance.HasValue && h.SlaVariance.Value.TotalSeconds > 0).Average(h => h.SlaVariance!.Value.Ticks)) : 
                        TimeSpan.Zero,
                    ImpactPercentage = breachedHistories.Count > 0 ? (decimal)g.Count() / breachedHistories.Count * 100 : 0
                })
                .OrderByDescending(b => b.BreachCount)
                .ToList();
        }

        public async Task<SlaBreachSummary> GetSlaBreachSummaryAsync(DateTime startDate, DateTime endDate)
        {
            var breachedHistories = await _context.SlaHistories
                .Where(h => h.SlaStartDate >= startDate && h.SlaStartDate <= endDate && h.ComplianceStatus == SlaComplianceStatus.Breached)
                .ToListAsync();

            var summary = new SlaBreachSummary
            {
                StartDate = startDate,
                EndDate = endDate,
                TotalBreaches = breachedHistories.Count,
                BreachesByType = breachedHistories.GroupBy(h => h.SlaType).ToDictionary(g => g.Key, g => g.Count()),
                BreachesByRiskLevel = breachedHistories.GroupBy(h => h.RiskLevel).ToDictionary(g => g.Key, g => g.Count()),
                AverageBreachDuration = breachedHistories.Where(h => h.SlaVariance.HasValue && h.SlaVariance.Value.TotalSeconds > 0).Any() ? 
                    TimeSpan.FromTicks((long)breachedHistories.Where(h => h.SlaVariance.HasValue && h.SlaVariance.Value.TotalSeconds > 0).Average(h => h.SlaVariance!.Value.Ticks)) : 
                    TimeSpan.Zero
            };

            if (summary.BreachesByType.Any())
            {
                summary.MostFrequentBreachType = summary.BreachesByType.OrderByDescending(kvp => kvp.Value).First().Key.ToString();
            }

            return summary;
        }

        public async Task<IEnumerable<SlaHistory>> GetSlaHistoryAsync(DateTime startDate, DateTime endDate, SlaType? slaType = null)
        {
            var query = _context.SlaHistories
                .Where(h => h.SlaStartDate >= startDate && h.SlaStartDate <= endDate);

            if (slaType.HasValue)
            {
                query = query.Where(h => h.SlaType == slaType.Value);
            }

            return await query.OrderByDescending(h => h.SlaStartDate).ToListAsync();
        }

        public async Task<SlaHistory?> GetSlaHistoryByItemAsync(string itemType, int itemId)
        {
            return await _context.SlaHistories
                .Where(h => h.ItemType == itemType && h.ItemId == itemId)
                .OrderByDescending(h => h.CreatedAt)
                .FirstOrDefaultAsync();
        }

        public async Task<SlaDashboardMetrics> GetSlaDashboardMetricsAsync(int daysBack = 30)
        {
            var startDate = DateTime.UtcNow.AddDays(-daysBack);
            var endDate = DateTime.UtcNow;

            var histories = await _context.SlaHistories
                .Where(h => h.SlaStartDate >= startDate && h.SlaStartDate <= endDate)
                .ToListAsync();

            var totalCompleted = histories.Count(h => h.CompletedDate.HasValue);
            var totalBreached = histories.Count(h => h.ComplianceStatus == SlaComplianceStatus.Breached);

            var metrics = new SlaDashboardMetrics
            {
                DaysBack = daysBack,
                OverallComplianceRate = totalCompleted > 0 ? (decimal)(totalCompleted - totalBreached) / totalCompleted * 100 : 0,
                TotalCompletedItems = totalCompleted,
                TotalBreachedItems = totalBreached,
                AverageCompletionTime = totalCompleted > 0 ? 
                    TimeSpan.FromTicks((long)histories.Where(h => h.CompletionTime.HasValue).Average(h => h.CompletionTime!.Value.Ticks)) : 
                    TimeSpan.Zero,
                ComplianceRateByType = histories
                    .GroupBy(h => h.SlaType)
                    .ToDictionary(g => g.Key, g => g.Count() > 0 ? (decimal)(g.Count(h => h.CompletedDate.HasValue) - g.Count(h => h.ComplianceStatus == SlaComplianceStatus.Breached)) / g.Count() * 100 : 0),
                ComplianceTrend = (await GetSlaComplianceTrendsAsync(startDate, endDate)).ToList(),
                PerformanceByRiskLevel = (await GetSlaPerformanceByRiskLevelAsync(startDate, endDate)).ToList()
            };

            return metrics;
        }
    }
}