using CyberRiskApp.Models;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using System.Drawing;

namespace CyberRiskApp.Services
{
    public interface IExportService
    {
        Task<byte[]> ExportFindingsToExcelAsync(IEnumerable<Finding> findings);
        Task<byte[]> ExportRisksToExcelAsync(IEnumerable<Risk> risks);
        Task<byte[]> ExportAcceptanceRequestsToExcelAsync(IEnumerable<RiskAcceptanceRequest> requests);
    }

    public class ExportService : IExportService
    {
        public async Task<byte[]> ExportFindingsToExcelAsync(IEnumerable<Finding> findings)
        {
            using var package = new ExcelPackage();
            var worksheet = package.Workbook.Worksheets.Add("Findings Register");

            // Add headers
            worksheet.Cells[1, 1].Value = "Finding Number";
            worksheet.Cells[1, 2].Value = "Title";
            worksheet.Cells[1, 3].Value = "Status";
            worksheet.Cells[1, 4].Value = "Risk Rating";
            worksheet.Cells[1, 5].Value = "Impact";
            worksheet.Cells[1, 6].Value = "Likelihood";
            worksheet.Cells[1, 7].Value = "Exposure";
            worksheet.Cells[1, 8].Value = "Owner";
            worksheet.Cells[1, 9].Value = "Business Unit";
            worksheet.Cells[1, 10].Value = "Business Owner";
            worksheet.Cells[1, 11].Value = "Domain";
            worksheet.Cells[1, 12].Value = "Details";
            worksheet.Cells[1, 13].Value = "Open Date";
            worksheet.Cells[1, 14].Value = "SLA Date";
            worksheet.Cells[1, 15].Value = "Asset";
            worksheet.Cells[1, 16].Value = "Assigned To";

            // Style headers
            using (var range = worksheet.Cells[1, 1, 1, 16])
            {
                range.Style.Font.Bold = true;
                range.Style.Fill.PatternType = ExcelFillStyle.Solid;
                range.Style.Fill.BackgroundColor.SetColor(Color.LightBlue);
                range.Style.Border.BorderAround(ExcelBorderStyle.Thin);
            }

            // Add data
            var row = 2;
            foreach (var finding in findings)
            {
                worksheet.Cells[row, 1].Value = finding.FindingNumber;
                worksheet.Cells[row, 2].Value = finding.Title;
                worksheet.Cells[row, 3].Value = finding.Status.ToString();
                worksheet.Cells[row, 4].Value = finding.RiskRating.ToString();
                worksheet.Cells[row, 5].Value = finding.Impact.ToString();
                worksheet.Cells[row, 6].Value = finding.Likelihood.ToString();
                worksheet.Cells[row, 7].Value = finding.Exposure.ToString();
                worksheet.Cells[row, 8].Value = finding.Owner;
                worksheet.Cells[row, 9].Value = finding.BusinessUnit;
                worksheet.Cells[row, 10].Value = finding.BusinessOwner;
                worksheet.Cells[row, 11].Value = finding.Domain;
                worksheet.Cells[row, 12].Value = finding.Details;
                worksheet.Cells[row, 13].Value = finding.OpenDate.ToString("yyyy-MM-dd");
                worksheet.Cells[row, 14].Value = finding.SlaDate?.ToString("yyyy-MM-dd") ?? "";
                worksheet.Cells[row, 15].Value = finding.Asset;
                worksheet.Cells[row, 16].Value = finding.AssignedTo;

                // Color-code risk ratings
                var riskCell = worksheet.Cells[row, 4];
                switch (finding.RiskRating)
                {
                    case RiskRating.Critical:
                        riskCell.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        riskCell.Style.Fill.BackgroundColor.SetColor(Color.Red);
                        riskCell.Style.Font.Color.SetColor(Color.White);
                        break;
                    case RiskRating.High:
                        riskCell.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        riskCell.Style.Fill.BackgroundColor.SetColor(Color.Orange);
                        break;
                    case RiskRating.Medium:
                        riskCell.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        riskCell.Style.Fill.BackgroundColor.SetColor(Color.Yellow);
                        break;
                    case RiskRating.Low:
                        riskCell.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        riskCell.Style.Fill.BackgroundColor.SetColor(Color.LightGreen);
                        break;
                }

                row++;
            }

            // Auto-fit columns
            worksheet.Cells.AutoFitColumns();

            return await Task.FromResult(package.GetAsByteArray());
        }

