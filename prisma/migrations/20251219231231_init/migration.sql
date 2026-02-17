-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'UPDATE_ROLE', 'UPDATE_USER_ROLE', 'PASSWORD_RESET', 'PASSWORD_CHANGE', 'UPLOAD_EVIDENCE', 'UPDATE_EVIDENCE', 'DELETE_EVIDENCE', 'RESTORE_EVIDENCE', 'REPLACE_EVIDENCE_FILE', 'TAG_EVIDENCE', 'VIEW_EVIDENCE', 'DOWNLOAD_EVIDENCE', 'LINK_EVIDENCE_TO_RISK', 'UNLINK_EVIDENCE_FROM_RISK', 'CREATE_EVIDENCE_REQUEST', 'FULFILL_EVIDENCE_REQUEST', 'CANCEL_EVIDENCE_REQUEST', 'SEND_EVIDENCE_REQUEST_EMAIL', 'SEND_EVIDENCE_REQUEST_REMINDER', 'CREATE_RISK', 'UPDATE_RISK', 'ASSIGN_RISK', 'CLOSE_RISK', 'ADD_RISK_COMMENT', 'UPDATE_RISK_STATUS', 'ACTIVATE_FRAMEWORK', 'DEACTIVATE_FRAMEWORK', 'IMPORT_OSCAL_CATALOG', 'UPDATE_OSCAL_CATALOG', 'CONTROL_ADDED', 'CONTROL_DEPRECATED', 'CONTROL_MODIFIED', 'ACTIVATE_DOMAIN', 'DEACTIVATE_DOMAIN', 'REORDER_DOMAINS', 'CREATE_MAPPING', 'UPDATE_MAPPING', 'DELETE_MAPPING', 'SIGN_IN', 'SIGN_OUT', 'FAILED_LOGIN', 'AUTHORIZATION_FAILED', 'BACKUP_CREATED', 'SYSTEM_CONFIGURATION_CHANGED');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'ASSIGNED', 'REMEDIATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ORG_ADMIN', 'GRC_ANALYST', 'SECURITY_ENGINEER', 'CISO', 'IT_STAKEHOLDER', 'BUSINESS_STAKEHOLDER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "RiskEvidenceLinkType" AS ENUM ('FINDING', 'REMEDIATION');

