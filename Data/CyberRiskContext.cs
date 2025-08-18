﻿using CyberRiskApp.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace CyberRiskApp.Data
{
    public class CyberRiskContext : IdentityDbContext<User>
    {
        public CyberRiskContext(DbContextOptions<CyberRiskContext> options) : base(options)
        {
        }

        // Existing Risk Management DbSets
        public DbSet<Finding> Findings { get; set; }
        public DbSet<Risk> Risks { get; set; }
        public DbSet<RiskAssessment> RiskAssessments { get; set; }
        public DbSet<ThreatScenario> ThreatScenarios { get; set; }
        public DbSet<AssessmentRequest> AssessmentRequests { get; set; }
        public DbSet<RiskAcceptanceRequest> RiskAcceptanceRequests { get; set; }
        public DbSet<FindingClosureRequest> FindingClosureRequests { get; set; }

        // NEW: Risk Backlog Management DbSets
        public DbSet<RiskBacklogEntry> RiskBacklogEntries { get; set; }
        public DbSet<RiskBacklogComment> RiskBacklogComments { get; set; }
        public DbSet<RiskBacklogActivity> RiskBacklogActivities { get; set; }

        // Existing Governance Module DbSets (Compliance)
        public DbSet<ComplianceFramework> ComplianceFrameworks { get; set; }
        public DbSet<ComplianceControl> ComplianceControls { get; set; }
        public DbSet<BusinessOrganization> BusinessOrganizations { get; set; }
        public DbSet<ComplianceAssessment> ComplianceAssessments { get; set; }
        public DbSet<ControlAssessment> ControlAssessments { get; set; }

        // NEW: Maturity Assessment Module DbSets
        public DbSet<MaturityFramework> MaturityFrameworks { get; set; }
        public DbSet<MaturityControl> MaturityControls { get; set; }
        public DbSet<MaturityAssessment> MaturityAssessments { get; set; }
        public DbSet<MaturityControlAssessment> MaturityControlAssessments { get; set; }

        // Risk Level Settings DbSet
        public DbSet<RiskLevelSettings> RiskLevelSettings { get; set; }

        // Third Party Risk Management DbSet
        public DbSet<ThirdParty> ThirdParties { get; set; }

        // Reference Data Management DbSet
        public DbSet<ReferenceDataEntry> ReferenceDataEntries { get; set; }

        // Technical Control to Compliance Control Mapping DbSet
        public DbSet<TechnicalControlComplianceMapping> TechnicalControlComplianceMappings { get; set; }


        // Qualitative Controls DbSet
        public DbSet<QualitativeControl> QualitativeControls { get; set; }

        // Risk Matrix Management DbSets
        public DbSet<RiskMatrix> RiskMatrices { get; set; }
        public DbSet<RiskMatrixLevel> RiskMatrixLevels { get; set; }
        public DbSet<RiskMatrixCell> RiskMatrixCells { get; set; }

        // Strategy Planning DbSets
        public DbSet<StrategyPlan> StrategyPlans { get; set; }
        public DbSet<StrategyGoal> StrategyGoals { get; set; }
        public DbSet<CapabilityRequirement> CapabilityRequirements { get; set; }
        public DbSet<ImplementationMilestone> ImplementationMilestones { get; set; }
        public DbSet<CapabilityControlMapping> CapabilityControlMappings { get; set; }

        // SSL Management DbSets
        public DbSet<SSLCertificate> SSLCertificates { get; set; }
        public DbSet<SSLSettings> SSLSettings { get; set; }

        // App Settings DbSet
        public DbSet<AppSettings> AppSettings { get; set; }

        // Application Domain Management DbSets
        public DbSet<ApplicationDomain> ApplicationDomains { get; set; }
        public DbSet<DomainAlias> DomainAliases { get; set; }
        public DbSet<DomainAccessLog> DomainAccessLogs { get; set; }

        // Threat Environment DbSet
        public DbSet<ThreatEnvironment> ThreatEnvironments { get; set; }

        // Threat Modeling DbSets
        public DbSet<ThreatModel> ThreatModels { get; set; }
        public DbSet<Attack> Attacks { get; set; }
        public DbSet<MitreTechnique> MitreTechniques { get; set; }
        public DbSet<KillChainActivity> KillChainActivities { get; set; }
        public DbSet<AttackScenario> AttackScenarios { get; set; }
        public DbSet<AttackScenarioStep> AttackScenarioSteps { get; set; }
        public DbSet<AttackPath> AttackPaths { get; set; }
        public DbSet<ScenarioRecommendation> ScenarioRecommendations { get; set; }

        // NEW: Enhanced Threat Modeling - Attack Chain DbSets
        public DbSet<ThreatEvent> ThreatEvents { get; set; }
        public DbSet<AttackStepVulnerability> AttackStepVulnerabilities { get; set; }
        public DbSet<LossEvent> LossEvents { get; set; }
        public DbSet<AttackChain> AttackChains { get; set; }
        public DbSet<AttackChainStep> AttackChainSteps { get; set; }
        public DbSet<RiskAssessmentThreatModel> RiskAssessmentThreatModels { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ========================================
            // POSTGRESQL DATETIME CONVERTER
            // ========================================
            // Configure all DateTime properties to work with PostgreSQL "timestamp with time zone"
            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var property in entityType.GetProperties())
                {
                    if (property.ClrType == typeof(DateTime))
                    {
                        // Convert DateTime to UTC for "timestamp with time zone" columns
                        var converter = new ValueConverter<DateTime, DateTime>(
                            // Convert to provider (database) - ensure UTC for PostgreSQL
                            convertToProviderExpression: v => v.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v, DateTimeKind.Utc),
                            // Convert from provider (database) - ensure UTC for application use
                            convertFromProviderExpression: v => DateTime.SpecifyKind(v, DateTimeKind.Utc)
                        );
                        property.SetValueConverter(converter);
                    }
                    else if (property.ClrType == typeof(DateTime?))
                    {
                        // Convert nullable DateTime to UTC for "timestamp with time zone" columns
                        var converter = new ValueConverter<DateTime?, DateTime?>(
                            // Convert to provider (database) - ensure UTC for PostgreSQL
                            convertToProviderExpression: v => !v.HasValue ? v : (v.Value.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v.Value, DateTimeKind.Utc)),
                            // Convert from provider (database) - ensure UTC for application use
                            convertFromProviderExpression: v => !v.HasValue ? v : DateTime.SpecifyKind(v.Value, DateTimeKind.Utc)
                        );
                        property.SetValueConverter(converter);
                    }
                }
            }

            // ========================================
            // EXPLICIT RISK RELATIONSHIPS CONFIGURATION (FIXED)
            // ========================================

            // Configure Risk entity explicitly to prevent RiskAssessmentId1 column issue
            modelBuilder.Entity<Risk>(entity =>
            {
                // Configure the table name
                entity.ToTable("Risks");

                // Configure primary key
                entity.HasKey(r => r.Id);

                // Configure FindingId foreign key explicitly
                entity.Property(r => r.FindingId)
                    .HasColumnName("FindingId");

                // Configure RiskAssessmentId foreign key explicitly  
                entity.Property(r => r.RiskAssessmentId)
                    .HasColumnName("RiskAssessmentId");

                // Configure ThreatScenarioId foreign key explicitly  
                entity.Property(r => r.ThreatScenarioId)
                    .HasColumnName("ThreatScenarioId");

                // Configure relationships with explicit foreign key names and optimal loading
                entity.HasOne(r => r.LinkedFinding)
                    .WithMany(f => f.RelatedRisks)
                    .HasForeignKey(r => r.FindingId)
                    .HasConstraintName("FK_Risks_Findings_FindingId")
                    .OnDelete(DeleteBehavior.SetNull)
                    .IsRequired(false);

                entity.HasOne(r => r.LinkedAssessment)
                    .WithMany()
                    .HasForeignKey(r => r.RiskAssessmentId)
                    .HasConstraintName("FK_Risks_RiskAssessments_RiskAssessmentId")
                    .OnDelete(DeleteBehavior.SetNull)
                    .IsRequired(false);

                entity.HasOne(r => r.LinkedThreatScenario)
                    .WithMany(ts => ts.IdentifiedRisks)
                    .HasForeignKey(r => r.ThreatScenarioId)
                    .HasConstraintName("FK_Risks_ThreatScenarios_ThreatScenarioId")
                    .OnDelete(DeleteBehavior.SetNull)
                    .IsRequired(false);

                // Configure navigation properties for optimized queries
                entity.Navigation(r => r.LinkedFinding).EnableLazyLoading(false);
                entity.Navigation(r => r.LinkedAssessment).EnableLazyLoading(false);
                entity.Navigation(r => r.LinkedThreatScenario).EnableLazyLoading(false);
            });

            // ADDED: Configure RiskAssessment entity to include Finding relationship
            modelBuilder.Entity<RiskAssessment>(entity =>
            {
                // Configure the table name
                entity.ToTable("RiskAssessments");

                // Configure primary key
                entity.HasKey(ra => ra.Id);

                // Configure FindingId foreign key explicitly
                entity.Property(ra => ra.FindingId)
                    .HasColumnName("FindingId");

                // Configure relationship with Finding
                entity.HasOne(ra => ra.LinkedFinding)
                    .WithMany() // A finding can have multiple risk assessments
                    .HasForeignKey(ra => ra.FindingId)
                    .HasConstraintName("FK_RiskAssessments_Findings_FindingId")
                    .OnDelete(DeleteBehavior.SetNull);

                // Configure relationship with identified risks
                entity.HasMany(ra => ra.IdentifiedRisks)
                    .WithOne(r => r.LinkedAssessment)
                    .HasForeignKey(r => r.RiskAssessmentId)
                    .OnDelete(DeleteBehavior.SetNull);

                // Configure relationship with risk matrix
                entity.HasOne(ra => ra.RiskMatrix)
                    .WithMany()
                    .HasForeignKey(ra => ra.RiskMatrixId)
                    .HasConstraintName("FK_RiskAssessments_RiskMatrices_RiskMatrixId")
                    .OnDelete(DeleteBehavior.SetNull);

                // Configure relationship with threat scenarios
                entity.HasMany(ra => ra.ThreatScenarios)
                    .WithOne(ts => ts.RiskAssessment)
                    .HasForeignKey(ts => ts.RiskAssessmentId)
                    .HasConstraintName("FK_ThreatScenarios_RiskAssessments_RiskAssessmentId")
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure ThreatScenario entity relationships
            modelBuilder.Entity<ThreatScenario>(entity =>
            {
                entity.ToTable("ThreatScenarios");
                entity.HasKey(ts => ts.Id);

                // Configure RiskAssessmentId foreign key
                entity.Property(ts => ts.RiskAssessmentId)
                    .HasColumnName("RiskAssessmentId");

                // Configure RowVersion for PostgreSQL - make it nullable or provide default value
                entity.Property(ts => ts.RowVersion)
                    .IsRowVersion()
                    .HasDefaultValueSql("'\\x0000000000000001'::bytea"); // PostgreSQL bytea literal
            });

            // RiskAcceptanceRequest -> Finding (Many-to-One) - Can be linked to a finding
            modelBuilder.Entity<RiskAcceptanceRequest>()
                .HasOne(r => r.LinkedFinding)
                .WithMany(f => f.AcceptanceRequests)
                .HasForeignKey(r => r.FindingId)
                .OnDelete(DeleteBehavior.SetNull);

            // RiskAcceptanceRequest -> Risk (Many-to-One) - Can be linked to a risk
            modelBuilder.Entity<RiskAcceptanceRequest>()
                .HasOne(r => r.LinkedRisk)
                .WithMany()
                .HasForeignKey(r => r.RiskId)
                .OnDelete(DeleteBehavior.SetNull);

            // RiskAcceptanceRequest assignment relationships
            modelBuilder.Entity<RiskAcceptanceRequest>()
                .HasOne(r => r.AssignedToUser)
                .WithMany()
                .HasForeignKey(r => r.AssignedToUserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<RiskAcceptanceRequest>()
                .HasOne(r => r.AssignedByUser)
                .WithMany()
                .HasForeignKey(r => r.AssignedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            // FindingClosureRequest relationships
            modelBuilder.Entity<FindingClosureRequest>()
                .HasOne(r => r.LinkedFinding)
                .WithMany()
                .HasForeignKey(r => r.FindingId)
                .OnDelete(DeleteBehavior.SetNull);

            // FindingClosureRequest assignment relationships
            modelBuilder.Entity<FindingClosureRequest>()
                .HasOne(r => r.AssignedToUser)
                .WithMany()
                .HasForeignKey(r => r.AssignedToUserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<FindingClosureRequest>()
                .HasOne(r => r.AssignedByUser)
                .WithMany()
                .HasForeignKey(r => r.AssignedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            // ========================================
            // EXISTING GOVERNANCE MODULE RELATIONSHIPS (Compliance)
            // ========================================

            // ComplianceFramework -> ComplianceControl (One-to-Many)
            modelBuilder.Entity<ComplianceControl>()
                .HasOne(c => c.Framework)
                .WithMany(f => f.Controls)
                .HasForeignKey(c => c.ComplianceFrameworkId)
                .OnDelete(DeleteBehavior.Cascade);

            // ComplianceFramework -> ComplianceAssessment (One-to-Many)
            modelBuilder.Entity<ComplianceAssessment>()
                .HasOne(a => a.Framework)
                .WithMany(f => f.Assessments)
                .HasForeignKey(a => a.ComplianceFrameworkId)
                .OnDelete(DeleteBehavior.Cascade);

            // BusinessOrganization -> ComplianceAssessment (One-to-Many)
            modelBuilder.Entity<ComplianceAssessment>()
                .HasOne(a => a.Organization)
                .WithMany(o => o.Assessments)
                .HasForeignKey(a => a.BusinessOrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            // ComplianceControl -> ControlAssessment (One-to-Many)
            modelBuilder.Entity<ControlAssessment>()
                .HasOne(ca => ca.Control)
                .WithMany(c => c.Assessments)
                .HasForeignKey(ca => ca.ComplianceControlId)
                .OnDelete(DeleteBehavior.Cascade);

            // ComplianceAssessment -> ControlAssessment (One-to-Many)
            modelBuilder.Entity<ControlAssessment>()
                .HasOne(ca => ca.Assessment)
                .WithMany(a => a.ControlAssessments)
                .HasForeignKey(ca => ca.ComplianceAssessmentId)
                .OnDelete(DeleteBehavior.Cascade);

            // ========================================
            // NEW: MATURITY ASSESSMENT MODULE RELATIONSHIPS
            // ========================================

            // MaturityFramework -> MaturityControl (One-to-Many)
            modelBuilder.Entity<MaturityControl>()
                .HasOne(c => c.Framework)
                .WithMany(f => f.Controls)
                .HasForeignKey(c => c.MaturityFrameworkId)
                .OnDelete(DeleteBehavior.Cascade);

            // MaturityFramework -> MaturityAssessment (One-to-Many)
            modelBuilder.Entity<MaturityAssessment>()
                .HasOne(a => a.Framework)
                .WithMany(f => f.Assessments)
                .HasForeignKey(a => a.MaturityFrameworkId)
                .OnDelete(DeleteBehavior.Cascade);

            // BusinessOrganization -> MaturityAssessment (One-to-Many)
            modelBuilder.Entity<MaturityAssessment>()
                .HasOne(a => a.Organization)
                .WithMany()  // No back-reference needed since BusinessOrganization already has Assessments
                .HasForeignKey(a => a.BusinessOrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            // MaturityControl -> MaturityControlAssessment (One-to-Many)
            modelBuilder.Entity<MaturityControlAssessment>()
                .HasOne(ca => ca.Control)
                .WithMany(c => c.Assessments)
                .HasForeignKey(ca => ca.MaturityControlId)
                .OnDelete(DeleteBehavior.Cascade);

            // MaturityAssessment -> MaturityControlAssessment (One-to-Many)
            modelBuilder.Entity<MaturityControlAssessment>()
                .HasOne(ca => ca.Assessment)
                .WithMany(a => a.ControlAssessments)
                .HasForeignKey(ca => ca.MaturityAssessmentId)
                .OnDelete(DeleteBehavior.Cascade);

            // ========================================
            // REFERENCE DATA CONFIGURATION
            // ========================================
            modelBuilder.Entity<ReferenceDataEntry>()
                .HasIndex(r => new { r.Category, r.Value })
                .IsUnique()
                .HasFilter("\"IsDeleted\" = false");

            modelBuilder.Entity<ReferenceDataEntry>()
                .Property(r => r.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // ========================================
            // TECHNICAL CONTROL MAPPING CONFIGURATION
            // ========================================
            modelBuilder.Entity<TechnicalControlComplianceMapping>()
                .HasOne(m => m.TechnicalControl)
                .WithMany()
                .HasForeignKey(m => m.TechnicalControlId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TechnicalControlComplianceMapping>()
                .HasOne(m => m.ComplianceControl)
                .WithMany()
                .HasForeignKey(m => m.ComplianceControlId)
                .OnDelete(DeleteBehavior.Cascade);

            // Ensure unique mapping per technical control + compliance control combination
            modelBuilder.Entity<TechnicalControlComplianceMapping>()
                .HasIndex(m => new { m.TechnicalControlId, m.ComplianceControlId })
                .IsUnique()
                .HasFilter("\"IsActive\" = true");

            modelBuilder.Entity<TechnicalControlComplianceMapping>()
                .Property(m => m.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // ========================================
            // RISK MATRIX CONFIGURATION
            // ========================================
            
            // RiskMatrix -> RiskMatrixLevel (One-to-Many)
            modelBuilder.Entity<RiskMatrixLevel>()
                .HasOne(l => l.RiskMatrix)
                .WithMany(m => m.Levels)
                .HasForeignKey(l => l.RiskMatrixId)
                .OnDelete(DeleteBehavior.Cascade);

            // RiskMatrix -> RiskMatrixCell (One-to-Many)
            modelBuilder.Entity<RiskMatrixCell>()
                .HasOne(c => c.RiskMatrix)
                .WithMany(m => m.MatrixCells)
                .HasForeignKey(c => c.RiskMatrixId)
                .OnDelete(DeleteBehavior.Cascade);

            // Ensure unique combination of impact, likelihood, and exposure for each matrix
            modelBuilder.Entity<RiskMatrixCell>()
                .HasIndex(c => new { c.RiskMatrixId, c.ImpactLevel, c.LikelihoodLevel, c.ExposureLevel })
                .IsUnique()
                .HasFilter("\"ExposureLevel\" IS NOT NULL");

            // For 2D matrices (no exposure), ensure unique combination of impact and likelihood
            modelBuilder.Entity<RiskMatrixCell>()
                .HasIndex(c => new { c.RiskMatrixId, c.ImpactLevel, c.LikelihoodLevel })
                .IsUnique()
                .HasFilter("\"ExposureLevel\" IS NULL");

            // Ensure unique level values within each matrix and level type
            modelBuilder.Entity<RiskMatrixLevel>()
                .HasIndex(l => new { l.RiskMatrixId, l.LevelType, l.LevelValue })
                .IsUnique();

            // Default values for risk matrix tables
            modelBuilder.Entity<RiskMatrix>()
                .Property(m => m.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<RiskMatrix>()
                .Property(m => m.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // ========================================
            // STRATEGY PLANNING CONFIGURATION
            // ========================================

            // StrategyPlan -> BusinessOrganization (Many-to-One)
            modelBuilder.Entity<StrategyPlan>()
                .HasOne(sp => sp.Organization)
                .WithMany()
                .HasForeignKey(sp => sp.BusinessOrganizationId)
                .OnDelete(DeleteBehavior.Restrict);

            // StrategyPlan -> StrategyGoal (One-to-Many)
            modelBuilder.Entity<StrategyGoal>()
                .HasOne(sg => sg.StrategyPlan)
                .WithMany(sp => sp.Goals)
                .HasForeignKey(sg => sg.StrategyPlanId)
                .OnDelete(DeleteBehavior.Cascade);

            // StrategyGoal -> MaturityFramework (Many-to-One)
            modelBuilder.Entity<StrategyGoal>()
                .HasOne(sg => sg.MaturityFramework)
                .WithMany()
                .HasForeignKey(sg => sg.MaturityFrameworkId)
                .OnDelete(DeleteBehavior.Restrict);

            // StrategyGoal -> CapabilityRequirement (One-to-Many)
            modelBuilder.Entity<CapabilityRequirement>()
                .HasOne(cr => cr.StrategyGoal)
                .WithMany(sg => sg.Capabilities)
                .HasForeignKey(cr => cr.StrategyGoalId)
                .OnDelete(DeleteBehavior.Cascade);

            // CapabilityRequirement -> CapabilityControlMapping (One-to-Many)
            modelBuilder.Entity<CapabilityControlMapping>()
                .HasOne(ccm => ccm.CapabilityRequirement)
                .WithMany(cr => cr.ControlMappings)
                .HasForeignKey(ccm => ccm.CapabilityRequirementId)
                .OnDelete(DeleteBehavior.Cascade);

            // ComplianceControl -> CapabilityControlMapping (One-to-Many)
            modelBuilder.Entity<CapabilityControlMapping>()
                .HasOne(ccm => ccm.ComplianceControl)
                .WithMany(cc => cc.CapabilityMappings)
                .HasForeignKey(ccm => ccm.ComplianceControlId)
                .OnDelete(DeleteBehavior.Cascade);

            // Ensure unique mapping per capability + compliance control combination
            modelBuilder.Entity<CapabilityControlMapping>()
                .HasIndex(ccm => new { ccm.CapabilityRequirementId, ccm.ComplianceControlId })
                .IsUnique();

            // StrategyPlan -> ImplementationMilestone (One-to-Many)
            modelBuilder.Entity<ImplementationMilestone>()
                .HasOne(im => im.StrategyPlan)
                .WithMany(sp => sp.Milestones)
                .HasForeignKey(im => im.StrategyPlanId)
                .OnDelete(DeleteBehavior.Cascade);

            // Default values for strategy planning tables
            modelBuilder.Entity<StrategyPlan>()
                .Property(sp => sp.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<StrategyPlan>()
                .Property(sp => sp.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<StrategyGoal>()
                .Property(sg => sg.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<StrategyGoal>()
                .Property(sg => sg.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<CapabilityRequirement>()
                .Property(cr => cr.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<CapabilityRequirement>()
                .Property(cr => cr.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<ImplementationMilestone>()
                .Property(im => im.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<ImplementationMilestone>()
                .Property(im => im.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<CapabilityControlMapping>()
                .Property(ccm => ccm.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<CapabilityControlMapping>()
                .Property(ccm => ccm.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // ========================================
            // SSL MANAGEMENT CONFIGURATION
            // ========================================

            // SSLSettings -> SSLCertificate (Many-to-One for active certificate)
            modelBuilder.Entity<SSLSettings>()
                .HasOne(s => s.ActiveCertificate)
                .WithMany()
                .HasForeignKey(s => s.ActiveCertificateId)
                .OnDelete(DeleteBehavior.SetNull);

            // Ensure only one SSL settings record exists
            modelBuilder.Entity<SSLSettings>()
                .HasIndex(s => s.Id)
                .IsUnique();

            // Default values for SSL management tables
            modelBuilder.Entity<SSLCertificate>()
                .Property(c => c.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<SSLSettings>()
                .Property(s => s.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // ========================================
            // APP SETTINGS CONFIGURATION
            // ========================================

            // Ensure only one app settings record exists
            modelBuilder.Entity<AppSettings>()
                .HasIndex(s => s.Id)
                .IsUnique();

            // Default values for AppSettings
            modelBuilder.Entity<AppSettings>()
                .Property(s => s.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // ========================================
            // APPLICATION DOMAIN MANAGEMENT CONFIGURATION
            // ========================================

            // Ensure domain names are unique
            modelBuilder.Entity<ApplicationDomain>()
                .HasIndex(d => d.DomainName)
                .IsUnique();

            // Ensure only one primary domain exists (PostgreSQL syntax)
            modelBuilder.Entity<ApplicationDomain>()
                .HasIndex(d => d.IsPrimary)
                .HasFilter("\"IsPrimary\" = true");

            // Default values for ApplicationDomain
            modelBuilder.Entity<ApplicationDomain>()
                .Property(d => d.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // Domain alias configuration
            modelBuilder.Entity<DomainAlias>()
                .HasOne(a => a.ApplicationDomain)
                .WithMany(d => d.Aliases)
                .HasForeignKey(a => a.ApplicationDomainId)
                .OnDelete(DeleteBehavior.Cascade);

            // Ensure alias names are unique
            modelBuilder.Entity<DomainAlias>()
                .HasIndex(a => a.AliasName)
                .IsUnique();

            // Default values for DomainAlias
            modelBuilder.Entity<DomainAlias>()
                .Property(a => a.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // Domain access log indexing for performance
            modelBuilder.Entity<DomainAccessLog>()
                .HasIndex(l => l.AccessTime);

            modelBuilder.Entity<DomainAccessLog>()
                .HasIndex(l => l.RequestedDomain);

            modelBuilder.Entity<DomainAccessLog>()
                .HasIndex(l => l.ResponseCode);

            modelBuilder.Entity<DomainAccessLog>()
                .Property(l => l.AccessTime)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // ========================================
            // NEW: THREAT MODELING CONFIGURATION
            // ========================================

            // ThreatModel -> Attack (One-to-Many)
            modelBuilder.Entity<Attack>()
                .HasOne(a => a.ThreatModel)
                .WithMany(tm => tm.Attacks)
                .HasForeignKey(a => a.ThreatModelId)
                .OnDelete(DeleteBehavior.Cascade);

            // ThreatModel -> RiskAssessment (Many-to-One) - Optional linkage
            modelBuilder.Entity<ThreatModel>()
                .HasOne(tm => tm.LinkedRiskAssessment)
                .WithMany(ra => ra.LinkedThreatModels)
                .HasForeignKey(tm => tm.RiskAssessmentId)
                .HasConstraintName("FK_ThreatModels_RiskAssessments_RiskAssessmentId")
                .OnDelete(DeleteBehavior.SetNull);

            // Attack -> Finding (Many-to-One) - Optional linkage
            modelBuilder.Entity<Attack>()
                .HasOne(a => a.LinkedFinding)
                .WithMany()
                .HasForeignKey(a => a.FindingId)
                .HasConstraintName("FK_Attacks_Findings_FindingId")
                .OnDelete(DeleteBehavior.SetNull);

            // Attack -> Risk (Many-to-One) - Optional linkage
            modelBuilder.Entity<Attack>()
                .HasOne(a => a.LinkedRisk)
                .WithMany()
                .HasForeignKey(a => a.RiskId)
                .HasConstraintName("FK_Attacks_Risks_RiskId")
                .OnDelete(DeleteBehavior.SetNull);

            // Configure foreign key column names explicitly
            modelBuilder.Entity<ThreatModel>()
                .Property(tm => tm.RiskAssessmentId)
                .HasColumnName("RiskAssessmentId");

            modelBuilder.Entity<Attack>()
                .Property(a => a.ThreatModelId)
                .HasColumnName("ThreatModelId");

            modelBuilder.Entity<Attack>()
                .Property(a => a.FindingId)
                .HasColumnName("FindingId");

            modelBuilder.Entity<Attack>()
                .Property(a => a.RiskId)
                .HasColumnName("RiskId");

            // Default values for threat modeling tables
            modelBuilder.Entity<ThreatModel>()
                .Property(tm => tm.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<ThreatModel>()
                .Property(tm => tm.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<Attack>()
                .Property(a => a.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<Attack>()
                .Property(a => a.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // ========================================
            // NEW: ENHANCED THREAT MODELING RELATIONSHIPS
            // ========================================

            // ThreatModel -> AttackScenario (One-to-Many)
            modelBuilder.Entity<AttackScenario>()
                .HasOne(s => s.ThreatModel)
                .WithMany(tm => tm.AttackScenarios)
                .HasForeignKey(s => s.ThreatModelId)
                .OnDelete(DeleteBehavior.Cascade);

            // AttackScenario -> AttackScenarioStep (One-to-Many)
            modelBuilder.Entity<AttackScenarioStep>()
                .HasOne(s => s.AttackScenario)
                .WithMany(s => s.Steps)
                .HasForeignKey(s => s.AttackScenarioId)
                .OnDelete(DeleteBehavior.Cascade);

            // AttackScenario -> AttackPath (One-to-Many)
            modelBuilder.Entity<AttackPath>()
                .HasOne(p => p.AttackScenario)
                .WithMany(s => s.AttackPaths)
                .HasForeignKey(p => p.AttackScenarioId)
                .OnDelete(DeleteBehavior.Cascade);

            // ThreatEnvironment -> AttackPath (Source and Target)
            modelBuilder.Entity<AttackPath>()
                .HasOne(p => p.SourceEnvironment)
                .WithMany(e => e.SourcePaths)
                .HasForeignKey(p => p.SourceEnvironmentId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AttackPath>()
                .HasOne(p => p.TargetEnvironment)
                .WithMany(e => e.TargetPaths)
                .HasForeignKey(p => p.TargetEnvironmentId)
                .OnDelete(DeleteBehavior.Restrict);

            // MitreTechnique -> TechniqueEnvironmentMapping (One-to-Many)
            modelBuilder.Entity<TechniqueEnvironmentMapping>()
                .HasOne(m => m.MitreTechnique)
                .WithMany(t => t.EnvironmentMappings)
                .HasForeignKey(m => m.MitreTechniqueId)
                .OnDelete(DeleteBehavior.Cascade);

            // ThreatEnvironment -> TechniqueEnvironmentMapping (One-to-Many)
            modelBuilder.Entity<TechniqueEnvironmentMapping>()
                .HasOne(m => m.Environment)
                .WithMany(e => e.TechniqueMappings)
                .HasForeignKey(m => m.EnvironmentId)
                .OnDelete(DeleteBehavior.Cascade);


            modelBuilder.Entity<AttackScenarioStep>()
                .HasOne(s => s.MitreTechnique)
                .WithMany()
                .HasForeignKey(s => s.MitreTechniqueId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<AttackScenarioStep>()
                .HasOne(s => s.KillChainActivity)
                .WithMany(k => k.ScenarioSteps)
                .HasForeignKey(s => s.KillChainActivityId)
                .OnDelete(DeleteBehavior.SetNull);

            // AttackScenario -> ScenarioRecommendation (One-to-Many)
            modelBuilder.Entity<ScenarioRecommendation>()
                .HasOne(r => r.AttackScenario)
                .WithMany(s => s.Recommendations)
                .HasForeignKey(r => r.AttackScenarioId)
                .OnDelete(DeleteBehavior.Cascade);

            // MitreTechnique self-referencing for sub-techniques
            modelBuilder.Entity<MitreTechnique>()
                .HasOne(t => t.ParentTechnique)
                .WithMany(t => t.SubTechniques)
                .HasForeignKey(t => t.ParentTechniqueId)
                .OnDelete(DeleteBehavior.Restrict);

            // Many-to-Many: AttackScenario <-> MitreTechnique
            modelBuilder.Entity<AttackScenario>()
                .HasMany(s => s.MitreTechniques)
                .WithMany(t => t.AttackScenarios)
                .UsingEntity(j => j.ToTable("AttackScenarioMitreTechniques"));

            // Indexes for better performance
            modelBuilder.Entity<MitreTechnique>()
                .HasIndex(t => t.TechniqueId)
                .IsUnique();

            modelBuilder.Entity<ThreatEnvironment>()
                .HasIndex(e => new { e.ThreatModelId, e.EnvironmentType });

            modelBuilder.Entity<KillChainActivity>()
                .HasIndex(k => new { k.Phase, k.EnvironmentType });

            // Default values for new tables
            modelBuilder.Entity<ThreatEnvironment>()
                .Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<MitreTechnique>()
                .Property(t => t.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<AttackScenario>()
                .Property(s => s.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<AttackScenarioStep>()
                .Property(s => s.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<KillChainActivity>()
                .Property(k => k.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<AttackPath>()
                .Property(p => p.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");


            modelBuilder.Entity<ScenarioRecommendation>()
                .Property(r => r.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");
        }
    }
}