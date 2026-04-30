import { promises as fs } from "node:fs";
import path from "node:path";
import { ScrollText } from "lucide-react";

import { AppLayout } from "@/components/layout";
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
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="h-6 w-6" />
            Changelog
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Application version history. Entries are added by the development team as part of each release.
          </p>
        </div>
        <Card>
          <CardContent className="py-6">
            <MarkdownPreview content={content} />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
