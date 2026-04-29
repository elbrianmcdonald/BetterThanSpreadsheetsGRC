import { EnterpriseRiskDetailClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Enterprise Risk Detail | BetterThanSpreadsheetsGRC",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EnterpriseRiskDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <EnterpriseRiskDetailClient id={id} />;
}
