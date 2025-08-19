using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class FixRiskBacklogActivityRowVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RiskBacklogEntries_Risks_RiskId",
                table: "RiskBacklogEntries");

            migrationBuilder.AlterColumn<DateTime>(
                name: "UpdatedAt",
                table: "RiskBacklogEntries",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP",
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "RiskBacklogEntries",
                type: "bytea",
                rowVersion: true,
                nullable: true,
                defaultValueSql: "'\\x0000000000000001'::bytea",
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true,
                oldNullable: true);

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "RiskBacklogEntries",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP",
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AlterColumn<DateTime>(
                name: "UpdatedAt",
                table: "RiskBacklogComments",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP",
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "RiskBacklogComments",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValueSql: "'\\x0000000000000001'::bytea",
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true);

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "RiskBacklogComments",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP",
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AlterColumn<DateTime>(
                name: "UpdatedAt",
                table: "RiskBacklogActivities",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP",
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "RiskBacklogActivities",
                type: "bytea",
                rowVersion: true,
                nullable: true,
                defaultValueSql: "'\\x0000000000000001'::bytea",
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true);

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "RiskBacklogActivities",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP",
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.CreateIndex(
                name: "IX_RiskBacklogEntries_BacklogNumber",
                table: "RiskBacklogEntries",
                column: "BacklogNumber",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_RiskBacklogEntries_Risks_RiskId",
                table: "RiskBacklogEntries",
                column: "RiskId",
                principalTable: "Risks",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RiskBacklogEntries_Risks_RiskId",
                table: "RiskBacklogEntries");

            migrationBuilder.DropIndex(
                name: "IX_RiskBacklogEntries_BacklogNumber",
                table: "RiskBacklogEntries");

            migrationBuilder.AlterColumn<DateTime>(
                name: "UpdatedAt",
                table: "RiskBacklogEntries",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldDefaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "RiskBacklogEntries",
                type: "bytea",
                rowVersion: true,
                nullable: true,
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true,
                oldNullable: true,
                oldDefaultValueSql: "'\\x0000000000000001'::bytea");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "RiskBacklogEntries",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldDefaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AlterColumn<DateTime>(
                name: "UpdatedAt",
                table: "RiskBacklogComments",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldDefaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "RiskBacklogComments",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true,
                oldDefaultValueSql: "'\\x0000000000000001'::bytea");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "RiskBacklogComments",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldDefaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AlterColumn<DateTime>(
                name: "UpdatedAt",
                table: "RiskBacklogActivities",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldDefaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "RiskBacklogActivities",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0],
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true,
                oldNullable: true,
                oldDefaultValueSql: "'\\x0000000000000001'::bytea");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "RiskBacklogActivities",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldDefaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AddForeignKey(
                name: "FK_RiskBacklogEntries_Risks_RiskId",
                table: "RiskBacklogEntries",
                column: "RiskId",
                principalTable: "Risks",
                principalColumn: "Id");
        }
    }
}
