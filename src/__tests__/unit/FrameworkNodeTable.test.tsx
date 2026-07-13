/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { FrameworkNodeTable } from "@/components/frameworks/FrameworkNodeTable";
import type { FrameworkNode } from "@/lib/frameworks/framework-node";

const leaf = (id: string, code: string, title: string, depth: number): FrameworkNode => ({
  id,
  code,
  title,
  description: null,
  kind: "control",
  levelLabel: null,
  depth,
  childCount: 0,
  children: [],
  testInstructions: null,
  acceptanceCriteria: null,
  domains: [],
  isActive: true,
});

const family: FrameworkNode = {
  ...leaf("f1", "03.01", "Access Control", 0),
  childCount: 2,
  children: [leaf("c1", "03.01.01", "Account Management", 1), leaf("c2", "03.01.02", "Access Enforcement", 1)],
};

describe("FrameworkNodeTable", () => {
  it("renders only root rows when nothing is expanded", () => {
    render(
      <FrameworkNodeTable
        nodes={[family]}
        columns={{ children: true }}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
      />,
    );

    expect(screen.getByText("03.01")).toBeInTheDocument();
    expect(screen.queryByText("03.01.01")).not.toBeInTheDocument();
  });

  it("renders children of an expanded row", () => {
    render(
      <FrameworkNodeTable
        nodes={[family]}
        columns={{ children: true }}
        expanded={new Set(["f1"])}
        onToggleExpand={jest.fn()}
      />,
    );

    expect(screen.getByText("03.01.01")).toBeInTheDocument();
    expect(screen.getByText("03.01.02")).toBeInTheDocument();
  });

  it("calls onToggleExpand with the node when the chevron is clicked", () => {
    const onToggleExpand = jest.fn();
    render(
      <FrameworkNodeTable
        nodes={[family]}
        columns={{}}
        expanded={new Set()}
        onToggleExpand={onToggleExpand}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /expand 03\.01/i }));
    expect(onToggleExpand).toHaveBeenCalledWith(family);
  });

  it("renders no chevron for a leaf", () => {
    render(
      <FrameworkNodeTable
        nodes={[leaf("c1", "03.01.01", "Account Management", 0)]}
        columns={{}}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /expand/i })).not.toBeInTheDocument();
  });

  it("shows a level badge only when the level column is on", () => {
    const domain: FrameworkNode = {
      ...leaf("gv", "GV", "Govern", 0),
      kind: "domain",
      levelLabel: "FUNCTION",
    };

    const { rerender } = render(
      <FrameworkNodeTable nodes={[domain]} columns={{ level: true }} expanded={new Set()} onToggleExpand={jest.fn()} />,
    );
    expect(screen.getByText("FUNCTION")).toBeInTheDocument();

    rerender(
      <FrameworkNodeTable nodes={[domain]} columns={{}} expanded={new Set()} onToggleExpand={jest.fn()} />,
    );
    expect(screen.queryByText("FUNCTION")).not.toBeInTheDocument();
  });

  it("renders health columns from healthByNodeId when the health column is on", () => {
    render(
      <FrameworkNodeTable
        nodes={[leaf("c1", "03.01.01", "Account Management", 0)]}
        columns={{ health: true }}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
        healthByNodeId={new Map([["c1", { health: "CRITICAL", riskCount: 3, findingCount: 1 }]])}
      />,
    );

    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows a spinner in place of the chevron while children load", () => {
    render(
      <FrameworkNodeTable
        nodes={[{ ...family, children: null }]}
        columns={{}}
        expanded={new Set(["f1"])}
        onToggleExpand={jest.fn()}
        loadingChildIds={new Set(["f1"])}
      />,
    );

    expect(screen.getByLabelText(/loading children/i)).toBeInTheDocument();
  });

  it("suppresses chevrons and indentation in flat mode", () => {
    render(
      <FrameworkNodeTable
        nodes={[family]}
        columns={{}}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
        flat
      />,
    );

    expect(screen.queryByRole("button", { name: /expand/i })).not.toBeInTheDocument();
  });
});
