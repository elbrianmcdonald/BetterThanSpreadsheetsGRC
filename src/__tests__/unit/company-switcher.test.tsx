/**
 * @jest-environment jsdom
 *
 * Epic 1 Story 1.4 + Epic 2 Story 2.1: the sidebar company switcher.
 *
 * - Hidden when the user can access fewer than two companies AND is not an admin
 *   (AR2). A single-company org admin still sees it, so they can create a company.
 * - Shows the active company and lists all accessible companies (FR6, FR7, NFR6).
 * - Selecting a company runs switch → session update → router refresh (FR8).
 * - Creating a company runs create → session update → refresh (FR10, FR12).
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockUpdate = jest.fn();
const mockRefresh = jest.fn();
const mockInvalidate = jest.fn();
const mockMutateAsync = jest.fn().mockResolvedValue({ organizationId: "orgB", role: "AUDITOR" });
const mockCreateAsync = jest.fn().mockResolvedValue({ organizationId: "orgNew", role: "ORG_ADMIN" });

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: jest.fn() }),
}));

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

jest.mock("@/trpc/react", () => ({
  api: {
    useUtils: () => ({ invalidate: mockInvalidate }),
    organization: {
      listSwitchable: { useQuery: jest.fn() },
      switch: { useMutation: jest.fn() },
      create: { useMutation: jest.fn() },
    },
  },
}));

import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import { CompanySwitcher } from "@/components/layout/CompanySwitcher";

const setSwitchable = (orgs: Array<{ id: string; name: string }> | undefined) => {
  (api.organization.listSwitchable.useQuery as jest.Mock).mockReturnValue({
    data: orgs,
    isLoading: false,
  });
};

const setSession = (organizationId: string, role = "AUDITOR") => {
  (useSession as jest.Mock).mockReturnValue({
    data: { user: { organizationId, role } },
    update: mockUpdate,
  });
};

describe("CompanySwitcher (Story 1.4 + 2.1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.organization.switch.useMutation as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
    (api.organization.create.useMutation as jest.Mock).mockReturnValue({
      mutateAsync: mockCreateAsync,
      isPending: false,
    });
    setSession("orgA");
  });

  it("renders nothing for a single-company non-admin (AR2)", () => {
    setSwitchable([{ id: "orgA", name: "Acme" }]);
    const { container } = render(<CompanySwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the list is still loading", () => {
    setSwitchable(undefined);
    const { container } = render(<CompanySwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the active company and lists all accessible companies (FR6, FR7)", () => {
    setSwitchable([
      { id: "orgA", name: "Acme" },
      { id: "orgB", name: "Globex" },
    ]);
    render(<CompanySwitcher />);
    const select = screen.getByLabelText(/switch company/i) as HTMLSelectElement;
    expect(select.value).toBe("orgA");
    expect(screen.getByRole("option", { name: "Acme" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Globex" })).toBeInTheDocument();
  });

  it("switches company on selection: mutation → session update → refresh (FR8)", async () => {
    setSwitchable([
      { id: "orgA", name: "Acme" },
      { id: "orgB", name: "Globex" },
    ]);
    render(<CompanySwitcher />);
    fireEvent.change(screen.getByLabelText(/switch company/i), {
      target: { value: "orgB" },
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ organizationId: "orgB" });
    });
    expect(mockUpdate).toHaveBeenCalledWith({ organizationId: "orgB" });
    expect(mockInvalidate).toHaveBeenCalled(); // client query cache re-scoped to new org
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows the switcher for a single-company ORG_ADMIN so they can create (FR10)", () => {
    setSession("orgA", "ORG_ADMIN");
    setSwitchable([{ id: "orgA", name: "Acme" }]);
    render(<CompanySwitcher />);
    expect(screen.getByRole("button", { name: /new company/i })).toBeInTheDocument();
  });

  it("creates a company: create → session update → refresh (FR10, FR12)", async () => {
    setSession("orgA", "ORG_ADMIN");
    setSwitchable([{ id: "orgA", name: "Acme" }]);
    render(<CompanySwitcher />);

    fireEvent.click(screen.getByRole("button", { name: /new company/i }));
    fireEvent.change(screen.getByLabelText(/new company name/i), {
      target: { value: "Fresh Co" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(mockCreateAsync).toHaveBeenCalledWith({ name: "Fresh Co" });
    });
    expect(mockUpdate).toHaveBeenCalledWith({ organizationId: "orgNew" });
    expect(mockRefresh).toHaveBeenCalled();
  });
});
