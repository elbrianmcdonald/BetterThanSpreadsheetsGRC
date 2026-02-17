/**
 * Create Business Process Page
 *
 * Epic 10: BIA Core Module
 * Story 10.2: Business Process Data Model & Basic CRUD
 */

import { CreateProcessClient } from "./client";

export const metadata = {
  title: "New Business Process | BetterThanSpreadsheetsGRC",
  description: "Create a new business process",
};

export default function CreateProcessPage() {
  return <CreateProcessClient />;
}
