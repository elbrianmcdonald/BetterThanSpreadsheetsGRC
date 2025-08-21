using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class FixThreatEntityRowVersionDefaults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "TreatmentActions",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValueSql: "'\\x0000000000000001'::bytea",
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true);

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "ThreatVectors",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValueSql: "'\\x0000000000000001'::bytea",
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true);

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "ThreatControls",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValueSql: "'\\x0000000000000001'::bytea",
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true);

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "ThreatActorSteps",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValueSql: "'\\x0000000000000001'::bytea",
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true);

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "ThreatActorObjectives",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValueSql: "'\\x0000000000000001'::bytea",
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true);

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "ScenarioRisks",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValueSql: "'\\x0000000000000001'::bytea",
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "TreatmentActions",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true,
                oldDefaultValueSql: "'\\x0000000000000001'::bytea");

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "ThreatVectors",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true,
                oldDefaultValueSql: "'\\x0000000000000001'::bytea");

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "ThreatControls",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true,
                oldDefaultValueSql: "'\\x0000000000000001'::bytea");

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "ThreatActorSteps",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true,
                oldDefaultValueSql: "'\\x0000000000000001'::bytea");

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "ThreatActorObjectives",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true,
                oldDefaultValueSql: "'\\x0000000000000001'::bytea");

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "ScenarioRisks",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true,
                oldDefaultValueSql: "'\\x0000000000000001'::bytea");
        }
    }
}
