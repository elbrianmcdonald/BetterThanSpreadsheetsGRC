using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddRiskGenerationToRiskAssessment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "GenerateRisksForRegister",
                table: "RiskAssessments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RisksGenerated",
                table: "RiskAssessments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "RisksGeneratedDate",
                table: "RiskAssessments",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GenerateRisksForRegister",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "RisksGenerated",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "RisksGeneratedDate",
                table: "RiskAssessments");
        }
    }
}
