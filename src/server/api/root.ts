import { postRouter } from "@/server/api/routers/post";
import { userRouter } from "@/server/api/routers/user";
import { passwordResetRouter } from "@/server/api/routers/passwordReset";
import { auditRouter } from "@/server/api/routers/audit";
import { frameworkRouter } from "@/server/api/routers/framework";
import { controlDomainRouter } from "@/server/api/routers/controlDomain";
import { mappingRouter } from "@/server/api/routers/mapping";
import { coverageRouter } from "@/server/api/routers/coverage";
import { complianceRouter } from "@/server/api/routers/compliance";
import { evidenceRouter } from "@/server/api/routers/evidence";
import { evidenceRequestRouter } from "@/server/api/routers/evidence-request";
import { riskRouter } from "@/server/api/routers/risk";
import { enterpriseRiskRouter } from "@/server/api/routers/enterpriseRisk";
import { emailQueueRouter } from "@/server/api/routers/emailQueue";
import { workerRouter } from "@/server/api/routers/worker";
import { businessUnitRouter } from "@/server/api/routers/businessUnit";
import { businessUnitFrameworkRouter } from "@/server/api/routers/businessUnitFramework";
import { findingRouter } from "@/server/api/routers/finding";
import { riskAssessmentRouter } from "@/server/api/routers/riskAssessment";
import { assessmentTypeRouter } from "@/server/api/routers/assessmentType";
import { assessmentTaskRouter } from "@/server/api/routers/assessmentTask";
import { riskMatrixRouter } from "@/server/api/routers/riskMatrix";
import { riskRegisterRouter } from "@/server/api/routers/riskRegister";
import { controlLinkRouter } from "@/server/api/routers/controlLink";
import { mitreRouter } from "@/server/api/routers/mitre";
import { organizationalControlRouter } from "@/server/api/routers/organizationalControl";
import { orgControlTestRecordRouter } from "@/server/api/routers/orgControlTestRecord";
import { orgControlDeficiencyRouter } from "@/server/api/routers/orgControlDeficiency";
import { orgControlEvidenceRequirementRouter } from "@/server/api/routers/orgControlEvidenceRequirement";
import { orgControlEvidenceRouter } from "@/server/api/routers/orgControlEvidence";
import { orgControlExceptionRouter } from "@/server/api/routers/orgControlException";
import { orgControlDependencyRouter } from "@/server/api/routers/orgControlDependency";
import { strategyRouter } from "@/server/api/routers/strategy";
import { goalRouter } from "@/server/api/routers/goal";
import { objectiveRouter } from "@/server/api/routers/objective";
import { strategyDashboardRouter } from "@/server/api/routers/strategyDashboard";
import { standardRouter } from "@/server/api/routers/standard";
import { maturityRouter } from "@/server/api/routers/maturity";
import { complianceAssessmentRouter } from "@/server/api/routers/complianceAssessment";
import { riskAssessmentProjectRouter } from "@/server/api/routers/riskAssessmentProject";
import { baseFrameworkMappingRouter } from "@/server/api/routers/baseFrameworkMapping";
import { crosswalkRouter } from "@/server/api/routers/crosswalk";
import { personRouter } from "@/server/api/routers/person";
import { myAssignmentsRouter } from "@/server/api/routers/myAssignments";
import { vendorRouter } from "@/server/api/routers/vendor";
import { vendorAssessmentRouter } from "@/server/api/routers/vendorAssessment";
import { questionnaireRouter } from "@/server/api/routers/questionnaire";
import { riskAssessmentTemplateRouter } from "@/server/api/routers/riskAssessmentTemplate";
import { riskAssessmentQuestionnaireRouter } from "@/server/api/routers/riskAssessmentQuestionnaire";
import { vendorPortalRouter } from "@/server/api/routers/vendorPortal";
import { biaConfigRouter } from "@/server/api/routers/biaConfig";
import { businessFunctionRouter } from "@/server/api/routers/businessFunction";
import { businessProcessRouter } from "@/server/api/routers/businessProcess";
import { biaAssessmentRouter } from "@/server/api/routers/biaAssessment";
import { biaDependencyRouter } from "@/server/api/routers/biaDependency";
import { biaDashboardRouter } from "@/server/api/routers/biaDashboard";
import { assetRouter } from "@/server/api/routers/asset";
import { assetOwnerRouter } from "@/server/api/routers/assetOwner";
import { systemSettingsRouter } from "@/server/api/routers/systemSettings";
import { biaSystemContingencyRouter } from "@/server/api/routers/biaSystemContingency";
import { deliverableRouter } from "@/server/api/routers/deliverable";
import { engagementRouter } from "@/server/api/routers/engagement";
import { pathwayRouter } from "@/server/api/routers/pathway";
import { actionPlanRouter } from "@/server/api/routers/actionPlan";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  user: userRouter,
  passwordReset: passwordResetRouter,
  audit: auditRouter,
  framework: frameworkRouter, // Story 2.1: OSCAL Catalog Import Pipeline
  controlDomain: controlDomainRouter, // Story 2.3: Simplified Control Taxonomy
  mapping: mappingRouter, // Story 2.4: OSCAL Translation Engine
  coverage: coverageRouter, // Story 2.6: Framework Coverage Calculation
  compliance: complianceRouter, // Story 5.1: Compliance Summary Dashboard
  evidence: evidenceRouter, // Story 3.1: Evidence File Upload
  evidenceRequest: evidenceRequestRouter, // Story 3.12: Evidence Request Workflow
  risk: riskRouter, // Story 3.6: Evidence-to-Risk Linkage
  enterpriseRisk: enterpriseRiskRouter,
  emailQueue: emailQueueRouter, // Story 4.15: Email Queue with Retry Logic
  worker: workerRouter, // Story 4.18: Background Job Processing
  businessUnit: businessUnitRouter, // Story 7.0.3: BU Admin CRUD UI
  businessUnitFramework: businessUnitFrameworkRouter, // BU-Scoped Compliance: Framework-BU assignments
  finding: findingRouter, // Story 7.2: Finding Creation Form
  riskAssessment: riskAssessmentRouter, // Story 7.6: Risk Assessment Form with Auto-Save
  assessmentType: assessmentTypeRouter, // Story 7.8.1: Assessment Type CRUD
  assessmentTask: assessmentTaskRouter, // Proactive Risk Assessment Task Management
  riskMatrix: riskMatrixRouter, // Story 7.8.2: Risk Matrix Template CRUD
  riskRegister: riskRegisterRouter, // Story 7.10: Risk Register Entry Creation
  controlLink: controlLinkRouter, // Story 12.1: Control Linkage Data Models & tRPC Router
  mitre: mitreRouter, // Story 13.1: MITRE ATT&CK Data Model & tRPC Router
  organizationalControl: organizationalControlRouter, // Organizational Controls for risks
  orgControlTestRecord: orgControlTestRecordRouter, // Sub-Epic C.1: Control test runs
  orgControlDeficiency: orgControlDeficiencyRouter, // Sub-Epic C.2: Deficiency tracking
  orgControlEvidenceRequirement: orgControlEvidenceRequirementRouter, // Sub-Epic D.1
  orgControlEvidence: orgControlEvidenceRouter, // Sub-Epic D.2: Evidence junction
  orgControlException: orgControlExceptionRouter, // Sub-Epic E.1: Exception lifecycle
  orgControlDependency: orgControlDependencyRouter, // Sub-Epic E.2: Dependencies
  strategy: strategyRouter, // Story 1.2: Strategy CRUD API
  goal: goalRouter, // Story 1.3: Goal CRUD API
  objective: objectiveRouter, // Story 2.2: Objective CRUD API
  strategyDashboard: strategyDashboardRouter, // Story 5.1: Strategy Dashboard API
  standard: standardRouter, // Standards Module: Standards, Controls, Mappings, Exceptions
  maturity: maturityRouter, // Maturity Assessment Module: NIST CSF 2.0, C2M2
  complianceAssessment: complianceAssessmentRouter, // Compliance Assessment Module
  riskAssessmentProject: riskAssessmentProjectRouter, // Risk Assessment Project Module: Container-based risk discovery
  baseFrameworkMapping: baseFrameworkMappingRouter, // Base Framework Mapping: Framework-to-framework control mappings
  crosswalk: crosswalkRouter, // Epic 25: Crosswalk any two frameworks (OLIR semantics)
  person: personRouter, // Person: Stakeholder accountability tracking
  myAssignments: myAssignmentsRouter, // Unified work assignments across domains
  vendor: vendorRouter, // Epic 1: TPRM Vendor Registry
  vendorAssessment: vendorAssessmentRouter, // Epic 3: Vendor Assessment Workflow
  questionnaire: questionnaireRouter, // Epic 4: Questionnaire System
  riskAssessmentTemplate: riskAssessmentTemplateRouter, // Risk-assessment questionnaire templates (library side)
  riskAssessmentQuestionnaire: riskAssessmentQuestionnaireRouter, // Risk-assessment questionnaire instances (cloned snapshot)
  vendorPortal: vendorPortalRouter, // Epic 6: Vendor Portal (public token-based access)
  biaConfig: biaConfigRouter, // Epic 9: BIA Configuration Admin
  businessFunction: businessFunctionRouter, // Epic 10: BIA Business Functions
  businessProcess: businessProcessRouter, // Epic 10: BIA Business Processes
  biaAssessment: biaAssessmentRouter, // Epic 11: BIA Impact Assessment
  biaDependency: biaDependencyRouter, // Epic 12: BIA Dependencies & Integration
  biaDashboard: biaDashboardRouter, // Epic 13: BIA Reporting & Compliance
  asset: assetRouter, // Epic 14: Asset Registry & BIA Integration
  assetOwner: assetOwnerRouter, // Epic 14: Asset Owners (separate from Users)
  systemSettings: systemSettingsRouter, // Deployment-level settings: hostname + TLS
  biaSystemContingency: biaSystemContingencyRouter, // NIST SP 800-34 System Contingency BIA (asset/process-anchored)
  deliverable: deliverableRouter, // Story 17.1: Consulting Deliverable Shell + PDF export
  engagement: engagementRouter, // Epic 18: Consulting Engagement wrapper (polymorphic over assessments)
  pathway: pathwayRouter, // Epic 19: Exploitation Pathway (per-assessment, findings + risks)
  actionPlan: actionPlanRouter, // Remediation Roadmap: per-assessment Action Plan initiatives
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
