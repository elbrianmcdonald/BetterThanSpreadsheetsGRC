# NIST 800-53: Real Control Text and a Complete Hierarchy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give NIST SP 800-53 its real control statements and discussion (it currently has none), make all 872 control enhancements visible and scoreable in a compliance assessment (they are currently dropped on the floor), and stop a parent control row from opening a modal that just re-lists what the row already expands.

**Architecture:** Three independent fixes. (1) A Python generator reads NIST's official OSCAL 800-53 Rev 5.2.0 catalog and emits a JSON data file; the seed loads it at runtime with `fs.readFileSync` and writes real `description` and `guidance` onto every control. (2) The compliance assessment page's two-level grouping becomes a real recursive tree so enhancements nest under their base control. (3) The framework detail page routes a row click by whether the row has children.

**Tech Stack:** Python 3 (generator, run once, output committed), Prisma 7 + `tsx` seed, Next.js 15 App Router, React 19, tRPC v11, Jest 30, Playwright.

## Global Constraints

- **`verbatimModuleSyntax: true`** — type-only imports MUST be `import type { X }` or inline `import { type X }`. A plain value-import of a type breaks the build. **This is the single most common mistake in this repo.**
- **`noUncheckedIndexedAccess: true`** — `arr[0]` is `T | undefined`; guard, `?.`, or a justified `!`.
- **`prisma/seeds/` IS typechecked** (8 files reach `tsc`) and **`resolveJsonModule` is `true`** (`tsconfig.json:8`). So the 800-53 control text must be loaded at **runtime via `fs.readFileSync` + `JSON.parse`**, typed by an explicit hand-written interface. Do **NOT** inline ~2.5 MB of prose into a `.ts` file and do **NOT** `import` the JSON — either makes `tsc` parse and infer types over megabytes.
- **`organizationProcedure`, never `protectedProcedure`, for org-scoped reads.** A read with no org context silently returns **all tenants' rows** (`src/server/db/middleware/organization-filter.ts:327-330`). `Control` and `Framework` ARE auto-filtered inside `organizationProcedure`.
- **Typecheck is the ONLY static gate and is RED at a baseline of 225 errors** (223 in `src/__tests__/`, 2 in `e2e/`); app source is clean at zero. The bar: no new errors, app source stays at zero. Check with `npm run typecheck 2>&1 | grep -c 'error TS'`.
- **17 Jest unit failures pre-date this work** (`matrix-builder-autosave`, `compliance-plan-detail`). Confirm the count does not grow; do not fix them.
- **NEVER run `npm run dev`** (the app runs in Docker on port 80) and **NEVER run `npm run db:generate`** — it is actually `prisma migrate dev` and can reset the database.
- **The Docker app does NOT hot-reload.** It is a baked `NODE_ENV=production` image with no source bind-mount. Run `docker compose up -d --build app` before any browser check, or you will verify a stale page.
- **Integration tests cannot run on the Windows host.** Use the compose test profile: `docker compose --profile test up -d test` then `docker compose --profile test exec test npx jest <path>`. There is no `_test` database.
- Playwright needs `PW_BASE_URL=http://127.0.0.1` (config defaults to `:3000`; the app is on port 80).
- Tests live only in `src/__tests__/{unit,integration}/`, named `*.test.ts(x)`; component tests need a `@jest-environment jsdom` docblock.
- Client tRPC import is `import { api } from "@/trpc/react"`; invalidation is `api.useUtils()` + `void utils.X.Y.invalidate()`. **Never `useQueryClient`.** Toasts: `sonner` only.
- No hand-edits to `src/components/ui/` (shadcn-generated). No edits to `tailwind.config.ts` (inert — Tailwind v4 is CSS-first). Semantic OKLCH token classes only, never raw hex or raw palette colours.
- There is no linter and no formatter. Match the surrounding file by imitation.
- Commits are **plain imperative sentences, NOT Conventional Commits** — no `feat:`/`fix:`/`chore:` prefixes.

---

## Background — what is actually broken

**The data.** `prisma/seeds/nist-800-53-r5.ts` was auto-generated from `cprt_SP_800_53_B_5_2_0.xlsx` — NIST's **baselines** workbook, which contains only control IDs, titles and LOW/MOD/HIGH allocation. It has no control text. The seed's element type is `{ controlId, familyId, parentId, title, baselines }` — there is no `description` or `guidance` field at all, and `nist-800-53-r5.ts:1282` literally writes `description: control.title`. Result, verified in the database:

| Framework | Controls | Real description | Guidance |
|---|---|---|---|
| NIST 800-171 | 228 | 194 | 194 |
| ISO 27001 | 45 | 45 | 0 |
| NIST CSF | 39 | 39 | 0 |
| **NIST 800-53** | **1216** | **0** | **0** |

**The dropped enhancements.** 800-53 is three levels: family (`AC`) → base control (`AC-02`) → enhancement (`AC-02(01)`). The assessment page's `controlGroups` memo (`src/app/compliance/assessments/[id]/client.tsx:1011-1057`) buckets every score by `parentControlId`, then treats only **top-level** controls as groups and reads only *their* direct children. An enhancement's parent is a base control, which is itself a child — so `childMap.get(<AC-02's id>)` is never read and all **872 enhancements are silently discarded**. Verified: the database has score rows for all 1,216 controls, but expanding `AC` renders exactly 25 rows and zero enhancements, and the card reads *"0/25 controls"* when the real denominator is ~175.

