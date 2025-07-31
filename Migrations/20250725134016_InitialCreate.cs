using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AspNetRoles",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUsers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    FirstName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    LastName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Department = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    JobTitle = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LastLoginDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    UserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedUserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    EmailConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: true),
                    SecurityStamp = table.Column<string>(type: "text", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true),
                    PhoneNumber = table.Column<string>(type: "text", nullable: true),
                    PhoneNumberConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    TwoFactorEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    LockoutEnd = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LockoutEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    AccessFailedCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUsers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BusinessOrganizations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    ComplianceOwner = table.Column<string>(type: "text", nullable: false),
                    Stakeholders = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BusinessOrganizations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ComplianceFrameworks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    UploadedBy = table.Column<string>(type: "text", nullable: false),
                    UploadedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComplianceFrameworks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Findings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FindingNumber = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Details = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Impact = table.Column<int>(type: "integer", nullable: false),
                    Likelihood = table.Column<int>(type: "integer", nullable: false),
                    Exposure = table.Column<int>(type: "integer", nullable: false),
                    RiskRating = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Owner = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Domain = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    BusinessUnit = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    BusinessOwner = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    OpenDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SlaDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Asset = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TechnicalControl = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AssignedTo = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Findings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MaturityFrameworks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    UploadedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UploadedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaturityFrameworks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ReferenceDataEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Category = table.Column<int>(type: "integer", nullable: false),
                    Value = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    ModifiedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ModifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UsageCount = table.Column<int>(type: "integer", nullable: false),
                    LastUsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReferenceDataEntries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RiskLevelSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    FairCriticalThreshold = table.Column<decimal>(type: "numeric", nullable: false),
                    FairHighThreshold = table.Column<decimal>(type: "numeric", nullable: false),
                    FairMediumThreshold = table.Column<decimal>(type: "numeric", nullable: false),
                    QualitativeCriticalThreshold = table.Column<decimal>(type: "numeric", nullable: false),
                    QualitativeHighThreshold = table.Column<decimal>(type: "numeric", nullable: false),
                    QualitativeMediumThreshold = table.Column<decimal>(type: "numeric", nullable: false),
                    RiskAppetiteThreshold = table.Column<decimal>(type: "numeric", nullable: false),
                    CybersecurityInsuranceAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: false),
                    LastModifiedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RiskLevelSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ThirdParties",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Organization = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RepresentativeEmail = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    TPRAStatus = table.Column<int>(type: "integer", nullable: false),
                    RiskLevel = table.Column<int>(type: "integer", nullable: false),
                    BIARating = table.Column<int>(type: "integer", nullable: false),
                    TPRAHyperlink = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThirdParties", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetRoleClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RoleId = table.Column<string>(type: "text", nullable: false),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoleClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetRoleClaims_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetUserClaims_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserLogins",
                columns: table => new
                {
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    ProviderKey = table.Column<string>(type: "text", nullable: false),
                    ProviderDisplayName = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserLogins", x => new { x.LoginProvider, x.ProviderKey });
                    table.ForeignKey(
                        name: "FK_AspNetUserLogins_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserRoles",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    RoleId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserRoles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserTokens",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Value = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserTokens", x => new { x.UserId, x.LoginProvider, x.Name });
                    table.ForeignKey(
                        name: "FK_AspNetUserTokens_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AssessmentRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RequesterName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Department = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ContactEmail = table.Column<string>(type: "text", nullable: false),
                    Scope = table.Column<string>(type: "text", nullable: false),
                    Justification = table.Column<string>(type: "text", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    RequestedTimeline = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RequestDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AssignedToUserId = table.Column<string>(type: "text", nullable: true),
                    AssignedByUserId = table.Column<string>(type: "text", nullable: true),
                    AssignmentDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AssignmentNotes = table.Column<string>(type: "text", nullable: false),
                    StartedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EstimatedHours = table.Column<decimal>(type: "numeric", nullable: true),
                    ActualHours = table.Column<decimal>(type: "numeric", nullable: true),
                    AssignedTo = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssessmentRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssessmentRequests_AspNetUsers_AssignedByUserId",
                        column: x => x.AssignedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AssessmentRequests_AspNetUsers_AssignedToUserId",
                        column: x => x.AssignedToUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ComplianceAssessments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Assessor = table.Column<string>(type: "text", nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompliancePercentage = table.Column<decimal>(type: "numeric", nullable: false),
                    ComplianceFrameworkId = table.Column<int>(type: "integer", nullable: false),
                    BusinessOrganizationId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComplianceAssessments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ComplianceAssessments_BusinessOrganizations_BusinessOrganiz~",
                        column: x => x.BusinessOrganizationId,
                        principalTable: "BusinessOrganizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ComplianceAssessments_ComplianceFrameworks_ComplianceFramew~",
                        column: x => x.ComplianceFrameworkId,
                        principalTable: "ComplianceFrameworks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ComplianceControls",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ControlId = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    ControlText = table.Column<string>(type: "text", nullable: false),
                    SupplementalGuidance = table.Column<string>(type: "text", nullable: false),
                    RelatedControls = table.Column<string>(type: "text", nullable: false),
                    ControlEnhancements = table.Column<string>(type: "text", nullable: false),
                    ComplianceFrameworkId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComplianceControls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ComplianceControls_ComplianceFrameworks_ComplianceFramework~",
                        column: x => x.ComplianceFrameworkId,
                        principalTable: "ComplianceFrameworks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FindingClosureRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FindingId = table.Column<int>(type: "integer", nullable: false),
                    Requester = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ClosureJustification = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    EvidenceLinks = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    AdditionalNotes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    RequestDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RequestedClosureDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AssignedToUserId = table.Column<string>(type: "text", nullable: true),
                    AssignedByUserId = table.Column<string>(type: "text", nullable: true),
                    AssignmentDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AssignmentNotes = table.Column<string>(type: "text", nullable: false),
                    StartedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ReviewDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewComments = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FindingClosureRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FindingClosureRequests_AspNetUsers_AssignedByUserId",
                        column: x => x.AssignedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_FindingClosureRequests_AspNetUsers_AssignedToUserId",
                        column: x => x.AssignedToUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_FindingClosureRequests_Findings_FindingId",
                        column: x => x.FindingId,
                        principalTable: "Findings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "RiskAssessments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Asset = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BusinessUnit = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TechnicalControlsInPlace = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    ThreatScenario = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    DateCompleted = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Assessor = table.Column<string>(type: "text", nullable: false),
                    AssessmentType = table.Column<int>(type: "integer", nullable: false),
                    FindingId = table.Column<int>(type: "integer", nullable: true),
                    ThreatCommunity = table.Column<string>(type: "text", nullable: false),
                    ThreatAction = table.Column<string>(type: "text", nullable: false),
                    ThreatEventFrequency = table.Column<decimal>(type: "numeric(18,6)", nullable: false),
                    ThreatEventFrequencyMin = table.Column<decimal>(type: "numeric(18,6)", nullable: false),
                    ThreatEventFrequencyMax = table.Column<decimal>(type: "numeric(18,6)", nullable: false),
                    ThreatEventFrequencyConfidence = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    ContactFrequency = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    ActionSuccess = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    LossEventFrequency = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    ProductivityLossMin = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ProductivityLossMostLikely = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ProductivityLossMax = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ResponseCostsMin = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ResponseCostsMostLikely = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ResponseCostsMax = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ReplacementCostMin = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ReplacementCostMostLikely = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ReplacementCostMax = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    FinesMin = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    FinesMostLikely = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    FinesMax = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PrimaryLossMagnitude = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    IncludeSecondaryLoss = table.Column<bool>(type: "boolean", nullable: false),
                    SecondaryResponseCostMin = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    SecondaryResponseCostMostLikely = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    SecondaryResponseCostMax = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    SecondaryProductivityLossMin = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    SecondaryProductivityLossMostLikely = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    SecondaryProductivityLossMax = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ReputationDamageMin = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ReputationDamageMostLikely = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ReputationDamageMax = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CompetitiveAdvantageLossMin = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CompetitiveAdvantageLossMostLikely = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CompetitiveAdvantageLossMax = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ExternalStakeholderLossMin = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ExternalStakeholderLossMostLikely = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ExternalStakeholderLossMax = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    SecondaryLossEventFrequency = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    SecondaryLossMagnitude = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    AnnualLossExpectancy = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    SimulationIterations = table.Column<int>(type: "integer", nullable: false),
                    ALE_10th = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    ALE_50th = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    ALE_90th = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    ALE_95th = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    PrimaryLoss_10th = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    PrimaryLoss_50th = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    PrimaryLoss_90th = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    PrimaryLoss_95th = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    UsePerDistribution = table.Column<bool>(type: "boolean", nullable: false),
                    DistributionType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    LossMagnitudeConfidence = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    CalculatedVulnerability = table.Column<decimal>(type: "numeric(5,4)", nullable: true),
                    DeductCybersecurityInsurance = table.Column<bool>(type: "boolean", nullable: false),
                    QualitativeLikelihood = table.Column<int>(type: "integer", nullable: true),
                    QualitativeImpact = table.Column<int>(type: "integer", nullable: true),
                    QualitativeExposure = table.Column<int>(type: "integer", nullable: true),
                    QualitativeRiskScore = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RiskAssessments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RiskAssessments_Findings_FindingId",
                        column: x => x.FindingId,
                        principalTable: "Findings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "MaturityAssessments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Assessor = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    OverallMaturityScore = table.Column<decimal>(type: "numeric", nullable: false),
                    MaturityFrameworkId = table.Column<int>(type: "integer", nullable: false),
                    BusinessOrganizationId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaturityAssessments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaturityAssessments_BusinessOrganizations_BusinessOrganizat~",
                        column: x => x.BusinessOrganizationId,
                        principalTable: "BusinessOrganizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MaturityAssessments_MaturityFrameworks_MaturityFrameworkId",
                        column: x => x.MaturityFrameworkId,
                        principalTable: "MaturityFrameworks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MaturityControls",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ControlId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Function = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Subcategory = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ImplementationGuidance = table.Column<string>(type: "text", nullable: false),
                    HelpText = table.Column<string>(type: "text", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    MaturityFrameworkId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaturityControls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaturityControls_MaturityFrameworks_MaturityFrameworkId",
                        column: x => x.MaturityFrameworkId,
                        principalTable: "MaturityFrameworks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ControlAssessments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Score = table.Column<string>(type: "text", nullable: false),
                    EvidenceOfCompliance = table.Column<string>(type: "text", nullable: false),
                    GapNotes = table.Column<string>(type: "text", nullable: false),
                    Ownership = table.Column<string>(type: "text", nullable: false),
                    ProjectedComplianceDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProjectNeeded = table.Column<bool>(type: "boolean", nullable: false),
                    TShirtSize = table.Column<int>(type: "integer", nullable: true),
                    ProjectNumber = table.Column<string>(type: "text", nullable: false),
                    AssessedBy = table.Column<string>(type: "text", nullable: false),
                    AssessmentDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AssignmentParameters = table.Column<string>(type: "text", nullable: false),
                    SelectionParameters = table.Column<string>(type: "text", nullable: false),
                    ImplementationNotes = table.Column<string>(type: "text", nullable: false),
                    TestingProcedures = table.Column<string>(type: "text", nullable: false),
                    LastTestDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NextTestDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ComplianceControlId = table.Column<int>(type: "integer", nullable: false),
                    ComplianceAssessmentId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Evidence = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ControlAssessments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ControlAssessments_ComplianceAssessments_ComplianceAssessme~",
                        column: x => x.ComplianceAssessmentId,
                        principalTable: "ComplianceAssessments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ControlAssessments_ComplianceControls_ComplianceControlId",
                        column: x => x.ComplianceControlId,
                        principalTable: "ComplianceControls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TechnicalControlComplianceMappings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TechnicalControlId = table.Column<int>(type: "integer", nullable: false),
                    ComplianceControlId = table.Column<int>(type: "integer", nullable: false),
                    MappingRationale = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ImplementationNotes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    ModifiedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ModifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TechnicalControlComplianceMappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TechnicalControlComplianceMappings_ComplianceControls_Compl~",
                        column: x => x.ComplianceControlId,
                        principalTable: "ComplianceControls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TechnicalControlComplianceMappings_ReferenceDataEntries_Tec~",
                        column: x => x.TechnicalControlId,
                        principalTable: "ReferenceDataEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RiskAssessmentControls",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RiskAssessmentId = table.Column<int>(type: "integer", nullable: false),
                    ControlName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ControlType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ControlEffectiveness = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    ControlDescription = table.Column<string>(type: "text", nullable: true),
                    ImplementationStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RiskAssessmentControls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RiskAssessmentControls_RiskAssessments_RiskAssessmentId",
                        column: x => x.RiskAssessmentId,
                        principalTable: "RiskAssessments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Risks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RiskNumber = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ThreatScenario = table.Column<string>(type: "text", nullable: false),
                    CIATriad = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    BusinessUnit = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Asset = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Owner = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Impact = table.Column<int>(type: "integer", nullable: false),
                    Likelihood = table.Column<int>(type: "integer", nullable: false),
                    Exposure = table.Column<int>(type: "integer", nullable: false),
                    InherentRiskLevel = table.Column<int>(type: "integer", nullable: false),
                    Treatment = table.Column<int>(type: "integer", nullable: false),
                    ResidualRiskLevel = table.Column<int>(type: "integer", nullable: false),
                    TreatmentPlan = table.Column<string>(type: "text", nullable: false),
                    RiskAssessmentReference = table.Column<string>(type: "text", nullable: false),
                    OpenDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NextReviewDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ALE = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    RiskLevel = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FindingId = table.Column<int>(type: "integer", nullable: true),
                    RiskAssessmentId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Risks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Risks_Findings_FindingId",
                        column: x => x.FindingId,
                        principalTable: "Findings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Risks_RiskAssessments_RiskAssessmentId",
                        column: x => x.RiskAssessmentId,
                        principalTable: "RiskAssessments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "MaturityControlAssessments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CurrentMaturityLevel = table.Column<int>(type: "integer", nullable: false),
                    TargetMaturityLevel = table.Column<int>(type: "integer", nullable: false),
                    Evidence = table.Column<string>(type: "text", nullable: false),
                    GapNotes = table.Column<string>(type: "text", nullable: false),
                    RecommendedActions = table.Column<string>(type: "text", nullable: false),
                    Ownership = table.Column<string>(type: "text", nullable: false),
                    TargetCompletionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProjectNeeded = table.Column<bool>(type: "boolean", nullable: false),
                    TShirtSize = table.Column<int>(type: "integer", nullable: true),
                    ProjectNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    AssessedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AssessmentDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MaturityControlId = table.Column<int>(type: "integer", nullable: false),
                    MaturityAssessmentId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaturityControlAssessments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaturityControlAssessments_MaturityAssessments_MaturityAsse~",
                        column: x => x.MaturityAssessmentId,
                        principalTable: "MaturityAssessments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MaturityControlAssessments_MaturityControls_MaturityControl~",
                        column: x => x.MaturityControlId,
                        principalTable: "MaturityControls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RiskAcceptanceRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Description = table.Column<string>(type: "text", nullable: false),
                    BusinessNeed = table.Column<string>(type: "text", nullable: false),
                    Requester = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RequestDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReviewDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ReviewComments = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    RiskSummary = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CurrentCompensatingControls = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    CurrentRiskLevelWithControls = table.Column<int>(type: "integer", nullable: true),
                    TreatmentPlan = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ProposedCompensatingControls = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    FutureRiskLevelWithMitigations = table.Column<int>(type: "integer", nullable: true),
                    CISORecommendation = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AssignedToUserId = table.Column<string>(type: "text", nullable: true),
                    AssignedByUserId = table.Column<string>(type: "text", nullable: true),
                    AssignmentDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AssignmentNotes = table.Column<string>(type: "text", nullable: false),
                    StartedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FindingId = table.Column<int>(type: "integer", nullable: true),
                    RiskId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RiskAcceptanceRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RiskAcceptanceRequests_AspNetUsers_AssignedByUserId",
                        column: x => x.AssignedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RiskAcceptanceRequests_AspNetUsers_AssignedToUserId",
                        column: x => x.AssignedToUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RiskAcceptanceRequests_Findings_FindingId",
                        column: x => x.FindingId,
                        principalTable: "Findings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RiskAcceptanceRequests_Risks_RiskId",
                        column: x => x.RiskId,
                        principalTable: "Risks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AspNetRoleClaims_RoleId",
                table: "AspNetRoleClaims",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "RoleNameIndex",
                table: "AspNetRoles",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserClaims_UserId",
                table: "AspNetUserClaims",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserLogins_UserId",
                table: "AspNetUserLogins",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserRoles_RoleId",
                table: "AspNetUserRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "AspNetUsers",
                column: "NormalizedEmail");

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                table: "AspNetUsers",
                column: "NormalizedUserName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AssessmentRequests_AssignedByUserId",
                table: "AssessmentRequests",
                column: "AssignedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AssessmentRequests_AssignedToUserId",
                table: "AssessmentRequests",
                column: "AssignedToUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ComplianceAssessments_BusinessOrganizationId",
                table: "ComplianceAssessments",
                column: "BusinessOrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_ComplianceAssessments_ComplianceFrameworkId",
                table: "ComplianceAssessments",
                column: "ComplianceFrameworkId");

            migrationBuilder.CreateIndex(
                name: "IX_ComplianceControls_ComplianceFrameworkId",
                table: "ComplianceControls",
                column: "ComplianceFrameworkId");

            migrationBuilder.CreateIndex(
                name: "IX_ControlAssessments_ComplianceAssessmentId",
                table: "ControlAssessments",
                column: "ComplianceAssessmentId");

            migrationBuilder.CreateIndex(
                name: "IX_ControlAssessments_ComplianceControlId",
                table: "ControlAssessments",
                column: "ComplianceControlId");

            migrationBuilder.CreateIndex(
                name: "IX_FindingClosureRequests_AssignedByUserId",
                table: "FindingClosureRequests",
                column: "AssignedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FindingClosureRequests_AssignedToUserId",
                table: "FindingClosureRequests",
                column: "AssignedToUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FindingClosureRequests_FindingId",
                table: "FindingClosureRequests",
                column: "FindingId");

            migrationBuilder.CreateIndex(
                name: "IX_MaturityAssessments_BusinessOrganizationId",
                table: "MaturityAssessments",
                column: "BusinessOrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_MaturityAssessments_MaturityFrameworkId",
                table: "MaturityAssessments",
                column: "MaturityFrameworkId");

            migrationBuilder.CreateIndex(
                name: "IX_MaturityControlAssessments_MaturityAssessmentId",
                table: "MaturityControlAssessments",
                column: "MaturityAssessmentId");

            migrationBuilder.CreateIndex(
                name: "IX_MaturityControlAssessments_MaturityControlId",
                table: "MaturityControlAssessments",
                column: "MaturityControlId");

            migrationBuilder.CreateIndex(
                name: "IX_MaturityControls_MaturityFrameworkId",
                table: "MaturityControls",
                column: "MaturityFrameworkId");

            migrationBuilder.CreateIndex(
                name: "IX_ReferenceDataEntries_Category_Value",
                table: "ReferenceDataEntries",
                columns: new[] { "Category", "Value" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_RiskAcceptanceRequests_AssignedByUserId",
                table: "RiskAcceptanceRequests",
                column: "AssignedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_RiskAcceptanceRequests_AssignedToUserId",
                table: "RiskAcceptanceRequests",
                column: "AssignedToUserId");

            migrationBuilder.CreateIndex(
                name: "IX_RiskAcceptanceRequests_FindingId",
                table: "RiskAcceptanceRequests",
                column: "FindingId");

            migrationBuilder.CreateIndex(
                name: "IX_RiskAcceptanceRequests_RiskId",
                table: "RiskAcceptanceRequests",
                column: "RiskId");

            migrationBuilder.CreateIndex(
                name: "IX_RiskAssessmentControls_RiskAssessmentId",
                table: "RiskAssessmentControls",
                column: "RiskAssessmentId");

            migrationBuilder.CreateIndex(
                name: "IX_RiskAssessments_FindingId",
                table: "RiskAssessments",
                column: "FindingId");

            migrationBuilder.CreateIndex(
                name: "IX_Risks_FindingId",
                table: "Risks",
                column: "FindingId");

            migrationBuilder.CreateIndex(
                name: "IX_Risks_RiskAssessmentId",
                table: "Risks",
                column: "RiskAssessmentId");

            migrationBuilder.CreateIndex(
                name: "IX_TechnicalControlComplianceMappings_ComplianceControlId",
                table: "TechnicalControlComplianceMappings",
                column: "ComplianceControlId");

            migrationBuilder.CreateIndex(
                name: "IX_TechnicalControlComplianceMappings_TechnicalControlId_Compl~",
                table: "TechnicalControlComplianceMappings",
                columns: new[] { "TechnicalControlId", "ComplianceControlId" },
                unique: true,
                filter: "\"IsActive\" = true");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AspNetRoleClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserLogins");

            migrationBuilder.DropTable(
                name: "AspNetUserRoles");

            migrationBuilder.DropTable(
                name: "AspNetUserTokens");

            migrationBuilder.DropTable(
                name: "AssessmentRequests");

            migrationBuilder.DropTable(
                name: "ControlAssessments");

            migrationBuilder.DropTable(
                name: "FindingClosureRequests");

            migrationBuilder.DropTable(
                name: "MaturityControlAssessments");

            migrationBuilder.DropTable(
                name: "RiskAcceptanceRequests");

            migrationBuilder.DropTable(
                name: "RiskAssessmentControls");

            migrationBuilder.DropTable(
                name: "RiskLevelSettings");

            migrationBuilder.DropTable(
                name: "TechnicalControlComplianceMappings");

            migrationBuilder.DropTable(
                name: "ThirdParties");

            migrationBuilder.DropTable(
                name: "AspNetRoles");

            migrationBuilder.DropTable(
                name: "ComplianceAssessments");

            migrationBuilder.DropTable(
                name: "MaturityAssessments");

            migrationBuilder.DropTable(
                name: "MaturityControls");

            migrationBuilder.DropTable(
                name: "AspNetUsers");

            migrationBuilder.DropTable(
                name: "Risks");

            migrationBuilder.DropTable(
                name: "ComplianceControls");

            migrationBuilder.DropTable(
                name: "ReferenceDataEntries");

            migrationBuilder.DropTable(
                name: "BusinessOrganizations");

            migrationBuilder.DropTable(
                name: "MaturityFrameworks");

            migrationBuilder.DropTable(
                name: "RiskAssessments");

            migrationBuilder.DropTable(
                name: "ComplianceFrameworks");

            migrationBuilder.DropTable(
                name: "Findings");
        }
    }
}
