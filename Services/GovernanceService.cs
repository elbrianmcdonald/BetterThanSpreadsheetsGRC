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
    }
}