import { MaturityFrameworkDetailClient } from "./client";

interface Params {
  params: Promise<{ id: string }>;
}

export default async function MaturityFrameworkDetailPage({ params }: Params) {
  const { id } = await params;
  return <MaturityFrameworkDetailClient frameworkId={id} />;
}
