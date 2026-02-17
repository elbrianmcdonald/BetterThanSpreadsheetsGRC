/**
 * File Storage Service - Production-ready file storage for evidence uploads
 *
 * Story 3.2: File Storage in Docker Volumes
 *
 * Features:
 * - Multi-tenant isolation via organization subdirectories
 * - Evidence-specific subdirectories for organization
 * - Atomic file writes (temp file → rename pattern)
 * - Disk space validation before writes
 * - File streaming for memory-efficient downloads
 * - HTTP range request support for large files
 * - Storage health checks and initialization
 *
 * Directory structure: /app/uploads/{organizationId}/{evidenceId}/{filename}
 *
 * @see Story 3.2: File Storage in Docker Volumes
 * @module server/services/file-storage
 */

import fs from "fs/promises";
import { createReadStream, createWriteStream, statSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { env } from "@/env";
import type { Readable } from "stream";

// Storage configuration
const DEFAULT_UPLOAD_DIR = process.env.NODE_ENV === "production" ? "/app/uploads" : "./uploads";
const UPLOAD_DIR = env.UPLOAD_DIR ?? DEFAULT_UPLOAD_DIR;

// Minimum required disk space (100MB buffer)
const MIN_DISK_SPACE_BYTES = 100 * 1024 * 1024;

// File permissions (octal): owner + group read/write
const FILE_MODE = 0o660;
const DIR_MODE = 0o770;

export interface StorageMetadata {
  /** Relative storage path: {orgId}/{evidenceId}/{filename} */
  storagePath: string;
  /** Stored filename with UUID prefix */
  filename: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME type */
  mimeType: string;
  /** Full absolute path to file */
  absolutePath: string;
}

export interface StorageHealthStatus {
  /** Whether storage is operational */
  healthy: boolean;
  /** Base upload directory */
  uploadDir: string;
  /** Whether directory exists */
  exists: boolean;
  /** Whether directory is writable */
  writable: boolean;
  /** Available disk space in bytes (if available) */
  availableSpace?: number;
  /** Error message if unhealthy */
  error?: string;
}

export interface FileStreamOptions {
  /** Start byte position for range requests */
  start?: number;
  /** End byte position for range requests */
  end?: number;
}

/**
 * File Storage Service
 *
 * Production-ready file storage with:
 * - Multi-tenant isolation (organization/evidence subdirectories)
 * - Atomic writes to prevent partial files
 * - Disk space validation
 * - File streaming for efficient downloads
 */
export class FileStorageService {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? UPLOAD_DIR;
  }

  /**
   * Initialize file storage - call on server startup
   *
   * Verifies storage directory exists and is writable.
   * Creates directory if it doesn't exist.
   *
   * @throws Error if storage cannot be initialized
   */
  async initialize(): Promise<void> {
    try {
      // Create base directory if needed
      await fs.mkdir(this.baseDir, { recursive: true, mode: DIR_MODE });

      // Verify write permissions by creating and deleting a test file
      const testFile = path.join(this.baseDir, `.write-test-${randomUUID()}`);
      await fs.writeFile(testFile, "test", { mode: FILE_MODE });
      await fs.unlink(testFile);

      console.log(`[FileStorage] Initialized at ${this.baseDir}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[FileStorage] Initialization failed: ${message}`);
      throw new Error(`File storage not writable at ${this.baseDir}: ${message}`);
    }
  }

  /**
   * Check storage health status
   *
   * Used by health check endpoint to verify storage is operational.
   */
  async getHealthStatus(): Promise<StorageHealthStatus> {
    const status: StorageHealthStatus = {
      healthy: false,
      uploadDir: this.baseDir,
      exists: false,
      writable: false,
    };

    try {
      // Check if directory exists
      await fs.access(this.baseDir);
      status.exists = true;

      // Check write permissions
      const testFile = path.join(this.baseDir, `.health-check-${randomUUID()}`);
      try {
        await fs.writeFile(testFile, "health", { mode: FILE_MODE });
        await fs.unlink(testFile);
        status.writable = true;
      } catch {
        status.writable = false;
      }

      // Get available disk space (platform-dependent)
      try {
        const spaceInfo = await this.getAvailableDiskSpace();
        status.availableSpace = spaceInfo;
      } catch {
        // Disk space check not available on all platforms
      }

      status.healthy = status.exists && status.writable;
    } catch (error) {
      status.error = error instanceof Error ? error.message : "Unknown error";
    }

    return status;
  }

  /**
   * Save file to storage with organization and evidence isolation
   *
   * Uses atomic write pattern: write to temp file, then rename.
   * This prevents partial file writes if the process crashes.
   *
   * @param params - File save parameters
   * @returns Storage metadata including path and size
   */
  async saveFile(params: {
    organizationId: string;
    evidenceId: string;
    filename: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<StorageMetadata> {
    const { organizationId, evidenceId, filename, buffer, mimeType } = params;

    // Check disk space before writing
    await this.ensureDiskSpace(buffer.length);

    // Sanitize and create unique filename
    const sanitizedFilename = this.sanitizeFilename(filename);
    const uniqueFilename = `${randomUUID()}_${sanitizedFilename}`;

    // Create directory structure: {baseDir}/{orgId}/{evidenceId}/
    const dir = path.join(this.baseDir, organizationId, evidenceId);
    await fs.mkdir(dir, { recursive: true, mode: DIR_MODE });

    // Atomic write: temp file → rename
    const finalPath = path.join(dir, uniqueFilename);
    const tempPath = `${finalPath}.tmp`;

    try {
      // Write to temp file
      await fs.writeFile(tempPath, buffer, { mode: FILE_MODE });

      // Atomic rename to final location
      await fs.rename(tempPath, finalPath);

      // Get final file stats
      const stats = await fs.stat(finalPath);

      // Construct relative storage path
      const storagePath = path.join(organizationId, evidenceId, uniqueFilename);

      console.log(`[FileStorage] Saved file: ${storagePath} (${stats.size} bytes)`);

      return {
        storagePath,
        filename: uniqueFilename,
        fileSize: stats.size,
        mimeType,
        absolutePath: finalPath,
      };
    } catch (error) {
      // Cleanup temp file on failure
      await fs.unlink(tempPath).catch(() => {
        // Ignore cleanup errors
      });

      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[FileStorage] Save failed for ${organizationId}/${evidenceId}/${filename}: ${message}`);

      // Provide user-friendly error messages
      if ((error as NodeJS.ErrnoException).code === "ENOSPC") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Storage is full. Please contact your administrator.",
        });
      }

      if ((error as NodeJS.ErrnoException).code === "EACCES") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Storage permission denied. Please contact your administrator.",
        });
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to save file. Please try again.",
        cause: error,
      });
    }
  }

  /**
   * Read file as Buffer
   *
   * Validates organization access before reading.
   *
   * @param storagePath - Relative storage path
   * @param organizationId - Expected organization ID for access validation
   * @returns File buffer
   */
  async readFile(storagePath: string, organizationId: string): Promise<Buffer> {
    // Validate organization access
    if (!this.validateOrganizationAccess(storagePath, organizationId)) {
      console.error(`[FileStorage] Access denied: ${organizationId} attempted to read ${storagePath}`);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Access denied to this file",
      });
    }

    const fullPath = this.getAbsolutePath(storagePath);

    try {
      const buffer = await fs.readFile(fullPath);
      console.log(`[FileStorage] Read file: ${storagePath}`);
      return buffer;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === "ENOENT") {
        console.error(`[FileStorage] File not found: ${storagePath}`);
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File not found",
        });
      }

      console.error(`[FileStorage] Read failed for ${storagePath}: ${(error as Error).message}`);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to read file",
        cause: error,
      });
    }
  }

  /**
   * Create a read stream for file download
   *
   * Supports range requests for resumable downloads of large files.
   *
   * @param storagePath - Relative storage path
   * @param organizationId - Expected organization ID for access validation
   * @param options - Stream options including byte range
   * @returns Readable stream and file stats
   */
  async createReadStream(
    storagePath: string,
    organizationId: string,
    options?: FileStreamOptions
  ): Promise<{ stream: Readable; fileSize: number; mimeType?: string }> {
    // Validate organization access
    if (!this.validateOrganizationAccess(storagePath, organizationId)) {
      console.error(`[FileStorage] Access denied: ${organizationId} attempted to stream ${storagePath}`);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Access denied to this file",
      });
    }

    const fullPath = this.getAbsolutePath(storagePath);

    try {
      // Get file stats for content-length
      const stats = statSync(fullPath);

      // Create stream with optional range
      const streamOptions: { start?: number; end?: number } = {};
      if (options?.start !== undefined) {
        streamOptions.start = options.start;
      }
      if (options?.end !== undefined) {
        streamOptions.end = options.end;
      }

      const stream = createReadStream(fullPath, streamOptions);

      console.log(
        `[FileStorage] Streaming file: ${storagePath} (range: ${options?.start ?? 0}-${options?.end ?? stats.size})`
      );

      return {
        stream,
        fileSize: stats.size,
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === "ENOENT") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File not found",
        });
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to stream file",
        cause: error,
      });
    }
  }

  /**
   * Delete file from storage
   *
   * Validates organization access before deleting.
   * Does not throw if file doesn't exist (idempotent).
   *
   * @param storagePath - Relative storage path
   * @param organizationId - Expected organization ID for access validation
   * @returns True if file was deleted, false if it didn't exist
   */
  async deleteFile(storagePath: string, organizationId: string): Promise<boolean> {
    // Validate organization access
    if (!this.validateOrganizationAccess(storagePath, organizationId)) {
      console.error(`[FileStorage] Access denied: ${organizationId} attempted to delete ${storagePath}`);
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Access denied to this file",
      });
    }

    const fullPath = this.getAbsolutePath(storagePath);

    try {
      await fs.unlink(fullPath);
      console.log(`[FileStorage] Deleted file: ${storagePath}`);

      // Try to clean up empty parent directories
      await this.cleanupEmptyDirectories(fullPath);

      return true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === "ENOENT") {
        // File already deleted - this is fine (idempotent)
        console.log(`[FileStorage] File already deleted: ${storagePath}`);
        return false;
      }

      console.error(`[FileStorage] Delete failed for ${storagePath}: ${(error as Error).message}`);
      // Don't throw - log the error but allow database deletion to proceed
      return false;
    }
  }

  /**
   * Check if file exists
   *
   * @param storagePath - Relative storage path
   * @returns True if file exists
   */
  async fileExists(storagePath: string): Promise<boolean> {
    const fullPath = this.getAbsolutePath(storagePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats
   *
   * @param storagePath - Relative storage path
   * @returns File stats or null if not found
   */
  async getFileStats(storagePath: string): Promise<{ size: number; mtime: Date } | null> {
    const fullPath = this.getAbsolutePath(storagePath);
    try {
      const stats = await fs.stat(fullPath);
      return {
        size: stats.size,
        mtime: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  /**
   * Validate that storagePath belongs to the given organization
   *
   * Prevents path traversal attacks and cross-organization access.
   *
   * @param storagePath - Relative storage path
   * @param organizationId - Organization ID to validate against
   * @returns True if access is allowed
   */
  validateOrganizationAccess(storagePath: string, organizationId: string): boolean {
    // Normalize path to prevent traversal attacks
    const normalized = path.normalize(storagePath);

    // Check for path traversal attempts
    if (normalized.includes("..") || normalized.startsWith("/") || normalized.startsWith("\\")) {
      return false;
    }

    // Verify organization ID is the first path component
    const parts = normalized.split(path.sep);
    return parts[0] === organizationId;
  }

  /**
   * Get absolute path from storage path
   */
  getAbsolutePath(storagePath: string): string {
    return path.join(this.baseDir, storagePath);
  }

  /**
   * Sanitize filename to prevent path traversal and invalid characters
   */
  private sanitizeFilename(filename: string): string {
    return (
      filename
        // Remove path traversal
        .replace(/\.\./g, "")
        .replace(/[/\\]/g, "_")
        // Remove special characters except alphanumeric, dots, underscores, dashes
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        // Collapse multiple underscores/dots
        .replace(/\.\.+/g, ".")
        .replace(/__+/g, "_")
        // Remove leading/trailing special chars
        .replace(/^[._]+|[._]+$/g, "")
        // Limit length
        .substring(0, 200) || "unnamed"
    );
  }

  /**
   * Check available disk space and throw if insufficient
   */
  private async ensureDiskSpace(requiredBytes: number): Promise<void> {
    try {
      const available = await this.getAvailableDiskSpace();
      const required = requiredBytes + MIN_DISK_SPACE_BYTES;

      if (available < required) {
        console.error(
          `[FileStorage] Insufficient disk space: ${available} bytes available, ${required} bytes required`
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Insufficient storage space. Please contact your administrator.",
        });
      }
    } catch (error) {
      // If we can't check disk space, log warning but allow write to proceed
      if (!(error instanceof TRPCError)) {
        console.warn("[FileStorage] Unable to check disk space, proceeding with write");
      } else {
        throw error;
      }
    }
  }

  /**
   * Get available disk space in bytes
   */
  private async getAvailableDiskSpace(): Promise<number> {
    // Node.js 18.15+ has fs.statfs
    try {
      if (typeof fs.statfs === "function") {
        const stats = await fs.statfs(this.baseDir);
        return stats.bavail * stats.bsize;
      }
    } catch {
      // Fall through to alternative methods
    }

    // Fallback for Windows: use child_process
    if (process.platform === "win32") {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);

      try {
        const drive = path.parse(path.resolve(this.baseDir)).root;
        const { stdout } = await execAsync(`wmic logicaldisk where "DeviceID='${drive.replace("\\", "")}'" get FreeSpace`);
        const freeSpace = parseInt(stdout.split("\n")[1]?.trim() ?? "0", 10);
        return freeSpace;
      } catch {
        // Can't determine disk space
      }
    }

    // If we can't determine disk space, return a large number to allow writes
    return Number.MAX_SAFE_INTEGER;
  }

  /**
   * Clean up empty parent directories after file deletion
   */
  private async cleanupEmptyDirectories(filePath: string): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      const entries = await fs.readdir(dir);

      if (entries.length === 0) {
        await fs.rmdir(dir);

        // Try parent directory too (evidence dir inside org dir)
        const parentDir = path.dirname(dir);
        if (parentDir !== this.baseDir) {
          const parentEntries = await fs.readdir(parentDir);
          if (parentEntries.length === 0) {
            await fs.rmdir(parentDir);
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Get base upload directory
   */
  getBaseDir(): string {
    return this.baseDir;
  }
}

// Export singleton instance
export const fileStorageService = new FileStorageService();
