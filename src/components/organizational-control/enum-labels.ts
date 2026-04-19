import {
  ControlType,
  ControlNature,
  AutomationLevel,
  OrgControlStatus,
  ControlFrequency,
  AssignmentRole,
  StandardMappingType,
  TestResult,
  DeficiencySeverity,
  RemediationStatus,
  ControlExceptionStatus,
} from "@prisma/client";

export const CONTROL_TYPE_OPTIONS: { value: ControlType; label: string; hint: string }[] = [
  { value: ControlType.PREVENTIVE, label: "Preventive", hint: "Stops a threat before it occurs (MFA, firewalls)" },
  { value: ControlType.DETECTIVE, label: "Detective", hint: "Identifies when something has occurred (SIEM, logs)" },
  { value: ControlType.CORRECTIVE, label: "Corrective", hint: "Fixes damage after an event (backups, DR)" },
  { value: ControlType.COMPENSATING, label: "Compensating", hint: "Alternative when primary control isn't feasible" },
];

export const CONTROL_NATURE_OPTIONS: { value: ControlNature; label: string; hint: string }[] = [
  { value: ControlNature.TECHNICAL, label: "Technical", hint: "Implemented via technology" },
  { value: ControlNature.ADMINISTRATIVE, label: "Administrative", hint: "Implemented via policy/process" },
  { value: ControlNature.PHYSICAL, label: "Physical", hint: "Implemented via physical barriers" },
];

export const AUTOMATION_LEVEL_OPTIONS: { value: AutomationLevel; label: string }[] = [
  { value: AutomationLevel.MANUAL, label: "Manual" },
  { value: AutomationLevel.SEMI_AUTOMATED, label: "Semi-automated" },
  { value: AutomationLevel.AUTOMATED, label: "Automated" },
];

export const ORG_CONTROL_STATUS_OPTIONS: { value: OrgControlStatus; label: string }[] = [
  { value: OrgControlStatus.NOT_IMPLEMENTED, label: "Not implemented" },
  { value: OrgControlStatus.PLANNED, label: "Planned" },
  { value: OrgControlStatus.PARTIALLY_IMPLEMENTED, label: "Partially implemented" },
  { value: OrgControlStatus.IMPLEMENTED, label: "Implemented" },
  { value: OrgControlStatus.DEPRECATED, label: "Deprecated" },
];

export const CONTROL_FREQUENCY_OPTIONS: { value: ControlFrequency; label: string }[] = [
  { value: ControlFrequency.CONTINUOUS, label: "Continuous" },
  { value: ControlFrequency.DAILY, label: "Daily" },
  { value: ControlFrequency.WEEKLY, label: "Weekly" },
  { value: ControlFrequency.MONTHLY, label: "Monthly" },
  { value: ControlFrequency.QUARTERLY, label: "Quarterly" },
  { value: ControlFrequency.ANNUALLY, label: "Annually" },
  { value: ControlFrequency.EVENT_TRIGGERED, label: "Event-triggered" },
];

export const ASSIGNMENT_ROLE_OPTIONS: { value: AssignmentRole; label: string; hint: string }[] = [
  { value: AssignmentRole.OWNER, label: "Owner", hint: "Accountable (A in RACI)" },
  { value: AssignmentRole.OPERATOR, label: "Operator", hint: "Responsible — who performs the control" },
  { value: AssignmentRole.REVIEWER, label: "Reviewer", hint: "Approves or audits the control" },
];

export const MAPPING_TYPE_OPTIONS: { value: StandardMappingType; label: string }[] = [
  { value: StandardMappingType.COVERS, label: "Covers" },
  { value: StandardMappingType.PARTIAL, label: "Partial" },
  { value: StandardMappingType.EXCEEDS, label: "Exceeds" },
];

