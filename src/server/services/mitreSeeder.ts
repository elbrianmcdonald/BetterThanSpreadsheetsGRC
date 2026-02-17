/**
 * MITRE ATT&CK STIX JSON Seeder Service
 *
 * Story 13.2: STIX JSON Seeder Service
 *
 * Fetches MITRE ATT&CK data from the official GitHub repository and
 * seeds the database with tactics, techniques, and their relationships.
 *
 * Data source: https://github.com/mitre-attack/attack-stix-data
 */

import { PrismaClient, MitreSyncStatus } from "@prisma/client";

// Official MITRE ATT&CK Enterprise STIX JSON URL
const MITRE_STIX_URL =
  "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json";

// Kill chain phase order for tactics
const KILL_CHAIN_ORDER: Record<string, number> = {
  reconnaissance: 1,
  "resource-development": 2,
  "initial-access": 3,
  execution: 4,
  persistence: 5,
  "privilege-escalation": 6,
  "defense-evasion": 7,
  "credential-access": 8,
  discovery: 9,
  "lateral-movement": 10,
  collection: 11,
  "command-and-control": 12,
  exfiltration: 13,
  impact: 14,
};

// STIX object types
interface StixObject {
  type: string;
  id: string;
  name?: string;
  description?: string;
  external_references?: Array<{
    source_name: string;
    external_id?: string;
    url?: string;
  }>;
  x_mitre_shortname?: string;
  x_mitre_is_subtechnique?: boolean;
  x_mitre_detection?: string;
  kill_chain_phases?: Array<{
    kill_chain_name: string;
    phase_name: string;
  }>;
  revoked?: boolean;
  x_mitre_deprecated?: boolean;
}

interface StixRelationship {
  type: "relationship";
  id: string;
  relationship_type: string;
  source_ref: string;
  target_ref: string;
}

interface StixBundle {
  type: "bundle";
  id: string;
  objects: (StixObject | StixRelationship)[];
}

interface SeederResult {
  success: boolean;
  tacticsCount: number;
  techniquesCount: number;
  subTechniquesCount: number;
  relationshipsCount: number;
  error?: string;
  version?: string;
}

interface SeederProgress {
  phase: "fetching" | "parsing" | "seeding-tactics" | "seeding-techniques" | "seeding-relationships" | "complete" | "error";
  message: string;
  progress?: number;
}

type ProgressCallback = (progress: SeederProgress) => void;

/**
 * Fetches the MITRE ATT&CK STIX bundle from GitHub
 */
