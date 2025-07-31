using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Services;
using CyberRiskApp.ViewModels;
using CyberRiskApp.Authorization;
using CyberRiskApp.Extensions;
using CyberRiskApp.Models;
using System.Linq;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireAnyRole)]
    public class GovernanceController : Controller
    {
        private readonly IGovernanceService _governanceService;
        private readonly IMaturityService _maturityService;

        public GovernanceController(IGovernanceService governanceService, IMaturityService maturityService)
        {
            _governanceService = governanceService;
            _maturityService = maturityService;
        }

        // GET: Governance Dashboard
        public async Task<IActionResult> Index()
        {
            // Get compliance data
            var complianceStats = await _governanceService.GetGovernanceDashboardStatsAsync();
            var recentComplianceAssessments = await _governanceService.GetRecentAssessmentsAsync(5);
            var upcomingDeadlines = await _governanceService.GetUpcomingDeadlinesAsync(30);
            var activeComplianceFrameworks = (await _governanceService.GetAllFrameworksAsync())
                .Where(f => f.Status == Models.FrameworkStatus.Active);

            // Get maturity data
            var maturityAssessments = await _maturityService.GetAllAssessmentsAsync();
            var recentMaturityAssessments = maturityAssessments
                .OrderByDescending(a => a.CreatedAt)
                .Take(5)
                .ToList();
            var activeMaturityFrameworks = (await _maturityService.GetAllFrameworksAsync())
                .Where(f => f.Status == Models.FrameworkStatus.Active);

            // Enhanced stats combining compliance and maturity data
            var enhancedStats = new Dictionary<string, object>(complianceStats)
            {
                ["TotalMaturityFrameworks"] = activeMaturityFrameworks.Count(),
                ["ActiveMaturityAssessments"] = maturityAssessments.Count(a => a.Status == Models.AssessmentStatus.InProgress),
                ["CompletedMaturityAssessments"] = maturityAssessments.Count(a => a.Status == Models.AssessmentStatus.Completed),
                ["AverageMaturityLevel"] = maturityAssessments.Any() ? 
                    Math.Round(maturityAssessments.Average(a => a.GetActualMaturityLevel()), 1) : 0,
                ["ComplianceInProgress"] = recentComplianceAssessments.Count(a => a.Status == Models.AssessmentStatus.InProgress),
                ["ComplianceCompleted"] = recentComplianceAssessments.Count(a => a.Status == Models.AssessmentStatus.Completed),
                ["MaturityInProgress"] = maturityAssessments.Count(a => a.Status == Models.AssessmentStatus.InProgress),
                ["MaturityCompleted"] = maturityAssessments.Count(a => a.Status == Models.AssessmentStatus.Completed)
            };

            var model = new GovernanceDashboardViewModel
            {
                Stats = enhancedStats,
                RecentAssessments = recentComplianceAssessments,
                UpcomingDeadlines = upcomingDeadlines,
                ActiveFrameworks = activeComplianceFrameworks.Take(5),
                RecentMaturityAssessments = recentMaturityAssessments,
                ActiveMaturityFrameworks = activeMaturityFrameworks.Take(5),
                ComplianceAssessments = recentComplianceAssessments.ToList(),
                MaturityAssessments = maturityAssessments.ToList()
            };

            return View(model);
        }

        // GET: Assessment Dashboard
        public async Task<IActionResult> AssessmentDashboard()
        {
            var viewModel = new AssessmentDashboardViewModel();
            
            // Get all maturity assessments
            var maturityAssessments = await _maturityService.GetAllAssessmentsAsync();
            var maturityFrameworks = await _maturityService.GetAllFrameworksAsync();
            
            // Get all compliance assessments
            var complianceAssessments = await _governanceService.GetAllAssessmentsAsync();
            var complianceFrameworks = await _governanceService.GetAllFrameworksAsync();
            
            // Convert maturity assessments to cards
            foreach (var assessment in maturityAssessments)
            {
                var framework = maturityFrameworks.FirstOrDefault(f => f.Id == assessment.MaturityFrameworkId);
                var controlAssessments = await _maturityService.GetControlAssessmentsByAssessmentIdAsync(assessment.Id);
                var totalControls = controlAssessments.Count();
                var assessedControls = controlAssessments.Count(ca => ca.CurrentMaturityLevel != MaturityLevel.NotImplemented);
                
                viewModel.Assessments.Add(new AssessmentCardViewModel
                {
                    Id = assessment.Id,
                    Title = assessment.Title,
                    Description = assessment.Description,
                    AssessmentType = "Maturity",
                    FrameworkName = framework?.Name ?? "Unknown",
                    FrameworkVersion = framework?.Version ?? "",
                    Status = assessment.Status,
                    StartDate = assessment.StartDate,
                    CompletedDate = assessment.CompletedDate,
                    Assessor = assessment.Assessor,
                    Progress = totalControls > 0 ? (double)assessedControls / totalControls * 100 : 0,
                    TotalControls = totalControls,
                    AssessedControls = assessedControls,
                    CurrentMaturityLevel = (double)assessment.OverallMaturityScore,
                    TargetMaturityLevel = controlAssessments.Any() ? (double)controlAssessments.Average(ca => (int)(ca.TargetMaturityLevel)) : 0
                });
            }
            
            // Convert compliance assessments to cards
            foreach (var assessment in complianceAssessments)
            {
                var framework = complianceFrameworks.FirstOrDefault(f => f.Id == assessment.ComplianceFrameworkId);
                var controlAssessments = await _governanceService.GetControlAssessmentsByAssessmentIdAsync(assessment.Id);
                var totalControls = controlAssessments.Count();
                var assessedControls = controlAssessments.Count(ca => ca.Status != ComplianceStatus.NonCompliant || !string.IsNullOrEmpty(ca.EvidenceOfCompliance));
                var compliantControls = controlAssessments.Count(ca => ca.Status == ComplianceStatus.FullyCompliant);
                
                viewModel.Assessments.Add(new AssessmentCardViewModel
                {
                    Id = assessment.Id,
                    Title = assessment.Title,
                    Description = assessment.Description,
                    AssessmentType = "Compliance",
                    FrameworkName = framework?.Name ?? "Unknown",
                    FrameworkVersion = framework?.Version ?? "",
                    Status = assessment.Status,
                    StartDate = assessment.StartDate,
                    CompletedDate = assessment.CompletedDate,
                    Assessor = assessment.Assessor,
                    Progress = totalControls > 0 ? (double)assessedControls / totalControls * 100 : 0,
                    TotalControls = totalControls,
                    AssessedControls = assessedControls,
                    CompliancePercentage = totalControls > 0 ? (double)compliantControls / totalControls * 100 : 0
                });
            }
            
            // Sort by start date descending
            viewModel.Assessments = viewModel.Assessments.OrderByDescending(a => a.StartDate).ToList();
            
            // Calculate summary stats
            viewModel.TotalAssessments = viewModel.Assessments.Count;
            viewModel.InProgressAssessments = viewModel.Assessments.Count(a => a.Status == AssessmentStatus.InProgress);
            viewModel.CompletedAssessments = viewModel.Assessments.Count(a => a.Status == AssessmentStatus.Completed);
            
            return View(viewModel);
        }

        // GET: Assessment Details
        public async Task<IActionResult> AssessmentDetails(int id, string type)
        {
            var viewModel = new AssessmentDetailsViewModel();
            
            if (type.ToLower() == "maturity")
            {
                var assessment = await _maturityService.GetAssessmentByIdAsync(id);
                if (assessment == null)
                    return NotFound();
                    
                var framework = await _maturityService.GetFrameworkByIdAsync(assessment.MaturityFrameworkId);
                var controlAssessments = await _maturityService.GetControlAssessmentsByAssessmentIdAsync(id);
                
                viewModel.Id = assessment.Id;
                viewModel.Title = assessment.Title;
                viewModel.Description = assessment.Description;
                viewModel.AssessmentType = "Maturity";
                viewModel.FrameworkName = framework?.Name ?? "Unknown";
                viewModel.FrameworkVersion = framework?.Version ?? "";
                viewModel.Status = assessment.Status;
                viewModel.StartDate = assessment.StartDate;
                viewModel.CompletedDate = assessment.CompletedDate;
                viewModel.Assessor = assessment.Assessor;
                viewModel.TotalControls = controlAssessments.Count();
                viewModel.AssessedControls = controlAssessments.Count(ca => ca.CurrentMaturityLevel != MaturityLevel.NotImplemented);
                viewModel.Progress = viewModel.TotalControls > 0 ? 
                    (double)viewModel.AssessedControls / viewModel.TotalControls * 100 : 0;
                viewModel.OverallCurrentMaturity = (double)assessment.OverallMaturityScore;
                viewModel.OverallTargetMaturity = controlAssessments.Any() ? (double)controlAssessments.Average(ca => (int)(ca.TargetMaturityLevel)) : 0;
                
                // For NIST CSF 2.0, prepare function-based data for spider chart
                if (framework?.Type == FrameworkType.NISTCSF)
                {
                    viewModel.FunctionMaturityData = controlAssessments
                        .GroupBy(ca => ca.Control.Function)
                        .Select(g => new FunctionMaturityData
                        {
                            FunctionName = g.Key,
                            CurrentMaturity = g.Where(ca => ca.CurrentMaturityLevel != MaturityLevel.NotImplemented)
                                .Average(ca => (int)ca.CurrentMaturityLevel),
                            TargetMaturity = g.Average(ca => (int)ca.TargetMaturityLevel),
                            ControlCount = g.Count()
                        })
                        .OrderBy(f => f.FunctionName)
                        .ToList();
                }
                // For C2M2, prepare domain-based data for bar chart
                else if (framework?.Type == FrameworkType.C2M2)
                {
                    // C2M2 uses the Function field to store domains
                    viewModel.FunctionMaturityData = controlAssessments
                        .GroupBy(ca => ca.Control.Function) // Function field stores domain for C2M2
                        .Select(g => new FunctionMaturityData
                        {
                            FunctionName = g.Key,
                            CurrentMaturity = g.Where(ca => ca.CurrentMaturityLevel != MaturityLevel.NotImplemented)
                                .DefaultIfEmpty()
                                .Average(ca => ca != null ? (int)ca.CurrentMaturityLevel : 0),
                            TargetMaturity = g.Average(ca => (int)ca.TargetMaturityLevel),
                            ControlCount = g.Count()
                        })
                        .OrderBy(f => GetC2M2DomainOrder(f.FunctionName))
                        .ToList();
                }
                
                // Add control details
                viewModel.ControlAssessments = controlAssessments.Select(ca => new ControlAssessmentDetail
                {
                    Id = ca.Id,
                    ControlId = ca.Control.ControlId,
                    Title = ca.Control.Title,
                    Description = ca.Control.Description,
                    Category = ca.Control.Function,
                    CurrentMaturityLevel = (int)ca.CurrentMaturityLevel,
                    TargetMaturityLevel = (int)ca.TargetMaturityLevel,
                    Notes = ca.GapNotes,
                    Findings = ca.RecommendedActions,
                    AssessmentDate = ca.UpdatedAt
                }).ToList();
            }
            else if (type.ToLower() == "compliance")
            {
                var assessment = await _governanceService.GetAssessmentByIdAsync(id);
                if (assessment == null)
                    return NotFound();
                    
                var framework = await _governanceService.GetFrameworkByIdAsync(assessment.ComplianceFrameworkId);
                var controlAssessments = await _governanceService.GetControlAssessmentsByAssessmentIdAsync(id);
                
                viewModel.Id = assessment.Id;
                viewModel.Title = assessment.Title;
                viewModel.Description = assessment.Description;
                viewModel.AssessmentType = "Compliance";
                viewModel.FrameworkName = framework?.Name ?? "Unknown";
                viewModel.FrameworkVersion = framework?.Version ?? "";
                viewModel.Status = assessment.Status;
                viewModel.StartDate = assessment.StartDate;
                viewModel.CompletedDate = assessment.CompletedDate;
                viewModel.Assessor = assessment.Assessor;
                viewModel.TotalControls = controlAssessments.Count();
                viewModel.AssessedControls = controlAssessments.Count(ca => ca.Status != ComplianceStatus.NonCompliant || !string.IsNullOrEmpty(ca.EvidenceOfCompliance));
                viewModel.Progress = viewModel.TotalControls > 0 ? 
                    (double)viewModel.AssessedControls / viewModel.TotalControls * 100 : 0;
                
                var compliantControls = controlAssessments.Count(ca => ca.Status == ComplianceStatus.FullyCompliant);
                viewModel.OverallCompliancePercentage = viewModel.TotalControls > 0 ? 
                    (double)compliantControls / viewModel.TotalControls * 100 : 0;
                
                // Category-based compliance stats
                viewModel.CategoryStats = controlAssessments
                    .GroupBy(ca => ca.Control.Category)
                    .ToDictionary(
                        g => g.Key,
                        g => new ComplianceCategoryStats
                        {
                            CategoryName = g.Key,
                            TotalControls = g.Count(),
                            CompliantControls = g.Count(ca => ca.Status == ComplianceStatus.FullyCompliant),
                            NonCompliantControls = g.Count(ca => ca.Status == ComplianceStatus.NonCompliant),
                            PartiallyCompliantControls = g.Count(ca => 
                                ca.Status == ComplianceStatus.PartiallyCompliant || 
                                ca.Status == ComplianceStatus.MajorlyCompliant),
                            CompliancePercentage = g.Count() > 0 ? 
                                (double)g.Count(ca => ca.Status == ComplianceStatus.FullyCompliant) / g.Count() * 100 : 0
                        }
                    );
                
                // Add control details
                viewModel.ControlAssessments = controlAssessments.Select(ca => new ControlAssessmentDetail
                {
                    Id = ca.Id,
                    ControlId = ca.Control.ControlId,
                    Title = ca.Control.Title,
                    Description = ca.Control.Description,
                    Category = ca.Control.Category,
                    ComplianceStatus = ca.Status,
                    Notes = ca.GapNotes,
                    Findings = ca.EvidenceOfCompliance,
                    AssessmentDate = ca.UpdatedAt
                }).ToList();
            }
            else
            {
                return BadRequest("Invalid assessment type");
            }
            
            return View(viewModel);
        }

        // Helper method to order C2M2 domains logically
        private int GetC2M2DomainOrder(string domain)
        {
            return domain?.ToUpper() switch
            {
                "ASSET" => 1,
                "THREAT" => 2,
                "RISK" => 3,
                "ACCESS" => 4,
                "SITUATION" => 5,
                "RESPONSE" => 6,
                "THIRD-PARTIES" => 7,
                "WORKFORCE" => 8,
                "ARCHITECTURE" => 9,
                "PROGRAM" => 10,
                _ => 99
            };
        }
    }
}