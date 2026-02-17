/**
 * Evidence Version Download API Route
 *
 * Story 3.5: AC10, AC20 - Download previous versions
 *
 * Features:
 * - File streaming for memory-efficient downloads
 * - Multi-tenant access validation via parent evidence
 * - Proper Content-Type and Content-Disposition headers
 *
 * @see Story 3.5: Evidence Metadata Tracking and Version History
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { fileStorageService } from "@/server/services/file-storage";

interface RouteParams {
  params: Promise<{ versionId: string }>;
}

/**
 * GET /api/evidence/version/[versionId]/download
 *
 * Downloads a specific version of an evidence file.
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { versionId } = await context.params;

    if (!versionId) {
      return new NextResponse("Version ID is required", { status: 400 });
    }

    // Get version record with parent evidence for org validation
    const version = await db.evidenceVersion.findUnique({
      where: { id: versionId },
      include: {
        Evidence: {
          select: {
            id: true,
            organizationId: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!version) {
      return new NextResponse("Version not found", { status: 404 });
    }

    // Check if version is soft-deleted
    if (version.deletedAt) {
      return new NextResponse("Version has been deleted", { status: 410 });
    }

    // Validate organization access via parent evidence
    if (version.Evidence.organizationId !== session.user.organizationId) {
      console.error(
        `[VersionDownload] Access denied: User ${session.user.id} from org ${session.user.organizationId} ` +
        `attempted to access version ${versionId} from org ${version.Evidence.organizationId}`
      );
      return new NextResponse("Access denied", { status: 403 });
    }

    // Build storage path from version storagePath
    const storagePath = extractStoragePath(version.storagePath, version.Evidence.organizationId);

    if (!storagePath) {
      console.error(`[VersionDownload] Invalid file path: ${version.storagePath}`);
      return new NextResponse("File path is invalid", { status: 500 });
    }

    // Check if file exists
    const exists = await fileStorageService.fileExists(storagePath);
    if (!exists) {
      console.error(`[VersionDownload] File not found on disk: ${storagePath}`);
      return new NextResponse("File not found on storage", { status: 404 });
    }

    // Determine file type from filename extension
    const fileType = getFileType(version.filename);

    // Full file download
    const { stream } = await fileStorageService.createReadStream(
      storagePath,
      version.Evidence.organizationId
    );

    // Convert Node.js stream to Web API ReadableStream
    const webStream = nodeStreamToWebStream(stream);

    // Include version number in downloaded filename
    const downloadFilename = `v${version.versionNumber}_${version.filename}`;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": fileType,
        "Content-Length": String(version.fileSize),
        "Accept-Ranges": "bytes",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(downloadFilename)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[VersionDownload] Error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

/**
 * Extract relative storage path from full file path
 */
function extractStoragePath(filePath: string, organizationId: string): string | null {
  // Normalize path separators
  const normalized = filePath.replace(/\\/g, "/");

  // Try to find organizationId in the path
  const orgIndex = normalized.indexOf(`/${organizationId}/`);
  if (orgIndex !== -1) {
    return normalized.substring(orgIndex + 1);
  }

  // Try with path segments
  const parts = normalized.split("/");
  const orgPartIndex = parts.findIndex((p) => p === organizationId);

  if (orgPartIndex !== -1) {
    return parts.slice(orgPartIndex).join("/");
  }

  // If path already starts with organizationId, it might be relative
  if (normalized.startsWith(organizationId)) {
    return normalized;
  }

  return null;
}

/**
 * Get MIME type from filename extension
 */
function getFileType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    xml: "application/xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    zip: "application/zip",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}

/**
 * Convert Node.js Readable stream to Web API ReadableStream
 */
function nodeStreamToWebStream(nodeStream: NodeJS.ReadableStream): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      nodeStream.on("end", () => {
        controller.close();
      });
      nodeStream.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      // @ts-expect-error - destroy may not exist on all streams
      if (typeof nodeStream.destroy === "function") {
        // @ts-expect-error - destroy exists
        nodeStream.destroy();
      }
    },
  });
}
