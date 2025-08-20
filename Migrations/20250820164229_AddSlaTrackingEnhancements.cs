using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddSlaTrackingEnhancements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AcceptanceDate",
                table: "Risks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastReviewDate",
                table: "Risks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewedBy",
                table: "Risks",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SlaDeadline",
                table: "RiskAssessments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SlaDeadline",
                table: "MaturityAssessments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SlaDeadline",
                table: "ComplianceAssessments",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AcceptanceDate",
                table: "Risks");

            migrationBuilder.DropColumn(
                name: "LastReviewDate",
                table: "Risks");

            migrationBuilder.DropColumn(
                name: "ReviewedBy",
                table: "Risks");

            migrationBuilder.DropColumn(
                name: "SlaDeadline",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SlaDeadline",
                table: "MaturityAssessments");

            migrationBuilder.DropColumn(
                name: "SlaDeadline",
                table: "ComplianceAssessments");
        }
    }
}
