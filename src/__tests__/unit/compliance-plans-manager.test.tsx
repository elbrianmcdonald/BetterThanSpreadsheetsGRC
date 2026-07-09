/**
 * @jest-environment jsdom
 *
 * Bridge to Compliance Plan — Epic 1, Story 1.2 UI: the plans list.
 * Lists plans with owner + progress, creates a plan, and navigates to detail.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockCreate = jest.fn().mockResolvedValue({ id: "p9", name: "New Plan", status: "DRAFT" });
const mockInvalidate = jest.fn();
const mockPush = jest.fn();

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock("@/trpc/react", () => ({
  api: {
    useUtils: () => ({ compliancePlan: { list: { invalidate: mockInvalidate } } }),
    compliancePlan: {
      list: { useQuery: jest.fn() },
      create: { useMutation: jest.fn() },
    },
  },
}));

import { api } from "@/trpc/react";
import { CompliancePlansManager } from "@/components/compliance/CompliancePlansManager";

const plans = [
  { id: "p1", name: "SOC 2 Readiness", status: "ACTIVE", owner: { id: "o1", name: "Sarah" }, itemCount: 4, progressPct: 50, overdueCount: 1 },
  { id: "p2", name: "NIST CSF Uplift", status: "DRAFT", owner: null, itemCount: 0, progressPct: 0, overdueCount: 0 },
];

describe("CompliancePlansManager (Story 1.2 UI)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.compliancePlan.list.useQuery as jest.Mock).mockReturnValue({ data: plans, isLoading: false });
    (api.compliancePlan.create.useMutation as jest.Mock).mockReturnValue({ mutateAsync: mockCreate, isPending: false });
  });

  it("lists plans with owner and progress (FR3)", () => {
    render(<CompliancePlansManager />);
    expect(screen.getByText("SOC 2 Readiness")).toBeInTheDocument();
    expect(screen.getByText("Sarah")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("creates a plan (FR1)", async () => {
    render(<CompliancePlansManager />);
    fireEvent.change(screen.getByLabelText(/plan name/i), { target: { value: "PCI Plan" } });
    fireEvent.click(screen.getByRole("button", { name: /create plan/i }));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({ name: "PCI Plan" });
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("navigates to a plan's detail when clicked", () => {
    render(<CompliancePlansManager />);
    fireEvent.click(screen.getByRole("link", { name: /SOC 2 Readiness/i }));
    expect(mockPush).toHaveBeenCalledWith("/compliance/plans/p1");
  });
});
