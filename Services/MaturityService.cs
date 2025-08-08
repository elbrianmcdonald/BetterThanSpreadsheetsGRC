using CyberRiskApp.Data;
using CyberRiskApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Services
{
    public class MaturityService : IMaturityService
    {
        private readonly CyberRiskContext _context;

        public MaturityService(CyberRiskContext context)
        {
            _context = context;
        }

        // Maturity Framework methods
        public async Task<IEnumerable<MaturityFramework>> GetAllFrameworksAsync()
        {
            return await _context.MaturityFrameworks
                .Include(f => f.Controls)
                .Include(f => f.Assessments)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();
        }

        public async Task<MaturityFramework?> GetFrameworkByIdAsync(int id)
        {
            return await _context.MaturityFrameworks
                .Include(f => f.Controls)
                .Include(f => f.Assessments)
                    .ThenInclude(a => a.Organization)
                .FirstOrDefaultAsync(f => f.Id == id);
        }

        public async Task<MaturityFramework> CreateFrameworkAsync(MaturityFramework framework)
        {
            framework.CreatedAt = DateTime.UtcNow;
            framework.UpdatedAt = DateTime.UtcNow;
            framework.UploadedDate = DateTime.UtcNow;

            _context.MaturityFrameworks.Add(framework);
            await _context.SaveChangesAsync();
            return framework;
        }

        public async Task<MaturityFramework> UpdateFrameworkAsync(MaturityFramework framework)
        {
            framework.UpdatedAt = DateTime.UtcNow;
            _context.MaturityFrameworks.Update(framework);
            await _context.SaveChangesAsync();
            return framework;
        }

        public async Task<bool> DeleteFrameworkAsync(int id)
        {
            var framework = await _context.MaturityFrameworks.FindAsync(id);
            if (framework == null)
                return false;

            _context.MaturityFrameworks.Remove(framework);
            await _context.SaveChangesAsync();
            return true;
        }

        // Maturity Assessment methods
        public async Task<IEnumerable<MaturityAssessment>> GetAllAssessmentsAsync()
        {
            return await _context.MaturityAssessments
                .Include(a => a.Framework)
                .Include(a => a.Organization)
                .Include(a => a.ControlAssessments)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();
        }

        public async Task<MaturityAssessment?> GetAssessmentByIdAsync(int id)
        {
            return await _context.MaturityAssessments
                .Include(a => a.Framework)
                .Include(a => a.Organization)
                .Include(a => a.ControlAssessments)
                    .ThenInclude(ca => ca.Control)
                .FirstOrDefaultAsync(a => a.Id == id);
        }

        public async Task<MaturityAssessment> CreateAssessmentAsync(MaturityAssessment assessment)
        {
            assessment.CreatedAt = DateTime.UtcNow;
            assessment.UpdatedAt = DateTime.UtcNow;

            _context.MaturityAssessments.Add(assessment);
            await _context.SaveChangesAsync();

            // Create control assessments for all controls in the framework
            await CreateControlAssessmentsForFrameworkAsync(assessment.Id, assessment.MaturityFrameworkId);

            return assessment;
        }

        public async Task<MaturityAssessment> UpdateAssessmentAsync(MaturityAssessment assessment)
        {
            assessment.UpdatedAt = DateTime.UtcNow;
            _context.MaturityAssessments.Update(assessment);
            await _context.SaveChangesAsync();
            return assessment;
        }

        public async Task<bool> DeleteAssessmentAsync(int id)
        {
            var assessment = await _context.MaturityAssessments.FindAsync(id);
            if (assessment == null)
                return false;

            _context.MaturityAssessments.Remove(assessment);
            await _context.SaveChangesAsync();
            return true;
        }

        // Maturity Control Assessment methods
        public async Task<MaturityControlAssessment?> GetControlAssessmentByIdAsync(int id)
        {
            return await _context.MaturityControlAssessments
                .Include(ca => ca.Control)
                .Include(ca => ca.Assessment)
                .FirstOrDefaultAsync(ca => ca.Id == id);
        }

        public async Task<MaturityControlAssessment> UpdateControlAssessmentAsync(MaturityControlAssessment controlAssessment)
        {
            controlAssessment.UpdatedAt = DateTime.UtcNow;

            _context.MaturityControlAssessments.Update(controlAssessment);
            await _context.SaveChangesAsync();

            // Recalculate overall maturity score for the assessment
            await RecalculateAssessmentScoreAsync(controlAssessment.MaturityAssessmentId);

            return controlAssessment;
        }

        public async Task<IEnumerable<MaturityControlAssessment>> GetControlAssessmentsByAssessmentIdAsync(int assessmentId)
        {
            return await _context.MaturityControlAssessments
                .Include(ca => ca.Control)
                .Include(ca => ca.Assessment)
                .Where(ca => ca.MaturityAssessmentId == assessmentId && ca.Control != null)
                .OrderBy(ca => ca.Control.Function)
                .ThenBy(ca => ca.Control.ControlId)
                .ToListAsync();
        }

        // Maturity Control methods
        public async Task<MaturityControl?> GetControlByIdAsync(int id)
        {
            return await _context.MaturityControls
                .Include(c => c.Framework)
                .FirstOrDefaultAsync(c => c.Id == id);
        }

        public async Task<MaturityControl> UpdateControlAsync(MaturityControl control)
        {
            _context.MaturityControls.Update(control);
            await _context.SaveChangesAsync();
            return control;
        }

        public async Task<bool> UpdateControlPriorityAsync(int controlId, ControlPriority priority)
        {
            try
            {
                var control = await _context.MaturityControls.FindAsync(controlId);
                if (control == null)
                    return false;

                control.Priority = priority;
                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<IEnumerable<MaturityControl>> GetControlsByFrameworkIdAsync(int frameworkId)
        {
            return await _context.MaturityControls
                .Where(c => c.MaturityFrameworkId == frameworkId)
                .OrderBy(c => c.Function)
                .ThenBy(c => c.ControlId)
                .ToListAsync();
        }

        // NEW: Enhanced Priority Management Methods
        public async Task<int> BulkUpdateControlPrioritiesAsync(int frameworkId, Dictionary<int, ControlPriority> priorities)
        {
            var updatedCount = 0;

            try
            {
                var controls = await _context.MaturityControls
                    .Where(c => c.MaturityFrameworkId == frameworkId && priorities.Keys.Contains(c.Id))
                    .ToListAsync();

                foreach (var control in controls)
                {
                    if (priorities.TryGetValue(control.Id, out var newPriority))
                    {
                        control.Priority = newPriority;
                        updatedCount++;
                    }
                }

                await _context.SaveChangesAsync();
                return updatedCount;
            }
            catch
            {
                return updatedCount;
            }
        }

        public async Task<Dictionary<string, object>> GetFrameworkControlStatsAsync(int frameworkId)
        {
            var controls = await _context.MaturityControls
                .Where(c => c.MaturityFrameworkId == frameworkId)
                .ToListAsync();

            var stats = new Dictionary<string, object>
            {
                ["TotalControls"] = controls.Count,
                ["PriorityDistribution"] = controls.GroupBy(c => c.Priority)
                    .ToDictionary(g => g.Key.ToString(), g => g.Count()),
                ["DomainDistribution"] = controls.GroupBy(c => c.Function)
                    .ToDictionary(g => g.Key, g => g.Count())
            };

            return stats;
        }

        public async Task<IEnumerable<MaturityControl>> SearchControlsAsync(int frameworkId, string searchTerm, ControlPriority? priority = null, string domain = null)
        {
            var query = _context.MaturityControls.Where(c => c.MaturityFrameworkId == frameworkId);

            if (!string.IsNullOrEmpty(searchTerm))
            {
                var lowerSearchTerm = searchTerm.ToLower();
                query = query.Where(c => c.ControlId.ToLower().Contains(lowerSearchTerm) ||
                                        c.Title.ToLower().Contains(lowerSearchTerm) ||
                                        c.Description.ToLower().Contains(lowerSearchTerm));
            }

            if (priority.HasValue)
            {
                query = query.Where(c => c.Priority == priority.Value);
            }

            if (!string.IsNullOrEmpty(domain))
            {
                query = query.Where(c => c.Function == domain);
            }

            return await query.OrderBy(c => c.Function).ThenBy(c => c.ControlId).ToListAsync();
        }

        // Dashboard statistics
        public async Task<Dictionary<string, object>> GetMaturityDashboardStatsAsync()
        {
            var stats = new Dictionary<string, object>();

            var totalFrameworks = await _context.MaturityFrameworks.CountAsync();
            var totalAssessments = await _context.MaturityAssessments.CountAsync();
            var activeFrameworks = await _context.MaturityFrameworks
                .CountAsync(f => f.Status == FrameworkStatus.Active);
            var completedAssessments = await _context.MaturityAssessments
                .Where(a => a.Status == AssessmentStatus.Completed)
                .ToListAsync();

            stats["TotalFrameworks"] = totalFrameworks;
            stats["TotalAssessments"] = totalAssessments;
            stats["ActiveFrameworks"] = activeFrameworks;
            stats["CompletedAssessments"] = completedAssessments.Count;

            if (completedAssessments.Any())
            {
                stats["AverageMaturityScore"] = completedAssessments.Average(a => a.OverallMaturityScore);
            }
            else
            {
                stats["AverageMaturityScore"] = 0;
            }

            return stats;
        }

        public async Task<IEnumerable<MaturityAssessment>> GetRecentAssessmentsAsync(int count = 5)
        {
            return await _context.MaturityAssessments
                .Include(a => a.Framework)
                .Include(a => a.Organization)
                .OrderByDescending(a => a.CreatedAt)
                .Take(count)
                .ToListAsync();
        }

        public async Task<IEnumerable<MaturityAssessment>> GetUpcomingDeadlinesAsync(int days = 30)
        {
            var cutoffDate = DateTime.UtcNow.AddDays(days);

            return await _context.MaturityAssessments
                .Include(a => a.Framework)
                .Include(a => a.Organization)
                .Where(a => a.DueDate.HasValue &&
                           a.DueDate.Value <= cutoffDate &&
                           a.Status != AssessmentStatus.Completed)
                .OrderBy(a => a.DueDate)
                .ToListAsync();
        }

        // Excel Upload Support
        public async Task AddControlsToFrameworkAsync(int frameworkId, List<MaturityControl> controls)
        {
            foreach (var control in controls)
            {
                control.MaturityFrameworkId = frameworkId;
            }

            _context.MaturityControls.AddRange(controls);
            await _context.SaveChangesAsync();
        }

        // Maturity Score Calculation - Framework Agnostic
        public async Task<decimal> CalculateOverallMaturityScoreAsync(int assessmentId)
        {
            var assessment = await _context.MaturityAssessments
                .Include(a => a.Framework)
                .FirstOrDefaultAsync(a => a.Id == assessmentId);

            if (assessment?.Framework == null)
                return 0;

            decimal overallScore;

            if (assessment.Framework.Type == FrameworkType.C2M2)
            {
                // Use C2M2 objective-based scoring
                overallScore = await CalculateC2M2OverallScoreAsync(assessmentId);
            }
            else
            {
                // Use standard average scoring for other frameworks
                overallScore = await CalculateStandardOverallScoreAsync(assessmentId);
            }

            // Update the assessment's overall score
            assessment.OverallMaturityScore = overallScore;
            await _context.SaveChangesAsync();

            return overallScore;
        }

        public async Task<Dictionary<string, decimal>> GetMaturityScoresByFunctionAsync(int assessmentId)
        {
            var controlAssessments = await _context.MaturityControlAssessments
                .Include(ca => ca.Control)
                .Where(ca => ca.MaturityAssessmentId == assessmentId && ca.Control != null)
                .ToListAsync();

            return controlAssessments
                .GroupBy(ca => ca.Control.Function)
                .ToDictionary(
                    g => g.Key,
                    g => g.Average(ca => (decimal)(int)ca.CurrentMaturityLevel)
                );
        }

        public async Task<Dictionary<string, decimal>> GetMaturityScoresByDomainAsync(int assessmentId)
        {
            // For C2M2, domains are stored in the Function field
            return await GetMaturityScoresByFunctionAsync(assessmentId);
        }

        // C2M2-Specific Methods
        public async Task<Dictionary<string, Dictionary<string, int>>> GetC2M2ObjectiveScoresAsync(int assessmentId)
        {
            var controlAssessments = await _context.MaturityControlAssessments
                .Include(ca => ca.Control)
                .Where(ca => ca.MaturityAssessmentId == assessmentId && ca.Control != null)
                .ToListAsync();

            var objectiveScores = new Dictionary<string, Dictionary<string, int>>();

            var domainGroups = controlAssessments.GroupBy(ca => ca.Control.Function);

            foreach (var domainGroup in domainGroups)
            {
                var domain = domainGroup.Key;
                var domainPractices = domainGroup.ToList();

                var objectives = domainPractices
                    .GroupBy(ca => ExtractC2M2Objective(ca.Control.ControlId))
                    .ToDictionary(
                        g => g.Key,
                        g => CalculateC2M2ObjectiveScore(g.ToList())
                    );

                objectiveScores[domain] = objectives;
            }

            return objectiveScores;
        }

        public async Task<Dictionary<string, List<string>>> GetC2M2InstitutionalizationGapsAsync(int assessmentId)
        {
            var controlAssessments = await _context.MaturityControlAssessments
                .Include(ca => ca.Control)
                .Where(ca => ca.MaturityAssessmentId == assessmentId && ca.Control != null)
                .ToListAsync();

            var gaps = new Dictionary<string, List<string>>();

            var domainGroups = controlAssessments.GroupBy(ca => ca.Control.Function);

            foreach (var domainGroup in domainGroups)
            {
                var domain = domainGroup.Key;
                var domainGaps = domainGroup
                    .Where(ca => ca.CurrentMaturityLevel < ca.TargetMaturityLevel)
                    .Select(ca => ca.Control.ControlId)
                    .ToList();

                if (domainGaps.Any())
                {
                    gaps[domain] = domainGaps;
                }
            }

            return gaps;
        }

        // Private helper methods
        private async Task CreateControlAssessmentsForFrameworkAsync(int assessmentId, int frameworkId)
        {
            var controls = await _context.MaturityControls
                .Where(c => c.MaturityFrameworkId == frameworkId)
                .ToListAsync();

            var controlAssessments = controls.Select(control => new MaturityControlAssessment
            {
                MaturityControlId = control.Id,
                MaturityAssessmentId = assessmentId,
                CurrentMaturityLevel = MaturityLevel.NotImplemented,
                TargetMaturityLevel = MaturityLevel.Initial,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }).ToList();

            _context.MaturityControlAssessments.AddRange(controlAssessments);
            await _context.SaveChangesAsync();
        }

        private async Task RecalculateAssessmentScoreAsync(int assessmentId)
        {
            var overallScore = await CalculateOverallMaturityScoreAsync(assessmentId);

            var assessment = await _context.MaturityAssessments.FindAsync(assessmentId);
            if (assessment != null)
            {
                assessment.OverallMaturityScore = overallScore;
                assessment.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }

        private async Task<decimal> CalculateStandardOverallScoreAsync(int assessmentId)
        {
            var controlAssessments = await _context.MaturityControlAssessments
                .Where(ca => ca.MaturityAssessmentId == assessmentId)
                .ToListAsync();

            if (!controlAssessments.Any())
                return 0;

            var totalScore = controlAssessments.Sum(ca => (int)ca.CurrentMaturityLevel);
            var maxPossibleScore = controlAssessments.Count * (int)MaturityLevel.Managed; // 4 is highest

            return maxPossibleScore > 0 ? (decimal)totalScore / maxPossibleScore * 100 : 0;
        }

        private async Task<decimal> CalculateC2M2OverallScoreAsync(int assessmentId)
        {
            var controlAssessments = await _context.MaturityControlAssessments
                .Include(ca => ca.Control)
                .Where(ca => ca.MaturityAssessmentId == assessmentId && ca.Control != null)
                .ToListAsync();

            if (!controlAssessments.Any())
                return 0;

            // C2M2 scoring: Calculate MIL achievement by domain
            var domainScores = new List<decimal>();

            var domainGroups = controlAssessments.GroupBy(ca => ca.Control.Function);

            foreach (var domainGroup in domainGroups)
            {
                var domainScore = CalculateC2M2DomainScore(domainGroup.ToList());
                domainScores.Add(domainScore);
            }

            return domainScores.Any() ? domainScores.Average() : 0;
        }

        private decimal CalculateC2M2DomainScore(List<MaturityControlAssessment> domainPractices)
        {
            if (!domainPractices.Any())
                return 0;

            // Group practices by MIL level (stored in Category field for C2M2)
            var practicesByMIL = domainPractices
                .Where(p => p.Control != null)
                .GroupBy(p => ExtractMILNumber(p.Control.Category))
                .Where(g => g.Key > 0) // Exclude invalid MIL levels
                .OrderBy(g => g.Key)
                .ToList();

            // To achieve a MIL level, ALL practices at that level and below must be performed
            var achievedMIL = 0; // Start with MIL0

            foreach (var milGroup in practicesByMIL)
            {
                var milLevel = milGroup.Key;
                var milPractices = milGroup.ToList();

                // Check if ALL practices at this MIL level are implemented
                var allPracticesImplemented = milPractices.All(practice =>
                    (int)practice.CurrentMaturityLevel >= milLevel);

                if (allPracticesImplemented)
                {
                    achievedMIL = milLevel;
                }
                else
                {
                    // If any practice at this level is not implemented, we can't achieve this MIL
                    break;
                }
            }

            // Convert achieved MIL to percentage (MIL 3 = 100%, MIL 2 = 67%, MIL 1 = 33%)
            return achievedMIL switch
            {
                3 => 100m,
                2 => 67m,
                1 => 33m,
                _ => 0m
            };
        }

        private int CalculateC2M2ObjectiveScore(List<MaturityControlAssessment> objectivePractices)
        {
            if (!objectivePractices.Any())
                return 0;

            // Group practices by MIL level
            var practicesByMIL = objectivePractices
                .Where(p => p.Control != null)
                .GroupBy(p => ExtractMILNumber(p.Control.Category))
                .Where(g => g.Key > 0)
                .OrderBy(g => g.Key)
                .ToList();

            var achievedMIL = 0;

            foreach (var milGroup in practicesByMIL)
            {
                var milLevel = milGroup.Key;
                var milPractices = milGroup.ToList();

                var allPracticesImplemented = milPractices.All(practice =>
                    (int)practice.CurrentMaturityLevel >= milLevel);

                if (allPracticesImplemented)
                {
                    achievedMIL = milLevel;
                }
                else
                {
                    break;
                }
            }

            return achievedMIL;
        }

        private string ExtractC2M2Objective(string practiceId)
        {
            // Extract objective from practice ID
            // Example: "ASSET-1a" -> "ASSET-1", "THREAT-2b" -> "THREAT-2"
            if (string.IsNullOrEmpty(practiceId))
                return string.Empty;

            var lastCharIndex = practiceId.Length - 1;
            if (lastCharIndex >= 0 && char.IsLetter(practiceId[lastCharIndex]))
            {
                return practiceId.Substring(0, lastCharIndex);
            }

            return practiceId;
        }

        private int ExtractMILNumber(string milString)
        {
            // Extract MIL number from strings like "1", "2", "3" or "MIL1", "MIL2", "MIL3"
            if (string.IsNullOrEmpty(milString))
                return 0;

            // Remove "MIL" prefix if present and parse number
            var milNumber = milString.Replace("MIL", "").Trim();

            if (int.TryParse(milNumber, out var result))
                return result;

            return 0;
        }

        public async Task BulkUpdateControlAssessmentsAsync(List<MaturityControlAssessment> controlAssessments)
        {
            if (!controlAssessments.Any()) return;

            var executionStrategy = _context.Database.CreateExecutionStrategy();
            await executionStrategy.ExecuteAsync(async () =>
            {
                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    foreach (var controlAssessment in controlAssessments)
                    {
                        // Check if assessment already exists
                        var existing = await _context.MaturityControlAssessments
                            .FirstOrDefaultAsync(ca => ca.MaturityAssessmentId == controlAssessment.MaturityAssessmentId 
                                                     && ca.MaturityControlId == controlAssessment.MaturityControlId);

                        if (existing != null)
                        {
                            // Update existing - FIXED property names
                            existing.CurrentMaturityLevel = controlAssessment.CurrentMaturityLevel;
                            existing.TargetMaturityLevel = controlAssessment.TargetMaturityLevel;
                            // Priority is on the Control, not the assessment
                            existing.AssessmentDate = controlAssessment.AssessmentDate;
                            _context.MaturityControlAssessments.Update(existing);
                        }
                        else
                        {
                            // Add new
                            _context.MaturityControlAssessments.Add(controlAssessment);
                        }
                    }

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            });
        }
    }
}