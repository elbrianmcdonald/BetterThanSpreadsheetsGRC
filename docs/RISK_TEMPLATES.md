# Risk Templates

> Story 4.2: Pre-Built Risk Assessment Templates (5 Templates)

## Overview

Risk Templates provide pre-built assessment structures for common security risk categories. Templates streamline risk creation by pre-populating fields with domain-specific guidance, evidence requirements, and default severity levels.

## Available Templates

### 1. Cloud Infrastructure Risk Assessment

**Category:** `CLOUD_INFRASTRUCTURE`
**Default Severity:** MEDIUM

**Pre-populated Control Domains:**
- DATA_PROTECTION
- ACCESS_CONTROL
- ENCRYPTION

**Use Cases:**
- IaaS/PaaS security misconfigurations
- Cloud storage access issues
- Virtual machine security findings
- Container/serverless security gaps

**Evidence Guidance:**
- IAM policies and role assignments
- Security group/firewall configurations
- Encryption settings (at-rest and in-transit)
- Logging and monitoring configurations

---

### 2. Access Control Risk Assessment

**Category:** `ACCESS_CONTROL`
**Default Severity:** HIGH

**Pre-populated Control Domains:**
- ACCESS_CONTROL
- AUTHENTICATION
- LOGGING_MONITORING

**Use Cases:**
- Identity management weaknesses
- Privilege escalation vulnerabilities
- MFA enforcement gaps
- Access review findings

**Evidence Guidance:**
- User provisioning audit logs
- MFA enrollment and policy configs
- Privileged account inventory
- Access review/recertification reports

---

### 3. Data Security Risk Assessment

**Category:** `DATA_SECURITY`
**Default Severity:** HIGH

**Pre-populated Control Domains:**
- DATA_PROTECTION
- ENCRYPTION
- LOGGING_MONITORING

**Use Cases:**
- Data classification gaps
- Encryption weaknesses
- DLP policy violations
- Backup/recovery concerns

**Evidence Guidance:**
- Data classification policies
- Encryption configuration documentation
- DLP policy settings and alerts
- Backup schedule and testing logs

---

### 4. Network Security Risk Assessment

**Category:** `NETWORK_SECURITY`
**Default Severity:** MEDIUM

**Pre-populated Control Domains:**
- NETWORK_SECURITY
- LOGGING_MONITORING
- CHANGE_MANAGEMENT

**Use Cases:**
- Firewall misconfiguration
- Network segmentation gaps
- IDS/IPS findings
- Perimeter security issues

**Evidence Guidance:**
- Firewall rule exports
- Network topology diagrams
- IDS/IPS configuration
- Segmentation documentation

---

### 5. Application Security Risk Assessment

**Category:** `APPLICATION_SECURITY`
**Default Severity:** MEDIUM

**Pre-populated Control Domains:**
- CHANGE_MANAGEMENT
- ACCESS_CONTROL
- LOGGING_MONITORING

**Use Cases:**
- SAST/DAST scan findings
- Dependency vulnerabilities
- Code review findings
- Penetration test results

**Evidence Guidance:**
- Static/dynamic analysis reports
- Software composition analysis results
- Security code review documentation
- Penetration test reports

---

## Using Templates

### From the UI

1. Navigate to **Risks** > **Create Risk**
2. The template selector appears at the top of the form
3. Select a template from the dropdown (shows name and category)
4. Form fields auto-populate with template content:
   - Description includes evidence guidance
   - Affected Systems shows collection guidance
   - Severity is set to template default
5. Modify pre-populated values as needed
6. Complete required fields (title) and submit

### "Start from Scratch" Option

Users can choose "Start from scratch" to create a risk without template pre-population. This option clears all fields and allows manual entry.

### Template Selection is Optional

Selecting a template is not required. Users can:
- Select a template to pre-populate fields
- Start from scratch for custom entries
- Switch templates at any time before submission

---

## API Usage

### List All Templates

```typescript
// Returns all templates for the user's organization
const templates = await trpc.risk.listRiskTemplates.query();
```

**Response:**
```typescript
{
  id: string;
  name: string;
  category: RiskTemplateCategory;
  description: string;
  prePopulatedDomains: string[];
  evidenceGuidance: string;
  severityDefault: Severity;
  affectedSystemsGuidance?: string;
}[]
```

### Get Template by ID

```typescript
// Returns a single template with all details
const template = await trpc.risk.getRiskTemplateById.query({
  id: "template-id-here"
});
```

### Create Risk with Template

```typescript
// Creates a risk linked to a template
const risk = await trpc.risk.create.mutate({
  title: "SQL Injection in Login Form",
  description: "...",
  severity: "HIGH",
  templateId: "template-id-here", // Optional
});
```

---

## Data Model

### RiskTemplate Schema

```prisma
model RiskTemplate {
  id                      String               @id @default(cuid())
  name                    String
  category                RiskTemplateCategory
  description             String               @db.Text
  prePopulatedDomains     String[]
  evidenceGuidance        String               @db.Text
  severityDefault         Severity
  affectedSystemsGuidance String?              @db.Text
  organizationId          String

  organization Organization @relation(...)
  risks        Risk[]       @relation("RiskFromTemplate")

  @@index([organizationId, category])
  @@index([organizationId])
}
```

### RiskTemplateCategory Enum

```prisma
enum RiskTemplateCategory {
  CLOUD_INFRASTRUCTURE
  ACCESS_CONTROL
  DATA_SECURITY
  NETWORK_SECURITY
  APPLICATION_SECURITY
}
```

### Risk -> Template Relationship

```prisma
model Risk {
  // ... other fields
  templateId String? // Optional reference to template

  Template RiskTemplate? @relation("RiskFromTemplate", ...)
}
```

---

## Multi-Tenancy

- Templates are organization-scoped
- Each organization has its own set of templates
- Users can only view/use templates from their organization
- Template IDs are validated against organization ownership on risk creation

---

## Audit Logging

When a risk is created from a template:
- The audit log includes `templateId` and `templateName`
- This enables tracking of template usage patterns
- Supports compliance reporting on risk creation methods

---

## Testing

Integration tests are located at:
```
src/__tests__/integration/risk-templates.test.ts
```

Run tests with:
```bash
npm test -- risk-templates
```

Test coverage includes:
- AC27-AC30: Template query procedures
- Task 5: Template usage in risk creation
- AC7-AC21: Template content validation
- Multi-tenancy isolation
- Audit logging verification
