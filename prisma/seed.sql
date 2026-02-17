-- Seed data for BetterThanSpreadsheetsGRC
-- Password for all users: Admin123!@#

-- Insert Organizations
INSERT INTO "Organization" (id, name, slug, settings, active, "createdAt", "updatedAt")
VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Acme Corporation', 'acme-corp', '{"industry": "Technology", "employees": 500}', true, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'Globex Inc', 'globex-inc', '{"industry": "Manufacturing", "employees": 1200}', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert Users (password hash for 'Admin123!@#')
INSERT INTO "User" (id, email, name, "hashedPassword", role, "organizationId", "emailVerified", "createdAt", "updatedAt")
VALUES
  ('550e8400-e29b-41d4-a716-446655440011', 'admin@acme-corp.com', 'Alice Admin', '$2b$10$jDC2qxxxP6CLnU9xz.eMNuQIIR68cDhkyRa5S6GW..TrLbPSiA6Oa', 'ORG_ADMIN', '550e8400-e29b-41d4-a716-446655440001', NOW(), NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440012', 'analyst@acme-corp.com', 'Bob Analyst', '$2b$10$jDC2qxxxP6CLnU9xz.eMNuQIIR68cDhkyRa5S6GW..TrLbPSiA6Oa', 'GRC_ANALYST', '550e8400-e29b-41d4-a716-446655440001', NOW(), NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440021', 'admin@globex-inc.com', 'Carol Admin', '$2b$10$jDC2qxxxP6CLnU9xz.eMNuQIIR68cDhkyRa5S6GW..TrLbPSiA6Oa', 'ORG_ADMIN', '550e8400-e29b-41d4-a716-446655440002', NOW(), NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440022', 'engineer@globex-inc.com', 'David Engineer', '$2b$10$jDC2qxxxP6CLnU9xz.eMNuQIIR68cDhkyRa5S6GW..TrLbPSiA6Oa', 'SECURITY_ENGINEER', '550e8400-e29b-41d4-a716-446655440002', NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert Evidence records
INSERT INTO "Evidence" (id, "organizationId", title, description, "filePath", "fileSize", "fileType", "uploadedBy", "createdAt", "updatedAt")
VALUES
  ('550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440001', 'SOC 2 Audit Report 2024', 'Annual SOC 2 Type II audit report', '/uploads/acme-corp/soc2-2024.pdf', 2548736, 'application/pdf', '550e8400-e29b-41d4-a716-446655440012', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440001', 'Penetration Test Results', 'Q4 2024 penetration testing report', '/uploads/acme-corp/pentest-q4.pdf', 1024000, 'application/pdf', '550e8400-e29b-41d4-a716-446655440012', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440041', '550e8400-e29b-41d4-a716-446655440002', 'ISO 27001 Certificate', 'Current ISO 27001:2013 certification', '/uploads/globex-inc/iso27001-cert.pdf', 512000, 'application/pdf', '550e8400-e29b-41d4-a716-446655440022', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440042', '550e8400-e29b-41d4-a716-446655440002', 'Incident Response Plan', 'Updated incident response procedures', '/uploads/globex-inc/ir-plan.docx', 256000, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '550e8400-e29b-41d4-a716-446655440022', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert Risk records
INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "createdAt", "updatedAt")
VALUES
  ('550e8400-e29b-41d4-a716-446655440051', '550e8400-e29b-41d4-a716-446655440001', 'Unpatched SQL Server 2019', 'Production SQL Server missing critical security patches', 'HIGH', 'OPEN', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440052', '550e8400-e29b-41d4-a716-446655440001', 'Missing MFA on Admin Accounts', 'Administrative accounts do not have MFA enabled', 'MEDIUM', 'OPEN', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440061', '550e8400-e29b-41d4-a716-446655440002', 'Weak Password Policy', 'Password complexity requirements do not meet NIST standards', 'MEDIUM', 'OPEN', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440062', '550e8400-e29b-41d4-a716-446655440002', 'Unsegmented Network', 'Flat network architecture increases blast radius', 'HIGH', 'REMEDIATED', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert Framework records
INSERT INTO "Framework" (id, "organizationId", name, identifier, version, "isActive", "activatedAt", "createdAt", "updatedAt")
VALUES
  ('550e8400-e29b-41d4-a716-446655440071', '550e8400-e29b-41d4-a716-446655440001', 'SOC 2 Type II', 'SOC2', '2017', true, '2024-01-01', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440081', '550e8400-e29b-41d4-a716-446655440002', 'ISO/IEC 27001', 'ISO27001', '2013', true, '2024-03-15', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert Audit Logs
INSERT INTO "AuditLog" (id, "organizationId", action, "entityType", "entityId", "userId", changes, timestamp)
VALUES
  ('550e8400-e29b-41d4-a716-446655440091', '550e8400-e29b-41d4-a716-446655440001', 'UPLOAD_EVIDENCE', 'Evidence', '550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440012', '{"title": "SOC 2 Audit Report 2024", "uploadedBy": "Bob Analyst"}', NOW()),
  ('550e8400-e29b-41d4-a716-446655440092', '550e8400-e29b-41d4-a716-446655440002', 'UPDATE_RISK_STATUS', 'Risk', '550e8400-e29b-41d4-a716-446655440062', '550e8400-e29b-41d4-a716-446655440022', '{"status": {"from": "OPEN", "to": "REMEDIATED"}, "updatedBy": "David Engineer"}', NOW())
ON CONFLICT (id) DO NOTHING;