**The redundant modal.** On `/admin/frameworks/[id]` every row is clickable and opens `ControlDetailModal`. For a parent row the modal's entire content is the title, a description (which for 800-53 is the title again), and a scrolling list of its sub-controls — exactly what the row's expand chevron already shows inline.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `scripts/extract-800-53-oscal.py` | Reads the NIST OSCAL catalog, resolves parameter placeholders, flattens statement parts, and writes the JSON data file. Run once; its output is committed. |
| `prisma/seeds/data/nist-800-53-r5-text.json` | Generated. `{ "AC-02": { "description": "...", "guidance": "..." }, ... }` — one entry per control id. Loaded at runtime by the seed. |
| `src/__tests__/unit/control-tree.test.ts` | Unit tests for the recursive grouping helper. |
| `e2e/assessment-hierarchy.spec.ts` | Playwright: enhancements are reachable in an assessment. |

**Modified:**

| File | Change |
|---|---|
| `prisma/seeds/nist-800-53-r5.ts` | Load the JSON at runtime; write real `description` + `guidance` on families, base controls and enhancements. Replaces `description: control.title` at `:1259`, `:1282`, and the enhancement create. |
| `src/lib/compliance/control-tree.ts` (new) | Pure recursive grouping: flat `ControlScore[]` → nested tree of arbitrary depth. Extracted so it is unit-testable without React. |
| `src/app/compliance/assessments/[id]/client.tsx` | Use the recursive tree; render enhancements nested under their base control, collapsible; fix the `N/M controls` denominator. |
| `src/app/admin/frameworks/[id]/client.tsx` | A row click expands a parent; only a leaf opens `ControlDetailModal`. |

---

## Task 1: Extract the real control text from NIST's OSCAL catalog

**Files:**
- Create: `scripts/extract-800-53-oscal.py`
- Create: `prisma/seeds/data/nist-800-53-r5-text.json` (generated by the script; commit the output)

**Interfaces:**
- Consumes: the NIST OSCAL catalog JSON (downloaded in Step 1).
- Produces: `prisma/seeds/data/nist-800-53-r5-text.json`, a flat object keyed by the **repo's** control-id format (`AC`, `AC-02`, `AC-02(01)`), each value `{ "description": string, "guidance": string | null }`.

**The catalog's shape** (verified against the real file):
- `catalog.groups[]` — 20 families, `{ id: "ac", title: "Access Control", controls: [...] }`.
- Each control: `{ id: "ac-2", title, params: [...], parts: [...], controls: [...] }`. Nested `controls` are the enhancements (`ac-2.1`). Counts: **324 base, 872 enhancements** — exactly the repo's numbers.
- `parts[]` entries have `name` of `"statement"` or `"guidance"`; a `statement` part has `prose` and/or nested `parts` with a `label` prop (`a.`, `b.`, `1.`).
- Prose contains placeholders `{{ insert: param, ac-02_odp.01 }}`. A `param` is either `{ id, label }` or `{ id, select: { "how-many": "one-or-more", choice: [...] } }`. There are **133** select-params.

**ID mapping is not optional.** OSCAL says `ac-2` and `ac-2.1`; the repo says `AC-02` and `AC-02(01)`. The base number is **zero-padded to two digits**, the enhancement number is **zero-padded to two digits inside parentheses**. Families are just uppercased (`ac` → `AC`).

- [ ] **Step 1: Download the catalog**

The catalog is not committed (10 MB). Download it to a scratch path:

```bash
curl -sSL -o /tmp/800-53r5-catalog.json \
  https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json
```

Confirm it is Rev 5.2.0 — the version the repo's framework record claims:

```bash
python -c "import json,io; print(json.load(io.open('/tmp/800-53r5-catalog.json', encoding='utf-8'))['catalog']['metadata']['version'])"
```
Expected: `5.2.0`

- [ ] **Step 2: Write the generator**

Create `scripts/extract-800-53-oscal.py`:

```python
"""
Generate prisma/seeds/data/nist-800-53-r5-text.json from NIST's OSCAL catalog.

The existing 800-53 seed came from NIST's CPRT *baselines* workbook, which
carries no control text, so every control's description was a copy of its title
and its guidance was null. This pulls the real statement and discussion out of
the official catalog.

Usage:
    python scripts/extract-800-53-oscal.py <path-to-catalog.json>
"""
import io
import json
import os
import re
import sys

PLACEHOLDER = re.compile(r"\{\{\s*insert:\s*param,\s*([^}\s]+)\s*\}\}")


def repo_control_id(oscal_id):
    """ac -> AC | ac-2 -> AC-02 | ac-2.1 -> AC-02(01)"""
    m = re.fullmatch(r"([a-z]{2})(?:-(\d+))?(?:\.(\d+))?", oscal_id)
    if not m:
        raise ValueError("unrecognised OSCAL control id: %s" % oscal_id)
    family, base, enh = m.group(1).upper(), m.group(2), m.group(3)
    if base is None:
        return family
    if enh is None:
        return "%s-%02d" % (family, int(base))
    return "%s-%02d(%02d)" % (family, int(base), int(enh))


def render_param(param):
    """NIST's own print convention: an ODP renders as an Assignment or a Selection."""
    select = param.get("select")
    if select:
        choices = "; ".join(c.strip() for c in select.get("choice", []))
        how_many = select.get("how-many")
        qualifier = " (one or more)" if how_many == "one-or-more" else ""
        return "[Selection%s: %s]" % (qualifier, choices)
    label = param.get("label") or param.get("id")
    return "[Assignment: organization-defined %s]" % label


def resolve(prose, params):
    if not prose:
        return ""

    def sub(match):
        pid = match.group(1)
        param = params.get(pid)
        # An unresolved placeholder must never reach the UI as raw OSCAL syntax.
        return render_param(param) if param else "[Assignment: organization-defined value]"

    return PLACEHOLDER.sub(sub, prose)


def collect_params(control, inherited):
    params = dict(inherited)
    for p in control.get("params", []):
        params[p["id"]] = p
    return params


def flatten_part(part, params, depth=0):
    """A statement is prose plus labelled sub-parts (a., b., 1., ...)."""
    lines = []
    prose = resolve(part.get("prose"), params)
    label = next(
        (p["value"] for p in part.get("props", []) if p.get("name") == "label"),
        None,
    )
    if prose:
        indent = "  " * depth
        lines.append("%s%s%s" % (indent, (label + " ") if label else "", prose))
    elif label:
        lines.append("%s%s" % ("  " * depth, label))
    for sub in part.get("parts", []):
        lines.extend(flatten_part(sub, params, depth + 1 if label else depth))
    return lines


def part_named(control, name):
    return next((p for p in control.get("parts", []) if p.get("name") == name), None)


def extract(control, params, out):
    params = collect_params(control, params)
    cid = repo_control_id(control["id"])

    statement = part_named(control, "statement")
    description = "\n".join(flatten_part(statement, params)).strip() if statement else ""

    guidance_part = part_named(control, "guidance")
    guidance = resolve(guidance_part.get("prose"), params).strip() if guidance_part else ""

    out[cid] = {
        "description": description or control["title"],
        "guidance": guidance or None,
    }

    for child in control.get("controls", []):
        extract(child, params, out)


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: extract-800-53-oscal.py <catalog.json>")

    with io.open(sys.argv[1], encoding="utf-8") as fh:
        catalog = json.load(fh)["catalog"]

    out = {}
    for group in catalog["groups"]:
        # Families carry no statement of their own; the title is all NIST gives.
        out[group["id"].upper()] = {"description": group["title"], "guidance": None}
        for control in group.get("controls", []):
            extract(control, {}, out)

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dest_dir = os.path.join(repo_root, "prisma", "seeds", "data")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, "nist-800-53-r5-text.json")

    with io.open(dest, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False, sort_keys=True)
        fh.write("\n")

    families = sum(1 for k in out if "-" not in k)
    enhancements = sum(1 for k in out if "(" in k)
    base = len(out) - families - enhancements
    print("wrote %s" % dest)
    print("families=%d base=%d enhancements=%d total=%d" % (families, base, enhancements, len(out)))
    unresolved = sum(1 for v in out.values() if "{{" in (v["description"] or "") or "{{" in (v["guidance"] or ""))
    print("controls still containing an unresolved placeholder: %d" % unresolved)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run it and check the output against the known-good numbers**

Run: `python scripts/extract-800-53-oscal.py /tmp/800-53r5-catalog.json`

Expected, exactly:
```
families=20 base=324 enhancements=872 total=1216
controls still containing an unresolved placeholder: 0
```

If `total` is not **1216**, or any placeholder survives, stop — the ID mapping or the parameter resolution is wrong. Do not proceed with a bad data file.

- [ ] **Step 4: Eyeball the two controls the user complained about**

Run:
```bash
python -c "
import io, json
d = json.load(io.open('prisma/seeds/data/nist-800-53-r5-text.json', encoding='utf-8'))
for k in ['AC', 'AC-02', 'AC-02(01)']:
    print('===', k, '===')
    print(d[k]['description'][:300])
    print('--- guidance:', (d[k]['guidance'] or '(none)')[:160])
"
```

Expected: `AC-02`'s description is the real lettered statement (`a. Define and document the types of accounts allowed and specifically prohibited...`), with `[Assignment: organization-defined ...]` where the placeholders were, and its guidance is the real discussion (`Examples of system account types include individual, shared, group...`). `AC-02(01)`'s description is `Support the management of system accounts using [Assignment: organization-defined automated mechanisms].`

- [ ] **Step 5: Commit**

```bash
git add scripts/extract-800-53-oscal.py prisma/seeds/data/nist-800-53-r5-text.json
git commit -m "Extract the real NIST 800-53 control text from the official OSCAL catalog"
```

---

## Task 2: Seed the real text onto every 800-53 control

**Files:**
- Modify: `prisma/seeds/nist-800-53-r5.ts` (the `seedNist80053Controls` function at `:1245`, and the three `prisma.control.create` calls inside it)

**Interfaces:**
- Consumes: `prisma/seeds/data/nist-800-53-r5-text.json` from Task 1.
- Produces: nothing new; the existing `seedNist80053Controls(prisma, frameworkId, organizationId)` signature is unchanged.

**Why `fs` and not `import`:** `prisma/seeds/` is typechecked and `resolveJsonModule` is on, so `import text from "./data/....json"` would make `tsc` infer a type over ~2.5 MB of prose on every typecheck. Read it at runtime instead, and type it by hand.

- [ ] **Step 1: Load the text file at module scope**

At the top of `prisma/seeds/nist-800-53-r5.ts`, after the existing imports (`import type { PrismaClient } from '@prisma/client';` and `import { randomUUID } from 'crypto';`), add:

```ts
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * The real control statements and discussion, generated from NIST's official
 * OSCAL catalog by scripts/extract-800-53-oscal.py.
 *
 * Read at runtime rather than imported: prisma/seeds is typechecked and
 * resolveJsonModule is on, so importing ~2.5MB of prose would make tsc infer a
 * type over the whole blob on every build.
 */
interface ControlText {
  description: string;
  guidance: string | null;
}

const TEXT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'data',
  'nist-800-53-r5-text.json',
);

const CONTROL_TEXT = JSON.parse(
  readFileSync(TEXT_PATH, 'utf-8'),
) as Record<string, ControlText | undefined>;

/**
 * Fall back to the title if a control is somehow missing from the catalog —
 * a missing entry must not blank out a control, but it should be loud in the
 * seed log rather than silently shipping a title-as-description again.
 */
