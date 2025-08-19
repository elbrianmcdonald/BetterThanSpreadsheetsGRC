using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class FixRiskBacklogActivityRowVersionNotNull : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Make RowVersion nullable and add default value for RiskBacklogActivities
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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revert RowVersion back to non-nullable
            migrationBuilder.AlterColumn<byte[]>(
                name: "RowVersion",
                table: "RiskBacklogActivities",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                oldClrType: typeof(byte[]),
                oldType: "bytea",
                oldRowVersion: true,
                oldNullable: true,
                oldDefaultValueSql: "'\\x0000000000000001'::bytea");
        }
    }
}
