import { Suspense } from "react";
import { SystemContingencyEditClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "System Contingency BIA | BetterThanSpreadsheetsGRC",
};

export default async function SystemContingencyEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <SystemContingencyEditClient id={id} />
    </Suspense>
  );
}
