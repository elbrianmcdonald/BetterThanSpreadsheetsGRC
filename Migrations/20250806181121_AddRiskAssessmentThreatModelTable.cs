using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddRiskAssessmentThreatModelTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "InsuranceCoverageLimit",
                table: "RiskLevelSettings",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "InsuranceCoveragePercentage",
                table: "RiskLevelSettings",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "InsuranceDeductible",
                table: "RiskLevelSettings",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "InsuranceEnabledByDefault",
                table: "RiskLevelSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "RiskAssessmentThreatModels",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RiskAssessmentId = table.Column<int>(type: "integer", nullable: false),
                    TemplateAttackChainId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ThreatEventData = table.Column<string>(type: "jsonb", nullable: false),
                    VulnerabilitiesData = table.Column<string>(type: "jsonb", nullable: false),
                    LossEventData = table.Column<string>(type: "jsonb", nullable: false),
                    ALEMinimum = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ALEMostLikely = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ALEMaximum = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    LEFValue = table.Column<decimal>(type: "numeric(8,4)", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", nullable: true),
                    ModifiedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ModifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RiskAssessmentThreatModels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RiskAssessmentThreatModels_AttackChains_TemplateAttackChain~",
                        column: x => x.TemplateAttackChainId,
                        principalTable: "AttackChains",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RiskAssessmentThreatModels_RiskAssessments_RiskAssessmentId",
                        column: x => x.RiskAssessmentId,
                        principalTable: "RiskAssessments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RiskAssessmentThreatModels_RiskAssessmentId",
                table: "RiskAssessmentThreatModels",
                column: "RiskAssessmentId");

            migrationBuilder.CreateIndex(
                name: "IX_RiskAssessmentThreatModels_TemplateAttackChainId",
                table: "RiskAssessmentThreatModels",
                column: "TemplateAttackChainId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RiskAssessmentThreatModels");

            migrationBuilder.DropColumn(
                name: "InsuranceCoverageLimit",
                table: "RiskLevelSettings");

            migrationBuilder.DropColumn(
                name: "InsuranceCoveragePercentage",
                table: "RiskLevelSettings");

            migrationBuilder.DropColumn(
                name: "InsuranceDeductible",
                table: "RiskLevelSettings");

            migrationBuilder.DropColumn(
                name: "InsuranceEnabledByDefault",
                table: "RiskLevelSettings");
        }
    }
}
