/**
 * Org-Control Crosswalk Workbench (Epic 25, Story 25.4)
 *
 * Dual-pane workbench with the organization's custom controls on the left and a
 * chosen framework on the right, writing to OrgControlFrameworkMapping.
 */

import { OrgControlCrosswalkClient } from "./client";

export const metadata = {
  title: "Org Control Crosswalk | BetterThanSpreadsheetsGRC",
  description: "Map organizational controls to a framework",
};

export default async function OrgControlCrosswalkPage({
  params,
}: {
  params: Promise<{ targetId: string }>;
}) {
  const { targetId } = await params;
  return <OrgControlCrosswalkClient targetFrameworkId={targetId} />;
}
