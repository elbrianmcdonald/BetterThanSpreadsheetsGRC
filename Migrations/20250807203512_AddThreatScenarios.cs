using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddThreatScenarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ThreatScenarioId",
                table: "ThreatEvents",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ThreatScenarioId",
                table: "LossEvents",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ThreatScenarios",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RiskAssessmentId = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    QualitativeLikelihood = table.Column<int>(type: "integer", nullable: true),
                    QualitativeImpact = table.Column<int>(type: "integer", nullable: true),
                    QualitativeExposure = table.Column<int>(type: "integer", nullable: true),
                    QualitativeRiskScore = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThreatScenarios", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ThreatScenarios_RiskAssessments_RiskAssessmentId",
                        column: x => x.RiskAssessmentId,
                        principalTable: "RiskAssessments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ThreatEvents_ThreatScenarioId",
                table: "ThreatEvents",
                column: "ThreatScenarioId");

            migrationBuilder.CreateIndex(
                name: "IX_LossEvents_ThreatScenarioId",
                table: "LossEvents",
                column: "ThreatScenarioId");

            migrationBuilder.CreateIndex(
                name: "IX_ThreatScenarios_RiskAssessmentId",
                table: "ThreatScenarios",
                column: "RiskAssessmentId");

            migrationBuilder.AddForeignKey(
                name: "FK_LossEvents_ThreatScenarios_ThreatScenarioId",
                table: "LossEvents",
                column: "ThreatScenarioId",
                principalTable: "ThreatScenarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_QualitativeControls_ThreatScenarios_RiskAssessmentId",
                table: "QualitativeControls",
                column: "RiskAssessmentId",
                principalTable: "ThreatScenarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Risks_ThreatScenarios_RiskAssessmentId",
                table: "Risks",
                column: "RiskAssessmentId",
                principalTable: "ThreatScenarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ThreatEvents_ThreatScenarios_ThreatScenarioId",
                table: "ThreatEvents",
                column: "ThreatScenarioId",
                principalTable: "ThreatScenarios",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LossEvents_ThreatScenarios_ThreatScenarioId",
                table: "LossEvents");

            migrationBuilder.DropForeignKey(
                name: "FK_QualitativeControls_ThreatScenarios_RiskAssessmentId",
                table: "QualitativeControls");

            migrationBuilder.DropForeignKey(
                name: "FK_Risks_ThreatScenarios_RiskAssessmentId",
                table: "Risks");

            migrationBuilder.DropForeignKey(
                name: "FK_ThreatEvents_ThreatScenarios_ThreatScenarioId",
                table: "ThreatEvents");

            migrationBuilder.DropTable(
                name: "ThreatScenarios");

            migrationBuilder.DropIndex(
                name: "IX_ThreatEvents_ThreatScenarioId",
                table: "ThreatEvents");

            migrationBuilder.DropIndex(
                name: "IX_LossEvents_ThreatScenarioId",
                table: "LossEvents");

            migrationBuilder.DropColumn(
                name: "ThreatScenarioId",
                table: "ThreatEvents");

            migrationBuilder.DropColumn(
                name: "ThreatScenarioId",
                table: "LossEvents");
        }
    }
}
