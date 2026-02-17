/**
 * OSCAL (Open Security Controls Assessment Language) Type Definitions
 *
 * These types represent the structure of OSCAL catalogs as defined by NIST.
 * They support parsing OSCAL 1.0+ JSON and YAML catalogs.
 *
 * @see https://pages.nist.gov/OSCAL/reference/latest/catalog/
 * @module types/oscal
 */

/**
 * OSCAL Document Root - The top-level structure of an OSCAL catalog file
 */
export interface OscalDocument {
  catalog: OscalCatalog;
}

/**
 * OSCAL Catalog - Contains metadata, groups, and controls
 */
export interface OscalCatalog {
  uuid: string;
  metadata: OscalMetadata;
  groups?: OscalGroup[];
  controls?: OscalControl[];
  "back-matter"?: OscalBackMatter;
}

/**
 * OSCAL Metadata - Information about the catalog itself
 */
export interface OscalMetadata {
  title: string;
  "last-modified"?: string;
  version?: string;
  "oscal-version"?: string;
  published?: string;
  remarks?: string;
  links?: OscalLink[];
  roles?: OscalRole[];
  parties?: OscalParty[];
  props?: OscalProperty[];
  "responsible-parties"?: OscalResponsibleParty[];
  revisions?: OscalRevision[];
}

/**
 * OSCAL Group - A collection of related controls
 */
export interface OscalGroup {
  id: string;
  class?: string;
  title: string;
  props?: OscalProperty[];
  parts?: OscalPart[];
  groups?: OscalGroup[];
  controls?: OscalControl[];
}

/**
 * OSCAL Control - A security control definition
 */
export interface OscalControl {
  id: string;
  class?: string;
  title: string;
  params?: OscalParameter[];
  props?: OscalProperty[];
  links?: OscalLink[];
  parts?: OscalPart[];
  controls?: OscalControl[];
}

/**
 * OSCAL Parameter - A variable that can be substituted in control prose
 */
export interface OscalParameter {
  id: string;
  class?: string;
  "depends-on"?: string;
  label?: string;
  usage?: string;
  constraints?: OscalConstraint[];
  guidelines?: OscalGuideline[];
  values?: string[];
  select?: OscalSelection;
  props?: OscalProperty[];
  links?: OscalLink[];
  remarks?: string;
}

/**
 * OSCAL Property - Name/value metadata attached to various OSCAL elements
 */
export interface OscalProperty {
  name: string;
  uuid?: string;
  ns?: string;
  value: string;
  class?: string;
  remarks?: string;
}

/**
 * OSCAL Link - A reference to an external resource
 */
export interface OscalLink {
  href: string;
  rel?: string;
  "media-type"?: string;
  text?: string;
}

/**
 * OSCAL Part - A section of prose within a control
 */
export interface OscalPart {
  id?: string;
  name: string;
  ns?: string;
  class?: string;
  title?: string;
  props?: OscalProperty[];
  prose?: string;
  parts?: OscalPart[];
  links?: OscalLink[];
}

/**
 * OSCAL Constraint - Limits on parameter values
 */
export interface OscalConstraint {
  description?: string;
  tests?: OscalTest[];
}

/**
 * OSCAL Test - A test expression for constraint validation
 */
export interface OscalTest {
  expression: string;
  remarks?: string;
}

/**
 * OSCAL Guideline - Guidance for selecting parameter values
 */
export interface OscalGuideline {
  prose: string;
}

/**
 * OSCAL Selection - Options for selecting parameter values
 */
export interface OscalSelection {
  "how-many"?: "one" | "one-or-more";
  choice?: string[];
}

/**
 * OSCAL Role - A function or position in an organization
 */
export interface OscalRole {
  id: string;
  title: string;
  "short-name"?: string;
  description?: string;
  props?: OscalProperty[];
  links?: OscalLink[];
  remarks?: string;
}

/**
 * OSCAL Party - An individual or organization
 */
export interface OscalParty {
  uuid: string;
  type: "person" | "organization";
  name?: string;
  "short-name"?: string;
  "external-ids"?: OscalExternalId[];
  props?: OscalProperty[];
  links?: OscalLink[];
  "email-addresses"?: string[];
  "telephone-numbers"?: OscalTelephoneNumber[];
  addresses?: OscalAddress[];
  "location-uuids"?: string[];
  "member-of-organizations"?: string[];
  remarks?: string;
}

