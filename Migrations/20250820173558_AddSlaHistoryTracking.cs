using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddSlaHistoryTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SlaHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SlaType = table.Column<int>(type: "integer", nullable: false),
                    ItemType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ItemId = table.Column<int>(type: "integer", nullable: false),
                    ItemDescription = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RiskLevel = table.Column<int>(type: "integer", nullable: false),
                    AssignedTo = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AssignedToEmail = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SlaStartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SlaDeadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SlaHours = table.Column<int>(type: "integer", nullable: false),
                    ComplianceStatus = table.Column<int>(type: "integer", nullable: false),
                    CompletionTime = table.Column<TimeSpan>(type: "interval", nullable: true),
                    SlaVariance = table.Column<TimeSpan>(type: "interval", nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SlaHistories", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SlaHistories");
        }
    }
}