export function labelForControlType(v: ControlType): string {
  return CONTROL_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
export function labelForControlNature(v: ControlNature | null | undefined): string {
  if (!v) return "—";
  return CONTROL_NATURE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
export function labelForAutomationLevel(v: AutomationLevel | null | undefined): string {
  if (!v) return "—";
  return AUTOMATION_LEVEL_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
export function labelForOrgControlStatus(v: OrgControlStatus): string {
  return ORG_CONTROL_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
export function labelForControlFrequency(v: ControlFrequency | null | undefined): string {
  if (!v) return "—";
  return CONTROL_FREQUENCY_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
export function labelForAssignmentRole(v: AssignmentRole): string {
  return ASSIGNMENT_ROLE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
export function labelForMappingType(v: StandardMappingType): string {
  return MAPPING_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function statusBadgeColor(status: OrgControlStatus): string {
  switch (status) {
    case OrgControlStatus.IMPLEMENTED:
      return "bg-green-100 text-green-800 border-green-200";
    case OrgControlStatus.PARTIALLY_IMPLEMENTED:
      return "bg-amber-100 text-amber-800 border-amber-200";
    case OrgControlStatus.PLANNED:
      return "bg-blue-100 text-blue-800 border-blue-200";
    case OrgControlStatus.NOT_IMPLEMENTED:
      return "bg-slate-100 text-slate-800 border-slate-200";
    case OrgControlStatus.DEPRECATED:
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export const TEST_RESULT_OPTIONS: { value: TestResult; label: string }[] = [
  { value: TestResult.PASS, label: "Pass" },
  { value: TestResult.FAIL, label: "Fail" },
  { value: TestResult.PARTIAL, label: "Partial" },
  { value: TestResult.NOT_APPLICABLE, label: "Not applicable" },
];

export const DEFICIENCY_SEVERITY_OPTIONS: { value: DeficiencySeverity; label: string }[] = [
  { value: DeficiencySeverity.CRITICAL, label: "Critical" },
  { value: DeficiencySeverity.HIGH, label: "High" },
  { value: DeficiencySeverity.MEDIUM, label: "Medium" },
  { value: DeficiencySeverity.LOW, label: "Low" },
];

export const REMEDIATION_STATUS_OPTIONS: { value: RemediationStatus; label: string }[] = [
  { value: RemediationStatus.OPEN, label: "Open" },
  { value: RemediationStatus.IN_PROGRESS, label: "In progress" },
  { value: RemediationStatus.COMPLETED, label: "Completed" },
  { value: RemediationStatus.ACCEPTED_RISK, label: "Accepted risk" },
  { value: RemediationStatus.DEFERRED, label: "Deferred" },
];

export function labelForTestResult(v: TestResult): string {
  return TEST_RESULT_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
export function labelForDeficiencySeverity(v: DeficiencySeverity): string {
  return DEFICIENCY_SEVERITY_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
export function labelForRemediationStatus(v: RemediationStatus): string {
  return REMEDIATION_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function testResultBadgeColor(result: TestResult): string {
  switch (result) {
    case TestResult.PASS:
      return "bg-green-100 text-green-800 border-green-200";
    case TestResult.FAIL:
      return "bg-red-100 text-red-800 border-red-200";
    case TestResult.PARTIAL:
      return "bg-amber-100 text-amber-800 border-amber-200";
    case TestResult.NOT_APPLICABLE:
      return "bg-gray-100 text-gray-700 border-gray-200";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function severityBadgeColor(severity: DeficiencySeverity): string {
  switch (severity) {
    case DeficiencySeverity.CRITICAL:
      return "bg-red-200 text-red-900 border-red-300";
    case DeficiencySeverity.HIGH:
      return "bg-red-100 text-red-800 border-red-200";
    case DeficiencySeverity.MEDIUM:
      return "bg-amber-100 text-amber-800 border-amber-200";
    case DeficiencySeverity.LOW:
      return "bg-blue-100 text-blue-800 border-blue-200";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function remediationStatusBadgeColor(status: RemediationStatus): string {
  switch (status) {
    case RemediationStatus.OPEN:
      return "bg-red-100 text-red-800 border-red-200";
    case RemediationStatus.IN_PROGRESS:
      return "bg-blue-100 text-blue-800 border-blue-200";
    case RemediationStatus.COMPLETED:
      return "bg-green-100 text-green-800 border-green-200";
    case RemediationStatus.ACCEPTED_RISK:
      return "bg-amber-100 text-amber-800 border-amber-200";
    case RemediationStatus.DEFERRED:
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export const EXCEPTION_STATUS_OPTIONS: { value: ControlExceptionStatus; label: string }[] = [
  { value: ControlExceptionStatus.PENDING, label: "Pending" },
  { value: ControlExceptionStatus.APPROVED, label: "Approved" },
  { value: ControlExceptionStatus.DENIED, label: "Denied" },
  { value: ControlExceptionStatus.EXPIRED, label: "Expired" },
];

export function labelForExceptionStatus(v: ControlExceptionStatus): string {
  return EXCEPTION_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function exceptionStatusBadgeColor(status: ControlExceptionStatus): string {
  switch (status) {
    case ControlExceptionStatus.PENDING:
      return "bg-amber-100 text-amber-800 border-amber-200";
    case ControlExceptionStatus.APPROVED:
      return "bg-green-100 text-green-800 border-green-200";
    case ControlExceptionStatus.DENIED:
      return "bg-gray-100 text-gray-700 border-gray-200";
    case ControlExceptionStatus.EXPIRED:
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function controlTypeBadgeColor(type: ControlType): string {
  switch (type) {
    case ControlType.PREVENTIVE:
      return "bg-blue-100 text-blue-800 border-blue-200";
    case ControlType.DETECTIVE:
      return "bg-purple-100 text-purple-800 border-purple-200";
    case ControlType.CORRECTIVE:
      return "bg-orange-100 text-orange-800 border-orange-200";
    case ControlType.COMPENSATING:
      return "bg-teal-100 text-teal-800 border-teal-200";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