async function fetchStixBundle(onProgress?: ProgressCallback): Promise<StixBundle> {
  onProgress?.({ phase: "fetching", message: "Fetching MITRE ATT&CK data from GitHub..." });

  const response = await fetch(MITRE_STIX_URL, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch MITRE data: ${response.status} ${response.statusText}`);
  }

  const bundle = (await response.json()) as StixBundle;

  if (bundle.type !== "bundle" || !Array.isArray(bundle.objects)) {
    throw new Error("Invalid STIX bundle format");
  }

  return bundle;
}

/**
 * Extracts the MITRE external ID from a STIX object
 */
function getMitreExternalId(obj: StixObject): string | null {
  const mitreRef = obj.external_references?.find(
    (ref) => ref.source_name === "mitre-attack" && ref.external_id
  );
  return mitreRef?.external_id ?? null;
}

/**
 * Extracts the MITRE URL from a STIX object
 */
function getMitreUrl(obj: StixObject): string {
  const mitreRef = obj.external_references?.find(
    (ref) => ref.source_name === "mitre-attack" && ref.url
  );
  return mitreRef?.url ?? `https://attack.mitre.org/techniques/${getMitreExternalId(obj)?.replace(".", "/") ?? ""}`;
}

/**
 * Seeds MITRE ATT&CK data into the database
 */
export async function seedMitreData(
  db: PrismaClient,
  onProgress?: ProgressCallback
): Promise<SeederResult> {
  const result: SeederResult = {
    success: false,
    tacticsCount: 0,
    techniquesCount: 0,
    subTechniquesCount: 0,
    relationshipsCount: 0,
  };

  try {
    // Create sync metadata record
    const syncRecord = await db.mitreSyncMetadata.create({
      data: {
        lastSyncAt: new Date(),
        syncStatus: MitreSyncStatus.IN_PROGRESS,
      },
    });

    // Fetch STIX bundle
    const bundle = await fetchStixBundle(onProgress);
    onProgress?.({ phase: "parsing", message: "Parsing STIX bundle..." });

    // Extract tactics
    const tactics = bundle.objects.filter(
      (obj): obj is StixObject =>
        obj.type === "x-mitre-tactic" && !obj.revoked && !obj.x_mitre_deprecated
    );

    // Extract techniques (attack-pattern)
    const techniques = bundle.objects.filter(
      (obj): obj is StixObject =>
        obj.type === "attack-pattern" && !obj.revoked && !obj.x_mitre_deprecated
    );

    // Extract relationships (for sub-technique parent links)
    const relationships = bundle.objects.filter(
      (obj): obj is StixRelationship =>
        obj.type === "relationship" &&
        "relationship_type" in obj &&
        obj.relationship_type === "subtechnique-of"
    );

    // Build STIX ID to technique map for parent linking
    const stixIdToTechnique = new Map<string, StixObject>();
    techniques.forEach((t) => {
      stixIdToTechnique.set(t.id, t);
    });

    // Build sub-technique parent map
    const subTechniqueParentMap = new Map<string, string>(); // technique STIX ID -> parent STIX ID
    relationships.forEach((rel) => {
      subTechniqueParentMap.set(rel.source_ref, rel.target_ref);
    });

    // Seed tactics
    onProgress?.({ phase: "seeding-tactics", message: `Seeding ${tactics.length} tactics...` });

    const tacticIdMap = new Map<string, string>(); // shortName -> database ID

    for (const tactic of tactics) {
      const externalId = getMitreExternalId(tactic);
      if (!externalId) continue;

      const shortName = tactic.x_mitre_shortname ?? externalId.toLowerCase();
      const killChainOrder = KILL_CHAIN_ORDER[shortName] ?? 99;

      const upserted = await db.mitreTactic.upsert({
        where: { externalId },
        update: {
          name: tactic.name ?? externalId,
          description: tactic.description ?? "",
          url: getMitreUrl(tactic),
          shortName,
          killChainOrder,
          updatedAt: new Date(),
        },
        create: {
          externalId,
          name: tactic.name ?? externalId,
          description: tactic.description ?? "",
          url: getMitreUrl(tactic),
          shortName,
          killChainOrder,
        },
      });

      tacticIdMap.set(shortName, upserted.id);
      result.tacticsCount++;
    }

    // Seed techniques (parent techniques first)
    onProgress?.({ phase: "seeding-techniques", message: `Seeding ${techniques.length} techniques...` });

    const parentTechniques = techniques.filter((t) => !t.x_mitre_is_subtechnique);
    const subTechniques = techniques.filter((t) => t.x_mitre_is_subtechnique);

    const techniqueIdMap = new Map<string, string>(); // STIX ID -> database ID
    const externalIdToDbId = new Map<string, string>(); // External ID -> database ID

    // Seed parent techniques
    for (const technique of parentTechniques) {
      const externalId = getMitreExternalId(technique);
      if (!externalId) continue;

      const upserted = await db.mitreTechnique.upsert({
        where: { externalId },
        update: {
          name: technique.name ?? externalId,
          description: technique.description ?? "",
          url: getMitreUrl(technique),
          detection: technique.x_mitre_detection ?? null,
          isSubTechnique: false,
          parentId: null,
          updatedAt: new Date(),
        },
        create: {
          externalId,
          name: technique.name ?? externalId,
          description: technique.description ?? "",
          url: getMitreUrl(technique),
          detection: technique.x_mitre_detection ?? null,
          isSubTechnique: false,
        },
      });

      techniqueIdMap.set(technique.id, upserted.id);
      externalIdToDbId.set(externalId, upserted.id);
      result.techniquesCount++;
    }

    // Seed sub-techniques with parent links
    for (const technique of subTechniques) {
      const externalId = getMitreExternalId(technique);
      if (!externalId) continue;

      // Find parent
      const parentStixId = subTechniqueParentMap.get(technique.id);
      const parentDbId = parentStixId ? techniqueIdMap.get(parentStixId) : null;

      const upserted = await db.mitreTechnique.upsert({
        where: { externalId },
        update: {
          name: technique.name ?? externalId,
          description: technique.description ?? "",
          url: getMitreUrl(technique),
          detection: technique.x_mitre_detection ?? null,
          isSubTechnique: true,
          parentId: parentDbId,
          updatedAt: new Date(),
        },
        create: {
          externalId,
          name: technique.name ?? externalId,
          description: technique.description ?? "",
          url: getMitreUrl(technique),
          detection: technique.x_mitre_detection ?? null,
          isSubTechnique: true,
          parentId: parentDbId,
        },
      });

      techniqueIdMap.set(technique.id, upserted.id);
      externalIdToDbId.set(externalId, upserted.id);
      result.subTechniquesCount++;
    }

    // Seed tactic-technique relationships
    onProgress?.({ phase: "seeding-relationships", message: "Creating tactic-technique relationships..." });

    // Clear existing relationships to avoid duplicates on re-seed
    await db.mitreTacticTechnique.deleteMany({});

    for (const technique of techniques) {
      const techniqueDbId = techniqueIdMap.get(technique.id);
      if (!techniqueDbId) continue;

      const killChainPhases = technique.kill_chain_phases?.filter(
        (p) => p.kill_chain_name === "mitre-attack"
      ) ?? [];

      for (const phase of killChainPhases) {
        const tacticDbId = tacticIdMap.get(phase.phase_name);
        if (!tacticDbId) continue;

        await db.mitreTacticTechnique.upsert({
          where: {
            tacticId_techniqueId: {
              tacticId: tacticDbId,
              techniqueId: techniqueDbId,
            },
          },
          update: {},
          create: {
            tacticId: tacticDbId,
            techniqueId: techniqueDbId,
          },
        });
        result.relationshipsCount++;
      }
    }

    // Update sync metadata
    await db.mitreSyncMetadata.update({
      where: { id: syncRecord.id },
      data: {
        syncStatus: MitreSyncStatus.SUCCESS,
        tacticsCount: result.tacticsCount,
        techniquesCount: result.techniquesCount,
        subTechniquesCount: result.subTechniquesCount,
      },
    });

    result.success = true;
    onProgress?.({
      phase: "complete",
      message: `Seeding complete: ${result.tacticsCount} tactics, ${result.techniquesCount} techniques, ${result.subTechniquesCount} sub-techniques`,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    result.error = errorMessage;

    onProgress?.({ phase: "error", message: `Seeding failed: ${errorMessage}` });

    // Log error to sync metadata
    await db.mitreSyncMetadata.create({
      data: {
        lastSyncAt: new Date(),
        syncStatus: MitreSyncStatus.FAILED,
        errorMessage,
      },
    });

    return result;
  }
}

/**
 * Checks if MITRE data needs to be seeded (empty database)
 */
export async function needsMitreSeeding(db: PrismaClient): Promise<boolean> {
  const count = await db.mitreTactic.count();
  return count === 0;
}

/**
 * Gets the last sync information
 */
export async function getLastMitreSync(db: PrismaClient) {
  return db.mitreSyncMetadata.findFirst({
    orderBy: { createdAt: "desc" },
  });
}
