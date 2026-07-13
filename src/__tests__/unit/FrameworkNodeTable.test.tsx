/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("renames a level for display when levelLabels maps it, and leaves unmapped levels alone", () => {
    // C2M2 stores its top tier as FUNCTION (the enum is written in NIST CSF's
    // vocabulary) but it is properly a Domain.
    const c2m2Domain: FrameworkNode = {
      ...leaf("asset", "ASSET", "Asset Management", 0),
      kind: "domain",
      levelLabel: "FUNCTION",
    };
    const practice: FrameworkNode = {
      ...leaf("asset-1a", "ASSET-1a", "Are IT assets inventoried?", 0),
      kind: "question",
      levelLabel: "MIL 1",
    };

    render(
      <FrameworkNodeTable
        nodes={[c2m2Domain, practice]}
        columns={{ level: true }}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
        levelLabels={{ FUNCTION: "DOMAIN" }}
      />,
    );

    expect(screen.getByText("DOMAIN")).toBeInTheDocument();
    expect(screen.queryByText("FUNCTION")).not.toBeInTheDocument();
    // Unmapped levels are untouched.
    expect(screen.getByText("MIL 1")).toBeInTheDocument();
  });

  it("renames every mapped tier, so SAMM reads in its own vocabulary", () => {
    const tiers: FrameworkNode[] = [
      { ...leaf("g", "G", "Governance", 0), kind: "domain", levelLabel: "FUNCTION" },
      { ...leaf("gsm", "G-SM", "Strategy and Metrics", 0), kind: "domain", levelLabel: "CATEGORY" },
      { ...leaf("gsma", "G-SM-A", "Create and Promote", 0), kind: "domain", levelLabel: "SUBCATEGORY" },
    ];

    render(
      <FrameworkNodeTable
        nodes={tiers}
        columns={{ level: true }}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
        levelLabels={{
          FUNCTION: "BUSINESS FUNCTION",
          CATEGORY: "SECURITY PRACTICE",
          SUBCATEGORY: "ACTIVITY STREAM",
        }}
      />,
    );

    expect(screen.getByText("BUSINESS FUNCTION")).toBeInTheDocument();
    expect(screen.getByText("SECURITY PRACTICE")).toBeInTheDocument();
    expect(screen.getByText("ACTIVITY STREAM")).toBeInTheDocument();
    expect(screen.queryByText("CATEGORY")).not.toBeInTheDocument();
    expect(screen.queryByText("SUBCATEGORY")).not.toBeInTheDocument();
  });

  it("renders the stored level when no levelLabels map is given", () => {
    const csfFunction: FrameworkNode = {
      ...leaf("gv", "GV", "Govern", 0),
      kind: "domain",
      levelLabel: "FUNCTION",
    };

    render(
      <FrameworkNodeTable
        nodes={[csfFunction]}
        columns={{ level: true }}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
      />,
    );

    // NIST CSF's Functions really are Functions — the rename must not leak.
    expect(screen.getByText("FUNCTION")).toBeInTheDocument();
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

  it("renders no empty state of its own — the page owns that copy", () => {
    // Only the page knows whether "no rows" means an empty framework, a search
    // with no hits, or a filter with no hits — and only the page can offer the
    // Clear-filters escape hatch. The table draws headers and stops.
    render(
      <FrameworkNodeTable nodes={[]} columns={{}} expanded={new Set()} onToggleExpand={jest.fn()} />,
    );

    expect(screen.queryByText("No matching rows.")).not.toBeInTheDocument();
    // Header row only.
    expect(screen.getAllByRole("row")).toHaveLength(1);
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

    const row = screen.getAllByRole("row")[1];
    expect(row).toBeDefined();
    fireEvent.keyDown(row!, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row!, { key: " " });
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it("lets the keyboard activate the chevron without the row hijacking the keystroke", async () => {
    // The row's own Enter/Space handler must not preventDefault() on keystrokes
    // that originated inside a nested control: doing so cancels the button's
    // default activation, so the node never expands and the row navigates away.
    const user = userEvent.setup();
    const onToggleExpand = jest.fn();
    const onRowClick = jest.fn();

    render(
      <FrameworkNodeTable
        nodes={[family]}
        columns={{ health: true, domains: true, testing: true, children: true, actions: true }}
        expanded={new Set()}
        onToggleExpand={onToggleExpand}
        onRowClick={onRowClick}
      />,
    );

    const chevron = screen.getByRole("button", { name: /expand 03\.01/i });
    chevron.focus();
    await user.keyboard("{Enter}");

    expect(onToggleExpand).toHaveBeenCalledWith(family);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("keeps table row semantics and nested controls reachable when the row is clickable", () => {
    // role="button" on a <tr> is children-presentational: it strips every nested
    // control out of the accessibility tree and breaks table > rowgroup > row.
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
        onRowClick={jest.fn()}
        onEditDomains={jest.fn()}
        onEditTesting={jest.fn()}
      />,
    );

    const bodyRow = screen.getAllByRole("row")[1];
    expect(bodyRow).toBeDefined();
    expect(bodyRow!.getAttribute("role")).toBeNull();
    expect(bodyRow).toHaveAttribute("tabindex", "0");

    // Nested controls stay in the accessibility tree.
    expect(screen.getByRole("button", { name: "AC" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run the script/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /no findings/i })).toBeInTheDocument();
  });

  it("keeps header and body cell counts in sync for the compliance column set", () => {
    render(
      <FrameworkNodeTable
        nodes={[leaf("c1", "03.01.01", "Account Management", 0)]}
        columns={{ health: true, domains: true, testing: true, children: true, actions: true }}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
      />,
    );

    // Control ID + Title + Risks + Findings + Health + Domains + TI + AC + Children + Actions
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(10);

    const bodyRow = screen.getAllByRole("row")[1];
    expect(bodyRow).toBeDefined();
    expect(bodyRow!.querySelectorAll("td")).toHaveLength(headers.length);
  });

  it("tells the user when an expanded row's children failed to load, and offers a retry", () => {
    // A failed child fetch is neither pending nor loaded: the row sits open with
    // nothing under it. Without this row there is no spinner, no error and no
    // way back other than collapsing and guessing.
    const onRetryChildren = jest.fn();
    const unloaded: FrameworkNode = { ...family, children: null };

    render(
      <FrameworkNodeTable
        nodes={[unloaded]}
        columns={{ health: true, domains: true, testing: true, children: true, actions: true }}
        expanded={new Set(["f1"])}
        childErrorIds={new Set(["f1"])}
        onRetryChildren={onRetryChildren}
        onToggleExpand={jest.fn()}
      />,
    );

    expect(screen.getByText(/couldn't load sub-controls of 03\.01/i)).toBeInTheDocument();

    // columnCount is a hand-maintained parallel of the header block; tie it to
    // the real header count so a new column cannot silently desync the colSpan.
    const headerCount = screen.getAllByRole("columnheader").length;
    const errorCell = screen.getByText(/couldn't load sub-controls of 03\.01/i).closest("td");
    expect(errorCell).toHaveAttribute("colspan", String(headerCount));

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetryChildren).toHaveBeenCalledWith(unloaded);
  });

  it("does not draw the child-error row for a collapsed row", () => {
    render(
      <FrameworkNodeTable
        nodes={[{ ...family, children: null }]}
        columns={{ children: true }}
        expanded={new Set()}
        childErrorIds={new Set(["f1"])}
        onRetryChildren={jest.fn()}
        onToggleExpand={jest.fn()}
      />,
    );

    expect(screen.queryByText(/couldn't load sub-controls/i)).not.toBeInTheDocument();
  });

  it("colours maturity level badges from non-status tokens only", () => {
    // --chart-2 IS --success and --chart-3 IS --warning (and --chart-4 IS
    // --destructive) byte-for-byte in globals.css, so those tokens would render
    // a level as a compliance state. Levels are categorical, not a status.
    const fn: FrameworkNode = { ...leaf("gv", "GV", "Govern", 0), kind: "domain", levelLabel: "FUNCTION" };
    const cat: FrameworkNode = { ...leaf("gv-oc", "GV.OC", "Org Context", 1), kind: "domain", levelLabel: "CATEGORY" };

    render(
      <FrameworkNodeTable
        nodes={[fn, cat]}
        columns={{ level: true }}
        expanded={new Set()}
        onToggleExpand={jest.fn()}
        flat
      />,
    );

    const functionClass = screen.getByText("FUNCTION").className;
    const categoryClass = screen.getByText("CATEGORY").className;

    // Only look at colour utilities the level adds; the badge base class legitimately
    // carries aria-invalid:*-destructive variants.
    const statusPaint = /(?:^|\s)(?:bg|text|border)-(?:chart-2|chart-3|chart-4|success|warning|destructive)\b/;
    for (const cls of [functionClass, categoryClass]) {
      expect(cls).not.toMatch(statusPaint);
    }
    // ...and the two levels still read differently at a glance.
    expect(functionClass).not.toEqual(categoryClass);
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
