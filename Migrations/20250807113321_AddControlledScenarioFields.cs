using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddControlledScenarioFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ALEReductionAmount",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ALEReductionPercentage",
                table: "RiskAssessments",
                type: "numeric(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledALE_10th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledALE_50th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledALE_90th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledALE_95th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledAnnualLossExpectancy",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledPrimaryLossMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledPrimaryLossMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledPrimaryLossMost",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledSecondaryLossMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledSecondaryLossMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledSecondaryLossMost",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledThreatEventFrequencyMax",
                table: "RiskAssessments",
                type: "numeric(18,6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledThreatEventFrequencyMin",
                table: "RiskAssessments",
                type: "numeric(18,6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledThreatEventFrequencyMost",
                table: "RiskAssessments",
                type: "numeric(18,6)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ALEReductionAmount",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ALEReductionPercentage",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledALE_10th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledALE_50th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledALE_90th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledALE_95th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledAnnualLossExpectancy",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledPrimaryLossMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledPrimaryLossMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledPrimaryLossMost",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledSecondaryLossMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledSecondaryLossMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledSecondaryLossMost",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledThreatEventFrequencyMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledThreatEventFrequencyMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledThreatEventFrequencyMost",
                table: "RiskAssessments");
        }
    }
}
