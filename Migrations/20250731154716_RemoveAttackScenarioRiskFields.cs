using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class RemoveAttackScenarioRiskFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BusinessImpact",
                table: "AttackScenarios");

            migrationBuilder.DropColumn(
                name: "EstimatedLoss",
                table: "AttackScenarios");

            migrationBuilder.DropColumn(
                name: "Impact",
                table: "AttackScenarios");

            migrationBuilder.DropColumn(
                name: "Likelihood",
                table: "AttackScenarios");

            migrationBuilder.DropColumn(
                name: "OverallRisk",
                table: "AttackScenarios");

            migrationBuilder.DropColumn(
                name: "ThreatActor",
                table: "AttackScenarios");

            migrationBuilder.DropColumn(
                name: "ThreatActorProfile",
                table: "AttackScenarios");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BusinessImpact",
                table: "AttackScenarios",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "EstimatedLoss",
                table: "AttackScenarios",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Impact",
                table: "AttackScenarios",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Likelihood",
                table: "AttackScenarios",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "OverallRisk",
                table: "AttackScenarios",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ThreatActor",
                table: "AttackScenarios",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ThreatActorProfile",
                table: "AttackScenarios",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