function textFor(controlId: string, title: string): ControlText {
  const entry = CONTROL_TEXT[controlId];
  if (!entry) {
    console.warn(`⚠️  no OSCAL text for ${controlId} — falling back to its title`);
    return { description: title, guidance: null };
  }
  return entry;
}
```

Note: this file is ESM (`"type": "module"`), so `__dirname` does not exist — `fileURLToPath(import.meta.url)` is the correct idiom.

- [ ] **Step 2: Use it in all three create calls**

In `seedNist80053Controls`:

Phase 1 (families, currently `description: family.description` at `:1259`):
```ts
    const text = textFor(family.controlId, family.title);
    await prisma.control.create({
      data: {
        id,
        organizationId,
        frameworkId,
        controlId: family.controlId,
        title: family.title,
        description: text.description,
        guidance: text.guidance,
        parentControlId: null,
        baselines: null,
        isActive: true,
        updatedAt: new Date(),
      },
    });
```

Phase 2 (base controls, currently `description: control.title` at `:1282`):
```ts
    const text = textFor(control.controlId, control.title);
    await prisma.control.create({
      data: {
        id,
        organizationId,
        frameworkId,
        controlId: control.controlId,
        title: control.title,
        description: text.description,
        guidance: text.guidance,
        parentControlId: familyUuid ?? null,
        baselines: control.baselines || null,
        isActive: true,
        updatedAt: new Date(),
      },
    });
```

Phase 3 (enhancements) — find the third `prisma.control.create` in this function and apply the same two changes: `description: text.description` and `guidance: text.guidance`, with `const text = textFor(control.controlId, control.title);` above it. **Read the actual code before editing; do not assume its variable names match Phase 2.**

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck 2>&1 | grep -c 'error TS'`
Expected: **225 or lower** (the pre-existing baseline).

Run: `npm run typecheck 2>&1 | grep 'error TS' | grep -vE 'src/__tests__|e2e/' | wc -l`
Expected: **0**.

- [ ] **Step 4: Backfill the existing database IN PLACE — never delete and re-seed**

**DO NOT delete the 800-53 controls and re-run the seed.** `ControlAssessmentScore.control` is `onDelete: Cascade` (`prisma/schema.prisma:4242`), so deleting a `Control` row **cascade-deletes every control score that references it**. Re-seeding mints new control UUIDs, so the existing NIST 800-53 compliance assessment — 1,216 score rows, including any real scoring work — would be silently destroyed. `RiskControlLink`, `FindingControlLink` and `ControlDomainControl` hang off `Control` too; check their `onDelete` before touching a `Control` row.

The seed change in Steps 1-2 is for **fresh installs**. Existing databases need an in-place `UPDATE` that preserves every control's UUID.

Extend `scripts/extract-800-53-oscal.py` (Task 1) to also emit a backfill script. The repo's convention for data migrations is `prisma/migrations-manual/YYYY-MM-DD-<slug>.sql` (see `2026-07-11-role-consolidation.sql`). Add this to the generator's `main()`, after it writes the JSON:

```python
    sql_dest = os.path.join(
        repo_root, "prisma", "migrations-manual", "2026-07-13-backfill-800-53-control-text.sql"
    )

    def q(value):
        """Postgres single-quoted literal."""
        if value is None:
            return "NULL"
        return "'" + value.replace("'", "''") + "'"

    with io.open(sql_dest, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("-- Backfill the real NIST 800-53 control text.\n")
        fh.write("--\n")
        fh.write("-- The seed was generated from NIST's CPRT *baselines* workbook, which carries\n")
        fh.write("-- no control text, so every control shipped with description = title and\n")
        fh.write("-- guidance = NULL. Generated by scripts/extract-800-53-oscal.py from the\n")
        fh.write("-- official OSCAL catalog.\n")
        fh.write("--\n")
        fh.write("-- UPDATE, never DELETE + re-seed: Control has onDelete: Cascade children\n")
        fh.write("-- (ControlAssessmentScore, RiskControlLink, FindingControlLink), so dropping a\n")
        fh.write("-- control would destroy live assessment scores.\n\n")
        fh.write("BEGIN;\n\n")
        for cid in sorted(out):
            entry = out[cid]
            fh.write(
                'UPDATE "Control" c SET description = %s, guidance = %s\n'
                '  FROM "Framework" f\n'
                '  WHERE f.id = c."frameworkId" AND f.code = \'NIST80053\' AND c."controlId" = %s;\n'
                % (q(entry["description"]), q(entry["guidance"]), q(cid))
            )
        fh.write("\nCOMMIT;\n")
    print("wrote %s" % sql_dest)
```

Re-run the generator (`python scripts/extract-800-53-oscal.py /tmp/800-53r5-catalog.json`), then apply the backfill to the dev database:

```bash
docker compose exec -T postgres psql -U postgres -d betterthanspreadsheetsGRC \
  < prisma/migrations-manual/2026-07-13-backfill-800-53-control-text.sql
```

It updates both orgs' copies of the framework (the `WHERE` matches on framework code, not id) and touches no other framework.

Then verify — **this is the acceptance check for the whole task**:

```bash
docker compose exec -T postgres psql -U postgres -d betterthanspreadsheetsGRC -c '
SELECT f.code,
       count(*) AS controls,
       count(*) FILTER (WHERE c.description IS DISTINCT FROM c.title) AS real_description,
       count(*) FILTER (WHERE c.guidance IS NOT NULL) AS with_guidance
FROM "Control" c JOIN "Framework" f ON f.id = c."frameworkId"
WHERE f.code = '"'"'NIST80053'"'"' GROUP BY f.code;'
```

Expected: `controls` **1216** (per org — there are two orgs, so the seed may report more overall), `real_description` close to 1216 (families legitimately keep title-as-description, so ~1196), and `with_guidance` in the high hundreds. **Before this change both of the last two columns were 0.** If `real_description` is 0, the seed did not pick up the JSON.

Also confirm no raw OSCAL syntax leaked to the database:
```bash
docker compose exec -T postgres psql -U postgres -d betterthanspreadsheetsGRC -c \
  'SELECT count(*) FROM "Control" WHERE description LIKE '"'"'%{{%'"'"' OR guidance LIKE '"'"'%{{%'"'"';'
```
Expected: `0`.

