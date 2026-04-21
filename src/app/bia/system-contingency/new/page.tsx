import { Suspense } from "react";
import { NewSystemContingencyClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New BIA Assessment | BetterThanSpreadsheetsGRC",
};

export default function NewSystemContingencyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <NewSystemContingencyClient />
    </Suspense>
  );
}
