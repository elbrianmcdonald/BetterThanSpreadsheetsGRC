/**
 * Terminal finding statuses — the single client-safe source of truth
 * (Story 23.5, review MN-6). The server state machine re-exports this list;
 * client components must import it instead of re-declaring literals so a
 * future lifecycle change can't silently desync UI gating from server
 * enforcement.
 */

import { FindingStatus } from "@prisma/client";

export const TERMINAL_FINDING_STATUSES: FindingStatus[] = [
  FindingStatus.DUPLICATE,
  FindingStatus.REJECTED,
  FindingStatus.CLOSED,
];
