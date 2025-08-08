using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class FixMissingPrimaryLossMax : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "PrimaryLossMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PrimaryLossMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PrimaryLossMost",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SecondaryLossMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SecondaryLossMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SecondaryLossMost",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PrimaryLossMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "PrimaryLossMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "PrimaryLossMost",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SecondaryLossMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SecondaryLossMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SecondaryLossMost",
                table: "RiskAssessments");
        }
    }
}
