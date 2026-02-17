/**
 * Evidence Management Page
 *
 * Admin page for managing compliance evidence files.
 *
 * @see Story 3.1: Evidence File Upload and Processing
 */

import { EvidenceManagementClient } from "./client";

export const metadata = {
  title: "Evidence Management | BetterThanSpreadsheetsGRC",
  description: "Upload and manage compliance evidence files",
};

export default function EvidenceManagementPage() {
  return <EvidenceManagementClient />;
}
