using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddFrameworkTypeToMitreTechniques : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MitreFrameworkType",
                table: "ThreatModels",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "FrameworkType",
                table: "MitreTechniques",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MitreFrameworkType",
                table: "ThreatModels");

            migrationBuilder.DropColumn(
                name: "FrameworkType",
                table: "MitreTechniques");
        }
    }
}
