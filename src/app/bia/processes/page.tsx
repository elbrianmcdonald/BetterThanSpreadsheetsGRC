/**
 * BIA Register — list of all BIA Assessments for the organization.
 *
 * Historically this URL hosted the Business Processes list. It was retooled
 * to the BIA register because processes can still be reached by clicking a
 * process-anchored BIA (which links into /bia/processes/[id] detail).
 */

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { BiaRegisterClient } from "./client";

export const metadata = {
  title: "BIA Register | BetterThanSpreadsheetsGRC",
  description: "Register of all BIA Assessments",
};

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function BiaRegisterPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BiaRegisterClient />
    </Suspense>
  );
}
