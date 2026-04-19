import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ControlDetailClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Control Detail | BetterThanSpreadsheetsGRC",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ControlDetailPage({ params }: Props) {
  const { id } = await params;
  if (!id) notFound();

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <ControlDetailClient controlId={id} />
    </Suspense>
  );
}
