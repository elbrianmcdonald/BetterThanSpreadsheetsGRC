import { TemplateEditorClient } from "./client";

export const metadata = {
  title: "Edit Risk Assessment Template | BetterThanSpreadsheetsGRC",
};

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TemplateEditorClient templateId={id} />;
}
