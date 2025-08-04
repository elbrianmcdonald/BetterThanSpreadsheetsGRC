using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddDNSManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DNSQueryLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    QueryDomain = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    QueryType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ClientIP = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    ResponseIP = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    QueryTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    ResponseTime = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Details = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsBlocked = table.Column<bool>(type: "boolean", nullable: false),
                    BlockReason = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DNSQueryLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DNSSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PrimaryDNS = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    SecondaryDNS = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    DomainName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    SearchDomains = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    EnableDoH = table.Column<bool>(type: "boolean", nullable: false),
                    DoHServerUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    EnableDoT = table.Column<bool>(type: "boolean", nullable: false),
                    DoTServer = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    DoTPort = table.Column<int>(type: "integer", nullable: false),
                    EnableCaching = table.Column<bool>(type: "boolean", nullable: false),
                    CacheTTL = table.Column<int>(type: "integer", nullable: false),
                    BlockMaliciousDomains = table.Column<bool>(type: "boolean", nullable: false),
                    BlockedDomains = table.Column<string>(type: "text", nullable: true),
                    AllowedDomains = table.Column<string>(type: "text", nullable: true),
                    EnableQueryLogging = table.Column<bool>(type: "boolean", nullable: false),
                    LogRetentionDays = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DNSSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DNSQueryLogs_IsBlocked",
                table: "DNSQueryLogs",
                column: "IsBlocked");

            migrationBuilder.CreateIndex(
                name: "IX_DNSQueryLogs_QueryDomain",
                table: "DNSQueryLogs",
                column: "QueryDomain");

            migrationBuilder.CreateIndex(
                name: "IX_DNSQueryLogs_QueryTime",
                table: "DNSQueryLogs",
                column: "QueryTime");

            migrationBuilder.CreateIndex(
                name: "IX_DNSSettings_Id",
                table: "DNSSettings",
                column: "Id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DNSQueryLogs");

            migrationBuilder.DropTable(
                name: "DNSSettings");
        }
    }
}
