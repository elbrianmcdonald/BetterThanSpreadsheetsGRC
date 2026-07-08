/**
 * Crosswalk Workbench Shell (Epic 25, Story 25.2)
 *
 * Read-only shell for a framework pair: header + current mappings. The dual-pane
 * mapping workbench (search/filter/relationship picker/edit) is Story 25.3, which
 * replaces the placeholder body here.
 */

import { CrosswalkWorkbenchClient } from "./client";

export const metadata = {
  title: "Crosswalk Workbench | BetterThanSpreadsheetsGRC",
  description: "Map controls between two frameworks",
};

export default async function CrosswalkWorkbenchPage({
  params,
}: {
  params: Promise<{ sourceId: string; targetId: string }>;
}) {
  const { sourceId, targetId } = await params;
  return <CrosswalkWorkbenchClient sourceFrameworkId={sourceId} targetFrameworkId={targetId} />;
}
