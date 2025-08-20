using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CyberRiskApp.Data;
using CyberRiskApp.Models;

namespace CyberRiskApp.Controllers.Api
{
    [ApiController]
    [Route("api/risk-matrix")]
    public class RiskMatrixApiController : ControllerBase
    {
        private readonly CyberRiskContext _context;

        public RiskMatrixApiController(CyberRiskContext context)
        {
            _context = context;
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetRiskMatrix(int id)
        {
            try
            {
                var matrix = await _context.RiskMatrices
                    .FirstOrDefaultAsync(rm => rm.Id == id);

                if (matrix == null)
                {
                    return NotFound(new { error = "Risk matrix not found" });
                }

                var response = new
                {
                    id = matrix.Id,
                    name = matrix.Name,
                    description = matrix.Description,
                    matrixType = matrix.MatrixType.ToString(),
                    matrixSize = matrix.MatrixSize,
                    isDefault = matrix.IsDefault,
                    
                    // Risk Level Thresholds
                    thresholds = new
                    {
                        medium = matrix.QualitativeMediumThreshold,
                        high = matrix.QualitativeHighThreshold,
                        critical = matrix.QualitativeCriticalThreshold,
                        riskAppetite = matrix.RiskAppetiteThreshold
                    },
                    
                    // Risk Level Ranges for Display
                    ranges = new
                    {
                        low = matrix.GetLowRange(),
                        medium = matrix.GetMediumRange(),
                        high = matrix.GetHighRange(),
                        critical = matrix.GetCriticalRange()
                    },
                    
                    // SLA Hours for each risk level
                    remediationSla = new
                    {
                        critical = matrix.CriticalRiskSlaHours,
                        high = matrix.HighRiskSlaHours,
                        medium = matrix.MediumRiskSlaHours,
                        low = matrix.LowRiskSlaHours
                    },
                    
                    // Review SLA Hours
                    reviewSla = new
                    {
                        critical = matrix.CriticalRiskReviewSlaHours,
                        high = matrix.HighRiskReviewSlaHours,
                        medium = matrix.MediumRiskReviewSlaHours,
                        low = matrix.LowRiskReviewSlaHours
                    },
                    
                    // Assessment SLA Hours
                    assessmentSla = new
                    {
                        risk = matrix.RiskAssessmentSlaHours,
                        compliance = matrix.ComplianceAssessmentSlaHours,
                        maturity = matrix.MaturityAssessmentSlaHours
                    },
                    
                    // Approval SLA Hours
                    approvalSla = new
                    {
                        assessment = matrix.AssessmentApprovalSlaHours,
                        riskAcceptance = matrix.RiskAcceptanceApprovalSlaHours,
                        exceptionRequest = matrix.ExceptionRequestApprovalSlaHours
                    },
                    
                    // Helper Methods for Client-side
                    helpers = new
                    {
                        formatSlaHours = new
                        {
                            remediationSla = new
                            {
                                critical = FormatSlaHours(matrix.CriticalRiskSlaHours),
                                high = FormatSlaHours(matrix.HighRiskSlaHours),
                                medium = FormatSlaHours(matrix.MediumRiskSlaHours),
                                low = FormatSlaHours(matrix.LowRiskSlaHours)
                            },
                            reviewSla = new
                            {
                                critical = FormatSlaHours(matrix.CriticalRiskReviewSlaHours),
                                high = FormatSlaHours(matrix.HighRiskReviewSlaHours),
                                medium = FormatSlaHours(matrix.MediumRiskReviewSlaHours),
                                low = FormatSlaHours(matrix.LowRiskReviewSlaHours)
                            },
                            assessmentSla = new
                            {
                                risk = FormatSlaHours(matrix.RiskAssessmentSlaHours),
                                compliance = FormatSlaHours(matrix.ComplianceAssessmentSlaHours),
                                maturity = FormatSlaHours(matrix.MaturityAssessmentSlaHours)
                            },
                            approvalSla = new
                            {
                                assessment = FormatSlaHours(matrix.AssessmentApprovalSlaHours),
                                riskAcceptance = FormatSlaHours(matrix.RiskAcceptanceApprovalSlaHours),
                                exceptionRequest = FormatSlaHours(matrix.ExceptionRequestApprovalSlaHours)
                            }
                        }
                    }
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "An error occurred while retrieving the risk matrix", details = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetAllRiskMatrices()
        {
            try
            {
                var matrices = await _context.RiskMatrices
                    .Where(rm => rm.IsActive)
                    .OrderByDescending(rm => rm.IsDefault)
                    .ThenBy(rm => rm.Name)
                    .Select(rm => new
                    {
                        id = rm.Id,
                        name = rm.Name,
                        description = rm.Description,
                        matrixType = rm.MatrixType.ToString(),
                        matrixSize = rm.MatrixSize,
                        isDefault = rm.IsDefault
                    })
                    .ToListAsync();

                return Ok(matrices);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "An error occurred while retrieving risk matrices", details = ex.Message });
            }
        }

        [HttpPost("calculate-risk")]
        public IActionResult CalculateRisk([FromBody] RiskCalculationRequest request)
        {
            try
            {
                if (request == null)
                {
                    return BadRequest(new { error = "Invalid request data" });
                }

                decimal riskScore = 0;

                if (request.MatrixType == "ImpactLikelihood")
                {
                    if (!request.Impact.HasValue || !request.Likelihood.HasValue)
                    {
                        return BadRequest(new { error = "Impact and Likelihood are required for Impact×Likelihood calculations" });
                    }
                    riskScore = request.Impact.Value * request.Likelihood.Value;
                }
                else if (request.MatrixType == "ImpactLikelihoodExposure")
                {
                    if (!request.Impact.HasValue || !request.Likelihood.HasValue || !request.Exposure.HasValue)
                    {
                        return BadRequest(new { error = "Impact, Likelihood, and Exposure are required for Impact×Likelihood×Exposure calculations" });
                    }
                    riskScore = request.Impact.Value * request.Likelihood.Value * request.Exposure.Value;
                }
                else
                {
                    return BadRequest(new { error = "Invalid matrix type" });
                }

                // Determine risk level based on thresholds
                string riskLevel = "Low";
                if (riskScore >= request.CriticalThreshold)
                    riskLevel = "Critical";
                else if (riskScore >= request.HighThreshold)
                    riskLevel = "High";
                else if (riskScore >= request.MediumThreshold)
                    riskLevel = "Medium";

                // Determine risk appetite status
                bool withinAppetite = riskScore <= request.RiskAppetiteThreshold;
                string appetiteStatus = withinAppetite ? "Within Appetite" : "Above Appetite";

                return Ok(new
                {
                    riskScore = Math.Round(riskScore, 2),
                    riskLevel = riskLevel,
                    withinRiskAppetite = withinAppetite,
                    riskAppetiteStatus = appetiteStatus
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "An error occurred during risk calculation", details = ex.Message });
            }
        }

        private static string FormatSlaHours(int hours)
        {
            return hours switch
            {
                < 24 => $"{hours} hours",
                < 168 => $"{hours / 24} days",
                < 720 => $"{hours / 168} weeks",
                _ => $"{Math.Round(hours / 720.0, 1)} months"
            };
        }
    }

    public class RiskCalculationRequest
    {
        public string MatrixType { get; set; } = string.Empty;
        public decimal? Impact { get; set; }
        public decimal? Likelihood { get; set; }
        public decimal? Exposure { get; set; }
        public decimal MediumThreshold { get; set; }
        public decimal HighThreshold { get; set; }
        public decimal CriticalThreshold { get; set; }
        public decimal RiskAppetiteThreshold { get; set; }
    }
}