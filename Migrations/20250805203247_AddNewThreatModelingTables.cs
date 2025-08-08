using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddNewThreatModelingTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LossEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    MitreTechniqueId = table.Column<int>(type: "integer", nullable: true),
                    CustomTechnique = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    LefMinimum = table.Column<double>(type: "double precision", nullable: false),
                    LefMaximum = table.Column<double>(type: "double precision", nullable: false),
                    LefMostLikely = table.Column<double>(type: "double precision", nullable: false),
                    PrimaryLossMinimum = table.Column<double>(type: "double precision", nullable: true),
                    PrimaryLossMaximum = table.Column<double>(type: "double precision", nullable: true),
                    PrimaryLossMostLikely = table.Column<double>(type: "double precision", nullable: true),
                    SecondaryLossMinimum = table.Column<double>(type: "double precision", nullable: true),
                    SecondaryLossMaximum = table.Column<double>(type: "double precision", nullable: true),
                    SecondaryLossMostLikely = table.Column<double>(type: "double precision", nullable: true),
                    AleMinimum = table.Column<double>(type: "double precision", nullable: false),
                    AleMaximum = table.Column<double>(type: "double precision", nullable: false),
                    AleMostLikely = table.Column<double>(type: "double precision", nullable: false),
                    PreventativeControls = table.Column<string>(type: "text", nullable: false),
                    DetectiveControls = table.Column<string>(type: "text", nullable: false),
                    DataSources = table.Column<string>(type: "text", nullable: false),
                    LossType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    BusinessImpactCategory = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedBy = table.Column<string>(type: "text", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LossEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LossEvents_MitreTechniques_MitreTechniqueId",
                        column: x => x.MitreTechniqueId,
                        principalTable: "MitreTechniques",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "AttackStepVulnerabilities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    MitreTechniqueId = table.Column<int>(type: "integer", nullable: true),
                    CustomTechnique = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    VulnMinimum = table.Column<double>(type: "double precision", nullable: false),
                    VulnMaximum = table.Column<double>(type: "double precision", nullable: false),
                    VulnMostLikely = table.Column<double>(type: "double precision", nullable: false),
                    PreventativeControls = table.Column<string>(type: "text", nullable: false),
                    DetectiveControls = table.Column<string>(type: "text", nullable: false),
                    DataSources = table.Column<string>(type: "text", nullable: false),
                    NextVulnerabilityId = table.Column<int>(type: "integer", nullable: true),
                    LossEventId = table.Column<int>(type: "integer", nullable: true),
                    StepOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedBy = table.Column<string>(type: "text", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttackStepVulnerabilities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AttackStepVulnerabilities_AttackStepVulnerabilities_NextVul~",
                        column: x => x.NextVulnerabilityId,
                        principalTable: "AttackStepVulnerabilities",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AttackStepVulnerabilities_LossEvents_LossEventId",
                        column: x => x.LossEventId,
                        principalTable: "LossEvents",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AttackStepVulnerabilities_MitreTechniques_MitreTechniqueId",
                        column: x => x.MitreTechniqueId,
                        principalTable: "MitreTechniques",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ThreatEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    MitreTechniqueId = table.Column<int>(type: "integer", nullable: true),
                    CustomTechnique = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    TefMinimum = table.Column<double>(type: "double precision", nullable: false),
                    TefMaximum = table.Column<double>(type: "double precision", nullable: false),
                    TefMostLikely = table.Column<double>(type: "double precision", nullable: false),
                    PreventativeControls = table.Column<string>(type: "text", nullable: false),
                    DetectiveControls = table.Column<string>(type: "text", nullable: false),
                    DataSources = table.Column<string>(type: "text", nullable: false),
                    NextVulnerabilityId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedBy = table.Column<string>(type: "text", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThreatEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ThreatEvents_AttackStepVulnerabilities_NextVulnerabilityId",
                        column: x => x.NextVulnerabilityId,
                        principalTable: "AttackStepVulnerabilities",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ThreatEvents_MitreTechniques_MitreTechniqueId",
                        column: x => x.MitreTechniqueId,
                        principalTable: "MitreTechniques",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "AttackChains",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ThreatEventId = table.Column<int>(type: "integer", nullable: false),
                    LossEventId = table.Column<int>(type: "integer", nullable: false),
                    RiskAssessmentId = table.Column<int>(type: "integer", nullable: true),
                    EnvironmentId = table.Column<int>(type: "integer", nullable: true),
                    AssetCategory = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AttackVector = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ChainProbability = table.Column<double>(type: "double precision", nullable: false),
                    ChainAleMinimum = table.Column<double>(type: "double precision", nullable: false),
                    ChainAleMaximum = table.Column<double>(type: "double precision", nullable: false),
                    ChainAleMostLikely = table.Column<double>(type: "double precision", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ReviewedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedBy = table.Column<string>(type: "text", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttackChains", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AttackChains_Environments_EnvironmentId",
                        column: x => x.EnvironmentId,
                        principalTable: "Environments",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AttackChains_LossEvents_LossEventId",
                        column: x => x.LossEventId,
                        principalTable: "LossEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AttackChains_RiskAssessments_RiskAssessmentId",
                        column: x => x.RiskAssessmentId,
                        principalTable: "RiskAssessments",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AttackChains_ThreatEvents_ThreatEventId",
                        column: x => x.ThreatEventId,
                        principalTable: "ThreatEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AttackChainSteps",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AttackChainId = table.Column<int>(type: "integer", nullable: false),
                    StepOrder = table.Column<int>(type: "integer", nullable: false),
                    StepType = table.Column<int>(type: "integer", nullable: false),
                    VulnerabilityId = table.Column<int>(type: "integer", nullable: true),
                    IsFinalStep = table.Column<bool>(type: "boolean", nullable: false),
                    StepProbability = table.Column<double>(type: "double precision", nullable: false),
                    CumulativeProbability = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttackChainSteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AttackChainSteps_AttackChains_AttackChainId",
                        column: x => x.AttackChainId,
                        principalTable: "AttackChains",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AttackChainSteps_AttackStepVulnerabilities_VulnerabilityId",
                        column: x => x.VulnerabilityId,
                        principalTable: "AttackStepVulnerabilities",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_AttackChains_EnvironmentId",
                table: "AttackChains",
                column: "EnvironmentId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackChains_LossEventId",
                table: "AttackChains",
                column: "LossEventId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackChains_RiskAssessmentId",
                table: "AttackChains",
                column: "RiskAssessmentId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackChains_ThreatEventId",
                table: "AttackChains",
                column: "ThreatEventId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackChainSteps_AttackChainId",
                table: "AttackChainSteps",
                column: "AttackChainId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackChainSteps_VulnerabilityId",
                table: "AttackChainSteps",
                column: "VulnerabilityId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackStepVulnerabilities_LossEventId",
                table: "AttackStepVulnerabilities",
                column: "LossEventId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackStepVulnerabilities_MitreTechniqueId",
                table: "AttackStepVulnerabilities",
                column: "MitreTechniqueId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackStepVulnerabilities_NextVulnerabilityId",
                table: "AttackStepVulnerabilities",
                column: "NextVulnerabilityId");

            migrationBuilder.CreateIndex(
                name: "IX_LossEvents_MitreTechniqueId",
                table: "LossEvents",
                column: "MitreTechniqueId");

            migrationBuilder.CreateIndex(
                name: "IX_ThreatEvents_MitreTechniqueId",
                table: "ThreatEvents",
                column: "MitreTechniqueId");

            migrationBuilder.CreateIndex(
                name: "IX_ThreatEvents_NextVulnerabilityId",
                table: "ThreatEvents",
                column: "NextVulnerabilityId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AttackChainSteps");

            migrationBuilder.DropTable(
                name: "AttackChains");

            migrationBuilder.DropTable(
                name: "ThreatEvents");

            migrationBuilder.DropTable(
                name: "AttackStepVulnerabilities");

            migrationBuilder.DropTable(
                name: "LossEvents");
        }
    }
}
