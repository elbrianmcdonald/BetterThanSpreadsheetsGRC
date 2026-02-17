/**
 * File Validation Utilities
 *
 * Provides file validation for evidence uploads.
 * Used on both client-side (instant feedback) and server-side (security).
 *
 * @see Story 3.1: Evidence File Upload and Processing
 * @module utils/file-validation
 */

// Maximum file size: 50MB per NFR3
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Supported file extensions
export const SUPPORTED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".xlsx",
  ".docx",
  ".txt",
] as const;

// Supported MIME types
export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

// Map of MIME types to valid extensions
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
};

// Map of extensions to display names
const EXTENSION_NAMES: Record<string, string> = {
  ".pdf": "PDF",
  ".png": "PNG",
  ".jpg": "JPEG",
  ".jpeg": "JPEG",
  ".xlsx": "Excel",
  ".docx": "Word",
  ".txt": "Text",
};

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface FileValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) return "";
  return fileName.substring(lastDot).toLowerCase();
}

/**
 * Validate file type by extension
 */
export function validateFileType(fileName: string): ValidationError | null {
  const extension = getFileExtension(fileName);

  if (!extension) {
    return {
      field: "fileType",
      message: "File must have an extension",
      code: "MISSING_EXTENSION",
    };
  }

  if (!SUPPORTED_EXTENSIONS.includes(extension as (typeof SUPPORTED_EXTENSIONS)[number])) {
    return {
      field: "fileType",
      message: `File type "${extension}" is not supported. Supported types: ${SUPPORTED_EXTENSIONS.join(", ")}`,
      code: "UNSUPPORTED_EXTENSION",
    };
  }

  return null;
}

/**
 * Validate file size
 */
export function validateFileSize(fileSize: number): ValidationError | null {
  if (fileSize <= 0) {
    return {
      field: "fileSize",
      message: "File cannot be empty",
      code: "EMPTY_FILE",
    };
  }

  if (fileSize > MAX_FILE_SIZE) {
    const maxMB = MAX_FILE_SIZE / (1024 * 1024);
    const fileMB = (fileSize / (1024 * 1024)).toFixed(2);
    return {
      field: "fileSize",
      message: `File size (${fileMB}MB) exceeds maximum limit of ${maxMB}MB`,
      code: "FILE_TOO_LARGE",
    };
  }

  return null;
}

/**
 * Validate MIME type
 */
export function validateMimeType(mimeType: string): ValidationError | null {
  if (!mimeType) {
    return {
      field: "mimeType",
      message: "File MIME type is required",
      code: "MISSING_MIME_TYPE",
    };
  }

  if (!SUPPORTED_MIME_TYPES.includes(mimeType as (typeof SUPPORTED_MIME_TYPES)[number])) {
    return {
      field: "mimeType",
      message: `MIME type "${mimeType}" is not supported`,
      code: "UNSUPPORTED_MIME_TYPE",
    };
  }

  return null;
}

/**
 * Validate MIME type matches file extension
 */
export function validateMimeTypeMatchesExtension(
  mimeType: string,
  fileName: string
): ValidationError | null {
  const extension = getFileExtension(fileName);
  const validExtensions = MIME_TO_EXTENSIONS[mimeType];

  if (!validExtensions) {
    return {
      field: "mimeType",
      message: `Unknown MIME type "${mimeType}"`,
      code: "UNKNOWN_MIME_TYPE",
    };
  }

  if (!validExtensions.includes(extension)) {
    return {
      field: "mimeType",
      message: `MIME type "${mimeType}" does not match file extension "${extension}"`,
      code: "MIME_EXTENSION_MISMATCH",
    };
  }

  return null;
}

/**
 * Sanitize file name
 *
 * Removes special characters and path traversal sequences.
 * Returns sanitized name that is safe for filesystem storage.
 */
export function sanitizeFileName(fileName: string): string {
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
      // Remove leading/trailing underscores and dots (except extension)
      .replace(/^[._]+/, "")
      .replace(/[._]+$/, "")
      // Limit length (max 200 chars, leave room for UUID prefix)
      .substring(0, 200) || "unnamed_file"
  );
}

/**
 * Validate file name for dangerous characters
 */
export function validateFileName(fileName: string): ValidationError | null {
  if (!fileName) {
    return {
      field: "fileName",
      message: "File name is required",
      code: "MISSING_FILENAME",
    };
  }

  // Check for path traversal
  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return {
      field: "fileName",
      message: "File name contains invalid characters",
      code: "INVALID_FILENAME",
    };
  }

  // Check for excessive length
  if (fileName.length > 255) {
    return {
      field: "fileName",
      message: "File name is too long (maximum 255 characters)",
      code: "FILENAME_TOO_LONG",
    };
  }

  return null;
}

/**
 * Validate a file completely
 *
 * Runs all validations and returns combined result.
 */
export function validateFile(
  fileName: string,
  fileSize: number,
  mimeType: string
): FileValidationResult {
  const errors: ValidationError[] = [];

  // Run all validations
  const fileNameError = validateFileName(fileName);
  if (fileNameError) errors.push(fileNameError);

  const fileTypeError = validateFileType(fileName);
  if (fileTypeError) errors.push(fileTypeError);

  const fileSizeError = validateFileSize(fileSize);
  if (fileSizeError) errors.push(fileSizeError);

  const mimeTypeError = validateMimeType(mimeType);
  if (mimeTypeError) errors.push(mimeTypeError);

  // Only check MIME/extension match if both are valid
  if (!fileTypeError && !mimeTypeError) {
    const mimeMatchError = validateMimeTypeMatchesExtension(mimeType, fileName);
    if (mimeMatchError) errors.push(mimeMatchError);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get display name for file type
 */
export function getFileTypeDisplayName(fileName: string): string {
  const extension = getFileExtension(fileName);
  return EXTENSION_NAMES[extension] ?? "Unknown";
}

/**
 * Get accept attribute for file input
 */
export function getAcceptAttribute(): string {
  return [...SUPPORTED_EXTENSIONS, ...SUPPORTED_MIME_TYPES].join(",");
}
