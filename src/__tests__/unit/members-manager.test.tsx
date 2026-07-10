/**
 * @jest-environment jsdom
 *
 * Epic 3 — Stories 3.1 / 3.2: the company Members management UI.
 *
 * Lists members, adds an existing user by email + role (FR13), changes a
 * member's role and removes a member (FR14).
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockAdd = jest.fn().mockResolvedValue({ userId: "u9" });
const mockUpdateRole = jest.fn().mockResolvedValue({ userId: "u2", role: "MANAGER" });
const mockRemove = jest.fn().mockResolvedValue({ userId: "u2" });
const mockInvalidate = jest.fn();

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

jest.mock("@/trpc/react", () => ({
  api: {
    useUtils: () => ({ organization: { listMembers: { invalidate: mockInvalidate } } }),
    organization: {
      listMembers: { useQuery: jest.fn() },
      addMember: { useMutation: jest.fn() },
      updateMemberRole: { useMutation: jest.fn() },
      removeMember: { useMutation: jest.fn() },
    },
  },
}));

import { api } from "@/trpc/react";
import { MembersManager } from "@/components/admin/MembersManager";

const members = [
  { userId: "u1", name: "Alice", email: "alice@acme.test", role: "ADMINISTRATOR" },
  { userId: "u2", name: "Bob", email: "bob@acme.test", role: "BUSINESS_USER" },
];

describe("MembersManager (Story 3.1 / 3.2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.organization.listMembers.useQuery as jest.Mock).mockReturnValue({ data: members, isLoading: false });
    (api.organization.addMember.useMutation as jest.Mock).mockReturnValue({ mutateAsync: mockAdd, isPending: false });
    (api.organization.updateMemberRole.useMutation as jest.Mock).mockReturnValue({ mutateAsync: mockUpdateRole, isPending: false });
    (api.organization.removeMember.useMutation as jest.Mock).mockReturnValue({ mutateAsync: mockRemove, isPending: false });
  });

  it("lists the current members (FR7)", () => {
    render(<MembersManager />);
    expect(screen.getByText("alice@acme.test")).toBeInTheDocument();
    expect(screen.getByText("bob@acme.test")).toBeInTheDocument();
  });

  it("adds a member by email + role (FR13)", async () => {
    render(<MembersManager />);
    fireEvent.change(screen.getByLabelText(/member email/i), { target: { value: "carol@acme.test" } });
    fireEvent.change(screen.getByLabelText(/new member role/i), { target: { value: "ANALYST" } });
    fireEvent.click(screen.getByRole("button", { name: /add member/i }));

    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledWith({ email: "carol@acme.test", role: "ANALYST" });
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("changes a member's role (FR14)", async () => {
    render(<MembersManager />);
    fireEvent.change(screen.getByLabelText(/role for bob@acme.test/i), { target: { value: "MANAGER" } });

    await waitFor(() => {
      expect(mockUpdateRole).toHaveBeenCalledWith({ userId: "u2", role: "MANAGER" });
    });
  });

  it("removes a member (FR14)", async () => {
    render(<MembersManager />);
    fireEvent.click(screen.getByRole("button", { name: /remove bob@acme.test/i }));

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith({ userId: "u2" });
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });
});
