import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Legacy URL — the BIA register now lives at /bia/processes.
export default function SystemContingencyLegacyIndex() {
  redirect("/bia/processes");
}
