using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddSlaConfigurationToRiskMatrix : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RiskLevelSettings");

            migrationBuilder.AddColumn<int>(
                name: "CriticalRiskSlaHours",
                table: "RiskMatrices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "HighRiskSlaHours",
                table: "RiskMatrices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "LowRiskSlaHours",
                table: "RiskMatrices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MediumRiskSlaHours",
                table: "RiskMatrices",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CriticalRiskSlaHours",
                table: "RiskMatrices");

            migrationBuilder.DropColumn(
                name: "HighRiskSlaHours",
                table: "RiskMatrices");

            migrationBuilder.DropColumn(
                name: "LowRiskSlaHours",
                table: "RiskMatrices");

            migrationBuilder.DropColumn(
                name: "MediumRiskSlaHours",
                table: "RiskMatrices");

            migrationBuilder.CreateTable(
                name: "RiskLevelSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CybersecurityInsuranceAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    FairCriticalThreshold = table.Column<decimal>(type: "numeric", nullable: false),
                    FairHighThreshold = table.Column<decimal>(type: "numeric", nullable: false),
                    FairMediumThreshold = table.Column<decimal>(type: "numeric", nullable: false),
                    FairRiskAppetiteThreshold = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    InsuranceCoverageLimit = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    InsuranceCoveragePercentage = table.Column<decimal>(type: "numeric", nullable: false),
                    InsuranceDeductible = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    InsuranceEnabledByDefault = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: false),
                    LastModifiedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    QualitativeCriticalThreshold = table.Column<decimal>(type: "numeric", nullable: false),
                    QualitativeHighThreshold = table.Column<decimal>(type: "numeric", nullable: false),
                    QualitativeMediumThreshold = table.Column<decimal>(type: "numeric", nullable: false),
                    RiskAppetiteThreshold = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RiskLevelSettings", x => x.Id);
                });
        }
    }
}
