/**
 * Audit Change Details Formatter
 *
 * Story 4.12: Risk Audit Trail with Timestamps (AC33-AC37)
 *
 * Formats change details from audit logs into human-readable strings.
 *
 * @see Story 4.12: Risk Audit Trail with Timestamps
 */

/**
 * Format change details based on action type
 *
 * AC33: Field updates show: "Changed [field] from [old] to [new]"
 * AC34: Array changes show: "Added [item]" or "Removed [item]"
 * AC35: Evidence linkage shows: "Linked evidence: [filename] (Finding Proof)"
 * AC36: Assignment shows: "Assigned IT Owner: [name], Business Owner: [name]"
 * AC37: Status change shows: "Status: [old] → [new] (Reason: [reason])"
 */
export function formatChangeDetails(
  action: string,
  changes: Record<string, unknown> | null | undefined
): string {
  if (!changes) {
    return getDefaultActionDescription(action);
  }

  const details = changes as Record<string, unknown>;

  switch (action) {
    case "CREATE_RISK":
      return formatRiskCreation(details);

    case "ASSIGN_RISK":
      return formatRiskAssignment(details);

    case "REASSIGN_RISK":
      return formatRiskReassignment(details);

    case "UPDATE_RISK_STATUS":
      return formatStatusChange(details);

    case "LINK_EVIDENCE_TO_RISK":
      return formatEvidenceLink(details, "linked");

    case "UNLINK_EVIDENCE_FROM_RISK":
      return formatEvidenceLink(details, "unlinked");

    case "ADD_REMEDIATION_OPTION":
      return formatRemediationOption(details, "added");

    case "UPDATE_REMEDIATION_OPTION":
      return formatRemediationOption(details, "updated");

    case "DELETE_REMEDIATION_OPTION":
      return formatRemediationOption(details, "deleted");

    case "ADD_RISK_COMMENT":
      return formatComment(details, "added");

    case "UPDATE_RISK_COMMENT":
      return formatComment(details, "updated");

    case "DELETE_RISK_COMMENT":
      return formatComment(details, "deleted");

    case "UPDATE_RISK":
      return formatRiskUpdate(details);

    case "CLOSE_RISK":
      return formatRiskClosure(details);

    case "REOPEN_RISK":
      return formatRiskReopen(details);

    default:
      return formatGenericChanges(details);
  }
}

/**
 * Get default description for an action without specific formatting
 */
function getDefaultActionDescription(action: string): string {
  const actionDescriptions: Record<string, string> = {
    CREATE_RISK: "Risk created",
    ASSIGN_RISK: "Risk assigned",
    REASSIGN_RISK: "Risk reassigned",
    UPDATE_RISK_STATUS: "Status updated",
    LINK_EVIDENCE_TO_RISK: "Evidence linked",
    UNLINK_EVIDENCE_FROM_RISK: "Evidence unlinked",
    ADD_REMEDIATION_OPTION: "Remediation option added",
    UPDATE_REMEDIATION_OPTION: "Remediation option updated",
    DELETE_REMEDIATION_OPTION: "Remediation option deleted",
    ADD_RISK_COMMENT: "Comment added",
    UPDATE_RISK_COMMENT: "Comment updated",
    DELETE_RISK_COMMENT: "Comment deleted",
    UPDATE_RISK: "Risk updated",
    CLOSE_RISK: "Risk closed",
    REOPEN_RISK: "Risk reopened",
  };

  return (
    actionDescriptions[action] ??
    action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
  );
}

/**
 * Format risk creation details (AC16)
 */
function formatRiskCreation(details: Record<string, unknown>): string {
  const after = (details.after ?? details) as Record<string, unknown>;
  const severity = after.severity ?? "Unknown";
  const template = after.templateName ?? after.template;

  let description = `Risk created with severity ${severity}`;
  if (template) {
    description += `, using template "${template}"`;
  }

  return description;
}

/**
 * Format risk assignment details (AC17, AC36)
 */
