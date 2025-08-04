using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class PerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Risk table indexes for common query patterns
            migrationBuilder.CreateIndex(
                name: "IX_Risks_Status",
                table: "Risks",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Risks_CreatedAt",
                table: "Risks",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Risks_RiskLevel",
                table: "Risks",
                column: "RiskLevel");

            migrationBuilder.CreateIndex(
                name: "IX_Risks_OpenDate",
                table: "Risks",
                column: "OpenDate");

            migrationBuilder.CreateIndex(
                name: "IX_Risks_BusinessUnit",
                table: "Risks",
                column: "BusinessUnit");

            migrationBuilder.CreateIndex(
                name: "IX_Risks_Status_RiskLevel",
                table: "Risks",
                columns: new[] { "Status", "RiskLevel" });

            migrationBuilder.CreateIndex(
                name: "IX_Risks_Status_ALE",
                table: "Risks",
                columns: new[] { "Status", "ALE" });

            // Audit fields indexes for concurrency queries
            migrationBuilder.CreateIndex(
                name: "IX_Risks_CreatedBy",
                table: "Risks",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Risks_UpdatedBy",
                table: "Risks",
                column: "UpdatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Risks_UpdatedAt",
                table: "Risks",
                column: "UpdatedAt");

            // RiskAssessment table indexes
            migrationBuilder.CreateIndex(
                name: "IX_RiskAssessments_Status",
                table: "RiskAssessments",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_RiskAssessments_CreatedAt",
                table: "RiskAssessments",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_RiskAssessments_BusinessUnit",
                table: "RiskAssessments",
                column: "BusinessUnit");

            migrationBuilder.CreateIndex(
                name: "IX_RiskAssessments_AssessmentType",
                table: "RiskAssessments",
                column: "AssessmentType");

            // ComplianceAssessment table indexes
            migrationBuilder.CreateIndex(
                name: "IX_ComplianceAssessments_Status",
                table: "ComplianceAssessments",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ComplianceAssessments_CreatedAt",
                table: "ComplianceAssessments",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ComplianceAssessments_StartDate",
                table: "ComplianceAssessments",
                column: "StartDate");

            migrationBuilder.CreateIndex(
                name: "IX_ComplianceAssessments_CompletedDate",
                table: "ComplianceAssessments",
                column: "CompletedDate");

            // ControlAssessment table indexes  
            migrationBuilder.CreateIndex(
                name: "IX_ControlAssessments_Status",
                table: "ControlAssessments",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ControlAssessments_AssessmentDate",
                table: "ControlAssessments",
                column: "AssessmentDate");

            migrationBuilder.CreateIndex(
                name: "IX_ControlAssessments_ProjectNeeded",
                table: "ControlAssessments",
                column: "ProjectNeeded");

            migrationBuilder.CreateIndex(
                name: "IX_ControlAssessments_TShirtSize",
                table: "ControlAssessments",
                column: "TShirtSize");

            // MaturityAssessment table indexes
            migrationBuilder.CreateIndex(
                name: "IX_MaturityAssessments_Status",
                table: "MaturityAssessments",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_MaturityAssessments_CreatedAt",
                table: "MaturityAssessments",
                column: "CreatedAt");

            // MaturityControlAssessment table indexes
            migrationBuilder.CreateIndex(
                name: "IX_MaturityControlAssessments_CurrentMaturityLevel",
                table: "MaturityControlAssessments",
                column: "CurrentMaturityLevel");

            migrationBuilder.CreateIndex(
                name: "IX_MaturityControlAssessments_TargetMaturityLevel",
                table: "MaturityControlAssessments",
                column: "TargetMaturityLevel");

            migrationBuilder.CreateIndex(
                name: "IX_MaturityControlAssessments_ProjectNeeded",
                table: "MaturityControlAssessments",
                column: "ProjectNeeded");

            // Finding table indexes
            migrationBuilder.CreateIndex(
                name: "IX_Findings_Status",
                table: "Findings",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Findings_Impact",
                table: "Findings",
                column: "Impact");

            migrationBuilder.CreateIndex(
                name: "IX_Findings_RiskRating",
                table: "Findings",
                column: "RiskRating");

            migrationBuilder.CreateIndex(
                name: "IX_Findings_CreatedAt",
                table: "Findings",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Findings_SlaDate",
                table: "Findings",
                column: "SlaDate");

            migrationBuilder.CreateIndex(
                name: "IX_Findings_BusinessUnit",
                table: "Findings",
                column: "BusinessUnit");

            // User activity indexes
            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_LastLoginDate",
                table: "AspNetUsers",
                column: "LastLoginDate");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_Role",
                table: "AspNetUsers",
                column: "Role");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_Department",
                table: "AspNetUsers",
                column: "Department");

            // ThreatModel indexes for new module
            migrationBuilder.CreateIndex(
                name: "IX_ThreatModels_Status",
                table: "ThreatModels",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ThreatModels_CreatedAt",
                table: "ThreatModels",
                column: "CreatedAt");

            // Attack scenario indexes
            migrationBuilder.CreateIndex(
                name: "IX_AttackScenarios_Complexity",
                table: "AttackScenarios",
                column: "Complexity");

            migrationBuilder.CreateIndex(
                name: "IX_AttackScenarios_Status",
                table: "AttackScenarios",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_AttackScenarios_CreatedAt",
                table: "AttackScenarios",
                column: "CreatedAt");

            // Additional indexes can be added here after tables are created
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop all indexes in reverse order
            migrationBuilder.DropIndex(
                name: "IX_AttackScenarios_CreatedAt",
                table: "AttackScenarios");

            migrationBuilder.DropIndex(
                name: "IX_AttackScenarios_Status",
                table: "AttackScenarios");

            migrationBuilder.DropIndex(
                name: "IX_AttackScenarios_Complexity",
                table: "AttackScenarios");

            migrationBuilder.DropIndex(
                name: "IX_ThreatModels_CreatedAt",
                table: "ThreatModels");

            migrationBuilder.DropIndex(
                name: "IX_ThreatModels_Status",
                table: "ThreatModels");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_Department",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_Role",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_LastLoginDate",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_Findings_BusinessUnit",
                table: "Findings");

            migrationBuilder.DropIndex(
                name: "IX_Findings_SlaDate",
                table: "Findings");

            migrationBuilder.DropIndex(
                name: "IX_Findings_CreatedAt",
                table: "Findings");

            migrationBuilder.DropIndex(
                name: "IX_Findings_RiskRating",
                table: "Findings");

            migrationBuilder.DropIndex(
                name: "IX_Findings_Impact",
                table: "Findings");

            migrationBuilder.DropIndex(
                name: "IX_Findings_Status",
                table: "Findings");

            migrationBuilder.DropIndex(
                name: "IX_MaturityControlAssessments_ProjectNeeded",
                table: "MaturityControlAssessments");

            migrationBuilder.DropIndex(
                name: "IX_MaturityControlAssessments_TargetMaturityLevel",
                table: "MaturityControlAssessments");

            migrationBuilder.DropIndex(
                name: "IX_MaturityControlAssessments_CurrentMaturityLevel",
                table: "MaturityControlAssessments");

            migrationBuilder.DropIndex(
                name: "IX_MaturityAssessments_CreatedAt",
                table: "MaturityAssessments");

            migrationBuilder.DropIndex(
                name: "IX_MaturityAssessments_Status",
                table: "MaturityAssessments");

            migrationBuilder.DropIndex(
                name: "IX_ControlAssessments_TShirtSize",
                table: "ControlAssessments");

            migrationBuilder.DropIndex(
                name: "IX_ControlAssessments_ProjectNeeded",
                table: "ControlAssessments");

            migrationBuilder.DropIndex(
                name: "IX_ControlAssessments_AssessmentDate",
                table: "ControlAssessments");

            migrationBuilder.DropIndex(
                name: "IX_ControlAssessments_Status",
                table: "ControlAssessments");

            migrationBuilder.DropIndex(
                name: "IX_ComplianceAssessments_CompletedDate",
                table: "ComplianceAssessments");

            migrationBuilder.DropIndex(
                name: "IX_ComplianceAssessments_StartDate",
                table: "ComplianceAssessments");

            migrationBuilder.DropIndex(
                name: "IX_ComplianceAssessments_CreatedAt",
                table: "ComplianceAssessments");

            migrationBuilder.DropIndex(
                name: "IX_ComplianceAssessments_Status",
                table: "ComplianceAssessments");

            migrationBuilder.DropIndex(
                name: "IX_RiskAssessments_AssessmentType",
                table: "RiskAssessments");

            migrationBuilder.DropIndex(
                name: "IX_RiskAssessments_BusinessUnit",
                table: "RiskAssessments");

            migrationBuilder.DropIndex(
                name: "IX_RiskAssessments_CreatedAt",
                table: "RiskAssessments");

            migrationBuilder.DropIndex(
                name: "IX_RiskAssessments_Status",
                table: "RiskAssessments");

            migrationBuilder.DropIndex(
                name: "IX_Risks_UpdatedAt",
                table: "Risks");

            migrationBuilder.DropIndex(
                name: "IX_Risks_UpdatedBy",
                table: "Risks");

            migrationBuilder.DropIndex(
                name: "IX_Risks_CreatedBy",
                table: "Risks");

            migrationBuilder.DropIndex(
                name: "IX_Risks_Status_ALE",
                table: "Risks");

            migrationBuilder.DropIndex(
                name: "IX_Risks_Status_RiskLevel",
                table: "Risks");

            migrationBuilder.DropIndex(
                name: "IX_Risks_BusinessUnit",
                table: "Risks");

            migrationBuilder.DropIndex(
                name: "IX_Risks_OpenDate",
                table: "Risks");

            migrationBuilder.DropIndex(
                name: "IX_Risks_RiskLevel",
                table: "Risks");

            migrationBuilder.DropIndex(
                name: "IX_Risks_CreatedAt",
                table: "Risks");

            migrationBuilder.DropIndex(
                name: "IX_Risks_Status",
                table: "Risks");
        }
    }
}
