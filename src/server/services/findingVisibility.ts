/**
 * Register-visibility gate for findings (2026-07-06).
 *
 * Findings discovered inside a risk-assessment project are created with
 * discoveryStatus PENDING and must NOT surface anywhere register-level until
 * the assessment is approved by a manager/admin (approval flips them to
 * PUBLISHED). Direct register findings carry discoveryStatus null.
 *
 * Spread this into the WHERE of every register-level read (list, stats,
 * pickers, search, exports, SLA views, ER rollups, deliverables). Assessment-
 * scoped reads (listForAssessment / listForProject / same-project checks)
 * intentionally do NOT apply it — pending findings are visible inside their
 * own assessment workspace.
 */

import { Prisma, RiskDiscoveryStatus } from "@prisma/client";

export const PUBLISHED_FINDINGS_WHERE: Prisma.FindingWhereInput = {
  OR: [
    { discoveryStatus: RiskDiscoveryStatus.PUBLISHED },
    { discoveryStatus: null },
  ],
};

/** AND-wrapped variant for WHEREs that already use OR (e.g. search clauses). */
export const PUBLISHED_FINDINGS_AND: Prisma.FindingWhereInput = {
  AND: [PUBLISHED_FINDINGS_WHERE],
};