        public async Task<byte[]> ExportRisksToExcelAsync(IEnumerable<Risk> risks)
        {
            using var package = new ExcelPackage();
            var worksheet = package.Workbook.Worksheets.Add("Risk Register");

            // Add headers
            worksheet.Cells[1, 1].Value = "Risk Number";
            worksheet.Cells[1, 2].Value = "Title";
            worksheet.Cells[1, 3].Value = "Description";
            worksheet.Cells[1, 4].Value = "Asset";
            worksheet.Cells[1, 5].Value = "Threat Scenario";
            worksheet.Cells[1, 6].Value = "Annual Loss Expectancy";
            worksheet.Cells[1, 7].Value = "Risk Level";
            worksheet.Cells[1, 8].Value = "Treatment Strategy";
            worksheet.Cells[1, 9].Value = "Status";
            worksheet.Cells[1, 10].Value = "Owner";
            worksheet.Cells[1, 11].Value = "Open Date";
            worksheet.Cells[1, 12].Value = "Next Review Date";
            worksheet.Cells[1, 13].Value = "Linked Finding";

            // Style headers
            using (var range = worksheet.Cells[1, 1, 1, 13])
            {
                range.Style.Font.Bold = true;
                range.Style.Fill.PatternType = ExcelFillStyle.Solid;
                range.Style.Fill.BackgroundColor.SetColor(Color.LightBlue);
                range.Style.Border.BorderAround(ExcelBorderStyle.Thin);
            }

            // Add data
            var row = 2;
            foreach (var risk in risks)
            {
                worksheet.Cells[row, 1].Value = risk.RiskNumber;
                worksheet.Cells[row, 2].Value = risk.Title;
                worksheet.Cells[row, 3].Value = risk.Description;
                worksheet.Cells[row, 4].Value = risk.Asset;
                worksheet.Cells[row, 5].Value = risk.ThreatScenario;
                worksheet.Cells[row, 6].Value = (double)risk.ALE;
                worksheet.Cells[row, 7].Value = risk.RiskLevel.ToString();
                worksheet.Cells[row, 8].Value = risk.Treatment.ToString();
                worksheet.Cells[row, 9].Value = risk.Status.ToString();
                worksheet.Cells[row, 10].Value = risk.Owner;
                worksheet.Cells[row, 11].Value = risk.OpenDate.ToString("yyyy-MM-dd");
                worksheet.Cells[row, 12].Value = risk.NextReviewDate?.ToString("yyyy-MM-dd") ?? "";
                worksheet.Cells[row, 13].Value = risk.LinkedFinding?.FindingNumber ?? "";

                // Format ALE as currency
                worksheet.Cells[row, 6].Style.Numberformat.Format = "$#,##0.00";

                // Color-code risk levels
                var riskCell = worksheet.Cells[row, 7];
                switch (risk.RiskLevel)
                {
                    case RiskLevel.Critical:
                        riskCell.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        riskCell.Style.Fill.BackgroundColor.SetColor(Color.Red);
                        riskCell.Style.Font.Color.SetColor(Color.White);
                        break;
                    case RiskLevel.High:
                        riskCell.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        riskCell.Style.Fill.BackgroundColor.SetColor(Color.Orange);
                        break;
                    case RiskLevel.Medium:
                        riskCell.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        riskCell.Style.Fill.BackgroundColor.SetColor(Color.Yellow);
                        break;
                    case RiskLevel.Low:
                        riskCell.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        riskCell.Style.Fill.BackgroundColor.SetColor(Color.LightGreen);
                        break;
                }

                row++;
            }

            // Auto-fit columns
            worksheet.Cells.AutoFitColumns();

            return await Task.FromResult(package.GetAsByteArray());
        }