/**
 * OSCAL External ID - An identifier from an external system
 */
export interface OscalExternalId {
  scheme: string;
  id: string;
}

/**
 * OSCAL Telephone Number
 */
export interface OscalTelephoneNumber {
  type?: string;
  number: string;
}

/**
 * OSCAL Address
 */
export interface OscalAddress {
  type?: string;
  "addr-lines"?: string[];
  city?: string;
  state?: string;
  "postal-code"?: string;
  country?: string;
}

/**
 * OSCAL Responsible Party - A party responsible for a role
 */
export interface OscalResponsibleParty {
  "role-id": string;
  "party-uuids": string[];
  props?: OscalProperty[];
  links?: OscalLink[];
  remarks?: string;
}

/**
 * OSCAL Revision - A historical version of the document
 */
export interface OscalRevision {
  title?: string;
  published?: string;
  "last-modified"?: string;
  version?: string;
  "oscal-version"?: string;
  props?: OscalProperty[];
  links?: OscalLink[];
  remarks?: string;
}

/**
 * OSCAL Back Matter - Supporting information at the end of the document
 */
export interface OscalBackMatter {
  resources?: OscalResource[];
}

/**
 * OSCAL Resource - A supporting resource referenced in the document
 */
export interface OscalResource {
  uuid: string;
  title?: string;
  description?: string;
  props?: OscalProperty[];
  "document-ids"?: OscalDocumentId[];
  citation?: OscalCitation;
  rlinks?: OscalResourceLink[];
  "base64"?: OscalBase64;
  remarks?: string;
}

/**
 * OSCAL Document ID
 */
export interface OscalDocumentId {
  scheme?: string;
  identifier: string;
}

/**
 * OSCAL Citation
 */
export interface OscalCitation {
  text: string;
  props?: OscalProperty[];
  links?: OscalLink[];
}

/**
 * OSCAL Resource Link
 */
export interface OscalResourceLink {
  href: string;
  "media-type"?: string;
  hashes?: OscalHash[];
}

/**
 * OSCAL Hash
 */
export interface OscalHash {
  algorithm: string;
  value: string;
}

/**
 * OSCAL Base64 encoded content
 */
export interface OscalBase64 {
  filename?: string;
  "media-type"?: string;
  value: string;
}

// ============================================================================
// Parsed/Normalized Types for Internal Use
// ============================================================================

/**
 * Parsed framework metadata extracted from OSCAL catalog
 */
export interface ParsedFrameworkMetadata {
  uuid: string;
  title: string;
  version: string;
  oscalVersion?: string;
  published?: Date;
  lastModified?: Date;
  description?: string;
  sourceUrl?: string;
}

/**
 * Parsed control extracted from OSCAL catalog
 * Flattened structure for database storage
 */
export interface ParsedControl {
  controlId: string;
  title: string;
  description: string;
  guidance?: string;
  parentControlId?: string;
  class?: string;
  groupId?: string;
  groupTitle?: string;
}

/**
 * Result of parsing an OSCAL catalog
 */
export interface ParsedOscalCatalog {
  metadata: ParsedFrameworkMetadata;
  controls: ParsedControl[];
  rawCatalog: OscalCatalog;
}

/**
 * Import preview data for user review before committing
 */
export interface OscalImportPreview {
  metadata: ParsedFrameworkMetadata;
  controlCount: number;
  groupCount: number;
  topLevelControls: Array<{
    id: string;
    title: string;
    childCount: number;
  }>;
  issues: OscalValidationIssue[];
  isValid: boolean;
}

/**
 * Validation issue found during OSCAL parsing
 */
export interface OscalValidationIssue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  path?: string;
  controlId?: string;
}

/**
 * OSCAL import result after committing to database
 */
export interface OscalImportResult {
  success: boolean;
  frameworkId: string;
  frameworkCode: string;
  frameworkName: string;
  controlsImported: number;
  issues: OscalValidationIssue[];
}
