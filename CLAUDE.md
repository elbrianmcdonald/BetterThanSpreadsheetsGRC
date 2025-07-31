# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Build and run the application
dotnet build
dotnet run

# Database operations (Entity Framework Core with PostgreSQL)
dotnet ef migrations add <MigrationName>
dotnet ef database update
dotnet ef database drop  # Be careful - this removes all data

# Package management
dotnet restore
dotnet add package <PackageName>

# Check for lint/build warnings
dotnet build --verbosity normal
```

## Architecture Overview

This is a **Cyber Risk Management and GRC Platform** built with ASP.NET Core 8.0 MVC. The application manages enterprise cyber risk, compliance frameworks, and security maturity assessments.

### Core Domain Areas

1. **Risk Management**: Risk assessments, findings, SLA tracking, ALE calculations
2. **Compliance Management**: Multi-framework compliance (ISO27001, NIST, SOX, GDPR, HIPAA)
3. **Maturity Assessments**: NIST CSF 2.0 and C2M2 maturity evaluations
4. **Governance**: Request workflows, approvals, user management

### Key Architectural Patterns

- **Service Layer Pattern**: Business logic encapsulated in services with interfaces (`IFindingService`, `IRiskService`, `IGovernanceService`, etc.)
- **Repository Pattern**: Data access through Entity Framework Core with PostgreSQL
- **MVC Pattern**: Controllers handle HTTP requests, Views render UI, Models represent data
- **Authorization-First Design**: Three-tier role system (Admin, GRCUser, ITUser) with granular permissions

## Database and Data Access

- **Primary Database**: PostgreSQL via Entity Framework Core 8.0.18
- **Context Class**: `CyberRiskContext` in `Data/CyberRiskContext.cs`
- **UTC DateTime Handling**: All DateTime fields use UTC to work properly with PostgreSQL timestamps
- **Identity Integration**: Custom `User` entity extending ASP.NET Core Identity
- **Connection String**: Configured in `appsettings.json` under `ConnectionStrings:DefaultConnection`

### Critical Database Patterns
- Foreign key relationships explicitly configured to prevent conflicts
- Enum-based status tracking throughout (AssessmentStatus, ComplianceStatus, MaturityLevel, etc.)
- Soft deletes not implemented - use caution with data deletion operations
- Large form handling configured for bulk operations (Excel imports)

## Authentication and Authorization

### Role System
```csharp
// Three primary roles in hierarchical order:
Admin        // Full system access
GRCUser      // Governance, Risk & Compliance operations  
ITUser       // Limited operational access
```

### Authorization Policies
- `RequireAdminRole` - Admin only
- `RequireGRCOrAdminRole` - GRC operations (assessments, frameworks)
- `RequireAnyRole` - All authenticated users

### Key Security Patterns
- All assessment creation/editing requires GRC or Admin role
- Users can view most data but editing permissions are restricted
- Password complexity configurable but currently relaxed for development
- Default admin account setup with forced password change on first login

## Service Layer Architecture

The application uses a comprehensive service layer with dependency injection:

### Core Services
- **IRiskService**: Risk management operations, ALE calculations
- **IFindingService**: Security finding lifecycle management
- **IGovernanceService**: Compliance framework and assessment operations
- **IMaturityService**: Maturity assessment and NIST CSF/C2M2 operations
- **IRequestService**: Workflow management (assessment requests, risk acceptance, etc.)
- **IUserService**: User management beyond Identity framework
- **IExportService**: Excel export functionality

### Service Registration Pattern
Services are registered in `Program.cs` using `AddScoped<IInterface, Implementation>()` for per-request lifecycle.

## View and UI Patterns

### Frontend Technology
- **Bootstrap 5** for responsive design
- **Font Awesome** for iconography
- **jQuery** for DOM manipulation and AJAX calls
- **LibMan** for client-side package management (`libman.json`)

### Critical UI Components
- **Dashboard System**: Modular widgets for different user roles
- **Bulk Assessment Views**: Complex forms with JavaScript for dynamic control management
- **Data Tables**: Sorting, filtering, and pagination throughout
- **Modal Dialogs**: Quick actions and confirmations
- **Excel Integration**: Upload/download functionality with EPPlus library

### View Architecture
Views follow controller-based organization with shared partials in `Views/Shared/`. Complex views use ViewModels in the `ViewModels/` directory.

## Business Logic Patterns

### Risk Assessment Flow
1. Assessment requests created by users
2. Assigned to qualified assessors
3. Risk analysis performed (qualitative Impact×Likelihood×Exposure or quantitative FAIR)
4. Findings generated with SLA tracking
5. Results reviewed and approved

### Compliance Assessment Flow
1. Framework-based control assessment (ISO27001, NIST, etc.)
2. Control-level compliance status evaluation
3. Evidence collection and gap analysis
4. Project management integration for remediation
5. Executive reporting and dashboards

### Maturity Assessment Flow
1. Framework selection (NIST CSF 2.0 with levels 0-4, or C2M2 with levels 1-3)
2. Control assessment with current and target maturity levels
3. Gap analysis and recommended actions
4. Project sizing (T-shirt sizing: XS-XXL) and completion dates
5. Maturity scoring and progression tracking

## Excel Integration Patterns

The application heavily uses EPPlus 4.5.3.3 for Excel operations:
- **Import**: Framework and control imports via Excel templates
- **Export**: Assessment results, compliance reports, executive dashboards
- **Bulk Operations**: Large-scale data import/export with progress tracking

## Common Development Patterns

### Error Handling
Controllers use try-catch blocks with graceful degradation. Services typically return empty results rather than throwing exceptions to maintain UI stability.

### Data Validation
- Model validation via Data Annotations
- Client-side validation with jQuery Validate
- Server-side validation in controllers and services

### AJAX Patterns
Bulk operations use AJAX for real-time updates without page refreshes. Key endpoints:
- `UpdateSelectedControlAssessments` - Bulk control updates
- `UpdateControlAssessment` - Individual control updates

### Performance Considerations
- Async/await throughout for database operations
- Connection pooling via Entity Framework Core
- Large form handling configured for bulk imports
- Optimized queries with Include() for related data

## Working with Assessment Types

### Compliance Assessments (`ComplianceAssessment`, `ControlAssessment`)
- Status-based evaluation: NonCompliant → PartiallyCompliant → MajorlyCompliant → FullyCompliant
- Framework-agnostic design supporting ISO27001, NIST, SOX, GDPR, HIPAA
- Control-level evidence collection and gap analysis

### Maturity Assessments (`MaturityAssessment`, `MaturityControlAssessment`)  
- Level-based evaluation with current and target maturity levels
- Framework-specific: NIST CSF (0-4), C2M2 (1-3)
- Project management integration with effort estimation
- Function/Domain-based grouping instead of categories

### Bulk Assessment Features
Both assessment types support:
- Selective bulk operations (choose specific controls to assess)
- Common field application across multiple controls
- Individual customization after bulk application
- Real-time progress tracking and save functionality

When working with assessment functionality, note that the bulk view implementations are sophisticated with framework-aware filtering, JavaScript-based control selection, and AJAX-driven updates.