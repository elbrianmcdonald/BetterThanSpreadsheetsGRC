using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class FixRiskAssessmentStatusDefault : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Set default value for Status column to Draft (1)
            migrationBuilder.Sql("ALTER TABLE \"RiskAssessments\" ALTER COLUMN \"Status\" SET DEFAULT 1;");
            
            // Update any existing records that have Status = 0 (invalid) to Draft = 1
            migrationBuilder.Sql("UPDATE \"RiskAssessments\" SET \"Status\" = 1 WHERE \"Status\" = 0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Remove the default value for Status column
            migrationBuilder.Sql("ALTER TABLE \"RiskAssessments\" ALTER COLUMN \"Status\" DROP DEFAULT;");
        }
    }
}
