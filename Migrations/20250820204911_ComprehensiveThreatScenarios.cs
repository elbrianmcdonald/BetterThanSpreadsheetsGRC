using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class ComprehensiveThreatScenarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "QualitativeExposure",
                table: "ThreatScenarios");

            migrationBuilder.DropColumn(
                name: "QualitativeImpact",
                table: "ThreatScenarios");

            migrationBuilder.DropColumn(
                name: "QualitativeLikelihood",
                table: "ThreatScenarios");

            migrationBuilder.DropColumn(
                name: "QualitativeRiskScore",
                table: "ThreatScenarios");

            migrationBuilder.AddColumn<string>(
                name: "ScenarioId",
                table: "ThreatScenarios",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ScenarioName",
                table: "ThreatScenarios",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "ScenarioRisks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ThreatScenarioId = table.Column<int>(type: "integer", nullable: false),
                    RiskName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RiskDescription = table.Column<string>(type: "text", nullable: false),
                    CurrentImpact = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    CurrentLikelihood = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    CurrentExposure = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    CurrentRiskScore = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    CurrentRiskLevel = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    IsCurrentRiskAboveAppetite = table.Column<bool>(type: "boolean", nullable: false),
                    ResidualImpact = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    ResidualLikelihood = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    ResidualExposure = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    ResidualRiskScore = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    ResidualRiskLevel = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    IsResidualRiskAboveAppetite = table.Column<bool>(type: "boolean", nullable: false),
                    RiskTreatmentPlan = table.Column<string>(type: "text", nullable: false),
                    ExpectedCompletionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TreatmentPlanStatus = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScenarioRisks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScenarioRisks_ThreatScenarios_ThreatScenarioId",
                        column: x => x.ThreatScenarioId,
                        principalTable: "ThreatScenarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ThreatActorObjectives",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ThreatScenarioId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    MitreTechnique = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThreatActorObjectives", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ThreatActorObjectives_ThreatScenarios_ThreatScenarioId",
                        column: x => x.ThreatScenarioId,
                        principalTable: "ThreatScenarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ThreatActorSteps",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ThreatScenarioId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    MitreTechnique = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    StepOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThreatActorSteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ThreatActorSteps_ThreatScenarios_ThreatScenarioId",
                        column: x => x.ThreatScenarioId,
                        principalTable: "ThreatScenarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ThreatControls",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ControlName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ControlDescription = table.Column<string>(type: "text", nullable: false),
                    ControlType = table.Column<int>(type: "integer", nullable: false),
                    ControlCategory = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThreatControls", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ThreatVectors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ThreatScenarioId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    MitreTechnique = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThreatVectors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ThreatVectors_ThreatScenarios_ThreatScenarioId",
                        column: x => x.ThreatScenarioId,
                        principalTable: "ThreatScenarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ThreatActorObjectiveControls",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ThreatActorObjectiveId = table.Column<int>(type: "integer", nullable: false),
                    ThreatControlId = table.Column<int>(type: "integer", nullable: false),
                    ImplementationStatus = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThreatActorObjectiveControls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ThreatActorObjectiveControls_ThreatActorObjectives_ThreatAc~",
                        column: x => x.ThreatActorObjectiveId,
                        principalTable: "ThreatActorObjectives",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ThreatActorObjectiveControls_ThreatControls_ThreatControlId",
                        column: x => x.ThreatControlId,
                        principalTable: "ThreatControls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ThreatActorStepControls",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ThreatActorStepId = table.Column<int>(type: "integer", nullable: false),
                    ThreatControlId = table.Column<int>(type: "integer", nullable: false),
                    ImplementationStatus = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThreatActorStepControls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ThreatActorStepControls_ThreatActorSteps_ThreatActorStepId",
                        column: x => x.ThreatActorStepId,
                        principalTable: "ThreatActorSteps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ThreatActorStepControls_ThreatControls_ThreatControlId",
                        column: x => x.ThreatControlId,
                        principalTable: "ThreatControls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ThreatVectorControls",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ThreatVectorId = table.Column<int>(type: "integer", nullable: false),
                    ThreatControlId = table.Column<int>(type: "integer", nullable: false),
                    ImplementationStatus = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThreatVectorControls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ThreatVectorControls_ThreatControls_ThreatControlId",
                        column: x => x.ThreatControlId,
                        principalTable: "ThreatControls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ThreatVectorControls_ThreatVectors_ThreatVectorId",
                        column: x => x.ThreatVectorId,
                        principalTable: "ThreatVectors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScenarioRisks_ThreatScenarioId",
                table: "ScenarioRisks",
                column: "ThreatScenarioId");

            migrationBuilder.CreateIndex(
                name: "IX_ThreatActorObjectiveControls_ThreatActorObjectiveId",
                table: "ThreatActorObjectiveControls",
                column: "ThreatActorObjectiveId");

            migrationBuilder.CreateIndex(
                name: "IX_ThreatActorObjectiveControls_ThreatControlId",
                table: "ThreatActorObjectiveControls",
                column: "ThreatControlId");

            migrationBuilder.CreateIndex(
                name: "IX_ThreatActorObjectives_ThreatScenarioId",
                table: "ThreatActorObjectives",
                column: "ThreatScenarioId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ThreatActorStepControls_ThreatActorStepId",
                table: "ThreatActorStepControls",
                column: "ThreatActorStepId");

            migrationBuilder.CreateIndex(
                name: "IX_ThreatActorStepControls_ThreatControlId",
                table: "ThreatActorStepControls",
                column: "ThreatControlId");

            migrationBuilder.CreateIndex(
                name: "IX_ThreatActorSteps_ThreatScenarioId",
                table: "ThreatActorSteps",
                column: "ThreatScenarioId");

            migrationBuilder.CreateIndex(
                name: "IX_ThreatVectorControls_ThreatControlId",
                table: "ThreatVectorControls",
                column: "ThreatControlId");

            migrationBuilder.CreateIndex(
                name: "IX_ThreatVectorControls_ThreatVectorId",
                table: "ThreatVectorControls",
                column: "ThreatVectorId");

            migrationBuilder.CreateIndex(
                name: "IX_ThreatVectors_ThreatScenarioId",
                table: "ThreatVectors",
                column: "ThreatScenarioId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScenarioRisks");

            migrationBuilder.DropTable(
                name: "ThreatActorObjectiveControls");

            migrationBuilder.DropTable(
                name: "ThreatActorStepControls");

            migrationBuilder.DropTable(
                name: "ThreatVectorControls");

            migrationBuilder.DropTable(
                name: "ThreatActorObjectives");

            migrationBuilder.DropTable(
                name: "ThreatActorSteps");

            migrationBuilder.DropTable(
                name: "ThreatControls");

            migrationBuilder.DropTable(
                name: "ThreatVectors");

            migrationBuilder.DropColumn(
                name: "ScenarioId",
                table: "ThreatScenarios");

            migrationBuilder.DropColumn(
                name: "ScenarioName",
                table: "ThreatScenarios");

            migrationBuilder.AddColumn<decimal>(
                name: "QualitativeExposure",
                table: "ThreatScenarios",
                type: "numeric(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "QualitativeImpact",
                table: "ThreatScenarios",
                type: "numeric(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "QualitativeLikelihood",
                table: "ThreatScenarios",
                type: "numeric(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "QualitativeRiskScore",
                table: "ThreatScenarios",
                type: "numeric(5,2)",
                nullable: true);
        }
    }
}
