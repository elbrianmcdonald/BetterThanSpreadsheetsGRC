/**
 * Epic 19 / Story 19.2: Exploitation Pathway route.
 *
 * `[id]` is the Pathway id. The client does the `api.pathway.getById`
 * query and renders the two-pane ExploitationPathwayView inside a
 * FindingDrawerProvider (so contributing-finding rows open the shared drawer).
 */

import { PathwayClient } from "./client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PathwayPage({ params }: PageProps) {
  const { id } = await params;
  return <PathwayClient pathwayId={id} />;
}
