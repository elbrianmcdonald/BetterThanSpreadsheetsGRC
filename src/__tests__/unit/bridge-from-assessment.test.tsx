/**
 * @jest-environment jsdom
 *
 * Bridge to Compliance Plan — Epic 2 UI: bridge assessment gaps into a plan.
 * Picks a compliance or maturity assessment and bridges its gaps, refreshing the plan.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockBridgeComp = jest.fn().mockResolvedValue({ total: 2, added: 2, skipped: 0 });
const mockBridgeMat = jest.fn().mockResolvedValue({ total: 1, added: 1, skipped: 0 });
const mockBridgeStd = jest.fn().mockResolvedValue({ total: 1, added: 1, skipped: 0 });
const mockBridgeOrg = jest.fn().mockResolvedValue({ total: 3, added: 3, skipped: 0 });
const mockInvalidate = jest.fn();

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

jest.mock("@/trpc/react", () => ({
  api: {
    useUtils: () => ({ compliancePlan: { get: { invalidate: mockInvalidate } } }),
    compliancePlan: {
      listBridgeSources: { useQuery: jest.fn() },
      bridgeComplianceAssessment: { useMutation: jest.fn() },
      bridgeMaturityAssessment: { useMutation: jest.fn() },
      bridgeStandardExceptions: { useMutation: jest.fn() },
      bridgeOrgDeficiencies: { useMutation: jest.fn() },
    },
  },
}));

import { api } from "@/trpc/react";
import { BridgeFromAssessment } from "@/components/compliance/BridgeFromAssessment";

const sources = [
  { kind: "COMPLIANCE", id: "ca1", name: "SOC 2 Assessment" },
  { kind: "MATURITY", id: "ma1", name: "NIST CSF Assessment" },
  { kind: "STANDARD", id: "std1", name: "Internal Standard" },
  { kind: "ORG_DEFICIENCY", id: "", name: "Open control deficiencies (3)" },
];

describe("BridgeFromAssessment (Epic 2 UI)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.compliancePlan.listBridgeSources.useQuery as jest.Mock).mockReturnValue({ data: sources, isLoading: false });
    (api.compliancePlan.bridgeComplianceAssessment.useMutation as jest.Mock).mockReturnValue({ mutateAsync: mockBridgeComp, isPending: false });
    (api.compliancePlan.bridgeMaturityAssessment.useMutation as jest.Mock).mockReturnValue({ mutateAsync: mockBridgeMat, isPending: false });
    (api.compliancePlan.bridgeStandardExceptions.useMutation as jest.Mock).mockReturnValue({ mutateAsync: mockBridgeStd, isPending: false });
    (api.compliancePlan.bridgeOrgDeficiencies.useMutation as jest.Mock).mockReturnValue({ mutateAsync: mockBridgeOrg, isPending: false });
  });

  it("lists compliance and maturity assessments as sources", () => {
    render(<BridgeFromAssessment planId="p1" />);
    expect(screen.getByRole("option", { name: /SOC 2 Assessment/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /NIST CSF Assessment/i })).toBeInTheDocument();
  });

  it("bridges a compliance assessment (FR12)", async () => {
    render(<BridgeFromAssessment planId="p1" />);
    fireEvent.change(screen.getByLabelText(/bridge from assessment/i), { target: { value: "COMPLIANCE:ca1" } });
    fireEvent.click(screen.getByRole("button", { name: /bridge gaps/i }));
    await waitFor(() => {
      expect(mockBridgeComp).toHaveBeenCalledWith({ planId: "p1", assessmentId: "ca1" });
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("bridges a maturity assessment (FR13)", async () => {
    render(<BridgeFromAssessment planId="p1" />);
    fireEvent.change(screen.getByLabelText(/bridge from assessment/i), { target: { value: "MATURITY:ma1" } });
    fireEvent.click(screen.getByRole("button", { name: /bridge gaps/i }));
    await waitFor(() => {
      expect(mockBridgeMat).toHaveBeenCalledWith({ planId: "p1", assessmentId: "ma1" });
    });
  });

  it("bridges standard exceptions (FR14)", async () => {
    render(<BridgeFromAssessment planId="p1" />);
    fireEvent.change(screen.getByLabelText(/bridge from assessment/i), { target: { value: "STANDARD:std1" } });
    fireEvent.click(screen.getByRole("button", { name: /bridge gaps/i }));
    await waitFor(() => {
      expect(mockBridgeStd).toHaveBeenCalledWith({ planId: "p1", standardId: "std1" });
    });
  });

  it("bridges org deficiencies (FR15)", async () => {
    render(<BridgeFromAssessment planId="p1" />);
    fireEvent.change(screen.getByLabelText(/bridge from assessment/i), { target: { value: "ORG_DEFICIENCY:" } });
    fireEvent.click(screen.getByRole("button", { name: /bridge gaps/i }));
    await waitFor(() => {
      expect(mockBridgeOrg).toHaveBeenCalledWith({ planId: "p1" });
    });
  });
});
