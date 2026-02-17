/**
 * Framework Configuration Page
 *
 * Allows admin to activate/deactivate frameworks and set target completion dates.
 *
 * @see Story 2.5: Framework Activation and Configuration
 */

import { FrameworkConfigureClient } from "./client";

export const metadata = {
  title: "Configure Frameworks | BetterThanSpreadsheetsGRC",
  description: "Activate and configure compliance frameworks for your organization",
};

export default function FrameworkConfigurePage() {
  return <FrameworkConfigureClient />;
}
