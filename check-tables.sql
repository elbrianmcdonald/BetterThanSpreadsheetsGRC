-- Check if SSL tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('SSLCertificates', 'SSLSettings', 'ThreatModels', 'Attacks');