        public async Task<byte[]> ExportAcceptanceRequestsToExcelAsync(IEnumerable<RiskAcceptanceRequest> requests)
        {
            using var package = new ExcelPackage();
            var worksheet = package.Workbook.Worksheets.Add("Risk Acceptance Register");

            // Add headers
            worksheet.Cells[1, 1].Value = "Request ID";
            worksheet.Cells[1, 2].Value = "Description";
            worksheet.Cells[1, 3].Value = "Business Need";
            worksheet.Cells[1, 4].Value = "Requester";
            worksheet.Cells[1, 5].Value = "Request Date";
            worksheet.Cells[1, 6].Value = "Status";
            worksheet.Cells[1, 7].Value = "Review Date";
            worksheet.Cells[1, 8].Value = "Reviewed By";
            worksheet.Cells[1, 9].Value = "Review Comments";
            worksheet.Cells[1, 10].Value = "Linked Finding/Risk";
            worksheet.Cells[1, 11].Value = "Risk Summary";
            worksheet.Cells[1, 12].Value = "Current Compensating Controls";
            worksheet.Cells[1, 13].Value = "Risk Level with Current Controls";
            worksheet.Cells[1, 14].Value = "Treatment Plan";
            worksheet.Cells[1, 15].Value = "Proposed Compensating Controls";
            worksheet.Cells[1, 16].Value = "Risk Level with All Mitigations";
            worksheet.Cells[1, 17].Value = "CISO Recommendation";

            // Style headers
            using (var range = worksheet.Cells[1, 1, 1, 17])
            {
                range.Style.Font.Bold = true;
                range.Style.Fill.PatternType = ExcelFillStyle.Solid;
                range.Style.Fill.BackgroundColor.SetColor(Color.LightBlue);
                range.Style.Border.BorderAround(ExcelBorderStyle.Thin);
            }

            // Add data
            var row = 2;
            foreach (var request in requests)
            {
                worksheet.Cells[row, 1].Value = request.Id;
                worksheet.Cells[row, 2].Value = request.Description;
                worksheet.Cells[row, 3].Value = request.BusinessNeed;
                worksheet.Cells[row, 4].Value = request.Requester;
                worksheet.Cells[row, 5].Value = request.RequestDate.ToString("yyyy-MM-dd");
                worksheet.Cells[row, 6].Value = request.Status.ToString();
                worksheet.Cells[row, 7].Value = request.ReviewDate?.ToString("yyyy-MM-dd") ?? "";
                worksheet.Cells[row, 8].Value = request.ReviewedBy;
                worksheet.Cells[row, 9].Value = request.ReviewComments;
                var linkedItem = request.LinkedFinding?.FindingNumber ?? 
                               (request.LinkedRisk?.RiskNumber ?? "");
                worksheet.Cells[row, 10].Value = linkedItem;
                worksheet.Cells[row, 11].Value = request.RiskSummary ?? "";
                worksheet.Cells[row, 12].Value = request.CurrentCompensatingControls ?? "";
                worksheet.Cells[row, 13].Value = request.CurrentRiskLevelWithControls?.ToString() ?? "";
                worksheet.Cells[row, 14].Value = request.TreatmentPlan ?? "";
                worksheet.Cells[row, 15].Value = request.ProposedCompensatingControls ?? "";
                worksheet.Cells[row, 16].Value = request.FutureRiskLevelWithMitigations?.ToString() ?? "";
                worksheet.Cells[row, 17].Value = request.CISORecommendation ?? "";

                // Color-code status
                var statusCell = worksheet.Cells[row, 6];
                switch (request.Status)
                {
                    case RequestStatus.Pending:
                    case RequestStatus.PendingApproval:
                        statusCell.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        statusCell.Style.Fill.BackgroundColor.SetColor(Color.Yellow);
                        break;
                    case RequestStatus.Approved:
                        statusCell.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        statusCell.Style.Fill.BackgroundColor.SetColor(Color.LightGreen);
                        break;
                    case RequestStatus.Rejected:
                        statusCell.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        statusCell.Style.Fill.BackgroundColor.SetColor(Color.LightCoral);
                        break;
                }

                row++;
            }

            // Auto-fit columns
            worksheet.Cells.AutoFitColumns();

            return await Task.FromResult(package.GetAsByteArray());
        }
    }
}