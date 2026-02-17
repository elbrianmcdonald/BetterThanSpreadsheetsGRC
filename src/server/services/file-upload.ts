/**
 * File Upload Service - Handles secure file storage for evidence uploads
 *
 * Manages file storage with multi-tenant isolation via organization-specific directories.
 * Implements file name sanitization and unique naming to prevent collisions.
 *
 * @see Story 3.1: Evidence File Upload and Processing
 * @module server/services/file-upload
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { env } from "@/env";

// Upload directory from environment or default to Docker volume mount
const UPLOAD_DIR = env.UPLOAD_DIR ?? "./uploads";

// Maximum file size: 50MB per NFR3
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Supported file types for evidence upload
const SUPPORTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".xlsx", ".docx", ".txt"];
const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export interface FileUploadResult {
  /** Stored file name with UUID prefix */
  fileName: string;
  /** Full file path in storage */
  filePath: string;
  /** File size in bytes */
  fileSize: number;
  /** Detected MIME type */
  mimeType: string;
}

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * File Upload Service
 *
 * Provides secure file storage with:
 * - Multi-tenant isolation (organization subdirectories)
 * - File name sanitization (prevent path traversal)
 * - Unique file naming (UUID prefix)
 * - Size and type validation
 */
export class FileUploadService {
  private uploadDir: string;

  constructor(uploadDir?: string) {
    this.uploadDir = uploadDir ?? UPLOAD_DIR;
  }

  /**
   * Save file to storage with organization isolation
   *
   * @param file - File buffer content
   * @param originalName - Original file name from upload
   * @param organizationId - Organization ID for directory isolation
   * @returns File metadata with storage location
   */
  async saveFile(
    file: Buffer,
    originalName: string,
    organizationId: string,
    mimeType: string
  ): Promise<FileUploadResult> {
    // Sanitize filename
    const sanitized = this.sanitizeFileName(originalName);
    const fileName = `${randomUUID()}_${sanitized}`;

    // Create organization directory
    const orgDir = path.join(this.uploadDir, organizationId);
    await fs.mkdir(orgDir, { recursive: true });

    // Write file
    const filePath = path.join(orgDir, fileName);
    await fs.writeFile(filePath, file);

    const stats = await fs.stat(filePath);

    return {
      fileName,
      filePath,
      fileSize: stats.size,
      mimeType,
    };
  }

  /**
   * Save file to temporary location for malware scanning
   *
   * @param file - File buffer content
   * @param originalName - Original file name
   * @returns Temporary file path
   */
  async saveToTemp(file: Buffer, originalName: string): Promise<string> {
    const sanitized = this.sanitizeFileName(originalName);
    const tempPath = path.join(this.uploadDir, "temp", `${randomUUID()}_${sanitized}`);

    // Ensure temp directory exists
    await fs.mkdir(path.join(this.uploadDir, "temp"), { recursive: true });

    await fs.writeFile(tempPath, file);
    return tempPath;
  }

  /**
   * Move file from temp to permanent storage
   *
   * @param tempPath - Current temp file path
   * @param organizationId - Target organization ID
   * @returns Final file metadata
   */
  async moveFromTemp(
    tempPath: string,
    organizationId: string,
    originalName: string,
    mimeType: string
  ): Promise<FileUploadResult> {
    const file = await fs.readFile(tempPath);

    // Delete temp file
    await fs.unlink(tempPath).catch(() => {
      // Ignore if already deleted
    });

    return this.saveFile(file, originalName, organizationId, mimeType);
  }

  /**
   * Delete a file from storage
   *
   * @param filePath - Full path to file
   */
  async deleteFile(filePath: string): Promise<void> {
    await fs.unlink(filePath).catch(() => {
      // File may not exist, ignore error
    });
  }

  /**
   * Delete a temporary file (cleanup after scan failure)
   *
   * @param tempPath - Temporary file path
   */
  async deleteTempFile(tempPath: string): Promise<void> {
    await fs.unlink(tempPath).catch(() => {
      // Ignore if already deleted
    });
  }

  /**
   * Get file contents
   *
   * @param filePath - Full path to file
   * @returns File buffer
   */
  async getFile(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }

  /**
   * Check if file exists
   *
   * @param filePath - Full path to file
   * @returns True if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize file name to prevent path traversal and invalid characters
   *
   * Replaces special characters with underscores and removes path traversal sequences.
   *
   * @param fileName - Original file name
   * @returns Sanitized file name
   */
  sanitizeFileName(fileName: string): string {
    return (
      fileName
        // Replace path traversal sequences
        .replace(/\.\./g, "")
        .replace(/\//g, "_")
        .replace(/\\/g, "_")
        // Replace special characters except alphanumeric, dots, underscores, dashes
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        // Replace multiple consecutive underscores/dots
        .replace(/\.\.+/g, ".")
        .replace(/__+/g, "_")
        // Remove leading/trailing underscores and dots
        .replace(/^[._]+|[._]+$/g, "")
        // Limit length (max 255 chars for most filesystems)
        .substring(0, 200)
    );
  }

  /**
   * Validate file before upload
   *
   * Checks:
   * - File size within limits (50MB)
   * - File extension is supported
   * - MIME type matches extension
   *
   * @param file - File buffer
   * @param originalName - Original file name
   * @param mimeType - Declared MIME type
   * @returns Validation result with errors
   */
  validateFile(file: Buffer, originalName: string, mimeType: string): FileValidationResult {
    const errors: string[] = [];

    // Check file size
    if (file.length > MAX_FILE_SIZE) {
      errors.push(`File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Check file extension
    const ext = path.extname(originalName).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      errors.push(
        `File type "${ext}" is not supported. Supported types: ${SUPPORTED_EXTENSIONS.join(", ")}`
      );
    }

    // Check MIME type
    if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
      errors.push(`MIME type "${mimeType}" is not supported`);
    }

    // Check MIME type matches extension (basic validation)
    const mimeExtMatch = this.validateMimeTypeExtension(mimeType, ext);
    if (!mimeExtMatch) {
      errors.push(`MIME type "${mimeType}" does not match file extension "${ext}"`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate MIME type matches file extension
   */
  private validateMimeTypeExtension(mimeType: string, extension: string): boolean {
    const mimeToExt: Record<string, string[]> = {
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    };

    const validExtensions = mimeToExt[mimeType];
    if (!validExtensions) return false;

    return validExtensions.includes(extension);
  }

  /**
   * Get upload directory path for an organization
   */
  getOrgUploadPath(organizationId: string): string {
    return path.join(this.uploadDir, organizationId);
  }
}

// Export singleton instance
export const fileUploadService = new FileUploadService();

// Export constants for reuse
export { MAX_FILE_SIZE, SUPPORTED_EXTENSIONS, SUPPORTED_MIME_TYPES };
