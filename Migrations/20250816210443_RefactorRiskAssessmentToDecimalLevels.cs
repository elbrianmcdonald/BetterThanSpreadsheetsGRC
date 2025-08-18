using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class RefactorRiskAssessmentToDecimalLevels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "QualitativeLikelihood",
                table: "ThreatScenarios",
                type: "numeric(5,2)",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "QualitativeImpact",
                table: "ThreatScenarios",
                type: "numeric(5,2)",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "QualitativeExposure",
                table: "ThreatScenarios",
                type: "numeric(5,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(3,2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "QualitativeLikelihood",
                table: "RiskAssessments",
                type: "numeric(5,2)",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "QualitativeImpact",
                table: "RiskAssessments",
                type: "numeric(5,2)",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "QualitativeExposure",
                table: "RiskAssessments",
                type: "numeric(5,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(3,2)",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "QualitativeLikelihood",
                table: "ThreatScenarios",
                type: "integer",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "QualitativeImpact",
                table: "ThreatScenarios",
                type: "integer",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "QualitativeExposure",
                table: "ThreatScenarios",
                type: "numeric(3,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "QualitativeLikelihood",
                table: "RiskAssessments",
                type: "integer",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "QualitativeImpact",
                table: "RiskAssessments",
                type: "integer",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "QualitativeExposure",
                table: "RiskAssessments",
                type: "numeric(3,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,2)",
                oldNullable: true);
        }
    }
}
