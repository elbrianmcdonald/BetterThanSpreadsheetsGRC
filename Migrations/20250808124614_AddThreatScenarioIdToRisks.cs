using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddThreatScenarioIdToRisks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ThreatScenarioId",
                table: "Risks",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Risks_ThreatScenarioId",
                table: "Risks",
                column: "ThreatScenarioId");

            migrationBuilder.AddForeignKey(
                name: "FK_Risks_ThreatScenarios_ThreatScenarioId",
                table: "Risks",
                column: "ThreatScenarioId",
                principalTable: "ThreatScenarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Risks_ThreatScenarios_ThreatScenarioId",
                table: "Risks");

            migrationBuilder.DropIndex(
                name: "IX_Risks_ThreatScenarioId",
                table: "Risks");

            migrationBuilder.DropColumn(
                name: "ThreatScenarioId",
                table: "Risks");
        }
    }
}
