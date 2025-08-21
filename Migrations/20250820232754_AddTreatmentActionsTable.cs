using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddTreatmentActionsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TreatmentActions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ScenarioRiskId = table.Column<int>(type: "integer", nullable: false),
                    ActionDescription = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    AssignedTo = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AssignedTeam = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ExpectedCompletionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActualCompletionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    ProgressNotes = table.Column<string>(type: "text", nullable: false),
                    EstimatedEffortHours = table.Column<int>(type: "integer", nullable: true),
                    ActualEffortHours = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TreatmentActions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TreatmentActions_ScenarioRisks_ScenarioRiskId",
                        column: x => x.ScenarioRiskId,
                        principalTable: "ScenarioRisks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TreatmentActions_ScenarioRiskId",
                table: "TreatmentActions",
                column: "ScenarioRiskId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TreatmentActions");
        }
    }
}
