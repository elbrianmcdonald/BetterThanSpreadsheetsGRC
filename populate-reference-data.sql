-- Populate Reference Data with sample entries
-- This script creates initial data for the smart comboboxes

-- Clear existing reference data (optional)
-- DELETE FROM "ReferenceDataEntries" WHERE "CreatedBy" = 'System Migration';

-- Insert sample Assets (Category = 1)
INSERT INTO "ReferenceDataEntries" ("Category", "Value", "Description", "CreatedBy", "CreatedAt", "IsActive", "IsDeleted", "UsageCount") VALUES 
(1, 'Web Application Server', 'Main web application hosting server', 'System Migration', NOW(), true, false, 5),
(1, 'Database Server', 'Primary database server for application data', 'System Migration', NOW(), true, false, 8),
(1, 'File Server', 'Network file storage server', 'System Migration', NOW(), true, false, 3),
(1, 'Email Server', 'Corporate email server', 'System Migration', NOW(), true, false, 2),
(1, 'Active Directory', 'Domain controller and authentication service', 'System Migration', NOW(), true, false, 6),
(1, 'Customer Portal', 'External customer-facing web portal', 'System Migration', NOW(), true, false, 4),
(1, 'CRM System', 'Customer relationship management system', 'System Migration', NOW(), true, false, 7),
(1, 'ERP System', 'Enterprise resource planning system', 'System Migration', NOW(), true, false, 9),
(1, 'Backup Server', 'Data backup and recovery server', 'System Migration', NOW(), true, false, 2),
(1, 'VPN Gateway', 'Remote access VPN gateway', 'System Migration', NOW(), true, false, 3);

-- Insert sample Business Owners (Category = 2)
INSERT INTO "ReferenceDataEntries" ("Category", "Value", "Description", "CreatedBy", "CreatedAt", "IsActive", "IsDeleted", "UsageCount") VALUES 
(2, 'John Smith', 'IT Director', 'System Migration', NOW(), true, false, 12),
(2, 'Sarah Johnson', 'Finance Manager', 'System Migration', NOW(), true, false, 8),
(2, 'Mike Brown', 'Operations Manager', 'System Migration', NOW(), true, false, 6),
(2, 'Lisa Davis', 'HR Manager', 'System Migration', NOW(), true, false, 4),
(2, 'Tom Wilson', 'Security Manager', 'System Migration', NOW(), true, false, 15),
(2, 'Emily Chen', 'Compliance Officer', 'System Migration', NOW(), true, false, 9),
(2, 'David Miller', 'VP of Technology', 'System Migration', NOW(), true, false, 7),
(2, 'Jennifer Taylor', 'Customer Service Manager', 'System Migration', NOW(), true, false, 3),
(2, 'Robert Garcia', 'Sales Director', 'System Migration', NOW(), true, false, 5),
(2, 'Amanda White', 'Marketing Manager', 'System Migration', NOW(), true, false, 2);

-- Insert sample Business Units (Category = 3)
INSERT INTO "ReferenceDataEntries" ("Category", "Value", "Description", "CreatedBy", "CreatedAt", "IsActive", "IsDeleted", "UsageCount") VALUES 
(3, 'Information Technology', 'IT department and infrastructure', 'System Migration', NOW(), true, false, 20),
(3, 'Finance', 'Financial operations and accounting', 'System Migration', NOW(), true, false, 12),
(3, 'Human Resources', 'HR and employee management', 'System Migration', NOW(), true, false, 8),
(3, 'Operations', 'Business operations and logistics', 'System Migration', NOW(), true, false, 15),
(3, 'Sales', 'Sales and business development', 'System Migration', NOW(), true, false, 10),
(3, 'Marketing', 'Marketing and communications', 'System Migration', NOW(), true, false, 6),
(3, 'Customer Service', 'Customer support and service', 'System Migration', NOW(), true, false, 7),
(3, 'Legal', 'Legal and compliance department', 'System Migration', NOW(), true, false, 4),
(3, 'Executive', 'Executive leadership and management', 'System Migration', NOW(), true, false, 3),
(3, 'Research & Development', 'Product development and innovation', 'System Migration', NOW(), true, false, 5);

-- Insert sample Technical Controls (Category = 4)
INSERT INTO "ReferenceDataEntries" ("Category", "Value", "Description", "CreatedBy", "CreatedAt", "IsActive", "IsDeleted", "UsageCount") VALUES 
(4, 'Firewall Rules', 'Network firewall access control rules', 'System Migration', NOW(), true, false, 18),
(4, 'Antivirus Software', 'Endpoint antivirus and malware protection', 'System Migration', NOW(), true, false, 14),
(4, 'Multi-Factor Authentication', 'MFA for user access control', 'System Migration', NOW(), true, false, 22),
(4, 'Data Encryption', 'Data encryption at rest and in transit', 'System Migration', NOW(), true, false, 16),
(4, 'Access Control Lists', 'File and system access permissions', 'System Migration', NOW(), true, false, 11),
(4, 'Security Monitoring', 'SIEM and security event monitoring', 'System Migration', NOW(), true, false, 9),
(4, 'Patch Management', 'System and software patch management', 'System Migration', NOW(), true, false, 13),
(4, 'Backup and Recovery', 'Data backup and disaster recovery systems', 'System Migration', NOW(), true, false, 8),
(4, 'VPN Access Control', 'Remote access VPN restrictions', 'System Migration', NOW(), true, false, 7),
(4, 'Database Access Controls', 'Database user permissions and roles', 'System Migration', NOW(), true, false, 10),
(4, 'Network Segmentation', 'Network isolation and segmentation', 'System Migration', NOW(), true, false, 12),
(4, 'Intrusion Detection', 'Network and host intrusion detection', 'System Migration', NOW(), true, false, 6),
(4, 'Security Awareness Training', 'Employee security training program', 'System Migration', NOW(), true, false, 5),
(4, 'Vulnerability Scanning', 'Automated vulnerability assessment tools', 'System Migration', NOW(), true, false, 8),
(4, 'Incident Response Plan', 'Security incident response procedures', 'System Migration', NOW(), true, false, 4);