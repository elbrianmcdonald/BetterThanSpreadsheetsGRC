-- Mark SSL migration as applied since tables already exist
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") 
VALUES ('20250728195101_AddSSLManagement', '8.0.18');