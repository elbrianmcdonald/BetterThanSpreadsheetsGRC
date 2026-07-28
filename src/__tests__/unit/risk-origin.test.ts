/**
 * Unit tests for resolveRiskOrigin — resolves the assessment a risk was
 * "Identified in" from the origin relations loaded on the risk, into a single
 * { label, href } used by the risk detail Overview.
 *
 * A risk carries several mutually-tracked origin FKs; only some are ever
 * populated. The resolver picks the right one, builds the right route, and
 * MUST ignore the vestigial Risk.assessmentId relation (never set on create).
 */

import { resolveRiskOrigin } from "@/lib/risk/origin";

describe("resolveRiskOrigin", () => {
  it("returns null when no origin relation is set (manual / imported risk)", () => {
    expect(resolveRiskOrigin({})).toBeNull();
  });

  it("resolves a RiskAssessmentProject origin (the primary path)", () => {
    expect(
      resolveRiskOrigin({
        DiscoveryProject: { id: "proj_1", subject: "AWS Migration Review" },
      })
    ).toEqual({
      label: "AWS Migration Review",
      href: "/risk-assessments/proj_1",
    });
  });

  it("falls back to a generic label when a project has no subject", () => {
    expect(
      resolveRiskOrigin({
        DiscoveryProject: { id: "proj_2", subject: null },
      })
    ).toEqual({
      label: "Risk assessment",
      href: "/risk-assessments/proj_2",
    });
  });

  it("resolves a ComplianceAssessment origin with identifier and name", () => {
    expect(
      resolveRiskOrigin({
        sourceComplianceAssessment: {
          id: "comp_1",
          identifier: "COMP-2026-0007",
          name: "SOC 2 Type II",
        },
      })
    ).toEqual({
      label: "COMP-2026-0007 — SOC 2 Type II",
      href: "/compliance/assessments/comp_1",
    });
  });

  it("resolves a VendorAssessment origin with identifier and title", () => {
    expect(
      resolveRiskOrigin({
        VendorAssessment: {
          id: "vend_1",
          identifier: "VA-2026-0003",
          title: "Acme Cloud DPA Review",
        },
      })
    ).toEqual({
      label: "VA-2026-0003 — Acme Cloud DPA Review",
      href: "/tprm/assessments/vend_1",
    });
  });

  it("routes a question-sourced risk to its parent project, labelled by the verbatim question number (a control refcode, not an integer)", () => {
    expect(
      resolveRiskOrigin({
        DiscoveryProject: { id: "proj_3", subject: "PCI Scoping" },
        SourceRiskAssessmentQuestion: {
          id: "q_1",
          number: "PR.DS-1",
          text: "Are cardholder data stores encrypted at rest?",
        },
      })
    ).toEqual({
      label: "PCI Scoping — PR.DS-1",
      href: "/risk-assessments/proj_3",
    });
  });

  it("labels a question with no parent project by its number alone (no route)", () => {
    expect(
      resolveRiskOrigin({
        SourceRiskAssessmentQuestion: { id: "q_2", number: "ID.RA-1", text: "..." },
      })
    ).toEqual({
      label: "ID.RA-1",
      href: null,
    });
  });

  it("IGNORES the vestigial Risk.assessmentId (RiskAssessment) relation", () => {
    // `Assessment` is never populated on create; if it ever appears it must not
    // produce a link — there is no route that loads a RiskAssessment by id.
    expect(
      resolveRiskOrigin({
        // @ts-expect-error — deliberately passing the field the resolver must ignore
        Assessment: { id: "ra_1", identifier: "RSK-2026-0001", title: "Legacy" },
      })
    ).toBeNull();
  });
});
