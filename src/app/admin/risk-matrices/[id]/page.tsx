/**
 * Matrix Builder Page
 *
 * Story 7.8.5: Matrix Builder UI - Scales
 *
 * Allows Platform Admins to configure likelihood, impact, and exposure scales
 * for risk matrix templates.
 *
 * AC1: Matrix Builder accessible from matrix card/row click
 */

import { MatrixBuilderClient } from "./client";

export const metadata = {
  title: "Matrix Builder | BetterThanSpreadsheetsGRC",
  description: "Configure risk matrix scales and thresholds",
};

export default async function MatrixBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatrixBuilderClient templateId={id} />;
}
