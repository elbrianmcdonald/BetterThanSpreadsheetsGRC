/**
 * Framework Detail Page
 *
 * Displays framework metadata and control list with search and pagination.
 *
 * @see Story 2.2: OSCAL Catalog Storage and Retrieval
 */

import { FrameworkDetailClient } from "./client";

export const metadata = {
  title: "Framework Details | BetterThanSpreadsheetsGRC",
  description: "View framework controls and details",
};

export default async function FrameworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FrameworkDetailClient frameworkId={id} />;
}