function formatRiskAssignment(details: Record<string, unknown>): string {
  const after = (details.after ?? details) as Record<string, unknown>;
  const owners: string[] = [];

  if (after.itOwnerId) {
    const itOwnerName =
      typeof after.itOwner === "object" && after.itOwner
        ? (after.itOwner as { name?: string }).name
        : null;
    owners.push(`IT Owner: ${itOwnerName ?? after.itOwnerId}`);
  }

  if (after.businessOwnerId) {
    const bizOwnerName =
      typeof after.businessOwner === "object" && after.businessOwner
        ? (after.businessOwner as { name?: string }).name
        : null;
    owners.push(`Business Owner: ${bizOwnerName ?? after.businessOwnerId}`);
  }

  return owners.length > 0 ? `Assigned ${owners.join(", ")}` : "Risk assigned";
}

/**
 * Format risk reassignment details
 */
function formatRiskReassignment(details: Record<string, unknown>): string {
  const before = (details.before ?? {}) as Record<string, unknown>;
  const after = (details.after ?? {}) as Record<string, unknown>;
  const changes: string[] = [];

  // IT Owner change
  if (before.itOwner !== after.itOwner) {
    const oldName = getOwnerName(before.itOwner);
    const newName = getOwnerName(after.itOwner);
    changes.push(`IT Owner: ${oldName} → ${newName}`);
  }

  // Business Owner change
  if (before.businessOwner !== after.businessOwner) {
    const oldName = getOwnerName(before.businessOwner);
    const newName = getOwnerName(after.businessOwner);
    changes.push(`Business Owner: ${oldName} → ${newName}`);
  }

  return changes.length > 0 ? `Reassigned: ${changes.join(", ")}` : "Risk reassigned";
}

/**
 * Extract owner name from owner object or return fallback
 */
function getOwnerName(owner: unknown): string {
  if (!owner) return "None";
  if (typeof owner === "string") return owner;
  if (typeof owner === "object" && owner !== null) {
    const ownerObj = owner as { name?: string; email?: string };
    return ownerObj.name ?? ownerObj.email ?? "Unknown";
  }
  return "Unknown";
}

/**
 * Format status change details (AC18, AC37)
 */
function formatStatusChange(details: Record<string, unknown>): string {
  const before = (details.before ?? {}) as Record<string, unknown>;
  const after = (details.after ?? details) as Record<string, unknown>;

  const oldStatus = before.status ?? "Unknown";
  const newStatus = after.status ?? "Unknown";
  const reason = after.reason as string | undefined;

  let description = `Status: ${oldStatus} → ${newStatus}`;
  if (reason) {
    description += ` (Reason: ${reason})`;
  }

  return description;
}

/**
 * Format evidence linkage details (AC19, AC35)
 */
function formatEvidenceLink(
  details: Record<string, unknown>,
  action: "linked" | "unlinked"
): string {
  // Handle both before/after format and direct format
  const data =
    action === "linked"
      ? ((details.after ?? details) as Record<string, unknown>)
      : ((details.before ?? details) as Record<string, unknown>);

  const filename = data.evidenceTitle ?? data.evidenceFilename ?? "Unknown";
  const linkType = data.linkType ?? data.evidenceType ?? "";

  const linkTypeLabel = linkType === "FINDING" ? "Finding Proof" : "Remediation Evidence";

  return `${action === "linked" ? "Linked" : "Unlinked"} evidence: ${filename}${linkType ? ` (${linkTypeLabel})` : ""}`;
}

/**
 * Format remediation option details (AC20)
 */
function formatRemediationOption(
  details: Record<string, unknown>,
  action: "added" | "updated" | "deleted"
): string {
  // Handle both before/after format and direct format
  const data =
    action === "deleted"
      ? ((details.before ?? details) as Record<string, unknown>)
      : ((details.after ?? details) as Record<string, unknown>);

  const title = data.title ?? "Unknown";
  const cost = data.costEstimate ?? data.cost;
  const timeline = data.timeline;

  let description = `${action.charAt(0).toUpperCase() + action.slice(1)} remediation option: ${title}`;

  if (cost !== undefined) {
    description += ` ($${Number(cost).toLocaleString()})`;
  }
  if (timeline) {
    description += `, ${timeline}`;
  }

  return description;
}

