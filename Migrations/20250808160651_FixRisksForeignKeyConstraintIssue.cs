using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class FixRisksForeignKeyConstraintIssue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // CRITICAL FIX: Remove the incorrect foreign key constraint that's blocking saves
            // This constraint incorrectly points RiskAssessmentId to ThreatScenarios table
            migrationBuilder.Sql(@"
                ALTER TABLE ""Risks"" 
                DROP CONSTRAINT IF EXISTS ""FK_Risks_ThreatScenarios_RiskAssessmentId"";
            ", suppressTransaction: true);
            
            // Also remove the problematic constraint from QualitativeControls if it exists
            migrationBuilder.Sql(@"
                ALTER TABLE ""QualitativeControls"" 
                DROP CONSTRAINT IF EXISTS ""FK_QualitativeControls_ThreatScenarios_RiskAssessmentId"";
            ", suppressTransaction: true);

            // Ensure the correct foreign key constraint exists for Risks.RiskAssessmentId -> RiskAssessments.Id
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints 
                        WHERE constraint_name = 'FK_Risks_RiskAssessments_RiskAssessmentId' 
                        AND table_name = 'Risks'
                    ) THEN
                        ALTER TABLE ""Risks"" 
                        ADD CONSTRAINT ""FK_Risks_RiskAssessments_RiskAssessmentId"" 
                        FOREIGN KEY (""RiskAssessmentId"") 
                        REFERENCES ""RiskAssessments"" (""Id"") 
                        ON DELETE SET NULL;
                    END IF;
                END $$;
            ");

            // Ensure the correct foreign key constraint exists for Risks.ThreatScenarioId -> ThreatScenarios.Id
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints 
                        WHERE constraint_name = 'FK_Risks_ThreatScenarios_ThreatScenarioId' 
                        AND table_name = 'Risks'
                    ) THEN
                        ALTER TABLE ""Risks"" 
                        ADD CONSTRAINT ""FK_Risks_ThreatScenarios_ThreatScenarioId"" 
                        FOREIGN KEY (""ThreatScenarioId"") 
                        REFERENCES ""ThreatScenarios"" (""Id"") 
                        ON DELETE SET NULL;
                    END IF;
                END $$;
            ");

            // Mark the problematic migration as applied so it won't try to run again
            migrationBuilder.Sql(@"
                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ('20250808125237_AddThreatScenarioIdToRisk', '8.0.18')
                ON CONFLICT (""MigrationId"") DO NOTHING;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // We don't want to recreate the broken constraint in Down
            // So we leave this empty
        }
    }
}