- [ ] **Step 5: Commit**

```bash
git add prisma/seeds/nist-800-53-r5.ts
git commit -m "Seed NIST 800-53 with its real control statements and discussion instead of repeating the title"
```

---

## Task 3: Render the full control hierarchy in a compliance assessment

**Files:**
- Create: `src/lib/compliance/control-tree.ts`
- Test: `src/__tests__/unit/control-tree.test.ts`
- Modify: `src/app/compliance/assessments/[id]/client.tsx` (the `controlGroups` memo at `:1011-1057`, `ControlGroupCard` at `:542`, and `ControlScoringItem` at `:284`)

**Interfaces:**
- Consumes: the `ControlScore` interface already declared at `src/app/compliance/assessments/[id]/client.tsx:121-137`. **Do not import it from the page** — the page is a client component; declare the shape structurally in the lib file so the helper stays pure and testable in a `node` environment.
- Produces:
  ```ts
  export interface ScoreNode<T> { score: T; depth: number; children: ScoreNode<T>[] }
  export interface ControlGroupTree<T> { parent: T; nodes: ScoreNode<T>[]; total: number }
  export function buildControlTree<T extends ControlLike>(scores: T[]): ControlGroupTree<T>[]
  export function flattenTree<T>(nodes: ScoreNode<T>[], expanded: ReadonlySet<string>): ScoreNode<T>[]
  ```

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/control-tree.test.ts`:

```ts
import { buildControlTree, flattenTree, type ScoreNode } from "@/lib/compliance/control-tree";

interface Score {
  id: string;
  control: { id: string; controlId: string; parentControlId: string | null };
}

const s = (id: string, controlId: string, parent: string | null): Score => ({
  id: `score-${id}`,
  control: { id, controlId, parentControlId: parent },
});

// NIST 800-53's real shape: family -> base control -> enhancement.
const AC = s("ac", "AC", null);
const AC01 = s("ac01", "AC-01", "ac");
const AC02 = s("ac02", "AC-02", "ac");
const AC02_1 = s("ac02-1", "AC-02(01)", "ac02");
const AC02_2 = s("ac02-2", "AC-02(02)", "ac02");
const AT = s("at", "AT", null);
const AT01 = s("at01", "AT-01", "at");

describe("buildControlTree", () => {
  it("nests enhancements under their base control instead of dropping them", () => {
    const groups = buildControlTree([AC, AC01, AC02, AC02_1, AC02_2]);

    expect(groups).toHaveLength(1);
    const ac = groups[0]!;
    expect(ac.parent.control.controlId).toBe("AC");
    expect(ac.nodes.map((n) => n.score.control.controlId)).toEqual(["AC-01", "AC-02"]);

    const ac02 = ac.nodes[1]!;
    expect(ac02.children.map((n) => n.score.control.controlId)).toEqual([
      "AC-02(01)",
      "AC-02(02)",
    ]);
  });

  it("counts every descendant, so the group denominator is not just its direct children", () => {
    // The old code said "0/25 controls" for AC when AC really has ~175.
    const groups = buildControlTree([AC, AC01, AC02, AC02_1, AC02_2]);
    expect(groups[0]!.total).toBe(4); // AC-01, AC-02, AC-02(01), AC-02(02)
  });

  it("assigns depth relative to the group, driving indentation", () => {
    const groups = buildControlTree([AC, AC01, AC02, AC02_1]);
    const ac = groups[0]!;
    expect(ac.nodes[0]!.depth).toBe(0);
    expect(ac.nodes[1]!.children[0]!.depth).toBe(1);
  });

  it("sorts siblings by controlId at every level", () => {
    const groups = buildControlTree([AC, AC02, AC01, AC02_2, AC02_1]);
    const ac = groups[0]!;
    expect(ac.nodes.map((n) => n.score.control.controlId)).toEqual(["AC-01", "AC-02"]);
    expect(ac.nodes[1]!.children.map((n) => n.score.control.controlId)).toEqual([
      "AC-02(01)",
      "AC-02(02)",
    ]);
  });

  it("sorts the groups themselves by controlId", () => {
    const groups = buildControlTree([AT, AT01, AC, AC01]);
    expect(groups.map((g) => g.parent.control.controlId)).toEqual(["AC", "AT"]);
  });

  it("gives a childless top-level control a group containing itself", () => {
    // Frameworks like ISO 27001 are flat — every control is top-level.
    const lone = s("iso1", "A.5.1", null);
    const groups = buildControlTree([lone]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.nodes.map((n) => n.score.control.controlId)).toEqual(["A.5.1"]);
    expect(groups[0]!.total).toBe(1);
  });

  it("does not drop a score whose parent is missing from the list", () => {
    // A filtered or partial score set must not silently lose rows.
    const orphan = s("x", "XX-01", "no-such-parent");
    const groups = buildControlTree([orphan]);
    expect(groups.flatMap((g) => g.nodes.map((n) => n.score.control.controlId))).toContain(
      "XX-01",
    );
  });
});

