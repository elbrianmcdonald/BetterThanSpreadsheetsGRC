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
    const deep: FrameworkNode = { ...family, depth: 2 };

    render(
      <FrameworkNodeTable
        nodes={[deep]}
        columns={{}}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
        flat
      />,
    );

    expect(screen.queryByRole("button", { name: /expand/i })).not.toBeInTheDocument();

    // A depth-2 node in flat mode must not be indented: search results are a
    // flat list, and indenting them implies a hierarchy that is not shown.
    const codeCellInner = screen.getByText("03.01").parentElement;
    expect(codeCellInner).not.toBeNull();
    expect(["", "0px"]).toContain(codeCellInner!.style.paddingLeft);
  });

  it("shows a chevron for an unloaded parent that is not currently loading", () => {
    // The load-bearing contract: children === null means "children exist but
    // are not fetched yet". childCount (not children.length) drives the chevron,
    // otherwise unloaded parents become silently unexpandable.
    render(
      <FrameworkNodeTable
        nodes={[{ ...family, children: null }]}
        columns={{}}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /expand 03\.01/i })).toBeInTheDocument();
  });

  it("renders a neutral dash, not a Healthy badge, when a node has no health data", () => {
    render(
      <FrameworkNodeTable
        nodes={[leaf("c1", "03.01.01", "Account Management", 0)]}
        columns={{ health: true }}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
        healthByNodeId={new Map()}
      />,
    );

    expect(screen.queryByText("Healthy")).not.toBeInTheDocument();
  });

  it("keeps header and body cell counts in sync for the maturity column set", () => {
    render(
      <FrameworkNodeTable
        nodes={[leaf("q1", "ASSET-1a", "Asset inventory", 0)]}
        columns={{ level: true, testing: true }}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
      />,
    );

    // Code + Title + Level + TI + AC
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(5);

    const bodyRow = screen.getAllByRole("row")[1];
    expect(bodyRow).toBeDefined();
    expect(bodyRow!.querySelectorAll("td")).toHaveLength(headers.length);
  });

  it("omits health, domains and actions headers when their columns are off", () => {
    render(
      <FrameworkNodeTable
        nodes={[leaf("c1", "03.01.01", "Account Management", 0)]}
        columns={{}}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
      />,
    );

    expect(screen.queryByRole("columnheader", { name: "Health" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Risks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Findings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Domains" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });

  it("defaults the id header to Control ID and honours idHeader", () => {
    const { rerender } = render(
      <FrameworkNodeTable
        nodes={[leaf("c1", "03.01.01", "Account Management", 0)]}
        columns={{}}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Control ID" })).toBeInTheDocument();

    rerender(
      <FrameworkNodeTable
        nodes={[leaf("c1", "03.01.01", "Account Management", 0)]}
        columns={{}}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
        idHeader="Code"
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Code" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Control ID" })).not.toBeInTheDocument();
  });

  it("renders an empty state when there are no rows", () => {
    render(
      <FrameworkNodeTable nodes={[]} columns={{}} expanded={new Set()} onToggleExpand={jest.fn()} />,
    );

    expect(screen.getByText("No matching rows.")).toBeInTheDocument();
  });

  it("fires onRowClick from the keyboard", () => {
    const onRowClick = jest.fn();
    render(
      <FrameworkNodeTable
        nodes={[leaf("c1", "03.01.01", "Account Management", 0)]}
        columns={{}}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
        onRowClick={onRowClick}
      />,
    );

    const row = screen.getByRole("button", { name: /account management/i });
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: " " });
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it("exposes clickable domain and testing badges as real buttons", () => {
    const node: FrameworkNode = {
      ...leaf("c1", "03.01.01", "Account Management", 0),
      testInstructions: "Run the script",
      acceptanceCriteria: "No findings",
      domains: [{ id: "d1", code: "AC", name: "Access Control" }],
    };

    render(
      <FrameworkNodeTable
        nodes={[node]}
        columns={{ domains: true, testing: true }}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
        onEditDomains={jest.fn()}
        onEditTesting={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "AC" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run the script/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /no findings/i })).toBeInTheDocument();
  });
});
