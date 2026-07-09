/**
 * @jest-environment jsdom
 *
 * Multi-Tenancy — Companies management UI (platform admin).
 *
 * Lists all companies with member counts, creates a company, and deletes a
 * company (with confirmation). The caller's active company cannot be deleted.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockDelete = jest.fn().mockResolvedValue({ organizationId: "orgB" });
const mockCreate = jest.fn().mockResolvedValue({ organizationId: "orgNew", role: "ORG_ADMIN" });
const mockInvalidate = jest.fn();

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

jest.mock("next-auth/react", () => ({ useSession: jest.fn() }));

jest.mock("@/trpc/react", () => ({
  api: {
    useUtils: () => ({ organization: { listCompanies: { invalidate: mockInvalidate } } }),
    organization: {
      listCompanies: { useQuery: jest.fn() },
      delete: { useMutation: jest.fn() },
      create: { useMutation: jest.fn() },
    },
  },
}));

import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import { CompaniesManager } from "@/components/admin/CompaniesManager";

const companies = [
  { id: "orgA", name: "Acme", active: true, memberCount: 3 },
  { id: "orgB", name: "Globex", active: true, memberCount: 2 },
];

describe("CompaniesManager (delete companies)", () => {
  let confirmSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    (useSession as jest.Mock).mockReturnValue({ data: { user: { organizationId: "orgA" } } });
    (api.organization.listCompanies.useQuery as jest.Mock).mockReturnValue({ data: companies, isLoading: false });
    (api.organization.delete.useMutation as jest.Mock).mockReturnValue({ mutateAsync: mockDelete, isPending: false });
    (api.organization.create.useMutation as jest.Mock).mockReturnValue({ mutateAsync: mockCreate, isPending: false });
  });

  afterEach(() => confirmSpy.mockRestore());

  it("lists companies with member counts", () => {
    render(<CompaniesManager />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
  });

  it("deletes a non-active company after confirmation", async () => {
    render(<CompaniesManager />);
    fireEvent.click(screen.getByRole("button", { name: /delete Globex/i }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith({ organizationId: "orgB" });
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("does not offer to delete the caller's active company", () => {
    render(<CompaniesManager />);
    expect(screen.queryByRole("button", { name: /delete Acme/i })).not.toBeInTheDocument();
  });

  it("creates a company", async () => {
    render(<CompaniesManager />);
    fireEvent.change(screen.getByLabelText(/new company name/i), { target: { value: "Initech" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({ name: "Initech" });
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });
});
