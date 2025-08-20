using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddRiskMatrixThresholds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "QualitativeCriticalThreshold",
                table: "RiskMatrices",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "QualitativeHighThreshold",
                table: "RiskMatrices",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "QualitativeMediumThreshold",
                table: "RiskMatrices",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "RiskAppetiteThreshold",
                table: "RiskMatrices",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "QualitativeCriticalThreshold",
                table: "RiskMatrices");

            migrationBuilder.DropColumn(
                name: "QualitativeHighThreshold",
                table: "RiskMatrices");

            migrationBuilder.DropColumn(
                name: "QualitativeMediumThreshold",
                table: "RiskMatrices");

            migrationBuilder.DropColumn(
                name: "RiskAppetiteThreshold",
                table: "RiskMatrices");
        }
    }
}
