/**
 * Storage Health Check API Route
 *
 * Story 3.2: File Storage in Docker Volumes
 *
 * Verifies that the file storage volume is:
 * - Mounted and accessible
 * - Writable by the application
 * - Has sufficient disk space
 *
 * @see Story 3.2: File Storage in Docker Volumes
 */

import { NextResponse } from "next/server";
import { fileStorageService } from "@/server/services/file-storage";

/**
 * GET /api/health/storage
 *
 * Returns storage health status for monitoring and diagnostics.
 *
 * Response format:
 * {
 *   healthy: boolean,
 *   uploadDir: string,
 *   exists: boolean,
 *   writable: boolean,
 *   availableSpace?: number,
 *   error?: string
 * }
 */
export async function GET(): Promise<NextResponse> {
  try {
    const status = await fileStorageService.getHealthStatus();

    const httpStatus = status.healthy ? 200 : 503;

    return NextResponse.json(status, { status: httpStatus });
  } catch (error) {
    console.error("[Health/Storage] Check failed:", error);

    return NextResponse.json(
      {
        healthy: false,
        uploadDir: "unknown",
        exists: false,
        writable: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
