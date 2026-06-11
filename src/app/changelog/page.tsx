import { promises as fs } from "node:fs";
import path from "node:path";
import { ScrollText } from "lucide-react";

import { AppLayout, PageHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { MarkdownPreview } from "@/components/ui/markdown-preview";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Changelog | BetterThanSpreadsheetsGRC",
  description: "Application version history",
};

async function readChangelog(): Promise<string> {
  const filePath = path.join(process.cwd(), "CHANGELOG.md");
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "_Changelog file not found at deploy time._";
  }
}

export default async function ChangelogPage() {
  const content = await readChangelog();
  return (
    <AppLayout>
      <div className="container mx-auto py-6 max-w-4xl space-y-4">
        <PageHeader
          eyebrow="RELEASE NOTES"
          title="Changelog"
          icon={<ScrollText />}
          description="Application version history. Entries are added by the development team as part of each release."
        />
        <Card>
          <CardContent className="py-6">
            <MarkdownPreview content={content} />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