/**
 * Format comment details (AC21)
 */
function formatComment(
  details: Record<string, unknown>,
  action: "added" | "updated" | "deleted"
): string {
  // Handle both before/after format and direct format
  const data =
    action === "deleted"
      ? ((details.before ?? details) as Record<string, unknown>)
      : ((details.after ?? details) as Record<string, unknown>);

  const commentType = data.commentType ?? "general";
  const commentLength = data.commentLength as number | undefined;

  // Get comment preview if available
  const comment = data.comment as string | undefined;
  const preview = comment
    ? comment.length > 100
      ? comment.substring(0, 100) + "..."
      : comment
    : null;

  let description = `${action.charAt(0).toUpperCase() + action.slice(1)} ${commentType.toString().toLowerCase()} comment`;

  if (preview) {
    description += `: "${preview}"`;
  } else if (commentLength) {
    description += ` (${commentLength} chars)`;
  }

  return description;
}

/**
 * Format risk update details (AC33)
 */
function formatRiskUpdate(details: Record<string, unknown>): string {
  const before = (details.before ?? {}) as Record<string, unknown>;
  const after = (details.after ?? {}) as Record<string, unknown>;
  const changes: string[] = [];

  // Compare all fields
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const oldVal = before[key];
    const newVal = after[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      const fieldName = formatFieldName(key);
      changes.push(`${fieldName}: ${formatValue(oldVal)} → ${formatValue(newVal)}`);
    }
  }

  return changes.length > 0
    ? `Updated: ${changes.slice(0, 3).join(", ")}${changes.length > 3 ? ` (+${changes.length - 3} more)` : ""}`
    : "Risk updated";
}

/**
 * Format risk closure details (AC22)
 */
function formatRiskClosure(details: Record<string, unknown>): string {
  const after = (details.after ?? details) as Record<string, unknown>;
  const verifiedBy = after.verifiedBy as string | undefined;
  const status = after.status ?? "CLOSED";

  let description = `Risk closed with status ${status}`;
  if (verifiedBy) {
    description += `, verified by ${verifiedBy}`;
  }

  return description;
}

/**
 * Format risk reopen details
 */
function formatRiskReopen(details: Record<string, unknown>): string {
  const after = (details.after ?? details) as Record<string, unknown>;
  const reason = after.reason as string | undefined;

  let description = "Risk reopened";
  if (reason) {
    description += `: ${reason}`;
  }

  return description;
}

/**
 * Format generic changes as key-value pairs (AC33)
 */
function formatGenericChanges(details: Record<string, unknown>): string {
  const before = (details.before ?? {}) as Record<string, unknown>;
  const after = (details.after ?? details) as Record<string, unknown>;
  const changes: string[] = [];

  // If it's just after values without before, list them
  if (!details.before && Object.keys(after).length > 0) {
    const entries = Object.entries(after).slice(0, 3);
    for (const [key, value] of entries) {
      changes.push(`${formatFieldName(key)}: ${formatValue(value)}`);
    }
    if (Object.keys(after).length > 3) {
      changes.push(`+${Object.keys(after).length - 3} more`);
    }
    return changes.join(", ");
  }

  // Compare before and after
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes.push(`${formatFieldName(key)}: ${formatValue(before[key])} → ${formatValue(after[key])}`);
    }
  }

  return changes.length > 0 ? changes.slice(0, 3).join(", ") : "Details updated";
}

/**
 * Format a field name to be human-readable
 */
function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/Id$/, "")
    .trim();
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") {
    // Truncate long strings
    return value.length > 50 ? value.substring(0, 47) + "..." : value;
  }
  if (value instanceof Date) return value.toLocaleDateString();
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object") return "[Object]";
  return String(value);
}
