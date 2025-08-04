using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CyberRiskApp.Data;
using CyberRiskApp.Authorization;
using Microsoft.EntityFrameworkCore;

namespace CyberRiskApp.Controllers
{
    [Authorize(Policy = PolicyConstants.RequireAdminRole)]
    public class DatabaseController : Controller
    {
        private readonly CyberRiskContext _context;
        
        public DatabaseController(CyberRiskContext context)
        {
            _context = context;
        }
        
        public IActionResult Index()
        {
            return View();
        }
        
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateRiskAcceptanceSchema()
        {
            try
            {
                var sql = @"
DO $$ 
BEGIN
    -- Add RiskSummary column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'RiskSummary') THEN
        ALTER TABLE ""RiskAcceptanceRequests"" ADD COLUMN ""RiskSummary"" character varying(2000) NOT NULL DEFAULT '';
    END IF;
    
    -- Add CurrentCompensatingControls column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'CurrentCompensatingControls') THEN
        ALTER TABLE ""RiskAcceptanceRequests"" ADD COLUMN ""CurrentCompensatingControls"" character varying(1000) NOT NULL DEFAULT '';
    END IF;
    
    -- Add CurrentRiskLevelWithControls column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'CurrentRiskLevelWithControls') THEN
        ALTER TABLE ""RiskAcceptanceRequests"" ADD COLUMN ""CurrentRiskLevelWithControls"" integer;
    END IF;
    
    -- Add TreatmentPlan column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'TreatmentPlan') THEN
        ALTER TABLE ""RiskAcceptanceRequests"" ADD COLUMN ""TreatmentPlan"" character varying(2000) NOT NULL DEFAULT '';
    END IF;
    
    -- Add ProposedCompensatingControls column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'ProposedCompensatingControls') THEN
        ALTER TABLE ""RiskAcceptanceRequests"" ADD COLUMN ""ProposedCompensatingControls"" character varying(1000) NOT NULL DEFAULT '';
    END IF;
    
    -- Add FutureRiskLevelWithMitigations column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'FutureRiskLevelWithMitigations') THEN
        ALTER TABLE ""RiskAcceptanceRequests"" ADD COLUMN ""FutureRiskLevelWithMitigations"" integer;
    END IF;
    
    -- Add CISORecommendation column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'CISORecommendation') THEN
        ALTER TABLE ""RiskAcceptanceRequests"" ADD COLUMN ""CISORecommendation"" character varying(2000) NOT NULL DEFAULT '';
    END IF;
    
    -- Rename Justification to BusinessNeed if it exists and BusinessNeed doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'Justification') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'BusinessNeed') THEN
        ALTER TABLE ""RiskAcceptanceRequests"" RENAME COLUMN ""Justification"" TO ""BusinessNeed"";
    END IF;
    
    -- Drop CurrentInherentRiskRating column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'CurrentInherentRiskRating') THEN
        ALTER TABLE ""RiskAcceptanceRequests"" DROP COLUMN ""CurrentInherentRiskRating"";
    END IF;
    
    -- Drop FutureResidualRisk column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'FutureResidualRisk') THEN
        ALTER TABLE ""RiskAcceptanceRequests"" DROP COLUMN ""FutureResidualRisk"";
    END IF;
    
    -- Add RiskId column for linking to Risk Register
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAcceptanceRequests' AND column_name = 'RiskId') THEN
        ALTER TABLE ""RiskAcceptanceRequests"" ADD COLUMN ""RiskId"" integer;
    END IF;
    
    -- Add foreign key constraint for RiskId
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_table_usage WHERE table_name = 'RiskAcceptanceRequests' AND constraint_name = 'FK_RiskAcceptanceRequests_Risks_RiskId') THEN
        ALTER TABLE ""RiskAcceptanceRequests"" ADD CONSTRAINT ""FK_RiskAcceptanceRequests_Risks_RiskId"" 
        FOREIGN KEY (""RiskId"") REFERENCES ""Risks"" (""Id"") ON DELETE SET NULL;
    END IF;
    
END $$;";
                
                await _context.Database.ExecuteSqlRawAsync(sql);
                
                ViewBag.Success = "Database schema updated successfully!";
                return View("Index");
            }
            catch (Exception ex)
            {
                ViewBag.Error = $"Error updating schema: {ex.Message}";
                return View("Index");
            }
        }
        
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> VerifySchema()
        {
            try
            {
                var columns = await _context.Database
                    .SqlQuery<DatabaseColumnInfo>(@$"
                        SELECT column_name as ColumnName, 
                               data_type as DataType, 
                               character_maximum_length as MaxLength,
                               is_nullable as IsNullable
                        FROM information_schema.columns 
                        WHERE table_name = 'RiskAcceptanceRequests' 
                        ORDER BY ordinal_position")
                    .ToListAsync();
                
                ViewBag.Columns = columns;
                return View("Index");
            }
            catch (Exception ex)
            {
                ViewBag.Error = $"Error verifying schema: {ex.Message}";
                return View("Index");
            }
        }
    }
    
    public class DatabaseColumnInfo
    {
        public string ColumnName { get; set; } = "";
        public string DataType { get; set; } = "";
        public int? MaxLength { get; set; }
        public string IsNullable { get; set; } = "";
    }
}