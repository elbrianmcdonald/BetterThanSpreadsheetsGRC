using CyberRiskApp.Models;
using iText.Kernel.Pdf;
using iText.Layout;
using iText.Layout.Element;
using iText.Layout.Properties;
using iText.Kernel.Colors;
using iText.Layout.Borders;
using iText.Kernel.Font;
using iText.IO.Font.Constants;
using iText.Kernel.Geom;
using iText.IO.Image;

namespace CyberRiskApp.Services
{
    public class PdfExportService : IPdfExportService
    {
        private readonly ILogger<PdfExportService> _logger;

        // Color scheme for professional appearance
        private readonly Color PRIMARY_COLOR = new DeviceRgb(41, 128, 185);      // Professional blue
        private readonly Color SECONDARY_COLOR = new DeviceRgb(52, 73, 94);     // Dark blue-gray
        private readonly Color ACCENT_COLOR = new DeviceRgb(231, 76, 60);       // Red for critical items
        private readonly Color SUCCESS_COLOR = new DeviceRgb(39, 174, 96);      // Green for success
        private readonly Color WARNING_COLOR = new DeviceRgb(241, 196, 15);     // Yellow for warnings
        private readonly Color LIGHT_GRAY = new DeviceRgb(236, 240, 241);       // Light background
        private readonly Color DARK_GRAY = new DeviceRgb(149, 165, 166);        // Text gray
        private readonly Color WHITE = ColorConstants.WHITE;

        public PdfExportService(ILogger<PdfExportService> logger)
        {
            _logger = logger;
        }

        public async Task<byte[]> ExportRiskAssessmentToPdfAsync(RiskAssessment riskAssessment)
        {
            try
            {
                if (riskAssessment == null)
                    throw new ArgumentNullException(nameof(riskAssessment));

                using var memoryStream = new MemoryStream();
                var pdfWriter = new PdfWriter(memoryStream);
                var pdfDocument = new PdfDocument(pdfWriter);
                var document = new Document(pdfDocument, PageSize.A4);
                
                // Set margins
                document.SetMargins(50, 50, 50, 50);

                // Load fonts
                var boldFont = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);
                var regularFont = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);

                // Add header with company branding
                AddHeader(document, boldFont, regularFont);

                // Add main title
                AddMainTitle(document, "RISK ASSESSMENT REPORT", boldFont);

                // Add assessment details with professional formatting
                AddRiskAssessmentContent(document, riskAssessment, boldFont, regularFont);

                // Add footer
                AddFooter(document, regularFont, pdfDocument.GetNumberOfPages());

