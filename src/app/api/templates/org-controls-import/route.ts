import { generateOrgControlTemplate } from "@/lib/excel-org-control-import";

export const dynamic = "force-dynamic";

export async function GET() {
  const buf = generateOrgControlTemplate();
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="org-controls-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
