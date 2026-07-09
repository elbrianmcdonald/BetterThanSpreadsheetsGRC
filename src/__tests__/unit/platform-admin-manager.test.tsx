/**
 * @jest-environment jsdom
 *
 * Epic 3 — Story 3.3: the platform-admin management UI.
 *
 * Lists platform admins and grants/revokes platform-admin by email (FR16).
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockSet = jest.fn().mockResolvedValue({ userId: "u9", isPlatformAdmin: true });
const mockInvalidate = jest.fn();

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

jest.mock("@/trpc/react", () => ({
  api: {
    useUtils: () => ({ organization: { listPlatformAdmins: { invalidate: mockInvalidate } } }),
    organization: {
      listPlatformAdmins: { useQuery: jest.fn() },
      setPlatformAdmin: { useMutation: jest.fn() },
    },
  },
}));

import { api } from "@/trpc/react";
import { PlatformAdminManager } from "@/components/admin/PlatformAdminManager";

const admins = [
  { id: "u1", name: "Root", email: "root@platform.test" },
  { id: "u2", name: "Ops", email: "ops@platform.test" },
];

describe("PlatformAdminManager (Story 3.3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.organization.listPlatformAdmins.useQuery as jest.Mock).mockReturnValue({ data: admins, isLoading: false });
    (api.organization.setPlatformAdmin.useMutation as jest.Mock).mockReturnValue({ mutateAsync: mockSet, isPending: false });
  });

  it("lists current platform admins", () => {
    render(<PlatformAdminManager />);
    expect(screen.getByText("root@platform.test")).toBeInTheDocument();
    expect(screen.getByText("ops@platform.test")).toBeInTheDocument();
  });

  it("grants platform-admin by email (FR16)", async () => {
    render(<PlatformAdminManager />);
    fireEvent.change(screen.getByLabelText(/grant.*email/i), { target: { value: "new@platform.test" } });
    fireEvent.click(screen.getByRole("button", { name: /^grant$/i }));

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith({ email: "new@platform.test", isPlatformAdmin: true });
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("revokes platform-admin from a listed admin (FR16)", async () => {
    render(<PlatformAdminManager />);
    fireEvent.click(screen.getByRole("button", { name: /revoke ops@platform.test/i }));

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith({ email: "ops@platform.test", isPlatformAdmin: false });
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });
});
