# Authentication Guide

This document provides step-by-step instructions for setting up Azure AD / Entra ID authentication for BetterThanSpreadsheetsGRC.

## Table of Contents

- [Overview](#overview)
- [Azure AD Setup](#azure-ad-setup)
- [Application Configuration](#application-configuration)
- [Organization Assignment](#organization-assignment)
- [Role Assignment](#role-assignment)
- [Troubleshooting](#troubleshooting)
- [Security Best Practices](#security-best-practices)

## Overview

BetterThanSpreadsheetsGRC uses **Azure AD / Entra ID** for enterprise authentication via OAuth 2.0. This provides:

- **Single Sign-On (SSO)**: Users authenticate with corporate Microsoft credentials
- **Enterprise Security**: Leverages existing MFA policies and conditional access
- **Centralized User Management**: IT admins control access via Azure AD
- **Automatic Organization Assignment**: Users assigned to organizations based on email domain

### Authentication Flow

1. User clicks "Sign in with Microsoft" on `/login` page
2. Redirected to Azure AD login page (`login.microsoftonline.com`)
3. User authenticates with Microsoft credentials
4. Azure AD redirects back to application with authorization code
5. Application exchanges code for access token
6. User profile retrieved from Microsoft Graph API
7. Organization assigned based on email domain
8. Database session created with user info (id, email, name, role, organizationId)
9. User redirected to application homepage

## Azure AD Setup

### Prerequisites

- Azure AD tenant (comes with Microsoft 365 or Azure subscription)
- Admin access to Azure Portal
- Organization email domain (e.g., `@company.com`)

### Step 1: Create App Registration

1. **Navigate to Azure Portal**:
   - Go to [https://portal.azure.com](https://portal.azure.com)
   - Sign in with your Azure AD admin account

2. **Open Azure Active Directory**:
   - Search for "Azure Active Directory" in the top search bar
   - Click on "Azure Active Directory"

3. **Create New App Registration**:
   - In the left sidebar, click "App registrations"
   - Click "+ New registration"

4. **Configure App Registration**:
   - **Name**: `BetterThanSpreadsheetsGRC`
   - **Supported account types**: "Accounts in this organizational directory only (Single tenant)"
   - **Redirect URI**:
     - Platform: "Web"
     - URL: `http://localhost:3000/api/auth/callback/azure-ad`
   - Click "Register"

5. **Copy Application IDs**:
   - **Application (client) ID**: Copy this value → This is `AZURE_AD_CLIENT_ID`
   - **Directory (tenant) ID**: Copy this value → This is `AZURE_AD_TENANT_ID`

### Step 2: Generate Client Secret

1. **Navigate to Certificates & secrets**:
   - In your app registration, click "Certificates & secrets" in the left sidebar

2. **Create New Client Secret**:
   - Click "+ New client secret"
   - **Description**: `BetterThanSpreadsheetsGRC Production Secret`
   - **Expires**: 24 months (recommended - set calendar reminder)
   - Click "Add"

3. **Copy Secret Value**:
   - **IMPORTANT**: Copy the **Value** immediately (NOT the Secret ID)
   - This is `AZURE_AD_CLIENT_SECRET`
   - ⚠️ **You cannot retrieve this value later!** If lost, create a new secret.

### Step 3: Configure API Permissions

1. **Navigate to API permissions**:
   - In your app registration, click "API permissions" in the left sidebar

2. **Add Microsoft Graph Permissions**:
   - Click "+ Add a permission"
   - Select "Microsoft Graph"
   - Select "Delegated permissions"
   - Search for and add:
     - `User.Read` (Read user profile)
     - `openid` (OpenID Connect sign-in) - may be auto-added
     - `profile` (Read user's basic profile) - may be auto-added
     - `email` (Read user's email address) - may be auto-added

3. **Grant Admin Consent** (if you're an admin):
   - Click "Grant admin consent for [Your Organization]"
   - Click "Yes" to confirm
   - All permissions should show green checkmarks under "Status"

### Step 4: Add Production Redirect URIs (Later)

When deploying to staging/production:

1. Go to "Authentication" in your app registration
2. Under "Web" → "Redirect URIs", click "+ Add URI"
3. Add production callback URL:
   - Staging: `https://staging.yourdomain.com/api/auth/callback/azure-ad`
   - Production: `https://yourdomain.com/api/auth/callback/azure-ad`
4. Click "Save"

## Application Configuration

### Environment Variables

1. **Copy `.env.example` to `.env`**:
   ```bash
   cp .env.example .env
   ```

2. **Add Azure AD Credentials**:
   ```bash
   # Azure AD / Entra ID Authentication
   AZURE_AD_CLIENT_ID="your-application-client-id-here"
   AZURE_AD_CLIENT_SECRET="your-client-secret-value-here"
   AZURE_AD_TENANT_ID="your-directory-tenant-id-here"

   # NextAuth Configuration
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
   ```

3. **Generate NEXTAUTH_SECRET**:
   ```bash
   openssl rand -base64 32
   ```

4. **Verify Configuration**:
   - The application validates environment variables on startup
   - Check console logs for validation errors
   - Missing variables will prevent Azure AD provider from loading

### Redirect URI Configuration

**Development**: `http://localhost:3000/api/auth/callback/azure-ad`

**Production**: `https://yourdomain.com/api/auth/callback/azure-ad`

⚠️ **IMPORTANT**: Redirect URIs are **case-sensitive** and must **exactly match** the Azure AD configuration.

## Organization Assignment

### How It Works

Users are automatically assigned to organizations based on their **email domain**:

- User email: `john@acme.com`
- Extracted domain: `acme.com`
- Organization slug: `acme-com` (domain with dots replaced by hyphens)
- Organization created automatically if doesn't exist

### Example

1. **First User from Domain**:
   - User `alice@contoso.com` signs in
   - System extracts domain: `contoso.com`
   - No organization exists with slug `contoso-com`
   - System creates Organization:
     - Name: `contoso.com`
     - Slug: `contoso-com`
     - Active: `true`
   - User assigned to new organization

2. **Subsequent Users from Same Domain**:
   - User `bob@contoso.com` signs in
   - System extracts domain: `contoso.com`
   - Organization with slug `contoso-com` already exists
   - User assigned to existing organization

### Customizing Organization Names

After auto-creation, admins can update organization names via database:

```sql
UPDATE "Organization" SET name = 'Contoso Corporation' WHERE slug = 'contoso-com';
```

## Role Assignment

### Default Role

All new users are assigned the **AUDITOR** role by default (most restrictive).

### Available Roles

**Tier 1: Full Administrative Access**
- `ORG_ADMIN`: Manage users, assign roles, configure tenant settings, full GRC access

**Tier 2: Full GRC Operational Access**
- `GRC_ANALYST`: CRUD on Risks/Evidence/Frameworks, assign risks, close risks, export reports
- `SECURITY_ENGINEER`: CRUD on Risks/Evidence, document findings, assign to GRC Analyst
- `CISO`: Read all data, create strategic risks, export compliance reports, view analytics

**Tier 3: Limited Operational Access**
- `IT_STAKEHOLDER`: Read/Update only assigned risks, upload remediation evidence
- `BUSINESS_STAKEHOLDER`: Read/Update only risks requiring their approval
- `AUDITOR`: Read-only access to all evidence, risks, compliance data, audit trails (**default**)

### Upgrading User Roles

Organization Administrators can upgrade user roles via the User Management UI:

1. Sign in as an `ORG_ADMIN`
2. Navigate to `/admin/users`
3. Click "Edit" on the user
4. Select new role from dropdown
5. Click "Save"
6. User's role updates immediately (session refreshed on next request)

## Troubleshooting

### "Configuration Error" on Sign-In

**Cause**: Missing or invalid Azure AD environment variables

**Solution**:
1. Verify all three variables are set in `.env`:
   - `AZURE_AD_CLIENT_ID`
   - `AZURE_AD_CLIENT_SECRET`
   - `AZURE_AD_TENANT_ID`
2. Ensure no extra spaces or quotes
3. Restart the application
4. Check console logs for specific validation errors

### "OAuth Callback Error"

**Cause**: Redirect URI mismatch

**Solution**:
1. Check Azure AD App Registration → Authentication → Redirect URIs
2. Ensure exact match (case-sensitive):
   - Dev: `http://localhost:3000/api/auth/callback/azure-ad`
   - Prod: `https://yourdomain.com/api/auth/callback/azure-ad`
3. Verify `NEXTAUTH_URL` in `.env` matches your domain
4. Clear browser cache and try again

### "Access Denied" Error

**Possible Causes**:
1. User not granted admin consent for permissions
2. User's Azure AD account disabled
3. Conditional access policy blocking sign-in

**Solution**:
1. **Admin Consent**: Ensure admin granted consent in Azure AD
2. **User Account**: Verify user account is active in Azure AD
3. **Conditional Access**: Check Azure AD → Security → Conditional Access policies

### Users Assigned to Wrong Organization

**Cause**: Email domain extraction issue

**Solution**:
1. Verify user's email format: `user@domain.com`
2. Check Organization table for slug: `domain-com`
3. Manually update user's organizationId if needed:
   ```sql
   UPDATE "User" SET "organizationId" = 'correct-org-id' WHERE email = 'user@domain.com';
   ```

### Sign Out Not Working

**Cause**: Session cookie not cleared

**Solution**:
1. Clear browser cookies for application domain
2. Verify database Session table shows session removed
3. Check `NEXTAUTH_URL` matches current domain

## Security Best Practices

### Client Secret Management

1. **Never Commit Secrets to Git**:
   - `.env` is in `.gitignore` by default
   - Never commit `.env` to version control
   - Use separate secrets for dev/staging/production

2. **Rotate Secrets Regularly**:
   - Set calendar reminder before expiry (Azure AD shows expiry date)
   - Generate new secret in Azure AD before old one expires
   - Update `.env` with new secret
   - Restart application
   - Delete old secret from Azure AD

3. **Use Azure Key Vault for Production**:
   - Store secrets in Azure Key Vault
   - Grant application managed identity access to Key Vault
   - Reference secrets via Key Vault SDK in production

### Redirect URI Security

1. **Whitelist Only Known Domains**:
   - Only add production domains to Azure AD redirect URIs
   - Never use wildcards (`*.domain.com`)
   - Remove localhost from production app registration

2. **Use HTTPS in Production**:
   - **NEVER** use `http://` redirect URIs in production
   - Always use `https://` for production environments

### Session Security

1. **Database-Backed Sessions**:
   - Sessions stored in PostgreSQL (not JWT)
   - Allows session revocation and multi-device tracking
   - Configured via `session: { strategy: "database" }`

2. **Session Expiry**:
   - Sessions expire after 24 hours of inactivity (configurable)
   - NextAuth automatically refreshes active sessions

3. **Secure Cookies**:
   - NextAuth sets `Secure` flag on cookies in production
   - `SameSite=Lax` prevents CSRF attacks

### Multi-Tenant Isolation

1. **Organization Filtering**:
   - All queries filtered by `organizationId` from session
   - Database foreign key constraints prevent cross-tenant access
   - Three-layer defense: DB constraints + tRPC middleware + Explicit filtering

2. **Role-Based Access Control**:
   - All admin operations require `ORG_ADMIN` role
   - tRPC procedures enforce role requirements
   - Server-side route protection on `/admin` routes

## Session Management

### Database-Backed Sessions

BetterThanSpreadsheetsGRC uses **database-backed sessions** (not JWT) for enterprise-grade session management:

**Session Configuration:**
- **Storage**: PostgreSQL `Session` table via Prisma adapter
- **Expiry**: 24 hours of inactivity (automatic extension on activity)
- **Strategy**: Database (not JWT) for security and revocability

**Benefits:**
- ✅ **Multi-Device Support**: Users can sign in on multiple devices simultaneously
- ✅ **Role Updates Propagate**: When admin changes user role, all active sessions reflect the update
- ✅ **Session Revocation**: Admins can force sign-out by deleting sessions from database
- ✅ **Audit Trail**: All session events logged for compliance
- ✅ **Security**: Sessions cannot be tampered with client-side (database is source of truth)

### Session Expiry Policy

Sessions automatically expire after **24 hours of inactivity** (NFR13):

**How it works:**
1. User signs in → Session created with `expires` = now + 24 hours
2. Every request → NextAuth checks if session expired
3. If session active < 1 hour → Reuse existing session
4. If session active > 1 hour → Extend session expiry by 24 hours
5. If session expired → User must re-authenticate

**Cleanup:** Run `npm run db:cleanup-sessions` to delete expired sessions (recommended: run via cron every 6 hours).

### Multi-Device Sessions

Users can have multiple active sessions (one per device):
- Desktop browser session
- Mobile browser session
- Multiple tabs (same session cookie)

**Role Update Example:**
1. User signs in on desktop (AUDITOR role)
2. User signs in on mobile (AUDITOR role)
3. Admin upgrades user to GRC_ANALYST
4. User makes next request on desktop → role updated to GRC_ANALYST
5. User makes next request on mobile → role updated to GRC_ANALYST

All active sessions fetch latest role from database (source of truth).

## Testing Authentication

### Manual Testing

1. **Sign In**:
   ```
   Navigate to: http://localhost:3000/login
   Click: "Sign in with Microsoft"
   Authenticate: Use your Azure AD credentials
   Verify: Redirected to homepage after sign-in
   ```

2. **Verify Session**:
   ```sql
   SELECT * FROM "Session" WHERE "userId" = 'your-user-id';
   ```

3. **Verify Organization Assignment**:
   ```sql
   SELECT u.email, u."organizationId", o.name, o.slug
   FROM "User" u
   JOIN "Organization" o ON u."organizationId" = o.id
   WHERE u.email = 'your-email@domain.com';
   ```

4. **Sign Out**:
   ```
   Click: "Sign Out" button in navigation
   Verify: Redirected to /login
   Verify: Session removed from database
   ```

### Integration Testing

See `src/__tests__/integration/azure-ad-auth.test.ts` for automated tests.

## Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Azure AD Documentation](https://docs.microsoft.com/en-us/azure/active-directory/)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/)
- [OAuth 2.0 Authorization Code Flow](https://oauth.net/2/grant-types/authorization-code/)

## Support

If you encounter issues not covered in this guide:

1. Check application console logs for detailed error messages
2. Verify Azure AD configuration matches this guide
3. Review NextAuth.js debugging documentation
4. Contact your system administrator for Azure AD access issues
