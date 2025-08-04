using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class EnhancedThreatModeling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Framework",
                table: "ThreatModels",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Industry",
                table: "ThreatModels",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "OrganizationName",
                table: "ThreatModels",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Scope",
                table: "ThreatModels",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "AttackScenarios",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ThreatModelId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    ThreatActor = table.Column<int>(type: "integer", nullable: false),
                    ThreatActorProfile = table.Column<string>(type: "text", nullable: false),
                    InitialAccess = table.Column<string>(type: "text", nullable: false),
                    Objective = table.Column<string>(type: "text", nullable: false),
                    Impact = table.Column<int>(type: "integer", nullable: false),
                    Likelihood = table.Column<int>(type: "integer", nullable: false),
                    OverallRisk = table.Column<int>(type: "integer", nullable: false),
                    BusinessImpact = table.Column<string>(type: "text", nullable: false),
                    EstimatedLoss = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    EstimatedDurationHours = table.Column<int>(type: "integer", nullable: false),
                    Complexity = table.Column<int>(type: "integer", nullable: false),
                    ExistingControls = table.Column<string>(type: "text", nullable: false),
                    ControlGaps = table.Column<string>(type: "text", nullable: false),
                    RecommendedMitigations = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttackScenarios", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AttackScenarios_ThreatModels_ThreatModelId",
                        column: x => x.ThreatModelId,
                        principalTable: "ThreatModels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Environments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ThreatModelId = table.Column<int>(type: "integer", nullable: false),
                    EnvironmentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    AccessType = table.Column<int>(type: "integer", nullable: false),
                    IsSegmented = table.Column<bool>(type: "boolean", nullable: false),
                    NetworkDetails = table.Column<string>(type: "text", nullable: false),
                    SecurityControls = table.Column<string>(type: "text", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Environments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Environments_ThreatModels_ThreatModelId",
                        column: x => x.ThreatModelId,
                        principalTable: "ThreatModels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "KillChainActivities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Phase = table.Column<int>(type: "integer", nullable: false),
                    EnvironmentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Techniques = table.Column<string>(type: "text", nullable: false),
                    Tools = table.Column<string>(type: "text", nullable: false),
                    Indicators = table.Column<string>(type: "text", nullable: false),
                    Prerequisites = table.Column<string>(type: "text", nullable: false),
                    ExpectedOutcome = table.Column<string>(type: "text", nullable: false),
                    EstimatedTimeMinutes = table.Column<int>(type: "integer", nullable: false),
                    Complexity = table.Column<int>(type: "integer", nullable: false),
                    RequiresUserInteraction = table.Column<bool>(type: "boolean", nullable: false),
                    IsCustom = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KillChainActivities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MitreTechniques",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TechniqueId = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Tactic = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ParentTechniqueId = table.Column<int>(type: "integer", nullable: true),
                    Platforms = table.Column<string>(type: "text", nullable: false),
                    DataSources = table.Column<string>(type: "text", nullable: false),
                    Detection = table.Column<string>(type: "text", nullable: false),
                    Mitigation = table.Column<string>(type: "text", nullable: false),
                    Examples = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<string>(type: "text", nullable: false),
                    IsSubTechnique = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeprecated = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MitreTechniques", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MitreTechniques_MitreTechniques_ParentTechniqueId",
                        column: x => x.ParentTechniqueId,
                        principalTable: "MitreTechniques",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScenarioRecommendations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AttackScenarioId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    Implementation = table.Column<string>(type: "text", nullable: false),
                    EstimatedCost = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    EstimatedEffortHours = table.Column<int>(type: "integer", nullable: false),
                    RiskReductionPercentage = table.Column<int>(type: "integer", nullable: false),
                    Prerequisites = table.Column<string>(type: "text", nullable: false),
                    Dependencies = table.Column<string>(type: "text", nullable: false),
                    ComplianceAlignment = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Owner = table.Column<string>(type: "text", nullable: false),
                    TargetCompletionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScenarioRecommendations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScenarioRecommendations_AttackScenarios_AttackScenarioId",
                        column: x => x.AttackScenarioId,
                        principalTable: "AttackScenarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AttackPaths",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AttackScenarioId = table.Column<int>(type: "integer", nullable: false),
                    SourceEnvironmentId = table.Column<int>(type: "integer", nullable: false),
                    TargetEnvironmentId = table.Column<int>(type: "integer", nullable: false),
                    PathName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    AttackVector = table.Column<string>(type: "text", nullable: false),
                    Prerequisites = table.Column<string>(type: "text", nullable: false),
                    Complexity = table.Column<int>(type: "integer", nullable: false),
                    RequiresInsiderAccess = table.Column<bool>(type: "boolean", nullable: false),
                    RequiresPhysicalAccess = table.Column<bool>(type: "boolean", nullable: false),
                    EstimatedTimeMinutes = table.Column<int>(type: "integer", nullable: false),
                    ExploitedVulnerabilities = table.Column<string>(type: "text", nullable: false),
                    RequiredTools = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttackPaths", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AttackPaths_AttackScenarios_AttackScenarioId",
                        column: x => x.AttackScenarioId,
                        principalTable: "AttackScenarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AttackPaths_Environments_SourceEnvironmentId",
                        column: x => x.SourceEnvironmentId,
                        principalTable: "Environments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AttackPaths_Environments_TargetEnvironmentId",
                        column: x => x.TargetEnvironmentId,
                        principalTable: "Environments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AttackScenarioMitreTechniques",
                columns: table => new
                {
                    AttackScenariosId = table.Column<int>(type: "integer", nullable: false),
                    MitreTechniquesId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttackScenarioMitreTechniques", x => new { x.AttackScenariosId, x.MitreTechniquesId });
                    table.ForeignKey(
                        name: "FK_AttackScenarioMitreTechniques_AttackScenarios_AttackScenari~",
                        column: x => x.AttackScenariosId,
                        principalTable: "AttackScenarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AttackScenarioMitreTechniques_MitreTechniques_MitreTechniqu~",
                        column: x => x.MitreTechniquesId,
                        principalTable: "MitreTechniques",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AttackScenarioSteps",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AttackScenarioId = table.Column<int>(type: "integer", nullable: false),
                    StepNumber = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    KillChainPhase = table.Column<int>(type: "integer", nullable: false),
                    EnvironmentId = table.Column<int>(type: "integer", nullable: true),
                    MitreTechniqueId = table.Column<int>(type: "integer", nullable: true),
                    KillChainActivityId = table.Column<int>(type: "integer", nullable: true),
                    CustomTechnique = table.Column<string>(type: "text", nullable: false),
                    Tools = table.Column<string>(type: "text", nullable: false),
                    Commands = table.Column<string>(type: "text", nullable: false),
                    ExpectedOutcome = table.Column<string>(type: "text", nullable: false),
                    DetectionOpportunities = table.Column<string>(type: "text", nullable: false),
                    PreventionMeasures = table.Column<string>(type: "text", nullable: false),
                    EstimatedTimeMinutes = table.Column<int>(type: "integer", nullable: false),
                    Complexity = table.Column<int>(type: "integer", nullable: false),
                    RequiresPrivilegeEscalation = table.Column<bool>(type: "boolean", nullable: false),
                    LeavesForensicEvidence = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttackScenarioSteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AttackScenarioSteps_AttackScenarios_AttackScenarioId",
                        column: x => x.AttackScenarioId,
                        principalTable: "AttackScenarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AttackScenarioSteps_Environments_EnvironmentId",
                        column: x => x.EnvironmentId,
                        principalTable: "Environments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_AttackScenarioSteps_KillChainActivities_KillChainActivityId",
                        column: x => x.KillChainActivityId,
                        principalTable: "KillChainActivities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_AttackScenarioSteps_MitreTechniques_MitreTechniqueId",
                        column: x => x.MitreTechniqueId,
                        principalTable: "MitreTechniques",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "TechniqueEnvironmentMappings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MitreTechniqueId = table.Column<int>(type: "integer", nullable: false),
                    EnvironmentId = table.Column<int>(type: "integer", nullable: false),
                    IsApplicable = table.Column<bool>(type: "boolean", nullable: false),
                    EnvironmentSpecificNotes = table.Column<string>(type: "text", nullable: false),
                    CustomImplementation = table.Column<string>(type: "text", nullable: false),
                    ImplementationDifficulty = table.Column<int>(type: "integer", nullable: false),
                    DetectionMethods = table.Column<string>(type: "text", nullable: false),
                    PreventionMethods = table.Column<string>(type: "text", nullable: false),
                    RiskScore = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TechniqueEnvironmentMappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TechniqueEnvironmentMappings_Environments_EnvironmentId",
                        column: x => x.EnvironmentId,
                        principalTable: "Environments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TechniqueEnvironmentMappings_MitreTechniques_MitreTechnique~",
                        column: x => x.MitreTechniqueId,
                        principalTable: "MitreTechniques",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AttackPaths_AttackScenarioId",
                table: "AttackPaths",
                column: "AttackScenarioId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackPaths_SourceEnvironmentId",
                table: "AttackPaths",
                column: "SourceEnvironmentId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackPaths_TargetEnvironmentId",
                table: "AttackPaths",
                column: "TargetEnvironmentId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackScenarioMitreTechniques_MitreTechniquesId",
                table: "AttackScenarioMitreTechniques",
                column: "MitreTechniquesId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackScenarios_ThreatModelId",
                table: "AttackScenarios",
                column: "ThreatModelId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackScenarioSteps_AttackScenarioId",
                table: "AttackScenarioSteps",
                column: "AttackScenarioId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackScenarioSteps_EnvironmentId",
                table: "AttackScenarioSteps",
                column: "EnvironmentId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackScenarioSteps_KillChainActivityId",
                table: "AttackScenarioSteps",
                column: "KillChainActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_AttackScenarioSteps_MitreTechniqueId",
                table: "AttackScenarioSteps",
                column: "MitreTechniqueId");

            migrationBuilder.CreateIndex(
                name: "IX_Environments_ThreatModelId_EnvironmentType",
                table: "Environments",
                columns: new[] { "ThreatModelId", "EnvironmentType" });

            migrationBuilder.CreateIndex(
                name: "IX_KillChainActivities_Phase_EnvironmentType",
                table: "KillChainActivities",
                columns: new[] { "Phase", "EnvironmentType" });

            migrationBuilder.CreateIndex(
                name: "IX_MitreTechniques_ParentTechniqueId",
                table: "MitreTechniques",
                column: "ParentTechniqueId");

            migrationBuilder.CreateIndex(
                name: "IX_MitreTechniques_TechniqueId",
                table: "MitreTechniques",
                column: "TechniqueId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScenarioRecommendations_AttackScenarioId",
                table: "ScenarioRecommendations",
                column: "AttackScenarioId");

            migrationBuilder.CreateIndex(
                name: "IX_TechniqueEnvironmentMappings_EnvironmentId",
                table: "TechniqueEnvironmentMappings",
                column: "EnvironmentId");

            migrationBuilder.CreateIndex(
                name: "IX_TechniqueEnvironmentMappings_MitreTechniqueId",
                table: "TechniqueEnvironmentMappings",
                column: "MitreTechniqueId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AttackPaths");

            migrationBuilder.DropTable(
                name: "AttackScenarioMitreTechniques");

            migrationBuilder.DropTable(
                name: "AttackScenarioSteps");

            migrationBuilder.DropTable(
                name: "ScenarioRecommendations");

            migrationBuilder.DropTable(
                name: "TechniqueEnvironmentMappings");

            migrationBuilder.DropTable(
                name: "KillChainActivities");

            migrationBuilder.DropTable(
                name: "AttackScenarios");

            migrationBuilder.DropTable(
                name: "Environments");

            migrationBuilder.DropTable(
                name: "MitreTechniques");

            migrationBuilder.DropColumn(
                name: "Framework",
                table: "ThreatModels");

            migrationBuilder.DropColumn(
                name: "Industry",
                table: "ThreatModels");

            migrationBuilder.DropColumn(
                name: "OrganizationName",
                table: "ThreatModels");

            migrationBuilder.DropColumn(
                name: "Scope",
                table: "ThreatModels");
        }
    }
}
