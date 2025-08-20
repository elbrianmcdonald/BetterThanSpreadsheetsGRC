using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Repositories
{
    /// <summary>
    /// Repository implementation for ComplianceAssessment entities
    /// </summary>
    public class ComplianceAssessmentRepository : Repository<ComplianceAssessment>, IComplianceAssessmentRepository
    {
        public ComplianceAssessmentRepository(CyberRiskContext context) : base(context)
        {
        }

        // Compliance assessment queries
        public async Task<IEnumerable<ComplianceAssessment>> GetAssessmentsByStatusAsync(AssessmentStatus status)
        {
            return await _dbSet
                .Include(a => a.Framework)
                .Include(a => a.Organization)
                .Where(a => a.Status == status)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<ComplianceAssessment>> GetAssessmentsByFrameworkAsync(int frameworkId)
        {
            return await _dbSet
                .Include(a => a.Framework)
                .Include(a => a.Organization)
                .Where(a => a.ComplianceFrameworkId == frameworkId)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<ComplianceAssessment>> GetAssessmentsByOrganizationAsync(int organizationId)
        {
            return await _dbSet
                .Include(a => a.Framework)
                .Include(a => a.Organization)
                .Where(a => a.BusinessOrganizationId == organizationId)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<ComplianceAssessment>> GetAssessmentsByAssessorAsync(string assessor)
        {
            return await _dbSet
                .Include(a => a.Framework)
                .Include(a => a.Organization)
                .Where(a => a.Assessor == assessor)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<ComplianceAssessment>> GetAssessmentsWithControlsAsync()
        {
            return await _dbSet
                .Include(a => a.Framework)
                .Include(a => a.Organization)
                .Include(a => a.ControlAssessments)
                    .ThenInclude(ca => ca.Control)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();
        }

        public async Task<ComplianceAssessment?> GetAssessmentWithControlsAsync(int assessmentId)
        {
            return await _dbSet
                .Include(a => a.Framework)
                .Include(a => a.Organization)
                .Include(a => a.ControlAssessments)
                    .ThenInclude(ca => ca.Control)
                .FirstOrDefaultAsync(a => a.Id == assessmentId);
        }

        // Status-based queries
        public async Task<IEnumerable<ComplianceAssessment>> GetDraftAssessmentsAsync()
        {
            return await GetAssessmentsByStatusAsync(AssessmentStatus.Draft);
        }

        public async Task<IEnumerable<ComplianceAssessment>> GetInProgressAssessmentsAsync()
        {
            return await GetAssessmentsByStatusAsync(AssessmentStatus.InProgress);
        }

        public async Task<IEnumerable<ComplianceAssessment>> GetCompletedAssessmentsAsync()
        {
            return await GetAssessmentsByStatusAsync(AssessmentStatus.Completed);
        }

        public async Task<IEnumerable<ComplianceAssessment>> GetOverdueAssessmentsAsync()
        {
            return await _dbSet
                .Include(a => a.Framework)
                .Include(a => a.Organization)
                .Where(a => a.DueDate.HasValue && 
                           a.DueDate.Value < DateTime.UtcNow && 
                           a.Status != AssessmentStatus.Completed)
                .OrderBy(a => a.DueDate)
                .ToListAsync();
        }

        public async Task<IEnumerable<ComplianceAssessment>> GetRecentAssessmentsAsync(int count = 10)
        {
            return await _dbSet
                .Include(a => a.Framework)
                .Include(a => a.Organization)
                .OrderByDescending(a => a.CreatedAt)
                .Take(count)
                .ToListAsync();
        }

        // Statistical and analytics queries
        public async Task<Dictionary<AssessmentStatus, int>> GetAssessmentsCountByStatusAsync()
        {
            return await _dbSet
                .GroupBy(a => a.Status)
                .ToDictionaryAsync(g => g.Key, g => g.Count());
        }

        public async Task<Dictionary<int, int>> GetAssessmentsCountByFrameworkAsync()
        {
            return await _dbSet
                .GroupBy(a => a.ComplianceFrameworkId)
                .ToDictionaryAsync(g => g.Key, g => g.Count());
        }

        public async Task<Dictionary<string, int>> GetAssessmentsCountByAssessorAsync()
        {
            return await _dbSet
                .Where(a => !string.IsNullOrEmpty(a.Assessor))
                .GroupBy(a => a.Assessor!)
                .ToDictionaryAsync(g => g.Key, g => g.Count());
        }

        public async Task<Dictionary<int, decimal>> GetCompliancePercentagesByFrameworkAsync()
        {
            return await _dbSet
                .Where(a => a.Status == AssessmentStatus.Completed)
                .GroupBy(a => a.ComplianceFrameworkId)
                .ToDictionaryAsync(
                    g => g.Key, 
                    g => g.Average(a => a.CompliancePercentage));
        }

        public async Task<decimal> GetAverageCompliancePercentageAsync()
        {
            var assessments = await _dbSet
                .Where(a => a.Status == AssessmentStatus.Completed)
                .ToListAsync();

            return assessments.Any() ? assessments.Average(a => a.CompliancePercentage) : 0;
        }

        public async Task<decimal> GetFrameworkCompliancePercentageAsync(int frameworkId)
        {
            var assessments = await _dbSet
                .Where(a => a.ComplianceFrameworkId == frameworkId && 
                           a.Status == AssessmentStatus.Completed)
                .ToListAsync();

            return assessments.Any() ? assessments.Average(a => a.CompliancePercentage) : 0;
        }

        // Assessment lifecycle operations
        public async Task<bool> StartAssessmentAsync(int assessmentId, string userId)
        {
            var assessment = await GetByIdAsync(assessmentId);
            if (assessment == null || assessment.Status != AssessmentStatus.Draft)
                return false;

            assessment.Status = AssessmentStatus.InProgress;
            assessment.StartDate = DateTime.UtcNow;
            await UpdateAsync(assessment, userId);
            return true;
        }

        public async Task<bool> CompleteAssessmentAsync(int assessmentId, string userId)
        {
            var assessment = await GetByIdAsync(assessmentId);
            if (assessment == null || assessment.Status != AssessmentStatus.InProgress)
                return false;

            assessment.Status = AssessmentStatus.Completed;
            assessment.CompletedDate = DateTime.UtcNow;
            await UpdateAsync(assessment, userId);
            return true;
        }

        public async Task<bool> ApproveAssessmentAsync(int assessmentId, string userId)
        {
            var assessment = await GetByIdAsync(assessmentId);
            if (assessment == null || assessment.Status != AssessmentStatus.Completed)
                return false;

            assessment.Status = AssessmentStatus.Approved;
            await UpdateAsync(assessment, userId);
            return true;
        }

        public async Task<bool> UpdateCompliancePercentageAsync(int assessmentId, decimal percentage, string userId)
        {
            var assessment = await GetByIdAsync(assessmentId);
            if (assessment == null) return false;

            assessment.CompliancePercentage = percentage;
            await UpdateAsync(assessment, userId);
            return true;
        }

        public async Task<bool> AssignAssessorAsync(int assessmentId, string assessor, string userId)
        {
            var assessment = await GetByIdAsync(assessmentId);
            if (assessment == null) return false;

            assessment.Assessor = assessor;
            await UpdateAsync(assessment, userId);
            return true;
        }

        // Control assessment operations
        public async Task<IEnumerable<ControlAssessment>> GetControlAssessmentsByAssessmentIdAsync(int assessmentId)
        {
            return await _context.Set<ControlAssessment>()
                .Include(ca => ca.Control)
                .Where(ca => ca.ComplianceAssessmentId == assessmentId)
                .OrderBy(ca => ca.Control.ControlId)
                .ToListAsync();
        }

        public async Task<ControlAssessment?> GetControlAssessmentByIdAsync(int controlAssessmentId)
        {
            return await _context.Set<ControlAssessment>()
                .Include(ca => ca.Control)
                .Include(ca => ca.Assessment)
                .FirstOrDefaultAsync(ca => ca.Id == controlAssessmentId);
        }

        public async Task<bool> UpdateControlAssessmentAsync(ControlAssessment controlAssessment, string userId)
        {
            try
            {
                controlAssessment.UpdatedAt = DateTime.UtcNow;
                controlAssessment.UpdatedBy = userId;
                controlAssessment.AssessmentDate = DateTime.UtcNow;
                controlAssessment.AssessedBy = userId;
                
                _context.Set<ControlAssessment>().Update(controlAssessment);
                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<int> BulkUpdateControlAssessmentsAsync(IEnumerable<ControlAssessment> controlAssessments, string userId)
        {
            var assessmentsList = controlAssessments.ToList();
            var now = DateTime.UtcNow;
            
            foreach (var assessment in assessmentsList)
            {
                assessment.UpdatedAt = now;
                assessment.UpdatedBy = userId;
                assessment.AssessmentDate = now;
                assessment.AssessedBy = userId;
            }

            _context.Set<ControlAssessment>().UpdateRange(assessmentsList);
            await _context.SaveChangesAsync();
            return assessmentsList.Count;
        }

        // Compliance trend analysis
        public async Task<IEnumerable<ComplianceAssessment>> GetAssessmentsInDateRangeAsync(DateTime startDate, DateTime endDate)
        {
            return await _dbSet
                .Include(a => a.Framework)
                .Where(a => a.CreatedAt >= startDate && a.CreatedAt <= endDate)
                .OrderBy(a => a.CreatedAt)
                .ToListAsync();
        }

        public async Task<Dictionary<DateTime, decimal>> GetComplianceTrendDataAsync(int frameworkId, int months = 12)
        {
            var startDate = DateTime.UtcNow.AddMonths(-months);
            
            var assessments = await _dbSet
                .Where(a => a.ComplianceFrameworkId == frameworkId && 
                           a.Status == AssessmentStatus.Completed &&
                           a.CompletedDate >= startDate)
                .OrderBy(a => a.CompletedDate)
                .ToListAsync();

            return assessments
                .Where(a => a.CompletedDate.HasValue)
                .GroupBy(a => new DateTime(a.CompletedDate!.Value.Year, a.CompletedDate.Value.Month, 1))
                .ToDictionary(
                    g => g.Key,
                    g => g.Average(a => a.CompliancePercentage));
        }

        public async Task<IEnumerable<ComplianceAssessment>> GetHistoricalAssessmentsForFrameworkAsync(int frameworkId)
        {
            return await _dbSet
                .Include(a => a.Framework)
                .Include(a => a.Organization)
                .Where(a => a.ComplianceFrameworkId == frameworkId)
                .OrderBy(a => a.CompletedDate ?? a.CreatedAt)
                .ToListAsync();
        }
    }
}