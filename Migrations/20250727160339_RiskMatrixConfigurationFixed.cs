using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class RiskMatrixConfigurationFixed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RiskMatrixId",
                table: "RiskAssessments",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RiskMatrices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    MatrixSize = table.Column<int>(type: "integer", nullable: false),
                    MatrixType = table.Column<int>(type: "integer", nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RiskMatrices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RiskMatrixCells",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RiskMatrixId = table.Column<int>(type: "integer", nullable: false),
                    ImpactLevel = table.Column<int>(type: "integer", nullable: false),
                    LikelihoodLevel = table.Column<int>(type: "integer", nullable: false),
                    ExposureLevel = table.Column<int>(type: "integer", nullable: true),
                    ResultingRiskLevel = table.Column<int>(type: "integer", nullable: false),
                    CellColor = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    RiskScore = table.Column<decimal>(type: "numeric(10,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RiskMatrixCells", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RiskMatrixCells_RiskMatrices_RiskMatrixId",
                        column: x => x.RiskMatrixId,
                        principalTable: "RiskMatrices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RiskMatrixLevels",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RiskMatrixId = table.Column<int>(type: "integer", nullable: false),
                    LevelType = table.Column<int>(type: "integer", nullable: false),
                    LevelValue = table.Column<int>(type: "integer", nullable: false),
                    LevelName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ColorCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Multiplier = table.Column<decimal>(type: "numeric(5,2)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RiskMatrixLevels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RiskMatrixLevels_RiskMatrices_RiskMatrixId",
                        column: x => x.RiskMatrixId,
                        principalTable: "RiskMatrices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RiskAssessments_RiskMatrixId",
                table: "RiskAssessments",
                column: "RiskMatrixId");

            migrationBuilder.CreateIndex(
                name: "IX_RiskMatrixCells_RiskMatrixId_ImpactLevel_LikelihoodLevel",
                table: "RiskMatrixCells",
                columns: new[] { "RiskMatrixId", "ImpactLevel", "LikelihoodLevel" },
                unique: true,
                filter: "\"ExposureLevel\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_RiskMatrixCells_RiskMatrixId_ImpactLevel_LikelihoodLevel_Ex~",
                table: "RiskMatrixCells",
                columns: new[] { "RiskMatrixId", "ImpactLevel", "LikelihoodLevel", "ExposureLevel" },
                unique: true,
                filter: "\"ExposureLevel\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_RiskMatrixLevels_RiskMatrixId_LevelType_LevelValue",
                table: "RiskMatrixLevels",
                columns: new[] { "RiskMatrixId", "LevelType", "LevelValue" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_RiskAssessments_RiskMatrices_RiskMatrixId",
                table: "RiskAssessments",
                column: "RiskMatrixId",
                principalTable: "RiskMatrices",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RiskAssessments_RiskMatrices_RiskMatrixId",
                table: "RiskAssessments");

            migrationBuilder.DropTable(
                name: "RiskMatrixCells");

            migrationBuilder.DropTable(
                name: "RiskMatrixLevels");

            migrationBuilder.DropTable(
                name: "RiskMatrices");

            migrationBuilder.DropIndex(
                name: "IX_RiskAssessments_RiskMatrixId",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "RiskMatrixId",
                table: "RiskAssessments");
        }
    }
}
