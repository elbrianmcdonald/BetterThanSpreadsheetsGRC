import { Suspense } from "react";
import { SystemContingencyListClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "System Contingency BIA | BetterThanSpreadsheetsGRC",
  description: "NIST SP 800-34 System Contingency Business Impact Analyses",
};

export default function SystemContingencyListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <SystemContingencyListClient />
    </Suspense>
  );
}
