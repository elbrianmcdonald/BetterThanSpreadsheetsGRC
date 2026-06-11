/**
 * Deliverable page (type-routed). `[type]` selects the body + data source:
 *   risk | compliance | maturity | stub. `[id]` is the source assessment id
 * (or any token for the org-aggregated risk/stub views).
 */

import { notFound } from "next/navigation";
import { DeliverableClient, type DeliverableType } from "./client";

interface PageProps {
  params: Promise<{ type: string; id: string }>;
}

const VALID: DeliverableType[] = ["risk", "compliance", "maturity", "roadmap", "stub"];

export default async function DeliverablePage({ params }: PageProps) {
  const { type, id } = await params;
  if (!VALID.includes(type as DeliverableType)) notFound();
  return <DeliverableClient type={type as DeliverableType} id={id} />;
}
