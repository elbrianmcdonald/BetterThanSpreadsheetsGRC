import { RiskDashboardClient } from "./client";

export const metadata = {
  title: "Risk Dashboard | BetterThanSpreadsheetsGRC",
  description: "Risk metrics, trends, and analytics dashboard",
};

export default function RiskDashboardPage() {
  return <RiskDashboardClient />;
}
