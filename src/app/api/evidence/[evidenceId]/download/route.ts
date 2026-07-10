/**
 * Evidence Download API Route
 *
 * Story 3.2: File Storage in Docker Volumes
 *
 * Features:
 * - File streaming for memory-efficient downloads
 * - HTTP range request support for resumable downloads
 * - Multi-tenant access validation
 * - Proper Content-Type and Content-Disposition headers
 *
 * @see Story 3.2: File Storage in Docker Volumes
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { fileStorageService } from "@/server/services/file-storage";
import { createAuditLog } from "@/server/services/audit-log.service";

interface RouteParams {
  params: Promise<{ evidenceId: string }>;
}

/**
 * GET /api/evidence/[evidenceId]/download
 *
 * Downloads an evidence file with support for:
 * - Range requests (partial content for resumable downloads)
 * - Proper MIME type handling
 * - Attachment disposition for download
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

    const { evidenceId } = await context.params;

    if (!evidenceId) {
      return new NextResponse("Evidence ID is required", { status: 400 });
    }

    // Get evidence record from database
    const evidence = await db.evidence.findUnique({
      where: { id: evidenceId },
      select: {
        id: true,
        filePath: true,
        fileType: true,
        fileSize: true,
        originalFileName: true,
        organizationId: true,
        isActive: true,
      },
    });

    if (!evidence) {
      return new NextResponse("Evidence not found", { status: 404 });
    }

    // Validate organization access
    if (evidence.organizationId !== session.user.organizationId) {
      console.error(
        `[Download] Access denied: User ${session.user.id} from org ${session.user.organizationId} ` +
        `attempted to access evidence ${evidenceId} from org ${evidence.organizationId}`
      );
      return new NextResponse("Access denied", { status: 403 });
    }

    // Check if evidence is active
    if (!evidence.isActive) {
      return new NextResponse("Evidence has been deleted", { status: 410 });
    }

    // Build storage path from file path
    // The filePath stored in DB is the full path, we need the relative storage path
    const storagePath = extractStoragePath(evidence.filePath, evidence.organizationId);

    if (!storagePath) {
      console.error(`[Download] Invalid file path: ${evidence.filePath}`);
      return new NextResponse("File path is invalid", { status: 500 });
    }

    // Check if file exists
    const exists = await fileStorageService.fileExists(storagePath);
    if (!exists) {
      console.error(`[Download] File not found on disk: ${storagePath}`);
      return new NextResponse("File not found on storage", { status: 404 });
    }

    // Story 3.8: Log DOWNLOAD_EVIDENCE action for audit trail (AC24-AC27 - auditor access logging)
    void createAuditLog({
      organizationId: evidence.organizationId,
      userId: session.user.id,
      action: "DOWNLOAD_EVIDENCE",
      entityType: "Evidence",
      entityId: evidenceId,
      changes: {
        before: null,
        after: {
          fileName: evidence.originalFileName,
          fileSize: evidence.fileSize,
          downloadedBy: session.user.email,
          userRole: session.user.role,
          isAuditor: session.user.role === "BUSINESS_USER",
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Parse Range header for partial content requests
    const rangeHeader = request.headers.get("range");
    const fileSize = evidence.fileSize;

    if (rangeHeader) {
      // Handle range request
      const range = parseRangeHeader(rangeHeader, fileSize);

      if (!range) {
        return new NextResponse("Range not satisfiable", {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
          },
        });
      }

      const { start, end } = range;
      const contentLength = end - start + 1;

      // Create read stream for range
      const { stream } = await fileStorageService.createReadStream(
        storagePath,
        evidence.organizationId,
        { start, end }
      );

      // Convert Node.js stream to Web API ReadableStream
      const webStream = nodeStreamToWebStream(stream);

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Type": evidence.fileType,
          "Content-Length": String(contentLength),
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(evidence.originalFileName)}"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // Full file download (no range)
    const { stream } = await fileStorageService.createReadStream(
      storagePath,
      evidence.organizationId
    );

    // Convert Node.js stream to Web API ReadableStream
    const webStream = nodeStreamToWebStream(stream);

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": evidence.fileType,
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(evidence.originalFileName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[Download] Error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

/**
 * Extract relative storage path from full file path
 *
 * Converts: /app/uploads/orgId/uuid_filename or ./uploads/orgId/uuid_filename
 * To: orgId/uuid_filename (without evidenceId subfolder for legacy)
 * Or: orgId/evidenceId/uuid_filename (with evidenceId subfolder for new structure)
 */
function extractStoragePath(filePath: string, organizationId: string): string | null {
  // Normalize path separators
  const normalized = filePath.replace(/\\/g, "/");

  // Try to find organizationId in the path
  const orgIndex = normalized.indexOf(`/${organizationId}/`);
  if (orgIndex !== -1) {
    // Return everything after the last occurrence of the base directory
    return normalized.substring(orgIndex + 1);
  }

  // Try with backslash-normalized path
  const parts = normalized.split("/");
  const orgPartIndex = parts.findIndex((p) => p === organizationId);

  if (orgPartIndex !== -1) {
    return parts.slice(orgPartIndex).join("/");
  }

  // If path doesn't contain organizationId, it might be a relative path already
  if (normalized.startsWith(organizationId)) {
    return normalized;
  }

  return null;
}

/**
 * Parse HTTP Range header
 *
 * Supports: bytes=0-499, bytes=500-999, bytes=-500, bytes=500-
 */
function parseRangeHeader(
  rangeHeader: string,
  fileSize: number
): { start: number; end: number } | null {
  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);

  if (!match) {
    return null;
  }

  const startStr = match[1] ?? "";
  const endStr = match[2] ?? "";
  let start: number;
  let end: number;

  if (startStr === "" && endStr !== "") {
    // bytes=-500 (last 500 bytes)
    const suffixLength = parseInt(endStr, 10);
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else if (startStr !== "" && endStr === "") {
    // bytes=500- (from byte 500 to end)
    start = parseInt(startStr, 10);
    end = fileSize - 1;
  } else if (startStr !== "" && endStr !== "") {
    // bytes=0-499 (specific range)
    start = parseInt(startStr, 10);
    end = Math.min(parseInt(endStr, 10), fileSize - 1);
  } else {
    return null;
  }

  // Validate range
  if (start > end || start >= fileSize) {
    return null;
  }

  return { start, end };
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
