using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddKillChainPhaseSteps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ActionsOnObjectivesSteps",
                table: "Attacks",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CommandAndControlSteps",
                table: "Attacks",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliverySteps",
                table: "Attacks",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExploitationSteps",
                table: "Attacks",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InstallationSteps",
                table: "Attacks",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReconnaissanceSteps",
                table: "Attacks",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WeaponizationSteps",
                table: "Attacks",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActionsOnObjectivesSteps",
                table: "Attacks");

            migrationBuilder.DropColumn(
                name: "CommandAndControlSteps",
                table: "Attacks");

            migrationBuilder.DropColumn(
                name: "DeliverySteps",
                table: "Attacks");

            migrationBuilder.DropColumn(
                name: "ExploitationSteps",
                table: "Attacks");

            migrationBuilder.DropColumn(
                name: "InstallationSteps",
                table: "Attacks");

            migrationBuilder.DropColumn(
                name: "ReconnaissanceSteps",
                table: "Attacks");

            migrationBuilder.DropColumn(
                name: "WeaponizationSteps",
                table: "Attacks");
        }
    }
}
