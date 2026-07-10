/**
 * @jest-environment jsdom
 *
 * Bridge to Compliance Plan — Epic 1, Story 1.3/1.4 UI: the plan detail board.
 * Renders control-anchored items, changes status inline, removes items, and adds
 * items via the unified control search picker.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockAdd = jest.fn().mockResolvedValue({ id: "itNew" });
const mockUpdate = jest.fn().mockResolvedValue({ id: "it1", status: "IN_PROGRESS" });
const mockRemove = jest.fn().mockResolvedValue({ id: "it1" });
const mockInvalidate = jest.fn();
const mockExportFetch = jest.fn().mockResolvedValue({ filename: "SOC 2 Readiness POA&M.csv", content: "Control ID\nAC-01" });
const mockRaise = jest.fn().mockResolvedValue({ id: "req1" });

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

jest.mock("@/trpc/react", () => ({
  api: {
    useUtils: () => ({ compliancePlan: { get: { invalidate: mockInvalidate }, exportPlan: { fetch: mockExportFetch } } }),
    compliancePlan: {
      get: { useQuery: jest.fn() },
      searchControls: { useQuery: jest.fn() },
      listOrgUsers: { useQuery: jest.fn() },
      listPeople: { useQuery: jest.fn() },
      addItem: { useMutation: jest.fn() },
      updateItem: { useMutation: jest.fn() },
      removeItem: { useMutation: jest.fn() },
      raiseEvidenceRequest: { useMutation: jest.fn() },
    },
  },
}));

import { api } from "@/trpc/react";
import { CompliancePlanDetail } from "@/components/compliance/CompliancePlanDetail";

const plan = {
  id: "p1",
  name: "SOC 2 Readiness",
  status: "ACTIVE",
  owner: null,
  progressPct: 50,
  overdueCount: 1,
  items: [
    {
      id: "it1",
      controlKind: "FRAMEWORK_CONTROL",
      controlId: "c1",
      control: { identifier: "AC-01", title: "Access Control", description: "d" },
      ownerId: null,
      owner: null,
      status: "OPEN",
      targetDate: null,
      evidenceNeeded: "Signed policy PDF",
      notes: null,
      acceptanceCriteria: null,
      linkedEvidence: [{ id: "ev1", title: "MFA Screenshot" }],
      overdue: false,
    },
    {
      id: "it2",
      controlKind: "FRAMEWORK_CONTROL",
      controlId: "c2",
      control: { identifier: "AU-02", title: "Event Logging", description: "d" },
      ownerId: null,
      owner: null,
      status: "OPEN",
      targetDate: null,
      evidenceNeeded: null,
      notes: null,
      acceptanceCriteria: null,
      linkedEvidence: [],
      overdue: false,
    },
  ],
};

const searchResults = [
  { kind: "ORGANIZATIONAL_CONTROL", controlId: "oc1", identifier: "OC-0001", title: "MFA Enforcement" },
];

describe("CompliancePlanDetail (Story 1.3/1.4 UI)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.compliancePlan.get.useQuery as jest.Mock).mockReturnValue({ data: plan, isLoading: false });
    (api.compliancePlan.searchControls.useQuery as jest.Mock).mockReturnValue({ data: searchResults, isLoading: false });
    (api.compliancePlan.addItem.useMutation as jest.Mock).mockReturnValue({ mutateAsync: mockAdd, isPending: false });
    (api.compliancePlan.updateItem.useMutation as jest.Mock).mockReturnValue({ mutateAsync: mockUpdate, isPending: false });
    (api.compliancePlan.removeItem.useMutation as jest.Mock).mockReturnValue({ mutateAsync: mockRemove, isPending: false });
    (api.compliancePlan.listOrgUsers.useQuery as jest.Mock).mockReturnValue({ data: [{ id: "u1", name: "Bob", email: "bob@x.test" }], isLoading: false });
    (api.compliancePlan.listPeople.useQuery as jest.Mock).mockReturnValue({ data: [{ id: "pp1", name: "Sarah Chen" }], isLoading: false });
    (api.compliancePlan.raiseEvidenceRequest.useMutation as jest.Mock).mockReturnValue({ mutateAsync: mockRaise, isPending: false });
  });

  it("renders items with their resolved control (FR9)", () => {
    render(<CompliancePlanDetail planId="p1" />);
    expect(screen.getByText("AC-01")).toBeInTheDocument();
    expect(screen.getByText("Access Control")).toBeInTheDocument();
    expect(screen.getByLabelText(/evidence needed for AC-01/i)).toHaveValue("Signed policy PDF");
  });

  it("the plan Save button is disabled until a field changes, then persists (FR7/FR11)", async () => {
    render(<CompliancePlanDetail planId="p1" />);
    const save = screen.getByRole("button", { name: /save changes/i });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/owner for AC-01/i), { target: { value: "pp1" } });
    expect(save).toBeEnabled();
    // Editing alone does not persist — no mutation yet.
    expect(mockUpdate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/status for AC-01/i), { target: { value: "IN_PROGRESS" } });
    fireEvent.change(screen.getByLabelText(/target date for AC-01/i), { target: { value: "2026-12-31" } });
    fireEvent.change(screen.getByLabelText(/evidence needed for AC-01/i), { target: { value: "Updated evidence" } });
    fireEvent.change(screen.getByLabelText(/acceptance criteria for AC-01/i), { target: { value: "Reviewed and signed" } });

    fireEvent.click(save);
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "it1",
          ownerId: "pp1",
          status: "IN_PROGRESS",
          evidenceNeeded: "Updated evidence",
          acceptanceCriteria: "Reviewed and signed",
          targetDate: expect.any(Date),
        }),
      );
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("one plan Save persists edits across multiple items at once", async () => {
    render(<CompliancePlanDetail planId="p1" />);
    // Edit fields on two different items.
    fireEvent.change(screen.getByLabelText(/owner for AC-01/i), { target: { value: "pp1" } });
    fireEvent.change(screen.getByLabelText(/status for AU-02/i), { target: { value: "IN_REVIEW" } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: "it1", ownerId: "pp1" }));
    });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: "it2", status: "IN_REVIEW" }));
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it("removes an item (FR11)", async () => {
    render(<CompliancePlanDetail planId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: /remove item AC-01/i }));
    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith({ id: "it1" });
    });
  });

  it("adds an item via the control search picker (FR5)", async () => {
    render(<CompliancePlanDetail planId="p1" />);
    fireEvent.change(screen.getByLabelText(/search controls/i), { target: { value: "OC" } });
    fireEvent.click(screen.getByRole("button", { name: /add OC-0001/i }));
    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledWith({ planId: "p1", controlKind: "ORGANIZATIONAL_CONTROL", controlId: "oc1" });
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("shows plan progress and overdue count (FR21)", () => {
    render(<CompliancePlanDetail planId="p1" />);
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText(/1 overdue/i)).toBeInTheDocument();
  });

  it("exports the plan as CSV (FR22)", async () => {
    (global.URL as unknown as { createObjectURL: jest.Mock }).createObjectURL = jest.fn(() => "blob:x");
    (global.URL as unknown as { revokeObjectURL: jest.Mock }).revokeObjectURL = jest.fn();
    render(<CompliancePlanDetail planId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    await waitFor(() => {
      expect(mockExportFetch).toHaveBeenCalledWith({ id: "p1" });
    });
  });

  it("shows linked evidence (FR19)", () => {
    render(<CompliancePlanDetail planId="p1" />);
    expect(screen.getByText("MFA Screenshot")).toBeInTheDocument();
  });

  it("raises an evidence request for an item (FR20)", async () => {
    render(<CompliancePlanDetail planId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: /request evidence for AC-01/i }));
    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: "u1" } });
    fireEvent.change(screen.getByLabelText(/instructions/i), { target: { value: "Upload the MFA export" } });
    fireEvent.click(screen.getByRole("button", { name: /send request/i }));
    await waitFor(() => {
      expect(mockRaise).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: "it1", recipientUserId: "u1", instructions: "Upload the MFA export" }),
      );
    });
  });
});
