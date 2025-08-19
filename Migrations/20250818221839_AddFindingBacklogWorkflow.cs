using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddFindingBacklogWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FindingBacklogEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BacklogNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Details = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Source = table.Column<string>(type: "text", nullable: false),
                    Impact = table.Column<int>(type: "integer", nullable: false),
                    Likelihood = table.Column<int>(type: "integer", nullable: false),
                    Exposure = table.Column<int>(type: "integer", nullable: false),
                    RiskRating = table.Column<int>(type: "integer", nullable: false),
                    Asset = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    BusinessUnit = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    BusinessOwner = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Domain = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TechnicalControl = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    AssignedToAnalyst = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    AssignedToManager = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    AssignedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RequesterUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    RequestDescription = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    RequestJustification = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    AnalystComments = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ManagerComments = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CompletedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsSLABreached = table.Column<bool>(type: "boolean", nullable: false),
                    FindingId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: true, defaultValueSql: "'\\x0000000000000001'::bytea")
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
                    FromValue = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ToValue = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    AdditionalDetails = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: true, defaultValueSql: "'\\x0000000000000001'::bytea")
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
                    IsInternal = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: true, defaultValueSql: "'\\x0000000000000001'::bytea")
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FindingBacklogActivities");

            migrationBuilder.DropTable(
                name: "FindingBacklogComments");

            migrationBuilder.DropTable(
                name: "FindingBacklogEntries");
        }
    }
}
