import { ChangelogClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Changelog | BetterThanSpreadsheetsGRC",
  description: "Application version history",
};

export default function ChangelogPage() {
  return <ChangelogClient />;
}
