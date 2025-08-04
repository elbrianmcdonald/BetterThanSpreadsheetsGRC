using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddThreatModeling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LinkedRiskAssessmentId",
                table: "RiskAcceptanceRequests",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SSLCertificates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CertificateData = table.Column<string>(type: "text", nullable: false),
                    PrivateKeyData = table.Column<string>(type: "text", nullable: false),
                    Password = table.Column<string>(type: "text", nullable: true),
                    ValidFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ValidTo = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Subject = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Issuer = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Thumbprint = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SSLCertificates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ThreatModels",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Asset = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    BusinessUnit = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AssetOwner = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AssetValue = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ApprovedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NextReviewDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewNotes = table.Column<string>(type: "text", nullable: true),
                    RiskAssessmentId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThreatModels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ThreatModels_RiskAssessments_RiskAssessmentId",
                        column: x => x.RiskAssessmentId,
                        principalTable: "RiskAssessments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "SSLSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EnableHttpsRedirection = table.Column<bool>(type: "boolean", nullable: false),
                    RequireHttps = table.Column<bool>(type: "boolean", nullable: false),
                    HttpsPort = table.Column<int>(type: "integer", nullable: false),
                    ActiveCertificateId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SSLSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SSLSettings_SSLCertificates_ActiveCertificateId",
                        column: x => x.ActiveCertificateId,
                        principalTable: "SSLCertificates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Attacks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    KillChainPhase = table.Column<int>(type: "integer", nullable: false),
                    AttackVector = table.Column<int>(type: "integer", nullable: false),
                    AttackComplexity = table.Column<int>(type: "integer", nullable: false),
                    ThreatActorType = table.Column<int>(type: "integer", nullable: false),
                    Prerequisites = table.Column<string>(type: "text", nullable: true),
                    AttackSteps = table.Column<string>(type: "text", nullable: false),
                    ToolsAndTechniques = table.Column<string>(type: "text", nullable: true),
                    IndicatorsOfCompromise = table.Column<string>(type: "text", nullable: true),
                    Impact = table.Column<int>(type: "integer", nullable: false),
                    Likelihood = table.Column<int>(type: "integer", nullable: false),
                    RiskLevel = table.Column<int>(type: "integer", nullable: false),
                    ExistingControls = table.Column<string>(type: "text", nullable: true),
                    RecommendedMitigations = table.Column<string>(type: "text", nullable: true),
                    MitreAttackTechnique = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    MitreAttackTactic = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DetectionDifficulty = table.Column<int>(type: "integer", nullable: false),
                    ResidualRisk = table.Column<int>(type: "integer", nullable: false),
                    TreatmentStrategy = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    ThreatModelId = table.Column<int>(type: "integer", nullable: false),
                    FindingId = table.Column<int>(type: "integer", nullable: true),
                    RiskId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Attacks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Attacks_Findings_FindingId",
                        column: x => x.FindingId,
                        principalTable: "Findings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Attacks_Risks_RiskId",
                        column: x => x.RiskId,
                        principalTable: "Risks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Attacks_ThreatModels_ThreatModelId",
                        column: x => x.ThreatModelId,
                        principalTable: "ThreatModels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RiskAcceptanceRequests_LinkedRiskAssessmentId",
                table: "RiskAcceptanceRequests",
                column: "LinkedRiskAssessmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Attacks_FindingId",
                table: "Attacks",
                column: "FindingId");

            migrationBuilder.CreateIndex(
                name: "IX_Attacks_RiskId",
                table: "Attacks",
                column: "RiskId");

            migrationBuilder.CreateIndex(
                name: "IX_Attacks_ThreatModelId",
                table: "Attacks",
                column: "ThreatModelId");

            migrationBuilder.CreateIndex(
                name: "IX_SSLSettings_ActiveCertificateId",
                table: "SSLSettings",
                column: "ActiveCertificateId");

            migrationBuilder.CreateIndex(
                name: "IX_SSLSettings_Id",
                table: "SSLSettings",
                column: "Id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ThreatModels_RiskAssessmentId",
                table: "ThreatModels",
                column: "RiskAssessmentId");

            migrationBuilder.AddForeignKey(
                name: "FK_RiskAcceptanceRequests_RiskAssessments_LinkedRiskAssessment~",
                table: "RiskAcceptanceRequests",
                column: "LinkedRiskAssessmentId",
                principalTable: "RiskAssessments",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RiskAcceptanceRequests_RiskAssessments_LinkedRiskAssessment~",
                table: "RiskAcceptanceRequests");

            migrationBuilder.DropTable(
                name: "Attacks");

            migrationBuilder.DropTable(
                name: "SSLSettings");

            migrationBuilder.DropTable(
                name: "ThreatModels");

            migrationBuilder.DropTable(
                name: "SSLCertificates");

            migrationBuilder.DropIndex(
                name: "IX_RiskAcceptanceRequests_LinkedRiskAssessmentId",
                table: "RiskAcceptanceRequests");

            migrationBuilder.DropColumn(
                name: "LinkedRiskAssessmentId",
                table: "RiskAcceptanceRequests");
        }
    }
}
