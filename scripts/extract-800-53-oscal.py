"""
Generate prisma/seeds/data/nist-800-53-r5-text.json from NIST's OSCAL catalog.

The existing 800-53 seed came from NIST's CPRT *baselines* workbook, which
carries no control text, so every control's description was a copy of its title
and its guidance was null. This pulls the real statement and discussion out of
the official catalog.

Also emits prisma/migrations-manual/2026-07-13-backfill-800-53-control-text.sql:
an in-place UPDATE per control. Controls are never deleted and re-seeded —
ControlAssessmentScore.control is onDelete: Cascade, so dropping the rows would
take every live control score with it.

Usage:
    python scripts/extract-800-53-oscal.py <path-to-catalog.json>
"""
import io
import json
import os
import re
import sys

PLACEHOLDER = re.compile(r"\{\{\s*insert:\s*param,\s*([^}\s]+)\s*\}\}")

# The Framework.code the 800-53 catalog is seeded under (prisma/seed.ts).
FRAMEWORK_CODE = "NIST80053"


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


GENERIC_ASSIGNMENT = "[Assignment: organization-defined value]"

# NIST's legacy `_prm_` params bake "organization-defined " into the label itself,
# while the newer `_odp` params do not. Rendering both through the same
# "organization-defined %s" template doubled the prefix on 141 occurrences across
# 111 controls (AC-01 included). Strip any prefix the label already carries so the
# two generations render identically.
ORG_DEFINED_PREFIX = re.compile(r"^\s*organization-defined\s+", re.IGNORECASE)


def render_param(param, params, seen=frozenset()):
    """NIST's own print convention: an ODP renders as an Assignment or a Selection."""
    select = param.get("select")
    if select:
        # A choice can itself embed a placeholder, so resolve it before joining.
        choices = "; ".join(
            resolve(c, params, seen).strip() for c in select.get("choice", [])
        )
        how_many = select.get("how-many")
        qualifier = " (one or more)" if how_many == "one-or-more" else ""
        return "[Selection%s: %s]" % (qualifier, choices)
    label = param.get("label") or param.get("id")
    return "[Assignment: organization-defined %s]" % ORG_DEFINED_PREFIX.sub("", label)


def resolve(prose, params, seen=frozenset()):
    if not prose:
        return ""

    def sub(match):
        pid = match.group(1)
        param = params.get(pid)
        # A select choice can embed a placeholder, so resolve() and render_param()
        # are mutually recursive. Today's catalog is acyclic, but a future revision
        # with a self- or A->B->A-referencing param would recurse to RecursionError.
        # Re-entering a param already on the stack degrades to the generic Assignment.
        if not param or pid in seen:
            # An unresolved placeholder must never reach the UI as raw OSCAL syntax.
            return GENERIC_ASSIGNMENT
        return render_param(param, params, seen | {pid})

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


def sql_literal(value):
    """Postgres string literal. NIST prose is full of apostrophes — double them."""
    if value is None:
        return "NULL"
    return "'%s'" % value.replace("'", "''")


def write_backfill_sql(out, dest):
    """One in-place UPDATE per control. No DELETE — see the module docstring."""
    lines = [
        "-- Backfill the real NIST SP 800-53 Rev 5 control text.",
        "-- Generated by scripts/extract-800-53-oscal.py — do not edit by hand.",
        "--",
        "-- Updates in place and matches on (Framework.code, Control.controlId) so it",
        "-- applies to every organization's copy of the framework. It never deletes a",
        "-- Control: ControlAssessmentScore.control is onDelete: Cascade, so a",
        "-- delete-and-reseed would destroy every live control score.",
        "",
        "-- The prose carries typographic apostrophes and an em-dash. Without this,",
        "-- psql can inherit client_encoding from a cp1252 console and mojibake it.",
        "SET client_encoding = 'UTF8';",
        "",
        "BEGIN;",
        "",
    ]
    for cid in sorted(out):
        entry = out[cid]
        lines.append(
            'UPDATE "Control" c SET "description" = %s, "guidance" = %s, "updatedAt" = NOW() '
            'FROM "Framework" f '
            'WHERE c."frameworkId" = f."id" AND f."code" = %s AND c."controlId" = %s;'
            % (
                sql_literal(entry["description"]),
                sql_literal(entry["guidance"]),
                sql_literal(FRAMEWORK_CODE),
                sql_literal(cid),
            )
        )
    # A zero-row UPDATE succeeds silently. If the OSCAL->repo id mapping were ever
    # wrong, an operator would see a clean COMMIT over an untouched database. Fail loud —
    # but only where there was something to update. A database that simply has no 800-53
    # framework (a tenant that never activated it) is not broken, and raising there means
    # an operator running the migrations-manual folder gets a scary "the mapping is wrong"
    # on a database where nothing is wrong.
    lines.extend(
        [
            "",
            "DO $$ DECLARE controls int; with_text int; BEGIN",
            '  SELECT count(*) INTO controls FROM "Control" c JOIN "Framework" f ON c."frameworkId" = f."id"',
            '   WHERE f."code" = %s;' % sql_literal(FRAMEWORK_CODE),
            '  SELECT count(*) INTO with_text FROM "Control" c JOIN "Framework" f ON c."frameworkId" = f."id"',
            '   WHERE f."code" = %s AND c."guidance" IS NOT NULL;' % sql_literal(FRAMEWORK_CODE),
            "  IF controls = 0 THEN",
            "    RAISE NOTICE 'No NIST 800-53 framework in this database — nothing to backfill.';",
            "  ELSIF with_text = 0 THEN",
            "    RAISE EXCEPTION 'NIST 800-53 text backfill matched no rows "
            "— the control-id mapping is wrong';",
            "  END IF;",
            "END $$;",
            "",
            "COMMIT;",
            "",
        ]
    )

    with io.open(dest, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(lines))


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

    # The JSON is seed input loaded at runtime, so it lives in seeds/data/. The SQL is
    # a one-shot data migration, so it follows the repo's migrations-manual convention.
    sql_dir = os.path.join(repo_root, "prisma", "migrations-manual")
    os.makedirs(sql_dir, exist_ok=True)
    sql_dest = os.path.join(sql_dir, "2026-07-13-backfill-800-53-control-text.sql")
    write_backfill_sql(out, sql_dest)

    families = sum(1 for k in out if "-" not in k)
    enhancements = sum(1 for k in out if "(" in k)
    base = len(out) - families - enhancements
    print("wrote %s" % dest)
    print("wrote %s" % sql_dest)
    print("families=%d base=%d enhancements=%d total=%d" % (families, base, enhancements, len(out)))
    unresolved = sum(1 for v in out.values() if "{{" in (v["description"] or "") or "{{" in (v["guidance"] or ""))
    print("controls still containing an unresolved placeholder: %d" % unresolved)


if __name__ == "__main__":
    main()
