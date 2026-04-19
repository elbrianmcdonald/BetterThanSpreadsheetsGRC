import { Suspense } from "react";
import { ControlsListClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Controls | BetterThanSpreadsheetsGRC",
  description: "Manage organizational controls — classification, ownership, testing, and evidence",
};

export default function ControlsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <ControlsListClient />
    </Suspense>
  );
}
