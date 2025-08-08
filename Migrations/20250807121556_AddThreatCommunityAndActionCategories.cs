using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddThreatCommunityAndActionCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ControlledActionSuccess",
                table: "RiskAssessments",
                type: "numeric(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledContactFrequency",
                table: "RiskAssessments",
                type: "numeric(5,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ControlledActionSuccess",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledContactFrequency",
                table: "RiskAssessments");
        }
    }
}
