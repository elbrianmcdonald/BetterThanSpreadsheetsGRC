using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class UpdateUserRoleHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add Role column to AspNetUsers table
            migrationBuilder.AddColumn<int>(
                name: "Role",
                table: "AspNetUsers",
                type: "integer",
                nullable: false,
                defaultValue: 1); // Default to ITUser

            // Update existing users based on their current role assignments
            // Admin users (assuming they're in Admin role)
            migrationBuilder.Sql(@"
                UPDATE ""AspNetUsers"" 
                SET ""Role"" = 4 
                WHERE ""Id"" IN (
                    SELECT u.""Id"" 
                    FROM ""AspNetUsers"" u
                    INNER JOIN ""AspNetUserRoles"" ur ON u.""Id"" = ur.""UserId""
                    INNER JOIN ""AspNetRoles"" r ON ur.""RoleId"" = r.""Id""
                    WHERE r.""Name"" = 'Admin'
                )");

            // GRC users (assuming they're in GRCUser role) -> set to GRCAnalyst
            migrationBuilder.Sql(@"
                UPDATE ""AspNetUsers"" 
                SET ""Role"" = 2 
                WHERE ""Id"" IN (
                    SELECT u.""Id"" 
                    FROM ""AspNetUsers"" u
                    INNER JOIN ""AspNetUserRoles"" ur ON u.""Id"" = ur.""UserId""
                    INNER JOIN ""AspNetRoles"" r ON ur.""RoleId"" = r.""Id""
                    WHERE r.""Name"" = 'GRCUser'
                )");

            // Create new roles for the hierarchy
            migrationBuilder.Sql(@"
                INSERT INTO ""AspNetRoles"" (""Id"", ""Name"", ""NormalizedName"", ""ConcurrencyStamp"")
                SELECT gen_random_uuid()::text, 'GRCAnalyst', 'GRCANALYST', gen_random_uuid()::text
                WHERE NOT EXISTS (SELECT 1 FROM ""AspNetRoles"" WHERE ""Name"" = 'GRCAnalyst')");

            migrationBuilder.Sql(@"
                INSERT INTO ""AspNetRoles"" (""Id"", ""Name"", ""NormalizedName"", ""ConcurrencyStamp"")
                SELECT gen_random_uuid()::text, 'GRCManager', 'GRCMANAGER', gen_random_uuid()::text
                WHERE NOT EXISTS (SELECT 1 FROM ""AspNetRoles"" WHERE ""Name"" = 'GRCManager')");

            migrationBuilder.Sql(@"
                INSERT INTO ""AspNetRoles"" (""Id"", ""Name"", ""NormalizedName"", ""ConcurrencyStamp"")
                SELECT gen_random_uuid()::text, 'ITUser', 'ITUSER', gen_random_uuid()::text
                WHERE NOT EXISTS (SELECT 1 FROM ""AspNetRoles"" WHERE ""Name"" = 'ITUser')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Remove the Role column from AspNetUsers table
            migrationBuilder.DropColumn(
                name: "Role",
                table: "AspNetUsers");

            // Remove the new roles (optional - could keep them)
            migrationBuilder.Sql(@"DELETE FROM ""AspNetRoles"" WHERE ""Name"" IN ('GRCAnalyst', 'GRCManager', 'ITUser')");
        }
    }
}
