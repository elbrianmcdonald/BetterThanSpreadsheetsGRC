using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class RemoveEnvironmentsFromThreatModeling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AttackScenarioSteps_Environments_EnvironmentId",
                table: "AttackScenarioSteps");

            migrationBuilder.DropIndex(
                name: "IX_AttackScenarioSteps_EnvironmentId",
                table: "AttackScenarioSteps");

            migrationBuilder.DropColumn(
                name: "EnvironmentId",
                table: "AttackScenarioSteps");

            migrationBuilder.RenameColumn(
                name: "DetectionOpportunities",
                table: "AttackScenarioSteps",
                newName: "DetectionMethods");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "TechniqueEnvironmentMappings",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldDefaultValueSql: "CURRENT_TIMESTAMP");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "DetectionMethods",
                table: "AttackScenarioSteps",
                newName: "DetectionOpportunities");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "TechniqueEnvironmentMappings",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP",
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AddColumn<int>(
                name: "EnvironmentId",
                table: "AttackScenarioSteps",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AttackScenarioSteps_EnvironmentId",
                table: "AttackScenarioSteps",
                column: "EnvironmentId");

            migrationBuilder.AddForeignKey(
                name: "FK_AttackScenarioSteps_Environments_EnvironmentId",
                table: "AttackScenarioSteps",
                column: "EnvironmentId",
                principalTable: "Environments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
