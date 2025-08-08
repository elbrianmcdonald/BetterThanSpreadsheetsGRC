using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddSelectedControlsFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SelectedDetectiveControls",
                table: "RiskAssessments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SelectedProtectiveControls",
                table: "RiskAssessments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SelectedResponseControls",
                table: "RiskAssessments",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SelectedDetectiveControls",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SelectedProtectiveControls",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SelectedResponseControls",
                table: "RiskAssessments");
        }
    }
}