-- CreateEnum
CREATE TYPE "RiskFindingSource" AS ENUM ('VULNERABILITY_SCAN', 'PENETRATION_TEST', 'AUDIT_FINDING', 'SECURITY_REVIEW', 'COMPLIANCE_ASSESSMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "RiskTemplateCategory" AS ENUM ('CLOUD_INFRASTRUCTURE', 'ACCESS_CONTROL', 'DATA_SECURITY', 'NETWORK_SECURITY', 'APPLICATION_SECURITY');

-- CreateEnum
CREATE TYPE "EvidenceRequestStatus" AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "refresh_token_expires_in" INTEGER,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Control" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "guidance" TEXT,
    "parentControlId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlDomain" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlDomainMapping" (
    "id" TEXT NOT NULL,
    "controlDomainId" TEXT NOT NULL,
    "frameworkCode" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlDomainMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "description" TEXT,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceVersion" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "changeReason" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceControlDomain" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "controlDomainId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceControlDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Framework" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "publicationDate" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "oscalCatalog" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "activatedBy" TEXT,
    "targetCompletionDate" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Framework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "settings" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affectedSystems" TEXT,
    "severity" "Severity" NOT NULL,
    "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT,
    "templateId" TEXT,
    "findingSource" "RiskFindingSource",
    "cveId" TEXT,
    "discoveryDate" TIMESTAMP(3),
    "technicalDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskEvidence" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "linkType" "RiskEvidenceLinkType" NOT NULL,
    "linkedById" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "hashedPassword" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'AUDITOR',
    "organizationId" TEXT NOT NULL,
    "assignedFrameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "RiskTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "RiskTemplateCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "prePopulatedDomains" TEXT[],
    "evidenceGuidance" TEXT NOT NULL,
    "severityDefault" "Severity" NOT NULL,
    "affectedSystemsGuidance" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRequest" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "controlTaxonomyIds" TEXT[],
    "dueDate" TIMESTAMP(3) NOT NULL,
    "instructions" TEXT NOT NULL,
    "frameworkCode" TEXT,
    "status" "EvidenceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "evidenceId" TEXT,
    "organizationId" TEXT NOT NULL,
    "fulfilledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_entityType_entityId_idx" ON "AuditLog"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_timestamp_idx" ON "AuditLog"("organizationId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_userId_idx" ON "AuditLog"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "Control_frameworkId_idx" ON "Control"("frameworkId");

-- CreateIndex
CREATE INDEX "Control_frameworkId_isActive_idx" ON "Control"("frameworkId", "isActive");

-- CreateIndex
CREATE INDEX "Control_organizationId_frameworkId_idx" ON "Control"("organizationId", "frameworkId");

-- CreateIndex
CREATE INDEX "Control_organizationId_id_idx" ON "Control"("organizationId", "id");

-- CreateIndex
CREATE INDEX "Control_organizationId_idx" ON "Control"("organizationId");

-- CreateIndex
CREATE INDEX "Control_parentControlId_idx" ON "Control"("parentControlId");

-- CreateIndex
CREATE UNIQUE INDEX "Control_frameworkId_controlId_key" ON "Control"("frameworkId", "controlId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlDomain_code_key" ON "ControlDomain"("code");

-- CreateIndex
CREATE INDEX "ControlDomain_isActive_sortOrder_idx" ON "ControlDomain"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ControlDomain_sortOrder_idx" ON "ControlDomain"("sortOrder");

-- CreateIndex
CREATE INDEX "ControlDomainMapping_controlDomainId_frameworkCode_idx" ON "ControlDomainMapping"("controlDomainId", "frameworkCode");

-- CreateIndex
CREATE INDEX "ControlDomainMapping_controlDomainId_idx" ON "ControlDomainMapping"("controlDomainId");

-- CreateIndex
CREATE INDEX "ControlDomainMapping_frameworkCode_controlId_idx" ON "ControlDomainMapping"("frameworkCode", "controlId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlDomainMapping_controlDomainId_frameworkCode_controlI_key" ON "ControlDomainMapping"("controlDomainId", "frameworkCode", "controlId");

-- CreateIndex
CREATE INDEX "Evidence_organizationId_idx" ON "Evidence"("organizationId");

-- CreateIndex
CREATE INDEX "Evidence_organizationId_isActive_idx" ON "Evidence"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "Evidence_organizationId_uploadedBy_idx" ON "Evidence"("organizationId", "uploadedBy");

-- CreateIndex
CREATE INDEX "Evidence_organizationId_deletedAt_idx" ON "Evidence"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "Evidence_uploadedBy_idx" ON "Evidence"("uploadedBy");

-- CreateIndex
CREATE INDEX "EvidenceVersion_evidenceId_versionNumber_idx" ON "EvidenceVersion"("evidenceId", "versionNumber");

-- CreateIndex
CREATE INDEX "EvidenceVersion_evidenceId_idx" ON "EvidenceVersion"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceVersion_evidenceId_versionNumber_key" ON "EvidenceVersion"("evidenceId", "versionNumber");

-- CreateIndex
CREATE INDEX "EvidenceControlDomain_controlDomainId_idx" ON "EvidenceControlDomain"("controlDomainId");

-- CreateIndex
CREATE INDEX "EvidenceControlDomain_evidenceId_idx" ON "EvidenceControlDomain"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceControlDomain_evidenceId_controlDomainId_key" ON "EvidenceControlDomain"("evidenceId", "controlDomainId");

-- CreateIndex
CREATE INDEX "Framework_code_idx" ON "Framework"("code");

-- CreateIndex
CREATE INDEX "Framework_isActive_idx" ON "Framework"("isActive");

-- CreateIndex
CREATE INDEX "Framework_organizationId_id_idx" ON "Framework"("organizationId", "id");

-- CreateIndex
CREATE INDEX "Framework_organizationId_idx" ON "Framework"("organizationId");

-- CreateIndex
CREATE INDEX "Framework_organizationId_isActive_idx" ON "Framework"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Framework_organizationId_code_version_key" ON "Framework"("organizationId", "code", "version");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_timestamp_idx" ON "LoginAttempt"("email", "timestamp");

-- CreateIndex
CREATE INDEX "LoginAttempt_ipAddress_timestamp_idx" ON "LoginAttempt"("ipAddress", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_active_idx" ON "Organization"("active");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expires_idx" ON "PasswordResetToken"("expires");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "Risk_organizationId_idx" ON "Risk"("organizationId");

-- CreateIndex
CREATE INDEX "Risk_organizationId_severity_idx" ON "Risk"("organizationId", "severity");

-- CreateIndex
CREATE INDEX "Risk_organizationId_status_idx" ON "Risk"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Risk_severity_idx" ON "Risk"("severity");

-- CreateIndex
CREATE INDEX "Risk_status_idx" ON "Risk"("status");

-- CreateIndex
CREATE INDEX "RiskEvidence_riskId_idx" ON "RiskEvidence"("riskId");

-- CreateIndex
CREATE INDEX "RiskEvidence_evidenceId_idx" ON "RiskEvidence"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskEvidence_riskId_evidenceId_key" ON "RiskEvidence"("riskId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "RiskTemplate_organizationId_category_idx" ON "RiskTemplate"("organizationId", "category");

-- CreateIndex
CREATE INDEX "RiskTemplate_organizationId_idx" ON "RiskTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "EvidenceRequest_organizationId_recipientUserId_status_idx" ON "EvidenceRequest"("organizationId", "recipientUserId", "status");

-- CreateIndex
CREATE INDEX "EvidenceRequest_organizationId_requestedById_idx" ON "EvidenceRequest"("organizationId", "requestedById");

-- CreateIndex
CREATE INDEX "EvidenceRequest_dueDate_status_idx" ON "EvidenceRequest"("dueDate", "status");

-- CreateIndex
CREATE INDEX "EvidenceRequest_organizationId_idx" ON "EvidenceRequest"("organizationId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_parentControlId_fkey" FOREIGN KEY ("parentControlId") REFERENCES "Control"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlDomainMapping" ADD CONSTRAINT "ControlDomainMapping_controlDomainId_fkey" FOREIGN KEY ("controlDomainId") REFERENCES "ControlDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceVersion" ADD CONSTRAINT "EvidenceVersion_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceVersion" ADD CONSTRAINT "EvidenceVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceControlDomain" ADD CONSTRAINT "EvidenceControlDomain_controlDomainId_fkey" FOREIGN KEY ("controlDomainId") REFERENCES "ControlDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceControlDomain" ADD CONSTRAINT "EvidenceControlDomain_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Framework" ADD CONSTRAINT "Framework_activatedBy_fkey" FOREIGN KEY ("activatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Framework" ADD CONSTRAINT "Framework_deactivatedBy_fkey" FOREIGN KEY ("deactivatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Framework" ADD CONSTRAINT "Framework_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RiskTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskEvidence" ADD CONSTRAINT "RiskEvidence_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskEvidence" ADD CONSTRAINT "RiskEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskEvidence" ADD CONSTRAINT "RiskEvidence_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskTemplate" ADD CONSTRAINT "RiskTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRequest" ADD CONSTRAINT "EvidenceRequest_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRequest" ADD CONSTRAINT "EvidenceRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRequest" ADD CONSTRAINT "EvidenceRequest_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRequest" ADD CONSTRAINT "EvidenceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
