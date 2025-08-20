using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class GovernanceService : IGovernanceService
    {
        private readonly CyberRiskContext _context;

        public GovernanceService(CyberRiskContext context)
        {
            _context = context;
        }

        // ========================================
        // COMPLIANCE FRAMEWORK METHODS
        // ========================================

        public async Task<IEnumerable<ComplianceFramework>> GetAllFrameworksAsync()
        {
            try
            {
                return await _context.ComplianceFrameworks
                    .Include(f => f.Controls)
                    .OrderBy(f => f.Name)
                    .ToListAsync();
            }
            catch
            {
                return new List<ComplianceFramework>();
            }
        }

        public async Task<ComplianceFramework?> GetFrameworkByIdAsync(int id)
        {
            try
            {
                return await _context.ComplianceFrameworks
                    .Include(f => f.Controls)
                    .Include(f => f.Assessments)
                    .FirstOrDefaultAsync(f => f.Id == id);
            }
            catch
            {
                return null;
            }
        }

        public async Task<ComplianceFramework> CreateFrameworkAsync(ComplianceFramework framework)
        {
            framework.CreatedAt = DateTime.UtcNow;
            framework.UpdatedAt = DateTime.UtcNow;
            framework.UploadedDate = DateTime.UtcNow;

            _context.ComplianceFrameworks.Add(framework);
            await _context.SaveChangesAsync();
            return framework;
        }

        public async Task<ComplianceFramework> UpdateFrameworkAsync(ComplianceFramework framework)
        {
            framework.UpdatedAt = DateTime.UtcNow;

            _context.Entry(framework).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return framework;
        }

        public async Task<bool> DeleteFrameworkAsync(int id)
        {
            try
            {
                var framework = await _context.ComplianceFrameworks.FindAsync(id);
                if (framework != null)
                {
                    _context.ComplianceFrameworks.Remove(framework);
                    await _context.SaveChangesAsync();
                    return true;
                }
                return false;
            }
            catch
            {
                return false;
            }
        }

        // ========================================
        // COMPLIANCE CONTROL METHODS (NEW)
        // ========================================

        public async Task<ComplianceControl?> GetControlByIdAsync(int id)
        {
            try
            {
                return await _context.ComplianceControls
                    .Include(c => c.Framework)
                    .FirstOrDefaultAsync(c => c.Id == id);
            }
            catch
            {
                return null;
            }
        }

        public async Task<ComplianceControl> UpdateControlAsync(ComplianceControl control)
        {
            try
            {
                _context.Entry(control).State = EntityState.Modified;
                await _context.SaveChangesAsync();
                return control;
            }
            catch
            {
                throw;
            }
        }

        public async Task<bool> UpdateControlPriorityAsync(int controlId, ControlPriority priority)
        {
            try
            {
                var control = await _context.ComplianceControls.FindAsync(controlId);
                if (control == null)
                    return false;

                control.Priority = priority;
                _context.Entry(control).State = EntityState.Modified;
                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<IEnumerable<ComplianceControl>> GetControlsByFrameworkIdAsync(int frameworkId)
        {
            return await _context.ComplianceControls
                .Where(c => c.ComplianceFrameworkId == frameworkId)
                .OrderBy(c => c.Category)
                .ThenBy(c => c.ControlId)
                .ToListAsync();
        }

        // ========================================
        // BUSINESS ORGANIZATION METHODS
        // ========================================

        public async Task<IEnumerable<BusinessOrganization>> GetAllOrganizationsAsync()
        {
            try
            {
                return await _context.BusinessOrganizations
                    .OrderBy(o => o.Name)
                    .ToListAsync();
            }
            catch
            {
                return new List<BusinessOrganization>();
            }
        }

        public async Task<BusinessOrganization?> GetOrganizationByIdAsync(int id)
        {
            try
            {
                return await _context.BusinessOrganizations
                    .Include(o => o.Assessments)
                    .FirstOrDefaultAsync(o => o.Id == id);
            }
            catch
            {
                return null;
            }
        }

        public async Task<BusinessOrganization> CreateOrganizationAsync(BusinessOrganization organization)
        {
            organization.CreatedAt = DateTime.UtcNow;
            organization.UpdatedAt = DateTime.UtcNow;

            _context.BusinessOrganizations.Add(organization);
            await _context.SaveChangesAsync();
            return organization;
        }

        public async Task<BusinessOrganization> UpdateOrganizationAsync(BusinessOrganization organization)
        {
            organization.UpdatedAt = DateTime.UtcNow;

            _context.Entry(organization).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return organization;
        }

        public async Task<bool> DeleteOrganizationAsync(int id)
        {
            try
            {
                var organization = await _context.BusinessOrganizations.FindAsync(id);
                if (organization != null)
                {
                    _context.BusinessOrganizations.Remove(organization);
                    await _context.SaveChangesAsync();
                    return true;
                }
                return false;
            }
            catch
            {
                return false;
            }
        }

        // ========================================
        // COMPLIANCE ASSESSMENT METHODS
        // ========================================

        public async Task<IEnumerable<ComplianceAssessment>> GetAllAssessmentsAsync()
        {
            try
            {
                return await _context.ComplianceAssessments
                    .Include(a => a.Framework)
                    .Include(a => a.Organization)
                    .Include(a => a.ControlAssessments)
                    .OrderByDescending(a => a.StartDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<ComplianceAssessment>();
            }
        }

        public async Task<ComplianceAssessment?> GetAssessmentByIdAsync(int id)
        {
            try
            {
                return await _context.ComplianceAssessments
                    .Include(a => a.Framework)
                        .ThenInclude(f => f.Controls)
                    .Include(a => a.Organization)
                    .Include(a => a.ControlAssessments)
                        .ThenInclude(ca => ca.Control)
                    .FirstOrDefaultAsync(a => a.Id == id);
            }
            catch
            {
                return null;
            }
        }

        public async Task<ComplianceAssessment> CreateAssessmentAsync(ComplianceAssessment assessment)
        {
            assessment.CreatedAt = DateTime.UtcNow;
            assessment.UpdatedAt = DateTime.UtcNow;

            _context.ComplianceAssessments.Add(assessment);
            await _context.SaveChangesAsync();

            // Create control assessments for all controls in the framework
            var framework = await _context.ComplianceFrameworks
                .Include(f => f.Controls)
                .FirstOrDefaultAsync(f => f.Id == assessment.ComplianceFrameworkId);

            if (framework != null)
            {
                foreach (var control in framework.Controls)
                {
                    var controlAssessment = new ControlAssessment
                    {
                        ComplianceControlId = control.Id,
                        ComplianceAssessmentId = assessment.Id,
                        Status = ComplianceStatus.NonCompliant,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.ControlAssessments.Add(controlAssessment);
                }
                await _context.SaveChangesAsync();
            }

            return assessment;
        }

        public async Task<ComplianceAssessment> UpdateAssessmentAsync(ComplianceAssessment assessment)
        {
            assessment.UpdatedAt = DateTime.UtcNow;

            // Calculate compliance percentage based on updated enum
            var controlAssessments = await _context.ControlAssessments
                .Where(ca => ca.ComplianceAssessmentId == assessment.Id)
                .ToListAsync();

            if (controlAssessments.Any())
            {
                var implementedCount = controlAssessments.Count(ca =>
                    ca.Status == ComplianceStatus.FullyCompliant ||
                    ca.Status == ComplianceStatus.MajorlyCompliant ||
                    ca.Status == ComplianceStatus.PartiallyCompliant);

                var totalCount = controlAssessments.Count(ca => ca.Status != ComplianceStatus.NotApplicable);

                assessment.CompliancePercentage = totalCount > 0 ?
                    Math.Round((decimal)implementedCount / totalCount * 100, 2) : 0;
            }

            _context.Entry(assessment).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return assessment;
        }

        public async Task<bool> DeleteAssessmentAsync(int id)
        {
            try
            {
                var assessment = await _context.ComplianceAssessments.FindAsync(id);
                if (assessment != null)
                {
                    _context.ComplianceAssessments.Remove(assessment);
                    await _context.SaveChangesAsync();
                    return true;
                }
                return false;
            }
            catch
            {
                return false;
            }
        }

        // ========================================
        // CONTROL ASSESSMENT METHODS
        // ========================================

        public async Task<ControlAssessment?> GetControlAssessmentByIdAsync(int id)
        {
            try
            {
                return await _context.ControlAssessments
                    .Include(ca => ca.Control)
                    .Include(ca => ca.Assessment)
                    .FirstOrDefaultAsync(ca => ca.Id == id);
            }
            catch
            {
                return null;
            }
        }

        public async Task<ControlAssessment> UpdateControlAssessmentAsync(ControlAssessment controlAssessment)
        {
            controlAssessment.UpdatedAt = DateTime.UtcNow;

            _context.Entry(controlAssessment).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return controlAssessment;
        }

        public async Task<IEnumerable<ControlAssessment>> GetControlAssessmentsByAssessmentIdAsync(int assessmentId)
        {
            try
            {
                return await _context.ControlAssessments
                    .Include(ca => ca.Control)
                    .Where(ca => ca.ComplianceAssessmentId == assessmentId)
                    .ToListAsync();
            }
            catch
            {
                return new List<ControlAssessment>();
            }
        }

        // ========================================
        // DASHBOARD STATISTICS METHODS
        // ========================================

        public async Task<Dictionary<string, object>> GetGovernanceDashboardStatsAsync()
        {
            try
            {
                var stats = new Dictionary<string, object>();

                // Framework statistics
                var totalFrameworks = await _context.ComplianceFrameworks.CountAsync();
                var activeFrameworks = await _context.ComplianceFrameworks
                    .CountAsync(f => f.Status == FrameworkStatus.Active);

                // Assessment statistics
                var totalAssessments = await _context.ComplianceAssessments.CountAsync();
                var completedAssessments = await _context.ComplianceAssessments
                    .CountAsync(a => a.Status == AssessmentStatus.Completed);

                // Control statistics
                var totalControls = await _context.ComplianceControls.CountAsync();

                stats.Add("TotalFrameworks", totalFrameworks);
                stats.Add("ActiveFrameworks", activeFrameworks);
                stats.Add("TotalAssessments", totalAssessments);
                stats.Add("CompletedAssessments", completedAssessments);
                stats.Add("TotalControls", totalControls);

                return stats;
            }
            catch
            {
                return new Dictionary<string, object>();
            }
        }

        public async Task<IEnumerable<ComplianceAssessment>> GetRecentAssessmentsAsync(int count = 5)
        {
            try
            {
                return await _context.ComplianceAssessments
                    .Include(a => a.Framework)
                    .Include(a => a.Organization)
                    .OrderByDescending(a => a.CreatedAt)
                    .Take(count)
                    .ToListAsync();
            }
            catch
            {
                return new List<ComplianceAssessment>();
            }
        }

        public async Task<IEnumerable<ComplianceAssessment>> GetUpcomingDeadlinesAsync(int days = 30)
        {
            try
            {
                var cutoffDate = DateTime.UtcNow.AddDays(days);
                return await _context.ComplianceAssessments
                    .Include(a => a.Framework)
                    .Include(a => a.Organization)
                    .Where(a => a.DueDate.HasValue && a.DueDate.Value <= cutoffDate && a.Status != AssessmentStatus.Completed)
                    .OrderBy(a => a.DueDate)
                    .ToListAsync();
            }
            catch
            {
                return new List<ComplianceAssessment>();
            }
        }

        // ========================================
        // EXCEL UPLOAD SUPPORT METHODS
        // ========================================

        public async Task AddControlsToFrameworkAsync(int frameworkId, List<ComplianceControl> controls)
        {
            try
            {
                foreach (var control in controls)
                {
                    control.ComplianceFrameworkId = frameworkId;
                    _context.ComplianceControls.Add(control);
                }
                await _context.SaveChangesAsync();
            }
            catch
            {
                throw;
            }
        }

        // ========================================
        // ENHANCED COMPLIANCE ANALYTICS METHODS
        // ========================================

        public async Task<Dictionary<int, ComplianceMetrics>> GetFrameworkComplianceMetricsAsync()
        {
            try
            {
                var frameworks = await _context.ComplianceFrameworks
                    .Include(f => f.Controls)
                    .Include(f => f.Assessments)
                        .ThenInclude(a => a.ControlAssessments)
                    .Where(f => f.Status == FrameworkStatus.Active)
                    .ToListAsync();

                var metricsDict = new Dictionary<int, ComplianceMetrics>();

                foreach (var framework in frameworks)
                {
                    var metrics = await CalculateFrameworkMetricsAsync(framework);
                    metricsDict[framework.Id] = metrics;
                }

                return metricsDict;
            }
            catch
            {
                return new Dictionary<int, ComplianceMetrics>();
            }
        }

        public async Task<ComplianceMetrics> GetFrameworkComplianceMetricsAsync(int frameworkId)
        {
            try
            {
                var framework = await _context.ComplianceFrameworks
                    .Include(f => f.Controls)
                    .Include(f => f.Assessments)
                        .ThenInclude(a => a.ControlAssessments)
                    .FirstOrDefaultAsync(f => f.Id == frameworkId);

                if (framework == null)
                    return new ComplianceMetrics { FrameworkId = frameworkId, FrameworkName = "Framework Not Found" };

                return await CalculateFrameworkMetricsAsync(framework);
            }
            catch
            {
                return new ComplianceMetrics { FrameworkId = frameworkId, FrameworkName = "Error Loading Metrics" };
            }
        }

        public async Task<List<ComplianceBreakdown>> GetComplianceBreakdownByFrameworkAsync()
        {
            try
            {
                var frameworks = await _context.ComplianceFrameworks
                    .Include(f => f.Controls)
                    .Include(f => f.Assessments)
                        .ThenInclude(a => a.ControlAssessments)
                    .Where(f => f.Status == FrameworkStatus.Active)
                    .ToListAsync();

                var breakdown = new List<ComplianceBreakdown>();

                foreach (var framework in frameworks)
                {
                    var metrics = await CalculateFrameworkMetricsAsync(framework);
                    
                    breakdown.Add(new ComplianceBreakdown
                    {
                        FrameworkId = framework.Id,
                        FrameworkName = framework.Name,
                        FrameworkType = framework.Type,
                        CompliancePercentage = metrics.OverallCompliancePercentage,
                        ComplianceGrade = metrics.ComplianceGrade,
                        RiskLevel = metrics.RiskLevel,
                        TotalControls = metrics.TotalControls,
                        AssessedControls = metrics.FullyCompliantControls + metrics.MajorlyCompliantControls + 
                                          metrics.PartiallyCompliantControls + metrics.NonCompliantControls,
                        LastAssessmentDate = metrics.LastAssessmentDate != DateTime.MinValue ? metrics.LastAssessmentDate : null
                    });
                }

                return breakdown.OrderByDescending(b => b.CompliancePercentage).ToList();
            }
            catch
            {
                return new List<ComplianceBreakdown>();
            }
        }

        public async Task<List<ComplianceTrend>> GetComplianceTrendDataAsync(int frameworkId, int months = 12)
        {
            try
            {
                var startDate = DateTime.UtcNow.AddMonths(-months);
                
                var assessments = await _context.ComplianceAssessments
                    .Include(a => a.ControlAssessments)
                    .Where(a => a.ComplianceFrameworkId == frameworkId && 
                               a.CompletedDate.HasValue && 
                               a.CompletedDate.Value >= startDate)
                    .OrderBy(a => a.CompletedDate)
                    .ToListAsync();

                var trends = new List<ComplianceTrend>();

                foreach (var assessment in assessments)
                {
                    var totalAssessed = assessment.ControlAssessments.Count();
                    var fullyCompliant = assessment.ControlAssessments.Count(ca => ca.Status == ComplianceStatus.FullyCompliant);
                    
                    trends.Add(new ComplianceTrend
                    {
                        Date = assessment.CompletedDate!.Value,
                        CompliancePercentage = totalAssessed > 0 ? (fullyCompliant / (decimal)totalAssessed) * 100 : 0,
                        FullyCompliantControls = fullyCompliant,
                        TotalAssessedControls = totalAssessed,
                        Assessor = assessment.Assessor
                    });
                }

                return trends;
            }
            catch
            {
                return new List<ComplianceTrend>();
            }
        }

        public async Task<List<ControlComplianceDetail>> GetControlComplianceDetailsAsync(int frameworkId, ComplianceStatus? filterStatus = null)
        {
            try
            {
                var latestAssessment = await _context.ComplianceAssessments
                    .Include(a => a.ControlAssessments)
                        .ThenInclude(ca => ca.Control)
                    .Where(a => a.ComplianceFrameworkId == frameworkId)
                    .OrderByDescending(a => a.CompletedDate ?? a.CreatedAt)
                    .FirstOrDefaultAsync();

                if (latestAssessment == null)
                    return new List<ControlComplianceDetail>();

                var query = latestAssessment.ControlAssessments.AsQueryable();
                
                if (filterStatus.HasValue)
                    query = query.Where(ca => ca.Status == filterStatus.Value);

                return query.Select(ca => new ControlComplianceDetail
                {
                    ControlId = ca.ComplianceControlId,
                    ControlNumber = ca.Control.ControlId,
                    ControlTitle = ca.Control.Title,
                    Category = ca.Control.Category,
                    Priority = ca.Control.Priority,
                    Status = ca.Status,
                    Evidence = ca.Evidence,
                    GapAnalysis = ca.Notes,
                    LastAssessmentDate = latestAssessment.CompletedDate ?? latestAssessment.CreatedAt,
                    LastAssessor = latestAssessment.Assessor
                }).OrderBy(c => c.ControlNumber).ToList();
            }
            catch
            {
                return new List<ControlComplianceDetail>();
            }
        }

        public async Task<ComplianceComparison> GetComplianceComparisonAsync(List<int> frameworkIds)
        {
            try
            {
                var comparison = new ComplianceComparison();
                
                foreach (var frameworkId in frameworkIds)
                {
                    var metrics = await GetFrameworkComplianceMetricsAsync(frameworkId);
                    comparison.FrameworkMetrics.Add(metrics);
                }

                if (comparison.FrameworkMetrics.Any())
                {
                    comparison.AverageCompliancePercentage = comparison.FrameworkMetrics.Average(m => m.OverallCompliancePercentage);
                    
                    var best = comparison.FrameworkMetrics.OrderByDescending(m => m.OverallCompliancePercentage).First();
                    var worst = comparison.FrameworkMetrics.OrderBy(m => m.OverallCompliancePercentage).First();
                    
                    comparison.BestPerformingFramework = best.FrameworkName;
                    comparison.WorstPerformingFramework = worst.FrameworkName;
                    comparison.TotalControlsAcrossFrameworks = comparison.FrameworkMetrics.Sum(m => m.TotalControls);
                    comparison.TotalCompliantControls = comparison.FrameworkMetrics.Sum(m => m.FullyCompliantControls);
                }

                return comparison;
            }
            catch
            {
                return new ComplianceComparison();
            }
        }

        // ========================================
        // ADVANCED TREND ANALYSIS METHODS
        // ========================================

        public async Task<ComplianceTrendAnalysis> GetComplianceTrendAnalysisAsync(int frameworkId, int months = 24)
        {
            try
            {
                var framework = await _context.ComplianceFrameworks.FindAsync(frameworkId);
                if (framework == null)
                    return new ComplianceTrendAnalysis { FrameworkId = frameworkId, FrameworkName = "Framework Not Found" };

                var trendData = await GetComplianceTrendDataAsync(frameworkId, months);
                
                var analysis = new ComplianceTrendAnalysis
                {
                    FrameworkId = frameworkId,
                    FrameworkName = framework.Name,
                    TrendData = trendData
                };

                if (trendData.Any())
                {
                    analysis.CurrentCompliance = trendData.LastOrDefault()?.CompliancePercentage ?? 0;
                    analysis.AverageCompliance = trendData.Average(t => t.CompliancePercentage);
                    analysis.BestCompliance = trendData.Max(t => t.CompliancePercentage);
                    analysis.WorstCompliance = trendData.Min(t => t.CompliancePercentage);
                    
                    // Calculate variance
                    var average = (double)analysis.AverageCompliance;
                    analysis.ComplianceVariance = (decimal)Math.Sqrt(trendData.Average(t => Math.Pow((double)t.CompliancePercentage - average, 2)));
                    
                    // Analyze trend direction and calculate slope
                    analysis.TrendSlope = CalculateTrendSlope(trendData);
                    analysis.OverallTrend = DetermineTrendDirection(analysis.TrendSlope);
                    
                    // Estimate days to target (100% compliance)
                    if (analysis.TrendSlope > 0 && analysis.CurrentCompliance < 100)
                    {
                        var remainingPoints = 100 - analysis.CurrentCompliance;
                        var monthsToTarget = remainingPoints / analysis.TrendSlope;
                        analysis.DaysToTarget = (int)(monthsToTarget * 30);
                    }

                    // Find improvement and decline dates
                    analysis.LastImprovementDate = FindLastImprovementDate(trendData);
                    analysis.LastDeclineDate = FindLastDeclineDate(trendData);
                    
                    // Generate period summaries
                    analysis.PeriodSummaries = GeneratePeriodSummaries(trendData);
                }

                return analysis;
            }
            catch
            {
                return new ComplianceTrendAnalysis { FrameworkId = frameworkId, FrameworkName = "Error Loading Analysis" };
            }
        }

        public async Task<List<ComplianceForecast>> GetComplianceForecastAsync(int frameworkId, int forecastMonths = 6)
        {
            try
            {
                var trendData = await GetComplianceTrendDataAsync(frameworkId, 12);
                if (!trendData.Any())
                    return new List<ComplianceForecast>();

                var forecasts = new List<ComplianceForecast>();
                var trendSlope = CalculateTrendSlope(trendData);
                var currentCompliance = trendData.LastOrDefault()?.CompliancePercentage ?? 0;
                var lastDate = trendData.LastOrDefault()?.Date ?? DateTime.UtcNow;

                for (int i = 1; i <= forecastMonths; i++)
                {
                    var forecastDate = lastDate.AddMonths(i);
                    var predictedCompliance = Math.Max(0, Math.Min(100, currentCompliance + (trendSlope * i)));
                    
                    // Calculate confidence interval based on historical variance
                    var variance = CalculateVariance(trendData);
                    var confidenceInterval = Math.Min(15, variance * 1.96m); // 95% confidence interval
                    
                    forecasts.Add(new ComplianceForecast
                    {
                        Date = forecastDate,
                        PredictedCompliance = predictedCompliance,
                        ConfidenceInterval = confidenceInterval,
                        LowerBound = Math.Max(0, predictedCompliance - confidenceInterval),
                        UpperBound = Math.Min(100, predictedCompliance + confidenceInterval),
                        ForecastMethod = "Linear Regression",
                        AssumptionNotes = new List<string>
                        {
                            "Based on historical trend analysis",
                            "Assumes consistent improvement velocity",
                            "External factors may impact actual results"
                        }
                    });
                }

                return forecasts;
            }
            catch
            {
                return new List<ComplianceForecast>();
            }
        }

        public async Task<ComplianceVelocityMetrics> GetComplianceVelocityAsync(int frameworkId)
        {
            try
            {
                var framework = await _context.ComplianceFrameworks.FindAsync(frameworkId);
                var trendData = await GetComplianceTrendDataAsync(frameworkId, 12);
                
                var metrics = new ComplianceVelocityMetrics
                {
                    FrameworkId = frameworkId,
                    FrameworkName = framework?.Name ?? "Framework Not Found"
                };

                if (trendData.Count >= 2)
                {
                    // Calculate velocities between consecutive periods
                    var velocities = new List<VelocityPeriod>();
                    for (int i = 1; i < trendData.Count; i++)
                    {
                        var current = trendData[i];
                        var previous = trendData[i - 1];
                        var velocity = current.CompliancePercentage - previous.CompliancePercentage;
                        
                        velocities.Add(new VelocityPeriod
                        {
                            Date = current.Date,
                            Velocity = velocity,
                            ControlsChanged = Math.Abs(current.FullyCompliantControls - previous.FullyCompliantControls),
                            VelocityCategory = CategorizeVelocity(velocity)
                        });
                    }

                    metrics.VelocityHistory = velocities;
                    metrics.CurrentVelocity = velocities.LastOrDefault()?.Velocity ?? 0;
                    metrics.AverageVelocity = velocities.Average(v => v.Velocity);
                    metrics.MaxVelocity = velocities.Max(v => v.Velocity);
                    metrics.MinVelocity = velocities.Min(v => v.Velocity);
                    
                    // Calculate consecutive months
                    metrics.ConsecutiveImprovementMonths = CalculateConsecutiveMonths(velocities, v => v.Velocity > 0);
                    metrics.ConsecutiveDeclineMonths = CalculateConsecutiveMonths(velocities, v => v.Velocity < 0);
                    
                    // Find peak dates
                    var peakVelocity = velocities.OrderByDescending(v => v.Velocity).FirstOrDefault();
                    var lowestVelocity = velocities.OrderBy(v => v.Velocity).FirstOrDefault();
                    metrics.PeakVelocityDate = peakVelocity?.Date;
                    metrics.LowestVelocityDate = lowestVelocity?.Date;
                }

                return metrics;
            }
            catch
            {
                return new ComplianceVelocityMetrics { FrameworkId = frameworkId, FrameworkName = "Error Loading Velocity" };
            }
        }

        public async Task<List<ComplianceMilestone>> GetComplianceMilestonesAsync(int frameworkId)
        {
            try
            {
                var metrics = await GetFrameworkComplianceMetricsAsync(frameworkId);
                var currentCompliance = metrics.OverallCompliancePercentage;
                
                var milestones = new List<ComplianceMilestone>
                {
                    CreateMilestone(1, "Initial Compliance", "Achieve basic compliance framework", 25m, DateTime.UtcNow.AddMonths(3), currentCompliance),
                    CreateMilestone(2, "Substantial Compliance", "Reach majority control compliance", 50m, DateTime.UtcNow.AddMonths(6), currentCompliance),
                    CreateMilestone(3, "Advanced Compliance", "Achieve advanced compliance level", 75m, DateTime.UtcNow.AddMonths(9), currentCompliance),
                    CreateMilestone(4, "Comprehensive Compliance", "Near-complete compliance coverage", 90m, DateTime.UtcNow.AddMonths(12), currentCompliance),
                    CreateMilestone(5, "Full Compliance", "Complete framework compliance", 100m, DateTime.UtcNow.AddMonths(18), currentCompliance)
                };

                return milestones.Where(m => m.TargetCompliance >= currentCompliance).ToList();
            }
            catch
            {
                return new List<ComplianceMilestone>();
            }
        }

        public async Task<ComplianceMaturityProgression> GetComplianceMaturityProgressionAsync(int frameworkId)
        {
            try
            {
                var metrics = await GetFrameworkComplianceMetricsAsync(frameworkId);
                var framework = await _context.ComplianceFrameworks.FindAsync(frameworkId);
                
                var maturityLevel = DetermineMaturityLevel(metrics.OverallCompliancePercentage);
                
                return new ComplianceMaturityProgression
                {
                    FrameworkId = frameworkId,
                    FrameworkName = framework?.Name ?? "Unknown Framework",
                    CurrentMaturityLevel = maturityLevel,
                    TargetMaturityLevel = 5,
                    CurrentMaturityDescription = GetMaturityDescription(maturityLevel),
                    TargetMaturityDescription = GetMaturityDescription(5),
                    ProgressToNextLevel = CalculateProgressToNextLevel(metrics.OverallCompliancePercentage, maturityLevel),
                    LevelRequirements = GenerateMaturityLevelRequirements(metrics),
                    ProgressIndicators = GenerateProgressIndicators(metrics),
                    NextStepRecommendations = GenerateNextStepRecommendations(metrics, maturityLevel)
                };
            }
            catch
            {
                return new ComplianceMaturityProgression { FrameworkId = frameworkId, FrameworkName = "Error Loading Maturity" };
            }
        }

        // Helper method to calculate framework metrics
        private async Task<ComplianceMetrics> CalculateFrameworkMetricsAsync(ComplianceFramework framework)
        {
            var metrics = new ComplianceMetrics
            {
                FrameworkId = framework.Id,
                FrameworkName = framework.Name,
                FrameworkType = framework.Type,
                TotalControls = framework.Controls.Count(),
                ActiveAssessments = framework.Assessments.Count(a => a.Status == AssessmentStatus.InProgress)
            };

            // Get the latest completed assessment for this framework
            var latestAssessment = framework.Assessments
                .Where(a => a.Status == AssessmentStatus.Completed)
                .OrderByDescending(a => a.CompletedDate ?? a.CreatedAt)
                .FirstOrDefault();

            if (latestAssessment?.ControlAssessments?.Any() == true)
            {
                var controlAssessments = latestAssessment.ControlAssessments;
                
                metrics.FullyCompliantControls = controlAssessments.Count(ca => ca.Status == ComplianceStatus.FullyCompliant);
                metrics.MajorlyCompliantControls = controlAssessments.Count(ca => ca.Status == ComplianceStatus.MajorlyCompliant);
                metrics.PartiallyCompliantControls = controlAssessments.Count(ca => ca.Status == ComplianceStatus.PartiallyCompliant);
                metrics.NonCompliantControls = controlAssessments.Count(ca => ca.Status == ComplianceStatus.NonCompliant);
                metrics.NotApplicableControls = controlAssessments.Count(ca => ca.Status == ComplianceStatus.NotApplicable);
                
                metrics.LastAssessmentDate = latestAssessment.CompletedDate ?? latestAssessment.CreatedAt;
                metrics.LastAssessor = latestAssessment.Assessor;

                // Calculate overall compliance percentage (excluding NotApplicable)
                var assessableControls = metrics.TotalControls - metrics.NotApplicableControls;
                if (assessableControls > 0)
                {
                    // Weighted scoring: Full=100%, Majorly=80%, Partially=50%, Non=0%
                    var weightedScore = (metrics.FullyCompliantControls * 100) +
                                       (metrics.MajorlyCompliantControls * 80) +
                                       (metrics.PartiallyCompliantControls * 50);
                    
                    metrics.OverallCompliancePercentage = weightedScore / (assessableControls * 100);
                    metrics.WeightedComplianceScore = weightedScore / assessableControls;
                }
            }

            return metrics;
        }

        // ========================================
        // TREND ANALYSIS HELPER METHODS
        // ========================================

        private decimal CalculateTrendSlope(List<ComplianceTrend> trendData)
        {
            if (trendData.Count < 2) return 0;

            var n = trendData.Count;
            var sumX = 0m;
            var sumY = 0m;
            var sumXY = 0m;
            var sumX2 = 0m;

            for (int i = 0; i < n; i++)
            {
                var x = i + 1; // Month number
                var y = trendData[i].CompliancePercentage;
                sumX += x;
                sumY += y;
                sumXY += x * y;
                sumX2 += x * x;
            }

            return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        }

        private string DetermineTrendDirection(decimal slope)
        {
            if (slope > 2) return "Strongly Improving";
            if (slope > 0.5m) return "Improving";
            if (slope > -0.5m) return "Stable";
            if (slope > -2) return "Declining";
            return "Strongly Declining";
        }

        private DateTime? FindLastImprovementDate(List<ComplianceTrend> trendData)
        {
            for (int i = trendData.Count - 1; i > 0; i--)
            {
                if (trendData[i].CompliancePercentage > trendData[i - 1].CompliancePercentage)
                    return trendData[i].Date;
            }
            return null;
        }

        private DateTime? FindLastDeclineDate(List<ComplianceTrend> trendData)
        {
            for (int i = trendData.Count - 1; i > 0; i--)
            {
                if (trendData[i].CompliancePercentage < trendData[i - 1].CompliancePercentage)
                    return trendData[i].Date;
            }
            return null;
        }

        private List<CompliancePeriodSummary> GeneratePeriodSummaries(List<ComplianceTrend> trendData)
        {
            var summaries = new List<CompliancePeriodSummary>();
            
            if (trendData.Count >= 3) // Quarterly summary
            {
                var quarterData = trendData.TakeLast(3).ToList();
                summaries.Add(new CompliancePeriodSummary
                {
                    StartDate = quarterData.First().Date,
                    EndDate = quarterData.Last().Date,
                    StartCompliance = quarterData.First().CompliancePercentage,
                    EndCompliance = quarterData.Last().CompliancePercentage,
                    ChangePercentage = quarterData.Last().CompliancePercentage - quarterData.First().CompliancePercentage,
                    PeriodType = "Quarter"
                });
            }

            return summaries;
        }

        private decimal CalculateVariance(List<ComplianceTrend> trendData)
        {
            if (trendData.Count < 2) return 0;
            
            var mean = trendData.Average(t => t.CompliancePercentage);
            var variance = trendData.Sum(t => (t.CompliancePercentage - mean) * (t.CompliancePercentage - mean)) / trendData.Count;
            return (decimal)Math.Sqrt((double)variance);
        }

        private string CategorizeVelocity(decimal velocity)
        {
            if (velocity > 5) return "High";
            if (velocity > 1) return "Medium";
            if (velocity > -1) return "Low";
            return "Stalled";
        }

        private int CalculateConsecutiveMonths(List<VelocityPeriod> velocities, Func<VelocityPeriod, bool> condition)
        {
            var count = 0;
            for (int i = velocities.Count - 1; i >= 0; i--)
            {
                if (condition(velocities[i]))
                    count++;
                else
                    break;
            }
            return count;
        }

        private ComplianceMilestone CreateMilestone(int id, string title, string description, decimal targetCompliance, DateTime targetDate, decimal currentCompliance)
        {
            var milestone = new ComplianceMilestone
            {
                MilestoneId = id,
                Title = title,
                Description = description,
                TargetCompliance = targetCompliance,
                TargetDate = targetDate,
                ActualCompliance = currentCompliance,
                IsAchieved = currentCompliance >= targetCompliance
            };

            if (milestone.IsAchieved)
            {
                milestone.Status = "Completed";
                milestone.AchievedDate = DateTime.UtcNow; // Simplified - should track actual achievement date
            }
            else
            {
                var daysToTarget = (targetDate - DateTime.UtcNow).Days;
                milestone.DaysAheadBehind = daysToTarget;
                
                if (daysToTarget < 30)
                    milestone.Status = "At Risk";
                else if (daysToTarget < 90)
                    milestone.Status = "Behind";
                else
                    milestone.Status = "On Track";
            }

            milestone.Priority = targetCompliance switch
            {
                >= 90 => "Critical",
                >= 75 => "High",
                >= 50 => "Medium",
                _ => "Low"
            };

            return milestone;
        }

        private int DetermineMaturityLevel(decimal compliancePercentage)
        {
            return compliancePercentage switch
            {
                >= 90 => 5, // Optimized
                >= 75 => 4, // Managed
                >= 50 => 3, // Defined
                >= 25 => 2, // Repeatable
                _ => 1      // Initial
            };
        }

        private string GetMaturityDescription(int level)
        {
            return level switch
            {
                5 => "Optimized - Continuous improvement and optimization",
                4 => "Managed - Quantitative management and measurement",
                3 => "Defined - Standardized processes and procedures",
                2 => "Repeatable - Basic project management processes",
                1 => "Initial - Ad-hoc and chaotic processes",
                _ => "Unknown"
            };
        }

        private decimal CalculateProgressToNextLevel(decimal currentCompliance, int currentLevel)
        {
            var nextLevelThreshold = currentLevel switch
            {
                1 => 25m,
                2 => 50m,
                3 => 75m,
                4 => 90m,
                5 => 100m,
                _ => 100m
            };

            var currentLevelThreshold = currentLevel switch
            {
                1 => 0m,
                2 => 25m,
                3 => 50m,
                4 => 75m,
                5 => 90m,
                _ => 0m
            };

            var levelRange = nextLevelThreshold - currentLevelThreshold;
            var progress = currentCompliance - currentLevelThreshold;
            
            return levelRange > 0 ? (progress / levelRange) * 100 : 100;
        }

        private List<MaturityLevelRequirement> GenerateMaturityLevelRequirements(ComplianceMetrics metrics)
        {
            return new List<MaturityLevelRequirement>
            {
                new MaturityLevelRequirement { Level = 1, LevelName = "Initial", MinimumCompliancePercentage = 0, IsAchieved = metrics.OverallCompliancePercentage >= 0 },
                new MaturityLevelRequirement { Level = 2, LevelName = "Repeatable", MinimumCompliancePercentage = 25, IsAchieved = metrics.OverallCompliancePercentage >= 25 },
                new MaturityLevelRequirement { Level = 3, LevelName = "Defined", MinimumCompliancePercentage = 50, IsAchieved = metrics.OverallCompliancePercentage >= 50 },
                new MaturityLevelRequirement { Level = 4, LevelName = "Managed", MinimumCompliancePercentage = 75, IsAchieved = metrics.OverallCompliancePercentage >= 75 },
                new MaturityLevelRequirement { Level = 5, LevelName = "Optimized", MinimumCompliancePercentage = 90, IsAchieved = metrics.OverallCompliancePercentage >= 90 }
            };
        }

        private List<MaturityProgressIndicator> GenerateProgressIndicators(ComplianceMetrics metrics)
        {
            return new List<MaturityProgressIndicator>
            {
                new MaturityProgressIndicator
                {
                    Category = "Control Implementation",
                    Indicator = "Fully Compliant Controls",
                    CurrentScore = metrics.FullyCompliantControls,
                    TargetScore = metrics.TotalControls,
                    ProgressPercentage = metrics.FullyCompliantPercentage,
                    Status = metrics.FullyCompliantPercentage >= 80 ? "Good" : "Needs Improvement"
                },
                new MaturityProgressIndicator
                {
                    Category = "Process Maturity",
                    Indicator = "Overall Compliance",
                    CurrentScore = metrics.OverallCompliancePercentage,
                    TargetScore = 100,
                    ProgressPercentage = metrics.OverallCompliancePercentage,
                    Status = GetComplianceStatus(metrics.OverallCompliancePercentage)
                }
            };
        }

        private List<string> GenerateNextStepRecommendations(ComplianceMetrics metrics, int maturityLevel)
        {
            var recommendations = new List<string>();

            if (maturityLevel < 3)
            {
                recommendations.Add("Focus on documenting and standardizing control procedures");
                recommendations.Add("Establish regular assessment schedules");
            }
            
            if (maturityLevel < 4)
            {
                recommendations.Add("Implement quantitative measurement and monitoring");
                recommendations.Add("Establish compliance metrics and KPIs");
            }
            
            if (metrics.NonCompliantControls > 0)
            {
                recommendations.Add($"Address {metrics.NonCompliantControls} non-compliant controls immediately");
            }

            return recommendations;
        }

        private string GetComplianceStatus(decimal percentage)
        {
            return percentage switch
            {
                >= 90 => "Excellent",
                >= 75 => "Good",
                >= 50 => "Fair",
                >= 25 => "Poor",
                _ => "Critical"
            };
        }
    }
}