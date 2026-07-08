/**
 * Crosswalk Coverage Dashboard (Epic 26, Story 26.3)
 *
 * Per-family coverage of a framework by the org's custom controls.
 */

import { CoverageClient } from "./client";

export const metadata = {
  title: "Crosswalk Coverage | BetterThanSpreadsheetsGRC",
  description: "Per-family org-control coverage of a framework",
};

export default async function CoveragePage({
  params,
}: {
  params: Promise<{ targetId: string }>;
}) {
  const { targetId } = await params;
  return <CoverageClient targetFrameworkId={targetId} />;
}
