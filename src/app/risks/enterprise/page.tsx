import { EnterpriseRisksClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Enterprise Risks | BetterThanSpreadsheetsGRC",
  description: "Top-level enterprise risks rolled up from individual risks",
};

export default function EnterpriseRisksPage() {
  return <EnterpriseRisksClient />;
}