                document.Close();
                return memoryStream.ToArray();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating PDF for risk assessment {Id}: {Message}", riskAssessment?.Id, ex.Message);
                throw new InvalidOperationException($"Failed to generate PDF: {ex.Message}", ex);
            }
        }

        public async Task<byte[]> ExportMultipleRiskAssessmentsToPdfAsync(IEnumerable<RiskAssessment> riskAssessments)
        {
            try
            {
                var assessmentList = riskAssessments?.ToList() ?? new List<RiskAssessment>();
                if (!assessmentList.Any())
                    throw new ArgumentException("No assessments provided for export");

                using var memoryStream = new MemoryStream();
                var pdfWriter = new PdfWriter(memoryStream);
                var pdfDocument = new PdfDocument(pdfWriter);
                var document = new Document(pdfDocument, PageSize.A4);
                
                // Set margins
                document.SetMargins(50, 50, 50, 50);

                // Load fonts
                var boldFont = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);
                var regularFont = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);

                // Add header with company branding
                AddHeader(document, boldFont, regularFont);

                // Add main title
                AddMainTitle(document, "RISK ASSESSMENT SUMMARY REPORT", boldFont);

                // Add summary table
                AddAssessmentSummaryTable(document, assessmentList, boldFont, regularFont);

                var count = 0;
                foreach (var assessment in assessmentList)
                {
                    document.Add(new AreaBreak(AreaBreakType.NEXT_PAGE));
                    
                    // Add page header for each assessment
                    AddPageHeader(document, $"Assessment #{assessment.Id}", boldFont);
                    
                    AddRiskAssessmentContent(document, assessment, boldFont, regularFont);
                    count++;
                }

                // Update all page footers
                for (int i = 1; i <= pdfDocument.GetNumberOfPages(); i++)
                {
                    AddPageFooter(document, regularFont, i, pdfDocument.GetNumberOfPages());
                }

                document.Close();
                return memoryStream.ToArray();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating PDF for multiple risk assessments: {Message}", ex.Message);
                throw new InvalidOperationException($"Failed to generate PDF: {ex.Message}", ex);
            }
        }

        public async Task<byte[]> ExportFindingToPdfAsync(Finding finding)
        {
            try
            {
                if (finding == null)
                    throw new ArgumentNullException(nameof(finding));

                using var memoryStream = new MemoryStream();
                var pdfWriter = new PdfWriter(memoryStream);
                var pdfDocument = new PdfDocument(pdfWriter);
                var document = new Document(pdfDocument, PageSize.A4);
                
                document.SetMargins(50, 50, 50, 50);
                var boldFont = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);
                var regularFont = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);

                AddHeader(document, boldFont, regularFont);
                AddMainTitle(document, "FINDING REPORT", boldFont);

                // Basic finding content
                AddInfoSection(document, "Finding Information", boldFont);
                var table = CreateInfoTable();
                table.AddRow("Finding Number:", finding.FindingNumber ?? "N/A");
                table.AddRow("Title:", finding.Title ?? "N/A");
                table.AddRow("Status:", finding.Status.ToString());
                table.AddRow("Risk Rating:", finding.RiskRating.ToString());
                document.Add(table);

                AddFooter(document, regularFont, pdfDocument.GetNumberOfPages());
                
                document.Close();
                return memoryStream.ToArray();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating PDF for finding {Id}: {Message}", finding?.Id, ex.Message);
                throw new InvalidOperationException($"Failed to generate PDF: {ex.Message}", ex);
            }
        }

        public async Task<byte[]> ExportRiskToPdfAsync(Risk risk)
        {
            try
            {
                if (risk == null)
                    throw new ArgumentNullException(nameof(risk));

                using var memoryStream = new MemoryStream();
                var pdfWriter = new PdfWriter(memoryStream);
                var pdfDocument = new PdfDocument(pdfWriter);
                var document = new Document(pdfDocument, PageSize.A4);
                
                document.SetMargins(50, 50, 50, 50);
                var boldFont = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);
                var regularFont = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);

                AddHeader(document, boldFont, regularFont);
                AddMainTitle(document, "RISK REPORT", boldFont);

                // Basic risk content
                AddInfoSection(document, "Risk Information", boldFont);
                var table = CreateInfoTable();
                table.AddRow("Risk Number:", risk.RiskNumber ?? "N/A");
                table.AddRow("Title:", risk.Title ?? "N/A");
                table.AddRow("Status:", risk.Status.ToString());
                table.AddRow("Risk Level:", risk.InherentRiskLevel.ToString());
                document.Add(table);

                AddFooter(document, regularFont, pdfDocument.GetNumberOfPages());
                
                document.Close();
                return memoryStream.ToArray();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating PDF for risk {Id}: {Message}", risk?.Id, ex.Message);
                throw new InvalidOperationException($"Failed to generate PDF: {ex.Message}", ex);
            }
        }

        private void AddHeader(Document document, PdfFont boldFont, PdfFont regularFont)
        {
            // Create header table
            var headerTable = new Table(2).UseAllAvailableWidth();
            headerTable.SetMarginBottom(30);

            // Company info (left side)
            var companyInfo = new Cell()
                .SetBorder(Border.NO_BORDER)
                .SetVerticalAlignment(VerticalAlignment.MIDDLE);
            
            companyInfo.Add(new Paragraph("Better Than Spreadsheets GRC")
                .SetFont(boldFont)
                .SetFontSize(16)
                .SetFontColor(PRIMARY_COLOR)
                .SetMarginBottom(2));
            
            companyInfo.Add(new Paragraph("Cyber Risk Management Platform")
                .SetFont(regularFont)
                .SetFontSize(10)
                .SetFontColor(DARK_GRAY));

            // Date info (right side)
            var dateInfo = new Cell()
                .SetBorder(Border.NO_BORDER)
                .SetTextAlignment(TextAlignment.RIGHT)
                .SetVerticalAlignment(VerticalAlignment.MIDDLE);
            
            dateInfo.Add(new Paragraph($"Generated: {DateTime.Now:MMMM dd, yyyy}")
                .SetFont(regularFont)
                .SetFontSize(10)
                .SetFontColor(DARK_GRAY)
                .SetMarginBottom(2));
            
            dateInfo.Add(new Paragraph($"Time: {DateTime.Now:HH:mm:ss}")
                .SetFont(regularFont)
                .SetFontSize(10)
                .SetFontColor(DARK_GRAY));

            headerTable.AddCell(companyInfo);
            headerTable.AddCell(dateInfo);

            document.Add(headerTable);

            // Add separator line
            var separator = new Paragraph()
                .SetMarginTop(0)
                .SetMarginBottom(25)
                .SetBorderBottom(new SolidBorder(PRIMARY_COLOR, 2));
            document.Add(separator);
        }

        private void AddMainTitle(Document document, string title, PdfFont boldFont)
        {
            var titlePara = new Paragraph(title)
                .SetFont(boldFont)
                .SetFontSize(24)
                .SetFontColor(SECONDARY_COLOR)
                .SetTextAlignment(TextAlignment.CENTER)
                .SetMarginBottom(30)
                .SetMarginTop(10);

            document.Add(titlePara);
        }

        private void AddPageHeader(Document document, string subtitle, PdfFont boldFont)
        {
            var header = new Paragraph(subtitle)
                .SetFont(boldFont)
                .SetFontSize(18)
                .SetFontColor(PRIMARY_COLOR)
                .SetMarginBottom(20)
                .SetMarginTop(10);

            document.Add(header);
        }

        private void AddRiskAssessmentContent(Document document, RiskAssessment assessment, PdfFont boldFont, PdfFont regularFont)
        {
            // Assessment Overview Section
            AddInfoSection(document, "Assessment Overview", boldFont);
            
            var overviewTable = CreateInfoTable();
            overviewTable.AddRow("Assessment ID:", assessment.Id.ToString());
            overviewTable.AddRow("Title:", assessment.Title ?? "N/A");
            overviewTable.AddRow("Asset:", assessment.Asset ?? "N/A");
            overviewTable.AddRow("Business Unit:", assessment.BusinessUnit ?? "N/A");
            overviewTable.AddRow("Business Owner:", assessment.BusinessOwner ?? "N/A");
            overviewTable.AddRow("Assessor:", assessment.Assessor ?? "N/A");
            overviewTable.AddRow("Status:", GetStatusBadge(assessment.Status.ToString()));
            overviewTable.AddRow("Assessment Type:", assessment.AssessmentType.ToString());
            overviewTable.AddRow("Risk Level:", GetRiskLevelBadge(assessment.CalculateRiskLevel()));
            
            if (assessment.CIATriad.HasValue)
            {
                overviewTable.AddRow("CIA Triad Impact:", assessment.CIATriad.Value.ToString());
            }
            
            if (assessment.DateCompleted.HasValue)
            {
                overviewTable.AddRow("Completed Date:", assessment.DateCompleted.Value.ToString("MMMM dd, yyyy"));
            }
            
            overviewTable.AddRow("Created At:", assessment.CreatedAt.ToString("MMMM dd, yyyy HH:mm"));
            overviewTable.AddRow("Last Updated:", assessment.UpdatedAt.ToString("MMMM dd, yyyy HH:mm"));
            
            if (assessment.LinkedFinding != null)
            {
                overviewTable.AddRow("Related Finding:", $"{assessment.LinkedFinding.FindingNumber} - {assessment.LinkedFinding.Title}");
            }

            document.Add(overviewTable);
            document.Add(new Paragraph().SetMarginBottom(20)); // Spacing

            // Risk Analysis Section
            AddInfoSection(document, "Risk Analysis", boldFont);
            
            if (assessment.AssessmentType == AssessmentType.FAIR)
            {
                AddFairAnalysis(document, assessment, boldFont, regularFont);
            }
            else
            {
                AddQualitativeAnalysis(document, assessment, boldFont, regularFont);
            }

            // Scenario Information
            if (!string.IsNullOrEmpty(assessment.Description) || !string.IsNullOrEmpty(assessment.ThreatScenario))
            {
                document.Add(new Paragraph().SetMarginBottom(15)); // Spacing
                AddInfoSection(document, "Scenario Details", boldFont);
                
                if (!string.IsNullOrEmpty(assessment.Description))
                {
                    AddTextBlock(document, "Description", assessment.Description, boldFont, regularFont);
                }
                
                if (!string.IsNullOrEmpty(assessment.ThreatScenario))
                {
                    AddTextBlock(document, "Threat Scenario", assessment.ThreatScenario, boldFont, regularFont);
                }
            }

            // Controls Information
            if (!string.IsNullOrEmpty(assessment.TechnicalControlsInPlace))
            {
                document.Add(new Paragraph().SetMarginBottom(15)); // Spacing
                AddInfoSection(document, "Technical Controls", boldFont);
                AddTextBlock(document, "Controls in Place", assessment.TechnicalControlsInPlace, boldFont, regularFont);
            }
            
            // Add Defense in Depth Controls if available
            if (assessment.Controls != null && assessment.Controls.Any())
            {
                document.Add(new Paragraph().SetMarginBottom(15)); // Spacing
                AddInfoSection(document, "Defense in Depth Controls", boldFont);
                
                var controlsTable = new Table(new float[] { 3, 2, 2 }).UseAllAvailableWidth();
                controlsTable.SetMarginBottom(15);
                
                // Header row
                controlsTable.AddHeaderCell(CreateHeaderCell("Control Name", boldFont));
                controlsTable.AddHeaderCell(CreateHeaderCell("Control Type", boldFont));
                controlsTable.AddHeaderCell(CreateHeaderCell("Effectiveness", boldFont));
                
                foreach (var control in assessment.Controls)
                {
                    controlsTable.AddCell(CreateDataCell(control.ControlName, regularFont));
                    controlsTable.AddCell(CreateDataCell(control.ControlType.ToString(), regularFont));
                    controlsTable.AddCell(CreateDataCell($"{control.ControlEffectiveness:N0}%", regularFont));
                }
                
                document.Add(controlsTable);
                
                if (assessment.CalculatedVulnerability.HasValue)
                {
                    var vulnTable = CreateInfoTable();
                    vulnTable.AddRow("Calculated Vulnerability:", assessment.CalculatedVulnerability.Value.ToString("P2"));
                    document.Add(vulnTable);
                }
            }
            
            // Add Qualitative Controls if available
            if (assessment.QualitativeControls != null && assessment.QualitativeControls.Any())
            {
                document.Add(new Paragraph().SetMarginBottom(15)); // Spacing
                AddInfoSection(document, "Qualitative Controls", boldFont);
                
                var qualControlsTable = new Table(new float[] { 3, 2, 3 }).UseAllAvailableWidth();
                qualControlsTable.SetMarginBottom(15);
                
                // Header row
                qualControlsTable.AddHeaderCell(CreateHeaderCell("Control Name", boldFont));
                qualControlsTable.AddHeaderCell(CreateHeaderCell("Implementation Status", boldFont));
                qualControlsTable.AddHeaderCell(CreateHeaderCell("Description", boldFont));
                
                foreach (var control in assessment.QualitativeControls)
                {
                    qualControlsTable.AddCell(CreateDataCell(control.ControlName, regularFont));
                    qualControlsTable.AddCell(CreateDataCell(control.ImplementationStatus.ToString(), regularFont));
                    qualControlsTable.AddCell(CreateDataCell(control.ControlDescription ?? "N/A", regularFont));
                }
                
                document.Add(qualControlsTable);
            }
        }

        private void AddFairAnalysis(Document document, RiskAssessment assessment, PdfFont boldFont, PdfFont regularFont)
        {
            // FAIR Metrics Table
            var fairTable = CreateInfoTable();
            fairTable.AddRow("Threat Community:", assessment.ThreatCommunity ?? "N/A");
            fairTable.AddRow("Threat Action:", assessment.ThreatAction ?? "N/A");
            fairTable.AddRow("Threat Event Frequency (Most Likely):", assessment.ThreatEventFrequency.ToString("N4") + " events/year");
            fairTable.AddRow("TEF Minimum:", assessment.ThreatEventFrequencyMin.ToString("N4") + " events/year");
            fairTable.AddRow("TEF Maximum:", assessment.ThreatEventFrequencyMax.ToString("N4") + " events/year");
            fairTable.AddRow("TEF Confidence Level:", assessment.ThreatEventFrequencyConfidence.ToString("N0") + "%");
            fairTable.AddRow("Contact Frequency:", assessment.ContactFrequency.ToString("P2"));
            fairTable.AddRow("Action Success:", assessment.ActionSuccess.ToString("P2"));
            
            if (assessment.LossEventFrequency.HasValue)
                fairTable.AddRow("Loss Event Frequency:", assessment.LossEventFrequency.Value.ToString("N4") + " events/year");
            
            if (assessment.PrimaryLossMagnitude.HasValue)
                fairTable.AddRow("Primary Loss Magnitude:", assessment.PrimaryLossMagnitude.Value.ToString("C0"));
            
            if (assessment.AnnualLossExpectancy.HasValue)
            {
                var aleFormatted = assessment.AnnualLossExpectancy.Value.ToString("C0");
                fairTable.AddRow("Annual Loss Expectancy:", aleFormatted);
            }
            
            fairTable.AddRow("Deduct Cybersecurity Insurance:", assessment.DeductCybersecurityInsurance ? "Yes" : "No");
            fairTable.AddRow("Distribution Type:", assessment.DistributionType);
            fairTable.AddRow("Use PERT Distribution:", assessment.UsePerDistribution ? "Yes" : "No");
            fairTable.AddRow("Loss Magnitude Confidence:", assessment.LossMagnitudeConfidence.ToString("N0") + "%");

            document.Add(fairTable);
            document.Add(new Paragraph().SetMarginBottom(20)); // Spacing

            // Loss Magnitude Ranges
            AddInfoSection(document, "Primary Loss Analysis", boldFont);
            var lossTable = new Table(new float[] { 3, 2, 2, 2 }).UseAllAvailableWidth();
            lossTable.SetMarginBottom(15);

            // Header row
            lossTable.AddHeaderCell(CreateHeaderCell("Loss Category", boldFont));
            lossTable.AddHeaderCell(CreateHeaderCell("Minimum", boldFont));
            lossTable.AddHeaderCell(CreateHeaderCell("Most Likely", boldFont));
            lossTable.AddHeaderCell(CreateHeaderCell("Maximum", boldFont));

            // Data rows
            lossTable.AddCell(CreateDataCell("Productivity Loss", regularFont));
            lossTable.AddCell(CreateDataCell($"${assessment.ProductivityLossMin:N0}", regularFont));
            lossTable.AddCell(CreateDataCell($"${assessment.ProductivityLossMostLikely:N0}", regularFont));
            lossTable.AddCell(CreateDataCell($"${assessment.ProductivityLossMax:N0}", regularFont));

            lossTable.AddCell(CreateDataCell("Response Costs", regularFont));
            lossTable.AddCell(CreateDataCell($"${assessment.ResponseCostsMin:N0}", regularFont));
            lossTable.AddCell(CreateDataCell($"${assessment.ResponseCostsMostLikely:N0}", regularFont));
            lossTable.AddCell(CreateDataCell($"${assessment.ResponseCostsMax:N0}", regularFont));

            lossTable.AddCell(CreateDataCell("Replacement Costs", regularFont));
            lossTable.AddCell(CreateDataCell($"${assessment.ReplacementCostMin:N0}", regularFont));
            lossTable.AddCell(CreateDataCell($"${assessment.ReplacementCostMostLikely:N0}", regularFont));
            lossTable.AddCell(CreateDataCell($"${assessment.ReplacementCostMax:N0}", regularFont));

            lossTable.AddCell(CreateDataCell("Fines & Penalties", regularFont));
            lossTable.AddCell(CreateDataCell($"${assessment.FinesMin:N0}", regularFont));
            lossTable.AddCell(CreateDataCell($"${assessment.FinesMostLikely:N0}", regularFont));
            lossTable.AddCell(CreateDataCell($"${assessment.FinesMax:N0}", regularFont));

            document.Add(lossTable);

            // Secondary Loss Analysis if included
            if (assessment.IncludeSecondaryLoss)
            {
                document.Add(new Paragraph().SetMarginBottom(15)); // Spacing
                AddInfoSection(document, "Secondary Loss Analysis", boldFont);
                
                var secondaryTable = CreateInfoTable();
                secondaryTable.AddRow("Include Secondary Loss:", "Yes");
                
                if (assessment.SecondaryLossEventFrequency.HasValue)
                    secondaryTable.AddRow("Secondary Loss Event Frequency:", assessment.SecondaryLossEventFrequency.Value.ToString("N4") + " events/year");
                
                if (assessment.SecondaryLossMagnitude.HasValue)
                    secondaryTable.AddRow("Secondary Loss Magnitude:", assessment.SecondaryLossMagnitude.Value.ToString("C0"));
                
                document.Add(secondaryTable);
                document.Add(new Paragraph().SetMarginBottom(10)); // Spacing
                
                var secondaryLossTable = new Table(new float[] { 3, 2, 2, 2 }).UseAllAvailableWidth();
                secondaryLossTable.SetMarginBottom(15);

                // Header row
                secondaryLossTable.AddHeaderCell(CreateHeaderCell("Secondary Loss Category", boldFont));
                secondaryLossTable.AddHeaderCell(CreateHeaderCell("Minimum", boldFont));
                secondaryLossTable.AddHeaderCell(CreateHeaderCell("Most Likely", boldFont));
                secondaryLossTable.AddHeaderCell(CreateHeaderCell("Maximum", boldFont));

                // Secondary Loss Data rows
                secondaryLossTable.AddCell(CreateDataCell("Secondary Response Cost", regularFont));
                secondaryLossTable.AddCell(CreateDataCell($"${assessment.SecondaryResponseCostMin:N0}", regularFont));
                secondaryLossTable.AddCell(CreateDataCell($"${assessment.SecondaryResponseCostMostLikely:N0}", regularFont));
                secondaryLossTable.AddCell(CreateDataCell($"${assessment.SecondaryResponseCostMax:N0}", regularFont));

                secondaryLossTable.AddCell(CreateDataCell("Secondary Productivity Loss", regularFont));
                secondaryLossTable.AddCell(CreateDataCell($"${assessment.SecondaryProductivityLossMin:N0}", regularFont));
                secondaryLossTable.AddCell(CreateDataCell($"${assessment.SecondaryProductivityLossMostLikely:N0}", regularFont));
                secondaryLossTable.AddCell(CreateDataCell($"${assessment.SecondaryProductivityLossMax:N0}", regularFont));

                secondaryLossTable.AddCell(CreateDataCell("Reputation Damage", regularFont));
                secondaryLossTable.AddCell(CreateDataCell($"${assessment.ReputationDamageMin:N0}", regularFont));
                secondaryLossTable.AddCell(CreateDataCell($"${assessment.ReputationDamageMostLikely:N0}", regularFont));
                secondaryLossTable.AddCell(CreateDataCell($"${assessment.ReputationDamageMax:N0}", regularFont));

                secondaryLossTable.AddCell(CreateDataCell("Competitive Advantage Loss", regularFont));
                secondaryLossTable.AddCell(CreateDataCell($"${assessment.CompetitiveAdvantageLossMin:N0}", regularFont));
                secondaryLossTable.AddCell(CreateDataCell($"${assessment.CompetitiveAdvantageLossMostLikely:N0}", regularFont));
                secondaryLossTable.AddCell(CreateDataCell($"${assessment.CompetitiveAdvantageLossMax:N0}", regularFont));

                secondaryLossTable.AddCell(CreateDataCell("External Stakeholder Loss", regularFont));
                secondaryLossTable.AddCell(CreateDataCell($"${assessment.ExternalStakeholderLossMin:N0}", regularFont));
                secondaryLossTable.AddCell(CreateDataCell($"${assessment.ExternalStakeholderLossMostLikely:N0}", regularFont));
                secondaryLossTable.AddCell(CreateDataCell($"${assessment.ExternalStakeholderLossMax:N0}", regularFont));

                document.Add(secondaryLossTable);
            }

            // Monte Carlo Simulation Results if available
            if (assessment.SimulationIterations > 0 && assessment.ALE_50th.HasValue)
            {
                document.Add(new Paragraph().SetMarginBottom(15)); // Spacing
                AddInfoSection(document, "Monte Carlo Simulation Results", boldFont);
                
                var simulationTable = CreateInfoTable();
                simulationTable.AddRow("Simulation Iterations:", assessment.SimulationIterations.ToString("N0"));
                
                if (assessment.ALE_10th.HasValue)
                    simulationTable.AddRow("ALE 10th Percentile:", assessment.ALE_10th.Value.ToString("C0"));
                if (assessment.ALE_50th.HasValue)
                    simulationTable.AddRow("ALE 50th Percentile (Median):", assessment.ALE_50th.Value.ToString("C0"));
                if (assessment.ALE_90th.HasValue)
                    simulationTable.AddRow("ALE 90th Percentile:", assessment.ALE_90th.Value.ToString("C0"));
                if (assessment.ALE_95th.HasValue)
                    simulationTable.AddRow("ALE 95th Percentile:", assessment.ALE_95th.Value.ToString("C0"));
                
                document.Add(simulationTable);
                document.Add(new Paragraph().SetMarginBottom(10)); // Spacing
                
                // Primary Loss Percentiles
                var primaryLossTable = CreateInfoTable();
                if (assessment.PrimaryLoss_10th.HasValue)
                    primaryLossTable.AddRow("Primary Loss 10th Percentile:", assessment.PrimaryLoss_10th.Value.ToString("C0"));
                if (assessment.PrimaryLoss_50th.HasValue)
                    primaryLossTable.AddRow("Primary Loss 50th Percentile:", assessment.PrimaryLoss_50th.Value.ToString("C0"));
                if (assessment.PrimaryLoss_90th.HasValue)
                    primaryLossTable.AddRow("Primary Loss 90th Percentile:", assessment.PrimaryLoss_90th.Value.ToString("C0"));
                if (assessment.PrimaryLoss_95th.HasValue)
                    primaryLossTable.AddRow("Primary Loss 95th Percentile:", assessment.PrimaryLoss_95th.Value.ToString("C0"));
                
                document.Add(primaryLossTable);
            }

            // Risk Level Calculation
            var riskLevel = assessment.CalculateRiskLevel();
            var riskLevelTable = CreateInfoTable();
            riskLevelTable.AddRow("Calculated Risk Level:", GetRiskLevelBadge(riskLevel));
            document.Add(riskLevelTable);
        }

        private void AddQualitativeAnalysis(Document document, RiskAssessment assessment, PdfFont boldFont, PdfFont regularFont)
        {
            var qualTable = CreateInfoTable();
            
            if (assessment.QualitativeLikelihood.HasValue)
                qualTable.AddRow("Likelihood:", GetRiskLevelBadge(assessment.QualitativeLikelihood.Value.ToString()));
            if (assessment.QualitativeImpact.HasValue)
                qualTable.AddRow("Impact:", GetRiskLevelBadge(assessment.QualitativeImpact.Value.ToString()));
            if (assessment.QualitativeExposure.HasValue)
                qualTable.AddRow("Exposure:", GetRiskLevelBadge(assessment.QualitativeExposure.Value.ToString()));
            if (assessment.QualitativeRiskScore.HasValue)
                qualTable.AddRow("Risk Score:", assessment.QualitativeRiskScore.Value.ToString("N2"));

            document.Add(qualTable);
        }

        private void AddAssessmentSummaryTable(Document document, List<RiskAssessment> assessments, PdfFont boldFont, PdfFont regularFont)
        {
            AddInfoSection(document, "Assessment Summary", boldFont);
            
            var summaryTable = new Table(new float[] { 1, 3, 2, 2, 2 }).UseAllAvailableWidth();
            summaryTable.SetMarginBottom(25);

            // Headers
            summaryTable.AddHeaderCell(CreateHeaderCell("ID", boldFont));
            summaryTable.AddHeaderCell(CreateHeaderCell("Title", boldFont));
            summaryTable.AddHeaderCell(CreateHeaderCell("Asset", boldFont));
            summaryTable.AddHeaderCell(CreateHeaderCell("Type", boldFont));
            summaryTable.AddHeaderCell(CreateHeaderCell("Status", boldFont));

            // Data
            foreach (var assessment in assessments.Take(10)) // Limit to first 10 for summary
            {
                summaryTable.AddCell(CreateDataCell(assessment.Id.ToString(), regularFont));
                summaryTable.AddCell(CreateDataCell(assessment.Title ?? "N/A", regularFont));
                summaryTable.AddCell(CreateDataCell(assessment.Asset ?? "N/A", regularFont));
                summaryTable.AddCell(CreateDataCell(assessment.AssessmentType.ToString(), regularFont));
                summaryTable.AddCell(CreateDataCell(assessment.Status.ToString(), regularFont));
            }

            document.Add(summaryTable);

            if (assessments.Count > 10)
            {
                document.Add(new Paragraph($"Note: Showing first 10 of {assessments.Count} assessments in summary. Full details follow.")
                    .SetFont(regularFont)
                    .SetFontSize(10)
                    .SetFontColor(DARK_GRAY)
                    .SetMarginBottom(20));
            }
        }

        private void AddInfoSection(Document document, string title, PdfFont boldFont)
        {
            var sectionTitle = new Paragraph(title)
                .SetFont(boldFont)
                .SetFontSize(14)
                .SetFontColor(PRIMARY_COLOR)
                .SetMarginTop(20)
                .SetMarginBottom(10)
                .SetPaddingBottom(3)
                .SetBorderBottom(new SolidBorder(LIGHT_GRAY, 1));

            document.Add(sectionTitle);
        }

        private void AddTextBlock(Document document, string label, string content, PdfFont boldFont, PdfFont regularFont)
        {
            var labelPara = new Paragraph(label + ":")
                .SetFont(boldFont)
                .SetFontSize(11)
                .SetFontColor(SECONDARY_COLOR)
                .SetMarginTop(10)
                .SetMarginBottom(5);

            var contentPara = new Paragraph(content)
                .SetFont(regularFont)
                .SetFontSize(10)
                .SetTextAlignment(TextAlignment.JUSTIFIED)
                .SetMarginBottom(10)
                .SetPaddingLeft(10)
                .SetBackgroundColor(new DeviceRgb(249, 249, 249))
                .SetPadding(8)
                .SetBorderRadius(new BorderRadius(3));

            document.Add(labelPara);
            document.Add(contentPara);
        }

        private Table CreateInfoTable()
        {
            var table = new Table(new float[] { 2, 3 }).UseAllAvailableWidth();
            table.SetMarginBottom(15);
            return table;
        }

        private Cell CreateHeaderCell(string text, PdfFont boldFont)
        {
            return new Cell()
                .Add(new Paragraph(text).SetFont(boldFont).SetFontColor(WHITE))
                .SetBackgroundColor(PRIMARY_COLOR)
                .SetTextAlignment(TextAlignment.CENTER)
                .SetVerticalAlignment(VerticalAlignment.MIDDLE)
                .SetPadding(8)
                .SetBorder(Border.NO_BORDER);
        }

        private Cell CreateDataCell(string text, PdfFont regularFont)
        {
            return new Cell()
                .Add(new Paragraph(text ?? "N/A").SetFont(regularFont).SetFontSize(10))
                .SetPadding(8)
                .SetBorder(new SolidBorder(LIGHT_GRAY, 1))
                .SetVerticalAlignment(VerticalAlignment.MIDDLE);
        }

        private string GetStatusBadge(string status)
        {
            return $"● {status}"; // Simple bullet point for now
        }

        private string GetRiskLevelBadge(string level)
        {
            return $"● {level}"; // Simple bullet point for now
        }

        private void AddFooter(Document document, PdfFont regularFont, int totalPages)
        {
            // Add some space before footer
            document.Add(new Paragraph().SetMarginTop(30));
            
            // Footer separator
            var footerSeparator = new Paragraph()
                .SetBorderTop(new SolidBorder(LIGHT_GRAY, 1))
                .SetMarginBottom(15);
            document.Add(footerSeparator);

            // Footer content
            var footerTable = new Table(2).UseAllAvailableWidth();
            
            var leftFooter = new Cell()
                .SetBorder(Border.NO_BORDER)
                .Add(new Paragraph("Confidential - Risk Assessment Report")
                    .SetFont(regularFont)
                    .SetFontSize(8)
                    .SetFontColor(DARK_GRAY));

            var rightFooter = new Cell()
                .SetBorder(Border.NO_BORDER)
                .SetTextAlignment(TextAlignment.RIGHT)
                .Add(new Paragraph($"Page 1 of {totalPages}")
                    .SetFont(regularFont)
                    .SetFontSize(8)
                    .SetFontColor(DARK_GRAY));

            footerTable.AddCell(leftFooter);
            footerTable.AddCell(rightFooter);
            
            document.Add(footerTable);
        }

        private void AddPageFooter(Document document, PdfFont regularFont, int currentPage, int totalPages)
        {
            // This would typically be added at the bottom of each page
            // For now, we'll add it at the end of content
        }
    }

    // Extension method for table convenience
    public static class TableExtensions
    {
        public static void AddRow(this Table table, string label, string value)
        {
            var boldFont = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);
            
            var labelCell = new Cell()
                .Add(new Paragraph(label).SetFont(boldFont))
                .SetBackgroundColor(new DeviceRgb(248, 249, 250))
                .SetPadding(8)
                .SetBorder(new SolidBorder(new DeviceRgb(233, 236, 239), 1));

            var valueCell = new Cell()
                .Add(new Paragraph(value ?? "N/A"))
                .SetPadding(8)
                .SetBorder(new SolidBorder(new DeviceRgb(233, 236, 239), 1));

            table.AddCell(labelCell);
            table.AddCell(valueCell);
        }
    }
}