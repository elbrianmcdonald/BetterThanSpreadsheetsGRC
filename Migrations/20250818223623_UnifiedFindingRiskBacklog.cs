using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class UnifiedFindingRiskBacklog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FindingBacklogActivities");

            migrationBuilder.DropTable(
                name: "FindingBacklogComments");

            migrationBuilder.DropTable(
                name: "FindingBacklogEntries");

            migrationBuilder.AddColumn<string>(
                name: "Asset",
                table: "RiskBacklogEntries",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BusinessOwner",
                table: "RiskBacklogEntries",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BusinessUnit",
                table: "RiskBacklogEntries",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Domain",
                table: "RiskBacklogEntries",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Exposure",
                table: "RiskBacklogEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FindingDetails",
                table: "RiskBacklogEntries",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FindingId",
                table: "RiskBacklogEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FindingSource",
                table: "RiskBacklogEntries",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FindingTitle",
                table: "RiskBacklogEntries",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Impact",
                table: "RiskBacklogEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Likelihood",
                table: "RiskBacklogEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RiskRating",
                table: "RiskBacklogEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TechnicalControl",
                table: "RiskBacklogEntries",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_RiskBacklogEntries_FindingId",
                table: "RiskBacklogEntries",
                column: "FindingId");

            migrationBuilder.AddForeignKey(
                name: "FK_RiskBacklogEntries_Findings_FindingId",
                table: "RiskBacklogEntries",
                column: "FindingId",
                principalTable: "Findings",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RiskBacklogEntries_Findings_FindingId",
                table: "RiskBacklogEntries");

            migrationBuilder.DropIndex(
                name: "IX_RiskBacklogEntries_FindingId",
                table: "RiskBacklogEntries");

            migrationBuilder.DropColumn(
                name: "Asset",
                table: "RiskBacklogEntries");

            migrationBuilder.DropColumn(
                name: "BusinessOwner",
                table: "RiskBacklogEntries");

            migrationBuilder.DropColumn(
                name: "BusinessUnit",
                table: "RiskBacklogEntries");

            migrationBuilder.DropColumn(
                name: "Domain",
                table: "RiskBacklogEntries");

            migrationBuilder.DropColumn(
                name: "Exposure",
                table: "RiskBacklogEntries");

            migrationBuilder.DropColumn(
                name: "FindingDetails",
                table: "RiskBacklogEntries");

            migrationBuilder.DropColumn(
                name: "FindingId",
                table: "RiskBacklogEntries");

            migrationBuilder.DropColumn(
                name: "FindingSource",
                table: "RiskBacklogEntries");

            migrationBuilder.DropColumn(
                name: "FindingTitle",
                table: "RiskBacklogEntries");

            migrationBuilder.DropColumn(
                name: "Impact",
                table: "RiskBacklogEntries");

            migrationBuilder.DropColumn(
                name: "Likelihood",
                table: "RiskBacklogEntries");

            migrationBuilder.DropColumn(
                name: "RiskRating",
                table: "RiskBacklogEntries");

            migrationBuilder.DropColumn(
                name: "TechnicalControl",
                table: "RiskBacklogEntries");

            migrationBuilder.CreateTable(
                name: "FindingBacklogEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FindingId = table.Column<int>(type: "integer", nullable: true),
                    AnalystComments = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Asset = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AssignedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AssignedToAnalyst = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    AssignedToManager = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    BacklogNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    BusinessOwner = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    BusinessUnit = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CompletedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Details = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Domain = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Exposure = table.Column<int>(type: "integer", nullable: false),
                    Impact = table.Column<int>(type: "integer", nullable: false),
                    IsSLABreached = table.Column<bool>(type: "boolean", nullable: false),
                    Likelihood = table.Column<int>(type: "integer", nullable: false),
                    ManagerComments = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    RejectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RequestDescription = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    RequestJustification = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    RequesterUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    RiskRating = table.Column<int>(type: "integer", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: true, defaultValueSql: "'\\x0000000000000001'::bytea"),
                    Source = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TechnicalControl = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FindingBacklogEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FindingBacklogEntries_Findings_FindingId",
                        column: x => x.FindingId,
                        principalTable: "Findings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "FindingBacklogActivities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BacklogEntryId = table.Column<int>(type: "integer", nullable: false),
                    ActivityType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AdditionalDetails = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    FromValue = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: true, defaultValueSql: "'\\x0000000000000001'::bytea"),
                    ToValue = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FindingBacklogActivities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FindingBacklogActivities_FindingBacklogEntries_BacklogEntryId",
                        column: x => x.BacklogEntryId,
                        principalTable: "FindingBacklogEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FindingBacklogComments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BacklogEntryId = table.Column<int>(type: "integer", nullable: false),
                    Comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CommentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsInternal = table.Column<bool>(type: "boolean", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: true, defaultValueSql: "'\\x0000000000000001'::bytea"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FindingBacklogComments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FindingBacklogComments_FindingBacklogEntries_BacklogEntryId",
                        column: x => x.BacklogEntryId,
                        principalTable: "FindingBacklogEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FindingBacklogActivities_BacklogEntryId",
                table: "FindingBacklogActivities",
                column: "BacklogEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_FindingBacklogComments_BacklogEntryId",
                table: "FindingBacklogComments",
                column: "BacklogEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_FindingBacklogEntries_BacklogNumber",
                table: "FindingBacklogEntries",
                column: "BacklogNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FindingBacklogEntries_FindingId",
                table: "FindingBacklogEntries",
                column: "FindingId");
        }
    }
}
