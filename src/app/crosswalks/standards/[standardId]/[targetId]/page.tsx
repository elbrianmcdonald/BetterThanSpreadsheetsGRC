/**
 * Standard Crosswalk Workbench
 *
 * Dual-pane workbench with a selected standard's controls on the left and a
 * chosen framework on the right, writing to StandardControlMapping.
 */

import { StandardCrosswalkClient } from "./client";

export const metadata = {
  title: "Standard Crosswalk | BetterThanSpreadsheetsGRC",
  description: "Map a standard's controls to a framework",
};

export default async function StandardCrosswalkPage({
  params,
}: {
  params: Promise<{ standardId: string; targetId: string }>;
}) {
  const { standardId, targetId } = await params;
  return (
    <StandardCrosswalkClient standardId={standardId} targetFrameworkId={targetId} />
  );
}
