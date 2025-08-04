using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddApplicationDomainManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DNSQueryLogs");

            migrationBuilder.DropTable(
                name: "DNSSettings");

            migrationBuilder.CreateTable(
                name: "ApplicationDomains",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DomainName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    HttpPort = table.Column<int>(type: "integer", nullable: false),
                    HttpsPort = table.Column<int>(type: "integer", nullable: false),
                    ForceHttps = table.Column<bool>(type: "boolean", nullable: false),
                    EnableHSTS = table.Column<bool>(type: "boolean", nullable: false),
                    HSTSMaxAge = table.Column<int>(type: "integer", nullable: false),
                    CustomHeaders = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApplicationDomains", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DomainAccessLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RequestedDomain = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    ClientIP = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RequestPath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RequestMethod = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    AccessTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    ResponseCode = table.Column<int>(type: "integer", nullable: false),
                    WasRedirected = table.Column<bool>(type: "boolean", nullable: false),
                    RedirectedTo = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    MatchedDomainName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DomainAccessLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DomainAliases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AliasName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    RedirectType = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    ApplicationDomainId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DomainAliases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DomainAliases_ApplicationDomains_ApplicationDomainId",
                        column: x => x.ApplicationDomainId,
                        principalTable: "ApplicationDomains",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationDomains_DomainName",
                table: "ApplicationDomains",
                column: "DomainName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationDomains_IsPrimary",
                table: "ApplicationDomains",
                column: "IsPrimary",
                filter: "\"IsPrimary\" = true");

            migrationBuilder.CreateIndex(
                name: "IX_DomainAccessLogs_AccessTime",
                table: "DomainAccessLogs",
                column: "AccessTime");

            migrationBuilder.CreateIndex(
                name: "IX_DomainAccessLogs_RequestedDomain",
                table: "DomainAccessLogs",
                column: "RequestedDomain");

            migrationBuilder.CreateIndex(
                name: "IX_DomainAccessLogs_ResponseCode",
                table: "DomainAccessLogs",
                column: "ResponseCode");

            migrationBuilder.CreateIndex(
                name: "IX_DomainAliases_AliasName",
                table: "DomainAliases",
                column: "AliasName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DomainAliases_ApplicationDomainId",
                table: "DomainAliases",
                column: "ApplicationDomainId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DomainAccessLogs");

            migrationBuilder.DropTable(
                name: "DomainAliases");

            migrationBuilder.DropTable(
                name: "ApplicationDomains");

            migrationBuilder.CreateTable(
                name: "DNSQueryLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BlockReason = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ClientIP = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    Details = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsBlocked = table.Column<bool>(type: "boolean", nullable: false),
                    QueryDomain = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    QueryTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    QueryType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ResponseIP = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    ResponseTime = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
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
                    AllowedDomains = table.Column<string>(type: "text", nullable: true),
                    BlockMaliciousDomains = table.Column<bool>(type: "boolean", nullable: false),
                    BlockedDomains = table.Column<string>(type: "text", nullable: true),
                    CacheTTL = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DoHServerUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DoTPort = table.Column<int>(type: "integer", nullable: false),
                    DoTServer = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    DomainName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    EnableCaching = table.Column<bool>(type: "boolean", nullable: false),
                    EnableDoH = table.Column<bool>(type: "boolean", nullable: false),
                    EnableDoT = table.Column<bool>(type: "boolean", nullable: false),
                    EnableQueryLogging = table.Column<bool>(type: "boolean", nullable: false),
                    LogRetentionDays = table.Column<int>(type: "integer", nullable: false),
                    PrimaryDNS = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    SearchDomains = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SecondaryDNS = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
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
    }
}
