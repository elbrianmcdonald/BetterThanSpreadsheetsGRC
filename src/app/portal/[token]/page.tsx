/**
 * Vendor Portal Main Page
 *
 * Epic 6: Vendor Portal
 * FR37: Vendor Contact can access portal via secure token link (no password)
 * FR38: View assigned questionnaires in portal
 */

import { VendorPortalClient } from "./client";

interface PortalPageProps {
  params: Promise<{ token: string }>;
}

export default async function PortalPage({ params }: PortalPageProps) {
  const { token } = await params;

  return <VendorPortalClient token={token} />;
}
