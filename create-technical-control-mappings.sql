-- Create TechnicalControlComplianceMappings table
-- This table maps technical controls to compliance assessment controls in a one-to-many relationship

CREATE TABLE IF NOT EXISTS "TechnicalControlComplianceMappings" (
    "Id" SERIAL PRIMARY KEY,
    "TechnicalControlId" integer NOT NULL,
    "ComplianceControlId" integer NOT NULL,
    "MappingRationale" character varying(1000) NOT NULL DEFAULT '',
    "ImplementationNotes" character varying(500) NOT NULL DEFAULT '',
    "IsActive" boolean NOT NULL DEFAULT true,
    "CreatedBy" character varying(100) NOT NULL DEFAULT '',
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ModifiedBy" character varying(100),
    "ModifiedAt" timestamp with time zone,
    
    -- Foreign key constraints
    CONSTRAINT "FK_TechnicalControlComplianceMappings_ReferenceDataEntries_TechnicalControlId" 
        FOREIGN KEY ("TechnicalControlId") 
        REFERENCES "ReferenceDataEntries" ("Id") 
        ON DELETE CASCADE,
        
    CONSTRAINT "FK_TechnicalControlComplianceMappings_ComplianceControls_ComplianceControlId" 
        FOREIGN KEY ("ComplianceControlId") 
        REFERENCES "ComplianceControls" ("Id") 
        ON DELETE CASCADE
);

-- Create unique index to prevent duplicate mappings (only for active mappings)
CREATE UNIQUE INDEX IF NOT EXISTS "IX_TechnicalControlComplianceMappings_TechnicalControlId_ComplianceControlId" 
    ON "TechnicalControlComplianceMappings" ("TechnicalControlId", "ComplianceControlId") 
    WHERE "IsActive" = true;

-- Create index for performance on technical control lookups
CREATE INDEX IF NOT EXISTS "IX_TechnicalControlComplianceMappings_TechnicalControlId" 
    ON "TechnicalControlComplianceMappings" ("TechnicalControlId");

-- Create index for performance on compliance control lookups  
CREATE INDEX IF NOT EXISTS "IX_TechnicalControlComplianceMappings_ComplianceControlId" 
    ON "TechnicalControlComplianceMappings" ("ComplianceControlId");

-- Insert sample technical control mappings (optional - can be removed if not needed)
-- These are examples showing how technical controls might map to compliance controls

-- First, let's add some sample technical controls to the reference data
INSERT INTO "ReferenceDataEntries" ("Category", "Value", "Description", "CreatedBy", "CreatedAt") 
VALUES 
    (4, 'Firewall Configuration Management', 'Automated firewall rule management and monitoring system', 'System', CURRENT_TIMESTAMP),
    (4, 'Endpoint Detection and Response (EDR)', 'Advanced endpoint monitoring and threat detection platform', 'System', CURRENT_TIMESTAMP),
    (4, 'Multi-Factor Authentication (MFA)', 'Enterprise MFA solution for user authentication', 'System', CURRENT_TIMESTAMP),
    (4, 'Vulnerability Scanning', 'Automated vulnerability assessment and scanning tools', 'System', CURRENT_TIMESTAMP),
    (4, 'Log Management System', 'Centralized logging and SIEM platform', 'System', CURRENT_TIMESTAMP),
    (4, 'Data Loss Prevention (DLP)', 'Enterprise data protection and monitoring solution', 'System', CURRENT_TIMESTAMP),
    (4, 'Patch Management System', 'Automated patch deployment and tracking system', 'System', CURRENT_TIMESTAMP),
    (4, 'Backup and Recovery Solution', 'Enterprise backup, replication and disaster recovery platform', 'System', CURRENT_TIMESTAMP),
    (4, 'Identity and Access Management (IAM)', 'Centralized user provisioning and access control system', 'System', CURRENT_TIMESTAMP),
    (4, 'Network Segmentation', 'VLAN and network isolation implementation', 'System', CURRENT_TIMESTAMP)
ON CONFLICT ("Category", "Value") DO NOTHING;

-- Sample mappings (these will only work if you have compliance controls in your database)
-- Uncomment these lines if you want sample data and have compliance controls loaded:

/*
-- Example: Map Firewall to Access Control requirements
INSERT INTO "TechnicalControlComplianceMappings" 
    ("TechnicalControlId", "ComplianceControlId", "MappingRationale", "ImplementationNotes", "CreatedBy", "CreatedAt")
SELECT 
    tc.Id,
    cc.Id,
    'Firewall provides network-level access control and traffic filtering as required by this control',
    'Firewall rules are configured to restrict network access based on business requirements and security policies',
    'System',
    CURRENT_TIMESTAMP
FROM "ReferenceDataEntries" tc
CROSS JOIN "ComplianceControls" cc
WHERE tc."Category" = 4 
    AND tc."Value" = 'Firewall Configuration Management'
    AND cc."ControlId" IN ('AC-3', 'SC-7') -- Example NIST controls for Access Control and Boundary Protection
LIMIT 5;

-- Example: Map MFA to Authentication requirements  
INSERT INTO "TechnicalControlComplianceMappings" 
    ("TechnicalControlId", "ComplianceControlId", "MappingRationale", "ImplementationNotes", "CreatedBy", "CreatedAt")
SELECT 
    tc.Id,
    cc.Id,
    'Multi-factor authentication strengthens user authentication as required by this control',
    'MFA is implemented for all privileged accounts and remote access scenarios',
    'System',
    CURRENT_TIMESTAMP
FROM "ReferenceDataEntries" tc
CROSS JOIN "ComplianceControls" cc
WHERE tc."Category" = 4 
    AND tc."Value" = 'Multi-Factor Authentication (MFA)'
    AND cc."ControlId" IN ('IA-2', 'IA-5') -- Example NIST controls for Authentication
LIMIT 3;
*/

-- Verify the table was created successfully
SELECT 
    COUNT(*) as "TableExists",
    'TechnicalControlComplianceMappings table created successfully' as "Status"
FROM information_schema.tables 
WHERE table_name = 'TechnicalControlComplianceMappings';