describe("flattenTree", () => {
  const tree: ScoreNode<Score>[] = [
    { score: AC01, depth: 0, children: [] },
    {
      score: AC02,
      depth: 0,
      children: [
        { score: AC02_1, depth: 1, children: [] },
        { score: AC02_2, depth: 1, children: [] },
      ],
    },
  ];

  it("hides children until their parent is expanded", () => {
    expect(flattenTree(tree, new Set()).map((n) => n.score.control.controlId)).toEqual([
      "AC-01",
      "AC-02",
    ]);
  });

  it("reveals the enhancements of an expanded base control, in order", () => {
    expect(flattenTree(tree, new Set(["ac02"])).map((n) => n.score.control.controlId)).toEqual([
      "AC-01",
      "AC-02",
      "AC-02(01)",
      "AC-02(02)",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/__tests__/unit/control-tree.test.ts`
Expected: FAIL — `Cannot find module '@/lib/compliance/control-tree'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/compliance/control-tree.ts`:

```ts
/**
 * Group a flat list of control scores into a tree.
 *
 * NIST 800-53 is three levels deep — family (AC) -> base control (AC-02) ->
 * enhancement (AC-02(01)) — but the assessment page used to bucket scores by
 * parent and then read only the children of top-level controls. An
 * enhancement's parent is a base control, which is itself a child, so all 872
 * enhancements were silently discarded: scored in the database, invisible in
 * the UI. This builds the real tree, at whatever depth the framework has.
 */

export interface ControlLike {
  control: {
    id: string;
    controlId: string;
    parentControlId: string | null;
  };
}

export interface ScoreNode<T> {
  score: T;
  /** 0 for a group's immediate members. Drives indentation. */
  depth: number;
  children: ScoreNode<T>[];
}

export interface ControlGroupTree<T> {
  /** The top-level control the group is named after (the family). */
  parent: T;
  /** Its members, nested. */
  nodes: ScoreNode<T>[];
  /** Every descendant, at any depth — the honest denominator. */
  total: number;
}

const byControlId = <T extends ControlLike>(a: ScoreNode<T>, b: ScoreNode<T>) =>
  a.score.control.controlId.localeCompare(b.score.control.controlId);

export function buildControlTree<T extends ControlLike>(scores: T[]): ControlGroupTree<T>[] {
  const byParent = new Map<string, T[]>();
  const roots: T[] = [];
  const known = new Set(scores.map((s) => s.control.id));

  for (const score of scores) {
    const parentId = score.control.parentControlId;
    // A score whose parent is not in this list is treated as a root rather than
    // dropped — a partial or filtered set must never lose rows.
    if (parentId === null || !known.has(parentId)) {
      roots.push(score);
      continue;
    }
    const bucket = byParent.get(parentId);
    if (bucket) bucket.push(score);
    else byParent.set(parentId, [score]);
  }

  const build = (score: T, depth: number): ScoreNode<T> => ({
    score,
    depth,
    children: (byParent.get(score.control.id) ?? [])
      .map((child) => build(child, depth + 1))
      .sort(byControlId),
  });

  const count = (node: ScoreNode<T>): number =>
    1 + node.children.reduce((sum, child) => sum + count(child), 0);

  return roots
    .map((root) => {
      const children = (byParent.get(root.control.id) ?? [])
        .map((child) => build(child, 0))
        .sort(byControlId);

      // A childless top-level control (ISO 27001, NIST CSF) is its own member,
      // so every framework renders through the same shape.
      const nodes =
        children.length > 0 ? children : [{ score: root, depth: 0, children: [] }];

      return {
        parent: root,
        nodes,
        total: nodes.reduce((sum, node) => sum + count(node), 0),
      };
    })
    .sort((a, b) => a.parent.control.controlId.localeCompare(b.parent.control.controlId));
}

/** Depth-first list of the rows to draw, honouring `expanded` (keyed by control id). */
export function flattenTree<T extends ControlLike>(
  nodes: ScoreNode<T>[],
  expanded: ReadonlySet<string>,
): ScoreNode<T>[] {
  const out: ScoreNode<T>[] = [];
  const visit = (node: ScoreNode<T>) => {
    out.push(node);
    if (!expanded.has(node.score.control.id)) return;
    for (const child of node.children) visit(child);
  };
  for (const node of nodes) visit(node);
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/__tests__/unit/control-tree.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Wire the assessment page onto it**

In `src/app/compliance/assessments/[id]/client.tsx`:

Add the import alongside the existing ones:
```tsx
import { buildControlTree, flattenTree, type ScoreNode } from "@/lib/compliance/control-tree";
```

Replace the whole `controlGroups` memo (`:1011-1057`) with:
```tsx
  // Group controls into a real tree. 800-53 is three levels deep (family ->
  // base control -> enhancement); the old two-level grouping dropped all 872
  // enhancements on the floor.
  const controlGroups = useMemo(
    () => buildControlTree(assessment?.controlScores ?? []),
    [assessment?.controlScores],
  );
```

The `ControlGroup` interface at `:139-147` is now dead — delete it, and change `ControlGroupCard`'s prop type from `group: ControlGroup` to `group: ControlGroupTree<ControlScore>` (import the type: `import { ..., type ControlGroupTree } from "@/lib/compliance/control-tree";`).

Inside `ControlGroupCard`:
- It currently reads `group.children` (a flat `ControlScore[]`). It must now own an `expanded` set for the nested rows:
  ```tsx
  const [expandedControls, setExpandedControls] = useState<Set<string>>(new Set());
  const visibleRows = flattenTree(group.nodes, expandedControls);
  ```
- `calculateGroupCompliance(group.children)` must be fed every descendant, not just the top row. Add a helper next to the component and use it:
  ```tsx
  /** Every score in the group, at any depth — a base control AND its enhancements. */
  function allScores(nodes: ScoreNode<ControlScore>[]): ControlScore[] {
    return nodes.flatMap((node) => [node.score, ...allScores(node.children)]);
  }
  ```
  then `const stats = calculateGroupCompliance(allScores(group.nodes));`. This is what fixes the lying `0/25 controls` denominator — it becomes `0/175`.
- Render `visibleRows` instead of `group.children`, passing each row's `depth` and expansion state down:
  ```tsx
  {visibleRows.map((node) => (
    <ControlScoringItem
      key={node.score.id}
      score={node.score}
      depth={node.depth}
      hasChildren={node.children.length > 0}
      isExpanded={expandedControls.has(node.score.control.id)}
      onToggleExpand={() =>
        setExpandedControls((prev) => {
          const next = new Set(prev);
          const id = node.score.control.id;
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        })
      }
      assessmentId={assessmentId}
      onUpdate={onUpdate}
      isSaving={isSaving}
      isEditable={isEditable}
      onCreateFinding={onCreateFinding ? () => onCreateFinding(node.score) : undefined}
    />
  ))}
  ```

In `ControlScoringItem` (`:284`), add the three new props to its signature:
```tsx
  depth,
  hasChildren,
  isExpanded,
  onToggleExpand,
}: {
  score: ControlScore;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  assessmentId: string;
  onUpdate: (controlId: string, status: ComplianceStatus, notes?: string | null) => void;
  isSaving: boolean;
  isEditable: boolean;
  onCreateFinding?: () => void;
}) {
```
Indent the row by depth and give a control with enhancements a real expand button. Put this at the start of the item's outermost row, before the control-id badge:
```tsx
      <div style={{ paddingLeft: `${depth * 1.5}rem` }} className="flex items-center gap-2">
        {hasChildren ? (
          <button
            type="button"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${score.control.controlId}`}
            aria-expanded={isExpanded}
            onClick={onToggleExpand}
            className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        {/* existing control-id badge and title follow, unchanged */}
      </div>
```
`ChevronDown` and `ChevronRight` are already imported in this file — confirm before adding an import.

The status filter (`:1062-1069`) filters `group.children`; repoint it at the tree. Filter with `allScores(group.nodes)` so a matching enhancement keeps its group visible, and let the tree render unfiltered inside an expanded group. **Read the existing filter code and adapt it — do not delete the feature.**

- [ ] **Step 6: Typecheck and unit tests**

Run: `npm run typecheck 2>&1 | grep -c 'error TS'` → **225 or lower**.
Run: `npm run typecheck 2>&1 | grep 'error TS' | grep -vE 'src/__tests__|e2e/' | wc -l` → **0**.
Run: `npx jest src/__tests__/unit/` → no new failures (17 pre-existing).

- [ ] **Step 7: Verify in the running app**

Rebuild first — **the Docker app does not hot-reload**:
```bash
docker compose up -d --build app
```
Then open `http://localhost/compliance/assessments/cmrjrw3x4000g01mmlvdozzpu` (the NIST 800-53 assessment), log in as `admin@acme-corp.com` / `Admin123!@#`, click the **Controls** tab, and confirm:
1. Expanding the `AC` group shows `AC-01` … `AC-25`, and `AC-02` now has an **expand chevron**.
2. Expanding `AC-02` reveals `AC-02(01)` … `AC-02(13)`, indented.
3. Each enhancement can be **scored** — set one to Compliant and confirm it saves (a sonner toast, and the value survives a reload).
4. The group header no longer says `0/25 controls` — the denominator now counts every descendant.
5. Every control shows real description text (from Task 2), not its own title repeated.
6. No regression on a **flat** framework: open an ISO 27001 assessment and confirm its controls still render.

Take screenshots. **Do not claim this works without observing it.**

- [ ] **Step 8: Commit**

```bash
git add src/lib/compliance/control-tree.ts src/__tests__/unit/control-tree.test.ts "src/app/compliance/assessments/[id]/client.tsx"
git commit -m "Render every level of a framework in a compliance assessment so 800-53's control enhancements can be scored"
```

---

## Task 4: A parent row expands; only a leaf opens the detail modal

**Files:**
- Modify: `src/app/admin/frameworks/[id]/client.tsx` (the `onRowClick` passed to `FrameworkNodeTable`)

**Interfaces:**
- Consumes: `FrameworkNodeTable` from `@/components/frameworks/FrameworkNodeTable` and `FrameworkNode` from `@/lib/frameworks/framework-node` (both already used by this page). `FrameworkNode.childCount` is the number of children a node has, **even when they are not loaded**.
- Produces: nothing new.

**The bug:** every row is clickable and opens `ControlDetailModal`. For a parent (`AC`, 25 sub-controls) the modal is the control's title, a description, and a scrolling list of its sub-controls — which is exactly what the row's chevron already expands inline. Two routes to the same list, one of them useless.

- [ ] **Step 1: Route the click by whether the row has children**

Find the `onRowClick` prop on `<FrameworkNodeTable>` in this file. It currently reads:
```tsx
                onRowClick={(node) => setSelectedControlId(node.id)}
```
Replace it with:
```tsx
                // A parent row expands — its detail modal would only re-list the
                // children the chevron already shows. Only a leaf opens the modal.
                onRowClick={(node) =>
                  node.childCount > 0
                    ? handleToggleExpand(node)
                    : setSelectedControlId(node.id)
                }
```
`handleToggleExpand` already exists in this file (it is the same handler passed to `onToggleExpand`). Confirm its exact name before using it.

Note the actions dropdown on each row still has a **View Details** item that calls `setSelectedControlId(node.id)` directly — leave it. That is the deliberate escape hatch for someone who genuinely wants a parent's detail, and it does not conflict with the row click.

Note also: in **flat** mode (an active search or health filter) `FrameworkNodeTable` suppresses chevrons entirely, so a parent row there cannot expand. Guard for it, so a search result is never a dead click:
```tsx
                onRowClick={(node) =>
                  !isSearching && !isFiltering && node.childCount > 0
                    ? handleToggleExpand(node)
                    : setSelectedControlId(node.id)
                }
```
`isSearching` and `isFiltering` already exist in this file. Use this second version.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck 2>&1 | grep -c 'error TS'` → **225 or lower**.
Run: `npm run typecheck 2>&1 | grep 'error TS' | grep -vE 'src/__tests__|e2e/' | wc -l` → **0**.

- [ ] **Step 3: Verify in the running app**

Rebuild (`docker compose up -d --build app`), then open `http://localhost/admin/frameworks/550e8400-e29b-41d4-a716-446655440072` (NIST 800-53) and confirm:
1. Clicking anywhere on the `AC` row **expands it** — no modal.
2. Clicking it again collapses it.
3. Expanding to a leaf (`AC-01`, which has no children) and clicking it **does** open `ControlDetailModal`, now showing the real statement text from Task 2.
4. The **Actions → View Details** item still opens the modal for a parent.
5. With a search active, clicking a parent row opens the modal (there is no chevron to toggle in flat mode) — not a dead click.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/frameworks/[id]/client.tsx"
git commit -m "Expand a control family on row click instead of opening a modal that re-lists its children"
```

---

## Task 5: End-to-end coverage for the recovered enhancements

**Files:**
- Create: `e2e/assessment-hierarchy.spec.ts`

**Interfaces:**
- Consumes: `login`, `USERS` from `e2e/support/helpers.ts`.
- Produces: nothing.

Read `e2e/support/helpers.ts` first — auth is a **form-login helper** (`login(page, USERS.admin)`), not `storageState`. This spec must be **read-only** (create nothing, mutate nothing) so it is re-runnable. Specs are `*.spec.ts` in `e2e/`; run with `PW_BASE_URL=http://127.0.0.1` because the app is on port 80.

- [ ] **Step 1: Write the spec**

Create `e2e/assessment-hierarchy.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { login, USERS } from "./support/helpers";

const ASSESSMENT_URL = "/compliance/assessments/cmrjrw3x4000g01mmlvdozzpu";

test.describe("A compliance assessment exposes every level of the framework", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, USERS.admin);
  });

  test("NIST 800-53 control enhancements are reachable and not silently dropped", async ({
    page,
  }) => {
    await page.goto(ASSESSMENT_URL);
    await page.getByRole("tab", { name: "Controls" }).click();

    // Open the Access Control family.
    await page.getByText("Access Control", { exact: true }).first().click();

    // Its base controls are visible; the enhancements are not, until AC-02 opens.
    await expect(page.getByText("AC-02", { exact: true })).toBeVisible();
    await expect(page.getByText("AC-02(01)", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Expand AC-02" }).click();

    // This is the regression: all 872 enhancements used to be dropped entirely.
    await expect(page.getByText("AC-02(01)", { exact: true })).toBeVisible();
    await expect(page.getByText("AC-02(13)", { exact: true })).toBeVisible();
  });

  test("the group denominator counts every descendant, not just direct children", async ({
    page,
  }) => {
    await page.goto(ASSESSMENT_URL);
    await page.getByRole("tab", { name: "Controls" }).click();

    // The old code rendered "0/25 controls" for AC, whose real total is ~175.
    await expect(page.getByText(/\/\s*25 controls/)).toHaveCount(0);
  });

  test("controls carry their real NIST statement, not a copy of their title", async ({
    page,
  }) => {
    await page.goto(ASSESSMENT_URL);
    await page.getByRole("tab", { name: "Controls" }).click();
    await page.getByText("Access Control", { exact: true }).first().click();

    // AC-02's real statement opens with its lettered account-management clause.
    await expect(
      page.getByText(/Define and document the types of accounts allowed/i).first(),
    ).toBeVisible();
  });
});
```

If the group header or the tab is not reachable by these selectors, **fix the selectors against the real DOM** — do not weaken the assertions.

- [ ] **Step 2: Run it**

Run: `docker compose up -d --build app` (if not already rebuilt), then:
Run: `PW_BASE_URL=http://127.0.0.1 npx playwright test e2e/assessment-hierarchy.spec.ts`
Expected: 3 passed.

- [ ] **Step 3: Prove each assertion can fail**

For each of the three tests, confirm it is a real guard — e.g. point the enhancement assertion at a code that does not exist, or invert the "not visible" expectation — observe the failure, and revert. Report the mutation you used for each. **A green test that cannot fail is worse than no test.**

- [ ] **Step 4: Commit**

```bash
git add e2e/assessment-hierarchy.spec.ts
git commit -m "Cover the assessment control hierarchy with end-to-end tests"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full suites**

Run: `npx jest src/__tests__/unit/` — no new failures beyond the 17 pre-existing in `matrix-builder-autosave` and `compliance-plan-detail`.
Run: `PW_BASE_URL=http://127.0.0.1 npx playwright test e2e/framework-hierarchy.spec.ts e2e/assessment-hierarchy.spec.ts` — all pass.
Run: `PW_BASE_URL=http://127.0.0.1 npm run test:smoke` — 71 pass (the existing baseline). Any new failure is collateral damage from this work.

- [ ] **Step 2: Typecheck against the baseline**

Run: `npm run typecheck 2>&1 | grep -c 'error TS'` → **225 or lower**.
Run: `npm run typecheck 2>&1 | grep 'error TS' | grep -vE 'src/__tests__|e2e/' | wc -l` → **0**.

- [ ] **Step 3: Confirm the data claim end to end**

Run the coverage query from Task 2 Step 4 one more time and paste the result. `real_description` and `with_guidance` for `NIST80053` must both be far above zero — they were both **0** before this work.

- [ ] **Step 4: Smoke the affected pages**

In the rebuilt Docker app: the 800-53 framework page (row click expands a family, a leaf opens the modal with real text), the 800-53 assessment (enhancements visible, scoreable, honest denominator), an ISO 27001 assessment (flat framework, no regression), and the 800-171 framework page (no regression from the previous branch).

---

## Out of Scope (deliberately)

- **The Executive Summary tab of the assessment renders all 1,216 controls in one flat list — a 51,761-pixel page.** Real, ugly, and a separate concern from the Controls tab. Worth its own ticket.
- Re-generating **ISO 27001** and **NIST CSF** guidance (both have descriptions but zero guidance). Only 800-53 was reported.
- The `baselines` column (LOW/MODERATE/HIGH) is already seeded correctly from the CPRT workbook and is untouched here — the OSCAL catalog is used **only** for `description` and `guidance`.
