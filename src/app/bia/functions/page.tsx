/**
 * Business Functions Page
 *
 * Epic 10: BIA Core Module
 * Story 10.1: Business Function Data Model & CRUD
 */

import { BusinessFunctionsClient } from "./client";

export const metadata = {
  title: "Business Functions | BetterThanSpreadsheetsGRC",
  description: "Manage business functions for BIA",
};

export default function BusinessFunctionsPage() {
  return <BusinessFunctionsClient />;
}
