/**
 * Framework Template Index
 *
 * Story 12.5: Pre-built templates for common compliance frameworks
 */

import nistCsf20 from "./nist-csf-2.0.json";
import soc2Type2 from "./soc2-type2.json";

export interface FrameworkTemplate {
  code: string;
  name: string;
  version: string;
  description: string;
  source: string;
  lastUpdated: string;
  controlCount: number;
  controls: {
    controlId: string;
    title: string;
    description: string;
    guidance?: string;
    parentControlId: string | null;
    domains: string[];
  }[];
}

export interface TemplateMetadata {
  code: string;
  name: string;
  version: string;
  description: string;
  controlCount: number;
  lastUpdated: string;
}

// All available templates
export const frameworkTemplates: Record<string, FrameworkTemplate> = {
  "NIST-CSF-2.0": nistCsf20 as FrameworkTemplate,
  "SOC2-TYPE2": soc2Type2 as FrameworkTemplate,
};

// Get template metadata for UI display (without full control arrays)
export function getTemplateMetadata(): TemplateMetadata[] {
  return Object.values(frameworkTemplates).map((t) => ({
    code: t.code,
    name: t.name,
    version: t.version,
    description: t.description,
    controlCount: t.controlCount,
    lastUpdated: t.lastUpdated,
  }));
}

// Get a specific template by code
export function getTemplate(code: string): FrameworkTemplate | undefined {
  return frameworkTemplates[code];
}

// Get template preview (first 10 controls)
export function getTemplatePreview(
  code: string
): { controls: FrameworkTemplate["controls"]; total: number } | undefined {
  const template = frameworkTemplates[code];
  if (!template) return undefined;
  return {
    controls: template.controls.slice(0, 10),
    total: template.controls.length,
  };
}
