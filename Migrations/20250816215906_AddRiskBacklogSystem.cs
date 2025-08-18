using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddRiskBacklogSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RiskBacklogEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BacklogNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    RiskId = table.Column<int>(type: "integer", nullable: true),
                    ActionType = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    AssignedToAnalyst = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AssignedToManager = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AssignedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RequestDescription = table.Column<string>(type: "text", nullable: false),
                    RequestJustification = table.Column<string>(type: "text", nullable: false),
                    RequesterUserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsSLABreached = table.Column<bool>(type: "boolean", nullable: false),
                    AnalystComments = table.Column<string>(type: "text", nullable: false),
                    ManagerComments = table.Column<string>(type: "text", nullable: false),
                    RejectionReason = table.Column<string>(type: "text", nullable: false),
                    RiskSource = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RiskBacklogEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RiskBacklogEntries_Risks_RiskId",
                        column: x => x.RiskId,
                        principalTable: "Risks",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "RiskBacklogActivities",
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
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RiskBacklogActivities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RiskBacklogActivities_RiskBacklogEntries_BacklogEntryId",
                        column: x => x.BacklogEntryId,
                        principalTable: "RiskBacklogEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RiskBacklogComments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BacklogEntryId = table.Column<int>(type: "integer", nullable: false),
                    Comment = table.Column<string>(type: "text", nullable: false),
                    CommentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    IsInternal = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RowVersion = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RiskBacklogComments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RiskBacklogComments_RiskBacklogEntries_BacklogEntryId",
                        column: x => x.BacklogEntryId,
                        principalTable: "RiskBacklogEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RiskBacklogActivities_BacklogEntryId",
                table: "RiskBacklogActivities",
                column: "BacklogEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_RiskBacklogComments_BacklogEntryId",
                table: "RiskBacklogComments",
                column: "BacklogEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_RiskBacklogEntries_RiskId",
                table: "RiskBacklogEntries",
                column: "RiskId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RiskBacklogActivities");

            migrationBuilder.DropTable(
                name: "RiskBacklogComments");

            migrationBuilder.DropTable(
                name: "RiskBacklogEntries");
        }
    }
}
