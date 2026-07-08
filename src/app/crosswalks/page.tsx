/**
 * Crosswalks Landing Page (Epic 25, Story 25.2)
 *
 * Lists existing framework-pair crosswalks and lets the user start a new one
 * between any two loaded frameworks. Role enforcement lives in the crosswalk
 * tRPC procedures (view vs manage roles), consistent with /admin/mappings.
 */

import { CrosswalksClient } from "./client";

export const metadata = {
  title: "Crosswalks | BetterThanSpreadsheetsGRC",
  description: "Map controls between any two frameworks",
};

export default function CrosswalksPage() {
  return <CrosswalksClient />;
}
