using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddComprehensiveSlaConfiguration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AssessmentApprovalSlaHours",
                table: "RiskMatrices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ComplianceAssessmentSlaHours",
                table: "RiskMatrices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CriticalRiskReviewSlaHours",
                table: "RiskMatrices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ExceptionRequestApprovalSlaHours",
                table: "RiskMatrices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "HighRiskReviewSlaHours",
                table: "RiskMatrices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "LowRiskReviewSlaHours",
                table: "RiskMatrices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MaturityAssessmentSlaHours",
                table: "RiskMatrices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MediumRiskReviewSlaHours",
                table: "RiskMatrices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RiskAcceptanceApprovalSlaHours",
                table: "RiskMatrices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RiskAssessmentSlaHours",
                table: "RiskMatrices",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AssessmentApprovalSlaHours",
                table: "RiskMatrices");

            migrationBuilder.DropColumn(
                name: "ComplianceAssessmentSlaHours",
                table: "RiskMatrices");

            migrationBuilder.DropColumn(
                name: "CriticalRiskReviewSlaHours",
                table: "RiskMatrices");

            migrationBuilder.DropColumn(
                name: "ExceptionRequestApprovalSlaHours",
                table: "RiskMatrices");

            migrationBuilder.DropColumn(
                name: "HighRiskReviewSlaHours",
                table: "RiskMatrices");

            migrationBuilder.DropColumn(
                name: "LowRiskReviewSlaHours",
                table: "RiskMatrices");

            migrationBuilder.DropColumn(
                name: "MaturityAssessmentSlaHours",
                table: "RiskMatrices");

            migrationBuilder.DropColumn(
                name: "MediumRiskReviewSlaHours",
                table: "RiskMatrices");

            migrationBuilder.DropColumn(
                name: "RiskAcceptanceApprovalSlaHours",
                table: "RiskMatrices");

            migrationBuilder.DropColumn(
                name: "RiskAssessmentSlaHours",
                table: "RiskMatrices");
        }
    }
}
